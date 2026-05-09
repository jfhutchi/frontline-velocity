import React from 'react';
import { AudioManager } from '../game/audio/AudioManager';
import { createOperationCrossroads } from '../game/missions/operationCrossroads';
import { useGameStore } from '../game/state/gameStore';

const MISSION = createOperationCrossroads();

export const MissionBriefing: React.FC = () => {
  const startMission = useGameStore((s) => s.startMission);
  const returnToMenu = useGameStore((s) => s.returnToMenu);

  return (
    <div className="briefing-screen">
      <div className="briefing-card">
        <h1>{MISSION.briefingTitle}</h1>
        <h3>Situation</h3>
        {MISSION.briefingParagraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}

        <h3>Objectives</h3>
        <ul>
          {MISSION.briefingObjectives.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>

        <h3>Order of Battle</h3>
        <ul>
          {MISSION.units
            .filter((u) => u.faction === 'friendly')
            .map((u) => (
              <li key={u.id}>
                {u.name} — HP {u.maxHealth} · Armor {u.armor} · {u.weapon.name} ({u.weapon.damage} dmg, range {u.weapon.range})
              </li>
            ))}
        </ul>

        <div className="briefing-actions">
          <button
            onClick={() => {
              AudioManager.play('click');
              returnToMenu();
            }}
          >
            Back
          </button>
          <button
            className="primary"
            onClick={() => {
              AudioManager.play('click');
              startMission();
            }}
          >
            Deploy
          </button>
        </div>
      </div>
    </div>
  );
};
