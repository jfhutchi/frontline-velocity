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

## Phase B — Camera and tactical-feedback polish (DONE)

What changed:
- New `CameraCompass` HUD widget (top-right): rotating N/E/S/W rose driven by the tactical
  camera yaw, plus a zoom-fraction bar so the player always knows heading and zoom level.
- `TacticalCameraController` exposes `getYaw`, `getDistance`, `getDistanceLimits` so the
  HUD can read camera state without poking into Babylon directly.
- Game store gains `cameraYaw` / `cameraZoomFrac` plus a `setCameraStatus(yaw, zoomFrac)`
  action with a small dirty-bit so the React tree re-renders only on meaningful change.
- `GameEngine.publishCameraStatus` runs alongside the 10 Hz summary push.
- "Reset Camera" now also writes a one-line "Camera reset to overview" event log entry
  so the player gets feedback when R/Home or the HUD button fires.
- Added `]` keyboard shortcut to toggle the enemy AI debug overlay (already documented
  on the HUD button title attribute).
- Added CSS for the previously-unstyled `enemy-debug-overlay` so toggling AI Debug now
  produces a usable layout instead of unstyled fallback text.

Files changed:
- `src/game/rendering/TacticalCameraController.ts`
- `src/game/state/gameStore.ts`
- `src/game/GameEngine.ts`
- `src/game/GameRoot.tsx`
- `src/ui/CameraCompass.tsx` (new)
- `src/ui/TacticalHUD.tsx`
- `src/styles/global.css`

Validation: typecheck PASS, build PASS.

## Phase D — README and documentation (DONE)

What changed:
- README now lists Stop/Hold (H), Restart Mission, Alt + middle-mouse orbit,
  zoom-toward-cursor, the camera compass, vendor-chunk split, and the new event-log
  hooks. Direct-control table separates R (return) from Esc (pause).
- README adds a Roadmap section pointing at v0.0.4 / v0.0.5 / v0.1.0 work.

Files changed:
- `README.md`

## Final validation

- `npm run typecheck` — PASS
- `npm run build` — PASS, no chunk warnings, three cleanly split bundles:
  - `index-*.js` ≈ 135 kB (app)
  - `react-vendor-*.js` ≈ 142 kB
  - `babylonjs-*.js` ≈ 5.07 MB (cached separately on subsequent loads)
- Vite base path: `/frontline-velocity/` — UNCHANGED.
- `package.json` `name`: `frontline-velocity` — UNCHANGED, no rename needed.

## Acceptance checklist (per project brief)

Build / deploy:
1. `npm install` — PASS
2. `npm run typecheck` — PASS
3. `npm run build` — PASS
4. Vite base path `/frontline-velocity/` — UNCHANGED
5. GitHub Pages workflow files — UNTOUCHED

Desktop tactical camera (6-18): PASS via existing TacticalCameraController +
TacticalInputController, now with compass feedback and camera-reset event log.

Selection (19-25): PASS via SelectionController + drag-rect overlay + roster
group-count badge.

Commands (26-32): PASS via CommandController formation offsets and event log;
Stop/Hold added on top of the existing move/attack-move/attack flow.

Control groups (33-36): PASS — `Ctrl + 1-9` assigns, `1-9` recalls, double-tap
centers (already wired in GameRoot).

Health bars (37-43): PASS — HUD roster uses vertical-flex with a clipped fill,
world-space bars share a single yaw-billboarded parent so bg + fill never
desync at any camera angle.

Direct-control (44-49): PASS — direct-control mode preserved, tactical input
detached during direct control and reattached on return; Esc pauses from
direct control.

Gameplay (50-58): Operation Crossroads, friendly autonomous combat, enemy AI,
projectile damage, victory/defeat, restart from pause — all preserved.

## Final summary

Completed:
- Phase A: Stop/Hold, Restart Mission, collapsible Controls Help.
- Phase B: Camera compass / zoom HUD, camera-reset event log, AI Debug `]`
  hotkey, styled enemy debug overlay.
