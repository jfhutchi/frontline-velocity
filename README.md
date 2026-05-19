# Steel Command: Frontline Velocity

A browser-based real-time tactical action prototype where you command a small
armored platoon trying to capture a defended village crossroads. Issue
attack-move orders from the tactical command view, then jump into a vehicle and
fight directly from a third-person combat camera.

**Current version: v0.0.8 — rifle squads & faster armor**

## What's new in v0.0.8

v0.0.8 is a focused combat-feel pass:

- Infantry no longer fires single tank-style shells. Each squad now volleys a
  short burst of three rifle bullets per fire cycle with a small angular
  spread, rendered as small bright tracers instead of large cannon rounds.
  Per-bullet damage is rebalanced so squad DPS stays close to v0.0.7.
- Muzzle flashes for infantry are smaller and produce no cannon smoke puff so
  rifle fire reads visually distinct from tank cannons.
- Friendly armor moves faster: medium tank 6 → 7.5, heavy tank 4.2 → 5.4,
  light tank 7 → 8.5, recon jeep 11 → 13.5. Infantry, anti-tank guns, and
  mortars are unchanged. Direct-control speed cap raised in lockstep so
  per-unit speeds are no longer clamped at the engine layer.

## What's new in v0.0.7

- All friendly unit types (infantry, light tanks, anti-tank guns, mortars,
  and the existing medium/heavy tanks and recon jeep) are player-controllable
  via `Enter`. Per-unit speed cap means infantry no longer drives at tank
  pace and stationary weapons (mortar, AT gun) stay put.
- Direct-control chase camera yaw is fixed so stick/keyboard directions
  always match the controlled unit's hull rotation.

## What's new in v0.0.6

v0.0.6 is a focused direct-control visual push toward the uploaded
over-the-turret tank reference, with the main menu version incremented for this
push.

- Tightened the direct-control chase camera so the tank fills the foreground
  more aggressively while keeping the road and village readable ahead.
- Added more original tank detailing: darker olive materials, engine grilles,
  rear stowage, deck bolts, turret cheeks, barrel sleeve, coax detail, cupola
  ring, and original star insignia decals.
- Added reference-specific rural set dressing: labeled road signs, extra
  south-approach stone walls and hedges, another crop field near the approach,
  muted wheat rows, road ruts, gravel, dust patches, and taller smoke columns.
- Reworked village materials with procedural wall and roof textures so houses,
  barns, and the church read less like flat colored boxes.
- Strengthened the church silhouette with a taller tower, belfry, steeple, and
  arch openings for the direct-control village view.
- Cleaned the direct-control HUD closer to the reference by removing the extra
  top unit-status box and changing Return to Command to use `Tab` while keeping
  `R` as a compatibility shortcut.

## What's new in v0.0.5

v0.0.5 is a desktop-first visual, HUD, and camera pass aimed at closing the
gap to the uploaded tactical RTS and direct-control tank reference images.

- Fixed the mobile mission briefing blocker: portrait players can scroll the
  briefing, reach Back, and press Start Mission without rotating the device.
- Tactical camera reset now frames the village crossroads from a higher RTS
  command angle with the objective, roads, fields, and approach lanes visible.
- Direct-control mode now uses a third-person over-the-turret chase camera;
  the controlled tank remains visible in the foreground with turret, barrel,
  hull, tracks, and stowage details.
- Tactical battlefield detail pass: added hedgerows, stone walls, fences, road
  signs, extra approach lanes, set-piece crop fields, barricades, wreck debris,
  stronger smoke columns, muted terrain colors, and more grounded building
  facade details.
- Tank silhouettes are heavier and more readable: side skirts, road wheels,
  tread blocks, glacis plates, rear decks, stowage, mantlets, cupolas, hatches,
  and muzzle brakes are built from original procedural geometry.
- HUD pass: tactical roster bars remain clipped in dedicated rows, direct
  control now shows health/reload/speed meters, the return-to-command button
  sits as its own bottom-right control, and direct-control help clutter is
  removed from the tank view.
