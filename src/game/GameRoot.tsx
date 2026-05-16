import React, { useEffect, useRef, useState } from 'react';
import { TacticalHUD } from '../ui/TacticalHUD';
import { DirectControlHUD } from '../ui/DirectControlHUD';
import { PauseMenu } from '../ui/PauseMenu';
import { ControlsHelp } from '../ui/ControlsHelp';
import { GameEngine } from './GameEngine';
import { useGameStore } from './state/gameStore';
import { isTouchDevice } from './input/TouchControls';
import { MobileTouchControls } from '../ui/MobileTouchControls';
import { MobileTacticalControls } from '../ui/MobileTacticalControls';
import { AudioManager } from './audio/AudioManager';
import type { SelectionBoxRect } from './input/TacticalInputController';

const DOUBLE_TAP_MS = 320;

export const GameRoot: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [selectionBox, setSelectionBox] = useState<SelectionBoxRect | null>(null);

  const screen = useGameStore((s) => s.screen);
  const paused = useGameStore((s) => s.paused);
  const damageFlashTick = useGameStore((s) => s.damageFlashTick);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    AudioManager.ensure();
    const engine = new GameEngine(canvasRef.current, {
      onSelectionBoxChange: setSelectionBox,
    });
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
    const lastDigitTap: Record<number, number> = {};

    const onKeyDown = (ev: KeyboardEvent) => {
      const store = useGameStore.getState();
      const k = ev.key.toLowerCase();
      const engine = engineRef.current;
      if (!engine) return;

      // Avoid stealing keys when an actual input/textarea has focus.
      const target = ev.target as Element | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      // Space: pause only in tactical (direct-control uses Space to fire).
      if (k === ' ' && !ev.repeat && (store.screen === 'tactical' || store.screen === 'paused')) {
        ev.preventDefault();
        store.togglePause();
        return;
      }

      if (k === 'escape') {
        if (store.paused) {
          ev.preventDefault();
          store.resume();
          return;
        }
        if (store.screen === 'directControl') {
          ev.preventDefault();
          store.pause();
          return;
        }
        if (store.screen === 'tactical') {
          ev.preventDefault();
          if (store.selectedUnitIds.length > 0) {
            store.setSelection([]);
          } else {
            store.pause();
          }
          return;
        }
      }

      if (k === 'r' && store.screen === 'directControl') {
        engine.exitDirectControl();
        ev.preventDefault();
        return;
      }

      if (k === 'enter' && store.screen === 'tactical') {
        engine.jumpIntoSelected();
        ev.preventDefault();
        return;
      }

      if (k === 'f' && store.screen === 'tactical') {
        const ids = store.selectedUnitIds;
        if (ids.length) {
          engine.centerCameraOnSelected();
        }
        ev.preventDefault();
        return;
      }

      if (k === 'h' && store.screen === 'tactical') {
        if (store.selectedUnitIds.length) {
          engine.stopSelectedUnits();
        }
        ev.preventDefault();
        return;
      }

      if (k === ']' && store.screen === 'tactical') {
        ev.preventDefault();
        store.toggleEnemyDebug();
        AudioManager.play('click');
        return;
      }

      if (k === 'tab' && store.screen === 'tactical') {
        ev.preventDefault();
        if (store.selectedUnitIds.length > 1) {
          store.rotatePrimarySelection();
          AudioManager.play('click');
        } else {
          cycleSelection();
        }
        return;
      }

      // Control groups (1-9). Ctrl-digit assigns; bare digit recalls/selects.
      if (/^[1-9]$/.test(k) && store.screen === 'tactical') {
        const n = parseInt(k, 10);
        if (ev.ctrlKey || ev.metaKey) {
          ev.preventDefault();
          if (store.selectedUnitIds.length > 0) {
            store.assignControlGroup(n);
            AudioManager.play('click');
          }
          return;
        }
        ev.preventDefault();
        const group = store.controlGroups[n];
        if (group && group.length > 0) {
          const recalled = store.recallControlGroup(n);
          if (recalled.length > 0) {
            AudioManager.play('click');
            const now = performance.now();
            if (lastDigitTap[n] && now - lastDigitTap[n] < DOUBLE_TAP_MS) {
              engine.centerCameraOnUnits(recalled);
            }
            lastDigitTap[n] = now;
          }
          return;
        }
        // Fall back to roster-slot selection (preserves v0.0.2 behavior for 1-4).
        const friendlies = store.unitSummaries.filter((u) => u.faction === 'friendly');
        const idx = n - 1;
        const target = friendlies[idx];
        if (target && !target.isDestroyed) {
          store.setSelectedUnitId(target.id);
          AudioManager.play('click');
          const now = performance.now();
          if (lastDigitTap[n] && now - lastDigitTap[n] < DOUBLE_TAP_MS) {
            engine.centerCameraOnSelected();
          }
          lastDigitTap[n] = now;
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
        {paused && (screen === 'tactical' || screen === 'directControl') && (
          <PauseMenu
            onRestart={() => {
              const engine = engineRef.current;
              if (!engine) return;
              engine.resetMission();
              useGameStore.getState().resume();
            }}
          />
        )}
        {ready && screen === 'tactical' && <ControlsHelp mode={screen} />}
        {ready && screen === 'tactical' && !paused && isTouchDevice() && (
          <MobileTacticalControls engine={engineRef.current} />
        )}
        {ready && screen === 'directControl' && isTouchDevice() && (
          <MobileTouchControls
            onInputChange={(forward, turn, fire) => engineRef.current?.setMobileVehicleInput(forward, turn, fire)}
            onReturn={() => engineRef.current?.exitDirectControl()}
            onFireDown={() => {}}
          />
        )}
      </div>
      {selectionBox && (screen === 'tactical' || screen === 'paused') && (
        <div
          className="selection-box-overlay"
          style={{
            left: selectionBox.x,
            top: selectionBox.y,
            width: selectionBox.width,
            height: selectionBox.height,
          }}
        />
      )}
    </div>
  );
};