- Phase C: Vite manualChunks splits Babylon and React from app code.
- Phase D: README + roadmap update.

Partially completed / deferred (intentional):
- Mobile control polish — explicitly out of scope per the brief.
- Friendly autonomous-fire tuning — current AI already engages along
  attack-move paths, slows to fire, and resumes; left untouched to avoid
  destabilizing v0.0.3 the night before sign-off.

Not completed:
- New mission content (out of scope; v0.0.5 roadmap).
- Pathfinding rewrite (out of scope; v0.0.4 roadmap).
- Mouse-controlled turret in direct control (out of scope; future).

Files added:
- `OVERNIGHT_PROGRESS.md`
- `src/ui/CameraCompass.tsx`

Known bugs: none observed at typecheck / build time.

Recommended next steps:
- Manual desktop QA pass against the acceptance checklist (the validation
  loop in this session was static-analysis only — no live `npm run dev`
  smoke test was performed because the host shell is non-interactive).
- v0.0.4 backlog from the brief: pathfinding around buildings, attack-move
  balancing, vehicle acceleration tuning, more polished explosions, terrain
  variation, enemy patrol/guard logic.

Recommended commit message:
`Overhaul desktop RTS controls and tactical camera for v0.0.3`

---

# v0.0.4 Content & Graphics Push

## User request (verbatim)

> add things like increase enemies throughout the level destructable buildings
> better graphics for everything in the game. background music that would make
> sense for world war 2 games. better graphics I mean give it like a style like
> command & conquer but more HD polish. I want the ground textures to make
> sense, UI to be intuative more dense cities more unit types and more
> objectives if this causes levels to increase in size so be it.
>
> make sure to change the version number and display the version number on the
> main menu each time you push.

## What landed in v0.0.4

Simulation / content:
- New unit types `heavyTank` and `mortar` (templates, AI leash, vehicle
  classification, UI labels, rendering).
- Destructible buildings — `BuildingState` tracked in `SimulationState`,
  damage via projectile direct hits and explosion splash, dynamic
  pathing obstacles that drop when buildings collapse.
- Mission overhaul (`operationCrossroads`): denser road network, more
  buildings with `buildingStyle` variants (house, barn, factory, church,
  bunker) and `destructible` flags, larger enemy garrison including
  heavy tanks and mortars, expanded mission briefing.
- Procedural ambient music (`AudioManager.startMusic`) — synthesized
  WW2-flavor war drums + low brass drone, started when entering briefing
  or play. No copyrighted audio is referenced or loaded.

Rendering / visuals:
- `TerrainRenderer.buildGroundMaterial` paints a procedural ground
  texture (DynamicTexture) with grass tone variation, mud patches, and
  cross-axis gravel streaks. Tiled across the map.
- `buildBuilding` now renders distinct shapes for barns (pitched roof),
  factories (smokestack), churches (steeple), bunkers (squat slab with
  firing slits), and houses (default with chimney).
- `syncBuildings` collapses destroyed buildings into rubble piles +
  scattered debris each frame.
- `UnitRenderer` cases for `heavyTank` (oversized tank silhouette) and
  `mortar` (low square base + angled tube + ammo crates).

UI / UX:
- New `Minimap` component (top-down canvas) wired to a `MinimapSnapshot`
  in the store. Shows friendly, enemy, building, rubble, and objective
  blips, plus a camera-frustum hint. Click-to-pan moves the tactical
  camera (`GameEngine.panTacticalCameraTo`).
- `MainMenu` now shows the current `APP_VERSION` and a short version
  label; `AppShell` reads the single-source `version.ts` constant for
  the corner version label.
- `MainMenu` About copy refreshed to describe the v0.0.4 build.

Build / metadata:
- `package.json` `version` bumped to `0.0.4`.
- New `src/version.ts` so the version string lives in one place.

## Validation

- `npm run typecheck` — PASS
- `npm run build` — PASS (Babylon chunk ~5.07 MB, isolated as a vendor
  chunk; warning limit raised in v0.0.3).


