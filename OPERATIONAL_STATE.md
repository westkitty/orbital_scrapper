# OPERATIONAL STATE — ORBITAL SCRAPPER

project_id: `orbital_scrapper`
project_name: `Orbital Scrapper`
revision: 15
repository: `westkitty/orbital_scrapper`
default_branch: `main`

## Scope

Greenfield physics-driven salvage game governed by `BUILD_CONTRACT.md`, with execution sequencing governed by `IMPLEMENTATION_PLAN.md`.

## Current baseline

- `BUILD_CONTRACT.md` is the authoritative gameplay/build specification.
- `IMPLEMENTATION_PLAN.md` is the authoritative staged execution sequence for that contract.
- Phases 0 through 12 are implemented and verified on `main`.
- Current accepted runtime foundation: Three.js `0.185.0` + vanilla TypeScript `7.0.2` + Vite `8.2.1`, with `@dimforge/rapier3d-compat` `0.19.3` as physics authority.
- `docs/PHASE0_ARCHITECTURE.md` records the accepted Phase 0 architecture and proof.
- `docs/PHASE11_PRESENTATION.md` records the accepted production-presentation direction, authority boundaries, vacuum-audio rules, HUD hierarchy, and accessibility/readability constraints.
- `docs/PHASE12_RELEASE_READINESS.md` records the selected static desktop-Chromium concept-release target, release budgets, lifecycle/accessibility/save policy, package contract, and evidence limits.
- The current player-facing baseline is the complete reference-wreck salvage loop with production presentation enabled: structural scan and risk/value readout, physical flight/cutting/tethering, collapse/hull consequences, physical cargo capture and condition, extraction/sale, persistent credits, preparation dock, Clamp Dampers purchase, and a fresh next run that applies the persisted upgrade.
- Phase 10 data-driven breadth remains verified behind the same mechanics: three wreck templates, bounded missing-section variants, per-component value/fragility metadata, and two additional persisted capability upgrades.
- Phase 11 production presentation remains verified after Phase 12 optimization: local procedural production geometry, exact visible structural hardpoints, edge-distributed cockpit HUD, derived scanner/cutter/tether/cargo/impact VFX, and user-enabled vacuum-aware Web Audio without changing simulation authority.
- Phase 12 verifies release-candidate readiness only for the selected static desktop-Chromium concept target. The recorded CI performance environment is GitHub-hosted Ubuntu + headless Google Chrome + SwiftShader at `1280x900` with reduced motion; it is not evidence for mobile thermals, Safari, Firefox, consumer GPU tiers, native installation, or broader accessibility certification.
- PR #13 was squash-merged to `main` as `9533e5b905bbdbeec1a613700af745910f61f1b8` after the Phase 12 gate and every Phase 0–11 regression gate passed on the same candidate head.

## Artifact contract

Build the smallest convincing playable salvage loop:

scan -> tether -> cut -> extract -> survive/escape collapse -> sell salvage -> upgrade -> next run.

Physics owns actual motion, collision, cutting separation, tether influence, loose-cargo hazard, and collapse. The structural graph mirrors live topology and temporary support. Scanner output is derived and advisory. Cargo remains physical until a bounded secure transition. Progression persists economic/run facts only and must not become a physics authority. Production presentation must reveal these relationships without replacing them.

Implementation advances one gated phase at a time. A later phase must not depend on an unproven major system from an earlier phase.

## Active invariants

