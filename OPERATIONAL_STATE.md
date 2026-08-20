# OPERATIONAL STATE — ORBITAL SCRAPPER

project_id: `orbital_scrapper`
project_name: `Orbital Scrapper`
revision: 9
repository: `westkitty/orbital_scrapper`
default_branch: `main`

## Scope

Greenfield physics-driven salvage game governed by `BUILD_CONTRACT.md`, with execution sequencing governed by `IMPLEMENTATION_PLAN.md`.

## Current baseline

- `BUILD_CONTRACT.md` is the authoritative gameplay/build specification.
- `IMPLEMENTATION_PLAN.md` is the authoritative staged execution sequence for that contract.
- Phases 0, 1, 2, 3, 4, 5, and 6 are implemented and verified on `main`.
- Current accepted runtime foundation: Three.js `0.185.0` + vanilla TypeScript `7.0.2` + Vite `8.2.1`, with `@dimforge/rapier3d-compat` `0.19.3` as physics authority.
- `docs/PHASE0_ARCHITECTURE.md` records the accepted Phase 0 architecture and proof.
- The current player-facing greybox is the Phase 6 salvage-craft scanner/cutter/tether scene with synchronized structural-graph diagnostics around the six-component modular wreck.
- No Phase 7+ gameplay system is verified yet.

## Artifact contract

Build the smallest convincing playable salvage loop:

scan -> tether -> cut -> extract -> survive/escape collapse -> sell salvage -> upgrade -> next run.

The structural model pairs a physical rigid-body/constraint representation with a synchronized structural graph. Physics owns actual motion and collapse. The graph mirrors current topology and temporary support state. The scanner derives explainable estimates from current graph and physical state but does not become an authority over either.

Implementation advances one gated phase at a time. A later phase must not depend on an unproven major system from an earlier phase.

## Active invariants

- INV-001: Structural failure is physics-driven rather than replaced by canned collapse sequences.
- INV-002: Scanner information must reflect current wreck structure rather than static authored labels alone.
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
- INV-016: Wreck modules use stable component IDs and reusable component-local attachment points. Physical Rapier joints are the authority for intact wreck connectivity.
- INV-017: The Phase 2 reference wreck contains genuine alternate physical load paths from the central spine to the rear junction.
- INV-018: Presenter lifecycle uniqueness remains regression-protected. Internal managed-root identity must not be changed casually without equivalent cleanup proof and a deliberate test migration.
- INV-019: Cut eligibility is explicit connection metadata. Connections not designated cuttable must reject sever requests without changing bodies or live-joint state.
- INV-020: A completed cut removes exactly one live Rapier joint. It must not delete, hide, teleport, or replace the connected rigid bodies or wreck components.
- INV-021: Cutter progress advances through the fixed-step simulation path and requires valid range and aim. Incomplete progress clears when targeting conditions are lost, and a completed cut requires cutter release before another cut can begin.
- INV-022: Post-cut motion remains rigid-body simulation. The current greybox cutter uses a bounded equal-and-opposite release impulse after joint removal; separation is not scripted through transforms.
- INV-023: Tether manipulation acts through bounded equal-and-opposite Rapier impulses advanced on the fixed-step path. Tether gameplay must not translate, teleport, or directly pose wreck components.
- INV-024: Tether load is finite and observable. Demand above the configured proof limit releases/snaps rather than applying unlimited force, and the tether requires input release before re-engagement after overload.
- INV-025: Tether release and reset are explicit lifecycle boundaries: releasing the control removes active tether influence immediately, and reset restores an idle tether plus the exact physical wreck baseline.
- INV-026: Post-cut auto-targeting may favor the recorded removable side of the severed connection, but that convention must not masquerade as topology reasoning.
- INV-027: `StructuralGraph` is a derived, synchronized mirror of current `WreckSandbox` component and connection identity/metadata. It is not a second physics authority and does not own transforms, velocities, joints, or body lifecycle.
- INV-028: Permanent structural-graph edges correspond exactly to current live physical connections. A completed cut removes the graph edge only because the physical joint is gone; component nodes remain while their physical components remain.
- INV-029: Active tether braces are represented as temporary support records separate from permanent wreck topology. Adding or removing a brace must not create, delete, or mutate permanent graph edges.
- INV-030: Topology queries such as connected sections, bridges, and articulation components are explainable graph facts rather than physical authority.
- INV-031: `ScannerSystem` is a read-only derived interpretation of synchronized graph state plus current Rapier-backed component mass/motion and temporary support state. Scanner output must never create, remove, move, or constrain a body, joint, graph node, graph edge, or tether support.
- INV-032: Scanner criticality is explicitly an estimate, not an oracle. Every locked prediction must expose inspectable reasons derived from current live signals, and a no-target state must withhold a risk assertion.
- INV-033: Scanner freshness is tied to current live topology. Once a physical joint is removed and the graph edge disappears, that removed connection must not remain a valid scanner target or retain a stale risk estimate.
- INV-034: Temporary tether support may reduce a scanner estimate only while the corresponding support is currently represented in the graph support lane. Releasing or losing that support must update the estimate without mutating permanent wreck topology.

