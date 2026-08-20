# OPERATIONAL STATE — ORBITAL SCRAPPER

project_id: `orbital_scrapper`
project_name: `Orbital Scrapper`
revision: 14
repository: `westkitty/orbital_scrapper`
default_branch: `main`

## Scope

Greenfield physics-driven salvage game governed by `BUILD_CONTRACT.md`, with execution sequencing governed by `IMPLEMENTATION_PLAN.md`.

## Current baseline

- `BUILD_CONTRACT.md` is the authoritative gameplay/build specification.
- `IMPLEMENTATION_PLAN.md` is the authoritative staged execution sequence for that contract.
- Phases 0 through 11 are implemented and verified on `main`.
- Current accepted runtime foundation: Three.js `0.185.0` + vanilla TypeScript `7.0.2` + Vite `8.2.1`, with `@dimforge/rapier3d-compat` `0.19.3` as physics authority.
- `docs/PHASE0_ARCHITECTURE.md` records the accepted Phase 0 architecture and proof.
- `docs/PHASE11_PRESENTATION.md` records the accepted production-presentation direction, authority boundaries, vacuum-audio rules, HUD hierarchy, and accessibility/readability constraints.
- The current player-facing baseline is the complete reference-wreck salvage loop with production presentation enabled: structural scan and risk/value readout, physical flight/cutting/tethering, collapse/hull consequences, physical cargo capture and condition, extraction/sale, persistent credits, preparation dock, Clamp Dampers purchase, and a fresh next run that applies the persisted upgrade.
- Phase 10 data-driven breadth remains verified behind the same mechanics: three wreck templates, bounded missing-section variants, per-component value/fragility metadata, and two additional persisted capability upgrades.
- Phase 11 replaces the greybox presentation with local procedural production geometry, visible structural hardpoints, an edge-distributed cockpit HUD, derived scanner/cutter/tether/cargo/impact VFX, and user-enabled vacuum-aware Web Audio without changing simulation authority.
- No Phase 12 performance/endurance/release-readiness claims are verified yet.

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

## Verified working behavior

### Phase 0 — Runtime, physics, and reset foundation

Original proof: `Phase 0 Runtime Gate` run `32326833764`. Current Phase 11-head regression: `Phase 0 Regression Gate` run `32356960147`.

Verified: pinned dependencies; fixed-step simulation; collision/gravity fixture; runtime joint remove/recreate; clean repeated physics/presentation resets; input lifecycle; production typecheck/build.

### Phase 1 — Salvage craft flight

Original proof: `Phase 1 Flight Gate` run `32328133794`. Current regression: `32356960061`.

Verified: dynamic Rapier craft; six-axis force/torque flight; fixed-step independence; inertial coasting and bounded braking; precision approach/translate/rotate/retreat; collision containment; reset/presenter cleanup.

### Phase 2 — Modular wreck physics

Original proof: `Phase 2 Wreck Gate` run `32328786755`. Current regression: `32356959982`.

Verified: six stable reference-wreck components/six live joints; reusable attachment metadata; mass distinction; alternate rear load paths; coherent idle assembly; stable craft impact; exact reset; presentation uniqueness.

### Phase 3 — Cutting and physical separation

Original proof: `Phase 3 Cutting Gate` run `32331609212`. Current regression: `32356960010`.

Verified: explicit cuttable metadata; range/aim/hold rules; exact joint removal preserving bodies/components; physical separation; cutter release latch; reachable-target-first selection; exact reconstruction.

### Phase 4 — Tether manipulation and bracing

Original proof: `Phase 4 Tether Gate` run `32333422171`. Current regression: `32356960257`.

Verified: bounded equal-and-opposite tether force; winching; drift arrest/redirection; overload snap/rearm; bracing changes post-cut motion; removable-side targeting; clean release/reset.

### Phase 5 — Structural graph synchronization

Original proof: `Phase 5 Structural Graph Gate` run `32337246778`. Current regression: `32356960244`.

Verified: exact physical-to-graph mirroring; connected-section/bridge/articulation facts; cut synchronization; temporary support separation; exact graph reset.

### Phase 6 — Scanner and structural criticality

Original proof: `Phase 6 Scanner Gate` run `32338441743`. Current regression: `32356959944`.