- Validation for this pass included `npm install`, repeated `npm run typecheck`
  and `npm run build`, the develop-web-game Playwright client, mobile briefing
  scroll/start verification, tactical screenshots, direct-control screenshots,
  and a controls preservation script covering selection, control group recall,
  right-click order, direct-control entry, drive/fire, and return to tactical.

## What's new in v0.0.4

v0.0.4 builds on the v0.0.3 desktop RTS scaffolding with a content and
graphics push. The mission is bigger, denser, and noisier, and the HUD
exposes a tactical minimap so you can keep track of all of it.

- Two new unit types: `Heavy Tank` (slow, durable, hard-hitting) and
  `Mortar Team` (indirect fire support).
- Destructible buildings: every house, barn, factory, church, and bunker
  in Operation Crossroads has its own HP pool. Tank shells damage them
  directly, splash damage from explosions chews through nearby
  structures, and collapsed buildings drop out of the pathing graph and
  turn into rubble piles in the world.
- Bigger garrison: more enemy infantry, AT guns, light tanks, and now
  heavy tanks and mortars scattered through a multi-block town instead
  of a single firing line.
- Denser city: longer cross-roads, multiple lanes, mixed buildings with
  five distinct styles (house, barn, factory, church, bunker) plus
  rooftop and chimney details.
- Procedural ground texture: a hand-painted dynamic texture replaces
  the flat green plane, with grass tonal variation, mud patches, and
  gravel streaks along the road axes. Tiled across the map.
- Tactical minimap (bottom-right HUD panel): friendly / enemy / building
  / rubble blips, objective ring with capture progress, and a camera
  facing indicator. Left-click anywhere on the minimap to pan the
  tactical camera to that world position.
- Ambient WW2-flavor war-drum bed synthesized at runtime via the Web
  Audio API. No copyrighted audio is loaded, referenced, or shipped.
- Main menu now displays the version number and a short version label so
  you can see at a glance which build you are looking at.

## Legal note

This project is an original spiritual successor to classic tactical action
games. No copyrighted content from any prior commercial title is used or
referenced. The game name, mission text, unit names, code, models, audio, UI,
and procedural assets in this repository are original. Control conventions are
inspired by the desktop real-time strategy genre but no proprietary art,
sound, mission, or behavior content is copied.

## What's new in v0.0.3

v0.0.3 is a desktop-first overhaul of the tactical command layer. Mobile
controls remain functional but are not the acceptance target this version.

- New tactical input architecture split into focused modules:
  `TacticalInputController`, `SelectionController`, `CommandController`,
  `PointerWorldResolver`, and a dedicated `TacticalCameraController`.
- RTS-style mouse: left-click selects, Shift+left-click toggles, left-drag
  draws a visible selection rectangle and box-selects friendly units, right-
  click issues contextual move / attack-move / attack orders.
- Multi-unit selection with formation-aware orders. Right-clicking ground with
  several units selected spreads destinations into a compact grid so units do
  not all path to the same square.
- Smooth, frame-rate-independent tactical camera with damped pan, zoom, and
  rotate, configurable mouse-edge scrolling (canvas-relative), middle-mouse
  drag pan, Alt + middle-mouse drag orbit, mouse wheel zoom-toward-cursor,
  Q/E rotate, R/Home reset, and F to center on selected.
- Control groups (Ctrl+1-9 to assign, 1-9 to recall, double-tap to center
  camera on the group) and Tab to cycle through friendly units / rotate the
  primary unit inside a multi-selection.
- New `Stop (H)` command and HUD button to cancel move orders for selected
  units while letting them defend in place.
- Pause menu now offers `Restart Mission` (full Operation Crossroads reset)
  alongside Resume and Return to Menu. Esc pauses from direct-control mode.
- UI hit-test guard so HUD button clicks never become accidental world clicks
  or trigger edge-scroll panning. Camera input is also paused while the
  browser tab is hidden so the camera does not lurch on focus return.
