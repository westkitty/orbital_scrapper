# OPERATIONAL STATE — ORBITAL SCRAPPER

project_id: `orbital_scrapper`
project_name: `Orbital Scrapper`
revision: 6
repository: `westkitty/orbital_scrapper`
default_branch: `main`

## Scope

Greenfield physics-driven salvage game governed by `BUILD_CONTRACT.md`, with execution sequencing governed by `IMPLEMENTATION_PLAN.md`.

## Current baseline

- `BUILD_CONTRACT.md` is the authoritative gameplay/build specification.
- `IMPLEMENTATION_PLAN.md` is the authoritative staged execution sequence for that contract.
- Phases 0, 1, 2, and 3 are implemented and verified on `main`.
- Current accepted runtime foundation: Three.js `0.185.0` + vanilla TypeScript `7.0.2` + Vite `8.2.1`, with `@dimforge/rapier3d-compat` `0.19.3` as physics authority.
- `docs/PHASE0_ARCHITECTURE.md` records the accepted Phase 0 architecture and proof.
- The current player-facing greybox is the Phase 3 salvage-craft cutter scene around the six-component modular wreck.
- No Phase 4+ gameplay system is verified yet.

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
- INV-019: Phase 3 cut eligibility is explicit connection metadata. Connections not designated cuttable must reject sever requests without changing bodies or live-joint state.
- INV-020: A completed cut removes exactly one live Rapier joint. It must not delete, hide, teleport, or replace the connected rigid bodies or wreck components.
- INV-021: Cutter progress advances through the fixed-step simulation path and requires valid range and aim. Incomplete progress is cleared when targeting conditions are lost, and a completed cut requires cutter release before another cut can begin.
- INV-022: Post-cut motion remains rigid-body simulation. The current greybox cutter uses a bounded equal-and-opposite release impulse after joint removal; separation is not scripted through transforms.

## Verified working behavior

### Phase 0 — Runtime, physics, and reset foundation

Originally verified by GitHub Actions `Phase 0 Runtime Gate`, run `32326833764`. Rechecked after Phase 3 by `Phase 0 Regression Gate`, run `32331609228`:

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

Originally verified by GitHub Actions `Phase 1 Flight Gate`, run `32328133794`. Rechecked after Phase 3 by `Phase 1 Regression Gate`, run `32331609216`:

- the craft remains a dynamic Rapier rigid body with a real collider, continuous collision detection, and no gravity in the flight test volume;
- held input exposes forward/reverse, strafe, vertical translation, pitch, yaw, roll, braking, and reset actions;
- translational thrust and rotational torque remain fixed-step rather than render-frame dependent;
- matched thirty-FPS and one-hundred-twenty-FPS render schedules produce equivalent fixed-step flight results;
- the controller-driven precision path still approaches, brakes to working distance, translates, retreats, rotates, and arrests angular motion without debug teleportation;
- coasting preserves momentum while braking materially reduces it;
- collision containment, reset cleanup, input lifecycle, and presenter lifecycle tests continue to pass;
- TypeScript checking and the production Vite build continue to pass.

The original Phase 1 browser smoke remains historical proof that live Chrome keyboard `W`, `Space`, and `X` drove thrust, braking, and reset. The Phase 1 regression workflow tests the preserved Phase 1 subsystem plus the current build rather than requiring obsolete Phase 1-specific screen text.

### Phase 2 — Modular wreck physics

Originally verified by GitHub Actions `Phase 2 Wreck Gate`, run `32328786755`. Rechecked after Phase 3 by `Phase 2 Regression Gate`, run `32331609248`:

- the reference wreck contains six dynamic wreck components with stable IDs: `spine`, `engine`, `panel`, `left-rail`, `right-rail`, and `rear-node`;
- the intact baseline contains six explicit Rapier fixed joints with stable connection IDs;
- components expose component type, mass class, and reusable local attachment-point metadata;
- the central spine carries a heavy engine, a light panel, and two rear rails; the rear junction has two separate physical connection paths back to the spine;
- the heavy engine has materially greater physical mass than the light panel;
- the intact wreck remains coherent through extended idle simulation with bounded joint-anchor error and no spontaneous velocity growth;
- the verified Phase 1 craft can approach, stop at useful distance, translate around, rotate near, and retreat from the live wreck without debug movement;
- direct craft impact transfers measurable momentum into the wreck while all six structural joints remain intact, all component transforms remain finite, and the assembly avoids solver explosion or disassembly;
- twenty repeated Phase 2 resets rebuild exactly one six-component/six-connection wreck with the same stable component and connection sets and restore the craft baseline;
- twenty repeated Phase 2 presentation rebuilds preserve exactly one presentation object per active physics body;
- TypeScript checking and the production Vite build continue to pass.

