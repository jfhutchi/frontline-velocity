# Steel Command: Frontline Velocity

A browser-based real-time tactical action prototype where you command a small
armored platoon trying to capture a defended village crossroads. Issue
attack-move orders from the tactical command view, then jump into a vehicle and
fight directly from a third-person combat camera.

**Current version: v0.0.3 — desktop RTS controls overhaul**

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

- Mobile controls are deferred and not optimized in v0.0.3; touch tap-select
  and two-finger pan/pinch still work but no further mobile polish was done.
- Pathing uses simple obstacle-aware waypoints rather than a full navmesh, so
  tight village spaces can still produce imperfect routes.
- Line of sight treats buildings as circular blockers for stability and speed.
- Direct control still uses a third-person chase camera and hull-aligned
  turret behavior; first-person interiors and mouse turret aim remain future
  work.
- Box selection projects unit positions to screen space and ignores models
  partially obscured behind terrain or buildings; very small units at extreme
  zoom-out may need a slightly wider drag.
- Audio remains procedurally generated; there is no mission music yet.

## Roadmap

- v0.0.4 — pathfinding polish around dense buildings, better attack-move
  balancing, vehicle acceleration/turning tuning, more polished explosions
  and smoke, terrain material variation, more robust enemy patrol/guard
  logic, and a confirmable mission-restart hotkey.
- v0.0.5 — second mission, better objective system (timed waves, multi-zone
  control), saveable settings, and a mission-select shell.
- v0.1.0 — campaign shell with save progression, persistent unit roster, and
  a small in-mission tutorial overlay.

## License

See `LICENSE` for the code license. In-repo procedural art and audio are
released under the same terms unless otherwise noted in `src/assets/`.
