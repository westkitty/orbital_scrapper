# ORBITAL SCRAPPER — STAGGERED IMPLEMENTATION PLAN

**Repository:** `westkitty/orbital_scrapper`  
**Branch:** `main`  
**Governing specification:** `BUILD_CONTRACT.md`  
**Purpose:** Decompose the build contract into small proof-gated phases so every major system is tested before another system depends on it.

This plan is the execution sequence for the broader build phases in `BUILD_CONTRACT.md`. It does not weaken or replace any requirement, invariant, acceptance criterion, or scope prohibition in that contract.

---

## 1. Phase-gate protocol

Development is intentionally staggered.

For every phase:

1. Build only the system named by the phase plus the minimum integration needed to exercise it.
2. Provide a focused greybox test scenario or diagnostic path for that system.
3. Test the new system directly.
4. Re-test the smallest previously proven path that the new system could break.
5. Fix failures before beginning the next phase.
6. Record the proof state in `OPERATIONAL_STATE.md`.
7. Commit the phase as one coherent work unit after its gate passes.

### Non-negotiable sequencing rules

- Do not start a later phase because the current phase is "mostly working."
- Do not let production art conceal unresolved physics or interaction problems.
- Do not introduce multiple major unproven gameplay systems in the same phase.
- A successful build is not a gameplay pass. Direct runtime behavior is required where the claim is behavioral.
- Greybox geometry and temporary UI are acceptable through the complete vertical-slice proof.
- Failed gates remain visible in operational state. They are not silently carried forward.
- If a phase exposes a flaw in an earlier proven assumption, repair and re-prove the affected dependency before continuing.

---

# PHASE 0 — Runtime, physics, and reset foundation

## Objective

Choose the implementation stack and prove that the chosen runtime can support the project's basic technical requirements before gameplay architecture grows around it.

## Build

- Record the engine/framework and physics choice in a short architecture note.
- Establish the project boot path.
- Establish a stable physics timestep or the chosen engine's equivalent.
- Create the minimal input layer needed for testing.
- Create a disposable physics test scene with several rigid bodies and at least one runtime-created/removable constraint.
- Create a clean reset/reload path for the test scene.
- Add basic diagnostics sufficient to identify active rigid bodies and constraints during development.

## Test gate

Prove all of the following:

- Project launches consistently.
- Physics objects fall/drift/collide predictably under the chosen simulation model.
- A constraint can be created and removed at runtime.
- Reset returns the scene to its original state.
- Repeated reset does not visibly duplicate physics bodies, constraints, listeners, or scene instances.

## Exit condition

**PASS only when the runtime itself is no longer an unknown.**

No gameplay feature work begins before this passes.

---

# PHASE 1 — Salvage craft flight

## Objective

Prove that the player can precisely maneuver a small work craft around large geometry before tools or salvage systems exist.

## Build

- Six-degree-of-freedom movement, or the closest justified equivalent in the chosen stack.
- Main thrust.
- Lateral/vertical thrust.
- Pitch/yaw/roll.
- Braking / counter-thrust behavior.
- Ship collision body.
- Basic velocity and orientation feedback for testing.
- Emergency thrust only if it is necessary to prove the intended handling envelope.

## Test scenario

A greybox navigation volume containing large stationary obstacles, narrow passages, and one moving obstacle.

## Test gate

Prove:

- Movement is frame-rate independent.
- The craft can approach a target, stop, hold useful working distance, rotate, and retreat.
- Momentum matters; stopping is not instantaneous.
- Collisions have consequence and do not destabilize the simulation.
- The player can complete a simple precision-navigation course without debug movement.

## Regression check

Repeat the Phase 0 reset test with the player craft present.

## Exit condition

Flight is usable for salvage work, not merely functional as free-camera movement.

---

# PHASE 2 — Modular wreck physics

## Objective

Prove that a wreck can exist as a connected physical assembly before the player is allowed to cut it apart.

## Build

- Minimal wreck component data model.
- Stable component IDs.
- Reusable attachment points.
- Several greybox component types with different mass/shape profiles.
- Runtime wreck assembly or one hand-authored modular wreck using the same attachment rules.
- Explicit joints/constraints between components.
- Simple colliders suitable for stable physics.
- Sleeping/inactive behavior where supported.

## Test scenario

One compact wreck with multiple components, including:

- a central structural spine,
- a heavy attached component,
- a light attached component,
- at least one branch with an alternate connection path.

## Test gate

Prove:

- The wreck behaves as a coherent connected assembly while joints are intact.
- Component transforms, IDs, and connections remain stable through normal simulation.
- Collisions with the player craft do not immediately explode the assembly through solver instability.
- Reset rebuilds exactly one wreck.

