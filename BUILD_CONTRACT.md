# ORBITAL SCRAPPER — BUILD CONTRACT

**Status:** Initial authoritative build contract  
**Repository:** `westkitty/orbital_scrapper`  
**Default branch:** `main`  
**Project state:** Greenfield / no implementation assumed  

## 1. Product thesis

**ORBITAL SCRAPPER** is a physics-driven salvage game about operating a tiny industrial craft inside wrecks large enough to become environments.

The player is not simply collecting loot. They are performing controlled disassembly on unstable structures whose connections, mass, momentum, and center of gravity matter. Every valuable component is also part of a physical system. Removing the wrong part can turn a profitable extraction into a cascading structural failure.

The game should produce spectacle from simulation rather than from handcrafted destruction sequences.

### Core player fantasy

> Read a dead machine, brace it, cut it apart, steal what matters, and get clear before the structure remembers gravity still exists.

### Core loop

**scan → tether → cut → extract → survive collapse → sell salvage → upgrade → return**

Every major system must strengthen that loop. Features that do not improve salvage judgment, physical manipulation, risk, escape, or progression are secondary.

## 2. Experience pillars

### 2.1 Tiny craft, enormous wrecks

Scale is part of the gameplay. Wreckage should feel larger than the player can casually comprehend from one angle. A single engine block, beam cluster, cargo spine, or solar array can be large enough to obstruct sight lines and alter navigation.

The salvage craft must feel maneuverable but physically small, vulnerable, and industrial rather than heroic.

### 2.2 Destruction is structural, not decorative

A collapse must be caused by changed constraints, mass distribution, impacts, stored motion, or other simulated forces. Scripted warning beats may communicate danger, but they must not replace the physical cause.

The player should be able to learn why a collapse happened.

### 2.3 Information creates skill

The scanner is not a loot highlighter. It is the player's main reasoning tool. It should reveal enough structural information to make good decisions without converting salvage into a solved puzzle.

Expert play should look like better reading, better bracing, cleaner cuts, safer extraction paths, and better timing.

### 2.4 Tethers are tools, not just beams

A tether can pull cargo, arrest drift, change rotation, and temporarily brace a structure. Tether placement should materially change what is safe to cut.

### 2.5 Failure should create stories

A bad cut should not always mean instant failure. It may create spinning wreck sections, severed cargo, blocked escape routes, new openings, damaged salvage, or a desperate extraction under collapse.

The physics catastrophe is part of the game, not merely a punishment screen.

## 3. Scope contract

### Must exist in the first complete playable loop

- Free-flight salvage craft controls.
- One salvage field containing at least one multi-part wreck.
- Modular wreck components connected by explicit structural joints or constraints.
- Scanner that identifies cut points, attachment relationships, salvage value, and structural criticality.
- Tether tool capable of pulling and stabilizing components.
- Cutting tool capable of severing valid structural connections.
- Structural recomputation after every meaningful cut or break.
- Physics-driven separation, collision, drift, and cascade behavior.
- Cargo capture / securing.
- Ship damage from debris impacts or structural failure.
- Return / settlement state where cargo becomes currency.
- At least one meaningful ship or tool upgrade that improves the next salvage run.
- Audio and warning escalation during instability.

### Explicitly out of scope for the first playable version

- Combat.
- Enemy ships.
- Multiplayer.
- EVA / on-foot traversal.
- Walking inside the cockpit.
- Base building.
- Crafting trees.
- Procedural galaxy generation.
- Character dialogue systems or branching narrative campaigns.
- Large quest chains.
- Complex ship subsystem repair simulation.
- Inventory-grid management.
- Fully simulated materials science or finite-element analysis.
- Scripted cinematic collapse sequences used as a substitute for structural simulation.

## 4. Core gameplay systems

## 4.1 Salvage craft / flight

The player pilots a compact work craft with six-degree-of-freedom movement or the closest equivalent supported by the selected platform.

Required behaviors:

- Translation and rotation must feel inertial but controllable.
- Main thrust, lateral thrust, braking, and rotation must be readable.
- The ship must have enough stopping distance that positioning matters.
- Collision with large wreckage must have consequence.
- Cargo mass may reduce acceleration, braking, or handling once the core loop is stable.
- Emergency thrust must let the player escape a developing cascade, but not erase bad positioning.

The flight model should favor precision work over dogfighting.

## 4.2 Wreck structural model