Verified: live read-only structural estimates; low/moderate/high reference distinctions; inspectable bridge/alternate-path/articulation/mass/motion/support reasons; support-driven estimate changes; stale-target rejection; exact reset.

### Phase 7 — Collapse escalation and survival damage

Original proof: `Phase 7 Collapse Gate` run `32342058172`. Current regression: `32356960054`.

Verified: Rapier contact-force evidence; simulation-derived severity/warnings; physical debris hull damage; continuing physics after destruction; thresholded impact-overload failure; stationary failure versus reverse-thrust survival; low-risk regression; tether trajectory change; exact reset.

### Phase 8 — Cargo capture, condition, and settlement

Original proof: `Phase 8 Cargo Gate` run `32343609183`. Current regression: `Phase 8 Regression Gate` run `32356960344`.

Verified: detached-only cargo eligibility; physical tether/clamp recovery; default `1.35 m/s` speed rejection; measured-impact condition damage; metadata-adjusted fragility; condition-adjusted value; disabled secured cargo lifecycle; physical `11.5 m` extraction requirement; visible settlement; exact cargo/reset baseline.

### Phase 9 — Upgrade, persistence, and complete vertical slice

Original proof: `Phase 9 Vertical Slice Gate` run `32345788643`, job `96354158978`. Current Phase 11-head regression: `Phase 9 Regression Gate` run `32356960018`.

Verified:

- the complete reference-wreck player loop remains operational;
- run-scoped/idempotent settlement and failure accounting remains intact;
- Clamp Dampers still persists and applies only to a fresh run;
- the matched default-versus-upgraded `1.60 m/s` capture proof remains green;
- risk/value and cut-order consequence proofs remain green;
- destroyed-run physical recovery still rebuilds the exact reference baseline while preserving progression;
- progression still persists economic/run facts rather than simulation state.

### Phase 10 — Wreck variety and progression breadth

Original proof: `Phase 10 Breadth Gate` run `32352461479`, job `96374389172`. Current Phase 11-head regression: `Phase 10 Regression Gate` run `32356959964`.

Verified:

- `WreckCatalog` defines three reusable templates: `reference`, `relay-fork`, and `tank-hauler`;
- the `reference/intact` template remains the exact Phase 9 regression baseline;
- all three intact templates remain coherent under live Rapier simulation and rebuild from the same data-driven contract;
- bounded missing-section variants alter topology without scripted collapse branches;
- battery/sensor/tank/reactor classes preserve multi-tool compatibility and distinct mass/value/fragility decisions;
- Tether Reinforcement and Cutter Optics remain capability-changing persisted upgrades rather than payout multipliers;
- valid Phase 9 version-one saves migrate in place to version two under the protected storage key.

### Phase 11 — Production readability, visual assets, audio, and feel

Verified by `Phase 11 Presentation Gate` run `32356960223`, job `96388110247`, with every Phase 0–10 regression workflow green on the same final head.

Verified:

- seventy-eight of seventy-eight combined tests pass;
- TypeScript checking and the Vite production build pass;
- Phase 11 production JavaScript is approximately `2.855 MB` minified / `999.94 KB` gzip; production CSS is approximately `10.26 KB` minified / `3.14 KB` gzip;
- all Phase 10 component classes render through the same production presenter ownership path while preserving one top-level presentation object per physics body;
- production presenter rebuild/sync leaves authoritative Rapier body transforms and connection points unchanged;
- every visible production hardpoint marker tested matches the corresponding component-local attachment coordinate exactly;
- the production salvage craft and wreck modules use local procedural Three.js geometry; no external models, textures, fonts, visual libraries, audio files, or third-party recordings are required by the verified proof path;
- `ProductionFx` provides live scanner, cutter-progress, tether-load, cargo-envelope, thruster, and measured-impact communication without mutating physical topology;
- tether presentation changes color with measured load while also retaining explicit text load communication;
- the center worksite remains the dominant viewport and the production scanner card does not overlap the center reticle in the `1280x900` Chrome proof;
- detailed telemetry is collapsed during normal play and remains available through native progressive disclosure;
- reduced-motion presentation rules and keyboard-visible control focus are present in the production interface;
- the Web Audio graph is user-enabled and disposable; the verified channel set is ship hum, thruster conduction, tether conduction, cutter conduction, impact structure, warning instrumentation, and collapse music;
- no ordinary-air exterior audio channel is present in the verified Phase 11 mix;
- collapse-music gain rises monotonically with measured `CollapseSystem.severityScore` in focused tests;
- headless Google Chrome completes the production presentation path with `44` presentation meshes, live `spine-panel` scanner target, user-enabled audio state `ready`, physical cutter completion on `spine-panel`, physical tether target `panel`, and exact reset to `6 nodes / 6 edges / 0 supports`;
- the unchanged complete Phase 9 Chrome journey then passes with production presentation enabled: scan -> cut -> tether -> capture -> return -> sell -> Clamp Dampers purchase -> next run -> reload;
- that final integrated Chrome proof reports `payout=167`, persistent `credits=17`, upgraded clamp ceiling `2.00 m/s`, run IDs `1 -> 2 -> 3`, and recovered panel condition `66.8%`;
- final Phase 0–10 regression runs `32356960147`, `32356960061`, `32356959982`, `32356960010`, `32356960257`, `32356960244`, `32356959944`, `32356960054`, `32356960344`, `32356960018`, and `32356959964` all pass on the same Phase 11 candidate head;
- the final authorship scrub found no model/assistant/generation credit or process residue in the changed user-facing presentation surfaces.