## Verified working behavior

### Phase 0 — Runtime, physics, and reset foundation

Originally verified by GitHub Actions `Phase 0 Runtime Gate`, run `32326833764`. Rechecked after Phase 6 by `Phase 0 Regression Gate`, run `32338441777`:

- exact declared Three.js, Rapier, TypeScript, and Vite dependencies install successfully;
- the fixed-step simulation target remains approximately `1/60` second within expected numeric precision;
- gravity and collision move a free rigid body downward and prevent it passing through the test ground;
- one fixed bridge constraint can be removed and recreated at runtime;
- twenty repeated Phase 0 physics resets preserve exact active-body and active-constraint counts;
- twenty Phase 0 presentation rebuilds preserve the managed Three.js scene-root/object count;
- Phase 0 input bindings attach idempotently and detach cleanly;
- TypeScript checking and the production Vite build continue to pass.

The original Phase 0 browser smoke remains historical proof that the Phase 0 built app initialized in Chrome with four bodies and one active constraint. The current Phase 0 workflow is a regression gate rather than an obsolete-screen UI test.

### Phase 1 — Salvage craft flight

Originally verified by GitHub Actions `Phase 1 Flight Gate`, run `32328133794`. Rechecked after Phase 6 by `Phase 1 Regression Gate`, run `32338441801`:

- the craft remains a dynamic Rapier rigid body with a real collider, continuous collision detection, and no gravity in the flight test volume;
- held input exposes forward/reverse, strafe, vertical translation, pitch, yaw, roll, braking, and reset actions;
- translational thrust and rotational torque remain fixed-step rather than render-frame dependent;
- matched render schedules produce equivalent fixed-step flight results;
- the controller-driven precision path still approaches, brakes to working distance, translates, retreats, rotates, and arrests angular motion without debug teleportation;
- coasting preserves momentum while braking materially reduces it;
- collision containment, reset cleanup, input lifecycle, and presenter lifecycle tests continue to pass;
- TypeScript checking and the production Vite build continue to pass.

The original Phase 1 browser smoke remains historical proof that live Chrome keyboard `W`, `Space`, and `X` drove thrust, braking, and reset.

### Phase 2 — Modular wreck physics

Originally verified by GitHub Actions `Phase 2 Wreck Gate`, run `32328786755`. Rechecked after Phase 6 by `Phase 2 Regression Gate`, run `32338441794`:

- the reference wreck contains six dynamic components with stable IDs: `spine`, `engine`, `panel`, `left-rail`, `right-rail`, and `rear-node`;
- the intact baseline contains six explicit Rapier fixed joints with stable connection IDs;
- components expose component type, mass class, and reusable local attachment-point metadata;
- the central spine carries a heavy engine, a light panel, and two rear rails; the rear junction has two separate physical connection paths back to the spine;
- the heavy engine has materially greater physical mass than the light panel;
- the intact wreck remains coherent through extended idle simulation with bounded joint-anchor error and no spontaneous velocity growth;
- the verified craft can approach, stop, translate around, rotate near, and retreat from the live wreck without debug movement;
- direct craft impact transfers measurable momentum into the wreck while all six structural joints remain intact and the assembly avoids solver explosion or disassembly;
- repeated resets rebuild exactly one six-component/six-connection wreck with the same stable component and connection sets and restore the craft baseline;
- presentation rebuilds preserve exactly one presentation object per active physics body;
- TypeScript checking and the production Vite build continue to pass.