The original Phase 2 browser smoke remains historical proof of live approach, counter-thrust braking, retreat, and reset against the six-component wreck. The Phase 2 regression workflow now protects the intact-wreck subsystem while the player-facing scene has advanced to cutting.

### Phase 3 — Cutting and physical separation

Verified by GitHub Actions `Phase 3 Cutting Gate`, run `32331609212`:

- twenty-five of twenty-five combined Phase 0 through Phase 3 tests pass;
- exactly two existing wreck connections are designated cuttable in the Phase 3 proof fixture: `spine-panel` as `low-risk` and `spine-engine` as `large-mass`;
- non-cuttable branch structure such as `left-rail-rear` rejects sever requests and leaves all six live joints and all six wreck components intact;
- the cutter acquires live connection targets from current physical attachment points and enforces a nine-meter range plus an aim-alignment threshold;
- cutter progress advances at the fixed simulation step for a bounded greybox duration and resets when valid targeting/range conditions are lost before completion;
- a completed low-risk panel cut removes exactly the `spine-panel` Rapier joint while preserving all seven physics bodies and all six wreck components;
- a completed large-mass engine cut removes exactly the `spine-engine` Rapier joint while preserving the heavy engine as a dynamic physical body;
- both sides of a completed cut are awakened and remain under Rapier simulation;
- the current greybox cut applies a bounded equal-and-opposite release impulse after joint removal, producing measurable physical separation without transform scripting or component deletion;
- a completed cutter action latches until the player releases `C`, preventing one held input from cascading immediately into another cut;
- twelve repeated cut-then-reset cycles restore the exact original six connection IDs once each, clear sever history, and restore near-zero intact-joint error;
- the existing Phase 0–2 tests also pass in the same full Phase 3 suite;
- production TypeScript checking and Vite build pass;
- the built app initializes in headless Google Chrome with seven bodies, six wreck components, six live joints, and two designated cuttable joints;
- live Chrome keyboard input proves a short `C` hold interrupts without severing, a sustained `C` hold removes the panel joint, the severed panel develops measurable separation while all bodies remain, and `X` restores the exact six-joint baseline (`6 -> 5 -> 6`).

## Implemented but unverified

None for the current authorized phase boundary.

## Known not-working behavior

None established in the accepted Phase 0–3 scope.

## Known observations / deferred maintenance

- Phase 3 production JavaScript is approximately `2.785 MB` minified / `981.53 KB` gzip. Bundle reduction and code splitting remain deferred until they become relevant to a later performance gate; do not treat this as a Phase 3 failure.
- Rapier emits an initialization deprecation warning in tests. Behavior is verified; API cleanup remains deferred.
- GitHub Actions warns about deprecated internal Node 20 runtimes in `actions/checkout@v4` and `actions/setup-node@v4`; the hosted runner forces Node 24 and the gates pass. CI-action maintenance is deferred.
- Phase 1 handling constants remain accepted greybox proof values, not final tuning.
- Phase 2 wreck geometry, mass classes, and attachment positions are proof fixtures, not production content.
- Phase 3 cutter range, aim threshold, duration, cut classifications, and release-impulse values are greybox proof values rather than final game tuning.
- The first Phase 2 candidate renamed the managed presenter root and correctly failed the Phase 1 lifecycle regression test. The repair restored the protected root identity without changing wreck physics. Future presenter renames must migrate lifecycle proof deliberately rather than bypass it.

## Unknown / unresolved

- final distribution format
- final shipping control scheme beyond the current keyboard greybox controls
- final camera model beyond the current presentation-only chase camera
- art direction details and palette
- economy tuning
- simultaneous tether count beyond initial proof
- save format
- final production wreck module dimensions, masses, attachment layouts, and materials
- final cutter tuning, presentation, energy/heat model, and whether release impulse remains part of production cutting behavior

## Resolved decisions

