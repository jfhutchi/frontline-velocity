import React from 'react';
import { useGameStore } from '../game/state/gameStore';
import type { GameEngine } from '../game/GameEngine';
import { AudioManager } from '../game/audio/AudioManager';
import { Minimap } from './Minimap';

interface Props {
  engine: GameEngine | null;
}

export const DirectControlHUD: React.FC<Props> = ({ engine }) => {
  const controlledId = useGameStore((s) => s.controlledUnitId);
  const summaries = useGameStore((s) => s.unitSummaries);
  const objective = useGameStore((s) => s.objective);

  const u = summaries.find((s) => s.id === controlledId);
  if (!u) return null;
  const hpPct = (u.health / u.maxHealth) * 100;
  const speedKmh = Math.round(u.currentSpeed * 3.6);
  const speedPct = Math.min(100, (u.currentSpeed / Math.max(0.01, u.speed)) * 100);

  return (
    <div className="dc-hud">
      <div className="dc-top-panel">
        <span className="name">{u.name}</span>
        <span className="dc-top-sep"> · </span>
        <span className="dc-top-type">{u.type}</span>
      </div>
      <div className="dc-objective-panel game-ui-panel" data-ui-interactive="true">
        <h4>Objective</h4>
        <div className="dc-objective-line">
          <span className={`dc-checkbox${objective?.captured ? ' checked' : ''}`} />
          <span>Capture the crossroads</span>
        </div>
      </div>
      <div className="dc-crosshair" />
      <div className="dc-reload-ring" style={{ ['--reload' as string]: `${Math.round(u.reloadProgress * 100)}%` }} />
      <div className="dc-bottom-panel">
        <div className="stat">
          <span className="label">Health</span>
          <span className={`value${hpPct < 35 ? ' low' : ''}`}>
            {u.health}/{u.maxHealth}
          </span>
          <span className="dc-meter"><span style={{ width: `${hpPct}%` }} /></span>
        </div>
        <div className="stat">
          <span className="label">Reload</span>
          <span className={`value${u.reloadProgress < 0.99 ? ' warm' : ''}`}>
            {u.reloadProgress >= 0.99 ? 'Ready' : `${(u.reloadProgress * 100).toFixed(0)}%`}
          </span>
          <span className="dc-meter"><span style={{ width: `${u.reloadProgress * 100}%` }} /></span>
        </div>
        <div className="stat">
          <span className="label">Speed</span>
          <span className="value">{speedKmh} km/h</span>
          <span className="dc-meter"><span style={{ width: `${speedPct}%` }} /></span>
        </div>
      </div>
      <button
        className="return-btn"
        onClick={() => {
          AudioManager.play('click');
          engine?.exitDirectControl();
        }}
      >
        Return to Command (Tab)
      </button>
      <Minimap engine={engine} />
    </div>
  );
};
