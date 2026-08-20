# OPERATIONAL STATE — ORBITAL SCRAPPER

project_id: `orbital_scrapper`
project_name: `Orbital Scrapper`
revision: 2
repository: `westkitty/orbital_scrapper`
default_branch: `main`

## Scope

Greenfield physics-driven salvage game governed by `BUILD_CONTRACT.md`, with execution sequencing governed by `IMPLEMENTATION_PLAN.md`.

## Current baseline

- Repository began empty.
- `BUILD_CONTRACT.md` is the current authoritative gameplay/build specification.
- `IMPLEMENTATION_PLAN.md` is the current authoritative staged execution sequence for that contract.
- The implementation plan decomposes development into Phases 0 through 12, with a direct test gate and regression check at each boundary.
- No engine, framework, platform, implementation, assets, tests, or runtime behavior are yet verified.

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

## Verified working behavior

None. No runtime implementation exists yet.

## Implemented but unverified

None.

## Known not-working behavior

None established. Absence of implementation is not classified as a defect.

## Unknown / unresolved

- target platform and distribution format
- engine/framework
- physics library
- control scheme
- camera model
- art direction details and palette
- economy tuning
- simultaneous tether count beyond initial proof
- save format

## Pending work

### Phase 0 — Runtime, physics, and reset foundation

This is the only authorized next implementation phase under the current staged plan.

Required proof set:

- record engine/framework and physics choice in a short architecture note
- establish project boot path and stable physics timestep/equivalent
- create a minimal physics test scene
- create and remove a runtime constraint
- establish clean scene reset/reload behavior
- add basic development diagnostics for active rigid bodies and constraints
- prove repeated reset does not visibly duplicate bodies, constraints, listeners, or scene instances

Do not begin flight controls, modular wreck production, art sourcing, or content generation until Phase 0 passes.

## Staged implementation sequence

1. Phase 0 — Runtime, physics, and reset foundation
2. Phase 1 — Salvage craft flight
3. Phase 2 — Modular wreck physics
4. Phase 3 — Cutting and physical separation
5. Phase 4 — Tether manipulation and bracing
6. Phase 5 — Structural graph synchronization
7. Phase 6 — Scanner and structural criticality
8. Phase 7 — Collapse escalation and survival damage
9. Phase 8 — Cargo capture, condition, and settlement
10. Phase 9 — Upgrade, persistence, and complete vertical slice
11. Phase 10 — Wreck variety and progression breadth
12. Phase 11 — Production readability, visual assets, audio, and feel
13. Phase 12 — Performance, endurance, accessibility, and release readiness

Each phase requires focused direct testing plus the smallest relevant regression check before the next phase begins.

## Validation matrix

| ID | Claim | State | Required proof |
|---|---|---|---|
| VAL-000 | Runtime foundation is suitable | pending | Runtime launch, constraint create/remove, repeated clean reset |
| VAL-001 | Full salvage loop works | pending | Direct runtime completion without debug controls |
| VAL-002 | Structural graph tracks physical cuts | pending | Runtime cut + graph/constraint inspection |
| VAL-003 | Dangerous cut produces simulated cascade | pending | Direct runtime observation |
| VAL-004 | Tether changes dangerous outcome | pending | Matched runtime comparison |
| VAL-005 | Reset is clean | pending | Repeated-run resource/listener validation |
| VAL-006 | Progression changes next run | pending | Save/settlement runtime proof |
| VAL-007 | Phase gates are respected | pending | Per-phase focused test + relevant regression evidence before advancement |

## Prohibitions

- Do not claim gameplay systems are implemented or working before runtime evidence exists.
- Do not broaden first-playable scope before core-loop gates pass.
- Do not substitute scripted spectacle for structural simulation.
- Do not hand-roll a physics engine.
- Do not start a later implementation phase while the current phase gate is failed or unverified.
- Do not use production art, audio, or content expansion to mask unresolved greybox gameplay or physics failures.

## Revision history

### Revision 2 — 2026-08-19

Added `IMPLEMENTATION_PLAN.md` as the authoritative execution sequence beneath `BUILD_CONTRACT.md`. Replaced the broad pending technical-proof bucket with a staggered Phase 0-12 dependency chain. Added phase-gate and greybox-before-polish invariants. All runtime behavior remains pending because no implementation evidence exists yet.

### Revision 1 — 2026-08-19

Initialized from the user's concept and the authoritative `BUILD_CONTRACT.md`. Repository was empty before this project specification pass. All gameplay/runtime states remain pending or unknown until implementation evidence exists.
