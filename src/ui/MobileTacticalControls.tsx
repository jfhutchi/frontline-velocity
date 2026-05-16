import React, { useEffect, useRef, useState } from 'react';
import type { GameEngine } from '../game/GameEngine';
import { AudioManager } from '../game/audio/AudioManager';
import { useGameStore } from '../game/state/gameStore';

interface Props {
  engine: GameEngine | null;
}

export const MobileTacticalControls: React.FC<Props> = ({ engine }) => {
  const selectedIds = useGameStore((s) => s.selectedUnitIds);
  const selectedId = useGameStore((s) => s.selectedUnitId);
  const summaries = useGameStore((s) => s.unitSummaries);
  const paused = useGameStore((s) => s.paused);
  const pause = useGameStore((s) => s.pause);
  const resume = useGameStore((s) => s.resume);
  const padRef = useRef<HTMLDivElement | null>(null);
  const nubRef = useRef<HTMLDivElement | null>(null);
  const trackingId = useRef<number | null>(null);
  const [pan, setPan] = useState({ right: 0, forward: 0 });
  const [rotate, setRotate] = useState(0);
  const [zoom, setZoom] = useState(0);

  const selected = summaries.find((u) => u.id === selectedId);
  const hasSelection = selectedIds.length > 0;
  const canJump = Boolean(selected && selected.isPlayerControllable && !selected.isDestroyed);

  useEffect(() => {
    engine?.setTacticalTouchCamera(pan.right, pan.forward, rotate, zoom);
  }, [engine, pan.right, pan.forward, rotate, zoom]);

  useEffect(() => {
    return () => {
      engine?.setTacticalTouchCamera(0, 0, 0, 0);
    };
  }, [engine]);

  const updatePad = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const max = rect.width / 2 - 14;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const len = Math.hypot(dx, dy);
    const nx = len > max ? (dx / len) * max : dx;
    const ny = len > max ? (dy / len) * max : dy;
    if (nubRef.current) {
      nubRef.current.style.transform = `translate(${nx}px, ${ny}px)`;
    }
    setPan({ right: nx / max, forward: -ny / max });
  };

  const resetPad = () => {
    if (nubRef.current) {
      nubRef.current.style.transform = 'translate(0px, 0px)';
    }
    setPan({ right: 0, forward: 0 });
  };

  const pressValue = (setter: React.Dispatch<React.SetStateAction<number>>, value: number) => ({
    onPointerDown: (ev: React.PointerEvent<HTMLButtonElement>) => {
      ev.currentTarget.setPointerCapture?.(ev.pointerId);
      setter(value);
      ev.preventDefault();
    },
    onPointerUp: (ev: React.PointerEvent<HTMLButtonElement>) => {
      ev.currentTarget.releasePointerCapture?.(ev.pointerId);
      setter(0);
      ev.preventDefault();
    },
    onPointerCancel: () => setter(0),
    onPointerLeave: () => setter(0),
  });

  return (
    <div className="mobile-tactical-controls" data-ui-interactive="true">
      <div
        className="mobile-camera-stick"
        ref={padRef}
        aria-label="Camera pan"
        onPointerDown={(ev) => {
          ev.currentTarget.setPointerCapture?.(ev.pointerId);
          trackingId.current = ev.pointerId;
          updatePad(ev.clientX, ev.clientY);
          ev.preventDefault();
        }}
        onPointerMove={(ev) => {
          if (trackingId.current !== ev.pointerId) return;
          updatePad(ev.clientX, ev.clientY);
          ev.preventDefault();
        }}
        onPointerUp={(ev) => {
          if (trackingId.current === ev.pointerId) {
            ev.currentTarget.releasePointerCapture?.(ev.pointerId);
            trackingId.current = null;
            resetPad();
          }
          ev.preventDefault();
        }}
        onPointerCancel={() => {
          trackingId.current = null;
          resetPad();
        }}
      >
        <div className="mobile-camera-nub" ref={nubRef} />
      </div>

      <div className="mobile-camera-actions">
        <button type="button" aria-label="Rotate camera left" {...pressValue(setRotate, -1)}>
          Rot -
        </button>
        <button type="button" aria-label="Zoom camera in" {...pressValue(setZoom, 1)}>
          In
        </button>
        <button type="button" aria-label="Zoom camera out" {...pressValue(setZoom, -1)}>
          Out
        </button>
        <button type="button" aria-label="Rotate camera right" {...pressValue(setRotate, 1)}>
          Rot +
        </button>
      </div>

      <div className="mobile-command-bar">
        <button
          type="button"
          disabled={!hasSelection}
          onClick={() => {
            AudioManager.play('click');
            engine?.centerCameraOnSelected();
          }}
        >
          Center
        </button>
        <button
          type="button"
          disabled={!hasSelection}
          onClick={() => {
            AudioManager.play('click');
            engine?.stopSelectedUnits();
          }}
        >
          Hold
        </button>
        <button
          type="button"
          disabled={!canJump}
          onClick={() => {
            AudioManager.play('click');
            engine?.jumpIntoSelected();
          }}
        >
          Drive
        </button>
        <button
          type="button"
          onClick={() => {
            AudioManager.play('click');
            if (paused) resume();
            else pause();
          }}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>
    </div>
  );
};