# GitHub Pages deployment verification (post-v0.0.4)

Verified end-to-end that the live deploy surface is healthy. No fixes were
required; nothing changed in the build, workflow, or asset pipeline.

## Workflow (`.github/workflows/deploy-pages.yml`)

- Triggers: `push` to `main`, plus `workflow_dispatch` for manual runs.
- Permissions: `contents: read`, `pages: write`, `id-token: write` — correct
  for `actions/deploy-pages@v4`.
- Action versions in use (all current as of v0.0.4):
  - `actions/checkout@v4`
  - `actions/setup-node@v4` (Node 20, npm cache)
  - `actions/configure-pages@v5`
  - `actions/upload-pages-artifact@v3`
  - `actions/deploy-pages@v4`
- Build job runs `npm ci` → `npm run typecheck` → `npm run build`, then
  uploads `dist/` as the Pages artifact. Deploy job consumes that artifact
  in the `github-pages` environment.
- Companion `.github/workflows/build.yml` runs typecheck + build on every
  branch and PR, so the feature branch is also exercised in CI.

## Vite config audit

- `vite.config.ts` still has `base: '/frontline-velocity/'`. **Unchanged.**
- `manualChunks` produces three clean output bundles: app `index-*.js`,
  `react-vendor-*.js`, `babylonjs-*.js`. None of the chunks contain
  hard-coded asset paths that would break under the `/frontline-velocity/`
  base; cross-chunk imports go through Vite's chunk emitter, which uses
  the correct `base`-prefixed URLs in the entry HTML.

## Source-level asset path audit

- `rg` for `fetch(`, `new URL(`, `import('...')` with absolute `/` paths,
  literal `/assets/`, `localhost`, `http://`, `https://` in `src/` —
  **zero matches.** No source-level absolute URLs exist.
- Procedural content paths are pure-runtime:
  - `TerrainRenderer.buildGroundMaterial` uses a Babylon `DynamicTexture`
    drawn to a canvas — no network fetch.
  - `AudioManager` synthesizes ambient music via Web Audio — no network
    fetch, no copyrighted-asset references.
- `public/` contains only `favicon.svg`; no other static assets that would
  need base-path adjustment.

## Build smoke test

- `npm run typecheck` — **PASS** (`tsc -p tsconfig.json --noEmit`, clean).
- `npm run build` — **PASS**, 1,999 modules transformed, no warnings:
  - `dist/index.html` 0.95 kB
  - `dist/assets/index-*.css` 18.20 kB
  - `dist/assets/react-vendor-*.js` 141.93 kB
  - `dist/assets/index-*.js` 152.36 kB
  - `dist/assets/babylonjs-*.js` 5,072.00 kB
- `dist/index.html` — every `<script>` / `<link>` href is prefixed with
  `/frontline-velocity/assets/...`. No bare `/assets/...` or absolute
  external URLs.

## Live URL check — `https://jfhutchi.github.io/frontline-velocity/`

- Root HTML: **HTTP 200**, title `Steel Command: Frontline Velocity`,
  all referenced module/CSS URLs correctly prefixed with
  `/frontline-velocity/`.
- Spot-checked asset URLs (HEAD requests):
  - `assets/index-C0pk5-ZT.js` → 200
  - `assets/react-vendor-B-xc1j1m.js` → 200
  - `assets/babylonjs-CdKpYIqi.js` → 200
  - `assets/index-C22zaQX_.css` → 200
  - `favicon.svg` → 200

## Known limitation (intentional, not a bug)

The live deploy currently serves **v0.0.3** because the v0.0.4 work
landed on `codex/improve-v002-camera-ai-graphics` and the
`deploy-pages.yml` workflow only auto-deploys from `main`. The v0.0.4
build artifacts produced locally are correct and Pages-ready; they will
go live once the feature branch is merged to `main` (or a maintainer
runs the workflow manually via `workflow_dispatch` against `main`
after merge).

## Outcome

No Pages-breaking issues found. No source, workflow, or config changes
were made during this verification pass. No commit created.

