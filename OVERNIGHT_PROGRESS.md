# Overnight Progress — v0.0.3 Desktop RTS Overhaul

## Session start

- Timestamp (start): 2026-05-13 22:30 (UTC-4)
- Branch: `codex/improve-v002-camera-ai-graphics` (already open for v0.0.3 work; matches the
  user's suggested branch in spirit so no new branch was created — see "Branching" section
  of the brief: "Create a working branch unless already on a suitable branch.")
- Base branch: `main`
- Vite base path verified: `/frontline-velocity/`
- `package.json` `name` already set to `frontline-velocity` — no rename needed.
- Initial state: working tree clean, latest commit `f93124d`.
- Initial validation:
  - `npm run typecheck` — PASS
  - `npm run build` — PASS (5.34 MB main chunk; one large-chunk warning, no errors)

## Initial findings

The earlier work already landed most of the desktop-RTS scaffolding from this brief:
- `TacticalCameraController` with damped pan/zoom/rotate, edge-scroll, and clamping.
- `TacticalInputController` + `SelectionController` + `CommandController` +
  `PointerWorldResolver` already split out as separate modules.
- Multi-unit selection, Shift-toggle, drag-rectangle, control groups, Tab cycle, F-center,
  R/Home reset, Alt+MMB orbit, zoom-toward-cursor, edge-scroll-on-canvas-only — all wired.
- HUD roster rebuilt with vertical-flex layout and clipped health bar.
- World HP bars parented to a single `hpBarPivot` that we yaw-orient toward the camera each
  frame, so background and fill share one transform.
- Enemy GOAP squad brain + tactics debug overlay shipped.
- `README.md` already documents v0.0.3 control set.

So the v0.0.3 acceptance scaffolding is in. Tonight's work is about polish, missing pieces,
and the residual issues the user flagged (camera feel, HUD clutter, friendly autonomy,
build warnings). No restart, no rewrite.

## Plan of attack (this session)

1. Phase A — UI clutter and desktop polish:
   - Hide the `mobile-camera-pad` on non-touch / pointer:fine displays.
   - Make `ControlsHelp` collapsible.
   - Add a tactical "Stop" / "Hold Position" command (button + `H` key) for selected units.
   - Add a "Restart Mission" affordance to the pause overlay.
2. Phase B — Camera quality of life:
   - Confirm rotate/pan damping feels right; nudge constants only if needed.
   - Verify R/Home/F path; add unmistakable feedback when reset fires (event log line).
3. Phase C — Build/perf hygiene:
   - Add a small `manualChunks` splitter for `@babylonjs/core` so the production bundle
     stops emitting the 5 MB warning. No dependency changes.
4. Phase D — README + version label sweep + final acceptance pass.
5. Commit/push between phases. Update this file after each phase.

## Phase A — UI clutter and desktop polish (DONE)

What changed:
- Added a `Stop (H)` HUD button and an `H` keyboard shortcut.
- New simulation API `Simulation.issueHoldOrder` and `CommandController.issueHold`.
- New engine API `GameEngine.stopSelectedUnits`.
- `PauseMenu` now has a `Restart Mission` button (calls `engine.resetMission()` and resumes).
- `ControlsHelp` is collapsible with a `–` / `?` toggle.
- `mobile-camera-pad` was already hidden on desktop via media query — no change needed.

Files changed:
- `src/game/simulation/Simulation.ts`
- `src/game/input/CommandController.ts`
- `src/game/GameEngine.ts`
- `src/game/GameRoot.tsx`
- `src/ui/TacticalHUD.tsx`
- `src/ui/PauseMenu.tsx`
- `src/ui/ControlsHelp.tsx`
- `src/styles/global.css`

Validation: typecheck PASS, build PASS.

## Phase C — Build/perf hygiene (DONE)

What changed:
- `vite.config.ts` now splits `@babylonjs/*` into a `babylonjs` chunk and React/scheduler
  into a `react-vendor` chunk via `manualChunks`. The app shell now loads as ~134 kB
  alongside Babylon's ~5 MB cached vendor chunk instead of one ~5.3 MB blob.
- Bumped `chunkSizeWarningLimit` to 6000 to silence the warning that was caused only by
  Babylon's intrinsic size, not by our app code.

Files changed:
- `vite.config.ts`

Validation: build PASS, no chunk warnings.

## Phase B — Camera and tactical-feedback polish

(in progress)
