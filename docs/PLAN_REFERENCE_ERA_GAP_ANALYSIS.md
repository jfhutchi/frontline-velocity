# Reference-era tactical action vs Steel Command (gap analysis)

**Branch:** `plan/reference-era-gap-analysis`  
**Purpose:** Planning-only comparison between what late-1990s PC *vehicular tactical / RTS-action hybrid* games typically delivered and what this repository implements today. This document does **not** name, quote, or reproduce any proprietary title; it describes **genre-era pillars** so we can prioritize work without copying anyone’s IP.

---

## 1. What “good” meant on reference-era hardware

Those games ran at low resolutions with chunky UI and simple 3D or pre-rendered backdrops. Success came from **clarity under chaos**: the player always knew *where they were*, *what they controlled*, *what was shooting*, and *what to do next*. Polish lived in **feedback density** (sound, hit flashes, readable silhouettes) and **mission pacing** (short loops: move → contact → resolve → next objective), not in shader complexity.

Steel Command is a **browser Babylon.js prototype** with a stronger simulation spine than many jam games, but it still optimizes for *engineering proof* (pathing, buildings, multi-mode camera) more than *moment-to-moment readability* and *fantasy fulfillment* that reference-era boxed products sold on the back of.

---

## 2. Pillar-by-pillar map

| Pillar | Reference-era expectation | Steel Command today | Gap (why it can feel “not good yet”) |
|--------|---------------------------|---------------------|--------------------------------------|
| **Camera literacy** | Pan/zoom/rotate feel like moving a physical periscope: W moves the *view* into the scene; edges and keys agree. | Tactical orbit camera is capable (MMB pan, wheel zoom-to-cursor, edge scroll, compass) but keyboard pan had been wired with the opposite sign vs common RTS muscle memory. | **Fixed on this branch:** keyboard/arrow pan is negated in `TacticalCameraController.applyKeyboardPan` so W reads as forward into the battlefield. Re-test after orbit (Q/E): basis uses `desiredAlpha`, so rotation + pan should stay coherent. |
| **Ground truth readability** | Terrain reads at a glance: roads, cover, lanes, objective silhouette. | Procedural ground + buildings + minimap help a lot (v0.0.4). Still: unit silhouettes vs rubble, tracers, and explosion VFX compete for attention without filmic hierarchy (contrast, motion, audio ducking). | Needs art direction pass: *who* is the focal subject each frame; reduce visual noise when idle. |
| **Input authority** | Clicks always do what the HUD promises; misclicks are rare. | Strong separation (`TacticalInputController`, selection/command/camera modules), UI hit-test guards, formation move grid. | Edge cases remain (tab order, multi-select primary, jump-in handoff) — any hesitation reads as “janky PC port” even in web. |
| **Combat fantasy** | Jumping into a tank *changes the stakes* — audio, FOV, speed, impact. | Direct mode exists with third-person camera; audio bed is synthetic WW2 flavor. | Reference-era titles sold *kinetic* impact (shell travel time, camera shake discipline, stinger sounds). We have simulation hooks but not yet consistent **cinematic combat read** in direct mode. |
| **Enemy pressure** | AI punishes idle players; difficulty ramps per mission beat. | `EnemyBrainSystem`, waves, denser garrison. | Without visible **intent** (flanking, priority targets, retreat), AI can feel like a DPS gate rather than an opponent. Needs telegraphing (muzzle flashes, radio barks, minimap threat). |
| **Mission clarity** | Objectives are one sentence + map marker; fail states are obvious. | Operation Crossroads: capture ring, buildings, rubble. | Secondary goals, timer pressure, and *why* the village matters are still thin compared to authored campaign beats. |
| **Performance envelope** | 30–60 FPS on period hardware; predictable load. | Single-threaded sim + Babylon; large maps and many units risk frame debt on low-end laptops. | Profiling pass + LOD (distant units, merged draw paths) before adding more systems. |

---

## 3. Why this build can still feel “wrong” even with features

1. **Feature surface > fantasy density:** Destructible blocks, mortar arcs, and minimap blips are *systems-complete* milestones, not the same as *player emotion* (tension, relief, triumph) reference-era games engineered through pacing and audio stingers.  
2. **Web medium friction:** First-load shader compile, focus/visibility edge cases, and lack of native fullscreen polish subtly fight “boxed product” feel.  
3. **Hybrid identity:** Tactical RTS layer + direct control asks the player to master *two* interaction models; reference-era hybrids still spent enormous effort making each mode *feel like the main game* for the minutes you were in it.  
4. **Content depth:** One dense mission is a strong tech demo; reference-era expectations were shaped by *campaign rhythm* (variety, surprises, breather missions).  

None of this invalidates the prototype — it explains why a feature-rich v0.0.4 can still read as “tech impressive, soul catching up.”

---

## 4. Suggested follow-up work (prioritized)

1. **Playtest pass:** WASD/arrow pan + edge scroll + MMB on rotated map; confirm no double-negative regressions.  
2. **Combat read:** Shell impact, brief hit-stop or flash, clearer destroyed-building transition.  
3. **AI telegraph:** Visible state changes when AI chooses attack vs reposition.  
4. **Direct-mode juice:** FOV, camera lag, and weapon-specific audio layers when jump-in is polished for v0.0.5+.  
5. **Campaign skeleton:** Second mission type (escort / timed defend) to test systems outside Crossroads layout.

---

## 5. Input fix detail (this branch)

- **File:** `src/game/rendering/TacticalCameraController.ts`  
- **Change:** `applyKeyboardPan` calls `panByWorldAxes(-right * speed * dt, -forward * speed * dt)` so keyboard/chord intent matches RTS-typical “push view forward” semantics while leaving middle-mouse and edge-scroll paths unchanged.

---

*End of planning artifact — safe to merge with code as reference for design discussions; not a shipping player-facing doc unless README links it.*