- INV-001: Structural failure is physics-driven rather than replaced by canned collapse sequences.
- INV-002: Scanner information must reflect current wreck structure rather than static authored labels alone.
- INV-003: Tethers can materially affect structural outcomes, including bracing.
- INV-004: Cutting severs explicit modular connections; arbitrary mesh slicing is not required.
- INV-005: Cargo remains physically hazardous until secured or safely settled.
- INV-006: Risk primarily comes from geometry, attachment, mass, momentum, and player decisions.
- INV-007: First playable scope excludes combat, multiplayer, EVA, base building, crafting trees, large narrative systems, and procedural galaxy scope.
- INV-008: Repeated runs/resets must not leak physics bodies, constraints, event listeners, audio instances, cargo state, settlement state, or duplicate progression accounting.
- INV-009: A passing build alone is insufficient proof of gameplay behavior; interaction claims require runtime evidence.
- INV-010: Development proceeds through the gated sequence in `IMPLEMENTATION_PLAN.md`; failed or unverified phase gates are not silently carried forward.
- INV-011: Production presentation must not conceal unresolved core-physics and interaction failures; presentation is subordinate to the verified game loop.
- INV-012: Rapier owns authoritative rigid-body/constraint state; Three.js mirrors presentation state and must not become a second physics authority.
- INV-013: Physics advances through the fixed-step simulation owner rather than render-frame-dependent forces.
- INV-014: Salvage-craft translation and rotation are applied to the dynamic Rapier body through the fixed-step path; the chase camera and Three.js craft mesh remain presentation-only.
- INV-015: Flight braking is counter-force/counter-torque behavior that preserves momentum and stopping distance rather than instantaneous velocity cancellation or transform teleportation.
- INV-016: Wreck modules use stable component IDs and reusable component-local attachment points. Physical Rapier joints are the authority for intact wreck connectivity.
- INV-017: The Phase 2 reference wreck contains genuine alternate physical load paths from the central spine to the rear junction.
- INV-018: Presenter lifecycle uniqueness remains regression-protected. Internal managed-root identity `phase-one-flight-root` must not be changed casually without equivalent cleanup proof and deliberate test migration.
- INV-019: Cut eligibility is explicit connection metadata. Connections not designated cuttable must reject ordinary cutter sever requests without changing bodies or live-joint state.
- INV-020: A completed cutter cut removes exactly one live Rapier joint. It must not delete, hide, teleport, or replace the connected rigid bodies or wreck components.
- INV-021: Cutter progress advances through the fixed-step simulation path and requires valid range and aim. Incomplete progress clears when targeting conditions are lost, and a completed cut requires cutter release before another cut can begin.
- INV-022: Post-cut motion remains rigid-body simulation. The current cutter uses a bounded equal-and-opposite release impulse after joint removal; separation is not scripted through transforms.
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
- INV-043: Capture applies only to the current physically tethered cargo candidate inside the bounded clamp envelope and at or below the active run's configured relative-speed limit. Excessive relative speed must reject capture and leave salvage enabled and hazardous.
- INV-044: Unsecured cargo condition damage is derived from measured Rapier contact-force impulse on physically detached salvage. Condition loss must not come from a timer, scanner estimate, proximity rule, or scripted damage event.
- INV-045: Successful securing records cargo identity, condition, base value, adjusted value, mass, and secure time, then explicitly zeroes motion and disables that Rapier body/colliders. The stable component/body record remains for reset identity; tether, collapse, and presentation must no longer treat disabled secured cargo as a loose target or threat.
- INV-046: Settlement requires at least one secured cargo record plus a physical craft retreat to the configured extraction distance.
- INV-047: `ProgressionSystem` owns versioned progression facts only: credits, purchased proof upgrades, monotonically issued run IDs, completion/failure counts, and the latest accounted run IDs. It must not persist or reconstruct Rapier bodies, transforms, joints, graph state, scanner state, tether state, or cargo physics.
- INV-048: Settlement and failure accounting are run-scoped and idempotent. Only the currently issued run (`nextRunId - 1`) may settle or fail; stale run IDs, duplicate settlement, duplicate failure, and settlement-after-failure must not mutate progression.
- INV-049: Persistent credits are created only from a completed physical settlement. A failed run does not erase previously earned credits or installed upgrades and cannot later be credited as a successful settlement.
- INV-050: Upgrades are purchased in the preparation/dock state and take effect only when a fresh run is launched. Purchasing an upgrade must not retroactively change the already-completed run's active simulation configuration.
- INV-051: The Phase 9 proof upgrade `Clamp Dampers` costs `150` units and raises the next-run cargo relative-speed capture ceiling from the protected default `1.35 m/s` to `2.00 m/s`. This is a proof value, not final balance.
- INV-052: Run lifecycle states are explicit: `field`, `failure`, and `dock`. Dock pauses simulation; failure disables player control while Rapier continues with neutral input until explicit recovery; recovery rebuilds the physical baseline and preserves persistent progression.
- INV-053: Unsupported or malformed progression save data recovers to safe current version-two defaults; a valid version-one Phase 9 save migrates in place while preserving common progression facts and existing Clamp Dampers ownership.
- INV-054: Phase 10 wreck variety is declared through reusable `WreckCatalog` template/component/connection data using the existing attachment and Rapier-joint contract. Existing tools must not branch on individual wreck-template IDs to function.
- INV-055: The `reference/intact` template remains the exact Phase 9 six-component/six-connection regression anchor. The explicit Phase 7 danger fixture remains tied to that reference topology rather than inheriting arbitrary new content.
- INV-056: Salvage value and cargo fragility are per-component metadata. Scanner and cargo may derive readouts/damage from this metadata, but neither metadata field may become a physical-motion or topology authority.
- INV-057: Missing-section variants remove declared components and dependent connections when the wreck is built; they must not emulate variation through scripted collapse events or hidden runtime deletions after play begins.
- INV-058: Progression save version two retains the proven storage key `orbital-scrapper-progression-v1` specifically to migrate valid Phase 9 saves in place. Migration preserves credits, run accounting, and Clamp Dampers ownership while defaulting new Phase 10 upgrades to unowned.
- INV-059: Phase 10 upgrades are capability changes, not payout multipliers: `Tether Reinforcement` raises the bounded tether proof ceiling from `70 N` to `105 N`, and `Cutter Optics` raises cutter range from `9 m` to `12 m`. Their proof costs and tuning remain non-final balance values.
- INV-060: Production visual assets remain subordinate to the stable simulation contract. `FlightScenePresenter` owns one top-level object per physics body under `phase-one-flight-root`; nested production meshes and visible hardpoint markers must not move or redefine Rapier bodies, colliders, stable IDs, pivots, or component-local attachment coordinates.
- INV-061: `ProductionFx` is a derived, disposable presentation layer under `phase11-fx-root`. Scanner, cutter, tether-load, cargo-envelope, thruster, and impact effects may read live diagnostics but must not apply force, mutate topology, or become a second gameplay authority.
- INV-062: `ProductionAudio` is a derived, disposable, user-enabled Web Audio layer. Exterior-vacuum events may be represented only through justified ship/tether/cutter conduction, structural impact vibration, cockpit instrumentation, radio when later added, or non-diegetic music; ordinary airborne exterior sound is prohibited.
- INV-063: Collapse music intensity is derived from current measured collapse severity rather than a scripted timer. Audio enable/disable state must never change simulation state.
- INV-064: Production readability is not color-only. Risk, hazard, tool load/progress, and cargo condition retain explicit textual communication; the physical worksite and center reticle remain unobscured during the desktop proof path, and detailed telemetry is secondary progressive disclosure.
- INV-065: Phase 12 release readiness is scoped to the selected static desktop-Chromium concept target served over ordinary HTTP. CI frame-time evidence applies only to the recorded Ubuntu/Chrome/SwiftShader/`1280x900` reduced-motion environment and must not be generalized to untested browsers, devices, GPU tiers, native wrappers, or mobile thermals.
- INV-066: The concept-release simulation budget is at most `24` enabled rigid bodies in any shipped wreck scene; the current reference expectation is `7` including the craft. Sleeping/activation may reduce cost, but loose hazardous salvage must not be deleted merely to satisfy the budget.
- INV-067: Presentation impact debris is capped at the existing `14` pooled sparks. Effects age back to the pool and must not allocate unbounded debris or substitute for real wreck bodies.
- INV-068: `ProductionAudio` owns at most one live Web Audio context and seven production tone nodes across repeated mute/re-enable cycles. Toggling audio must reuse/suspend the existing graph rather than accumulate a second graph.
- INV-069: The protected progression key remains `orbital-scrapper-progression-v1`; Phase 12 maintains a synchronized last-known-good companion copy at `orbital-scrapper-progression-v1-backup`. A valid backup may heal a malformed/unsupported primary only without duplicating credits, upgrades, or run accounting.
- INV-070: Scenario `phase12-endurance-v1` is the selected CI performance gate: at least `300` recorded frame intervals, frame p95 `<= 33.4 ms`, frame p99 `<= 50 ms`, frames over `50 ms` `<= 2%`, and application frame-callback p95 `<= 20 ms`. Thresholds must not be relaxed merely to make a candidate pass.
- INV-071: Phase 12 presentation-cost optimization remains subordinate to INV-060 and the verified gameplay loop. Lower-cost materials, lower tessellation, and removal of dynamic shadow casting are acceptable only while exact hardpoints, body ownership, readable module identity, and all Phase 0–11 regressions remain green.

