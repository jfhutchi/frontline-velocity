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

  return (
    <div className="dc-hud">
      <div className="dc-objective-panel game-ui-panel" data-ui-interactive="true">
        <h4>Objective</h4>
        <div className="dc-objective-line">
          <span className={`dc-checkbox${objective?.captured ? ' checked' : ''}`} />
          <span>Capture the crossroads</span>
        </div>
      </div>
      <div className="dc-compass">
        <span>W</span>
        <span className="active">N</span>
        <span>NE</span>
      </div>
      <div className="dc-top-panel">
        <span className="name">{u.name}</span> | {u.weaponName} | {objective ? `Cap ${(objective.heldSeconds || 0).toFixed(0)}/${objective.requiredHoldSeconds}s` : ''}
      </div>
      <div className="dc-crosshair" />
      <div className="dc-reload-ring" style={{ ['--reload' as string]: `${Math.round(u.reloadProgress * 100)}%` }} />
      <div className="dc-bottom-panel">
        <div className="stat">
          <span className="label">Health</span>
          <span className={`value${hpPct < 35 ? ' low' : ''}`}>
            {u.health}/{u.maxHealth}
          </span>
        </div>
        <div className="stat">
          <span className="label">Reload</span>
          <span className={`value${u.reloadProgress < 0.99 ? ' warm' : ''}`}>
            {(u.reloadProgress * 100).toFixed(0)}%
          </span>
        </div>
        <div className="stat">
          <span className="label">Speed</span>
          <span className="value">{u.speed.toFixed(1)}</span>
        </div>
        <button
          className="return-btn"
          onClick={() => {
            AudioManager.play('click');
            engine?.exitDirectControl();
          }}
        >
          Return (R) | Esc pauses
        </button>
      </div>
      <Minimap engine={engine} />
    </div>
  );
};