## Regression check

Repeat the Phase 1 precision approach and retreat around the live wreck.

## Exit condition

A connected wreck is stable enough to become the target of cutting and tether forces.

---

# PHASE 3 — Cutting and physical separation

## Objective

Prove the first destructive verb independently: the player can deliberately sever one valid connection and physics handles the result.

## Build

- Cuttable connection classification.
- Targeting of valid connection points.
- Cutter range and aim requirements.
- Cutter duration/energy/heat pacing mechanism.
- Runtime joint removal when a cut completes.
- Immediate wake-up of newly unconstrained bodies.
- Minimal cutter feedback sufficient to understand progress and completion.

## Test scenario

Use the Phase 2 wreck with designated cut points that produce:

- one low-risk separation,
- one large-mass separation.

## Test gate

Prove:

- Only valid connections can be cut.
- Completing a cut removes the correct physical constraint.
- The corresponding component or section separates through normal physics.
- No component is deleted merely to imitate disassembly.
- Cutting can be interrupted by leaving range or losing the target if required by the control design.
- Reset restores every original connection exactly once.

## Regression check

Re-run the Phase 2 wreck-stability test before cutting.

## Exit condition

A cut has a real physical consequence. Scripted disappearance does not count.

---

# PHASE 4 — Tether manipulation and bracing

## Objective

Prove the second physical tool independently before structural prediction exists.

## Build

- Tether targeting and attachment.
- Pull force / temporary physical constraint.
- Release behavior.
- Tension or force limit.
- Readable tether tension feedback.
- Ability to arrest or redirect a drifting detached component.
- Ability to brace an attached wreck section against movement.

## Test scenario

Three focused cases:

1. Pull a detached object toward the ship.
2. Arrest a drifting object before collision.
3. Brace one side of a connected wreck before a cut.

## Test gate

Prove:

- A tether changes object motion through simulation forces/constraints.
- Excessive load produces a readable failure/release behavior rather than infinite force.
- The player can capture or redirect a drifting object using the tether.
- A brace can measurably change post-cut motion compared with the same cut without the brace.

## Regression check

Repeat the Phase 3 low-risk and large-mass cuts with no tether to confirm cutting still behaves correctly.

## Exit condition

Matched tests demonstrate that tether placement can materially change a physical outcome.

**Completion of Phase 4 closes the original technical-proof milestone.**

---

# PHASE 5 — Structural graph synchronization

## Objective

Add the reasoning representation only after the physical representation has proven itself.

## Build

- `StructuralGraph` or equivalent ownership boundary.
- Component nodes synchronized to wreck components.
- Connection edges synchronized to physical joints/constraints.
- Connected-section queries.
- Bridge/articulation analysis or another explainable topology method.
- Recompute only the affected structural region where practical.
- Tether braces represented as temporary structural support information where appropriate.

## Test scenario

Use one known wreck topology whose graph can be checked by inspection.

## Test gate

Prove:

- Graph nodes match live wreck components.
- Graph edges match live intact physical connections.
- Cutting an edge updates both the graph and physical constraint state.
- Reset restores the original graph exactly once.
- Adding/removing a tether brace updates the temporary support state without corrupting permanent wreck topology.

## Regression check

Repeat Phase 3 and Phase 4 cut/tether tests while inspecting graph state.

## Exit condition

The graph describes the actual current wreck rather than a separately authored approximation.

---

# PHASE 6 — Scanner and structural criticality

## Objective

Turn structural state into player-readable information without making the scanner an oracle.

## Build

- Scanner target acquisition.
- Component identity/type display.
- Salvage value placeholder data.
- Connection visualization.
- Structural criticality estimate combining available explainable signals such as:
  - bridge status,
  - articulation behavior,
  - detached mass estimate,
  - alternate load paths,
  - available constraint stress/force information,
  - relative motion,
  - temporary tether support.
- Minimal risk/readability UI.

## Test scenario

One wreck containing:

- an obviously safe branch,
- a structurally critical connection,
- an alternate-load-path connection,
- a connection whose risk changes when braced.

## Test gate

Prove:

- Scanner output changes when the live structure changes.
- The safe and critical examples are distinguishable for understandable reasons.
- Bracing can change the scanner's prediction where the structural state justifies it.
- Scanner data does not remain stale after a cut.
- The player can identify what an object is, what it is attached to, what is likely to become free, and the predicted risk of cutting it.

## Regression check

Repeat matched tether/no-tether tests and verify both the physical outcome and the predicted risk response.