Every wreck is represented in two synchronized forms:

1. **Physical form:** rigid bodies, colliders, constraints/joints, mass, velocity, collision response.
2. **Structural graph:** components are nodes; structural connections are edges.

This separation is mandatory. The graph provides understandable structural reasoning; the physics engine provides actual motion and spectacle.

### Component data

Each salvageable or structural component should support, at minimum:

- stable component ID
- component type
- mass
- salvage value
- condition / damage factor
- world transform
- attachment nodes
- current connected component / wreck section
- cuttable or non-cuttable classification
- cargo eligibility
- optional hazard flags

### Structural connection data

Each connection should support, at minimum:

- stable connection ID
- connected component A
- connected component B
- attachment points
- joint / constraint strength
- cuttable flag
- current stress or proxy stress value
- criticality estimate
- broken / intact state

## 4.3 Structural criticality

The game does not need full engineering simulation to create intelligent structural play.

The structural graph should estimate whether a connection is important by combining cheap, explainable signals such as:

- whether an edge is a graph bridge
- whether a node is an articulation point
- how much connected mass would become detached if the connection were removed
- current constraint force / tension where the physics engine exposes it
- distance from remaining anchors
- relative velocity or rotation of connected sections
- number of alternate load paths

The scanner converts this into a readable risk estimate.

**Important:** scanner criticality is a prediction, not an oracle. Actual motion still comes from the physics simulation.

After every cut, constraint break, major impact, or tether brace change, the affected structural region must be recomputed.

## 4.4 Scanner

The scanner is the primary information layer.

### Required scan information

- cuttable connections
- structural relationship between nearby parts
- predicted criticality / destabilization risk
- salvage value
- component condition
- cargo mass or handling class
- optional hazards when present

### Scanner interaction rule

The player should be able to point at a component or connection and understand:

1. what it is,
2. what it is attached to,
3. what it is worth,
4. what is likely to become free if it is cut,
5. whether the cut is structurally dangerous.

The scanner may offer several display modes later, but the first playable version should avoid forcing the player through excessive UI modes.

## 4.5 Tether / tractor system

Tethers are temporary physical constraints.

Required uses:

- pull a detached component toward the ship
- slow or redirect drifting salvage
- hold a target relative to the ship during cutting
- brace a component or wreck section before a dangerous cut
- create tension that the player can see and hear

The tether must have a tension limit. Excessive force should cause release, snap, overheat, or another readable failure instead of behaving like an infinite-strength magic beam.

A tether added as a brace should be represented in the temporary structural state so the scanner can update its risk prediction.

Later upgrades may add multiple simultaneous tethers, stronger line tension, longer range, or assisted stabilization.

## 4.6 Cutting system

The cutter severs explicit connections rather than deleting arbitrary geometry.

Required behavior:

- valid cut points are discoverable by scan
- the player must maintain aim / range long enough to complete a cut
- cutting has energy, heat, charge time, or another pacing constraint
- completing a cut removes or breaks the corresponding physical joint
- the structural graph updates immediately
- newly unconstrained bodies wake and enter normal physics
- cutting can be interrupted by movement, collision, or loss of position

The first implementation should not attempt arbitrary mesh slicing. Joint-based modular disassembly is the production-safe foundation.

## 4.7 Collapse and cascade system

A collapse is a state of escalating structural failure, not a canned event.

A cascade may be driven by:

- multiple joint breaks in a short period
- release of a large connected mass
- high angular velocity
- major collision impulses
- snapped tethers
- secondary impacts that break additional joints
- shifting center of mass after extraction

The game may calculate a **collapse severity** value from these signals. That value can drive warnings, music, cockpit alarms, scanner noise, and UI intensity.

It must not simply force arbitrary parts to explode because a drama meter crossed a threshold.

### Collapse design rule

A dangerous failure should change the navigable situation:

- close an escape route
- expose a new route
- spin a valuable component out of position
- convert stable beams into moving hazards
- damage cargo
- reveal previously buried salvage
- force the player to abandon a target

The best collapses are both threat and opportunity.

## 4.8 Cargo extraction

Detached salvage must be physically brought to a cargo capture region, bay, net, clamp, or equivalent secure volume.

A component is secured only when required capture conditions are met, such as:

- inside cargo capture volume
- low enough relative speed
- acceptable orientation or size class where relevant

Once secured, the object may be converted from active physics into stored cargo to keep performance bounded.