- implementation runtime/platform foundation: browser-native Three.js application
- rendering foundation: Three.js `0.185.0` / `WebGLRenderer`
- physics foundation: `@dimforge/rapier3d-compat` `0.19.3`
- language/tooling foundation: TypeScript `7.0.2` + Vite `8.2.1`
- simulation timing: fixed-step owner targeting `1/60` second
- simulation authority: Rapier; Three.js presentation mirrors physics transforms
- Phase 1 flight authority: dynamic Rapier craft body controlled by fixed-step forces and torques
- Phase 1 braking model: bounded counter-force and counter-torque, preserving nonzero stopping distance
- current greybox controls: `W/S` thrust, `A/D` strafe, `R/F` vertical, arrow keys pitch/yaw, `Q/E` roll, `Space` brake, `C` cutter hold, `X` reset
- Phase 2 wreck authority: dynamic Rapier component bodies connected by explicit Rapier joints
- Phase 2 component identity: stable component IDs plus reusable local attachment-point IDs
- Phase 2 reference topology: six components and six physical joints, including two alternate rear load paths
- Phase 3 cut authority: successful cutting removes the selected live Rapier impulse joint; connected rigid bodies and component records remain in the simulation
- Phase 3 cuttable proof targets: `spine-panel` (`low-risk`) and `spine-engine` (`large-mass`); remaining reference-wreck joints are non-cuttable at this phase
- Phase 3 greybox cutter requirements: nine-meter maximum range, `0.92` aim cosine, and `0.75` seconds continuous valid hold before completion
- Phase 3 completion behavior: equal-and-opposite rigid-body release impulse plus wake-up, with cutter release required before another cut may begin

## Pending work

### Phase 4 — Tether manipulation and bracing

This is the only authorized next implementation phase under the current staged plan.

Required proof set:

- target and attach a tether to a physical wreck component or detached component;
- implement tether influence through a temporary Rapier constraint or bounded physical force rather than transform movement;
- support explicit tether release and clean constraint/force teardown;
- expose tension or a physically meaningful tension proxy;
- enforce a finite load limit with readable release, snap, overheat, or equivalent failure behavior rather than unlimited force;
- prove the tether can pull a detached object toward the ship;
- prove the tether can arrest or redirect a drifting detached object before collision;
- prove the tether can brace an attached wreck section before a cut;
- compare the same relevant cut with and without the brace and prove the tether materially changes the resulting motion;
- re-run the Phase 3 exact-joint cut, physical-separation, interruption, and reset path as the immediate regression check;
- preserve Phase 0–2 regression gates;
- do not begin structural-graph reasoning, scanner criticality, collapse escalation, cargo, economy, or production presentation until the Phase 4 gate passes.

## Staged implementation sequence

1. Phase 0 — Runtime, physics, and reset foundation — **verified**
2. Phase 1 — Salvage craft flight — **verified**
3. Phase 2 — Modular wreck physics — **verified**
4. Phase 3 — Cutting and physical separation — **verified**
5. Phase 4 — Tether manipulation and bracing — **authorized next**
6. Phase 5 — Structural graph synchronization — blocked by Phase 4
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
| VAL-000 | Runtime foundation is suitable | verified | Phase 0 runtime proof `32326833764`; current Phase 0 regression `32331609228` |
| VAL-001 | Full salvage loop works | pending | Direct runtime completion without debug controls |
| VAL-002 | Structural graph tracks physical cuts | pending | Runtime cut + graph/constraint inspection |
| VAL-003 | Dangerous cut produces simulated cascade | pending | Direct runtime observation |
| VAL-004 | Tether changes dangerous outcome | pending | Matched runtime comparison |
| VAL-005 | Reset is clean | verified through Phase 3 | Phase 0–3 repeated physics, connection, input, and presentation reset/lifecycle tests |
| VAL-006 | Progression changes next run | pending | Save/settlement runtime proof |
| VAL-007 | Phase gates are respected | verified through Phase 3 | Each phase remained isolated until its focused gate plus affected regressions passed |
| VAL-008 | Salvage craft flight is controllable | verified | Phase 1 proof `32328133794`; current Phase 1 regression `32331609216` |
| VAL-009 | Modular wreck remains coherent and stable | verified | Phase 2 proof `32328786755`; current Phase 2 regression `32331609248` |
| VAL-010 | Cutting removes the intended physical connection and produces natural separation | verified | Phase 3 run `32331609212`: valid/invalid targeting + interruption + panel/engine sever + body preservation + separation + reset + Chrome path |
| VAL-011 | Tether manipulation and bracing materially change physical outcomes | pending | Phase 4 pull/arrest/brace matched runtime comparisons plus cleanup/reset |

