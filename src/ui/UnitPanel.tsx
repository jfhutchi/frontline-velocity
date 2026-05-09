import React from 'react';
import { useGameStore } from '../game/state/gameStore';
import { AudioManager } from '../game/audio/AudioManager';
import type { GameEngine } from '../game/GameEngine';

interface Props {
  engine: GameEngine | null;
}

const UNIT_LABELS: Record<string, string> = {
  mediumTank: 'Medium Tank',
  reconJeep: 'Recon Jeep',
  infantry: 'Infantry',
  lightTank: 'Light Tank',
  antiTankGun: 'AT Gun',
};

export const UnitPanel: React.FC<Props> = ({ engine }) => {
  const summaries = useGameStore((s) => s.unitSummaries);
  const selectedId = useGameStore((s) => s.selectedUnitId);
  const unit = summaries.find((u) => u.id === selectedId);

  if (!unit) {
    return (
      <div className="unit-panel">
        <h4>No Unit Selected</h4>
        <div className="stat-row">
          <span>Click a friendly marker, or press 1-4.</span>
        </div>
      </div>
    );
  }

  const hpPct = Math.max(0, Math.min(100, (unit.health / unit.maxHealth) * 100));
  const lowHealth = hpPct < 35;

  return (
    <div className="unit-panel">
      <h4>
        {unit.name} <span style={{ color: 'var(--fg-1)', fontSize: 11 }}>({UNIT_LABELS[unit.type] ?? unit.type})</span>
      </h4>
      <div className="health-bar">
        <div className={`health-fill${lowHealth ? ' low' : ''}`} style={{ width: `${hpPct}%` }} />
      </div>
      <div className="stat-row">
        <span>Health</span>
        <span className="value">
          {unit.health} / {unit.maxHealth}
        </span>
      </div>
      <div className="stat-row">
        <span>Armor</span>
        <span className="value">{unit.armor}</span>
      </div>
      <div className="stat-row">
        <span>Speed</span>
        <span className="value">{unit.speed.toFixed(1)}</span>
      </div>
      <div className="stat-row">
        <span>Weapon</span>
        <span className="value">{unit.weaponName}</span>
      </div>
      <div className="stat-row">
        <span>Range</span>
        <span className="value">{unit.weaponRange}</span>
      </div>
      <div className="stat-row">
        <span>Reload</span>
        <span className="value">{(unit.reloadProgress * 100).toFixed(0)}%</span>
      </div>
      <div className="stat-row">
        <span>Order</span>
        <span className="value">{unit.orderLabel}</span>
      </div>
      <div className="stat-row">
        <span>AI State</span>
        <span className="value">{unit.aiState}</span>
      </div>
      <div className="stat-row">
        <span>Target</span>
        <span className="value">{unit.targetName ?? 'None'}</span>
      </div>
      {unit.isUnderAttack && <div className="under-fire">Under fire</div>}
      <div className="panel-actions">
        <button
          disabled={unit.isDestroyed || !unit.isPlayerControllable}
          onClick={() => {
            AudioManager.play('click');
            engine?.jumpIntoSelected();
          }}
          title={unit.isPlayerControllable ? 'Take direct control of this vehicle' : 'This unit is not directly controllable'}
        >
          Jump In (F)
        </button>
        <button
          onClick={() => {
            AudioManager.play('click');
            engine?.centerCameraOnSelected();
          }}
        >
          Center Camera
        </button>
      </div>
    </div>
  );
};