Cargo records must retain:

- component type
- base value
- condition
- mass / class
- modifiers required for settlement

Hard impacts before securing should be able to reduce condition and therefore sale value.

## 4.9 Ship damage and survival

The first playable version should use a compact damage model.

Required:

- hull integrity
- impact damage from debris / wreck collision
- strong audiovisual feedback before destruction
- one clear failure state when hull integrity reaches zero

Do not begin with a deep subsystem damage simulator. If later added, damaged thrusters, scanners, or tethers should grow from proven core play rather than precede it.

## 4.10 Settlement / sale

A completed run ends at a safe settlement, depot, carrier, or salvage tender.

Settlement must show:

- recovered items
- condition
- gross salvage value
- deductions or losses when relevant
- final payout

Currency is used for upgrades that directly improve salvage capability.

The first version does not need a market simulation.

## 4.11 Progression

Upgrades should change how the core loop is played rather than merely inflate numbers.

Strong upgrade categories include:

- scanner resolution / structural prediction
- tether strength
- tether range
- additional tether capacity
- cutter speed / efficiency
- cargo capacity
- cargo stabilization
- hull resilience
- thruster authority
- braking power

The first playable version needs only enough progression to prove that one successful run improves the next run.

## 5. Wreck generation and modularity

Wrecks should be assembled from reusable modules and attachment sockets.

Initial module families:

- cargo containers
- engines
- structural beams / trusses
- solar panels
- thrusters
- hull sections / plates
- equipment housings

A wreck template should define:

- allowed module types
- attachment graph
- initial transform hierarchy
- structural anchors
- starting damage / missing sections
- salvage value distribution
- optional hazards

The first playable wreck may be hand-authored from modular pieces. Procedural variation should come after the cut/tether/collapse loop is proven.

## 6. Risk and reward

Value should pull the player toward structural danger.

Examples:

- valuable engines mounted deep behind load-bearing trusses
- large cargo containers that are easy to identify but difficult to arrest once free
- high-value thrusters whose removal changes mass balance
- fragile solar arrays that pay well only if extracted without collision damage
- valuable internal equipment revealed by a collapse

Risk should primarily come from geometry, attachment, mass, momentum, and player choices rather than arbitrary timers.

Timed contracts may exist later, but should not become the main source of tension.

## 7. Camera, cockpit, and HUD

The cockpit is both a visual asset and an information frame.

Required HUD information should include:

- hull integrity
- speed / relative motion cues
- active tool
- cutter state
- tether state and tension
- cargo status
- scanner target data
- instability / collision warning

The HUD should privilege spatial and structural information over decorative telemetry.

If an external camera is provided, it should support inspection and accessibility without becoming required for basic salvage play.

## 8. Visual language

The visual target is **industrial orbital salvage**, not glossy military science fiction.

### Required visual characteristics

- enormous silhouettes and occlusion to sell scale
- modular seams that make cuttable structures readable
- battered industrial surfaces rather than pristine hero vehicles
- localized work lights and cockpit illumination
- restrained scanner overlays that expose structure without covering the scene
- directional thruster plumes
- tractor/tether VFX that communicate connection and tension
- cutter VFX that feel concentrated, hazardous, and mechanical
- debris, dust, frost, venting material, sparks, or fragments only where physically plausible for the object being damaged

Avoid turning the tractor system into an opaque glowing tube that hides the target.

Avoid relying on constant neon color saturation to create interest. The spectacle should come from scale, motion, light, collision, and structural failure.

## 9. Visual asset inventory

### Core assets

- salvage ship exterior
- cockpit interior / cockpit frame
- modular wreckage kit
- cargo containers
- engines
- structural beams / trusses
- solar panels
- thrusters
- hull plates / equipment housings
- tractor/tether VFX
- cutting-tool VFX
- thruster VFX
- collision / debris particles
- scanner overlays / target markers
- cargo capture indicator

### Asset production rules

- Wreck modules need deliberate attachment points.
- Attachment seams must be visually legible enough to support scanning and cutting.
- Collider design is part of the asset contract, not an afterthought.
- Physics origins / pivots must support believable detachment and rotation.
- Reusable modules are preferred over unique one-off wreck meshes.
- Large wrecks should be built from bounded physical modules rather than one monolithic destructible mesh.

## 10. Audio language

Space is vacuum. The game should not pretend exterior metal transmits through open space as ordinary air sound.

