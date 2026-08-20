// @ts-nocheck
import * as THREE from "three";
import "./style.css";
import {
  CARGO_CAPTURE_RADIUS_METERS,
  CARGO_EXTRACTION_DISTANCE_METERS,
  CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND,
  CargoSystem,
} from "./cargo/CargoSystem.js";
import { CollapseSystem } from "./collapse/CollapseSystem.js";
import { CuttingSystem, CUTTER_RANGE_METERS } from "./cutting/CuttingSystem.js";
import { FlightController, NEUTRAL_FLIGHT_INPUT } from "./flight/FlightController.js";
import { WreckSandbox } from "./physics/WreckSandbox.js";
import { FIXED_TIMESTEP_SECONDS } from "./physics/PhysicsSandbox.js";
import { FlightScenePresenter } from "./presentation/FlightScenePresenter.js";
import {
  CLAMP_DAMPERS_COST_UNITS,
  CLAMP_DAMPERS_MAX_CAPTURE_SPEED_METERS_PER_SECOND,
  ProgressionSystem,
} from "./progression/ProgressionSystem.js";
import { FixedStepLoop } from "./runtime/FixedStepLoop.js";
import { FlightInputBindings } from "./runtime/FlightInputBindings.js";
import { SCANNER_RANGE_METERS, ScannerSystem } from "./scanner/ScannerSystem.js";
import { StructuralGraph } from "./structure/StructuralGraph.js";
import { TETHER_RANGE_METERS, TetherSystem } from "./tether/TetherSystem.js";

const app = document.querySelector("#app");
if (!app) throw new Error("Missing #app root");

