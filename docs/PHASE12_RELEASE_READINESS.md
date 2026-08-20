# Phase 12 Release Readiness Policy

## Selected concept-release target

Orbital Scrapper's Phase 12 concept release is a static production web build for a desktop Chromium-class browser using the existing WebGL renderer and keyboard controls.

The automated release gate runs the production build on a GitHub-hosted Ubuntu runner in headless Google Chrome at a `1280x900` viewport with SwiftShader. Performance numbers from that gate describe only that recorded software-rendered CI environment. They are not evidence for mobile thermals, integrated/discrete consumer GPUs, Safari, Firefox, or untested Chromium hardware.

The concept release does not require a framework migration, native wrapper, cloud service, account system, or installer. The selected package is the self-contained Vite production output plus a deterministic release manifest.

## Protected gameplay contract

Performance hardening may not remove the physical reason the game exists.

- Rapier remains authoritative for craft, wreck, detached salvage, constraints, and collision.
- All shipped wreck components remain real physical bodies while relevant to salvage play.
- Inactive wreck components may use Rapier sleeping and must be able to wake normally.
- Secured cargo may leave expensive active simulation only after the existing valid capture transition; its stable cargo/body record remains available for settlement and reset identity.
- Presentation debris remains a bounded visual pool and never substitutes for physical wreck bodies.
- Cleanup may not delete loose hazardous salvage merely to satisfy a performance budget.

## Runtime budgets

These budgets are declared before the Phase 12 candidate is measured.

### Simulation budget

- Maximum enabled rigid bodies in any shipped concept-release wreck scene: **24**.
- Current reference body count expectation: **7** including the craft.
- Inactive wreck bodies use Rapier sleeping/activation rather than a second simulation representation.
- Secured cargo is explicitly disabled from active Rapier simulation after a valid capture.
- Presentation impact debris is capped at the existing **14 pooled sparks**; effects age back to an idle pool rather than allocate unbounded debris.

### CI frame-time budget

Scenario ID: `phase12-endurance-v1`.

Environment: production Vite build, headless Google Chrome, GitHub-hosted Ubuntu, SwiftShader, `1280x900`, reduced-motion preference enabled, warm application after initial boot.

The instrumented capture wraps callbacks submitted to the application's existing `requestAnimationFrame` owner. It does not create a second animation loop.

After the initial warm-up, the recorded scenario must contain at least **300 frame intervals** and satisfy:

- frame delta p95: **<= 33.4 ms**;
- frame delta p99: **<= 50 ms**;
- frames over **50 ms**: **<= 2%**;
- application frame-callback work p95: **<= 20 ms**.

These are release-gate thresholds for the recorded CI environment, not universal hardware claims.

### Lifecycle budget

Across three sequential full salvage runs in one page session:

- fresh-run body records return to exactly the reference baseline;
- fresh-run graph returns to exactly `6 nodes / 6 edges / 0 supports`;
- production presentation mesh count returns to the same baseline;
- JavaScript-observed active event-listener count does not grow between equivalent fresh-run checkpoints;
- progression completion/failure accounting changes exactly once per run;
- the Web Audio implementation owns at most one live context and seven production tone nodes across repeated mute/re-enable cycles;
- save reload/recovery must not duplicate or lose credits, upgrades, or run accounting.

Browser heap is captured as diagnostic evidence only. Garbage collection and engine-native allocations make zero-delta heap assertions inappropriate for this gate; a heap observation alone cannot prove or disprove a resource leak.

## Accessibility configuration

The selected concept-release accessibility configuration is the existing keyboard-operable interface plus explicit reduced-motion support.

- `prefers-reduced-motion: reduce` suppresses nonessential CSS motion.
- All required Phase 9 salvage controls remain keyboard-operable under the reduced-motion configuration.
- Primary buttons retain visible keyboard focus treatment.
- Risk, hazard direction, tether load, cutter progress, and cargo condition are not communicated by color alone.

Phase 12 does **not** claim configurable key rebinding, gamepad accessibility, screen-reader certification, or a full accessibility conformance level. Those remain platform/product-expansion decisions beyond this bounded concept release.

## Save resilience

The protected primary key remains `orbital-scrapper-progression-v1` so existing validated saves continue migrating in place.

Phase 12 adds a last-known-good companion copy. Every committed progression mutation writes the same validated version-two payload to the backup and primary keys. If the primary payload is malformed or unsupported while the backup remains valid, startup restores the backup and heals the primary without reopening stale run accounting.

## Release package

Run:

```sh
npm run package:release
```

The command builds the production site and writes:

```text
release/orbital-scrapper-web/
  index.html
  assets/...
  RELEASE_MANIFEST.json
  README.txt
```

`RELEASE_MANIFEST.json` records each packaged production file's relative path, byte count, and SHA-256 digest. The directory is the Phase 12 release artifact uploaded by CI.

Serve the package from an ordinary static HTTP server. The concept release does not claim `file://` loading, offline service-worker behavior, native installation, signing, notarization, or store distribution.

## Phase 12 completion standard

Phase 12 may be promoted only when:

1. focused release-hardening tests pass;
2. the deterministic package is produced successfully;
3. three sequential complete salvage runs pass under reduced-motion configuration without lifecycle-count growth;
4. the declared CI frame-time budget passes in the recorded environment;
5. primary-save corruption recovers from the last-known-good copy without progression loss or duplication;
6. the unchanged complete production Phase 9 journey passes after endurance testing;
7. all Phase 0-11 regression workflows pass on the same candidate head.

Release-candidate readiness is scoped to the selected static desktop-Chromium concept target. Untested browsers, consumer hardware performance, mobile thermals, and broader accessibility certification remain explicit unknowns.
