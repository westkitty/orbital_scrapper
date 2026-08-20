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
import { FixedStepLoop } from "./runtime/FixedStepLoop.js";
import { FlightInputBindings } from "./runtime/FlightInputBindings.js";
import { SCANNER_RANGE_METERS, ScannerSystem } from "./scanner/ScannerSystem.js";
import { StructuralGraph } from "./structure/StructuralGraph.js";
import { TETHER_RANGE_METERS, TetherSystem } from "./tether/TetherSystem.js";

const app = document.querySelector("#app");
if (!app) throw new Error("Missing #app root");

app.innerHTML = `
  <section class="viewport" aria-label="Phase 8 cargo recovery viewport"></section>
  <aside class="panel" aria-label="Phase 8 cargo capture and settlement diagnostics">
    <p class="eyebrow">ORBITAL SCRAPPER // PHASE 8</p>
    <h1>Cargo Capture, Condition & Settlement</h1>
    <p class="copy">Scan and cut real structure, tether detached salvage into the green clamp envelope, keep relative speed low enough to secure it, then retreat to extraction range for settlement. Loose salvage stays physical until the clamp succeeds.</p>

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

    <button id="reset" type="button">Reset salvage run <kbd>X</kbd></button>

    <dl class="diagnostics">
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

    <p class="course" id="course">Recover the low-risk panel: scan → approach → cut → tether → slow capture → retreat.</p>
    <p class="status" id="status" role="status">Initializing Phase 8 salvage run…</p>
    <p class="status" id="settlement-summary" aria-live="polite">No settlement yet.</p>
  </aside>
`;

const viewport = app.querySelector(".viewport");
const resetButton = document.querySelector("#reset");
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

const sandbox = await WreckSandbox.create();
const controller = new FlightController();
const cutter = new CuttingSystem();
const tether = new TetherSystem();
const graph = new StructuralGraph();
const scanner = new ScannerSystem();
const collapse = new CollapseSystem();
const cargo = new CargoSystem();
graph.sync(sandbox, tether.getDiagnostics(sandbox));
collapse.step(sandbox, graph);
const presenter = new FlightScenePresenter(scene);
presenter.rebuild(sandbox);
const loop = new FixedStepLoop(FIXED_TIMESTEP_SECONDS, 5);

let lastTime = performance.now();
let disposed = false;

function resetScene() {
  sandbox.reset();
  cutter.reset();
  tether.reset();
  collapse.reset();
  cargo.reset();
  graph.sync(sandbox, tether.getDiagnostics(sandbox));
  collapse.step(sandbox, graph);
  loop.reset();
  input.clear();
  presenter.rebuild(sandbox);
  updateDiagnostics();
}