app.innerHTML = `
  <section class="viewport" aria-label="Phase 9 complete greybox salvage viewport"></section>
  <aside class="panel" aria-label="Phase 9 complete greybox salvage loop">
    <p class="eyebrow">ORBITAL SCRAPPER // PHASE 9</p>
    <h1>Complete Greybox Salvage Loop</h1>
    <p class="copy">Read the wreck, choose risk versus value, cut and physically recover salvage, survive the return, settle it into persistent credits, install one real capability upgrade, and launch the next run.</p>

    <div class="control-grid" aria-label="Flight cutter tether and scanner controls">
      <div><strong>Thrust</strong><span><kbd>W</kbd>/<kbd>S</kbd></span></div>
      <div><strong>Strafe</strong><span><kbd>A</kbd>/<kbd>D</kbd></span></div>
      <div><strong>Vertical</strong><span><kbd>R</kbd>/<kbd>F</kbd></span></div>
      <div><strong>Pitch / yaw</strong><span><kbd>↑↓</kbd> <kbd>←→</kbd></span></div>
      <div><strong>Roll</strong><span><kbd>Q</kbd>/<kbd>E</kbd></span></div>
      <div><strong>Brake</strong><span><kbd>Space</kbd></span></div>
      <div><strong>Cutter</strong><span><kbd>C</kbd> hold</span></div>
      <div><strong>Tether</strong><span><kbd>T</kbd> hold</span></div>
      <div><strong>Scanner</strong><span>passive aim</span></div>
    </div>

    <button id="reset" type="button">Reset / recover <kbd>X</kbd></button>

    <dl class="diagnostics">
      <div><dt>Run state</dt><dd id="diag-run-state">—</dd></div>
      <div><dt>Run ID</dt><dd id="diag-run-id">—</dd></div>
      <div><dt>Credits</dt><dd id="diag-credits">—</dd></div>
      <div><dt>Upgrade</dt><dd id="diag-upgrade">—</dd></div>
      <div><dt>Clamp ceiling</dt><dd id="diag-clamp-limit">—</dd></div>
      <div><dt>Completed runs</dt><dd id="diag-completed-runs">—</dd></div>
      <div><dt>Failed runs</dt><dd id="diag-failed-runs">—</dd></div>
      <div><dt>Save state</dt><dd id="diag-save-state">—</dd></div>
      <div><dt>Scanner target</dt><dd id="diag-scan-target">—</dd></div>
      <div><dt>Predicted risk</dt><dd id="diag-scan-risk">—</dd></div>
      <div><dt>Cut target</dt><dd id="diag-cut-target">—</dd></div>
      <div><dt>Cutter state</dt><dd id="diag-cut-state">—</dd></div>
      <div><dt>Last cut</dt><dd id="diag-last-cut">—</dd></div>
      <div><dt>Tether target</dt><dd id="diag-tether-target">—</dd></div>
      <div><dt>Tether state</dt><dd id="diag-tether-state">—</dd></div>
      <div><dt>Tether range</dt><dd id="diag-tether-distance">—</dd></div>
      <div><dt>Clamp state</dt><dd id="diag-cargo-state">—</dd></div>
      <div><dt>Clamp candidate</dt><dd id="diag-cargo-target">—</dd></div>
      <div><dt>Clamp range</dt><dd id="diag-cargo-distance">—</dd></div>
      <div><dt>Relative speed</dt><dd id="diag-cargo-relative-speed">—</dd></div>
      <div><dt>Condition</dt><dd id="diag-cargo-condition">—</dd></div>
      <div><dt>Current value</dt><dd id="diag-cargo-value">—</dd></div>
      <div><dt>Last cargo impact</dt><dd id="diag-cargo-impact">—</dd></div>
      <div><dt>Secured cargo</dt><dd id="diag-cargo-secured">—</dd></div>
      <div><dt>Settlement state</dt><dd id="diag-settlement-state">—</dd></div>
      <div><dt>Payout</dt><dd id="diag-payout">—</dd></div>
      <div><dt>Wreck distance</dt><dd id="diag-distance">—</dd></div>
      <div><dt>Hull</dt><dd id="diag-hull">—</dd></div>
      <div><dt>Live collapse</dt><dd id="diag-collapse-state">—</dd></div>
      <div><dt>Graph</dt><dd id="diag-graph">—</dd></div>
      <div><dt>Body records</dt><dd id="diag-bodies">—</dd></div>
      <div><dt>Input</dt><dd id="diag-input">neutral</dd></div>
    </dl>

    <section id="dock-panel" class="dock-panel" aria-label="Preparation and upgrade state" hidden>
      <h2>Preparation Dock</h2>
      <p id="dock-summary">Return with salvage to prepare the next run.</p>
      <button id="buy-clamp-dampers" type="button">Buy Clamp Dampers — ${CLAMP_DAMPERS_COST_UNITS} units</button>
      <button id="launch-next-run" type="button">Launch next salvage run</button>
    </section>

    <p class="course" id="course">Use the scanner to compare the lower-value moderate-risk panel with the higher-value high-risk engine. Recover the panel first to prove the complete loop safely.</p>
    <p class="status" id="status" role="status">Initializing Phase 9 salvage run…</p>
    <p class="status" id="settlement-summary" aria-live="polite">No settlement yet.</p>
  </aside>
`;

const viewport = app.querySelector(".viewport");
const resetButton = document.querySelector("#reset");
const buyUpgradeButton = document.querySelector("#buy-clamp-dampers");
const launchNextRunButton = document.querySelector("#launch-next-run");
const dockPanel = document.querySelector("#dock-panel");
const dockSummary = document.querySelector("#dock-summary");
const status = document.querySelector("#status");
const course = document.querySelector("#course");
const settlementSummary = document.querySelector("#settlement-summary");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.shadowMap.enabled = true;
viewport.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020617);
scene.fog = new THREE.Fog(0x020617, 40, 110);

const camera = new THREE.PerspectiveCamera(62, viewport.clientWidth / viewport.clientHeight, 0.1, 180);
scene.add(new THREE.HemisphereLight(0xcbd5e1, 0x020617, 1.7));
const workLight = new THREE.DirectionalLight(0xffffff, 3.2);
workLight.position.set(6, 10, 12);
workLight.castShadow = true;
scene.add(workLight);
const fillLight = new THREE.PointLight(0x38bdf8, 18, 28);
fillLight.position.set(-5, 3, 9);
scene.add(fillLight);