### Phase 3 — Cutting and physical separation

Originally verified by GitHub Actions `Phase 3 Cutting Gate`, run `32331609212`. Rechecked after Phase 6 by `Phase 3 Regression Gate`, run `32338441765`:

- exactly two reference-wreck connections remain designated cuttable: `spine-panel` as `low-risk` and `spine-engine` as `large-mass`;
- non-cuttable branch structure rejects sever requests without changing bodies or live joints;
- the cutter acquires live connection targets from current physical attachment points and enforces the verified range/aim/duration rules;
- incomplete cut progress clears when valid targeting conditions are lost;
- completed panel and engine cuts remove exactly their selected Rapier joints while preserving all seven physics bodies and all six wreck components;
- newly unconstrained bodies wake and remain under Rapier simulation;
- post-cut separation remains physical rather than transform-scripted;
- cutter completion remains single-shot until `C` is released;
- repeated cut/reset reconstruction restores the original six connection IDs exactly once;
- TypeScript checking and the production Vite build continue to pass.

### Phase 4 — Tether manipulation and bracing

Originally verified by GitHub Actions `Phase 4 Tether Gate`, run `32333422171`. Rechecked after Phase 6 by `Phase 4 Regression Gate`, run `32338441776`:

- `T` remains a held tether action integrated into the existing input lifecycle;
- the tether attaches to physical wreck components and develops measurable bounded tension;
- releasing `T` returns the tether to idle and clears active influence;
- the tether pulls a detached panel toward the craft through equal-and-opposite Rapier impulses without transform movement;
- matched simulations prove the tether arrests and redirects outward-drifting salvage;
- excessive load produces a `snapped` overload state rather than unlimited force and requires release before reuse;
- bracing the still-connected panel before the same cut materially changes post-cut motion;
- completed-cut targeting favors the recorded removable side of the severed fixture rather than reacquiring the spine;
- repeated tether/cut/reset cycles restore the exact physical baseline;
- production TypeScript checking and Vite build continue to pass.

The original Phase 4 browser smoke remains historical proof of live cut -> tether acquire -> bounded pull -> manual release -> exact reset.

### Phase 5 — Structural graph synchronization

Originally verified by GitHub Actions `Phase 5 Structural Graph Gate`, run `32337246778`. Rechecked after Phase 6 by `Phase 5 Regression Gate`, run `32338441766`:

- graph node IDs and stable node metadata mirror all six current physical wreck components exactly;
- permanent graph edge IDs and endpoint metadata mirror all six current live physical wreck connections exactly;
- the intact graph reports all six components in the connected section containing `spine`;
- bridge analysis identifies `spine-engine` and `spine-panel` as bridges while the two-rail rear loop remains an alternate path rather than a bridge;
- articulation analysis identifies `spine` in the current proof topology;
- low-risk and large-mass cuts remove the same edge from physics and graph without deleting component nodes;
- active tether braces remain temporary support records separate from permanent graph edges;
- matched braced and unbraced simulations preserve graph/physics synchronization while retaining the verified physical outcome difference from Phase 4;
- repeated cut/tether/reset cycles restore the exact unique node/edge/support baseline;
- TypeScript checking and the production Vite build continue to pass.

The original Phase 5 browser smoke remains historical proof of live `6/6/0 -> 6/5/support1 -> support0 -> 6/6/0` graph synchronization.

### Phase 6 — Scanner and structural criticality

Verified by GitHub Actions `Phase 6 Scanner Gate`, run `32338441743`:

- forty-four of forty-four combined Phase 0 through Phase 6 tests pass;
- passive scanner targeting reads only current live physical/graph connections within the proof range and aim threshold and may prefer the current cutter target without bypassing those validity checks;
- a locked scan exposes the live connection relationship, scanned component identity/type, mass class, placeholder salvage value, likely freed section, bridge-versus-alternate-path state, relative section motion, temporary support state, risk score, risk level, and explicit estimate reasons;
- the known alternate-path fixture `left-rail-rear` is distinguishable as low estimated risk because another permanent load path remains;
- the low-mass bridge `spine-panel` is distinguishable as a moderate estimate, identifies `panel` as the likely freed section, identifies it as a light panel, and exposes the placeholder value of `250` units;
- the heavy bridge `spine-engine` is distinguishable as a high estimate, identifies `engine` as the likely freed section, exposes heavy mass, and scores above the panel estimate for explicit bridge/mass/cut-class reasons;
- scanner estimates use live bridge status, alternate paths, articulation endpoints, actual Rapier body mass, relative section motion, current cut metadata, and temporary tether support; they are marked as estimates rather than guarantees;
- attaching a temporary tether brace to the panel lowers the same `spine-panel` prediction from moderate to low while all six permanent graph edges remain intact;
- releasing the tether removes temporary support and restores the unsupported moderate estimate without changing permanent topology;
- matched braced and unbraced simulations re-prove that the prediction change accompanies the already-verified physical outcome difference rather than replacing physical proof;
- after `spine-panel` is physically severed and the synchronized graph edge disappears, the scanner immediately stops returning that removed connection as a valid target; it may reacquire another current live connection instead;
- twelve repeated cut/tether/reset cycles clear removed-edge scanner state and restore the baseline `spine-panel` moderate estimate with six nodes, six edges, and zero temporary supports;
- TypeScript checking and the production Vite build pass;
- the Phase 6 production JavaScript build is approximately `2.803 MB` minified / `986.25 KB` gzip;
- headless Google Chrome proves the live user path: explainable `spine-panel` moderate estimate -> real flight approach/strafe -> tether support active and estimate reduced to low -> tether release and estimate restored to moderate -> physical panel cut and stale scanner edge removed -> exact physical/graph/scanner reset;
- the live browser proof completed with `risk=moderate->low->moderate` and `graph=6->5->6`;
- Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, and Phase 5 regression gates all pass on the same final Phase 6 head.

## Implemented but unverified

None for the current authorized phase boundary.

## Known not-working behavior

None established in the accepted Phase 0–6 scope.

## Known observations / deferred maintenance

- Phase 6 production JavaScript is approximately `2.803 MB` minified / `986.25 KB` gzip. Bundle reduction and code splitting remain deferred until they become relevant to the later performance gate; do not treat this as a Phase 6 failure.
- Rapier emits an initialization deprecation warning in tests. Behavior is verified; API cleanup remains deferred.
- GitHub Actions warns about deprecated internal Node 20 runtimes in `actions/checkout@v4` and `actions/setup-node@v4`; the hosted runner forces Node 24 and the gates pass. CI-action maintenance is deferred.
- Phase 1 handling constants remain accepted greybox proof values, not final tuning.
- Phase 2 wreck geometry, mass classes, and attachment positions are proof fixtures, not production content.
- Phase 3 cutter range, aim threshold, duration, cut classifications, and release-impulse values are greybox proof values rather than final game tuning.
- Phase 4 tether range, aim threshold, minimum length, winch speed, spring/damping constants, and seventy-newton overload limit are proof values rather than production tuning.
- Phase 5 graph reconciliation is correctness-first. Permanent node/edge maps are synchronized from current physical state; bridge/articulation queries are recomputed from the current mirror. Optimize only if later profiling justifies it.
- Phase 6 scanner range, aim threshold, risk-score weights, risk-band thresholds, placeholder value units, reason wording, and passive-targeting presentation are greybox proof values rather than final scanner/economy tuning.
- The first Phase 2 candidate renamed the managed presenter root and correctly failed the Phase 1 lifecycle regression test. The repair restored the protected root identity.
- The first Phase 4 candidate failed shared TypeScript checking because a class-field target remained nullable after attachment. The repair narrowed that already-established target without changing behavior.
- A later Phase 4 browser attempt caught a real targeting defect where the tether selected the spine after a panel cut; the repair favors the recorded removable side and has a direct regression fixture.

## Unknown / unresolved