The player may still hear rich salvage audio when it is justified as:

- vibration conducted through the ship
- vibration conducted through an active tether or cutter contact
- cockpit instrumentation / synthesized warning sonification
- local tool audio
- radio / comms
- music

This lets the game sound physical without requiring literal vacuum-breaking sound design.

### Core audio assets

- ship engines
- directional thrusters
- scanner pulses
- hull / tether stress groans
- cutting tool / cutting torch
- tether engage, strain, and failure
- warning systems
- sparse radio chatter
- cargo impacts
- wreck impacts transmitted through contact / instrumentation
- cargo secure confirmation
- sale / settlement UI
- music layers that intensify during structural failure

### Dynamic audio rule

Music, warning systems, low-frequency stress, and cockpit feedback should respond to collapse severity. Escalation must reflect actual simulation state.

Do not use nonstop radio chatter. Silence and low mechanical ambience are part of the scale.

## 11. System architecture requirements

The engine / framework is not locked by this document. The repository is greenfield, so the first implementation phase must choose a stack that can reliably support rigid-body constraints, runtime joint removal, collision callbacks, and stable six-degree-of-freedom control.

Do not hand-roll a physics engine.

Regardless of stack, keep these responsibilities separated:

- `FlightController`
- `ScannerSystem`
- `StructuralGraph`
- `WreckAssembler`
- `TetherSystem`
- `CuttingSystem`
- `CollapseMonitor`
- `CargoSystem`
- `DamageSystem`
- `RunEconomy`
- `ProgressionSystem`
- `AudioDirector`
- `HUD / CockpitUI`
- `SaveState`

Names may vary, but ownership boundaries should remain recognizable.

### Physics requirements

- Use a fixed or otherwise stable physics timestep appropriate to the chosen engine.
- Avoid frame-rate-dependent thrust, cutting, or tether forces.
- Allow sleeping for inactive bodies.
- Bound the number of active debris rigid bodies.
- Convert secured cargo and irrelevant settled fragments out of expensive active simulation where safe.
- Prefer compound/simple colliders over expensive render-mesh collision.
- Broken joints must not leave stale graph edges.
- Reset / new-run logic must dispose of old physics bodies, constraints, audio handles, and event listeners.

## 12. Run state model

Minimum run states:

1. **Docked / preparation**
2. **Approach / wreck field**
3. **Active salvage**
4. **Instability / collapse escalation** — may overlap active salvage rather than replace it
5. **Return / extraction**
6. **Settlement**
7. **Upgrade / next run**
8. **Failure / recovery**

A collapse is not automatically a forced state transition. The player may continue salvaging during a dangerous cascade if they choose.

## 13. First buildable version

The smallest convincing version must prove one complete loop with greybox art if necessary.

### Required scenario

- Player launches or spawns in a salvage craft near one modular wreck.
- Wreck contains multiple connected modules with at least one clearly safe cut and one structurally critical cut.
- Player scans the wreck and sees useful attachment / criticality information.
- Player can tether a target or brace a section.
- Player cuts a connection.
- The structural graph and physical constraints update.
- A safe extraction can be performed without major collapse.
- A dangerous cut can create a genuine physics cascade.
- The player can use thrust and/or tethering to survive or alter that cascade.
- At least one detached component can be captured as cargo.
- Cargo can be returned and sold.
- Payout can purchase at least one upgrade.
- The upgrade has a visible effect on the next run.

If this loop is not fun in greybox form, do not bury the problem under more content.

## 14. Build phases

### Phase 0 — Technical proof

Goal: prove the project can support the physical verbs before committing to production architecture.

Deliverables:

- engine / framework decision recorded in a short architecture note
- controllable salvage craft
- modular rigid-body wreck
- removable joint / constraint
- one working tether
- one working cut
- one physics-driven separation event
- reset without duplicate physics objects or listeners

Gate: no art production dependency is required to pass Phase 0.

### Phase 1 — Core salvage loop

Deliverables:

- scan
- tether
- cut
- cargo capture
- return / sell
- one upgrade
- basic HUD
- basic damage

Gate: player can complete the loop without developer tools.

### Phase 2 — Structural intelligence and collapse

Deliverables:

- structural graph criticality
- scanner risk estimate
- tether bracing affects predicted / actual outcome
- cascade severity tracking
- secondary impacts can create additional breaks where supported
- collapse warning / audio escalation

