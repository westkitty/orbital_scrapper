# Orbital Scrapper

A browser-native physics salvage game about taking valuable wreckage apart without letting the wreck take you apart first.

The core loop is:

**scan → choose a structural cut → tether → cut → control the release → recover cargo → survive → return → sell → upgrade → launch again**

Orbital Scrapper uses Three.js for presentation and Rapier for authoritative rigid-body physics. Wreck connections, cuts, tether forces, loose cargo, impacts, and collapse remain physical simulation rather than canned sequences.

## Current status

The complete concept-release loop is implemented and regression-tested for the supported target:

- desktop Chromium-class browser;
- static site served over HTTP;
- keyboard controls;
- persistent browser-local progression;
- three reusable wreck templates plus bounded damaged variants;
- three persistent capability upgrades;
- production HUD, procedural geometry, VFX, and user-enabled cockpit audio.

The project has a locked release-readiness gate covering the full gameplay loop, repeated runs, save recovery, lifecycle cleanup, and the declared CI performance budget. Broader browser/device support is not implied by that proof.

## Controls

| Action | Control |
| --- | --- |
| Forward / reverse | `W` / `S` |
| Strafe left / right | `A` / `D` |
| Vertical | `R` / `F` |
| Pitch / yaw | Arrow keys |
| Roll | `Q` / `E` |
| Brake | `Space` |
| Cutter | Hold `C` |
| Tether | Hold `T` |
| Scanner | Passive aim |
| Reset / recover | `X` |

A useful first recovery is the side panel on the reference wreck: scan the visible connections, close to cutter range, separate the panel, then tether it back while managing relative velocity before the clamp.

## Progression

Salvage condition affects sale value. Credits persist in browser storage and can be spent at the preparation dock.

The current capability upgrades are:

- **Clamp Dampers — 150 units:** capture-speed ceiling `1.35 m/s → 2.00 m/s`;
- **Tether Reinforcement — 140 units:** tether overload limit `70 N → 105 N`;
- **Cutter Optics — 160 units:** cutter range `9 m → 12 m`.

Purchases do not rewrite the completed run. Installed capability changes are resolved when a fresh salvage run launches.

## Run locally

Requires Node.js `22.12.0` or newer.

```bash
npm install --no-audit --no-fund
npm run dev
```

For a production preview:

```bash
npm run build
npm run preview
```

Then open the local URL shown by Vite in a Chromium-class browser.

## Validate the project

Run the full current automated test set:

```bash
npm run test:phase12
```

Run the complete release-readiness contract, including package generation and browser smokes:

```bash
npm run verify:phase12
```

Run the post-release playtest-readiness checks for the complete dock upgrade surface and GitHub Pages subpath build:

```bash
npm run verify:post-release
```

## Build a shareable static package

```bash
npm run package:release
```

The package is written to:

```text
release/orbital-scrapper-web/
```

It contains the production site plus a release manifest and README. Serve it over ordinary HTTP rather than opening `index.html` directly with `file://`.

## GitHub Pages

`.github/workflows/deploy-pages.yml` builds the game specifically for the repository path `/orbital_scrapper/` and deploys the resulting static files through GitHub Pages.

GitHub Pages must be configured with **Settings → Pages → Build and deployment → Source: GitHub Actions** before the first live deployment. The deployment workflow intentionally does not change the normal production build base path.

## Architecture

The project keeps authority boundaries explicit:

- **Rapier** owns rigid bodies, motion, collision, and joints.
- **WreckSandbox** owns stable physical wreck/component identity.
- **StructuralGraph** mirrors live topology and temporary support; it does not move bodies.
- **ScannerSystem** derives advisory structural risk/value information.
- **CuttingSystem** removes declared live physical connections.
- **TetherSystem** applies bounded physical forces.
- **CargoSystem** keeps detached salvage hazardous until a valid secure transition.
- **CollapseSystem** derives danger and hull consequences from current physical evidence.
- **ProgressionSystem** stores economic/run facts only; it does not persist physics state.
- **Three.js presentation, VFX, and audio** communicate the simulation without becoming a second gameplay authority.

`BUILD_CONTRACT.md`, `IMPLEMENTATION_PLAN.md`, `POST_RELEASE_PLAN.md`, and `OPERATIONAL_STATE.md` contain the detailed contracts and evidence history.

## Verified scope and known limits

The release-readiness claim is intentionally narrow. It does not currently certify:

- Safari or Firefox;
- phones/tablets or mobile thermal behavior;
- gamepad support or key rebinding;
- native installers or app-store packaging;
- screen-reader conformance certification;
- cloud saves or cross-device progression;
- final commercial balance/content breadth.

Those are future product decisions, not hidden assumptions in the current build.