## Verified working behavior

### Phase 0 — Runtime, physics, and reset foundation

Original proof: `Phase 0 Runtime Gate` run `32326833764`. Latest Phase 12-head regression: `Phase 0 Regression Gate` run `32365511135`.

Verified: pinned dependencies; fixed-step simulation; collision/gravity fixture; runtime joint remove/recreate; clean repeated physics/presentation resets; input lifecycle; production typecheck/build.

### Phase 1 — Salvage craft flight

Original proof: `Phase 1 Flight Gate` run `32328133794`. Latest regression: `32365511245`.

Verified: dynamic Rapier craft; six-axis force/torque flight; fixed-step independence; inertial coasting and bounded braking; precision approach/translate/rotate/retreat; collision containment; reset/presenter cleanup.

### Phase 2 — Modular wreck physics

Original proof: `Phase 2 Wreck Gate` run `32328786755`. Latest regression: `32365511175`.

Verified: six stable reference-wreck components/six live joints; reusable attachment metadata; mass distinction; alternate rear load paths; coherent idle assembly; stable craft impact; exact reset; presentation uniqueness.

### Phase 3 — Cutting and physical separation

Original proof: `Phase 3 Cutting Gate` run `32331609212`. Latest regression: `32365511224`.

Verified: explicit cuttable metadata; range/aim/hold rules; exact joint removal preserving bodies/components; physical separation; cutter release latch; reachable-target-first selection; exact reconstruction.

### Phase 4 — Tether manipulation and bracing

Original proof: `Phase 4 Tether Gate` run `32333422171`. Latest regression: `32365511141`.

Verified: bounded equal-and-opposite tether force; winching; drift arrest/redirection; overload snap/rearm; bracing changes post-cut motion; removable-side targeting; clean release/reset.

### Phase 5 — Structural graph synchronization

Original proof: `Phase 5 Structural Graph Gate` run `32337246778`. Latest regression: `32365511259`.

Verified: exact physical-to-graph mirroring; connected-section/bridge/articulation facts; cut synchronization; temporary support separation; exact graph reset.

### Phase 6 — Scanner and structural criticality

Original proof: `Phase 6 Scanner Gate` run `32338441743`. Latest regression: `32365511241`.

Verified: live read-only structural estimates; low/moderate/high reference distinctions; inspectable bridge/alternate-path/articulation/mass/motion/support reasons; support-driven estimate changes; stale-target rejection; exact reset.

### Phase 7 — Collapse escalation and survival damage

Original proof: `Phase 7 Collapse Gate` run `32342058172`. Latest regression: `32365511269`.

Verified: Rapier contact-force evidence; simulation-derived severity/warnings; physical debris hull damage; continuing physics after destruction; thresholded impact-overload failure; stationary failure versus reverse-thrust survival; low-risk regression; tether trajectory change; exact reset.

### Phase 8 — Cargo capture, condition, and settlement

Original proof: `Phase 8 Cargo Gate` run `32343609183`. Latest regression: `Phase 8 Regression Gate` run `32365511227`.

Verified: detached-only cargo eligibility; physical tether/clamp recovery; default `1.35 m/s` speed rejection; measured-impact condition damage; metadata-adjusted fragility; condition-adjusted value; disabled secured cargo lifecycle; physical `11.5 m` extraction requirement; visible settlement; exact cargo/reset baseline.

### Phase 9 — Upgrade, persistence, and complete vertical slice

Original proof: `Phase 9 Vertical Slice Gate` run `32345788643`, job `96354158978`. Latest regression: `Phase 9 Regression Gate` run `32365511230`.

Verified:

- the complete reference-wreck player loop remains operational;
- run-scoped/idempotent settlement and failure accounting remains intact;
- Clamp Dampers still persists and applies only to a fresh run;
- the matched default-versus-upgraded `1.60 m/s` capture proof remains green;
- risk/value and cut-order consequence proofs remain green;
- destroyed-run physical recovery still rebuilds the exact reference baseline while preserving progression;
- progression still persists economic/run facts rather than simulation state.

### Phase 10 — Wreck variety and progression breadth

Original proof: `Phase 10 Breadth Gate` run `32352461479`, job `96374389172`. Latest regression: `Phase 10 Regression Gate` run `32365511557`.

Verified:

- `WreckCatalog` defines three reusable templates: `reference`, `relay-fork`, and `tank-hauler`;
- the `reference/intact` template remains the exact Phase 9 regression baseline;
- all three intact templates remain coherent under live Rapier simulation and rebuild from the same data-driven contract;
- bounded missing-section variants alter topology without scripted collapse branches;
- battery/sensor/tank/reactor classes preserve multi-tool compatibility and distinct mass/value/fragility decisions;
- Tether Reinforcement and Cutter Optics remain capability-changing persisted upgrades rather than payout multipliers;
- valid Phase 9 version-one saves migrate in place to version two under the protected storage key.

