# Steel Command: Frontline Velocity

A browser-based real-time tactical action prototype where you command a small
armored platoon trying to capture a defended village crossroads. Issue orders
from a top-down command view, then jump into a tank and personally fight from
a vehicle combat view.

**Current version: v0.0.1**

## Legal note

This project is an **original spiritual successor** to the 1996 DOS tactical
action game whose general gameplay structure inspired it. **No copyrighted
content** of any prior commercial title is used or referenced. The game name,
logo, mission names, unit names, code, models, audio, and UI in this repo are
all original placeholder works. All visuals in v0.0.1 are primitive Babylon.js
meshes; all audio is procedurally generated through the Web Audio API. There
are no copied sprites, sounds, missions, maps, data files, or UI art.

## Features implemented (v0.0.1)

- Single playable mission: **Operation Crossroads**
- Main menu, mission briefing, tactical command view, direct vehicle control,
  pause overlay, victory/defeat screens
- Tactical view with selection, click-to-move orders, slow / normal speed,
  pause/resume, jump-into-vehicle button, and per-unit info panel
- Direct-control view for both medium tanks (Alpha and Bravo) with WASD
  movement, mouse / spacebar fire, third-person chase camera, and an HUD
  showing health, reload, weapon, and objective progress
- 1 friendly platoon: 2 medium tanks, 1 recon jeep, 1 infantry squad
- 5 enemy units: 1 light tank (patrolling), 2 stationary anti-tank guns,
  2 infantry squads
- Combat with health, armor, weapon range, reload time, projectiles, splash
  damage, hit/explosion effects, and visual wreck states
- Capture-and-hold objective at the crossroads (30-second hold to win)
- Friendly AI continues following orders and engages opportunistically while
  the player is in another unit
- Enemy AI: stationary anti-tank guns hold position, infantry defends, light
  tank patrols then engages
- Fixed-step simulation independent of frame rate, with delta-time clamp to
  survive tab-switch hitches
- Mobile-friendly UI: touch joystick + fire button + return button for direct
  control; tap-to-select / tap-to-move on the tactical map
- Procedural Web Audio SFX for click, fire, explosion, hit, victory, defeat
- React `ErrorBoundary` so runtime errors do not produce a blank page

## Controls

### Tactical command view (desktop)
| Key | Action |
| --- | --- |
| Left click | Select friendly unit |
| Right click | Issue move order to selected unit |
| 1, 2, 3, 4 | Select friendly unit by slot |
| Tab | Cycle to next friendly unit |
| F or Enter | Jump into selected controllable vehicle |
| Space | Pause / Resume |
| Escape | Pause menu |
| Mouse wheel | Zoom · drag-with-mouse to orbit |

### Direct vehicle control (desktop)
| Key | Action |
| --- | --- |
| W / S | Forward / Reverse |
| A / D | Turn hull left / right |
| Left click | Fire cannon |
| Space | Fire cannon (backup) |
| R | Return to tactical command |
| Escape | Return to tactical command |

### Mobile
- **Tactical view:** tap a friendly unit to select; tap open ground to issue
  a move order; on-screen Pause / Jump-In / Return buttons in the HUD.
- **Direct control:** virtual joystick (bottom-left), fire button (bottom-right),
  return button (top-right).

## Local setup

Requirements: Node.js **20.x or newer** (Vite 5 + React 18).

```bash
npm install
npm run dev
```

Open the printed URL (typically `http://localhost:5173/steel-command-frontline-velocity/`)
in a desktop browser.

## Build

```bash
npm run build
```

This runs the TypeScript typechecker and then produces a static bundle in
`dist/`.

## Preview

After building, you can serve the production output locally:

```bash
npm run preview
```

## GitHub Pages deployment

The Vite config sets `base: '/steel-command-frontline-velocity/'`, so the
build output is ready to deploy under that repo path.

The repo includes `.github/workflows/deploy-pages.yml` which:

1. Runs on push to `main` (or manual dispatch).
2. Installs deps, typechecks, builds, uploads `dist/` as a Pages artifact.
3. Deploys with `actions/deploy-pages@v4`.

To set up GitHub Pages for the repository:

1. Push the project to a repo named **`steel-command-frontline-velocity`** on
   GitHub.
2. In the repo settings, enable **Pages → Build and deployment → Source:
   GitHub Actions**.
3. Push to `main` (or trigger the deploy workflow manually).
4. The deployed game appears at:
   `https://<username>.github.io/steel-command-frontline-velocity/`

If your GitHub username differs from `jfhutchi`, the URL will use your
username — the base path itself only depends on the repo name and remains
correct.

## Architecture overview