const referenceGrid = new THREE.GridHelper(70, 70, 0x334155, 0x0f172a);
referenceGrid.position.y = -5;
scene.add(referenceGrid);
const axesHelper = new THREE.AxesHelper(3);
scene.add(axesHelper);

const cutMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.24, 12, 8),
  new THREE.MeshBasicMaterial({ color: 0xfacc15, wireframe: true }),
);
cutMarker.visible = false;
scene.add(cutMarker);

const scannerMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });
const scannerMarker = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), scannerMarkerMaterial);
scannerMarker.visible = false;
scene.add(scannerMarker);

const tetherPositions = new Float32Array(6);
const tetherGeometry = new THREE.BufferGeometry();
tetherGeometry.setAttribute("position", new THREE.BufferAttribute(tetherPositions, 3));
const tetherLine = new THREE.Line(tetherGeometry, new THREE.LineBasicMaterial({ color: 0x7dd3fc }));
tetherLine.visible = false;
scene.add(tetherLine);

const captureEnvelope = new THREE.Mesh(
  new THREE.SphereGeometry(CARGO_CAPTURE_RADIUS_METERS, 20, 12),
  new THREE.MeshBasicMaterial({ color: 0x22c55e, wireframe: true, transparent: true, opacity: 0.18, depthWrite: false }),
);
scene.add(captureEnvelope);

const progression = new ProgressionSystem(window.localStorage);
const sandbox = await WreckSandbox.create();
const controller = new FlightController();
const cutter = new CuttingSystem();
const tether = new TetherSystem();
const graph = new StructuralGraph();
const scanner = new ScannerSystem();
const collapse = new CollapseSystem();
let currentCaptureLimit = progression.getCaptureSpeedLimit(CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND);
const cargo = new CargoSystem({ maxCaptureRelativeSpeed: currentCaptureLimit });
graph.sync(sandbox, tether.getDiagnostics(sandbox));
collapse.step(sandbox, graph);
const presenter = new FlightScenePresenter(scene);
presenter.rebuild(sandbox);
const loop = new FixedStepLoop(FIXED_TIMESTEP_SECONDS, 5);

let runMode = "field";
let dockReason = "none";
let activeRunId = progression.beginRun();
let settlementApplied = false;
let failureApplied = false;
let lastTime = performance.now();
let disposed = false;

function resetPhysicalRun() {
  sandbox.reset();
  cutter.reset();
  tether.reset();
  collapse.reset();
  cargo.reset();
  cargo.setMaxCaptureRelativeSpeed(currentCaptureLimit);
  graph.sync(sandbox, tether.getDiagnostics(sandbox));
  collapse.step(sandbox, graph);
  loop.reset();
  input.clear();
  presenter.rebuild(sandbox);
}

function resetCurrentRun() {
  if (runMode !== "field") return;
  settlementApplied = false;
  failureApplied = false;
  resetPhysicalRun();
  updateDiagnostics();
}

function recoverFailedRun() {
  if (runMode !== "failure") return;
  resetPhysicalRun();
  runMode = "dock";
  dockReason = "recovered";
  updateDiagnostics();
}

function handleResetAction() {
  if (runMode === "failure") recoverFailedRun();
  else if (runMode === "field") resetCurrentRun();
}

const input = new FlightInputBindings(window, { reset: handleResetAction });
input.attach();
resetButton.addEventListener("click", handleResetAction);

function handleBuyUpgrade() {
  if (runMode !== "dock") return;
  const result = progression.purchaseClampDampers();
  if (result.reason === "purchased") {
    dockSummary.textContent = `Clamp Dampers purchased. Next-run capture ceiling: ${CLAMP_DAMPERS_MAX_CAPTURE_SPEED_METERS_PER_SECOND.toFixed(2)} m/s.`;
  } else if (result.reason === "already-owned") {
    dockSummary.textContent = "Clamp Dampers already installed.";
  } else {
    dockSummary.textContent = `Need ${CLAMP_DAMPERS_COST_UNITS} units for Clamp Dampers.`;
  }
  updateDiagnostics();
}