### Phase 11 — Production readability, visual assets, audio, and feel

Original proof: `Phase 11 Presentation Gate` run `32356960223`, job `96388110247`. Latest regression: `Phase 11 Regression Gate` run `32365511127`.

Verified:

- the Phase 11 presentation contract remains green after the Phase 12 performance optimization;
- TypeScript checking and the Vite production build pass;
- all Phase 10 component classes render through the same production presenter ownership path while preserving one top-level presentation object per physics body;
- production presenter rebuild/sync leaves authoritative Rapier body transforms and connection points unchanged;
- every visible production hardpoint marker tested matches the corresponding component-local attachment coordinate exactly;
- production craft/wreck geometry remains local procedural Three.js content with no external model/texture/font/audio dependency required by the verified path;
- `ProductionFx`, worksite/reticle layout, reduced-motion/focus/readability rules, and vacuum-aware audio authority boundaries remain regression-protected;
- Phase 12 reduces the reference presentation baseline from the historical Phase 11 `44` meshes to `34` meshes while keeping the complete production vertical slice green.

### Phase 12 — Performance, endurance, accessibility, and release readiness

Verified by `Phase 12 Release Readiness Gate` run `32365511137`, job `96414045259`, with every Phase 0–11 regression workflow green on the same final candidate head `3b0b7aeff7841a501e63fee7517c20d0fd9f822a`.

Verified:

- eighty-three of eighty-three combined tests pass;
- exact declared dependencies remain Three.js `0.185.0`, Rapier `0.19.3`, TypeScript `7.0.2`, and Vite `8.2.1` under Node `22.22.0` / npm `10.9.4` in the gate;
- every shipped concept-release wreck configuration remains inside the `24` enabled-rigid-body budget and uses Rapier sleeping/activation rather than a second simulation representation;
- secured cargo leaves expensive active physics only after the existing valid capture transition while preserving stable identity for settlement/reset;
- impact presentation uses the fixed reusable `14`-spark pool rather than unbounded debris allocation;
- Web Audio mute/re-enable reuses exactly one context and seven production nodes;
- last-known-good progression recovery heals a malformed primary from a valid backup without duplicating or losing progression;
- deterministic `npm run package:release` succeeds, producing the static package directory with three production build files plus release manifest/README; the packaged production payload reports `2,865,858` bytes before CI artifact compression;
- the final production JavaScript is approximately `2,855.06 KB` minified / `999.88 KB` gzip, with CSS approximately `10.26 KB` / `3.14 KB` gzip;
- three sequential complete salvage runs pass in one reduced-motion Chrome session with no equivalent-checkpoint listener/body/graph/presentation growth;
- the measured Phase 12 CI capture records `1,695` frame intervals, frame p95 `33.40 ms`, frame p99 `33.40 ms`, only `0.35%` frames over `50 ms`, and application callback p95 `3.30 ms`, satisfying the locked budget;
- the same endurance proof reports stable `10` active listeners, `34` presentation meshes, `3` completed runs, and `346` credits after the scripted sequence;
- the unchanged final Phase 9 production journey passes after endurance testing: scan -> cut -> tether -> capture -> return -> sell -> Clamp Dampers purchase -> next run -> reload, reporting `payout=166`, `credits=16`, clamp `2.00`, run IDs `1->2->3`, and condition `66.4`;
- release artifact `orbital-scrapper-phase12-release` was uploaded as Actions artifact ID `9405152876`; performance evidence artifact `orbital-scrapper-phase12-performance` was uploaded as ID `9405153345`;
- final Phase 0–11 regression runs `32365511135`, `32365511245`, `32365511175`, `32365511224`, `32365511141`, `32365511259`, `32365511241`, `32365511269`, `32365511227`, `32365511230`, `32365511557`, and `32365511127` all pass on the same candidate head;
- PR #13 was squash-merged to `main` as `9533e5b905bbdbeec1a613700af745910f61f1b8`.

## Implemented but unverified

None for the completed Phase 0–12 implementation sequence.

## Known not-working behavior

None established inside the selected static desktop-Chromium concept-release target.

## Known observations / deferred maintenance