## Implemented but unverified

None for the current authorized phase boundary.

## Known not-working behavior

None established in the accepted Phase 0–11 scope.

## Known observations / deferred maintenance

- Phase 11 production JavaScript is approximately `2.855 MB` minified / `999.94 KB` gzip. Bundle reduction/code splitting and representative runtime profiling are Phase 12 work.
- Rapier emits an initialization deprecation warning in tests. Behavior is verified; API cleanup remains deferred.
- GitHub Actions warns about deprecated internal Node 20 runtimes in `actions/checkout@v4` and `actions/setup-node@v4`; hosted runners force Node 24 and the gates pass. CI-action maintenance is deferred.
- Phase 1 handling constants remain proof values, not final tuning.
- The three Phase 10 wreck templates, component dimensions/masses, salvage values, fragility multipliers, and missing-section variants remain proof content even though Phase 11 gives them production-readable procedural presentation.
- Phase 3 cutter thresholds/release impulse remain proof values.
- Phase 4 tether range/spring/damping/winch/overload limits remain proof values.
- Phase 5 graph reconciliation remains correctness-first and should be optimized only with profiling evidence.
- Phase 6 scanner ranges/weights/bands remain proof tuning even though production presentation now communicates the estimates.
- Phase 7 danger-fixture geometry/start, release impulse, severity/hull thresholds, overload threshold, and warning thresholds remain proof values.
- Phase 8 cargo proof constants remain: clamp radius `3 m`, default max relative speed `1.35 m/s`, damage impulse threshold `0.8 N·s`, condition conversion `10` points per excess `N·s`, extraction distance `11.5 m`.
- Phase 9 Clamp Dampers cost `150` and upgraded limit `2.00 m/s` remain proof balance values.
- Phase 10 Tether Reinforcement cost `140` / `105 N` and Cutter Optics cost `160` / `12 m` remain proof balance/capability values.
- Progression stores version-two data under the intentionally unchanged browser `localStorage` key `orbital-scrapper-progression-v1`. This is verified for the concept build, not yet a final cross-device/cloud save decision.
- The current player-facing dock still exposes the original Clamp Dampers purchase path. Tether Reinforcement and Cutter Optics are verified persisted capability paths/configuration effects but do not yet have equivalent production-facing purchase controls.
- Phase 11 production assets are local procedural geometry and generated Web Audio proof tones. They establish the production direction and integration contract but do not settle whether later authored models/textures/recordings replace or supplement them.
- Browser autoplay rules require the player to explicitly enable the verified Web Audio presentation layer; muted operation remains fully playable.
- The live Phase 11 integrated recovery settled at `66.8%` condition and `167` proof-unit payout. This validates presentation compatibility with gameplay-derived value loss, not final economy/condition balance.
- The first Phase 11 gate attempt passed seventy-seven of seventy-eight tests; its only failure was a VFX-only fixture that attempted a real tether attach from beyond the protected tether range. The fixture was corrected to test presentation diagnostics independently; production tether behavior was unchanged.
- The second Phase 11 gate attempt passed all tests/build/browser behavior but initially returned failure after the success line because Chrome was still releasing its temporary profile during cleanup. Profile deletion was made best-effort after browser shutdown; all behavioral assertions remained strict.
- Phase 10's first breadth gate failure was a test-fixture issue caused by advancing tether impulses without advancing Rapier; production tether constants were not changed.
- Phase 8 gate history includes an unsafe long browser thrust hold, a transient no-DevTools startup, and an overstrict pristine-cargo assumption; all were repaired without weakening the physical contract.
- Phase 9 pre-CI review caught a stale-run replay gap and tightened run accounting so only the currently issued run may settle/fail.

