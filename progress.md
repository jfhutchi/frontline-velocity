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

2026-05-16 art-reference pass:
- Started the requested `version/v0.0.3-codex-art-direction-pass` branch from a clean worktree.
- Baseline `npm install`, `npm run typecheck`, and `npm run build` passed; Vite base remains `/frontline-velocity/`.
- Fixed the mobile mission briefing blocker by making the briefing screen scroll independently with dynamic viewport height, safe-area padding, and touch panning while keeping gameplay touch blocking on `.game-root` / canvas.
- Renamed the briefing CTA from `Deploy` to `Start Mission`.
- Phase 2 validation: `npm run typecheck` PASS, `npm run build` PASS.
- Bumped the push version to `0.0.5`; the main menu now displays `v0.0.5` with label `Art-Reference RTS/Tank Pass`.
- Tactical camera reset now frames the village/crossroads from a higher RTS command angle.
- Added original procedural battlefield details: hedgerows, stone walls, fences, road signs, extra lanes, set-piece crop fields, barricades, wreck debris, muted materials, stronger smoke, and facade details.
- Improved tank geometry with side skirts, road wheels, tread blocks, glacis plates, rear decks, stowage, mantlets, cupolas, hatches, and muzzle brakes.
- Direct-control now keeps the controlled tank visible and uses a third-person over-the-turret chase camera with health/reload/speed meters and a separate Return to Command button.
- Verification included repeated typecheck/build gates, develop-web-game client smoke, mobile briefing scroll/start on 375x667, tactical/direct-control screenshots, and a controls preservation script covering selection, control groups, right-click order, direct-control entry, drive/fire, and return to tactical.

2026-05-16 v0.0.6 reference tank-view push:
- Bumped the push version to `0.0.6`; the main menu now displays `v0.0.6` with label `Reference Tank-View Push`.
- Tightened the direct-control camera to a lower, closer over-the-turret chase composition so the tank fills the foreground more like the uploaded reference.
- Added original foreground tank detail: darker olive materials, engine grilles, rear stowage, deck bolts, turret cheeks, barrel sleeve, coax detail, cupola ring, and star insignia decals.
- Added direct-view set dressing: labeled road signs, south-approach stone walls/hedges, an extra crop field, muted wheat rows, road ruts/gravel/dust, stronger smoke columns, and a taller church tower.
- Added procedural wall/roof material textures for buildings and removed the extra direct-control top unit-status box; Return to Command now advertises `Tab` while `R` still works.
- Validation: `npm run typecheck` PASS, `npm run build` PASS, develop-web-game client smoke PASS, custom Playwright direct-control screenshot/state PASS with no console errors.

2026-05-15 follow-up pass:
- Starting a mobile/camera/UI/graphics polish pass from the user prompt: "The state of this game is a bit bad. It doesn't work on mobile browsers and the camera controls are bad the ui is bad and I want the graphics to be a lot better"
- Inspection found touch tactical mode only supported tap and two-finger pan/pinch, with no touch-first command/camera surface; HUD panels also crowd small screens.
- Added one-finger tactical camera pan, a mobile tactical camera stick/command bar, continuous virtual camera controls, smoother direct-control chase camera motion, orientation/visualViewport resize handling, refreshed HUD styling, and stronger Babylon lighting/post-processing with extra battlefield scars.
- User clarified the target is modern RTS/direct-control art direction, not a retro homage. Pivoted direct control toward first-person/gunner view, added modern objective/compass/minimap HUD elements, added Fast simulation speed, toned down toy-like colors, and added sky/cloud/smoke atmosphere.
- Final verification: npm run typecheck, npm run lint, npm run build, the develop-web-game Playwright client, and a custom Playwright pass covering desktop tactical pan/zoom/jump-in plus mobile tactical controls/direct-control all passed. Screenshots were reviewed and temporary output artifacts were removed.
