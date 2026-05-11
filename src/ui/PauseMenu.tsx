import React from 'react';
import { useGameStore } from '../game/state/gameStore';
import { AudioManager } from '../game/audio/AudioManager';

export const PauseMenu: React.FC = () => {
  const resume = useGameStore((s) => s.resume);
  const returnToMenu = useGameStore((s) => s.returnToMenu);

  return (
    <div className="pause-overlay game-ui-panel" data-ui-interactive="true">
      <h2>Paused</h2>
      <div className="menu-buttons">
        <button
          className="primary"
          onClick={() => {
            AudioManager.play('click');
            resume();
          }}
        >
          Resume
        </button>
        <button
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
  );
};