- Visible selection rings, hover ring, destination markers, attack lines, and
  a live drag-rectangle overlay.
- New `CameraCompass` HUD widget shows tactical heading (N/E/S/W) and a
  zoom-fraction bar so the player always knows where they are looking and how
  far the camera is pulled out.
- World-space unit health bars now share a single yaw-billboarded parent
  transform so the colored fill and the dark background stay locked together
  at every camera angle, pan, zoom, and rotate.
- Tactical HUD unit roster rebuilt: each row uses a vertical layout with the
  health bar in its own clipped container so the colored fill never overlaps
  the unit name or health percentage.
- Collapsible Controls Help panel with a `–` / `?` toggle.
- Production bundle is now split into separate Babylon.js, React, and app
  chunks so subsequent loads cache the engine independently from app code.
- Event log entries for selection, move, attack, hold, and camera-reset
  actions for clearer feedback during command sequences.

## Controls

### Desktop tactical command view (primary in v0.0.3)

| Input | Action |
| --- | --- |
| Left click | Select friendly unit |
| Shift + left click | Add or remove unit from selection |
| Left drag | Draw selection box and select friendly units inside |
| Right click ground | Move / attack-move (multi-unit aware) |
| Right click enemy | Attack target with selected units |
| Mouse near edge | Pan camera (canvas edges, ramped speed) |
| Middle mouse drag | Pan camera (drag world in cursor direction) |
| Alt + middle mouse drag | Orbit / rotate camera |
| Mouse wheel | Smooth zoom toward ground point under cursor |
| WASD or Arrow keys | Pan camera |
| Shift + pan | Faster pan |
| Q / E | Rotate camera left / right |
| R or Home | Reset camera to default overview |
| F | Center camera on selected unit / group |
| H | Stop / hold position (cancels move orders for selected units) |
| 1-9 | Recall control group, or select roster slot if no group set |
| Ctrl + 1-9 | Assign current selection to control group |
| Tab | Rotate primary inside a multi-selection, otherwise cycle friendlies |
| Enter | Jump into selected controllable vehicle |
| Space | Pause / resume (tactical only — fires in direct control) |
| Escape | Clear selection, pause from tactical, or pause/resume from direct control |

### Desktop direct vehicle control

| Input | Action |
| --- | --- |
| W / S | Forward / reverse |
| A / D | Turn hull left / right |
| Left click | Fire weapon |
| Space | Fire weapon backup |
| R | Return to tactical command |
| Escape | Pause (Esc again to resume) |

### Mobile (functional, not optimized in v0.0.3)

| Gesture / control | Action |
| --- | --- |
| Tactical one-finger tap | Select unit or issue order when a unit is selected |
| Tactical two-finger drag | Pan tactical camera |
| Tactical pinch | Zoom tactical camera |
| Tactical camera buttons | Rotate, zoom, or reset camera |
| Direct-control joystick | Drive selected vehicle |
| Direct-control fire button | Fire weapon |
| Direct-control return button | Return to tactical command |

## Local setup

Requirements: Node.js 20.x or newer.

```bash
npm install
npm run dev
```

Open the printed Vite URL. With the GitHub Pages base configured, the local
dev path is typically:

```text
http://localhost:5173/frontline-velocity/
```

## Build

```bash
npm run typecheck
npm run build
```

`npm run build` runs TypeScript and then produces the static site in `dist/`.

## GitHub Pages deployment

The Vite config intentionally keeps:

```ts
base: '/frontline-velocity/'
```

The repository deploys to:

```text
https://jfhutchi.github.io/frontline-velocity/
```

The included `.github/workflows/deploy-pages.yml` workflow builds and uploads
`dist/` for GitHub Pages when changes are pushed to `main` or when the workflow
is manually dispatched.

## Architecture overview