Gate: two different cut choices on the same wreck can produce materially different physical outcomes for understandable reasons.

### Phase 3 — Wreck variety and progression

Deliverables:

- expanded modular wreck kit
- multiple salvage component classes
- condition-based value
- additional upgrades
- wreck / salvage variation

Gate: repeated runs create different tactical decisions without requiring handcrafted cinematic events.

### Phase 4 — Art, audio, feel, and readability

Deliverables:

- production salvage craft / cockpit direction
- production wreck module direction
- polished scanner, tether, cutter, thruster, and impact feedback
- dynamic collapse audio and music
- scale/readability pass

Gate: presentation strengthens the structural gameplay instead of hiding it.

### Phase 5 — Performance, QA, and release readiness

Deliverables:

- active-body / debris budgeting
- repeated-run cleanup validation
- save / progression validation
- control accessibility pass
- failure recovery
- build / packaging path for the chosen platform

Gate: representative salvage runs remain stable over repeated resets and collapses.

## 15. Acceptance criteria

The project is not considered to have proven its core until all of the following are true:

1. The complete scan → tether → cut → extract → survive/escape → sell → upgrade loop can be completed without debug controls.
2. Scanner output is based on the actual current wreck structure, not static authored labels alone.
3. Cutting a connection removes the corresponding structural relationship and physical constraint.
4. At least one critical cut can destabilize a wreck through normal physics without a bespoke collapse animation.
5. At least one tether placement can materially reduce, delay, redirect, or otherwise change a dangerous outcome.
6. Different cut orders can produce different structural outcomes on the same wreck.
7. Detached salvage remains a physical hazard until secured or safely settled.
8. Cargo can be damaged before securing and that damage can affect value.
9. The player can survive a developing collapse through positioning and control rather than a scripted escape sequence.
10. Collapse warnings and music intensify from measurable simulation state.
11. Selling salvage changes persistent progression state.
12. At least one upgrade changes actual player capability on the next run.
13. Repeated reset / new-run cycles do not accumulate duplicate wrecks, constraints, listeners, or audio instances.
14. Performance controls exist for sleeping, debris cleanup, or equivalent active-physics budgeting.
15. No combat, multiplayer, EVA, base-building, or narrative-system scope is added before the core loop passes.

## 16. Failure and fallback rules

- If arbitrary mesh cutting proves expensive or unstable, keep joint-based modular cutting. Arbitrary slicing is not required.
- If full structural force analysis is too expensive, keep graph-based criticality plus physics-engine constraint data.
- If large wrecks exceed physics budgets, reduce active physical modules while preserving visual scale with sleeping/static sections and activation zones.
- If cargo physics is too expensive after capture, serialize secured cargo and remove it from active simulation.
- If procedural wreck generation makes debugging difficult, ship hand-authored modular wreck templates first.
- If collapse becomes unreadable chaos, improve scanner prediction, attachment readability, warning directionality, and debris budgeting before reducing the structural system to scripts.

## 17. Git and implementation discipline

- Treat this file as the current build contract until explicitly superseded.
- Inspect repository state before editing.
- Do not replace proven systems with broad rescaffolding without evidence that the existing approach cannot meet the contract.
- Keep commits scoped to coherent work units.
- Do not commit secrets, generated caches, platform junk, local environment files, or large unreviewed binary asset dumps.
- Validate affected behavior before claiming a phase or feature complete.
- A passing build is not proof that salvage behavior works; use direct runtime proof for interaction claims.
- Do not claim a collapse system works merely because components can be deleted. The resulting structure must physically respond.
- Stop when the phase acceptance gate is satisfied; optional polish belongs in a later pass.

## 18. Current unresolved decisions

These are intentionally unresolved rather than silently guessed:

- target platform / distribution format
- rendering framework / game engine
- physics library
- final control scheme
- first-person-only vs optional external inspection camera
- final art style details and palette
- exact economy tuning
- exact number of simultaneous tethers after the first playable version
- final save format

Phase 0 may resolve technical choices. None of these decisions may weaken the core structural-salvage contract.

## 19. Definition of done for the concept build

The concept has become a real game when a player can inspect a wreck, understand enough of its structure to make a plan, deliberately brace it, cut something valuable free, watch the structure react for physically legible reasons, improvise when that reaction becomes dangerous, secure cargo, get home, sell it, improve the craft, and choose to go back in.

Everything else is expansion.
