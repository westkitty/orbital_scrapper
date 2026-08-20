# OPERATIONAL STATE — ORBITAL SCRAPPER

project_id: `orbital_scrapper`
project_name: `Orbital Scrapper`
revision: 4
repository: `westkitty/orbital_scrapper`
default_branch: `main`

## Scope

Greenfield physics-driven salvage game governed by `BUILD_CONTRACT.md`, with execution sequencing governed by `IMPLEMENTATION_PLAN.md`.

## Current baseline

- `BUILD_CONTRACT.md` is the authoritative gameplay/build specification.
- `IMPLEMENTATION_PLAN.md` is the authoritative staged execution sequence for that contract.
- Phases 0 and 1 are implemented and verified on `main`.
- Current accepted runtime foundation: Three.js `0.185.0` + vanilla TypeScript `7.0.2` + Vite `8.2.1`, with `@dimforge/rapier3d-compat` `0.19.3` as physics authority.
- `docs/PHASE0_ARCHITECTURE.md` records the accepted Phase 0 architecture and proof.
- The current player-facing greybox is the Phase 1 salvage-craft flight course.
- No Phase 2+ gameplay system is verified yet.

## Artifact contract

Build the smallest convincing playable salvage loop:

scan -> tether -> cut -> extract -> survive/escape collapse -> sell salvage -> upgrade -> next run.

The structural model must pair a physical rigid-body/constraint representation with a synchronized structural graph. Physics creates actual motion and collapse; the graph provides explainable structural reasoning and scanner criticality.

Implementation must advance one gated phase at a time. A later phase must not depend on an unproven major system from an earlier phase.

## Active invariants

- INV-001: Structural failure is physics-driven rather than replaced by canned collapse sequences.
- INV-002: Scanner information reflects current wreck structure rather than static authored labels alone.
- INV-003: Tethers can materially affect structural outcomes, including bracing.
- INV-004: Cutting severs explicit modular connections; arbitrary mesh slicing is not required.
- INV-005: Cargo remains physically hazardous until secured or safely settled.
- INV-006: Risk primarily comes from geometry, attachment, mass, momentum, and player decisions.
- INV-007: First playable scope excludes combat, multiplayer, EVA, base building, crafting trees, large narrative systems, and procedural galaxy scope.
- INV-008: Repeated runs/resets must not leak physics bodies, constraints, event listeners, or audio instances.
- INV-009: A passing build alone is insufficient proof of gameplay behavior; interaction claims require runtime evidence.
- INV-010: Development proceeds through the gated sequence in `IMPLEMENTATION_PLAN.md`; failed or unverified phase gates are not silently carried forward.
- INV-011: Production presentation must not precede or conceal unresolved core-physics and interaction failures; greybox is acceptable through the complete vertical-slice proof.
- INV-012: Rapier owns authoritative rigid-body/constraint state; Three.js mirrors presentation state and must not become a second physics authority.
- INV-013: Physics advances through the fixed-step simulation owner rather than render-frame-dependent forces.
- INV-014: Salvage-craft translation and rotation are applied to the dynamic Rapier body through the fixed-step path; the chase camera and Three.js craft mesh remain presentation-only.
- INV-015: Flight braking is counter-force/counter-torque behavior that preserves momentum and stopping distance rather than instantaneous velocity cancellation or transform teleportation.

## Verified working behavior

### Phase 0 — Runtime, physics, and reset foundation

Originally verified by GitHub Actions `Phase 0 Runtime Gate`, run `32326833764`, and rechecked after Phase 1 by `Phase 0 Regression Gate`, run `32328133855`:

- exact declared Three.js, Rapier, TypeScript, and Vite dependencies install successfully;
- the Phase 0 fixed-step simulation target remains approximately `1/60` second within expected numeric precision;
- gravity and collision move a free rigid body downward and prevent it passing through the test ground;
- one fixed bridge constraint can be removed and recreated at runtime;
- twenty repeated Phase 0 physics resets preserve exact active-body and active-constraint counts;
- twenty Phase 0 presentation rebuilds preserve the managed Three.js scene-root/object count;
- Phase 0 input bindings attach idempotently and detach cleanly;
- TypeScript checking and the production Vite build continue to pass.

The original Phase 0 browser smoke remains historical proof that the Phase 0 built app initialized in Chrome with four bodies and one active constraint. The current Phase 0 regression workflow intentionally no longer requires Phase 0-specific demo UI because the player-facing application has advanced to Phase 1.

### Phase 1 — Salvage craft flight

Verified by GitHub Actions `Phase 1 Flight Gate`, run `32328133794`:

- fourteen of fourteen combined Phase 0 + Phase 1 tests pass;
- the craft is a dynamic Rapier rigid body with a real collider, continuous collision detection, and no gravity in the flight test volume;
- held input exposes forward/reverse, strafe, vertical translation, pitch, yaw, roll, braking, and reset actions;
- translational thrust and rotational torque are applied through the fixed-step simulation owner rather than render-frame timing;
- matched thirty-FPS and one-hundred-twenty-FPS render schedules produce the same one-hundred-twenty physics steps and materially equivalent flight results;
- a direct controller-driven precision path approaches the target, carries inertial speed, brakes to a controlled stop at useful working distance, translates laterally, stops again, retreats, rotates, and arrests angular motion without debug teleportation;
- coasting preserves substantial momentum while braking materially reduces it, proving stopping is not instantaneous;
- sustained lateral thrust cannot tunnel the craft through the fixed side-wall obstacle;
- the greybox course includes stationary gate geometry, a narrow navigation path, a target, and a kinematic moving obstacle whose motion is verified;
- twenty repeated Phase 1 physics resets restore the exact craft baseline and preserve active-body/constraint counts;
- twenty repeated Phase 1 presentation rebuilds preserve exactly one managed scene root with one presentation object per physics record;
- production TypeScript checking and Vite build pass;
- the built app initializes in headless Google Chrome with eight physics bodies;
- Chrome DevTools Protocol keyboard events prove the real browser path: `W` produces forward thrust, `Space` materially brakes the moving craft, and `X` restores the flight baseline.

## Implemented but unverified

None for the current authorized phase boundary.

## Known not-working behavior

None established in the accepted Phase 0–1 scope.

## Known observations / deferred maintenance

- Phase 1 production JavaScript is approximately `2.77 MB` minified / `979 KB` gzip. Bundle reduction and code splitting remain deferred until they become relevant to a later performance gate; do not treat this as a Phase 1 failure.
- Rapier emits an initialization deprecation warning in tests. Behavior is verified; API cleanup remains deferred.
- GitHub Actions warns about deprecated internal Node 20 runtimes in `actions/checkout@v4` and `actions/setup-node@v4`; the hosted runner forces Node 24 and both Phase 0 regression and Phase 1 gates pass. CI-action maintenance is deferred.
- Phase 1 handling constants are accepted greybox proof values, not final tuning. The automated precision path and live keyboard path are verified; later player-feel tuning must preserve the same inertial and fixed-step invariants.

## Unknown / unresolved

- final distribution format
- final shipping control scheme beyond the current Phase 1 keyboard greybox controls
- final camera model beyond the current presentation-only chase camera
- art direction details and palette
- economy tuning
- simultaneous tether count beyond initial proof
- save format

## Resolved decisions

- implementation runtime/platform foundation: browser-native Three.js application
- rendering foundation: Three.js `0.185.0` / `WebGLRenderer`
- physics foundation: `@dimforge/rapier3d-compat` `0.19.3`
- language/tooling foundation: TypeScript `7.0.2` + Vite `8.2.1`
- simulation timing: fixed-step owner targeting `1/60` second
- simulation authority: Rapier; Three.js presentation mirrors physics transforms
- Phase 1 flight authority: dynamic Rapier craft body controlled by fixed-step forces and torques
- Phase 1 braking model: bounded counter-force and counter-torque, preserving nonzero stopping distance
- Phase 1 greybox test controls: `W/S` thrust, `A/D` strafe, `R/F` vertical, arrow keys pitch/yaw, `Q/E` roll, `Space` brake, `X` reset

## Pending work

### Phase 2 — Modular wreck physics

This is the only authorized next implementation phase under the current staged plan.

Required proof set:

- define the minimal wreck-component data model with stable component IDs and reusable attachment points;
- create several greybox component types with different mass/shape profiles;
- assemble one compact modular wreck using explicit Rapier joints/constraints and simple stable colliders;
- include a central structural spine, a heavy attached component, a light attached component, and at least one branch with an alternate connection path;
- use sleeping/inactive behavior where appropriate without making the wreck a kinematic fake;
- prove the intact wreck behaves as one coherent connected assembly;
- prove component transforms, IDs, and connections remain stable through normal simulation;
- prove collisions with the verified player craft do not immediately destabilize or explode the assembly through solver failure;
- prove reset rebuilds exactly one wreck with the original component/connection set;
- repeat the verified Phase 1 precision approach and retreat around the live wreck as the regression check;
- do not begin cutting, tether gameplay, structural-graph reasoning, scanner logic, collapse systems, cargo, economy, or production presentation until the Phase 2 gate passes.

## Staged implementation sequence

