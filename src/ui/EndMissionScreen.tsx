import React from 'react';
import { useGameStore } from '../game/state/gameStore';
import { AudioManager } from '../game/audio/AudioManager';

interface Props {
  result: 'victory' | 'defeat';
}

export const EndMissionScreen: React.FC<Props> = ({ result }) => {
  const startMission = useGameStore((s) => s.startMission);
  const returnToMenu = useGameStore((s) => s.returnToMenu);

  return (
    <div className="end-overlay">
      <h2 className={result}>{result === 'victory' ? 'Victory' : 'Defeat'}</h2>
      <div className="menu-buttons">
        <button
          className="primary"
          onClick={() => {
            AudioManager.play('click');
            startMission();
          }}
        >
          Replay Mission
        </button>
        <button
          onClick={() => {
            AudioManager.play('click');
            returnToMenu();
          }}
        >
          Return to Menu
        </button>
      </div>
    </div>
  );
};