```text
src/
  game/
    GameEngine.ts                # Wires Babylon, simulation, input, HUD store
    constants.ts                 # Shared gameplay, camera, and visual tunables
    types.ts                     # Simulation types
    missions/operationCrossroads.ts
    input/
      TacticalInputController.ts # Canvas events: selection, commands, edge-scroll
      SelectionController.ts     # Selection set logic against the Zustand store
      CommandController.ts       # Multi-unit move / attack orders with formations
      PointerWorldResolver.ts    # Screen-to-world picks and box-selection culling
      DirectControlInput.ts      # Direct vehicle keyboard/mouse/touch input
    rendering/
      BabylonScene.ts            # Engine, scene, lights, shadows
      CameraController.ts        # Camera mode rig (tactical vs. chase)
      TacticalCameraController.ts# RTS pan/zoom/rotate/edge-scroll math
      TerrainRenderer.ts         # Terrain, roads, buildings, trees, objective
      UnitRenderer.ts            # Unit meshes, selection, hp bars, target lines
      EffectsRenderer.ts         # Projectiles, flashes, impacts, smoke
    simulation/
      Simulation.ts              # Fixed-step simulation loop and player commands
      systems/
        AISystem.ts              # Friendly attack-move and enemy behavior
        MovementSystem.ts        # Waypoint movement, steering, separation
        PathfindingSystem.ts     # Simple obstacle-aware path planning and LOS
        CombatSystem.ts          # Turret aim and fire decisions
        ProjectileSystem.ts      # Projectile travel and hit detection
        DamageSystem.ts          # Armor, damage, destruction
        ObjectiveSystem.ts       # Crossroads capture and win/loss checks
        EventLogSystem.ts        # Capped battlefield messages
  ui/                            # React HUD, menus, panels, controls help
  styles/global.css              # Layout and HUD styling
```

Simulation code stays independent of Babylon and React. Renderers consume
simulation state and keep procedural meshes in sync. React HUD components read
summary snapshots from Zustand instead of updating every render frame.

## Known limitations

- Mobile tactical/gameplay controls are deferred and not optimized in v0.0.8; touch tap-select
  and two-finger pan/pinch still work but no further mobile polish was done.
- Pathing uses simple obstacle-aware waypoints rather than a full navmesh, so
  tight village spaces can still produce imperfect routes.
- Line of sight treats buildings as circular blockers for stability and speed.
- Direct control still uses a third-person chase camera and hull-aligned
  turret behavior; first-person interiors and mouse turret aim remain future
  work.
- Visuals are still original procedural geometry/materials rather than
  authored high-poly meshes and texture atlases, so the v0.0.8 combat-feel
  pass improves projectile readability and vehicle pacing without importing
  or copying commercial-game assets.
- Box selection projects unit positions to screen space and ignores models
  partially obscured behind terrain or buildings; very small units at extreme
  zoom-out may need a slightly wider drag.
- Audio is procedurally synthesized in the browser (no external assets).
  The v0.0.4 ambient bed is a simple drum/drone loop and is intentionally
  low-key; mission-specific cues remain future work.
- Destructible buildings have HP, damage, and collapse-to-rubble, but the
  pathing graph only refreshes per-frame from the live obstacle set rather
  than rebuilding a full navmesh, so very tightly packed alleys can still
  produce occasional imperfect routes.

## Roadmap

- v0.0.9 — first slice of the "Desktop HD Polish" plan: improved
  direct-control feel (smoother acceleration, camera lag, recoil and
  reload feedback, crosshair/weapon state), visual polish pass on
  lighting / projectile trails / explosions / smoke / wrecks, and basic
  layered audio (cannon vs. rifle distinction, impacts, alert stingers).
- v0.0.10 — tactical layer polish (camera feel, selection confidence,
  order feedback, minimap usability), mission pacing rework for
  Operation Crossroads, and pooled transient effects / instanced scenery
  for stable desktop FPS.
- v0.1.0 — campaign shell with save progression, persistent unit roster,
  a small in-mission tutorial overlay, and a second campaign mission with
  multi-zone control.

## License

See `LICENSE` for the code license. In-repo procedural art and audio are
released under the same terms unless otherwise noted in `src/assets/`.