- final distribution format
- final shipping control scheme beyond the current keyboard greybox controls
- final camera model beyond the current presentation-only chase camera
- art direction details and palette
- economy tuning
- final simultaneous tether count beyond the current single active proof tether
- save format
- final production wreck module dimensions, masses, attachment layouts, and materials
- final cutter tuning, presentation, energy/heat model, and whether release impulse remains part of production cutting behavior
- final tether tuning, presentation, targeting UX, failure model, and whether the proof spring/damping winch remains the production tether model
- final scanner presentation, risk categories, confidence communication, scoring weights, value model, and whether passive aim remains the production acquisition model
- final collapse-severity thresholds, hull-integrity scale, impact-damage tuning, secondary joint-break thresholds, and warning/audio presentation

## Resolved decisions

- implementation runtime/platform foundation: browser-native Three.js application
- rendering foundation: Three.js `0.185.0` / `WebGLRenderer`
- physics foundation: `@dimforge/rapier3d-compat` `0.19.3`
- language/tooling foundation: TypeScript `7.0.2` + Vite `8.2.1`
- simulation timing: fixed-step owner targeting `1/60` second
- simulation authority: Rapier; Three.js presentation mirrors physics transforms
- Phase 1 flight authority: dynamic Rapier craft body controlled by fixed-step forces and torques
- Phase 1 braking model: bounded counter-force and counter-torque, preserving nonzero stopping distance
- current greybox controls: `W/S` thrust, `A/D` strafe, `R/F` vertical, arrow keys pitch/yaw, `Q/E` roll, `Space` brake, `C` cutter hold, `T` tether hold, `X` reset; Phase 6 scanner targeting is passive aim-based and adds no new key in the proof fixture
- Phase 2 wreck authority: dynamic Rapier component bodies connected by explicit Rapier joints
- Phase 2 component identity: stable component IDs plus reusable local attachment-point IDs
- Phase 2 reference topology: six components and six physical joints, including two alternate rear load paths
- Phase 3 cut authority: successful cutting removes the selected live Rapier impulse joint; connected rigid bodies and component records remain in simulation
- Phase 3 cuttable proof targets: `spine-panel` (`low-risk`) and `spine-engine` (`large-mass`); remaining reference-wreck joints are non-cuttable at this phase
- Phase 3 greybox cutter requirements: nine-meter maximum range, `0.92` aim cosine, and `0.75` seconds continuous valid hold before completion
- Phase 3 completion behavior: equal-and-opposite rigid-body release impulse plus wake-up, with cutter release required before another cut may begin
- Phase 4 tether authority: a single active fixed-step spring/damping winch implemented as bounded equal-and-opposite Rapier impulses between craft and target body
- Phase 4 proof tether limits: eleven-meter acquisition range, `0.75` aim cosine, `2.5` meter minimum target length, `2.2 m/s` winch rate, and seventy-newton overload threshold
- Phase 4 tether lifecycle: hold `T` to attach/maintain, release `T` for clean teardown; overload snaps and requires release before re-engagement
- Phase 4 post-cut salvage-targeting convention: a completed Phase 3 cut records the removable fixture side as `componentB`, which tether targeting may favor without performing graph analysis
- Phase 5 structural-graph authority: permanent graph nodes/edges are derived from current `WreckSandbox` component/connection records; graph state does not drive physics
- Phase 5 temporary-support authority: active tether support is stored separately from permanent graph edges and disappears when the tether is released or reset
- Phase 5 topology interpretation for the reference fixture: `spine-engine` and `spine-panel` are bridges, `spine` is an articulation component, and the left/right rail route to `rear-node` supplies alternate connectivity
- Phase 5 synchronization strategy: correctness-first map reconciliation from current physical state, with deterministic connected-section, bridge, and articulation queries over the synchronized mirror
- Phase 6 scanner authority: `ScannerSystem` reads synchronized `StructuralGraph` facts plus current Rapier-backed component mass/velocity and temporary support; it does not write physical or graph state
- Phase 6 proof acquisition limits: passive scanner target range is eighteen meters with a `0.55` aim-cosine threshold; current cutter target receives only a selection bias and must still satisfy scanner validity
- Phase 6 proof risk bands: score `>=70` is high, `>=35` is moderate, otherwise low
- Phase 6 proof placeholder values: spine `800`, engine `1200`, panel `250`, rail `300`, junction `600` units; these are fixture metadata, not accepted economy values
- Phase 6 estimate inputs: bridge/alternate-path status, likely-free section, component mass class and actual Rapier body mass, cut-class metadata, articulation endpoints, relative section motion, and active temporary tether support
- Phase 6 support rule: current tether support reduces the proof risk score only while the support exists; release restores the unsupported estimate and permanent topology is unchanged

