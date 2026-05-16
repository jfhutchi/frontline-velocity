import React from 'react';
import { useGameStore } from '../game/state/gameStore';
import { AudioManager } from '../game/audio/AudioManager';
import { APP_VERSION, APP_VERSION_LABEL } from '../version';

export const MainMenu: React.FC = () => {
  const goToBriefing = useGameStore((s) => s.goToBriefing);

  return (
    <div className="menu-screen">
      <h1>Steel Command</h1>
      <h2>Frontline Velocity</h2>
      <div className="menu-version">
        <span className="menu-version-tag">{APP_VERSION}</span>
        <span className="menu-version-label">{APP_VERSION_LABEL}</span>
      </div>
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
              `Steel Command: Frontline Velocity ${APP_VERSION}. ` +
                'An original spiritual successor to classic desktop tactical / RTS games. ' +
                'All assets, names, code, and missions in this build are original — no copyrighted ' +
                'content from any prior commercial title is used. ' +
                'This build ships the art-reference RTS/tank pass: a mobile-safe briefing, ' +
                'higher tactical camera framing, a third-person over-the-turret tank camera, ' +
                'denser rural village detail, improved tank silhouettes, stronger battlefield ' +
                'atmosphere, and a cleaner tactical/direct-control HUD.',
            );
          }}
        >
          About
        </button>
      </div>
      <p className="legal">
        Original work. Spiritual successor only — no copyrighted assets, names, logos, sprites,
        sounds, missions, or data files from any prior commercial title are used. All maps, units,
        names, and code in this build are original. Procedural audio is generated at runtime.
      </p>
    </div>
  );
};
