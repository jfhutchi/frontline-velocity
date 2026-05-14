import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../game/state/gameStore';
import type { GameEngine } from '../game/GameEngine';

interface Props {
  engine: GameEngine | null;
}

const MINIMAP_PX = 188;

/**
 * Top-down tactical minimap. Reads the latest snapshot from the gameStore and
 * paints to a canvas each render so we can show a lot of blips without
 * thrashing the React reconciler. Left-clicking the minimap pans the tactical
 * camera to that world position — a baseline RTS convenience.
 */
export const Minimap: React.FC<Props> = ({ engine }) => {
  const minimap = useGameStore((s) => s.minimap);
  const cameraYaw = useGameStore((s) => s.cameraYaw);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !minimap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background "terrain" gradient — dark olive to muted brown to read as map.
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1f2a1c');
    grad.addColorStop(1, '#2a2218');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Outer grid for readability.
    ctx.strokeStyle = 'rgba(110, 130, 90, 0.18)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i += 1) {
      const t = (i * w) / 4;
      ctx.beginPath();
      ctx.moveTo(t, 0);
      ctx.lineTo(t, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, t);
      ctx.lineTo(w, t);
      ctx.stroke();
    }

    const half = minimap.mapSize / 2;
    const worldToPx = (wx: number, wz: number) => {
      const nx = (wx + half) / minimap.mapSize;
      const nz = (wz + half) / minimap.mapSize;
      return { px: nx * w, py: nz * h };
    };

    // Objective ring.
    if (minimap.objective) {
      const { px, py } = worldToPx(minimap.objective.x, minimap.objective.z);
      const r = (minimap.objective.radius / minimap.mapSize) * w;
      ctx.strokeStyle = 'rgba(255, 213, 79, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(4, r), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 213, 79, ${0.12 + 0.18 * minimap.objective.controlPercent})`;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(4, r), 0, Math.PI * 2);
      ctx.fill();
    }

    // Buildings first (under units).
    for (const b of minimap.blips) {
      if (b.kind !== 'building' && b.kind !== 'rubble') continue;
      const { px, py } = worldToPx(b.x, b.z);
      ctx.fillStyle = b.kind === 'rubble' ? 'rgba(150, 110, 70, 0.7)' : 'rgba(180, 180, 175, 0.75)';
      ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    }

    // Units on top.
    for (const b of minimap.blips) {
      if (b.kind === 'building' || b.kind === 'rubble') continue;
      const { px, py } = worldToPx(b.x, b.z);
      if (b.kind === 'friendly') {
        ctx.fillStyle = b.selected ? '#aaff5b' : '#6abf69';
        ctx.beginPath();
        ctx.arc(px, py, b.selected ? 3.2 : 2.4, 0, Math.PI * 2);
        ctx.fill();
        if (b.selected) {
          ctx.strokeStyle = 'rgba(220,255,170,0.9)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#d24a4a';
        ctx.beginPath();
        ctx.arc(px, py, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Camera frustum: a small triangle showing camera focus + facing.
    if (minimap.cameraFocus) {
      const { px, py } = worldToPx(minimap.cameraFocus.x, minimap.cameraFocus.z);
      const yaw = cameraYaw;
      // Babylon's ArcRotateCamera alpha=0 looks down -X; our world->minimap maps
      // world x to canvas x, world z to canvas y. We just want a triangle
      // pointing roughly in the camera's facing direction.
      const fx = Math.cos(yaw + Math.PI / 2);
      const fz = Math.sin(yaw + Math.PI / 2);
      const len = 10;
      const left = { x: -fz, y: fx };
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px + fx * len, py + fz * len);
      ctx.lineTo(px + left.x * 6 - fx * 4, py + left.y * 6 - fz * 4);
      ctx.lineTo(px - left.x * 6 - fx * 4, py - left.y * 6 - fz * 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }, [minimap, cameraYaw]);

  if (!minimap) return null;

  const onClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (!engine) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (ev.clientX - rect.left) / rect.width;
    const cy = (ev.clientY - rect.top) / rect.height;
    const half = minimap.mapSize / 2;
    const worldX = cx * minimap.mapSize - half;
    const worldZ = cy * minimap.mapSize - half;
    engine.panTacticalCameraTo(worldX, worldZ);
  };

  return (
    <div className="minimap game-ui-panel" data-ui-interactive="true">
      <div className="minimap-title">Tactical Minimap</div>
      <canvas
        ref={canvasRef}
        width={MINIMAP_PX}
        height={MINIMAP_PX}
        onClick={onClick}
        onContextMenu={(e) => e.preventDefault()}
        title="Click to pan camera"
      />
      <div className="minimap-legend">
        <span className="dot friendly" /> You
        <span className="dot enemy" /> Enemy
        <span className="dot objective" /> Objective
      </div>
    </div>
  );
};