- The final Phase 12 JavaScript bundle remains approximately `2.855 MB` minified / `999.88 KB` gzip. The measured release target passes despite that size; code splitting remains a future optimization opportunity rather than a Phase 12 blocker.
- The final CI frame p95 is exactly `33.40 ms`, equal to the declared Phase 12 ceiling. The selected CI target therefore passes with essentially no p95 headroom; future presentation/runtime additions must rerun the matched performance gate rather than assume spare budget.
- Rapier emits an initialization deprecation warning in tests. Behavior is verified; API cleanup remains deferred.
- GitHub Actions warns about deprecated internal Node 20 runtimes in `actions/checkout@v4`, `actions/setup-node@v4`, and `actions/upload-artifact@v4`; hosted runners force Node 24 and the gates pass. CI-action maintenance is deferred.
- Phase 1 handling constants remain proof values, not final tuning.
- The three Phase 10 wreck templates, component dimensions/masses, salvage values, fragility multipliers, and missing-section variants remain proof content even though Phase 11/12 give them production-readable procedural presentation.
- Phase 3 cutter thresholds/release impulse remain proof values.
- Phase 4 tether range/spring/damping/winch/overload limits remain proof values.
- Phase 5 graph reconciliation remains correctness-first and should be optimized only with profiling evidence.
- Phase 6 scanner ranges/weights/bands remain proof tuning even though production presentation now communicates the estimates.
- Phase 7 danger-fixture geometry/start, release impulse, severity/hull thresholds, overload threshold, and warning thresholds remain proof values.
- Phase 8 cargo proof constants remain: clamp radius `3 m`, default max relative speed `1.35 m/s`, damage impulse threshold `0.8 N·s`, condition conversion `10` points per excess `N·s`, extraction distance `11.5 m`.
- Phase 9 Clamp Dampers cost `150` and upgraded limit `2.00 m/s` remain proof balance values.
- Phase 10 Tether Reinforcement cost `140` / `105 N` and Cutter Optics cost `160` / `12 m` remain proof balance/capability values.
- Progression version two intentionally remains under browser key `orbital-scrapper-progression-v1`, now paired with `orbital-scrapper-progression-v1-backup` for last-known-good recovery. This is verified for the selected browser concept release, not a final cross-device/cloud-save decision.
- The current player-facing dock still exposes the original Clamp Dampers purchase path. Tether Reinforcement and Cutter Optics are verified persisted capability paths/configuration effects but do not yet have equivalent production-facing purchase controls.
- Phase 11/12 production assets remain local procedural geometry and generated Web Audio proof tones. They establish the production direction and verified concept-release integration contract but do not settle whether later authored models/textures/recordings replace or supplement them.
- Browser autoplay rules require the player to explicitly enable the verified Web Audio presentation layer; muted operation remains fully playable.
- The final Phase 12 integrated Phase 9 regression settled at `66.4%` condition and `166` proof-unit payout. This validates release compatibility with gameplay-derived value loss, not final economy/condition balance.
- Phase 12 gate history: the first two failures were harness defects involving document-reload loss of reduced-motion/instrumentation state; after the live-target harness was corrected, the third run exposed a real performance blocker at frame p95 `50.10 ms` against the locked `33.4 ms` ceiling. The final bounded presentation optimization reduced tessellation/material/shadow cost without changing physics/hardpoint authority and the fourth run passed without relaxing thresholds.
- Phase 11 gate history includes an out-of-range VFX test fixture and a Chrome-profile cleanup race; both were harness/test-only repairs and did not change production mechanics.
- Phase 10's first breadth gate failure was a test-fixture issue caused by advancing tether impulses without advancing Rapier; production tether constants were not changed.
- Phase 8 gate history includes an unsafe long browser thrust hold, a transient no-DevTools startup, and an overstrict pristine-cargo assumption; all were repaired without weakening the physical contract.
- Phase 9 pre-CI review caught a stale-run replay gap and tightened run accounting so only the currently issued run may settle/fail.

## Unknown / unresolved

- distribution beyond the selected static desktop-Chromium HTTP-served concept package, including native installers, signing/notarization, app stores, `file://` loading, service-worker/offline behavior, and cloud deployment policy
- final shipping control scheme beyond the verified keyboard layout, including configurable rebinding, gamepad support, and broader input-accessibility policy
- accessibility certification beyond current keyboard operability, visible focus, reduced motion, and non-color-only communication; screen-reader certification and a formal conformance level remain untested
- representative performance targets/results for consumer integrated/discrete GPUs, Safari, Firefox, mobile/tablet devices, thermals, and sustained sessions beyond the recorded CI environment
- final camera model beyond the current presentation-only chase camera
- final economy tuning/currency scale and upgrade catalog beyond the three verified proof upgrades
- final simultaneous tether count beyond the current single active proof tether
- final production save/storage strategy beyond the verified browser `localStorage` primary + last-known-good backup path, including cross-device sync/cloud behavior
- final production wreck dimensions, masses, attachment layouts, and whether content remains hand-authored templates or adds a bounded layout-generation strategy
- final cutter energy/heat model, tuning, and whether release impulse remains production behavior
- final tether tuning, targeting UX, failure model, and whether the proof spring/damping winch remains production behavior
- final scanner scoring/value/acquisition tuning beyond the verified production-readable presentation
- final collapse severity/hull/impact/secondary-break tuning beyond the verified production warning/audio presentation
- final cargo hardware/interaction, clamp shape, relative-speed rule, condition scale, impact mapping, values, payout formula, and secured-cargo unloading strategy
- final failure economy and preparation-dock breadth
- whether procedural Phase 11/12 geometry/audio remain final assets or become placeholders for a future provenance-tracked authored/external asset pipeline
- lifecycle behavior beyond three sequential full runs in one page session and beyond the selected CI runtime/device class

## Resolved decisions

