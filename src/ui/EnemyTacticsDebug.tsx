import React from 'react';
import { useGameStore } from '../game/state/gameStore';

/**
 * Heads-up overlay that surfaces the enemy squad GOAP brain's reasoning.
 * Toggled via the "AI Debug" HUD button or the `]` keyboard shortcut. Pulls
 * its data from `gameStore.enemyDebug`, which the GameEngine publishes on the
 * same cadence as the rest of the HUD snapshots.
 */
export const EnemyTacticsDebug: React.FC = () => {
  const snaps = useGameStore((s) => s.enemyDebug);
  const visible = useGameStore((s) => s.showEnemyDebug);
  if (!visible) return null;
  if (!snaps.length) {
    return (
      <div className="enemy-debug-overlay game-ui-panel" data-ui-interactive="true">
        <h4>Enemy AI</h4>
        <div className="enemy-debug-empty">No enemy squad data yet.</div>
      </div>
    );
  }
  return (
    <div className="enemy-debug-overlay game-ui-panel" data-ui-interactive="true">
      {snaps.map((snap) => {
        const moraleClass = snap.morale <= 20 ? 'broken' : snap.morale <= 45 ? 'low' : 'steady';
        return (
          <div key={snap.squadId} className="enemy-debug-squad">
            <h4>Enemy Squad — {snap.squadId}</h4>
            <div className="enemy-debug-line">
              <span>Goal</span>
              <span className="enemy-debug-value">{snap.goalId ?? '—'}</span>
            </div>
            <div className="enemy-debug-line">
              <span>Plan</span>
              <span className="enemy-debug-value">
                {snap.planActionIds.length === 0
                  ? 'fallback / defensive hold'
                  : snap.planActionIds
                      .map((id) => (id === snap.currentActionId ? `▶${id}` : id))
                      .join(' → ')}
              </span>
            </div>
            <div className="enemy-debug-line">
              <span>Current action</span>
              <span className="enemy-debug-value">{snap.currentActionId ?? '—'}</span>
            </div>
            <div className="enemy-debug-line">
              <span>Target</span>
              <span className="enemy-debug-value">{snap.preferredTargetName ?? 'none'}</span>
            </div>
            <div className="enemy-debug-line">
              <span>Morale</span>
              <span className={`enemy-debug-value ${moraleClass}`}>{snap.morale}</span>
            </div>
            <div className="enemy-debug-line">
              <span>Ammo</span>
              <span className="enemy-debug-value">
                {snap.ammo} / {snap.ammoMax}
              </span>
            </div>
            <div className="enemy-debug-line">
              <span>Last replan</span>
              <span className="enemy-debug-value">{snap.lastReplanReason ?? '—'}</span>
            </div>
            {snap.failedPreconditions.length > 0 && (
              <div className="enemy-debug-line failed">
                <span>Failed preconditions</span>
                <span className="enemy-debug-value">{snap.failedPreconditions.join(' | ')}</span>
              </div>
            )}
            <div className="enemy-debug-subheader">World state</div>
            <div className="enemy-debug-facts">
              {Object.entries(snap.worldState).map(([key, value]) => (
                <span key={key} className={`enemy-debug-fact ${value ? 'true' : 'false'}`}>
                  {key}
                </span>
              ))}
            </div>
            <div className="enemy-debug-subheader">Members</div>
            <div className="enemy-debug-members">
              {snap.members.map((m) => (
                <div key={m.id} className={`enemy-debug-member ${m.isDestroyed ? 'dead' : ''}`}>
                  <span>{m.name}</span>
                  <span className="enemy-debug-fsm">{m.fsmState}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
