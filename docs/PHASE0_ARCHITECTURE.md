# Orbital Scrapper — Phase 0 Architecture Decision

**Decision status:** Accepted and verified by the Phase 0 Runtime Gate.  
**Scope:** Runtime, 3D physics, fixed timestep, runtime joint lifecycle, diagnostics, and reset only.

## Decision

Use a browser-native, framework-light stack:

- **Rendering:** Three.js `0.185.0`, `WebGLRenderer`.
- **Physics:** `@dimforge/rapier3d-compat` `0.19.3`.
- **Language:** TypeScript `7.0.2`.
- **Build/runtime tooling:** Vite `8.2.1`, Node `>=22.12.0` for development and CI.
- **Application architecture:** vanilla TypeScript rather than React/R3F for the simulation core.

## Why this fits the project

Orbital Scrapper's expensive risk is not page UI. It is a large number of rigid bodies and constraints whose state changes at runtime. The simulation therefore stays outside a component reconciliation system and advances through one explicit fixed-step owner. Three.js owns presentation; Rapier owns rigid-body/constraint truth.

The Phase 0 gate proved that this stack can boot, simulate, alter a runtime constraint, reset deterministically, build for production, and initialize the built application in headless Chrome. That is sufficient evidence to advance to the flight-specific Phase 1 gate without claiming that later wreck, tether, scanner, collapse, or release-scale requirements are already proven.

## Ownership contract

- `PhysicsSandbox` owns the Rapier world and its disposal.
- `FixedStepLoop` owns simulation cadence. Rendering never controls physics timestep.
- `ScenePresenter` mirrors physics transforms into Three.js objects; render transforms are not authoritative simulation state.
- `InputBindings` owns only the minimal Phase 0 reset/joint diagnostic controls.
- Reset destroys the old Rapier world, rebuilds the exact baseline, and rebuilds one managed Three.js scene root.
- Browser unload explicitly detaches listeners and disposes physics/render resources.

## Phase 0 non-goals

Phase 0 intentionally did not add flight controls, wreck assembly rules, cutting, tether gameplay, scanner logic, structural graphs, cargo, economy, production art, or audio.

## Verification evidence

GitHub Actions workflow: `Phase 0 Runtime Gate`, run `32326833764`.

The accepted gate proved:

1. exact declared dependencies install successfully;
2. all seven Phase 0 automated tests pass;
3. Rapier advances at the fixed `1/60` second simulation target within numeric precision;
4. a falling rigid body collides with the test ground;
5. a fixed impulse joint can be removed and recreated at runtime;
6. twenty repeated resets preserve exact rigid-body and constraint counts;
7. twenty presentation rebuilds preserve one managed Three.js root without duplicated managed scene objects;
8. input bindings attach once and detach cleanly;
9. TypeScript checking and the Vite production build pass;
10. the built application initializes in headless Chrome and reports four bodies with one active bridge constraint.

## Nonblocking observations

- The Phase 0 production bundle is large for such a small spike because Three.js and Rapier are bundled directly. CI reported roughly `2.76 MB` minified JavaScript / `975 KB` gzip. This is recorded for later performance/code-splitting work; it does not invalidate the runtime proof.
- Rapier emits an initialization deprecation warning in the test environment. Current behavior passes; remove the warning during a bounded dependency/API cleanup rather than expanding Phase 0.
- GitHub Actions currently warns that `actions/checkout@v4` and `actions/setup-node@v4` use deprecated internal Node 20 action runtimes. The runner forces Node 24 for those actions and the job passes. Treat this as CI maintenance, not a gameplay blocker.

## Gate result

**PASS. Phase 1 — Salvage Craft Flight is authorized.**

Passing Phase 0 proves the runtime foundation only. Every later phase retains its own falsification gate.