## Unknown / unresolved

- final distribution/package format and supported deployment target
- final shipping control scheme, input rebinding policy, and accessibility control set beyond current keyboard controls
- final performance targets by representative device/browser tier
- final camera model beyond the current presentation-only chase camera
- final economy tuning/currency scale and upgrade catalog beyond the three verified proof upgrades
- final simultaneous tether count beyond the current single active proof tether
- final production save format, migration/backups, cross-device behavior, and whether browser `localStorage` remains appropriate
- final production wreck dimensions, masses, attachment layouts, and whether content remains hand-authored templates or adds a bounded layout-generation strategy
- final cutter energy/heat model, tuning, and whether release impulse remains production behavior
- final tether tuning, targeting UX, failure model, and whether the proof spring/damping winch remains production behavior
- final scanner scoring/value/acquisition tuning beyond the verified production-readable presentation
- final collapse severity/hull/impact/secondary-break tuning beyond the verified production warning/audio presentation
- final cargo hardware/interaction, clamp shape, relative-speed rule, condition scale, impact mapping, values, payout formula, and secured-cargo unloading strategy
- final failure economy and preparation-dock breadth
- whether procedural Phase 11 geometry/audio remain final assets or become placeholders for a future provenance-tracked authored/external asset pipeline
- long-session audio/geometry/resource lifecycle behavior beyond the current focused disposal/reset checks

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

## Pending work

### Phase 12 — Performance, endurance, accessibility, and release readiness

This is the only authorized next implementation phase under the current staged plan.

Required proof set:

- establish and enforce a representative active rigid-body budget and sleeping/activation policy;
- define debris cleanup/deactivation and secured-cargo simulation-budget behavior without breaking the salvage contract;
- prove resource, listener, Three.js, Web Audio, and gameplay-state cleanup across repeated full runs;
- harden save/progression resilience for the selected release path;
- add the input rebinding/accessibility controls appropriate to the selected target and prove required controls remain usable;
- preserve failure recovery and exact playable restart behavior;
- select and document the release/package path for the target platform;
- add diagnostics sufficient to reproduce performance/lifecycle failures;
- prove multiple complete salvage runs can execute sequentially without accumulating duplicate bodies, constraints, listeners, audio instances, stale graph/support/cargo state, or progression accounting;
- define a representative performance target and prove representative collapses stay within it on the tested runtime/device class;
- prove save/load does not duplicate or lose progression in the tested release path;
- rerun the complete production-presentation vertical slice on a representative production wreck after endurance testing;
- do not claim release-candidate readiness until these checks pass.

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
13. Phase 12 — Performance, endurance, accessibility, and release readiness — **authorized next**

Each phase requires focused direct testing plus the smallest relevant regression check before completion can be claimed.

## Validation matrix

