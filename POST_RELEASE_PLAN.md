# Orbital Scrapper — Post-release Playtest Readiness Contract

Status: active bounded improvement pass after the verified Phase 0–12 concept-release sequence.

This contract does not create a new numbered implementation phase. The Phase 0–12 gameplay, simulation, presentation, persistence, performance, and release invariants remain controlling.

## Goal

Make the verified concept release easier to understand, launch, share, and play without expanding the game's mechanical scope.

## Frozen change groups

### 1. Complete the preparation-dock upgrade surface

Expose all three already-implemented and already-persisted capability upgrades through the player-facing preparation dock:

- Clamp Dampers — 150 units — capture ceiling `1.35 m/s -> 2.00 m/s`
- Tether Reinforcement — 140 units — max tether tension `70 N -> 105 N`
- Cutter Optics — 160 units — cutter range `9 m -> 12 m`

Requirements:

- use the existing `ProgressionSystem` purchase methods and costs;
- preserve fresh-run-only capability application;
- do not change upgrade costs, tuning, save schema, physics, payout, or run accounting;
- expose owned, affordable, and insufficient-credit states accessibly;
- preserve the existing Clamp Dampers path and selectors used by regression tests.

### 2. Add a reproducible GitHub Pages deployment path

Add a Pages workflow that builds the same Vite application for the repository subpath `/orbital_scrapper/` and deploys only the built static output.

Requirements:

- keep the normal `npm run build` and `npm run package:release` behavior unchanged;
- do not add a framework, runtime dependency, native wrapper, service worker, or backend;
- use the existing Node/dependency versions;
- Pages deployment is considered live only after GitHub reports a successful deployment and the public page can be fetched.

### 3. Add a repository onboarding surface

Add a root `README.md` that explains:

- what Orbital Scrapper is;
- the verified gameplay loop;
- controls;
- how to run locally;
- how to test/build/package;
- the supported release envelope and known limits;
- the public play URL only if deployment is actually verified.

## Protected surfaces

Do not change:

- Rapier physics authority or fixed-step ownership;
- wreck topology, cut/tether/cargo/collapse rules;
- scanner scoring or structural authority boundaries;
- progression schema, costs, tuning, or persistence keys;
- production hardpoint coordinates, camera ownership, or presentation identity;
- Phase 12 release budgets or performance thresholds;
- existing Phase 0–12 regression expectations except where a test must accept the deliberately expanded dock text while preserving the same behavior.

## Acceptance checks

This pass is complete only when:

1. all existing Phase 0–12 regression workflows pass on one candidate head;
2. a browser smoke proves all three dock purchases can be made through real controls and all three effects appear only after launching the next run;
3. reload preserves all three purchases and active fresh-run capabilities;
4. the normal production build/package still passes;
5. a repository-subpath Pages build produces valid `/orbital_scrapper/` asset URLs;
6. the README accurately describes only verified behavior;
7. the final diff contains no unrelated gameplay, dependency, balance, or architecture changes.

If GitHub Pages repository settings prevent deployment, the workflow may still be merged after its build path is verified, but public hosting remains explicitly unverified until the repository setting is enabled and a deployment succeeds.
