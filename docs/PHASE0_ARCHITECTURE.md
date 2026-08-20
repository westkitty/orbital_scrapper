# Orbital Scrapper — Phase 0 Architecture Decision

**Decision status:** Candidate foundation, accepted only if the Phase 0 gate passes.  
**Scope:** Runtime, 3D physics, fixed timestep, runtime joint lifecycle, diagnostics, and reset only.

## Decision

Use a browser-native, framework-light stack:

- **Rendering:** Three.js `0.185.0`, `WebGLRenderer`.
- **Physics:** `@dimforge/rapier3d-compat` `0.19.3`.
- **Language:** TypeScript `6.0.0`.
- **Build/runtime tooling:** Vite `8.2.1`, Node `>=22.12.0` for development and CI.
- **Application architecture:** vanilla TypeScript rather than React/R3F for the simulation core.

## Why this fits the project

Orbital Scrapper's expensive risk is not page UI. It is a large number of rigid bodies and constraints whose state changes at runtime. The simulation therefore stays outside a component reconciliation system and advances through one explicit fixed-step owner. Three.js owns presentation; Rapier owns rigid-body/constraint truth.

Rapier's JavaScript changelog identifies `0.19.3` as the current release in the inspected upstream source, and the `0.19.x` line includes performance work for scenes with many contact constraints. That is directly relevant to modular wrecks. Three.js `0.185.0` and Vite `8.2.1` are pinned from their current upstream package manifests inspected for this phase.

## Ownership contract

- `PhysicsSandbox` owns the Rapier world and its disposal.
- `FixedStepLoop` owns simulation cadence. Rendering never controls physics timestep.
- `ScenePresenter` mirrors physics transforms into Three.js objects; render transforms are not authoritative simulation state.
- `InputBindings` owns only the minimal Phase 0 reset/joint diagnostic controls.
- Reset destroys the old Rapier world, rebuilds the exact baseline, and rebuilds one managed Three.js scene root.
- Browser unload explicitly detaches listeners and disposes physics/render resources.

## Phase 0 non-goals

Do not add flight controls, wreck assembly rules, cutting, tether gameplay, scanner logic, structural graphs, cargo, economy, production art, or audio in this phase.

## Gate

The foundation may advance to Phase 1 only if automated evidence proves:

1. the project builds and serves;
2. Rapier advances at a fixed `1/60` second timestep;
3. a falling body collides with the ground rather than tunneling through it;
4. a fixed joint can be removed and recreated during runtime;
5. twenty repeated resets preserve body count, constraint count, managed scene-root count, and listener attachment count.

Passing this gate proves the **runtime foundation**, not the full suitability of Three.js for every later production requirement. Later phases still retain their own falsification gates.