## Pending work

### Phase 7 — Collapse escalation and survival damage

This is the only authorized next implementation phase under the current staged plan.

Required proof set:

- add secondary collision-impulse handling without replacing Rapier simulation with scripted collapse motion;
- add additional joint-break behavior only where justified by measurable force/constraint rules;
- derive collapse severity from measurable simulation state rather than a fixed timer or canned event sequence;
- add basic directional warning feedback driven by the measured danger state;
- add hull integrity and debris impact damage;
- add a clear destruction/failure state;
- add only minimal collapse audio/warning placeholders, and drive them from severity rather than spectacle timing;
- configure one known critical-cut fixture that releases enough mass/motion to threaten the ship and can potentially create secondary structural failures;
- prove the same critical cut can produce a dangerous cascade through normal simulation;
- prove the player can survive through positioning, braking, thrust, or tether use;
- prove collapse severity rises and falls with live simulation state;
- prove warning feedback follows the same measured severity;
- prove physical debris impacts can damage the ship;
- prove tethering or alternate cut order can materially change the dangerous event;
- regression-check that the existing low-risk cut remains low-risk and does not automatically trigger dramatic collapse;
- preserve Phase 0–6 regression gates;
- do not begin cargo capture, settlement, progression, production presentation, or Phase 8+ work until the Phase 7 gate passes.

## Staged implementation sequence

1. Phase 0 — Runtime, physics, and reset foundation — **verified**
2. Phase 1 — Salvage craft flight — **verified**
3. Phase 2 — Modular wreck physics — **verified**
4. Phase 3 — Cutting and physical separation — **verified**
5. Phase 4 — Tether manipulation and bracing — **verified**
6. Phase 5 — Structural graph synchronization — **verified**
7. Phase 6 — Scanner and structural criticality — **verified**
8. Phase 7 — Collapse escalation and survival damage — **authorized next**
9. Phase 8 — Cargo capture, condition, and settlement — blocked by Phase 7
10. Phase 9 — Upgrade, persistence, and complete vertical slice — blocked
11. Phase 10 — Wreck variety and progression breadth — blocked
12. Phase 11 — Production readability, visual assets, audio, and feel — blocked
13. Phase 12 — Performance, endurance, accessibility, and release readiness — blocked

Each phase requires focused direct testing plus the smallest relevant regression check before the next phase begins.

## Validation matrix

| ID | Claim | State | Required proof |
|---|---|---|---|
| VAL-000 | Runtime foundation is suitable | verified | Phase 0 runtime proof `32326833764`; current Phase 0 regression `32338441777` |
| VAL-001 | Full salvage loop works | pending | Direct runtime completion without debug controls |
| VAL-002 | Structural graph tracks physical cuts | verified | Phase 5 run `32337246778`; current Phase 5 regression `32338441766` |
| VAL-003 | Dangerous cut produces simulated cascade | pending | Phase 7 direct runtime critical-cut cascade proof |
| VAL-004 | Tether changes dangerous outcome | verified | Phase 4 run `32333422171`; rechecked through Phase 6 matched brace/scan fixture |
| VAL-005 | Reset is clean | verified through Phase 6 | Phase 0–6 repeated physics, connection, input, presentation, cutter, tether, graph, and scanner reset/lifecycle tests |
| VAL-006 | Progression changes next run | pending | Save/settlement runtime proof |
| VAL-007 | Phase gates are respected | verified through Phase 6 | Each phase remained isolated until its focused gate plus affected regressions passed |
| VAL-008 | Salvage craft flight is controllable | verified | Phase 1 proof `32328133794`; current Phase 1 regression `32338441801` |
| VAL-009 | Modular wreck remains coherent and stable | verified | Phase 2 proof `32328786755`; current Phase 2 regression `32338441794` |
| VAL-010 | Cutting removes the intended physical connection and produces natural separation | verified | Phase 3 proof `32331609212`; current Phase 3 regression `32338441765` |
| VAL-011 | Tether manipulation and bracing materially change physical outcomes | verified | Phase 4 proof `32333422171`; current Phase 4 regression `32338441776` |
| VAL-012 | Structural graph mirrors current live topology and temporary support state | verified | Phase 5 proof `32337246778`; current Phase 5 regression `32338441766` |
| VAL-013 | Scanner explains current structural risk without stale or oracle behavior | verified | Phase 6 run `32338441743`: low/moderate/high fixture differentiation, explainable live inputs, support-driven estimate change, stale-edge rejection, matched physical response, repeated reset, Chrome proof |
| VAL-014 | Structural mistakes can escalate into readable survivable physical danger | pending | Phase 7 cascade/severity/warning/hull-damage/survival proof |