1. Phase 0 — Runtime, physics, and reset foundation — **verified**
2. Phase 1 — Salvage craft flight — **verified**
3. Phase 2 — Modular wreck physics — **authorized next**
4. Phase 3 — Cutting and physical separation — blocked by Phase 2
5. Phase 4 — Tether manipulation and bracing — blocked
6. Phase 5 — Structural graph synchronization — blocked
7. Phase 6 — Scanner and structural criticality — blocked
8. Phase 7 — Collapse escalation and survival damage — blocked
9. Phase 8 — Cargo capture, condition, and settlement — blocked
10. Phase 9 — Upgrade, persistence, and complete vertical slice — blocked
11. Phase 10 — Wreck variety and progression breadth — blocked
12. Phase 11 — Production readability, visual assets, audio, and feel — blocked
13. Phase 12 — Performance, endurance, accessibility, and release readiness — blocked

Each phase requires focused direct testing plus the smallest relevant regression check before the next phase begins.

## Validation matrix

| ID | Claim | State | Required proof |
|---|---|---|---|
| VAL-000 | Runtime foundation is suitable | verified | Phase 0 CI run `32326833764`, rechecked by Phase 0 Regression Gate `32328133855` |
| VAL-001 | Full salvage loop works | pending | Direct runtime completion without debug controls |
| VAL-002 | Structural graph tracks physical cuts | pending | Runtime cut + graph/constraint inspection |
| VAL-003 | Dangerous cut produces simulated cascade | pending | Direct runtime observation |
| VAL-004 | Tether changes dangerous outcome | pending | Matched runtime comparison |
| VAL-005 | Reset is clean | verified through Phase 1 | Phase 0 and Phase 1 twenty-reset physics/presentation tests plus listener lifecycle tests |
| VAL-006 | Progression changes next run | pending | Save/settlement runtime proof |
| VAL-007 | Phase gates are respected | verified through Phase 1 | Phase 0 and Phase 1 each remained isolated until their focused CI gates passed |
| VAL-008 | Salvage craft flight is controllable | verified | Phase 1 CI run `32328133794`: fixed-step + precision path + collision + reset + live Chrome keyboard proof |
| VAL-009 | Modular wreck remains coherent and stable | pending | Phase 2 intact-wreck runtime test + player-collision regression + exact reset |

## Prohibitions

- Do not claim Phase 2+ gameplay systems are implemented or working before runtime evidence exists.
- Do not broaden first-playable scope before core-loop gates pass.
- Do not substitute scripted spectacle for structural simulation.
- Do not hand-roll a physics engine.
- Do not start a later implementation phase while the current phase gate is failed or unverified.
- Do not use production art, audio, or content expansion to mask unresolved greybox gameplay or physics failures.
- Do not move physics authority into Three.js presentation transforms.
- Do not replace physical craft movement with free-camera translation or direct transform movement.

## Revision history

### Revision 4 — 2026-08-19

Phase 1 passed `Phase 1 Flight Gate` run `32328133794` and the affected Phase 0 foundation simultaneously passed `Phase 0 Regression Gate` run `32328133855`. Promoted dynamic six-axis craft flight, inertial coasting, bounded counter-thrust braking, collision containment, moving-obstacle course behavior, diagnostics, repeated reset/presentation cleanup, production build, and live Chrome keyboard thrust/brake/reset to verified state. The verified Phase 1 implementation was squash-merged to `main` as commit `03a6f25f36394e9c8a8ab0229a331eaf15e5240e`. Phase 2 — Modular Wreck Physics is now the only authorized implementation phase.

### Revision 3 — 2026-08-19

Phase 0 passed its full verification gate and was merged to `main`. Accepted the Three.js + Rapier + TypeScript/Vite runtime foundation, promoted fixed-step physics, runtime joint lifecycle, repeated reset cleanup, listener cleanup, production build, and headless-browser initialization to verified state, recorded nonblocking bundle/API/CI maintenance observations, and authorized Phase 1 — Salvage Craft Flight as the only next implementation phase.

### Revision 2 — 2026-08-19

Added `IMPLEMENTATION_PLAN.md` as the authoritative execution sequence beneath `BUILD_CONTRACT.md`. Replaced the broad pending technical-proof bucket with a staggered Phase 0-12 dependency chain. Added phase-gate and greybox-before-polish invariants. All runtime behavior remained pending because no implementation evidence existed yet.

### Revision 1 — 2026-08-19

Initialized from the user's concept and the authoritative `BUILD_CONTRACT.md`. Repository was empty before this project specification pass. All gameplay/runtime states remained pending or unknown until implementation evidence existed.