function handleLaunchNextRun() {
  if (runMode !== "dock") return;
  activeRunId = progression.beginRun();
  currentCaptureLimit = progression.getCaptureSpeedLimit(CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND);
  settlementApplied = false;
  failureApplied = false;
  runMode = "field";
  dockReason = "none";
  resetPhysicalRun();
  updateDiagnostics();
}

buyUpgradeButton.addEventListener("click", handleBuyUpgrade);
launchNextRunButton.addEventListener("click", handleLaunchNextRun);

function resize() {
  const width = Math.max(viewport.clientWidth, 1);
  const height = Math.max(viewport.clientHeight, 1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

function describeInput(state, cutActive, tetherActive) {
  const active = [];
  if (state.forward > 0) active.push("forward");
  if (state.forward < 0) active.push("reverse");
  if (state.strafe > 0) active.push("right");
  if (state.strafe < 0) active.push("left");
  if (state.vertical > 0) active.push("up");
  if (state.vertical < 0) active.push("down");
  if (state.pitch !== 0) active.push("pitch");
  if (state.yaw !== 0) active.push("yaw");
  if (state.roll !== 0) active.push("roll");
  if (state.brake) active.push("brake");
  if (cutActive) active.push("cut");
  if (tetherActive) active.push("tether");
  return active.length ? active.join(" + ") : "neutral";
}

function updateCutMarker(cut) {
  if (!cut.targetId || !sandbox.hasConnection(cut.targetId)) {
    cutMarker.visible = false;
    return;
  }
  const point = sandbox.getConnectionWorldPoint(cut.targetId);
  cutMarker.visible = true;
  cutMarker.position.set(point.x, point.y, point.z);
}

function updateScannerMarker(scan) {
  if (scan.state !== "locked" || !sandbox.hasConnection(scan.connectionId)) {
    scannerMarker.visible = false;
    return;
  }
  const point = sandbox.getConnectionWorldPoint(scan.connectionId);
  scannerMarker.visible = true;
  scannerMarker.position.set(point.x, point.y, point.z);
  scannerMarkerMaterial.color.setHex(scan.riskLevel === "high" ? 0xef4444 : scan.riskLevel === "moderate" ? 0xf59e0b : 0x22c55e);
}

function updateTetherLine(tetherDiagnostics) {
  if (tetherDiagnostics.state !== "attached" || !tetherDiagnostics.targetId) {
    tetherLine.visible = false;
    return;
  }
  const target = sandbox.getWreckComponent(tetherDiagnostics.targetId);
  if (!target.body.isEnabled()) {
    tetherLine.visible = false;
    return;
  }
  const craft = sandbox.getCraftBody().translation();
  const targetPosition = target.body.translation();
  tetherPositions[0] = craft.x;
  tetherPositions[1] = craft.y;
  tetherPositions[2] = craft.z;
  tetherPositions[3] = targetPosition.x;
  tetherPositions[4] = targetPosition.y;
  tetherPositions[5] = targetPosition.z;
  tetherGeometry.attributes.position.needsUpdate = true;
  tetherLine.visible = true;
}

function updateDiagnostics() {
  const diagnostics = sandbox.getDiagnostics();
  const cut = cutter.getDiagnostics(sandbox);
  const tetherDiagnostics = tether.getDiagnostics(sandbox);
  graph.sync(sandbox, tetherDiagnostics);
  const graphDiagnostics = graph.getDiagnostics();
  const scan = scanner.scan(sandbox, graph, tetherDiagnostics, cut.targetId);
  const collapseDiagnostics = collapse.getDiagnostics();
  const cargoDiagnostics = cargo.getDiagnostics(sandbox);
  const progressionDiagnostics = progression.getDiagnostics();
  const flightState = input?.getState?.() ?? NEUTRAL_FLIGHT_INPUT;
  const cutActive = input?.isCutActive?.() ?? false;
  const tetherActive = input?.isTetherActive?.() ?? false;

  document.querySelector("#diag-run-state").textContent = runMode;
  document.querySelector("#diag-run-id").textContent = String(activeRunId);
  document.querySelector("#diag-credits").textContent = `${progressionDiagnostics.credits} units`;
  document.querySelector("#diag-upgrade").textContent = progressionDiagnostics.upgrades.clampDampers ? "Clamp Dampers — owned" : "Clamp Dampers — not owned";
  document.querySelector("#diag-clamp-limit").textContent = `${currentCaptureLimit.toFixed(2)} m/s`;
  document.querySelector("#diag-completed-runs").textContent = String(progressionDiagnostics.completedRuns);
  document.querySelector("#diag-failed-runs").textContent = String(progressionDiagnostics.failedRuns);
  document.querySelector("#diag-save-state").textContent = `v${progressionDiagnostics.version} / ${progressionDiagnostics.loadState}`;
  document.querySelector("#diag-scan-target").textContent = scan.state === "locked" ? scan.connectionId : "none";
  document.querySelector("#diag-scan-risk").textContent = scan.state === "locked" ? `${scan.riskLevel} estimate / ${scan.placeholderValueUnits} units` : "no estimate";
  document.querySelector("#diag-cut-target").textContent = cut.targetId ?? "none";
  document.querySelector("#diag-cut-state").textContent = cut.state;
  document.querySelector("#diag-last-cut").textContent = cut.lastCompletedConnectionId ?? "none";
  document.querySelector("#diag-tether-target").textContent = tetherDiagnostics.targetId ?? "none";
  document.querySelector("#diag-tether-state").textContent = tetherDiagnostics.state;
  document.querySelector("#diag-tether-distance").textContent = Number.isFinite(tetherDiagnostics.targetDistance) ? `${tetherDiagnostics.targetDistance.toFixed(2)} m` : "—";
  document.querySelector("#diag-cargo-state").textContent = cargoDiagnostics.captureState;
  document.querySelector("#diag-cargo-target").textContent = cargoDiagnostics.candidateId ?? "none";
  document.querySelector("#diag-cargo-distance").textContent = Number.isFinite(cargoDiagnostics.candidateDistance) ? `${cargoDiagnostics.candidateDistance.toFixed(2)} m` : "—";
  document.querySelector("#diag-cargo-relative-speed").textContent = `${cargoDiagnostics.candidateRelativeSpeed.toFixed(2)} m/s`;
  document.querySelector("#diag-cargo-condition").textContent = cargoDiagnostics.candidateId ? `${cargoDiagnostics.candidateCondition.toFixed(1)}%` : "—";
  document.querySelector("#diag-cargo-value").textContent = cargoDiagnostics.candidateId ? `${cargoDiagnostics.candidateAdjustedValueUnits} units` : "—";
  document.querySelector("#diag-cargo-impact").textContent = cargoDiagnostics.lastDamageComponentId
    ? `${cargoDiagnostics.lastDamageComponentId}: -${cargoDiagnostics.lastConditionDamage.toFixed(1)}% @ ${cargoDiagnostics.lastDamageImpulse.toFixed(2)} N·s`
    : "none";
  document.querySelector("#diag-cargo-secured").textContent = cargoDiagnostics.securedCargoIds.join(", ") || "none";
  document.querySelector("#diag-settlement-state").textContent = cargoDiagnostics.settlementState;
  document.querySelector("#diag-payout").textContent = `${cargoDiagnostics.payoutUnits} units`;
  document.querySelector("#diag-distance").textContent = `${diagnostics.distanceToWreck.toFixed(2)} m`;
  document.querySelector("#diag-hull").textContent = `${collapseDiagnostics.hullIntegrity.toFixed(1)}/100`;
  document.querySelector("#diag-collapse-state").textContent = collapseDiagnostics.severityState;
  document.querySelector("#diag-graph").textContent = `${graphDiagnostics.nodeCount} nodes / ${graphDiagnostics.edgeCount} edges / ${graphDiagnostics.supportCount} supports`;
  document.querySelector("#diag-bodies").textContent = String(diagnostics.activeBodies);
  document.querySelector("#diag-input").textContent = runMode === "failure"
    ? "controls disabled — hull lost"
    : runMode === "dock"
      ? "docked"
      : describeInput(flightState, cutActive, tetherActive);

  dockPanel.hidden = runMode !== "dock";
  buyUpgradeButton.disabled = runMode !== "dock"
    || progressionDiagnostics.upgrades.clampDampers
    || progressionDiagnostics.credits < CLAMP_DAMPERS_COST_UNITS;
  buyUpgradeButton.textContent = progressionDiagnostics.upgrades.clampDampers
    ? "Clamp Dampers installed"
    : `Buy Clamp Dampers — ${CLAMP_DAMPERS_COST_UNITS} units`;
  launchNextRunButton.disabled = runMode !== "dock";

  if (runMode === "dock") {
    if (dockReason === "settled") {
      dockSummary.textContent = progressionDiagnostics.upgrades.clampDampers
        ? `Settlement banked. Clamp Dampers are installed; launch the next run with a ${CLAMP_DAMPERS_MAX_CAPTURE_SPEED_METERS_PER_SECOND.toFixed(2)} m/s capture ceiling.`
        : `Settlement banked. Buy Clamp Dampers for ${CLAMP_DAMPERS_COST_UNITS} units, then launch the next run.`;
    } else if (dockReason === "recovered") {
      dockSummary.textContent = `Failed run recovered cleanly. Persistent credits and installed upgrades are intact; launch a fresh run when ready.`;
    }
  }

  if (cargoDiagnostics.settlementState === "settled") {
    const items = cargoDiagnostics.settlementItems
      .map((item) => `${item.componentId} ${item.condition.toFixed(1)}% = ${item.adjustedValueUnits}`)
      .join(" | ");
    settlementSummary.textContent = `SOLD: ${items}; payout ${cargoDiagnostics.payoutUnits} units.`;
  } else if (cargoDiagnostics.securedCargoCount > 0) {
    settlementSummary.textContent = `Cargo secured. Retreat to ${CARGO_EXTRACTION_DISTANCE_METERS.toFixed(1)} m from the wreck to sell.`;
  } else {
    settlementSummary.textContent = "No settlement yet.";
  }

  if (runMode === "failure") {
    course.textContent = "Hull lost. Press X to recover the failed run to a clean dock state; physics continues until recovery.";
    status.textContent = "Failure recorded once. Progression remains separate from the continuing Rapier simulation.";
  } else if (runMode === "dock") {
    course.textContent = progressionDiagnostics.upgrades.clampDampers
      ? "Launch the next run. The installed dampers will apply only to the fresh run's clamp configuration."
      : `Spend ${CLAMP_DAMPERS_COST_UNITS} units on Clamp Dampers, then launch the next run.`;
    status.textContent = "Preparation state: physics is paused; persistent progression is visible and actionable.";
  } else if (cargoDiagnostics.captureState === "blocked-speed") {
    course.textContent = `Clamp rejected ${cargoDiagnostics.candidateId}: ${cargoDiagnostics.candidateRelativeSpeed.toFixed(2)} m/s exceeds this run's ${currentCaptureLimit.toFixed(2)} m/s ceiling.`;
    status.textContent = "Loose salvage remains physical and hazardous until the active run's capture rule is satisfied.";
  } else if (cargoDiagnostics.captureState === "secured") {
    course.textContent = `${cargoDiagnostics.candidateId} secured at ${cargoDiagnostics.candidateCondition.toFixed(1)}% condition. Retreat to extraction range.`;
    status.textContent = "Secured cargo is disabled from loose physics; return to sell it into persistent credits.";
  } else if (tetherDiagnostics.state === "attached") {
    course.textContent = `Winching ${tetherDiagnostics.targetId} toward the ${CARGO_CAPTURE_RADIUS_METERS.toFixed(0)} m clamp. This run allows up to ${currentCaptureLimit.toFixed(2)} m/s relative speed.`;
    status.textContent = "Tether force remains physical and bounded; progression does not move the salvage.";
  } else if (cut.state === "complete") {
    course.textContent = `Cut complete: ${cut.lastCompletedConnectionId}. Aim at detached salvage and hold T for physical recovery.`;
    status.textContent = "The component remains a live Rapier body until it is actually captured.";
  } else if (scan.state === "locked") {
    course.textContent = `${scan.connectionId}: ${scan.riskLevel} estimate / ${scan.placeholderValueUnits} units. Lower risk and higher value are deliberately not the same choice.`;
    status.textContent = "For the proof loop, recover the moderate-risk 250-unit panel first; the 1200-unit engine is the higher-risk alternative.";
  } else if (diagnostics.distanceToWreck > SCANNER_RANGE_METERS) {
    course.textContent = `Approach the wreck. Scanner ${SCANNER_RANGE_METERS.toFixed(0)} m; cutter ${CUTTER_RANGE_METERS.toFixed(0)} m; tether ${TETHER_RANGE_METERS.toFixed(0)} m.`;
    status.textContent = "Begin the next salvage decision from current physical structure.";
  } else {
    course.textContent = "Aim toward a cuttable connection to compare structural risk and salvage value.";
    status.textContent = "Scanner information is advisory; physical structure and player action remain authoritative.";
  }

  updateCutMarker(cut);
  updateScannerMarker(scan);
  updateTetherLine(tetherDiagnostics);
  const craftPosition = sandbox.getCraftBody().translation();
  captureEnvelope.position.set(craftPosition.x, craftPosition.y, craftPosition.z);
}

function frame(now) {
  if (disposed) return;
  const delta = (now - lastTime) / 1000;
  lastTime = now;
  loop.advance(delta, () => {
    if (runMode === "dock") return;

    if (runMode === "field") {
      cutter.step(sandbox, input.isCutActive());
      tether.step(sandbox, input.isTetherActive());
      sandbox.step(controller, input.getState());
      const tetherBeforeCapture = tether.getDiagnostics(sandbox);
      const capturedId = cargo.step(
        sandbox,
        tetherBeforeCapture.state === "attached" ? tetherBeforeCapture.targetId : null,
      );
      if (capturedId) tether.reset();
    } else {
      tether.step(sandbox, false);
      sandbox.step(controller, NEUTRAL_FLIGHT_INPUT);
    }

    graph.sync(sandbox, tether.getDiagnostics(sandbox));
    collapse.step(sandbox, graph);
    graph.sync(sandbox, tether.getDiagnostics(sandbox));

    const collapseDiagnostics = collapse.getDiagnostics();
    if (collapseDiagnostics.destroyed && runMode === "field" && !failureApplied) {
      progression.recordFailure(activeRunId);
      failureApplied = true;
      runMode = "failure";
      input.clear();
      return;
    }

    const cargoDiagnostics = cargo.getDiagnostics(sandbox);
    if (cargoDiagnostics.settlementState === "settled" && runMode === "field" && !settlementApplied) {
      progression.recordSettlement(activeRunId, cargoDiagnostics.payoutUnits);
      settlementApplied = true;
      runMode = "dock";
      dockReason = "settled";
      input.clear();
      tether.reset();
    }
  });
  presenter.sync(sandbox);
  presenter.updateCamera(sandbox, camera);
  updateDiagnostics();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

presenter.updateCamera(sandbox, camera);
updateDiagnostics();
document.body.dataset.phase9 = "ready";
requestAnimationFrame(frame);

window.addEventListener("beforeunload", () => {
  disposed = true;
  input.detach();
  window.removeEventListener("resize", resize);
  resetButton.removeEventListener("click", handleResetAction);
  buyUpgradeButton.removeEventListener("click", handleBuyUpgrade);
  launchNextRunButton.removeEventListener("click", handleLaunchNextRun);
  presenter.dispose();
  sandbox.dispose();
  referenceGrid.geometry.dispose();
  if (Array.isArray(referenceGrid.material)) referenceGrid.material.forEach((material) => material.dispose());
  else referenceGrid.material.dispose();
  axesHelper.geometry.dispose();
  if (Array.isArray(axesHelper.material)) axesHelper.material.forEach((material) => material.dispose());
  else axesHelper.material.dispose();
  cutMarker.geometry.dispose();
  cutMarker.material.dispose();
  scannerMarker.geometry.dispose();
  scannerMarker.material.dispose();
  tetherGeometry.dispose();
  tetherLine.material.dispose();
  captureEnvelope.geometry.dispose();
  captureEnvelope.material.dispose();
  renderer.dispose();
}, { once: true });
