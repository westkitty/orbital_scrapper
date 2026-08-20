# OPERATIONAL STATE — ORBITAL SCRAPPER

project_id: `orbital_scrapper`
project_name: `Orbital Scrapper`
revision: 11
repository: `westkitty/orbital_scrapper`
default_branch: `main`

## Scope

Greenfield physics-driven salvage game governed by `BUILD_CONTRACT.md`, with execution sequencing governed by `IMPLEMENTATION_PLAN.md`.

## Current baseline

- `BUILD_CONTRACT.md` is the authoritative gameplay/build specification.
- `IMPLEMENTATION_PLAN.md` is the authoritative staged execution sequence for that contract.
- Phases 0 through 8 are implemented and verified on `main`.
- Current accepted runtime foundation: Three.js `0.185.0` + vanilla TypeScript `7.0.2` + Vite `8.2.1`, with `@dimforge/rapier3d-compat` `0.19.3` as physics authority.
- `docs/PHASE0_ARCHITECTURE.md` records the accepted Phase 0 architecture and proof.
- The current player-facing greybox is the Phase 8 salvage-craft scanner/cutter/tether/cargo-recovery scene with synchronized graph data, collapse/hull state, physical cargo capture, cargo condition/value, extraction, and visible settlement.
- No Phase 9+ progression system is verified yet.

## Artifact contract

Build the smallest convincing playable salvage loop:

scan -> tether -> cut -> extract -> survive/escape collapse -> sell salvage -> upgrade -> next run.

Physics owns actual motion, collision, cutting separation, tether influence, loose-cargo hazard, and collapse. The structural graph mirrors live topology and temporary support. Scanner output is derived and advisory. Cargo remains physical until a bounded secure transition. Phase 8 settlement is an in-run transaction result only; persistent currency and upgrades remain Phase 9 work.

Implementation advances one gated phase at a time. A later phase must not depend on an unproven major system from an earlier phase.

## Active invariants

