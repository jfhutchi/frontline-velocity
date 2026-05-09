import React from 'react';
import { useGameStore } from '../game/state/gameStore';
import { AudioManager } from '../game/audio/AudioManager';

export const MainMenu: React.FC = () => {
  const goToBriefing = useGameStore((s) => s.goToBriefing);

  return (
    <div className="menu-screen">
      <h1>Steel Command</h1>
      <h2>Frontline Velocity</h2>
      <div className="menu-buttons">
        <button
          className="primary"
          onClick={() => {
            AudioManager.ensure();
            AudioManager.play('click');
            goToBriefing();
          }}
        >
          Start Mission
        </button>
        <button
          onClick={() => {
            AudioManager.ensure();
            AudioManager.play('click');
            window.alert(
                'Steel Command: Frontline Velocity is a spiritual successor to a 1996 DOS tactical game. ' +
                'All assets are original. v0.0.2 ships one playable mission with improved command AI and camera controls.',
            );
          }}
        >
          About
        </button>
      </div>
      <p className="legal">
        Original work. Spiritual successor only — no copyrighted assets, names, logos, sprites, sounds, missions, or
        data files from any prior commercial title are used. All maps, units, names, and code in this build are original.
      </p>
    </div>
  );
};