## Exit condition

The player can make informed salvage decisions from current structure rather than developer knowledge.

---

# PHASE 7 — Collapse escalation and survival damage

## Objective

Prove that structural mistakes can escalate into readable physical danger without scripted collapse cinematics.

## Build

- Secondary collision impulse handling.
- Additional joint break behavior where justified by force/constraint rules.
- Collapse severity metric derived from measurable simulation state.
- Basic directional warning feedback.
- Hull integrity.
- Impact damage.
- Clear destruction/failure state.
- Minimal collapse audio/warning placeholders driven by severity.

## Test scenario

A wreck configured so one known critical cut releases enough mass/motion to threaten the ship and potentially create secondary structural failures.

## Test gate

Prove:

- The same critical cut can produce a dangerous cascade through normal simulation.
- The player can survive through positioning, braking, thrust, or tether use.
- Collapse severity rises and falls based on simulation state rather than a fixed scripted timer.
- Warning feedback follows severity.
- Debris impacts can damage the ship.
- Tethering or alternate cut order can materially change the event.

## Regression check

Verify a low-risk cut still remains low-risk; not every cut should trigger drama.

## Exit condition

Structural failure is now a gameplay state the player can read and respond to.

---

# PHASE 8 — Cargo capture, condition, and settlement

## Objective

Complete the salvage transaction without adding persistent progression yet.

## Build

- Cargo eligibility.
- Cargo capture volume/net/clamp or equivalent.
- Relative-speed capture requirement.
- Secure-cargo state.
- Removal/serialization of secured cargo from expensive active physics where appropriate.
- Cargo condition.
- Impact damage to unsecured salvage.
- Base salvage value and condition-adjusted value.
- Return/extraction transition.
- Settlement summary and payout.

## Test scenario

Recover two otherwise identical salvage objects:

- one carefully,
- one after damaging it through impact.

## Test gate

Prove:

- Detached salvage remains a physical object until secured.
- High relative speed prevents or complicates capture according to the chosen rule.
- Secured cargo no longer behaves as loose hazardous debris.
- Damage before securing lowers condition.
- Condition changes payout.
- The player can return and see the recovered item/value without developer tools.

## Regression check

Perform a scan → tether → cut → physical recovery sequence before settlement.

## Exit condition

A salvage run can now produce a meaningful economic result.

---

# PHASE 9 — Upgrade, persistence, and complete vertical slice

## Objective

Close the complete contract loop for the first time.

## Build

- Currency persistence.
- One upgrade purchase path.
- One upgrade with an observable gameplay effect on the next run.
- Minimal preparation/upgrade state.
- Save-state handling sufficient for the proven progression path.
- Failure/recovery path that returns the player to a valid run state.

## Required vertical-slice flow

**scan → tether → cut → extract → survive/escape → secure cargo → return → sell → upgrade → begin next run**

## Test gate

Complete the entire flow without debug controls.

Then prove:

- The purchased upgrade persists as designed.
- The next run exhibits the changed capability.
- A failed run returns to a valid state without duplicating simulation objects or corrupting progression.
- At least two different cut orders on the same wreck can produce meaningfully different outcomes.
- The player can use structural information to choose between risk and value.

## Regression check

Re-run all critical path checks from Phases 1 through 8 once as an integrated player journey.

## Exit condition

The greybox version is a real game loop, not a collection of mechanics.

**No production-content expansion begins until Phase 9 passes.**

---

# PHASE 10 — Wreck variety and progression breadth

## Objective

Prove that the core loop survives content variation before investing in final presentation.

## Build

- Expanded modular wreck kit using the same attachment contract.
- Multiple salvage component classes.
- Different mass/value/fragility profiles.
- Several wreck layouts or templates.
- Additional upgrades that alter salvage capability rather than merely inflate payout.
- Limited variation in starting damage/missing sections where useful.

## Test gate

Prove:

- Existing tools work on every new wreck module without bespoke exceptions.
- Different layouts create different salvage decisions.
- Valuable items create structural or handling risk.
- Variation does not require scripted collapse events.
- Progression creates at least two meaningfully different tactical options.

## Regression check

Run the complete Phase 9 loop on the original reference wreck to ensure content expansion did not regress the baseline.

## Exit condition

Repeated runs create different tactical decisions using the same coherent mechanics.

---

# PHASE 11 — Production readability, visual assets, audio, and feel

## Objective

Replace greybox communication with production presentation only after gameplay structure is proven.

## Build

