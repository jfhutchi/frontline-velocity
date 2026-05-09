# Steel Command: Frontline Velocity

A browser-based real-time tactical action prototype where you command a small
armored platoon trying to capture a defended village crossroads. Issue
attack-move orders from the tactical command view, then jump into a vehicle and
fight directly from a third-person combat camera.

**Current version: v0.0.2**

## Legal note

This project is an original spiritual successor to classic tactical action
games. No copyrighted content from any prior commercial title is used or
referenced. The game name, mission text, unit names, code, models, audio, UI,
and procedural assets in this repository are original.

## What's new in v0.0.2

- Tactical camera controls: WASD/arrows pan, Shift accelerates pan, mouse wheel
  zooms, middle mouse drags, Q/E rotates, R/Home resets, and two-finger mobile
  pan/pinch is supported.
- Improved graphics: layered terrain, road shoulders, field patches, objective
  sandbags/crates, more detailed buildings, grounded trees/shrubs, stronger
  lighting, soft shadows, and more recognizable procedural unit models.
- Smarter friendly behavior: move orders now behave as attack-move orders;
  friendly units scan, prioritize, fire, and resume their route after contact.
- Better enemy AI: anti-tank guns hold and engage armor, the light tank patrols
  and repositions, and infantry guards without chasing too far from cover.
- Improved pathing and movement: units plan simple obstacle-aware paths, avoid
  buildings and map edges, maintain spacing, accelerate smoothly, and stop
  jittering around destroyed or invalid targets.
- Clearer combat feedback: projectile tracers, muzzle flashes, sparks, smoke,
  explosions, wreck states, health bars, target lines, destination markers,
  under-fire highlights, reload feedback, and a capped battlefield event log.

## Controls

### Desktop tactical command view

| Input | Action |
| --- | --- |
| Left click | Select friendly unit |
| Right click | Issue attack-move order to selected unit |
| 1, 2, 3, 4 | Select friendly unit by roster slot |
| Tab | Cycle to next friendly unit |
| F or Enter | Jump into selected controllable vehicle |
| WASD or Arrow keys | Pan tactical camera |
| Shift + pan | Fast tactical camera pan |
| Mouse wheel | Zoom tactical camera |
| Middle mouse drag | Pan tactical camera |
| Q / E | Rotate tactical camera left / right |
| R or Home | Reset tactical camera |
| Space | Pause / resume |
| Escape | Pause menu |

### Desktop direct vehicle control

| Input | Action |
| --- | --- |
| W / S | Forward / reverse |
| A / D | Turn hull left / right |
| Left click | Fire weapon |
| Space | Fire weapon backup |
| R or Escape | Return to tactical command |

### Mobile

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
    GameEngine.ts                # Main wiring for Babylon, simulation, input, HUD store
    constants.ts                 # Shared gameplay, camera, and visual tunables
    types.ts                     # Simulation types
    missions/operationCrossroads.ts
    input/
      TacticalInput.ts           # Selection and move-order picking
      DirectControlInput.ts      # Direct vehicle keyboard/mouse/touch input
    rendering/
      BabylonScene.ts            # Engine, scene, lights, shadows
      CameraController.ts        # Tactical and direct-control cameras
      TerrainRenderer.ts         # Terrain, roads, buildings, trees, objective details
      UnitRenderer.ts            # Unit meshes, selection, hp bars, target/path indicators
      EffectsRenderer.ts         # Projectiles, flashes, impacts, smoke, explosions
    simulation/
      Simulation.ts              # Fixed-step simulation loop
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

- Pathing uses simple obstacle-aware waypoints rather than a full navmesh, so
  tight village spaces can still produce imperfect routes.
- Line of sight treats buildings as circular blockers for stability and speed.
- Direct control still uses a third-person chase camera and hull-aligned turret
  behavior; first-person interiors and mouse turret aim remain future work.
- Mobile controls are functional, but low-end phones may need further quality
  scaling if additional effects are added.
- Audio remains procedurally generated; there is no mission music yet.

## License

See `LICENSE` for the code license. In-repo procedural art and audio are
released under the same terms unless otherwise noted in `src/assets/`.