## Prohibitions

- Do not claim Phase 4+ gameplay systems are implemented or working before runtime evidence exists.
- Do not broaden first-playable scope before core-loop gates pass.
- Do not substitute scripted spectacle for structural simulation.
- Do not hand-roll a physics engine.
- Do not start a later implementation phase while the current phase gate is failed or unverified.
- Do not use production art, audio, or content expansion to mask unresolved greybox gameplay or physics failures.
- Do not move physics authority into Three.js presentation transforms.
- Do not replace physical craft movement with free-camera translation or direct transform movement.
- Do not treat physical connection metadata as the structural graph; graph reasoning begins only after the tether phase is verified.
- Do not delete components to simulate a successful cut; completed cuts remove joints and leave physical bodies in simulation.
- Do not implement tether movement by teleporting or directly setting component transforms; Phase 4 must influence motion through Rapier constraints or bounded physical forces.

## Revision history

### Revision 6 — 2026-08-20

Phase 3 passed `Phase 3 Cutting Gate` run `32331609212`, while `Phase 0 Regression Gate` run `32331609228`, `Phase 1 Regression Gate` run `32331609216`, and `Phase 2 Regression Gate` run `32331609248` also passed. Promoted explicit cuttable-connection classification, fixed-step target/range/aim cutter progression, interruption behavior, exact Rapier joint removal, body preservation, low-risk panel and large-mass engine cuts, bounded physical post-cut separation, single-shot cutter latching, repeated cut/reset reconstruction, production build, and live Chrome interrupted-hold/cut/separation/reset behavior to verified state. The verified implementation was squash-merged to `main` as `506c65d9838ff8472ae9b36f0b161dc4da5a0164`. Phase 4 — Tether Manipulation and Bracing is now the only authorized implementation phase.

### Revision 5 — 2026-08-19

Phase 2 passed `Phase 2 Wreck Gate` run `32328786755`, while `Phase 0 Regression Gate` run `32328786741` and `Phase 1 Regression Gate` run `32328786748` also passed. Promoted the six-component/six-joint reference wreck, stable component/attachment identity, alternate rear load paths, intact-wreck coherence, craft-to-wreck collision stability, exact repeated reset, presentation cleanup, production build, and live Chrome approach/brake/retreat/reset path to verified state. The first Phase 2 candidate correctly failed the Phase 1 presenter-lifecycle regression after renaming a managed root; the root identity was restored and the complete gate set reran green. The verified implementation was squash-merged to `main` as `8f743595bcd576a5a811a4ec18522a07c94b54d6`. Phase 3 — Cutting and Physical Separation became the only authorized implementation phase.

### Revision 4 — 2026-08-19

Phase 1 passed `Phase 1 Flight Gate` run `32328133794` and the affected Phase 0 foundation simultaneously passed `Phase 0 Regression Gate` run `32328133855`. Promoted dynamic six-axis craft flight, inertial coasting, bounded counter-thrust braking, collision containment, moving-obstacle course behavior, diagnostics, repeated reset/presentation cleanup, production build, and live Chrome keyboard thrust/brake/reset to verified state. The verified Phase 1 implementation was squash-merged to `main` as commit `03a6f25f36394e9c8a8ab0229a331eaf15e5240e`.

### Revision 3 — 2026-08-19

Phase 0 passed its full verification gate and was merged to `main`. Accepted the Three.js + Rapier + TypeScript/Vite runtime foundation, promoted fixed-step physics, runtime joint lifecycle, repeated reset cleanup, listener cleanup, production build, and headless-browser initialization to verified state, recorded nonblocking bundle/API/CI maintenance observations, and authorized Phase 1.

### Revision 2 — 2026-08-19

Added `IMPLEMENTATION_PLAN.md` as the authoritative execution sequence beneath `BUILD_CONTRACT.md`. Replaced the broad pending technical-proof bucket with a staggered Phase 0-12 dependency chain. Added phase-gate and greybox-before-polish invariants.

### Revision 1 — 2026-08-19

Initialized from the user's concept and the authoritative `BUILD_CONTRACT.md`. Repository was empty before this project specification pass. All gameplay/runtime states remained pending or unknown until implementation evidence existed.