- INV-001: Structural failure is physics-driven rather than replaced by canned collapse sequences.
- INV-002: Scanner information must reflect current wreck structure rather than static authored labels alone.
- INV-003: Tethers can materially affect structural outcomes, including bracing.
- INV-004: Cutting severs explicit modular connections; arbitrary mesh slicing is not required.
- INV-005: Cargo remains physically hazardous until secured or safely settled.
- INV-006: Risk primarily comes from geometry, attachment, mass, momentum, and player decisions.
- INV-007: First playable scope excludes combat, multiplayer, EVA, base building, crafting trees, large narrative systems, and procedural galaxy scope.
- INV-008: Repeated runs/resets must not leak physics bodies, constraints, event listeners, audio instances, cargo state, or settlement state.
- INV-009: A passing build alone is insufficient proof of gameplay behavior; interaction claims require runtime evidence.
- INV-010: Development proceeds through the gated sequence in `IMPLEMENTATION_PLAN.md`; failed or unverified phase gates are not silently carried forward.
- INV-011: Production presentation must not precede or conceal unresolved core-physics and interaction failures; greybox is acceptable through the complete vertical-slice proof.
- INV-012: Rapier owns authoritative rigid-body/constraint state; Three.js mirrors presentation state and must not become a second physics authority.
- INV-013: Physics advances through the fixed-step simulation owner rather than render-frame-dependent forces.
- INV-014: Salvage-craft translation and rotation are applied to the dynamic Rapier body through the fixed-step path; the chase camera and Three.js craft mesh remain presentation-only.
- INV-015: Flight braking is counter-force/counter-torque behavior that preserves momentum and stopping distance rather than instantaneous velocity cancellation or transform teleportation.
- INV-016: Wreck modules use stable component IDs and reusable component-local attachment points. Physical Rapier joints are the authority for intact wreck connectivity.
- INV-017: The Phase 2 reference wreck contains genuine alternate physical load paths from the central spine to the rear junction.
- INV-018: Presenter lifecycle uniqueness remains regression-protected. Internal managed-root identity must not be changed casually without equivalent cleanup proof and deliberate test migration.
- INV-019: Cut eligibility is explicit connection metadata. Connections not designated cuttable must reject ordinary cutter sever requests without changing bodies or live-joint state.
- INV-020: A completed cutter cut removes exactly one live Rapier joint. It must not delete, hide, teleport, or replace the connected rigid bodies or wreck components.
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
- INV-035: `CollapseSystem` interprets current Rapier-backed motion/contact evidence but is not a physics authority. Collapse severity and warning state must not drive transforms, velocities, or scripted debris paths.
- INV-036: Hull damage is derived from measured craft/debris contact-force impulse, not proximity, scanner score, elapsed time, or a cinematic trigger.
- INV-037: Secondary impact failure may remove a live Rapier joint only when that connection carries an explicit overload threshold and a measured non-connected impact exceeds it. The resulting graph change follows the removed physical joint.
- INV-038: Live collapse severity is separate from scanner prediction. Severity must rise and fall with current detached mass, distance, closing speed, impact impulse, and current-step structural failure evidence rather than remain latched to a past prediction or fixed timer.
- INV-039: The Phase 7 dangerous engine fixture is isolated behind explicit fixture configuration. The existing low-risk panel cut remains a required non-dramatic regression case, and the default Phase 0–6 wreck fixture must retain its accepted behavior.
- INV-040: A destroyed craft disables player control but does not freeze or replace the Rapier simulation. Reset restores full hull, quiet warning state, and the exact physical/graph fixture baseline.
- INV-041: Cutter target selection must prefer a currently range-and-aim-eligible connection over a higher-scoring but unreachable fallback; fallback tracking remains available only when no eligible candidate exists.
- INV-042: Cargo eligibility requires a component to be physically detached with zero live physical connections, still enabled in Rapier, not the central spine, and not already secured. Nearby intact wreck parts must not become cargo records.
- INV-043: Phase 8 capture applies only to the current physically tethered cargo candidate inside the bounded clamp envelope and at or below the configured relative-speed limit. Excessive relative speed must reject capture and leave the salvage enabled and hazardous.
- INV-044: Unsecured cargo condition damage is derived from measured Rapier contact-force impulse on physically detached salvage. Condition loss must not come from a timer, scanner estimate, proximity rule, or scripted damage event.
- INV-045: Successful securing records cargo identity, condition, base value, adjusted value, mass, and secure time, then explicitly zeroes motion and disables that Rapier body/colliders. The stable component/body record remains for reset identity; tether, collapse, and presentation must no longer treat disabled secured cargo as a loose target or threat.
- INV-046: Settlement requires at least one secured cargo record plus a physical craft retreat to the configured extraction distance. Phase 8 payout is an in-run settlement result only and must not silently become persistent currency or an upgrade system.

## Verified working behavior

### Phase 0 — Runtime, physics, and reset foundation

Original proof: `Phase 0 Runtime Gate` run `32326833764`. Current Phase 8-head regression: `Phase 0 Regression Gate` run `32343609181`.

Verified: pinned dependencies; fixed-step simulation; collision/gravity fixture; runtime joint remove/recreate; clean repeated physics and presentation resets; input attach/detach lifecycle; production typecheck/build.

### Phase 1 — Salvage craft flight

Original proof: `Phase 1 Flight Gate` run `32328133794`. Current regression: `32343609218`.

Verified: dynamic Rapier craft; six-axis force/torque flight; fixed-step independence; inertial coasting and bounded braking; precision approach/translate/rotate/retreat path; collision containment; repeated reset and presenter cleanup.

### Phase 2 — Modular wreck physics

Original proof: `Phase 2 Wreck Gate` run `32328786755`. Current regression: `32343609266`.

Verified: six stable wreck components and six live joints; reusable attachment metadata; heavy/light mass distinction; alternate rear load paths; coherent idle assembly; stable craft impact; exact repeated wreck reset; one presentation object per physics record.

### Phase 3 — Cutting and physical separation

