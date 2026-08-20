# OPERATIONAL STATE — ORBITAL SCRAPPER

project_id: `orbital_scrapper`
project_name: `Orbital Scrapper`
revision: 5
repository: `westkitty/orbital_scrapper`
default_branch: `main`

## Scope

Greenfield physics-driven salvage game governed by `BUILD_CONTRACT.md`, with execution sequencing governed by `IMPLEMENTATION_PLAN.md`.

## Current baseline

- `BUILD_CONTRACT.md` is the authoritative gameplay/build specification.
- `IMPLEMENTATION_PLAN.md` is the authoritative staged execution sequence for that contract.
- Phases 0, 1, and 2 are implemented and verified on `main`.
- Current accepted runtime foundation: Three.js `0.185.0` + vanilla TypeScript `7.0.2` + Vite `8.2.1`, with `@dimforge/rapier3d-compat` `0.19.3` as physics authority.
- `docs/PHASE0_ARCHITECTURE.md` records the accepted Phase 0 architecture and proof.
- The current player-facing greybox is the Phase 2 salvage-craft approach around one six-component modular wreck.
- No Phase 3+ gameplay system is verified yet.

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
- INV-016: Wreck modules use stable component IDs and reusable component-local attachment points. Physical Rapier joints are the current authority for intact wreck connectivity.
- INV-017: The Phase 2 reference wreck contains genuine alternate physical load paths from the central spine to the rear junction; no structural-graph interpretation is claimed until Phase 5.
- INV-018: Presenter lifecycle uniqueness remains regression-protected. Internal managed-root identity must not be changed casually without equivalent cleanup proof and a deliberate test migration.

## Verified working behavior

### Phase 0 — Runtime, physics, and reset foundation

Originally verified by GitHub Actions `Phase 0 Runtime Gate`, run `32326833764`. Rechecked after Phase 2 by `Phase 0 Regression Gate`, run `32328786741`:

- exact declared Three.js, Rapier, TypeScript, and Vite dependencies install successfully;
- the fixed-step simulation target remains approximately `1/60` second within expected numeric precision;
- gravity and collision move a free rigid body downward and prevent it passing through the test ground;
- one fixed bridge constraint can be removed and recreated at runtime;
- twenty repeated Phase 0 physics resets preserve exact active-body and active-constraint counts;
- twenty Phase 0 presentation rebuilds preserve the managed Three.js scene-root/object count;
- Phase 0 input bindings attach idempotently and detach cleanly;
- TypeScript checking and the production Vite build continue to pass.

The original Phase 0 browser smoke remains historical proof that the Phase 0 built app initialized in Chrome with four bodies and one active constraint. The current Phase 0 regression workflow intentionally no longer requires Phase 0-specific demo UI because the player-facing application has advanced.

### Phase 1 — Salvage craft flight

Originally verified by GitHub Actions `Phase 1 Flight Gate`, run `32328133794`. Rechecked after Phase 2 by `Phase 1 Regression Gate`, run `32328786748`:

- the craft remains a dynamic Rapier rigid body with a real collider, continuous collision detection, and no gravity in the flight test volume;
- held input exposes forward/reverse, strafe, vertical translation, pitch, yaw, roll, braking, and reset actions;
- translational thrust and rotational torque remain fixed-step rather than render-frame dependent;
- matched thirty-FPS and one-hundred-twenty-FPS render schedules produce equivalent fixed-step flight results;
- the controller-driven precision path still approaches, brakes to working distance, translates, retreats, rotates, and arrests angular motion without debug teleportation;
- coasting preserves momentum while braking materially reduces it;
- collision containment, reset cleanup, input lifecycle, and presenter lifecycle tests continue to pass;
- TypeScript checking and the production Vite build continue to pass.

The original Phase 1 browser smoke remains historical proof that live Chrome keyboard `W`, `Space`, and `X` drove thrust, braking, and reset. The Phase 1 regression workflow now tests the preserved Phase 1 subsystem plus the current build rather than requiring obsolete Phase 1-specific screen text.

### Phase 2 — Modular wreck physics

Verified by GitHub Actions `Phase 2 Wreck Gate`, run `32328786755`:

- twenty of twenty combined Phase 0 through Phase 2 tests pass;
- the reference wreck contains six dynamic wreck components with stable IDs: `spine`, `engine`, `panel`, `left-rail`, `right-rail`, and `rear-node`;
- the wreck contains six explicit Rapier fixed joints with stable connection IDs;
- components expose component type, mass class, and reusable local attachment-point metadata;
- the central spine carries a heavy engine, a light panel, and two rear rails; the rear junction has two separate physical connection paths back to the spine;
- the heavy engine has materially greater physical mass than the light panel;
- the intact wreck remains coherent through extended idle simulation with bounded joint-anchor error and no spontaneous velocity growth;
- the verified Phase 1 craft can approach, stop at useful distance, translate around, rotate near, and retreat from the live wreck without debug movement;
- direct craft impact transfers measurable momentum into the wreck while all six structural joints remain intact, all component transforms remain finite, and the assembly avoids solver explosion or disassembly;
- twenty repeated Phase 2 resets rebuild exactly one six-component/six-connection wreck with the same stable component and connection sets and restore the craft baseline;
- twenty repeated Phase 2 presentation rebuilds preserve exactly one presentation object per active physics body;
- production TypeScript checking and Vite build pass;
- the built application initializes in headless Google Chrome with seven active physics bodies, six wreck modules, and six live structural joints;
- live Chrome keyboard input proves approach, counter-thrust braking, retreat, and reset against the current Phase 2 wreck scene.

## Implemented but unverified

None for the current authorized phase boundary.

## Known not-working behavior

None established in the accepted Phase 0–2 scope.

## Known observations / deferred maintenance

- Phase 2 production JavaScript is approximately `2.78 MB` minified / `979 KB` gzip. Bundle reduction and code splitting remain deferred until they become relevant to a later performance gate; do not treat this as a Phase 2 failure.
- Rapier emits an initialization deprecation warning in tests. Behavior is verified; API cleanup remains deferred.
- GitHub Actions warns about deprecated internal Node 20 runtimes in `actions/checkout@v4` and `actions/setup-node@v4`; the hosted runner forces Node 24 and the gates pass. CI-action maintenance is deferred.
- Phase 1 handling constants remain accepted greybox proof values, not final tuning.
- Phase 2 wreck geometry, mass classes, and attachment positions are proof fixtures, not production content.
- The first Phase 2 candidate renamed the managed presenter root and correctly failed the Phase 1 lifecycle regression test. The repair restored the protected root identity without changing wreck physics, and all three gates then passed. Future presenter renames must migrate lifecycle proof deliberately rather than bypass it.

## Unknown / unresolved

- final distribution format
- final shipping control scheme beyond the current keyboard greybox controls
- final camera model beyond the current presentation-only chase camera
- art direction details and palette
- economy tuning
- simultaneous tether count beyond initial proof
- save format
- final production wreck module dimensions, masses, attachment layouts, and materials

## Resolved decisions

- implementation runtime/platform foundation: browser-native Three.js application
- rendering foundation: Three.js `0.185.0` / `WebGLRenderer`
- physics foundation: `@dimforge/rapier3d-compat` `0.19.3`
- language/tooling foundation: TypeScript `7.0.2` + Vite `8.2.1`
- simulation timing: fixed-step owner targeting `1/60` second
- simulation authority: Rapier; Three.js presentation mirrors physics transforms
- Phase 1 flight authority: dynamic Rapier craft body controlled by fixed-step forces and torques
- Phase 1 braking model: bounded counter-force and counter-torque, preserving nonzero stopping distance
- current greybox controls: `W/S` thrust, `A/D` strafe, `R/F` vertical, arrow keys pitch/yaw, `Q/E` roll, `Space` brake, `X` reset
- Phase 2 wreck authority: dynamic Rapier component bodies connected by explicit Rapier joints
- Phase 2 component identity: stable component IDs plus reusable local attachment-point IDs
- Phase 2 reference topology: six components and six physical joints, including two alternate rear load paths

## Pending work

### Phase 3 — Cutting and physical separation

This is the only authorized next implementation phase under the current staged plan.

Required proof set:

- classify which existing wreck connections are valid cut targets without changing arbitrary mesh geometry;
- expose minimal targeting sufficient to select a valid connection point;
- enforce cutter range/aim requirements and one bounded duration, heat, energy, or equivalent pacing rule;
- completing a cut must remove the corresponding live Rapier joint rather than deleting the connected component;
- newly unconstrained bodies must remain in the world and respond through normal physics;
- provide minimal feedback sufficient to understand targeting, progress, interruption, and completion;
- configure at least one low-risk cut and one larger-mass cut on the verified Phase 2 reference wreck;
- prove invalid/non-cuttable targets cannot sever structure;
- prove the correct physical constraint is removed when the cut completes;
- prove the detached component or section separates through normal simulation rather than scripted disappearance;
- prove cutting is interruptible by loss of the required targeting/range condition when that rule is active;
- prove reset restores every original Phase 2 connection exactly once;
- re-run the intact-wreck stability path before cutting as the Phase 2 regression check;
- do not begin tether gameplay, structural-graph reasoning, scanner criticality, collapse escalation, cargo, economy, or production presentation until the Phase 3 gate passes.

## Staged implementation sequence

