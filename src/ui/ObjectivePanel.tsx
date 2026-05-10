import React from 'react';
import { useGameStore } from '../game/state/gameStore';

export const ObjectivePanel: React.FC = () => {
  const objective = useGameStore((s) => s.objective);
  const summaries = useGameStore((s) => s.unitSummaries);

  if (!objective) return null;
  const fillFrac = Math.min(1, objective.heldSeconds / Math.max(0.01, objective.requiredHoldSeconds));
  const aliveFriendlies = summaries.filter((u) => u.faction === 'friendly' && !u.isDestroyed).length;
  const aliveEnemies = summaries.filter((u) => u.faction === 'enemy' && !u.isDestroyed).length;

  let status = 'Approach the crossroads';
  if (objective.captured) status = 'Crossroads secured';
  else if (objective.contested) status = 'Zone contested!';
  else if (objective.occupiedByFriendly) status = `Holding zone (${objective.heldSeconds.toFixed(0)} / ${objective.requiredHoldSeconds}s)`;

  return (
    <div className="objective-panel game-ui-panel" data-ui-interactive="true">
      <h4>Objective: {objective.name}</h4>
      <div style={{ fontSize: 12 }}>{status}</div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(fillFrac * 100).toFixed(1)}%` }} />
      </div>
      <div style={{ fontSize: 11, marginTop: 6, color: 'var(--fg-1)' }}>
        Friendly: {aliveFriendlies} · Enemy: {aliveEnemies}
      </div>
    </div>
  );
};