Original proof: `Phase 3 Cutting Gate` run `32331609212`. Current regression: `32343609325`.

Verified: explicit cuttable metadata; range/aim/hold requirements; exact joint removal while preserving bodies/components; physical separation; cutter release latch; reachable-target-first selection; exact cut/reset reconstruction.

### Phase 4 — Tether manipulation and bracing

Original proof: `Phase 4 Tether Gate` run `32333422171`. Current regression: `32343609216`.

Verified: bounded equal-and-opposite physical tether force; winching; drift arrest/redirection; finite overload snap/rearm; bracing materially changes post-cut motion; post-cut removable-side targeting; clean release/reset lifecycle.

### Phase 5 — Structural graph synchronization

Original proof: `Phase 5 Structural Graph Gate` run `32337246778`. Current regression: `32343609176`.

Verified: exact node/component and edge/joint mirroring; connected-section/bridge/articulation facts; cut synchronization; temporary tether supports separate from permanent edges; exact repeated graph reset.

### Phase 6 — Scanner and structural criticality

Original proof: `Phase 6 Scanner Gate` run `32338441743`. Current regression: `32343609192`.

Verified: live read-only structural estimates; low/moderate/high distinction for reference fixtures; bridge/alternate-path/articulation/mass/motion/support reasons; temporary support changes estimate; removed connections do not remain stale targets; exact scanner reset.

### Phase 7 — Collapse escalation and survival damage

Original proof: `Phase 7 Collapse Gate` run `32342058172`. Current regression: `32343609239`.

Verified: Rapier contact-force evidence; simulation-derived severity; directional warning; physical debris impact/hull damage; continuing physics after destruction; explicit impact-overload joint failure; stationary critical-cut hull loss versus same-cut reverse-thrust survival; low-risk panel regression; tether changes heavy-engine trajectory; exact collapse reset.

### Phase 8 — Cargo capture, condition, and settlement

Verified by `Phase 8 Cargo Gate` run `32343609183`, job `96347556842`:

- fifty-seven of fifty-seven combined Phase 0 through Phase 8 tests pass;
- detached salvage remains an enabled Rapier body until a successful capture transition;
- cargo eligibility excludes intact connected components, the spine, disabled bodies, and already-secured cargo;
- a three-meter proof clamp envelope accepts only the current physically tethered detached candidate;
- capture is rejected while relative speed exceeds `1.35 m/s`, leaving the same salvage enabled and loose until it is physically slowed;
- real pre-capture contact-force impulse damages detached salvage condition and lowers its adjusted value;
- otherwise-identical panel recoveries prove a careful `100%` panel pays the full `250` proof units while impact-damaged salvage pays less;
- the already-verified tether can physically recover the detached panel into the clamp without transform teleportation;
- successful capture records a secured cargo snapshot, zeros motion, and disables the cargo Rapier body/colliders; tether and collapse ignore it afterward and presentation hides the disabled loose-body representation;
- secured cargo remains unsettled while the craft is still near the wreck;
- settlement occurs only after physical retreat to at least the `11.5 m` proof extraction distance;
- the visible settlement summary reports the recovered item, actual condition, condition-adjusted value, and payout without introducing persistent currency;
- repeated capture/reset cycles restore the panel to an enabled loose baseline, condition `100`, zero secured cargo, `field` settlement state, the original six connections, six component records, and seven body records;
- TypeScript checking and the production Vite build pass;
- Phase 8 production JavaScript is approximately `2.812 MB` minified / `989.17 KB` gzip;
- final headless Chrome proof completes the actual user path: live `spine-panel` scan -> bounded physical approach/brake -> held `C` physical cut -> held `T` physical tether recovery -> condition-bearing clamp capture -> held `S` physical extraction retreat -> visible condition-adjusted settlement -> exact `X` reset;
- the final live Chrome recovery produced a physically impacted panel at `65.0%` condition, paid `163` units, settled at `11.95 m`, and reset to `field`;
- Phase 0 through Phase 7 regression gates all pass on the same final Phase 8 head.