const input = new FlightInputBindings(window, { reset: resetScene });
input.attach();
resetButton.addEventListener("click", resetScene);

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
  const flightState = input?.getState?.() ?? NEUTRAL_FLIGHT_INPUT;
  const cutActive = input?.isCutActive?.() ?? false;
  const tetherActive = input?.isTetherActive?.() ?? false;

  document.querySelector("#diag-scan-target").textContent = scan.state === "locked" ? scan.connectionId : "none";
  document.querySelector("#diag-scan-risk").textContent = scan.state === "locked" ? `${scan.riskLevel} estimate` : "no estimate";
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
  document.querySelector("#diag-input").textContent = collapseDiagnostics.destroyed
    ? "controls disabled — hull lost"
    : describeInput(flightState, cutActive, tetherActive);

  if (cargoDiagnostics.settlementState === "settled") {
    const items = cargoDiagnostics.settlementItems
      .map((item) => `${item.componentId} ${item.condition.toFixed(1)}% = ${item.adjustedValueUnits}`)
      .join(" | ");
    settlementSummary.textContent = `SETTLED: ${items}; payout ${cargoDiagnostics.payoutUnits} units.`;
  } else if (cargoDiagnostics.securedCargoCount > 0) {
    settlementSummary.textContent = `Cargo secured. Retreat to ${CARGO_EXTRACTION_DISTANCE_METERS.toFixed(1)} m from the wreck to settle.`;
  } else {
    settlementSummary.textContent = "No settlement yet.";
  }

  if (collapseDiagnostics.destroyed) {
    course.textContent = "Hull lost. Cargo cannot be settled from a destroyed run; reset and recover it cleanly.";
    status.textContent = "Failure state: craft destroyed; physics continues until reset.";
  } else if (cargoDiagnostics.settlementState === "settled") {
    course.textContent = `Recovery complete: ${cargoDiagnostics.securedCargoIds.join(", ")} settled for ${cargoDiagnostics.payoutUnits} units.`;
    status.textContent = "Phase 8 transaction complete. No currency persistence or upgrade has been added.";
  } else if (cargoDiagnostics.captureState === "blocked-speed") {
    course.textContent = `Clamp rejected ${cargoDiagnostics.candidateId}: ${cargoDiagnostics.candidateRelativeSpeed.toFixed(2)} m/s exceeds ${CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND.toFixed(2)} m/s. Brake or let the tether damp motion.`;
    status.textContent = "Loose salvage remains a live hazardous rigid body until capture conditions are valid.";
  } else if (cargoDiagnostics.captureState === "secured") {
    course.textContent = `${cargoDiagnostics.candidateId} secured at ${cargoDiagnostics.candidateCondition.toFixed(1)}% condition. Retreat to extraction range.`;
    status.textContent = "Secured cargo is serialized by disabling its Rapier body/colliders and is no longer a loose threat.";
  } else if (tetherDiagnostics.state === "attached") {
    course.textContent = `Winching ${tetherDiagnostics.targetId} toward the ${CARGO_CAPTURE_RADIUS_METERS.toFixed(0)} m clamp envelope. Keep relative speed below ${CARGO_MAX_RELATIVE_SPEED_METERS_PER_SECOND.toFixed(2)} m/s.`;
    status.textContent = "Tether force remains physical and bounded; capture is not a teleport.";
  } else if (cut.state === "complete") {
    course.textContent = `Cut complete: ${cut.lastCompletedConnectionId}. Aim at the detached salvage and hold T to begin physical recovery.`;
    status.textContent = "Detached salvage remains enabled in Rapier until it actually reaches a valid clamp state.";
  } else if (scan.state === "locked") {
    course.textContent = `${scan.connectionId}: ${scan.riskLevel} estimate. Approach within ${CUTTER_RANGE_METERS.toFixed(0)} m and hold C when ready.`;
    status.textContent = "Use the existing low-risk panel path for the Phase 8 proof recovery.";
  } else if (diagnostics.distanceToWreck > SCANNER_RANGE_METERS) {
    course.textContent = `Approach the wreck. Scanner ${SCANNER_RANGE_METERS.toFixed(0)} m; cutter ${CUTTER_RANGE_METERS.toFixed(0)} m; tether ${TETHER_RANGE_METERS.toFixed(0)} m.`;
    status.textContent = "No recovery target yet.";
  } else {
    course.textContent = "Aim toward the panel connection to acquire a live structural estimate.";
    status.textContent = "Loose cargo condition is only tracked after a component is physically detached.";
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
    const destroyed = collapse.getDiagnostics().destroyed;
    if (!destroyed) {
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
  });
  presenter.sync(sandbox);
  presenter.updateCamera(sandbox, camera);
  updateDiagnostics();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

presenter.updateCamera(sandbox, camera);
updateDiagnostics();
document.body.dataset.phase8 = "ready";
requestAnimationFrame(frame);

window.addEventListener("beforeunload", () => {
  disposed = true;
  input.detach();
  window.removeEventListener("resize", resize);
  resetButton.removeEventListener("click", resetScene);
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