```
src/
  main.tsx             # React entry
  App.tsx              # ErrorBoundary + AppShell
  app/
    AppShell.tsx       # Picks the active screen based on store state
    ErrorBoundary.tsx
    routes.ts          # Screen names
  game/
    GameRoot.tsx       # Hosts Babylon canvas + HUD overlays
    GameEngine.ts      # Wires Babylon, Simulation, input, store
    constants.ts       # Tunables: speed, ranges, colors, timestep, etc.
    types.ts           # Pure simulation types
    state/
      gameStore.ts     # Zustand store (screens, selection, summaries)
    simulation/
      Simulation.ts    # Fixed-timestep update loop, callbacks
      math.ts          # Vector / angle helpers
      systems/
        AISystem.ts          # Target acquisition + behavior
        MovementSystem.ts    # Steering toward orders / patrol
        CombatSystem.ts      # Turret aim + fire decisions
        ProjectileSystem.ts  # Projectile motion + hit detection + splash
        DamageSystem.ts      # Apply armor-mitigated damage, mark wrecks
        ObjectiveSystem.ts   # Capture-zone hold logic + win/loss check
    entities/
      Unit.ts          # Unit factory + stat templates
      VehicleUnit.ts
      InfantryUnit.ts
      Projectile.ts
      ObjectiveZone.ts
    missions/
      operationCrossroads.ts   # Map decorations, units, objective
    rendering/
      BabylonScene.ts   # Engine + scene + lights + arc-rotate camera
      CameraController.ts # Tactical / chase camera switching
      TerrainRenderer.ts  # Ground, roads, buildings, trees, hills, capture zone
      UnitRenderer.ts     # Per-unit visuals: hull / turret / hp bar / marker
      EffectsRenderer.ts  # Projectiles, muzzle flashes, explosions
    input/
      TacticalInput.ts    # Click-pick units / ground for orders
      DirectControlInput.ts # Keyboard + touch input for direct control
      TouchControls.ts    # isTouchDevice helper
    audio/
      AudioManager.ts   # Web Audio procedural SFX
  ui/
    MainMenu.tsx
    MissionBriefing.tsx
    TacticalHUD.tsx
    DirectControlHUD.tsx
    UnitPanel.tsx
    ObjectivePanel.tsx
    PauseMenu.tsx
    EndMissionScreen.tsx
    ControlsHelp.tsx
    MobileTouchControls.tsx
  styles/global.css
  assets/README.md
```

Simulation logic, rendering, input, and React UI are deliberately separated:

- Simulation operates entirely on plain TypeScript types (no Babylon imports).
- Renderers consume simulation state but never mutate it.
- React components subscribe to a Zustand store that the engine pushes
  summary snapshots into ~10 times per second — they never run per-frame
  React updates.
- The simulation uses a fixed semi-fixed timestep accumulator and clamps
  oversized frame deltas (e.g. after a tab loses focus) to keep behavior
  stable.

## Assumptions made for v0.0.1

- "Direct vehicle control" uses a third-person chase camera. A first-person
  cockpit view is left for v0.0.3 — `CameraController` is structured so a
  first-person camera can be added without restructuring the engine.
- Mouse-driven turret aim is intentionally muted in v0.0.1 (turret recenters
  with hull) so that the chase camera + cannon firing experience is reliable
  on all browsers without pointer-lock quirks. AI-controlled units still
  aim their turrets independently of hull rotation.
- Pathfinding is direct steering with simple unit-vs-unit avoidance — there
  is no navmesh. Units may briefly skirt buildings rather than route around
  them; this is acceptable for v0.0.1 and slated for v0.0.2.
- All visuals are primitive Babylon meshes. The map is procedurally laid out
  but seeded so it is consistent across runs.
- Audio is procedurally synthesized; there is no mission music yet.
- There is no save/progression — replay is via the **Replay Mission** button
  on the end-of-mission screen.
- The Recon Jeep and Infantry Squad are commandable via tactical orders;
  per spec, only the two Medium Tanks are exposed as direct-control vehicles
  in v0.0.1.

## Known limitations

- No pathfinding: tank vs. building collision is approximated visually only.
- No first-person interior camera yet.
- Mouse-aimed turret in direct control is left for a follow-up.
- No persistent save state.
- No campaign or mission selection screen yet (single mission).
- Mobile performance is functional but not heavily optimized; complex scenes
  may run slower on low-end phones.
- Audio is synthesized — replace with original recordings in `src/assets/`.

## Roadmap

- **v0.0.2** — Pathfinding (basic navmesh or grid avoidance), smarter enemy
  AI (flanking, retreat), better friendly squad cohesion.
- **v0.0.3** — Improved direct-control with mouse-aimed turret, optional
  first-person interior camera, vehicle physics polish.
- **v0.0.4** — Mission editor: place units / objectives in-browser, save to
  JSON, load from URL or file.
- **v0.0.5** — Campaign shell: connected mission flow with persistent
  between-mission state.
- **v0.1.0** — Multiple missions, save progression, audio replacement with
  original recorded SFX.

## License

See `LICENSE` for code license. All in-repo art and audio are also released
under the same terms unless otherwise noted in `src/assets/`.