## Implemented but unverified

None for the current authorized phase boundary.

## Known not-working behavior

None established in the accepted Phase 0–8 scope.

## Known observations / deferred maintenance

- Phase 8 production JavaScript is approximately `2.812 MB` minified / `989.17 KB` gzip. Bundle reduction/code splitting remains deferred to the later performance gate.
- Rapier emits an initialization deprecation warning in tests. Behavior is verified; API cleanup remains deferred.
- GitHub Actions warns about deprecated internal Node 20 runtimes in `actions/checkout@v4` and `actions/setup-node@v4`; hosted runners force Node 24 and the gates pass. CI-action maintenance is deferred.
- Phase 1 handling constants remain greybox proof values, not final tuning.
- Phase 2 wreck geometry, masses, and attachments remain proof fixtures, not production content.
- Phase 3 cutter thresholds and release impulse remain greybox proof values.
- Phase 4 tether range, spring/damping/winch, and overload limits remain greybox proof values.
- Phase 5 graph reconciliation remains correctness-first and should be optimized only with profiling evidence.
- Phase 6 scanner ranges, weights, bands, placeholder values, and copy remain greybox proof values.
- Phase 7 danger-fixture geometry/start, release impulse, severity/hull thresholds, overload threshold, and warning states remain proof values.
- Phase 8 cargo constants are proof values: clamp radius `3 m`, maximum capture relative speed `1.35 m/s`, cargo-damage impulse threshold `0.8 N·s`, condition damage conversion `10` points per excess `N·s`, and extraction distance `11.5 m`.
- Phase 8 proof base values are spine `800`, engine `1200`, panel `250`, rail `300`, junction `600` units. They are not accepted final economy tuning.
- The final live tether recovery produced `65.0%` panel condition because the physical recovery incurred real impacts. This is valid evidence that condition/value reacts to gameplay, not accepted final tether/cargo tuning or UX quality.
- The first Phase 8 browser attempt used an unsafe long forward-thrust hold and physically collided with the wreck before the cut; the smoke was repaired to use bounded thrust pulses with braking, without changing gameplay physics.
- A later Phase 8 run encountered a headless Chrome startup with no DevTools target; the smoke harness was isolated with its own temporary browser profile and a longer startup window. No game behavior changed.
- The next Phase 8 browser run successfully recovered cargo but exposed an overstrict test assumption that the live recovery must be pristine; the smoke was corrected to verify the actual condition-adjusted payout, while direct tests continue to prove pristine versus damaged payout differences.

## Unknown / unresolved

- final distribution format
- final shipping control scheme beyond current keyboard greybox controls
- final camera model beyond current presentation-only chase camera
- final art direction and palette
- final economy tuning and currency scale
- final simultaneous tether count beyond the current single active proof tether
- final save format and persistence mechanism
- final production wreck dimensions, masses, attachment layouts, and materials
- final cutter energy/heat model, presentation, tuning, and whether release impulse remains production behavior
- final tether tuning, targeting UX, failure model, and whether the proof spring/damping winch remains production behavior
- final scanner presentation, confidence communication, scoring/value model, and acquisition model
- final collapse severity, hull scale, impact-damage tuning, secondary-break thresholds, and warning/audio presentation
- final cargo capture hardware/interaction, clamp shape, relative-speed rule, condition scale, impact-damage mapping, base values, payout formula, settlement presentation, and whether secured cargo remains represented by disabled Rapier bodies versus a later unloaded serialized record
- final currency persistence, upgrade catalog/effects, failure economy, and next-run preparation flow

## Resolved decisions

