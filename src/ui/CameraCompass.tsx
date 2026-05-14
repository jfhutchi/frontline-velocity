import React from 'react';
import { useGameStore } from '../game/state/gameStore';

/**
 * Small RTS-style compass + zoom indicator. Shows tactical camera heading and
 * current zoom fraction so the player always knows which way is north and how
 * far the camera is pulled out. The needle rotates opposite to camera yaw so
 * "N" appears in the world direction the player is currently looking toward.
 */
export const CameraCompass: React.FC = () => {
  const yaw = useGameStore((s) => s.cameraYaw);
  const zoomFrac = useGameStore((s) => s.cameraZoomFrac);

  // Map alpha (orbit angle around Y) to a screen rotation. The default alpha
  // (PI/2) corresponds to looking north with the camera south of the target,
  // so we offset to keep "N" pointing up at the default heading.
  const screenDeg = -((yaw - Math.PI * 0.5) * 180) / Math.PI;
  const zoomPct = Math.round((1 - zoomFrac) * 100);

  return (
    <div className="camera-compass game-ui-panel" data-ui-interactive="true">
      <div className="camera-compass-dial">
        <div
          className="camera-compass-rose"
          style={{ transform: `rotate(${screenDeg}deg)` }}
        >
          <span className="camera-compass-tick n">N</span>
          <span className="camera-compass-tick e">E</span>
          <span className="camera-compass-tick s">S</span>
          <span className="camera-compass-tick w">W</span>
        </div>
        <div className="camera-compass-needle" />
      </div>
      <div className="camera-compass-zoom" title="Camera zoom (closer = higher %)">
        <div className="camera-compass-zoom-bar">
          <div
            className="camera-compass-zoom-fill"
            style={{ width: `${zoomPct}%` }}
          />
        </div>
        <span className="camera-compass-zoom-label">{zoomPct}%</span>
      </div>
    </div>
  );
};
