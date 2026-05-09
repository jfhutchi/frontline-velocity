Original prompt: Upgrade Steel Command: Frontline Velocity from v0.0.1 to v0.0.2 in the existing repository root, preserving GitHub Pages base `/frontline-velocity/`, direct control, Operation Crossroads, and original-assets/legal constraints. Implement improved tactical camera controls, visual polish, tree/building/terrain fixes, friendly autonomous combat, enemy AI, pathing, combat feedback, UI readability, README updates, validation, commit, push, and PR.

Progress:
- Added AI state, attack-move targeting, sticky target selection, building line-of-sight checks, obstacle-aware path planning, event log entries, and smoother movement with unit separation.
- Reworked tactical camera control for keyboard pan/rotate/reset, wheel zoom, middle-drag pan, two-finger pan/pinch, and bounded smooth movement.
- Improved procedural terrain, roads, fields, buildings, trees, objective details, unit models, projectile trails, smoke, and combat indicators.
- Updated package metadata and README for v0.0.2.
- npm install succeeded.
- npm run typecheck passed.
- npm run build passed with the existing Babylon/Vite large chunk warning.
- Playwright smoke checks covered menu/briefing, tactical camera pan/rotate/zoom, move order, direct-control entry, direct-control fire/reload, and return-to-command. Screenshots were reviewed and temporary artifacts were removed.

TODO:
- Commit, push, and open a draft PR if local GitHub credentials are available.