- runtime/platform: browser-native Three.js application
- rendering: Three.js `0.185.0` / `WebGLRenderer`
- physics: `@dimforge/rapier3d-compat` `0.19.3`
- language/tooling: TypeScript `7.0.2` + Vite `8.2.1`
- simulation timing: fixed-step owner targeting `1/60` second
- simulation authority: Rapier; Three.js presentation mirrors physics transforms
- current greybox controls: `W/S` thrust, `A/D` strafe, `R/F` vertical, arrows pitch/yaw, `Q/E` roll, `Space` brake, `C` cutter hold, `T` tether hold, `X` reset; scanner targeting remains passive aim-based
- Phase 1: dynamic Rapier craft controlled by fixed-step forces/torques; braking is bounded counter-force/counter-torque
- Phase 2: stable component IDs/local attachment IDs; six-component/six-joint reference topology with alternate rear paths
- Phase 3: cutter removes selected live Rapier joint; reference cut targets are `spine-panel` and `spine-engine`; cutter chooses eligible targets before blocked fallback tracking
- Phase 4: one active bounded physical spring/damping winch tether; post-cut targeting may favor the recorded removable side
- Phase 5: structural graph is a derived mirror; temporary tether support is not a permanent edge
- Phase 6: scanner is read-only derived interpretation; risk is an explainable estimate rather than authority
- Phase 7: contact-force evidence feeds greybox hull/severity; impact overload may break only explicitly thresholded joints; destroyed state disables control but simulation continues
- Phase 8 cargo eligibility: only detached, enabled, non-spine, unsecured component records qualify
- Phase 8 capture authority: current tether target must enter the three-meter clamp and satisfy the `1.35 m/s` proof relative-speed limit
- Phase 8 cargo damage: detached enabled salvage condition responds to measured fixed-step contact impulse
- Phase 8 secure transition: zero velocity then `RigidBody.setEnabled(false)`; stable component/body record remains for reset; disabled cargo is no longer a tether/collapse/presentation loose-body target
- Phase 8 settlement authority: secured cargo plus physical retreat to the `11.5 m` proof extraction distance; payout is current condition-adjusted value only and is not persistent currency

## Pending work

### Phase 9 — Upgrade, persistence, and complete vertical slice

This is the only authorized next implementation phase under the current staged plan.

Required proof set:

- add currency persistence;
- add one upgrade purchase path;
- add one upgrade with an observable gameplay effect on the next run;
- add minimal preparation/upgrade state;
- add save-state handling sufficient for the proven progression path;
- add a failure/recovery path that returns the player to a valid run state;
- complete the required vertical-slice flow without debug controls: `scan -> tether -> cut -> extract -> survive/escape -> secure cargo -> return -> sell -> upgrade -> begin next run`;
- prove the purchased upgrade persists as designed;
- prove the next run exhibits the changed capability;
- prove a failed run returns to a valid state without duplicate simulation objects or corrupted progression;
- prove at least two different cut orders on the same wreck can produce meaningfully different outcomes;
- preserve Phase 0–8 regression gates;
- do not begin wreck/content breadth, production presentation, or Phase 10+ work until the Phase 9 vertical-slice gate passes.

## Staged implementation sequence

1. Phase 0 — Runtime, physics, and reset foundation — **verified**
2. Phase 1 — Salvage craft flight — **verified**
3. Phase 2 — Modular wreck physics — **verified**
4. Phase 3 — Cutting and physical separation — **verified**
5. Phase 4 — Tether manipulation and bracing — **verified**
6. Phase 5 — Structural graph synchronization — **verified**
7. Phase 6 — Scanner and structural criticality — **verified**
8. Phase 7 — Collapse escalation and survival damage — **verified**
9. Phase 8 — Cargo capture, condition, and settlement — **verified**
10. Phase 9 — Upgrade, persistence, and complete vertical slice — **authorized next**
11. Phase 10 — Wreck variety and progression breadth — blocked by Phase 9
12. Phase 11 — Production readability, visual assets, audio, and feel — blocked
13. Phase 12 — Performance, endurance, accessibility, and release readiness — blocked

Each phase requires focused direct testing plus the smallest relevant regression check before the next phase begins.

## Validation matrix

