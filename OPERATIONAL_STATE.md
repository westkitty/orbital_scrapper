# OPERATIONAL STATE — ORBITAL SCRAPPER

project_id: `orbital_scrapper`
project_name: `Orbital Scrapper`
revision: 3
repository: `westkitty/orbital_scrapper`
default_branch: `main`

## Scope

Greenfield physics-driven salvage game governed by `BUILD_CONTRACT.md`, with execution sequencing governed by `IMPLEMENTATION_PLAN.md`.

## Current baseline

- `BUILD_CONTRACT.md` is the authoritative gameplay/build specification.
- `IMPLEMENTATION_PLAN.md` is the authoritative staged execution sequence for that contract.
- Phase 0 is implemented and verified on `main`.
- Current accepted runtime foundation: Three.js `0.185.0` + vanilla TypeScript `7.0.2` + Vite `8.2.1`, with `@dimforge/rapier3d-compat` `0.19.3` as physics authority.
- `docs/PHASE0_ARCHITECTURE.md` records the accepted Phase 0 architecture and proof.
- No Phase 1+ gameplay system is verified yet.

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

## Verified working behavior

### Phase 0 — Runtime, physics, and reset foundation

Verified by GitHub Actions `Phase 0 Runtime Gate`, run `32326833764`:

- exact declared Three.js, Rapier, TypeScript, and Vite dependencies install successfully;
- seven of seven Phase 0 tests pass;
- fixed-step simulation target is approximately `1/60` second within expected numeric precision;
- gravity and collision move a free rigid body downward and prevent it passing through the test ground;
- one fixed bridge constraint can be removed and recreated at runtime;
- twenty repeated physics resets preserve exact active-body and active-constraint counts;
- twenty presentation rebuilds preserve the managed Three.js scene-root/object count;
- input bindings attach idempotently and detach cleanly;
- TypeScript checking and Vite production build pass;
- the built app initializes in headless Chrome and reports four bodies with one active constraint.

## Implemented but unverified

None for the current authorized phase boundary.

## Known not-working behavior

None established in the accepted Phase 0 scope.

## Known observations / deferred maintenance

- Phase 0 production JavaScript is approximately `2.76 MB` minified / `975 KB` gzip. Bundle reduction and code splitting are deferred until they become relevant to a later performance gate; do not treat this as Phase 0 failure.
- Rapier emits an initialization deprecation warning in tests. Behavior is currently verified; API cleanup is deferred.
- GitHub Actions warns about deprecated internal Node 20 runtimes in `actions/checkout@v4` and `actions/setup-node@v4`; the hosted runner forces Node 24 and the gate passes. CI-action maintenance is deferred.

## Unknown / unresolved

- final distribution format
- final control scheme beyond Phase 1 proof requirements
- camera model beyond the minimum Phase 1 flight test
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

## Pending work

### Phase 1 — Salvage craft flight

This is the only authorized next implementation phase under the current staged plan.

Required proof set:

- replace or extend the disposable Phase 0 scene only as necessary to introduce one greybox salvage craft;
- implement six-degree-of-freedom or contract-equivalent precision flight controls;
- keep thrust, braking, and rotation independent of render frame rate through the fixed-step simulation path;
- expose enough diagnostics to inspect translational and rotational behavior;
- prove the craft can approach, stop near, translate around, and back away from a static target without debug manipulation;
- prove repeated reset still preserves the Phase 0 cleanup invariants;
- do not begin modular wreck physics, cutting, tether gameplay, scanner logic, structural graphs, cargo, economy, or production presentation until the Phase 1 gate passes.

## Staged implementation sequence

1. Phase 0 — Runtime, physics, and reset foundation — **verified**
2. Phase 1 — Salvage craft flight — **authorized next**
3. Phase 2 — Modular wreck physics — blocked by Phase 1
4. Phase 3 — Cutting and physical separation — blocked
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
| VAL-000 | Runtime foundation is suitable | verified | Phase 0 CI run `32326833764`: install + seven tests + build + browser smoke |
| VAL-001 | Full salvage loop works | pending | Direct runtime completion without debug controls |
| VAL-002 | Structural graph tracks physical cuts | pending | Runtime cut + graph/constraint inspection |
| VAL-003 | Dangerous cut produces simulated cascade | pending | Direct runtime observation |
| VAL-004 | Tether changes dangerous outcome | pending | Matched runtime comparison |
| VAL-005 | Reset is clean | verified for Phase 0 scope | Twenty repeated physics/presentation resets plus listener lifecycle tests |
| VAL-006 | Progression changes next run | pending | Save/settlement runtime proof |
| VAL-007 | Phase gates are respected | verified through Phase 0 | Phase 0 remained isolated until its CI gate passed |
| VAL-008 | Salvage craft flight is controllable | pending | Phase 1 direct flight test + fixed-step regression |

## Prohibitions

- Do not claim Phase 1+ gameplay systems are implemented or working before runtime evidence exists.
- Do not broaden first-playable scope before core-loop gates pass.
- Do not substitute scripted spectacle for structural simulation.
- Do not hand-roll a physics engine.
- Do not start a later implementation phase while the current phase gate is failed or unverified.
- Do not use production art, audio, or content expansion to mask unresolved greybox gameplay or physics failures.
- Do not move physics authority into Three.js presentation transforms.

## Revision history

### Revision 3 — 2026-08-19

Phase 0 passed its full verification gate and was merged to `main`. Accepted the Three.js + Rapier + TypeScript/Vite runtime foundation, promoted fixed-step physics, runtime joint lifecycle, repeated reset cleanup, listener cleanup, production build, and headless-browser initialization to verified state, recorded nonblocking bundle/API/CI maintenance observations, and authorized Phase 1 — Salvage Craft Flight as the only next implementation phase.

### Revision 2 — 2026-08-19

Added `IMPLEMENTATION_PLAN.md` as the authoritative execution sequence beneath `BUILD_CONTRACT.md`. Replaced the broad pending technical-proof bucket with a staggered Phase 0-12 dependency chain. Added phase-gate and greybox-before-polish invariants. All runtime behavior remained pending because no implementation evidence existed yet.

### Revision 1 — 2026-08-19

Initialized from the user's concept and the authoritative `BUILD_CONTRACT.md`. Repository was empty before this project specification pass. All gameplay/runtime states remained pending or unknown until implementation evidence existed.
