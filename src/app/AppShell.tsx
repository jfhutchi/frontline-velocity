import React from 'react';
import { useGameStore } from '../game/state/gameStore';
import { MainMenu } from '../ui/MainMenu';
import { MissionBriefing } from '../ui/MissionBriefing';
import { GameRoot } from '../game/GameRoot';
import { EndMissionScreen } from '../ui/EndMissionScreen';

export const AppShell: React.FC = () => {
  const screen = useGameStore((s) => s.screen);

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
      <div className="version-label">v0.0.2</div>
    </div>
  );
};