| ID | Claim | State | Required proof |
|---|---|---|---|
| VAL-000 | Runtime foundation is suitable | verified | Phase 0 proof `32326833764`; current regression `32343609181` |
| VAL-001 | Full salvage loop works | pending | Phase 9 end-to-end vertical-slice runtime completion without debug controls |
| VAL-002 | Structural graph tracks physical cuts | verified | Phase 5 proof `32337246778`; current regression `32343609176` |
| VAL-003 | Dangerous cut produces simulated cascade | verified | Phase 7 proof `32342058172`; current regression `32343609239` |
| VAL-004 | Tether changes dangerous outcome | verified | Phase 4 proof `32333422171`; rechecked through Phase 7 |
| VAL-005 | Reset is clean | verified through Phase 8 | Phase 0–8 reset/lifecycle tests including cargo condition, secured state, settlement, enabled-body restoration, and Chrome exact reset |
| VAL-006 | Progression changes next run | pending | Phase 9 persistence/upgrade runtime proof |
| VAL-007 | Phase gates are respected | verified through Phase 8 | Every phase remained isolated until focused gate plus affected regressions passed |
| VAL-008 | Salvage craft flight is controllable | verified | Phase 1 proof `32328133794`; current regression `32343609218` |
| VAL-009 | Modular wreck remains coherent and stable | verified | Phase 2 proof `32328786755`; current regression `32343609266` |
| VAL-010 | Cutting removes intended physical connection and produces natural separation | verified | Phase 3 proof `32331609212`; current regression `32343609325` |
| VAL-011 | Tether manipulation/bracing materially change physical outcomes | verified | Phase 4 proof `32333422171`; current regression `32343609216` |
| VAL-012 | Structural graph mirrors live topology/support state | verified | Phase 5 proof `32337246778`; current regression `32343609176` |
| VAL-013 | Scanner explains current structural risk without stale/oracle behavior | verified | Phase 6 proof `32338441743`; current regression `32343609192` |
| VAL-014 | Structural mistakes escalate into readable survivable physical danger | verified | Phase 7 proof `32342058172`; current regression `32343609239` |
| VAL-015 | Salvage can be physically recovered, condition-valued, secured, returned, and settled | verified | Phase 8 run `32343609183`: speed-gated physical capture, contact-derived condition, condition-adjusted payout, extraction gate, Chrome settlement/reset |

## Prohibitions

- Do not claim Phase 9+ gameplay systems are implemented or working before runtime evidence exists.
- Do not broaden first-playable scope before core-loop gates pass.
- Do not substitute scripted spectacle for structural simulation or hand-roll a physics engine.
- Do not start a later phase while the current phase gate is failed or unverified.
- Do not use production art/audio/content expansion to mask unresolved greybox gameplay or physics failures.
- Do not move physics authority into Three.js transforms or replace physical craft/tether/cut/cargo movement with teleportation.
- Do not delete components to simulate a cut; completed cuts remove joints and leave bodies in simulation.
- Do not let graph or scanner state become physical authority or remain stale after physical topology changes.
- Do not encode tether braces as permanent wreck edges.
- Do not hard-code collapse severity to elapsed time, derive hull damage from proximity/scanner prediction, or break joints without explicit threshold plus measured impact evidence.
- Do not make every cut dangerous; the low-risk panel path remains protected.
- Do not classify intact or still-connected wreck components as recoverable cargo.
- Do not secure cargo merely because it is nearby; require the physical tether/capture envelope and relative-speed rule.
- Do not hide excessive capture speed by snapping cargo into inventory; rejected cargo remains live and hazardous.
- Do not damage cargo condition from scripted timers or scanner risk; require measured physical contact evidence.
- Do not leave secured/disabled cargo as a valid tether target, collapse threat, or visible loose-body presentation object.
- Do not settle cargo before it has been secured and the craft has physically reached extraction distance.
- Do not treat Phase 8 payout as persistent currency or add upgrades before the Phase 9 gate.

## Revision history

### Revision 11 — 2026-08-20