- Salvage ship exterior direction.
- Cockpit visual frame.
- Production wreck module direction.
- Cargo containers, engines, structural beams, solar panels, thrusters, hull/equipment modules.
- Scanner overlays and target markers.
- Tether/tractor VFX that communicate connection and tension.
- Cutter VFX.
- Thruster VFX.
- Impact/debris effects.
- Dynamic engine, thruster, scanner, tether, cutter, cargo, warning, and collision audio.
- Collapse music layering driven by measured severity.
- Scale/readability pass.
- HUD readability and accessibility pass.

## Audio constraint

Exterior events should be heard only through justified channels such as ship vibration, tether/cutter conduction, instrumentation, cockpit systems, radio, or music. Do not simply treat vacuum as ordinary air.

## Test gate

Prove:

- Production presentation does not obscure cut points, attachment relationships, motion, tether tension, or hazard direction.
- Scale is clearer than in greybox, not less readable.
- Collapse audio intensity follows measured collapse severity.
- Scanner overlays remain readable without covering the physical event.
- Visual assets preserve required pivots, colliders, and attachment points.
- The complete Phase 9 loop remains playable with production presentation enabled.

## Exit condition

Art and audio strengthen structural understanding rather than disguising it.

---

# PHASE 12 — Performance, endurance, accessibility, and release readiness

## Objective

Prove the representative game loop remains stable under repeated play and realistic wreck complexity.

## Build / hardening

- Active rigid-body budget.
- Sleeping and activation rules.
- Debris cleanup or deactivation policy.
- Secured-cargo simulation budgeting.
- Resource/listener/audio cleanup.
- Save/progression resilience.
- Input rebinding or accessibility controls appropriate to the selected platform.
- Failure recovery.
- Packaging/build path for the selected target platform.
- Diagnostics needed to reproduce performance or lifecycle failures.

## Test gate

Prove:

- Multiple full salvage runs can be completed sequentially without accumulating duplicate bodies, constraints, listeners, or audio instances.
- Representative collapses remain within the project's chosen performance target.
- Saving/loading does not duplicate or lose progression state in the tested paths.
- Failure and restart return to a clean playable state.
- Required controls remain usable under the accessibility/input configuration supported by the release target.
- A release/package build follows the documented path successfully.

## Regression check

Run the complete vertical-slice journey on a representative production wreck after endurance testing.

## Exit condition

The concept build is release-candidate ready for the selected target, subject to any explicitly recorded platform-specific unknowns.

---

# 2. Dependency map

| Phase | Depends on | Primary proof |
|---|---|---|
| 0 Runtime foundation | none | stable physics + clean reset |
| 1 Flight | 0 | precise salvage navigation |
| 2 Wreck physics | 0, 1 | stable modular constrained wreck |
| 3 Cutting | 2 | real joint removal and separation |
| 4 Tether | 1, 2, 3 | manipulation + bracing changes outcome |
| 5 Structural graph | 2, 3, 4 | graph matches live physical state |
| 6 Scanner/criticality | 5 | current structure becomes readable prediction |
| 7 Collapse/damage | 3, 4, 5, 6 | simulated cascade is dangerous and survivable |
| 8 Cargo/settlement | 1, 3, 4 | physical salvage becomes economic result |
| 9 Vertical slice/progression | 6, 7, 8 | complete loop works end to end |
| 10 Variety | 9 | loop survives content variation |
| 11 Presentation | 9, 10 | art/audio improve readability without regression |
| 12 Release readiness | 9-11 | repeated representative runs remain stable |

---

# 3. Required evidence at every phase boundary

Each phase completion record should include only evidence appropriate to the claim:

- phase identifier,
- files/systems changed,
- focused test performed,
- runtime result,
- relevant regression test,
- known limitations or skipped checks,
- operational-state update,
- commit SHA.

Do not mark behavior verified from code inspection alone when direct runtime testing is available.

---

# 4. Commit discipline during implementation

For future implementation work:

- Keep one phase active at a time.
- Prefer one coherent commit for a passing phase; use a bounded repair commit only when needed.
- Do not combine unfinished work from the next phase into the current phase commit.
- Do not commit large production asset batches before the mechanics they serve have passed their gates.
- Preserve the last passing phase as a known-good rollback point.
- Update `OPERATIONAL_STATE.md` only from evidence actually obtained.
- Stop after a phase gate passes unless the next phase is explicitly authorized as part of the same work session.

---

# 5. Current next action

**Begin Phase 0 only.**

The immediate task is to select and document the engine/framework/physics stack, then prove runtime constraint creation/removal and clean reset behavior.

Do not begin flight controls, wreck production, art sourcing, or content generation until Phase 0 passes.
