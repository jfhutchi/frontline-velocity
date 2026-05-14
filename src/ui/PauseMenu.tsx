import React from 'react';
import { useGameStore } from '../game/state/gameStore';
import { AudioManager } from '../game/audio/AudioManager';

interface Props {
  onRestart?: () => void;
}

export const PauseMenu: React.FC<Props> = ({ onRestart }) => {
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
            if (!onRestart) return;
            if (window.confirm('Restart Operation Crossroads from the beginning?')) {
              AudioManager.play('click');
              onRestart();
            }
          }}
          disabled={!onRestart}
        >
          Restart Mission
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
