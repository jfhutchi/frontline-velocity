import React, { useEffect, useRef, useState } from 'react';
import { TacticalHUD } from '../ui/TacticalHUD';
import { DirectControlHUD } from '../ui/DirectControlHUD';
import { PauseMenu } from '../ui/PauseMenu';
import { ControlsHelp } from '../ui/ControlsHelp';
import { GameEngine } from './GameEngine';
import { useGameStore } from './state/gameStore';
import { isTouchDevice } from './input/TouchControls';
import { MobileTouchControls } from '../ui/MobileTouchControls';
import { AudioManager } from './audio/AudioManager';

export const GameRoot: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [ready, setReady] = useState(false);

  const screen = useGameStore((s) => s.screen);
  const paused = useGameStore((s) => s.paused);
  const damageFlashTick = useGameStore((s) => s.damageFlashTick);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    AudioManager.ensure();
    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;
    setReady(true);
    return () => {
      engine.dispose();
      engineRef.current = null;
      setReady(false);
    };
  }, []);

  // Reset mission whenever we transition fresh into tactical from menu/briefing.
  // The store's `startMission` already sets screen to 'tactical' but we need
  // to re-init the engine simulation when re-entering after victory/defeat.
  const lastScreenRef = useRef(screen);
  useEffect(() => {
    const prev = lastScreenRef.current;
    lastScreenRef.current = screen;
    const engine = engineRef.current;
    if (!engine) return;
    if ((prev === 'menu' || prev === 'briefing' || prev === 'victory' || prev === 'defeat') && screen === 'tactical') {
      engine.resetMission();
    }
  }, [screen]);

  useEffect(() => {
    if (!damageFlashTick) return;
    setFlashing(true);
    const id = window.setTimeout(() => setFlashing(false), 220);
    return () => window.clearTimeout(id);
  }, [damageFlashTick]);

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      const store = useGameStore.getState();
      const k = ev.key.toLowerCase();
      const engine = engineRef.current;
      if (!engine) return;
      if (k === ' ' && !ev.repeat && (store.screen === 'tactical' || store.screen === 'directControl' || store.screen === 'paused')) {
        // Space: in direct control acts as fire (handled by DirectControlInput);
        // in tactical, toggle pause.
        if (store.screen === 'tactical' || store.screen === 'paused') {
          ev.preventDefault();
          store.togglePause();
        }
        return;
      }
      if (k === 'escape') {
        if (store.screen === 'directControl') {
          // Escape returns to tactical.
          engine.exitDirectControl();
          ev.preventDefault();
          return;
        }
        if (store.screen === 'tactical') {
          ev.preventDefault();
          store.pause();
          return;
        }
        if (store.screen === 'paused') {
          ev.preventDefault();
          store.resume();
          return;
        }
      }
      if (k === 'r' && store.screen === 'directControl') {
        engine.exitDirectControl();
        ev.preventDefault();
        return;
      }
      if ((k === 'enter' || k === 'f') && store.screen === 'tactical') {
        engine.jumpIntoSelected();
        ev.preventDefault();
        return;
      }
      if (k === 'tab' && store.screen === 'tactical') {
        ev.preventDefault();
        cycleSelection();
        return;
      }
      if (['1', '2', '3', '4'].includes(k) && store.screen === 'tactical') {
        const friendlies = store.unitSummaries.filter((u) => u.faction === 'friendly');
        const idx = parseInt(k, 10) - 1;
        if (friendlies[idx]) {
          store.setSelectedUnitId(friendlies[idx].id);
          AudioManager.play('click');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const cycleSelection = () => {
    const store = useGameStore.getState();
    const friendlies = store.unitSummaries.filter((u) => u.faction === 'friendly' && !u.isDestroyed);
    if (!friendlies.length) return;
    const currentIdx = friendlies.findIndex((u) => u.id === store.selectedUnitId);
    const next = friendlies[(currentIdx + 1) % friendlies.length];
    store.setSelectedUnitId(next.id);
    AudioManager.play('click');
  };

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="babylon-canvas" tabIndex={0} />
      <div className={`damage-flash${flashing ? ' active' : ''}`} />
      <div className="hud-layer">
        {ready && (screen === 'tactical' || screen === 'paused') && <TacticalHUD engine={engineRef.current} />}
        {ready && screen === 'directControl' && <DirectControlHUD engine={engineRef.current} />}
        {paused && screen === 'paused' && <PauseMenu />}
        {ready && (screen === 'tactical' || screen === 'directControl') && <ControlsHelp mode={screen} />}
        {ready && screen === 'directControl' && isTouchDevice() && (
          <MobileTouchControls
            onInputChange={(forward, turn, fire) => engineRef.current?.setMobileVehicleInput(forward, turn, fire)}
            onReturn={() => engineRef.current?.exitDirectControl()}
            onFireDown={() => {}}
          />
        )}
      </div>
    </div>
  );
};