- runtime/platform: browser-native Three.js application
- rendering: Three.js `0.185.0` / `WebGLRenderer`
- physics: `@dimforge/rapier3d-compat` `0.19.3`
- language/tooling: TypeScript `7.0.2` + Vite `8.2.1`
- simulation timing: fixed-step owner targeting `1/60` second
- simulation authority: Rapier; Three.js presentation mirrors physics transforms
- current controls: `W/S` thrust, `A/D` strafe, `R/F` vertical, arrows pitch/yaw, `Q/E` roll, `Space` brake, `C` cutter hold, `T` tether hold, `X` reset/recover; scanner targeting remains passive aim-based
- Phase 1: dynamic Rapier craft controlled by fixed-step forces/torques; braking is bounded counter-force/counter-torque
- Phase 2: stable component IDs/local attachment IDs; six-component/six-joint reference topology with alternate rear paths
- Phase 3: cutter removes selected live Rapier joint; reference proof targets are `spine-panel` and `spine-engine`; eligible targets precede blocked fallback tracking
- Phase 4: one active bounded physical spring/damping winch tether; post-cut targeting may favor the recorded removable side
- Phase 5: structural graph is a derived mirror; temporary tether support is not a permanent edge
- Phase 6: scanner is read-only derived interpretation; risk is an explainable estimate rather than authority
- Phase 7: contact-force evidence feeds hull/severity; impact overload may break only explicitly thresholded joints; destroyed state disables control while simulation continues
- Phase 8: only detached enabled non-spine unsecured components qualify as cargo; default capture limit is `1.35 m/s`; successful secure disables the cargo body; sale requires physical extraction to `11.5 m`
- Phase 9 progression authority: `ProgressionSystem` persists economic/run facts only through browser `localStorage`; simulation state remains reconstructed from verified physical baselines
- Phase 9 run accounting: `beginRun()` issues monotonically increasing IDs; only the currently issued run may settle/fail; each outcome is one-shot and mutually exclusive
- Phase 9 preparation state: successful settlement enters dock and banks payout; failure continues neutral physics until explicit `X` recovery returns a clean physical baseline to dock
- Phase 9 proof upgrade: `Clamp Dampers`, cost `150`, increases next-run capture ceiling from `1.35 m/s` to `2.00 m/s`
- Phase 10 wreck-content authority: `src/wreck/WreckCatalog.ts` declares template/component/connection/variant data consumed by the existing `WreckSandbox`; Phase 10 does not create a second simulation path
- Phase 10 verified template IDs: `reference`, `relay-fork`, `tank-hauler`
- Phase 10 bounded starting-state variants: Relay Fork `missing-right-rail`; Tank Hauler `missing-sensor`
- Phase 10 component metadata: `salvageValueUnits` and `cargoFragilityMultiplier` live with component definitions and feed scanner/cargo derivation
- Phase 10 progression schema: save version `2` migrates valid version `1` in place under the unchanged key `orbital-scrapper-progression-v1`
- Phase 10 proof upgrades: `Tether Reinforcement`, cost `140`, raises bounded max tension from `70 N` to `105 N`; `Cutter Optics`, cost `160`, raises cutter range from `9 m` to `12 m`
- Phase 11 production visual direction: utilitarian industrial salvage cockpit, near-black vacuum, restrained cold work lighting, shape-led module identity, and visible structural hardpoints at exact local attachment coordinates
- Phase 11 production HUD: worksite-dominant edge layout; mission/scan/hull/tool/objective information remains spatially separated from the center reticle; detailed telemetry is secondary disclosure
- Phase 11 production VFX: scanner/cutter/tether/cargo/thruster/impact effects are derived from live systems under disposable `phase11-fx-root`
- Phase 11 production audio: user-enabled Web Audio using ship/tether/cutter conduction, structural impact, cockpit instrumentation, and severity-driven non-diegetic music; ordinary-air exterior audio is excluded
- Phase 11 asset-source decision for the verified proof: local procedural Three.js geometry and generated Web Audio only; no external resource licensing/provenance burden was introduced
- Phase 12 concept-release target: static Vite production output served over ordinary HTTP in a desktop Chromium-class browser; no framework migration, native wrapper, cloud/account system, or installer is required for the verified target
- Phase 12 simulation budget: maximum `24` enabled rigid bodies across shipped concept-release wreck scenes; current reference expectation `7`; sleeping is allowed and secured cargo is explicitly disabled only after valid capture
- Phase 12 visual-debris budget: existing `14`-spark `ProductionFx` pool remains the upper bounded presentation-debris path
- Phase 12 performance gate: scenario `phase12-endurance-v1`, GitHub Ubuntu + headless Chrome + SwiftShader + `1280x900` + reduced motion, with locked p95/p99/slow-frame/callback thresholds in INV-070
- Phase 12 accessibility scope: existing keyboard controls + visible focus + reduced-motion support + non-color-only status communication; rebinding/gamepad/screen-reader certification remain out of scope
- Phase 12 save resilience: primary `orbital-scrapper-progression-v1` plus synchronized last-known-good `orbital-scrapper-progression-v1-backup`
- Phase 12 release package: `npm run package:release` -> `release/orbital-scrapper-web/` containing production files plus `RELEASE_MANIFEST.json` and `README.txt`; CI uploads this directory and the performance capture as release evidence
- Phase 12 production-rendering optimization: lower-cost `MeshLambertMaterial`, reduced primitive tessellation, and disabled dynamic shadow casting preserve exact hardpoints/body ownership while reducing the reference presentation baseline to `34` meshes

## Pending work

No further implementation phase is authorized by the current `IMPLEMENTATION_PLAN.md`. The proof-gated Phase 0–12 concept-release sequence is complete for the selected static desktop-Chromium target.

Any additional feature phase, broader platform release, production-content expansion, new accessibility commitment, consumer-hardware performance target, native packaging, or post-concept release program requires an explicit new contract/plan rather than silently inventing Phase 13.

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
10. Phase 9 — Upgrade, persistence, and complete vertical slice — **verified**
11. Phase 10 — Wreck variety and progression breadth — **verified**
12. Phase 11 — Production readability, visual assets, audio, and feel — **verified**
13. Phase 12 — Performance, endurance, accessibility, and release readiness — **verified**

The current staged plan is complete. A future phase requires an explicit new authorized plan and must preserve the verified Phase 0–12 invariants.

## Validation matrix

