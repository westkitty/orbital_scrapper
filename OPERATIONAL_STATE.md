# OPERATIONAL STATE — ORBITAL SCRAPPER

project_id: `orbital_scrapper`
project_name: `Orbital Scrapper`
revision: 1
repository: `westkitty/orbital_scrapper`
default_branch: `main`

## Scope

Greenfield physics-driven salvage game governed by `BUILD_CONTRACT.md`.

## Current baseline

- Repository began empty.
- `BUILD_CONTRACT.md` is the current authoritative gameplay/build specification.
- No engine, framework, platform, implementation, assets, tests, or runtime behavior are yet verified.

## Artifact contract

Build the smallest convincing playable salvage loop:

scan -> tether -> cut -> extract -> survive/escape collapse -> sell salvage -> upgrade -> next run.

The structural model must pair a physical rigid-body/constraint representation with a synchronized structural graph. Physics creates actual motion and collapse; the graph provides explainable structural reasoning and scanner criticality.

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

### Phase 0 — Technical proof

Required next proof set:

- record engine/framework choice in a short architecture note
- controllable salvage craft
- modular rigid-body wreck
- runtime-removable joint/constraint
- one tether
- one cut
- one physics-driven separation event
- clean reset without duplicated simulation objects/listeners

No art dependency is required to pass Phase 0.

## Validation matrix

| ID | Claim | State | Required proof |
|---|---|---|---|
| VAL-001 | Full salvage loop works | pending | Direct runtime completion without debug controls |
| VAL-002 | Structural graph tracks physical cuts | pending | Runtime cut + graph/constraint inspection |
| VAL-003 | Dangerous cut produces simulated cascade | pending | Direct runtime observation |
| VAL-004 | Tether changes dangerous outcome | pending | Matched runtime comparison |
| VAL-005 | Reset is clean | pending | Repeated-run resource/listener validation |
| VAL-006 | Progression changes next run | pending | Save/settlement runtime proof |

## Prohibitions

- Do not claim gameplay systems are implemented or working before runtime evidence exists.
- Do not broaden first-playable scope before core-loop gates pass.
- Do not substitute scripted spectacle for structural simulation.
- Do not hand-roll a physics engine.

## Revision history

### Revision 1 — 2026-08-19

Initialized from the user's concept and the authoritative `BUILD_CONTRACT.md`. Repository was empty before this project specification pass. All gameplay/runtime states remain pending or unknown until implementation evidence exists.