Phase 8 passed `Phase 8 Cargo Gate` run `32343609183`, while Phase 0–7 regression runs `32343609181`, `32343609218`, `32343609266`, `32343609325`, `32343609216`, `32343609176`, `32343609192`, and `32343609239` all passed on the same final head. Fifty-seven of fifty-seven combined tests passed. Promoted detached-only cargo eligibility, speed-gated tether/clamp capture, contact-derived cargo condition damage, condition-adjusted value/payout, explicit secured-body disable/serialization behavior, physical extraction before settlement, repeated exact cargo reset, production build, and the live Chrome scan/cut/tether/capture/return/settlement/reset journey to verified state. Final Chrome proof reported `condition=65.0`, `payout=163`, `distance=11.95`, `reset=field`. The verified Phase 8 implementation was squash-merged to `main` as `a6ce2f4f3aa9db50793b9216ee8df2dd94261802`. Phase 9 — Upgrade, Persistence, and Complete Vertical Slice is now the only authorized implementation phase. Phase 8 gating caught an unsafe browser approach choreography, one transient headless Chrome startup issue, and an incorrect assumption that live physical recovery must remain pristine; all were corrected without weakening the physical cargo contract.

### Revision 10 — 2026-08-20

Phase 7 passed run `32342058172` with all Phase 0–6 regressions green. Fifty of fifty tests passed. Promoted contact-force evidence, live severity/warning, physical hull damage, impact-overload failure, stationary failure versus reverse-thrust survival, low-risk regression, exact reset, and reachable-target-first cutter selection. Squash merge: `92f731d9c5fa53b416c019e9cff85fe3002d24a3`.

### Revision 9 — 2026-08-20

Phase 6 passed run `32338441743` with all Phase 0–5 regressions green. Promoted explainable live scanner estimates, support-driven estimate changes, stale-edge rejection, matched physical/prediction behavior, and exact reset. Squash merge: `a51a263eb96de1a4bcc7fd9e49359373d2858ea2`.

### Revision 8 — 2026-08-20

Phase 5 passed run `32337246778` with Phase 0–4 regressions green. Promoted exact structural-graph synchronization, bridge/articulation queries, temporary support separation, and exact reset. Squash merge: `706d4e12f76c0e19b795558f78ea96394e68f302`.

### Revision 7 — 2026-08-20

Phase 4 passed run `32333422171` with Phase 0–3 regressions green. Promoted bounded tethering, overload snap/rearm, drift manipulation, bracing outcome changes, and exact reset. Squash merge: `8c774c59415c1aee8714236ae3b7576e652257c4`.

### Revision 6 — 2026-08-20

Phase 3 passed run `32331609212` with Phase 0–2 regressions green. Promoted explicit cuttable joints, physical separation, cutter targeting/progress, and exact reconstruction. Squash merge: `506c65d9838ff8472ae9b36f0b161dc4da5a0164`.

### Revision 5 — 2026-08-19

Phase 2 passed run `32328786755` with Phase 0–1 regressions green. Promoted six-component/six-joint reference wreck, stable identity, alternate paths, coherent simulation, collision stability, and exact reset. Squash merge: `8f743595bcd576a5a811a4ec18522a07c94b54d6`.

### Revision 4 — 2026-08-19

Phase 1 passed run `32328133794` with Phase 0 regression green. Promoted dynamic six-axis craft flight, inertia/braking, collision containment, and live keyboard proof. Squash merge: `03a6f25f36394e9c8a8ab0229a331eaf15e5240e`.

### Revision 3 — 2026-08-19

Phase 0 passed its full runtime gate and was merged to `main`. Accepted the Three.js + Rapier + TypeScript/Vite runtime, fixed-step physics, joint lifecycle, reset/listener cleanup, production build, and headless initialization.

### Revision 2 — 2026-08-19

Added `IMPLEMENTATION_PLAN.md` as the authoritative Phase 0–12 execution sequence beneath `BUILD_CONTRACT.md` and established proof-gated greybox-before-polish sequencing.

### Revision 1 — 2026-08-19

Initialized from the user's concept and `BUILD_CONTRACT.md`; all gameplay/runtime behavior remained pending until implementation evidence existed.