| ID | Claim | State | Required proof |
|---|---|---|---|
| VAL-000 | Runtime foundation is suitable | verified | Phase 0 proof `32326833764`; latest regression `32365511135` |
| VAL-001 | Full salvage loop works | verified | Phase 9 proof `32345788643`; final production Chrome regression inside Phase 12 run `32365511137` |
| VAL-002 | Structural graph tracks physical cuts | verified | Phase 5 proof `32337246778`; latest regression `32365511259` |
| VAL-003 | Dangerous cut produces simulated cascade | verified | Phase 7 proof `32342058172`; latest regression `32365511269` |
| VAL-004 | Tether changes dangerous outcome | verified | Phase 4 proof `32333422171`; latest regression `32365511141`; Phase 10 capability proof preserved |
| VAL-005 | Reset/recovery is clean | verified through Phase 12 | Phase 0–12 lifecycle/reset tests plus three-run endurance checkpoints and final full-loop regression |
| VAL-006 | Progression changes next run | verified | Phase 9 Clamp Dampers proof plus Phase 10 persisted Tether Reinforcement/Cutter Optics capability tests plus Phase 12 backup/reload proof |
| VAL-007 | Phase gates are respected | verified through Phase 12 | Phase 12 gate plus every Phase 0–11 regression passed on the same final head before merge |
| VAL-008 | Salvage craft flight is controllable | verified | Phase 1 proof `32328133794`; latest regression `32365511245` |
| VAL-009 | Modular wreck remains coherent and stable | verified across Phase 10 templates | Phase 2 proof `32328786755`; Phase 10 breadth proof; Phase 12 body-budget/regression proof |
| VAL-010 | Cutting removes intended physical connection and produces natural separation | verified | Phase 3 proof `32331609212`; latest regression `32365511224`; final production loop |
| VAL-011 | Tether manipulation/bracing materially change physical outcomes | verified | Phase 4 proof `32333422171`; latest regression `32365511141`; final production loop |
| VAL-012 | Structural graph mirrors live topology/support state | verified | Phase 5 proof `32337246778`; latest regression `32365511259`; three-run exact graph checkpoints |
| VAL-013 | Scanner explains current structural risk without stale/oracle behavior | verified | Phase 6 proof `32338441743`; latest regression `32365511241`; production scanner regression |
| VAL-014 | Structural mistakes escalate into readable survivable physical danger | verified | Phase 7 proof `32342058172`; latest regression `32365511269`; production warning/audio path preserved |
| VAL-015 | Salvage can be physically recovered, condition-valued, secured, returned, and settled | verified | Phase 8 proof `32343609183`; latest regression `32365511227`; final Phase 12 complete production loop |
| VAL-016 | Content/progression breadth works across varied wrecks without bespoke exceptions | verified | Phase 10 proof `32352461479`; latest regression `32365511557` |
| VAL-017 | Production presentation improves readability without obscuring the structural game | verified | Phase 11 proof `32356960223`; latest regression `32365511127`; Phase 12 exact hardpoint/body-ownership tests and full-loop proof after performance optimization |
| VAL-018 | Representative build is performance/endurance/accessibility/release ready | verified for selected static desktop-Chromium concept target | Phase 12 run `32365511137`, job `96414045259`: 83/83 tests, deterministic package, three-run reduced-motion endurance, last-known-good save recovery, 1,695-frame performance capture within locked budgets, final Phase 9 production loop, and all Phase 0–11 regressions green |

## Prohibitions

- Do not generalize Phase 12 release readiness beyond the selected static desktop-Chromium concept target or its recorded evidence envelope.
- Do not invent or begin Phase 13 without an explicit new authorized contract/implementation plan.
- Do not substitute scripted spectacle for structural simulation or hand-roll a physics engine.
- Do not use production presentation to mask gameplay, physics, content-variation, progression, lifecycle, performance, or accessibility failures.
- Do not move physics authority into Three.js transforms, presentation assets, VFX, audio state, scanner state, or persistence state.
- Do not replace physical craft/tether/cut/cargo movement with teleportation.
- Do not delete components to simulate cutting; completed cuts remove joints and leave bodies in simulation.
- Do not let graph, scanner, or progression state become physical authority or remain stale after physical topology changes.
- Do not encode tether braces as permanent wreck edges.
- Do not hard-code collapse severity to elapsed time, derive hull damage from proximity/scanner prediction, or break joints without explicit threshold plus measured impact evidence.
- Do not make every cut dangerous; the low-risk reference panel path remains protected.
- Do not classify intact/connected wreck components as cargo.
- Do not secure cargo merely because it is nearby; require physical tether/capture geometry and the active run's relative-speed rule.
- Do not damage cargo condition from scripted timers or scanner risk; require measured physical contact evidence, adjusted only by declared component fragility metadata.
- Do not leave secured/disabled cargo as a tether target, collapse threat, or visible loose-body representation.
- Do not settle before secure cargo and physical extraction.
- Do not credit the same run twice, credit stale run IDs, settle a failed run, or let a failed run erase prior progression.
- Do not apply newly purchased capability upgrades retroactively to the completed/active run; resolve their effects at a fresh-run boundary when integrated into a player run.
- Do not use capability upgrades as simple payout multipliers.
- Do not add bespoke tool exceptions for individual wreck templates/modules or replace varied physical behavior with scripted collapse sequences.
- Do not let visual assets move or redefine stable physics pivots, colliders, component IDs, or attachment points merely to suit artwork.
- Do not make exterior vacuum events sound like ordinary air; use justified conduction/instrumentation/cockpit/radio/music channels.
- Do not make risk, hazard direction, tether load, cutter progress, or cargo condition dependent on color alone.
- Do not let a production overlay cover the center worksite/reticle or hide the physical relationship it describes.
- Do not infer performance/release readiness from build success, short smoke tests, or current bundle size alone.
- Do not relax the Phase 12 locked performance thresholds to admit a future candidate; optimize or explicitly revise the release contract with new authority.

## Revision history

### Revision 15 — 2026-08-20

Phase 12 passed `Phase 12 Release Readiness Gate` run `32365511137`, job `96414045259`, while Phase 0–11 regression runs `32365511135`, `32365511245`, `32365511175`, `32365511224`, `32365511141`, `32365511259`, `32365511241`, `32365511269`, `32365511227`, `32365511230`, `32365511557`, and `32365511127` all passed on the same final candidate head. Eighty-three of eighty-three combined tests passed. The final Chrome endurance proof completed three full reduced-motion salvage runs with `1,695` measured frame intervals, p95 `33.40 ms`, p99 `33.40 ms`, `0.35%` slow frames over `50 ms`, callback p95 `3.30 ms`, stable `10` listeners, `34` presentation meshes, `3` completed runs, and `346` credits. Last-known-good save recovery, single-context/seven-node Web Audio reuse, the `24`-body simulation budget, `14`-spark presentation pool, deterministic static packaging, and exact fresh-run lifecycle checkpoints were promoted to verified state. The unchanged complete Phase 9 production loop passed after endurance with `payout=166`, `credits=16`, clamp `2.00`, run IDs `1->2->3`, and condition `66.4`. Release artifact ID `9405152876` and performance-evidence artifact ID `9405153345` were uploaded. Two early Phase 12 failures were harness-only reduced-motion/instrumentation setup defects; the corrected live-target harness then exposed a real p95 `50.10 ms` performance failure against the locked `33.4 ms` budget. A bounded presentation-only repair switched to lower-cost materials/tessellation and removed dynamic shadow casting without altering physics/hardpoint authority; the final run passed without relaxing thresholds. PR #13 was squash-merged to `main` as `9533e5b905bbdbeec1a613700af745910f61f1b8`. The `IMPLEMENTATION_PLAN.md` Phase 0–12 sequence is now complete; no Phase 13 is authorized.

