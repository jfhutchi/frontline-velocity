import React, { useEffect } from 'react';
import { useGameStore } from '../game/state/gameStore';
import { MainMenu } from '../ui/MainMenu';
import { MissionBriefing } from '../ui/MissionBriefing';
import { GameRoot } from '../game/GameRoot';
import { EndMissionScreen } from '../ui/EndMissionScreen';
import { AudioManager } from '../game/audio/AudioManager';
import { APP_VERSION } from '../version';

export const AppShell: React.FC = () => {
  const screen = useGameStore((s) => s.screen);

  useEffect(() => {
    const playing =
      screen === 'tactical' ||
      screen === 'directControl' ||
      screen === 'paused' ||
      screen === 'briefing';
    if (playing) {
      AudioManager.ensure();
      AudioManager.startMusic();
    } else {
      AudioManager.stopMusic();
    }
    return () => {
      // No-op: stopMusic is idempotent. We keep music alive across screen
      // transitions while still "playing" rather than ramping it on every render.
    };
  }, [screen]);

  return (
    <div className="app-shell">
      {screen === 'menu' && <MainMenu />}
      {screen === 'briefing' && <MissionBriefing />}
      {(screen === 'tactical' ||
        screen === 'directControl' ||
        screen === 'paused' ||
        screen === 'victory' ||
        screen === 'defeat') && <GameRoot />}
      {screen === 'victory' && <EndMissionScreen result="victory" />}
      {screen === 'defeat' && <EndMissionScreen result="defeat" />}
      <div className="version-label">{APP_VERSION}</div>
    </div>
  );
};
