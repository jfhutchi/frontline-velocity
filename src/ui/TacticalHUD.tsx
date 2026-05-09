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
  const controlledId = useGameStore((s) => s.controlledUnitId);
  const setSelected = useGameStore((s) => s.setSelectedUnitId);
  const speedLevel = useGameStore((s) => s.speedLevel);
  const setSpeed = useGameStore((s) => s.setSpeedLevel);
  const paused = useGameStore((s) => s.paused);
  const pause = useGameStore((s) => s.pause);
  const resume = useGameStore((s) => s.resume);
  const returnToMenu = useGameStore((s) => s.returnToMenu);
  const eventLog = useGameStore((s) => s.eventLog);

  const friendlies = summaries.filter((u) => u.faction === 'friendly');

  return (
    <>
      <div className="tactical-bar-top">
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

      <div className="unit-roster">
        {friendlies.map((u, idx) => {
          const isSelected = u.id === selectedId;
          const isControlled = u.id === controlledId;
          const hpPct = Math.round((u.health / u.maxHealth) * 100);
          const cls = [
            isSelected ? 'selected' : '',
            isControlled ? 'controlled' : '',
            u.isDestroyed ? 'dead' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={u.id}
              className={cls}
              onClick={() => {
                if (u.isDestroyed) return;
                AudioManager.play('click');
                setSelected(u.id);
              }}
            >
              <span>
                [{idx + 1}] {u.name}
              </span>
              <span className={`roster-hp${hpPct < 35 ? ' low' : ''}`}>{hpPct}%</span>
            </button>
          );
        })}
      </div>

      <div className="mobile-camera-pad">
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
