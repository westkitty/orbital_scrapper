# Phase 11 Production Presentation Direction

## Purpose

Production presentation exists to make the structural salvage game easier to read under pressure. It must reveal physical relationships already owned by Rapier, the structural graph, scanner, tether, cutter, cargo, and collapse systems rather than inventing a second presentation-only game state.

## Visual direction

Orbital Scrapper uses a utilitarian industrial-cockpit language rather than a clean-room science-fiction dashboard.

- Near-black vacuum and restrained cold work lighting keep silhouettes legible.
- Wreck modules use worn structural-metal families with limited functional accents rather than saturated team colors.
- The salvage craft reads as a compact working tug: central armored hull, glazed cockpit, lateral utility pods, visible aft thrusters, and a reinforced keel.
- Module identity is shape-led:
  - spines are long structural trunks with dorsal reinforcement;
  - engines expose a cylindrical core and nozzle;
  - panels and sensor wings use framed cell surfaces;
  - rails are narrow structural beams with end collars;
  - batteries are compact dark blocks with hazard bands;
  - tanks are cylindrical pressure vessels with retaining bands;
  - reactors use a contained cylindrical core with hazard rings;
  - junctions are reinforced cross-members.
- Every declared attachment point receives a visible local hardpoint marker at the exact component-local coordinate used by the physics connection contract.
- Physics body pivots, colliders, stable IDs, attachment coordinates, and Three.js top-level body ownership do not move to accommodate the art.

All Phase 11 visual assets are procedural Three.js geometry generated locally in source. No external models, textures, fonts, or visual libraries are required by this proof pass.

## Cockpit and HUD hierarchy

The worksite remains visually dominant. The HUD is distributed around the edges rather than placed in a permanent side panel.

1. Mission/run/credits: upper left.
2. Current structural target, risk, value, and load-path fact: left edge below mission status.
3. Hull and live collapse severity: upper right.
4. Center: only a restrained reticle plus directional hazard label.
5. Cutter, tether load, and cargo state: lower right.
6. Current objective/status: lower left.
7. Controls: compact bottom strip.
8. Detailed diagnostics: collapsed secondary drawer, not part of the normal play read.
9. Dock/progression: modal preparation surface only while physically docked.

Risk and hazard meaning is never color-only: every color state is paired with explicit LOW/MODERATE/HIGH, severity, direction, progress, load, or condition text.

## Tool and structural effects

- Scanner: compact ring/ticks positioned at the real live connection point; hue follows the scanner estimate.
- Cutter: separate connection marker with visible progress and blocked/eligible state.
- Tether: physical craft-to-target line whose color shifts with measured tether load; an endpoint marker reinforces which body is controlled.
- Cargo clamp: quiet craft-relative capture envelope.
- Thrusters: presentation-only emissive intensity driven from current flight input.
- Impact/debris: short-lived pooled sparks triggered by measured impact evidence. They never apply force or alter topology.

## Audio direction

Exterior vacuum events are never reproduced as ordinary airborne sound. The Web Audio proof mix uses only justified channels:

- ship hum;
- thruster conduction through the craft;
- tether conduction;
- cutter conduction;
- impact vibration through structure;
- cockpit warning instrumentation;
- non-diegetic collapse music.

Collapse music gain follows the measured `CollapseSystem.severityScore`. Warning instrumentation follows the existing warning cue. Audio is user-enabled because browser autoplay policy is respected; disabling audio cannot change simulation state.

The Phase 11 proof uses generated Web Audio tones only. No external audio files or third-party recordings are included.

## Accessibility and comfort

- Semantic HUD regions and explicit text labels remain available without interpreting color.
- Primary buttons keep keyboard-visible focus states.
- Detailed telemetry is progressive disclosure through a native `details` control.
- The interface includes a `prefers-reduced-motion` fallback that suppresses nonessential transitions.
- Presentation layers use `pointer-events: none` unless they contain actual controls.
- The center reticle and physical worksite must remain unobscured at the desktop proof viewport.
- Responsive rules preserve the worksite and essential status at smaller widths; release-target accessibility and input hardening remain Phase 12 work.

## Authority and lifecycle

- Rapier remains authoritative for transforms, collision, joint state, and loose-cargo motion.
- `FlightScenePresenter` mirrors body transforms and owns one top-level presentation object per body under the protected `phase-one-flight-root`.
- `ProductionFx` owns a separate disposable `phase11-fx-root` and never mutates simulation state.
- `ProductionAudio` owns a separate disposable Web Audio graph and reads diagnostics only.
- The DOM HUD reads diagnostics only.

Phase 11 is complete only when these presentation layers pass their focused integrity/readability checks and the complete verified Phase 9 reference-wreck loop still succeeds with production presentation enabled.