## Prohibitions

- Do not claim Phase 7+ gameplay systems are implemented or working before runtime evidence exists.
- Do not broaden first-playable scope before core-loop gates pass.
- Do not substitute scripted spectacle for structural simulation.
- Do not hand-roll a physics engine.
- Do not start a later implementation phase while the current phase gate is failed or unverified.
- Do not use production art, audio, or content expansion to mask unresolved greybox gameplay or physics failures.
- Do not move physics authority into Three.js presentation transforms.
- Do not replace physical craft movement with free-camera translation or direct transform movement.
- Do not delete components to simulate a successful cut; completed cuts remove joints and leave physical bodies in simulation.
- Do not implement tether movement by teleporting or directly setting component transforms; tether influence remains bounded physical simulation.
- Do not allow the structural graph to silently diverge from current physical wreck component/connection state.
- Do not allow structural-graph nodes or edges to become a second authority for physical transforms, body lifecycle, or constraint existence.
- Do not encode tether braces as permanent wreck edges; they remain temporary support information.
- Do not let scanner output mutate physics or structural topology.
- Do not present scanner scores as certainty; the current interface and data model must retain explicit estimate language and inspectable reasons.
- Do not retain a scanner target for a connection that no longer exists physically or in the synchronized graph.
- Do not hard-code Phase 7 collapse severity to elapsed time or substitute a cinematic/scripted collapse for measurable simulation escalation.
- Do not make every cut dangerous; the low-risk cut remains a required Phase 7 regression case.
- Do not begin cargo capture or Phase 8 until the Phase 7 collapse/survival gate passes.

## Revision history

### Revision 9 — 2026-08-20

Phase 6 passed `Phase 6 Scanner Gate` run `32338441743`, while `Phase 0 Regression Gate` run `32338441777`, `Phase 1 Regression Gate` run `32338441801`, `Phase 2 Regression Gate` run `32338441794`, `Phase 3 Regression Gate` run `32338441765`, `Phase 4 Regression Gate` run `32338441776`, and `Phase 5 Regression Gate` run `32338441766` also passed on the same final head. Forty-four of forty-four combined tests passed. Promoted passive live scanner acquisition, component/relationship/mass/value/likely-free readout, explainable low/moderate/high criticality estimates, bridge/alternate-path and articulation reasoning, Rapier-mass and relative-motion inputs, temporary-support-driven estimate changes, matched braced/unbraced physical/prediction behavior, stale-edge rejection after physical cuts, repeated exact scanner reset, production build, and live Chrome `moderate -> low -> moderate` brace response plus post-cut freshness to verified state. The verified implementation was squash-merged to `main` as `a51a263eb96de1a4bcc7fd9e49359373d2858ea2`. Phase 7 — Collapse Escalation and Survival Damage is now the only authorized implementation phase.

### Revision 8 — 2026-08-20