### Revision 14 — 2026-08-20

Phase 11 passed `Phase 11 Presentation Gate` run `32356960223`, job `96388110247`, while Phase 0–10 regression runs `32356960147`, `32356960061`, `32356959982`, `32356960010`, `32356960257`, `32356960244`, `32356959944`, `32356960054`, `32356960344`, `32356960018`, and `32356959964` all passed on the same final head. Seventy-eight of seventy-eight combined tests passed. Promoted procedural production craft/wreck geometry, exact visible hardpoint preservation, worksite-dominant cockpit/HUD, derived scanner/cutter/tether/cargo/impact VFX, user-enabled vacuum-aware Web Audio, severity-driven collapse music, reduced-motion/focus/readability rules, and disposable presentation ownership to verified state. Production build passed at approximately `2.855 MB` JS / `999.94 KB` gzip and `10.26 KB` CSS / `3.14 KB` gzip. Phase 11 Chrome proof reported `44` presentation meshes, `spine-panel` scanner/cut, audio `ready`, tether target `panel`, and exact reset `6 nodes / 6 edges / 0 supports`. The unchanged complete Phase 9 Chrome loop also passed with production presentation enabled, reporting `payout=167`, `credits=17`, clamp `2.00 m/s`, run IDs `1->2->3`, and condition `66.8%`. The first Phase 11 attempt exposed an out-of-range VFX test fixture; the second passed all behavior but a Chrome-profile cleanup race falsely failed after success; both repairs were test/harness-only and did not change game mechanics or presentation behavior. PR #12 was squash-merged to `main` as `65789e5eca9dba475bd74ad694239b10faf93fad`. Phase 12 — Performance, Endurance, Accessibility, and Release Readiness became the only authorized implementation phase.

### Revision 13 — 2026-08-20

Phase 10 passed `Phase 10 Breadth Gate` run `32352461479`, job `96374389172`, while Phase 0–9 regression runs `32352461337`, `32352461323`, `32352461279`, `32352461296`, `32352461389`, `32352461149`, `32352461163`, `32352461081`, `32352461301`, and `32352461098` all passed on the same final head. Seventy-three of seventy-three combined tests passed. Promoted the data-driven `WreckCatalog`, three coherent wreck templates, bounded missing-section variants, new battery/sensor/tank/reactor component classes, per-component salvage value and cargo fragility, cross-template scanner/cutter/tether/cargo/collapse compatibility, Tether Reinforcement and Cutter Optics capability upgrades, and in-place version-one to version-two progression migration to verified state. TypeScript and Vite production build passed. The complete Phase 9 Chrome reference loop also passed after expansion with `payout=175`, `credits=25`, clamp `2.00 m/s`, run IDs `1->2->3`, and panel condition `70.2%`. The first Phase 10 gate attempt failed only the new tether-upgrade comparison fixture because it advanced tether impulses without stepping Rapier; the repair replaced that invalid setup with a matched `22 m/s` radial state and did not change production constants. PR #11 was squash-merged to `main` as `33100a2a77360ec9b18b64ba8de430d470c455e6`. Phase 11 — Production Readability, Visual Assets, Audio, and Feel became the only authorized implementation phase.

### Revision 12 — 2026-08-20

Phase 9 passed `Phase 9 Vertical Slice Gate` run `32345788643`, job `96354158978`, while Phase 0–8 regression runs `32345788636`, `32345788627`, `32345788660`, `32345788806`, `32345788677`, `32345788667`, `32345788651`, `32345788765`, and `32345788772` all passed on the same final head. Sixty-three of sixty-three combined tests passed. Promoted version-one progression persistence, run-scoped idempotent settlement/failure accounting, corrupt-save recovery, persistent credits, the one-upgrade dock purchase path, fresh-run-only Clamp Dampers application, matched base-versus-upgraded physical capture behavior at `1.60 m/s`, risk/value and cut-order consequence proof, destroyed-run physical recovery with preserved progression, production build, and the complete real Chrome loop to verified state. Final Chrome proof reported `payout=164`, persistent `credits=14`, upgraded clamp ceiling `2.00 m/s`, run IDs `1->2->3`, and panel condition `65.5%`. The verified Phase 9 implementation was squash-merged to `main` as `6592cd7e389d1b4396276a82c1cc5913343514f7`.

### Revision 11 — 2026-08-20

Phase 8 passed `Phase 8 Cargo Gate` run `32343609183` with all Phase 0–7 regressions green. Fifty-seven of fifty-seven tests passed. Promoted detached-only cargo eligibility, speed-gated physical capture, contact-derived condition/value, explicit secured-body disable behavior, physical extraction/settlement, exact reset, and the live Chrome recovery path. Final proof: `condition=65.0`, `payout=163`, `distance=11.95`, `reset=field`. Squash merge: `a6ce2f4f3aa9db50793b9216ee8df2dd94261802`.

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

Added `IMPLEMENTATION_PLAN.md` as the authoritative Phase 0–12 sequence beneath `BUILD_CONTRACT.md` and established proof-gated greybox-before-polish sequencing.

### Revision 1 — 2026-08-19

Initialized from the user's concept and `BUILD_CONTRACT.md`; all gameplay/runtime behavior remained pending until implementation evidence existed.