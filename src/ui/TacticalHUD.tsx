import React from 'react';
import { useGameStore } from '../game/state/gameStore';
import { AudioManager } from '../game/audio/AudioManager';
import { ObjectivePanel } from './ObjectivePanel';
import { UnitPanel } from './UnitPanel';
import type { GameEngine } from '../game/GameEngine';

interface Props {
  engine: GameEngine | null;
}

export const TacticalHUD: React.FC<Props> = ({ engine }) => {
  const summaries = useGameStore((s) => s.unitSummaries);
  const selectedId = useGameStore((s) => s.selectedUnitId);
  const selectedIds = useGameStore((s) => s.selectedUnitIds);
  const controlledId = useGameStore((s) => s.controlledUnitId);
  const setSelected = useGameStore((s) => s.setSelectedUnitId);
  const toggleSelection = useGameStore((s) => s.toggleUnitInSelection);
  const speedLevel = useGameStore((s) => s.speedLevel);
  const setSpeed = useGameStore((s) => s.setSpeedLevel);
  const paused = useGameStore((s) => s.paused);
  const pause = useGameStore((s) => s.pause);
  const resume = useGameStore((s) => s.resume);
  const returnToMenu = useGameStore((s) => s.returnToMenu);
  const eventLog = useGameStore((s) => s.eventLog);

  const friendlies = summaries.filter((u) => u.faction === 'friendly');
  const selectedSet = new Set(selectedIds);
  const selectedCount = selectedIds.length;

  return (
    <>
      <div className="tactical-bar-top game-ui-panel" data-ui-interactive="true">
        <ObjectivePanel />
        <div className="tactical-controls">
          <button
            onClick={() => {
              AudioManager.play('click');
              if (paused) resume();
              else pause();
            }}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            className={speedLevel === 'slow' ? 'primary' : ''}
            onClick={() => {
              AudioManager.play('click');
              setSpeed('slow');
            }}
          >
            Slow
          </button>
          <button
            className={speedLevel === 'normal' ? 'primary' : ''}
            onClick={() => {
              AudioManager.play('click');
              setSpeed('normal');
            }}
          >
            Normal
          </button>
          <button
            disabled={!selectedId || !engine}
            onClick={() => {
              AudioManager.play('click');
              engine?.jumpIntoSelected();
            }}
          >
            Jump Into Selected
          </button>
          <button
            disabled={!engine}
            onClick={() => {
              AudioManager.play('click');
              engine?.resetTacticalCamera();
            }}
          >
            Reset Camera
          </button>
          <button
            className="danger"
            onClick={() => {
              if (window.confirm('Abort the mission and return to the main menu?')) {
                AudioManager.play('click');
                returnToMenu();
              }
            }}
          >
            Return to Menu
          </button>
        </div>
      </div>

      <div className="unit-roster game-ui-panel" data-ui-interactive="true">
        {selectedCount > 1 && (
          <div className="roster-group-header">
            {selectedCount} units selected
          </div>
        )}
        {friendlies.map((u, idx) => {
          const isPrimary = u.id === selectedId;
          const isSelected = selectedSet.has(u.id);
          const isControlled = u.id === controlledId;
          const hpPct = Math.max(0, Math.min(100, Math.round((u.health / u.maxHealth) * 100)));
          const cls = [
            'unit-row',
            isPrimary ? 'primary' : '',
            isSelected && !isPrimary ? 'selected' : '',
            isControlled ? 'controlled' : '',
            u.isDestroyed ? 'dead' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={u.id}
              className={cls}
              onClick={(ev) => {
                if (u.isDestroyed) return;
                AudioManager.play('click');
                if (ev.shiftKey) toggleSelection(u.id);
                else setSelected(u.id);
              }}
              title={`${u.name} — ${hpPct}% health`}
            >
              <div className="unit-row-top">
                <span className="unit-row-name">[{idx + 1}] {u.name}</span>
                <span className={`unit-row-hp${hpPct < 35 ? ' low' : ''}`}>{hpPct}%</span>
              </div>
              <div className="unit-row-hpbar">
                <div
                  className={`unit-row-hpfill${hpPct < 35 ? ' low' : ''}`}
                  style={{ width: `${u.isDestroyed ? 0 : hpPct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mobile-camera-pad game-ui-panel" data-ui-interactive="true">
        <button onClick={() => engine?.rotateTacticalCamera(-1)}>Rotate -</button>
        <button onClick={() => engine?.zoomTacticalCamera(-14)}>Zoom In</button>
        <button onClick={() => engine?.zoomTacticalCamera(14)}>Zoom Out</button>
        <button onClick={() => engine?.rotateTacticalCamera(1)}>Rotate +</button>
        <button onClick={() => engine?.resetTacticalCamera()}>Reset</button>
      </div>

      <div className="event-log">
        {eventLog.map((event) => (
          <div key={event.id}>{event.message}</div>
        ))}
      </div>

      <UnitPanel engine={engine} />
    </>
  );
};