Phase 5 passed `Phase 5 Structural Graph Gate` run `32337246778`, while `Phase 0 Regression Gate` run `32337246738`, `Phase 1 Regression Gate` run `32337246737`, `Phase 2 Regression Gate` run `32337246783`, `Phase 3 Regression Gate` run `32337246871`, and `Phase 4 Regression Gate` run `32337246717` also passed on the same final head. Promoted exact physical-to-graph component/connection synchronization, connected-section queries, bridge/articulation analysis, panel/engine cut edge synchronization, temporary tether-support separation, matched braced/unbraced structural state, repeated exact graph reset, production build, and live Chrome graph baseline/cut/support/reset behavior to verified state. Thirty-eight of thirty-eight combined tests passed. The verified implementation was squash-merged to `main` as `706d4e12f76c0e19b795558f78ea96394e68f302`. Phase 6 — Scanner and Structural Criticality became the only authorized implementation phase.

### Revision 7 — 2026-08-20

Phase 4 passed `Phase 4 Tether Gate` run `32333422171`, while Phase 0–3 regression gates also passed on the same final head. Promoted bounded fixed-step physical tethering, manual release, finite overload snap/rearm behavior, detached-object pull, drift arrest/redirection, matched brace-vs-unbraced cut effects, repeated tether/cut/reset cleanup, production build, and live Chrome cut/tether/pull/release/reset behavior to verified state. The Phase 4 gate exposed and repaired both a nullable TypeScript target and a live post-cut auto-target defect. The verified implementation was squash-merged to `main` as `8c774c59415c1aee8714236ae3b7576e652257c4`.

### Revision 6 — 2026-08-20

Phase 3 passed `Phase 3 Cutting Gate` run `32331609212` with Phase 0–2 regressions green. Promoted explicit cuttable-connection classification, fixed-step target/range/aim cutter progression, interruption behavior, exact Rapier joint removal, body preservation, low-risk panel and large-mass engine cuts, bounded physical post-cut separation, single-shot cutter latching, repeated cut/reset reconstruction, production build, and live Chrome cut/separation/reset behavior. The verified implementation was squash-merged to `main` as `506c65d9838ff8472ae9b36f0b161dc4da5a0164`.

### Revision 5 — 2026-08-19

Phase 2 passed `Phase 2 Wreck Gate` run `32328786755` with Phase 0–1 regressions green. Promoted the six-component/six-joint reference wreck, stable component/attachment identity, alternate rear load paths, intact-wreck coherence, craft-to-wreck collision stability, exact repeated reset, presentation cleanup, production build, and live Chrome approach/brake/retreat/reset path. The first candidate correctly failed a presenter-lifecycle regression after a managed-root rename; the protected identity was restored. The verified implementation was squash-merged to `main` as `8f743595bcd576a5a811a4ec18522a07c94b54d6`.

### Revision 4 — 2026-08-19

Phase 1 passed `Phase 1 Flight Gate` run `32328133794` and the affected Phase 0 foundation passed `Phase 0 Regression Gate` run `32328133855`. Promoted dynamic six-axis craft flight, inertial coasting, bounded counter-thrust braking, collision containment, moving-obstacle course behavior, diagnostics, repeated reset/presentation cleanup, production build, and live Chrome keyboard thrust/brake/reset. The verified Phase 1 implementation was squash-merged to `main` as `03a6f25f36394e9c8a8ab0229a331eaf15e5240e`.

### Revision 3 — 2026-08-19

Phase 0 passed its full verification gate and was merged to `main`. Accepted the Three.js + Rapier + TypeScript/Vite runtime foundation, promoted fixed-step physics, runtime joint lifecycle, repeated reset cleanup, listener cleanup, production build, and headless-browser initialization to verified state, recorded nonblocking bundle/API/CI maintenance observations, and authorized Phase 1.

### Revision 2 — 2026-08-19

Added `IMPLEMENTATION_PLAN.md` as the authoritative execution sequence beneath `BUILD_CONTRACT.md`. Replaced the broad pending technical-proof bucket with a staggered Phase 0-12 dependency chain. Added phase-gate and greybox-before-polish invariants.

### Revision 1 — 2026-08-19

Initialized from the user's concept and the authoritative `BUILD_CONTRACT.md`. Repository was empty before this project specification pass. All gameplay/runtime states remained pending or unknown until implementation evidence existed.