1. Phase 0 — Runtime, physics, and reset foundation — **verified**
2. Phase 1 — Salvage craft flight — **verified**
3. Phase 2 — Modular wreck physics — **verified**
4. Phase 3 — Cutting and physical separation — **authorized next**
5. Phase 4 — Tether manipulation and bracing — blocked by Phase 3
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
| VAL-000 | Runtime foundation is suitable | verified | Phase 0 runtime proof `32326833764`; current Phase 0 regression `32328786741` |
| VAL-001 | Full salvage loop works | pending | Direct runtime completion without debug controls |
| VAL-002 | Structural graph tracks physical cuts | pending | Runtime cut + graph/constraint inspection |
| VAL-003 | Dangerous cut produces simulated cascade | pending | Direct runtime observation |
| VAL-004 | Tether changes dangerous outcome | pending | Matched runtime comparison |
| VAL-005 | Reset is clean | verified through Phase 2 | Phase 0, Phase 1, and Phase 2 repeated physics/presentation reset tests |
| VAL-006 | Progression changes next run | pending | Save/settlement runtime proof |
| VAL-007 | Phase gates are respected | verified through Phase 2 | Each phase remained isolated until its focused gate plus affected regressions passed |
| VAL-008 | Salvage craft flight is controllable | verified | Phase 1 proof `32328133794`; current Phase 1 regression `32328786748` |
| VAL-009 | Modular wreck remains coherent and stable | verified | Phase 2 run `32328786755`: topology + idle stability + craft impact + exact reset + Chrome path |
| VAL-010 | Cutting removes the intended physical connection and produces natural separation | pending | Phase 3 low-risk/large-mass cuts + invalid-target protection + reset |

## Prohibitions

- Do not claim Phase 3+ gameplay systems are implemented or working before runtime evidence exists.
- Do not broaden first-playable scope before core-loop gates pass.
- Do not substitute scripted spectacle for structural simulation.
- Do not hand-roll a physics engine.
- Do not start a later implementation phase while the current phase gate is failed or unverified.
- Do not use production art, audio, or content expansion to mask unresolved greybox gameplay or physics failures.
- Do not move physics authority into Three.js presentation transforms.
- Do not replace physical craft movement with free-camera translation or direct transform movement.
- Do not treat Phase 2 physical connection metadata as the structural graph; graph reasoning is a later phase.
- Do not delete components to simulate a successful cut; Phase 3 must remove joints and leave physical bodies in simulation.

## Revision history

### Revision 5 — 2026-08-19

Phase 2 passed `Phase 2 Wreck Gate` run `32328786755`, while `Phase 0 Regression Gate` run `32328786741` and `Phase 1 Regression Gate` run `32328786748` also passed. Promoted the six-component/six-joint reference wreck, stable component/attachment identity, alternate rear load paths, intact-wreck coherence, craft-to-wreck collision stability, exact repeated reset, presentation cleanup, production build, and live Chrome approach/brake/retreat/reset path to verified state. The first Phase 2 candidate correctly failed the Phase 1 presenter-lifecycle regression after renaming a managed root; the root identity was restored and the complete gate set reran green. The verified implementation was squash-merged to `main` as `8f743595bcd576a5a811a4ec18522a07c94b54d6`. Phase 3 — Cutting and Physical Separation is now the only authorized implementation phase.

### Revision 4 — 2026-08-19

Phase 1 passed `Phase 1 Flight Gate` run `32328133794` and the affected Phase 0 foundation simultaneously passed `Phase 0 Regression Gate` run `32328133855`. Promoted dynamic six-axis craft flight, inertial coasting, bounded counter-thrust braking, collision containment, moving-obstacle course behavior, diagnostics, repeated reset/presentation cleanup, production build, and live Chrome keyboard thrust/brake/reset to verified state. The verified Phase 1 implementation was squash-merged to `main` as commit `03a6f25f36394e9c8a8ab0229a331eaf15e5240e`.

### Revision 3 — 2026-08-19

Phase 0 passed its full verification gate and was merged to `main`. Accepted the Three.js + Rapier + TypeScript/Vite runtime foundation, promoted fixed-step physics, runtime joint lifecycle, repeated reset cleanup, listener cleanup, production build, and headless-browser initialization to verified state, recorded nonblocking bundle/API/CI maintenance observations, and authorized Phase 1.

### Revision 2 — 2026-08-19

Added `IMPLEMENTATION_PLAN.md` as the authoritative execution sequence beneath `BUILD_CONTRACT.md`. Replaced the broad pending technical-proof bucket with a staggered Phase 0-12 dependency chain. Added phase-gate and greybox-before-polish invariants.

### Revision 1 — 2026-08-19

Initialized from the user's concept and the authoritative `BUILD_CONTRACT.md`. Repository was empty before this project specification pass. All gameplay/runtime states remained pending or unknown until implementation evidence existed.