| ID | Claim | State | Required proof |
|---|---|---|---|
| VAL-000 | Runtime foundation is suitable | verified | Phase 0 proof `32326833764`; current regression `32356960147` |
| VAL-001 | Full salvage loop works | verified | Phase 9 proof `32345788643`; production-presentation Chrome regression inside Phase 11 run `32356960223` |
| VAL-002 | Structural graph tracks physical cuts | verified | Phase 5 proof `32337246778`; current regression `32356960244` |
| VAL-003 | Dangerous cut produces simulated cascade | verified | Phase 7 proof `32342058172`; current regression `32356960054` |
| VAL-004 | Tether changes dangerous outcome | verified | Phase 4 proof `32333422171`; current regression `32356960257`; Phase 10 capability proof preserved |
| VAL-005 | Reset/recovery is clean | verified through Phase 11 | Phase 0–11 lifecycle/reset tests plus Phase 11 browser reset to `6 nodes / 6 edges / 0 supports` |
| VAL-006 | Progression changes next run | verified | Phase 9 Clamp Dampers proof plus Phase 10 persisted Tether Reinforcement/Cutter Optics capability tests |
| VAL-007 | Phase gates are respected | verified through Phase 11 | Phase 11 gate plus all Phase 0–10 regressions passed on the same final head before merge |
| VAL-008 | Salvage craft flight is controllable | verified | Phase 1 proof `32328133794`; current regression `32356960061` |
| VAL-009 | Modular wreck remains coherent and stable | verified across Phase 10 templates | Phase 2 proof `32328786755`; Phase 10 breadth proof; current presentation regression |
| VAL-010 | Cutting removes intended physical connection and produces natural separation | verified | Phase 3 proof `32331609212`; current regression `32356960010`; live Phase 11 Chrome cut |
| VAL-011 | Tether manipulation/bracing materially change physical outcomes | verified | Phase 4 proof `32333422171`; current regression `32356960257`; live Phase 11 Chrome tether |
| VAL-012 | Structural graph mirrors live topology/support state | verified | Phase 5 proof `32337246778`; current regression `32356960244`; Phase 11 exact reset |
| VAL-013 | Scanner explains current structural risk without stale/oracle behavior | verified | Phase 6 proof `32338441743`; current regression `32356959944`; production scanner presentation proof |
| VAL-014 | Structural mistakes escalate into readable survivable physical danger | verified | Phase 7 proof `32342058172`; current regression `32356960054`; Phase 11 warning/audio presentation is derived from same live severity |
| VAL-015 | Salvage can be physically recovered, condition-valued, secured, returned, and settled | verified | Phase 8 proof `32343609183`; current regression `32356960344`; complete production Phase 9 Chrome loop |
| VAL-016 | Content/progression breadth works across varied wrecks without bespoke exceptions | verified | Phase 10 proof `32352461479`; current regression `32356959964` |
| VAL-017 | Production presentation improves readability without obscuring the structural game | verified | Phase 11 run `32356960223`, job `96388110247`: 78/78 tests, exact hardpoint preservation, worksite/reticle layout proof, live scanner/cutter/tether/audio Chrome path, build, and unchanged complete Phase 9 Chrome regression |
| VAL-018 | Representative build is performance/endurance/accessibility/release ready | pending | Phase 12 endurance/performance/accessibility/save/package gate plus production vertical-slice regression |

## Prohibitions

- Do not claim Phase 12 release readiness before runtime/endurance/package evidence exists.
- Do not start a later release claim while the Phase 12 gate is failed or unverified.
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

## Revision history

### Revision 14 — 2026-08-20

Phase 11 passed `Phase 11 Presentation Gate` run `32356960223`, job `96388110247`, while Phase 0–10 regression runs `32356960147`, `32356960061`, `32356959982`, `32356960010`, `32356960257`, `32356960244`, `32356959944`, `32356960054`, `32356960344`, `32356960018`, and `32356959964` all passed on the same final head. Seventy-eight of seventy-eight combined tests passed. Promoted procedural production craft/wreck geometry, exact visible hardpoint preservation, worksite-dominant cockpit/HUD, derived scanner/cutter/tether/cargo/impact VFX, user-enabled vacuum-aware Web Audio, severity-driven collapse music, reduced-motion/focus/readability rules, and disposable presentation ownership to verified state. Production build passed at approximately `2.855 MB` JS / `999.94 KB` gzip and `10.26 KB` CSS / `3.14 KB` gzip. Phase 11 Chrome proof reported `44` presentation meshes, `spine-panel` scanner/cut, audio `ready`, tether target `panel`, and exact reset `6 nodes / 6 edges / 0 supports`. The unchanged complete Phase 9 Chrome loop also passed with production presentation enabled, reporting `payout=167`, `credits=17`, clamp `2.00 m/s`, run IDs `1->2->3`, and condition `66.8%`. The first Phase 11 attempt exposed an out-of-range VFX test fixture; the second passed all behavior but a Chrome-profile cleanup race falsely failed after success; both repairs were test/harness-only and did not change game mechanics or presentation behavior. PR #12 was squash-merged to `main` as `65789e5eca9dba475bd74ad694239b10faf93fad`. Phase 12 — Performance, Endurance, Accessibility, and Release Readiness is now the only authorized implementation phase.

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
