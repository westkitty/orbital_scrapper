// @ts-nocheck
import * as THREE from "three";
import "./style.css";
import { CollapseSystem } from "./collapse/CollapseSystem.js";
import { CuttingSystem, CUTTER_AIM_COSINE, CUTTER_RANGE_METERS } from "./cutting/CuttingSystem.js";
import { FlightController, NEUTRAL_FLIGHT_INPUT } from "./flight/FlightController.js";
import { WreckSandbox } from "./physics/WreckSandbox.js";
import { FIXED_TIMESTEP_SECONDS } from "./physics/PhysicsSandbox.js";
import { FlightScenePresenter } from "./presentation/FlightScenePresenter.js";
import { FixedStepLoop } from "./runtime/FixedStepLoop.js";
import { FlightInputBindings } from "./runtime/FlightInputBindings.js";
import { SCANNER_RANGE_METERS, ScannerSystem } from "./scanner/ScannerSystem.js";
import { StructuralGraph } from "./structure/StructuralGraph.js";
import { TETHER_MAX_TENSION_NEWTONS, TETHER_RANGE_METERS, TetherSystem } from "./tether/TetherSystem.js";

const app = document.querySelector("#app");
if (!app) throw new Error("Missing #app root");

app.innerHTML = `
  <section class="viewport" aria-label="Phase 7 collapse escalation and survival viewport"></section>
  <aside class="panel" aria-label="Phase 7 collapse, scanner, and salvage diagnostics">
    <p class="eyebrow">ORBITAL SCRAPPER // PHASE 7</p>
    <h1>Collapse Escalation & Hull Survival</h1>
    <p class="copy">The scanner still estimates structural risk. Live collapse state now comes from actual detached mass, closing motion, contact force, and impact-driven joint failure. Nothing runs on a scripted collapse timer.</p>

    <div class="control-grid" aria-label="Flight, cutter, tether, and passive scanner controls">
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

    <button id="reset" type="button">Reset danger fixture <kbd>X</kbd></button>

    <dl class="diagnostics">
      <div><dt>Live collapse</dt><dd id="diag-collapse-state">—</dd></div>
      <div><dt>Severity</dt><dd id="diag-collapse-severity">—</dd></div>
      <div><dt>Hull integrity</dt><dd id="diag-hull">—</dd></div>
      <div><dt>Highest threat</dt><dd id="diag-collapse-threat">—</dd></div>
      <div><dt>Threat range</dt><dd id="diag-collapse-range">—</dd></div>
      <div><dt>Closing speed</dt><dd id="diag-collapse-closing">—</dd></div>
      <div><dt>Warning direction</dt><dd id="diag-collapse-warning">—</dd></div>
      <div><dt>Warning cue</dt><dd id="diag-collapse-cue">—</dd></div>
      <div><dt>Last impact</dt><dd id="diag-impact-body">—</dd></div>
      <div><dt>Impact force</dt><dd id="diag-impact-force">—</dd></div>
      <div><dt>Impact impulse</dt><dd id="diag-impact-impulse">—</dd></div>
      <div><dt>Impact damage</dt><dd id="diag-impact-damage">—</dd></div>
      <div><dt>Secondary breaks</dt><dd id="diag-secondary-breaks">—</dd></div>
      <div><dt>Scanner target</dt><dd id="diag-scan-target">—</dd></div>
      <div><dt>Relationship</dt><dd id="diag-scan-relationship">—</dd></div>
      <div><dt>Scanned object</dt><dd id="diag-scan-object">—</dd></div>
      <div><dt>Component type</dt><dd id="diag-scan-type">—</dd></div>
      <div><dt>Mass class</dt><dd id="diag-scan-mass">—</dd></div>
      <div><dt>Placeholder value</dt><dd id="diag-scan-value">—</dd></div>
      <div><dt>Likely free</dt><dd id="diag-scan-free">—</dd></div>
      <div><dt>Bridge / alternate</dt><dd id="diag-scan-path">—</dd></div>
      <div><dt>Temporary support</dt><dd id="diag-scan-support">—</dd></div>
      <div><dt>Relative motion</dt><dd id="diag-scan-motion">—</dd></div>
      <div><dt>Predicted risk</dt><dd id="diag-scan-risk">—</dd></div>
      <div><dt>Risk score</dt><dd id="diag-scan-score">—</dd></div>
      <div><dt>Estimate basis</dt><dd id="diag-scan-reasons">—</dd></div>
      <div><dt>Speed</dt><dd id="diag-speed">—</dd></div>
      <div><dt>Wreck distance</dt><dd id="diag-distance">—</dd></div>
      <div><dt>Position</dt><dd id="diag-position">—</dd></div>
      <div><dt>Wreck modules</dt><dd id="diag-components">—</dd></div>
      <div><dt>Live joints</dt><dd id="diag-connections">—</dd></div>
      <div><dt>Cuttable joints</dt><dd id="diag-cuttable">—</dd></div>
      <div><dt>Severed joints</dt><dd id="diag-severed">—</dd></div>
      <div><dt>Graph nodes</dt><dd id="diag-graph-nodes">—</dd></div>
      <div><dt>Graph edges</dt><dd id="diag-graph-edges">—</dd></div>
      <div><dt>Temporary supports</dt><dd id="diag-graph-supports">—</dd></div>
      <div><dt>Bridge joints</dt><dd id="diag-graph-bridges">—</dd></div>
      <div><dt>Articulation modules</dt><dd id="diag-graph-articulations">—</dd></div>
      <div><dt>Spine section</dt><dd id="diag-graph-section">—</dd></div>
      <div><dt>Topology revision</dt><dd id="diag-graph-topology-rev">—</dd></div>
      <div><dt>Support revision</dt><dd id="diag-graph-support-rev">—</dd></div>
      <div><dt>Cut target</dt><dd id="diag-cut-target">—</dd></div>
      <div><dt>Cutter state</dt><dd id="diag-cut-state">—</dd></div>
      <div><dt>Cut progress</dt><dd id="diag-cut-progress">—</dd></div>
      <div><dt>Last cut</dt><dd id="diag-last-cut">—</dd></div>
      <div><dt>Tether target</dt><dd id="diag-tether-target">—</dd></div>
      <div><dt>Tether state</dt><dd id="diag-tether-state">—</dd></div>
      <div><dt>Tether range</dt><dd id="diag-tether-distance">—</dd></div>
      <div><dt>Target length</dt><dd id="diag-tether-length">—</dd></div>
      <div><dt>Tension</dt><dd id="diag-tether-tension">—</dd></div>
      <div><dt>Load</dt><dd id="diag-tether-load">—</dd></div>
      <div><dt>Tether release</dt><dd id="diag-tether-release">—</dd></div>
      <div><dt>Max joint error</dt><dd id="diag-joint-error">—</dd></div>
      <div><dt>Rigid bodies</dt><dd id="diag-bodies">—</dd></div>
      <div><dt>Fixed step</dt><dd id="diag-step">—</dd></div>
      <div><dt>Input</dt><dd id="diag-input">neutral</dd></div>
    </dl>

    <p class="course" id="course">The heavy engine connection is the danger fixture. Scan it before cutting; if it comes free, react to the measured warning instead of assuming the scanner prediction is destiny.</p>
    <p class="status" id="status" role="status">Initializing live collapse telemetry…</p>
  </aside>
`;

const viewport = app.querySelector(".viewport");
const resetButton = document.querySelector("#reset");
const status = document.querySelector("#status");
const course = document.querySelector("#course");

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
const tetherLine = new THREE.Line(
  tetherGeometry,
  new THREE.LineBasicMaterial({ color: 0x7dd3fc }),
);
tetherLine.visible = false;
scene.add(tetherLine);

const sandbox = await WreckSandbox.create({ phase7DangerFixture: true });
const controller = new FlightController();
const cutter = new CuttingSystem();
const tether = new TetherSystem();
const graph = new StructuralGraph();
const scanner = new ScannerSystem();
const collapse = new CollapseSystem();
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
  const craft = sandbox.getCraftBody().translation();
  const target = sandbox.getWreckComponent(tetherDiagnostics.targetId).body.translation();
  tetherPositions[0] = craft.x;
  tetherPositions[1] = craft.y;
  tetherPositions[2] = craft.z;
  tetherPositions[3] = target.x;
  tetherPositions[4] = target.y;
  tetherPositions[5] = target.z;
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
  const flightState = input?.getState?.() ?? NEUTRAL_FLIGHT_INPUT;
  const cutActive = input?.isCutActive?.() ?? false;
  const tetherActive = input?.isTetherActive?.() ?? false;

  document.querySelector("#diag-collapse-state").textContent = collapseDiagnostics.severityState;
  document.querySelector("#diag-collapse-severity").textContent = `${Math.round(collapseDiagnostics.severityScore)}/100`;
  document.querySelector("#diag-hull").textContent = `${collapseDiagnostics.hullIntegrity.toFixed(1)}/100`;
  document.querySelector("#diag-collapse-threat").textContent = collapseDiagnostics.highestThreatComponentId ?? "none";
  document.querySelector("#diag-collapse-range").textContent = Number.isFinite(collapseDiagnostics.highestThreatDistance)
    ? `${collapseDiagnostics.highestThreatDistance.toFixed(2)} m`
    : "—";
  document.querySelector("#diag-collapse-closing").textContent = `${collapseDiagnostics.highestThreatClosingSpeed.toFixed(2)} m/s`;
  document.querySelector("#diag-collapse-warning").textContent = collapseDiagnostics.warningDirection;
  document.querySelector("#diag-collapse-cue").textContent = collapseDiagnostics.warningCue;
  document.querySelector("#diag-impact-body").textContent = collapseDiagnostics.lastImpactBodyId ?? "none";
  document.querySelector("#diag-impact-force").textContent = `${collapseDiagnostics.lastImpactForceNewtons.toFixed(1)} N`;
  document.querySelector("#diag-impact-impulse").textContent = `${collapseDiagnostics.lastImpactImpulse.toFixed(2)} N·s`;
  document.querySelector("#diag-impact-damage").textContent = collapseDiagnostics.lastImpactDamage > 0
    ? `-${collapseDiagnostics.lastImpactDamage.toFixed(1)}`
    : "0";
  document.querySelector("#diag-secondary-breaks").textContent = collapseDiagnostics.lastSecondaryBreakId
    ? `${collapseDiagnostics.secondaryBreakCount} (${collapseDiagnostics.lastSecondaryBreakId})`
    : String(collapseDiagnostics.secondaryBreakCount);

  if (scan.state === "locked") {
    document.querySelector("#diag-scan-target").textContent = scan.connectionId;
    document.querySelector("#diag-scan-relationship").textContent = scan.relationship;
    document.querySelector("#diag-scan-object").textContent = scan.displayComponentId;
    document.querySelector("#diag-scan-type").textContent = scan.componentType;
    document.querySelector("#diag-scan-mass").textContent = scan.massClass;
    document.querySelector("#diag-scan-value").textContent = `${scan.placeholderValueUnits} units`;
    document.querySelector("#diag-scan-free").textContent = scan.likelyFreeComponentIds.join(", ") || "none — alternate path remains";
    document.querySelector("#diag-scan-path").textContent = scan.bridge ? "bridge / sole path" : "alternate path remains";
    document.querySelector("#diag-scan-support").textContent = scan.temporarySupport ? "active" : "none";
    document.querySelector("#diag-scan-motion").textContent = `${scan.relativeSpeed.toFixed(2)} m/s`;
    document.querySelector("#diag-scan-risk").textContent = `${scan.riskLevel} estimate`;
    document.querySelector("#diag-scan-score").textContent = `${Math.round(scan.riskScore)}/100`;
    document.querySelector("#diag-scan-reasons").textContent = scan.reasons.join(" | ");
  } else {
    document.querySelector("#diag-scan-target").textContent = "none";
    document.querySelector("#diag-scan-relationship").textContent = "—";
    document.querySelector("#diag-scan-object").textContent = "—";
    document.querySelector("#diag-scan-type").textContent = "—";
    document.querySelector("#diag-scan-mass").textContent = "—";
    document.querySelector("#diag-scan-value").textContent = "—";
    document.querySelector("#diag-scan-free").textContent = "—";
    document.querySelector("#diag-scan-path").textContent = "—";
    document.querySelector("#diag-scan-support").textContent = "—";
    document.querySelector("#diag-scan-motion").textContent = "—";
    document.querySelector("#diag-scan-risk").textContent = "no estimate";
    document.querySelector("#diag-scan-score").textContent = "—";
    document.querySelector("#diag-scan-reasons").textContent = scan.reasons.join(" | ");
  }

  document.querySelector("#diag-speed").textContent = `${diagnostics.linearSpeed.toFixed(2)} m/s`;
  document.querySelector("#diag-distance").textContent = `${diagnostics.distanceToWreck.toFixed(2)} m`;
  document.querySelector("#diag-position").textContent = `${diagnostics.position.x.toFixed(1)}, ${diagnostics.position.y.toFixed(1)}, ${diagnostics.position.z.toFixed(1)}`;
  document.querySelector("#diag-components").textContent = String(diagnostics.wreckComponentCount);
  document.querySelector("#diag-connections").textContent = String(diagnostics.wreckConnectionCount);
  document.querySelector("#diag-cuttable").textContent = String(diagnostics.wreckCuttableConnectionCount);
  document.querySelector("#diag-severed").textContent = String(diagnostics.wreckSeveredConnectionCount);
  document.querySelector("#diag-graph-nodes").textContent = String(graphDiagnostics.nodeCount);
  document.querySelector("#diag-graph-edges").textContent = String(graphDiagnostics.edgeCount);
  document.querySelector("#diag-graph-supports").textContent = String(graphDiagnostics.supportCount);
  document.querySelector("#diag-graph-bridges").textContent = graphDiagnostics.bridgeConnectionIds.join(", ") || "none";
  document.querySelector("#diag-graph-articulations").textContent = graphDiagnostics.articulationComponentIds.join(", ") || "none";
  document.querySelector("#diag-graph-section").textContent = String(graphDiagnostics.spineSectionSize);
  document.querySelector("#diag-graph-topology-rev").textContent = String(graphDiagnostics.topologyRevision);
  document.querySelector("#diag-graph-support-rev").textContent = String(graphDiagnostics.supportRevision);
  document.querySelector("#diag-cut-target").textContent = cut.targetId ?? "none";
  document.querySelector("#diag-cut-state").textContent = cut.state;
  document.querySelector("#diag-cut-progress").textContent = `${Math.round(cut.progress01 * 100)}%`;
  document.querySelector("#diag-last-cut").textContent = cut.lastCompletedConnectionId ?? "none";
  document.querySelector("#diag-tether-target").textContent = tetherDiagnostics.targetId ?? "none";
  document.querySelector("#diag-tether-state").textContent = tetherDiagnostics.state;
  document.querySelector("#diag-tether-distance").textContent = Number.isFinite(tetherDiagnostics.targetDistance) ? `${tetherDiagnostics.targetDistance.toFixed(2)} m` : "—";
  document.querySelector("#diag-tether-length").textContent = tetherDiagnostics.targetLength > 0 ? `${tetherDiagnostics.targetLength.toFixed(2)} m` : "—";
  document.querySelector("#diag-tether-tension").textContent = `${tetherDiagnostics.tensionNewtons.toFixed(1)} N`;
  document.querySelector("#diag-tether-load").textContent = `${Math.round(tetherDiagnostics.loadRatio * 100)}%`;
  document.querySelector("#diag-tether-release").textContent = tetherDiagnostics.lastReleaseReason ?? "none";
  document.querySelector("#diag-joint-error").textContent = `${(diagnostics.maxConnectionError * 1000).toFixed(2)} mm`;
  document.querySelector("#diag-bodies").textContent = String(diagnostics.activeBodies);
  document.querySelector("#diag-step").textContent = `${(diagnostics.fixedTimestepSeconds * 1000).toFixed(2)} ms`;
  document.querySelector("#diag-input").textContent = collapseDiagnostics.destroyed
    ? "controls disabled — hull lost"
    : describeInput(flightState, cutActive, tetherActive);

  if (graphDiagnostics.nodeCount !== diagnostics.wreckComponentCount || graphDiagnostics.edgeCount !== diagnostics.wreckConnectionCount) {
    course.textContent = "Graph/physics mismatch detected. Scanner and collapse interpretation are withheld until structure is synchronized.";
    status.textContent = "Structural synchronization failure.";
  } else if (collapseDiagnostics.destroyed) {
    course.textContent = `HULL LOST after a measured ${collapseDiagnostics.lastImpactImpulse.toFixed(2)} N·s impact from ${collapseDiagnostics.lastImpactBodyId ?? "debris"}. Press X to reset.`;
    status.textContent = "Failure state: craft destroyed. Physics continues, player controls are disabled.";
  } else if (collapseDiagnostics.severityState === "critical" || collapseDiagnostics.severityState === "danger") {
    course.textContent = `${collapseDiagnostics.severityState.toUpperCase()}: ${collapseDiagnostics.highestThreatComponentId ?? "debris"} ${collapseDiagnostics.warningDirection}; closing ${collapseDiagnostics.highestThreatClosingSpeed.toFixed(2)} m/s.`;
    status.textContent = `Live warning ${collapseDiagnostics.warningCue}; severity ${Math.round(collapseDiagnostics.severityScore)}/100 from current simulation state.`;
  } else if (collapseDiagnostics.severityState === "elevated") {
    course.textContent = `Caution: ${collapseDiagnostics.highestThreatComponentId ?? "detached mass"} is producing an elevated live threat. Move, brake, or tether to change the geometry.`;
    status.textContent = `Live warning ${collapseDiagnostics.warningCue}; severity ${Math.round(collapseDiagnostics.severityScore)}/100.`;
  } else if (tetherDiagnostics.state === "snapped") {
    course.textContent = `Tether overload exceeded ${TETHER_MAX_TENSION_NEWTONS.toFixed(0)} N. Scanner support state clears with the failed tether.`;
    status.textContent = scan.state === "locked" ? `Current prediction: ${scan.riskLevel} estimate without active support.` : "Scanner has no valid target.";
  } else if (tetherDiagnostics.state === "attached" && scan.state === "locked") {
    course.textContent = `Temporary support on ${tetherDiagnostics.targetId} is included in the ${scan.connectionId} estimate and physically changes motion.`;
    status.textContent = `Supported prediction: ${scan.riskLevel} (${Math.round(scan.riskScore)}/100), not a guarantee.`;
  } else if (cut.state === "complete") {
    course.textContent = scan.state === "locked"
      ? `Cut complete: ${cut.lastCompletedConnectionId}. Scanner refreshed to ${scan.connectionId}; live collapse telemetry now follows actual detached motion.`
      : `Cut complete: ${cut.lastCompletedConnectionId}. The severed connection is gone; live collapse telemetry follows current physics.`;
    status.textContent = "Prediction and live danger are separate: scanner predicts; collapse state measures what actually happens.";
  } else if (scan.state === "locked") {
    course.textContent = `${scan.relationship}: ${scan.riskLevel} estimate. Likely free: ${scan.likelyFreeComponentIds.join(", ") || "none because an alternate path remains"}.`;
    status.textContent = `Prediction uses live topology/mass/support. Live collapse is ${collapseDiagnostics.severityState} because no dangerous motion exists yet.`;
  } else if (diagnostics.distanceToWreck > SCANNER_RANGE_METERS) {
    course.textContent = `Approach under control. Scanner range ${SCANNER_RANGE_METERS.toFixed(0)} m; cutter ${CUTTER_RANGE_METERS.toFixed(0)} m; tether ${TETHER_RANGE_METERS.toFixed(0)} m.`;
    status.textContent = "No scanner estimate outside current proof range.";
  } else if (!cut.canCut) {
    course.textContent = `Aim toward a live connection. Required cutter alignment remains ${CUTTER_AIM_COSINE.toFixed(2)}.`;
    status.textContent = "Scanner searches live graph edges; collapse telemetry remains quiet until measurable danger exists.";
  } else {
    course.textContent = "Scanner is searching current live connections.";
    status.textContent = "No target lock; no prediction is being asserted.";
  }

  updateCutMarker(cut);
  updateScannerMarker(scan);
  updateTetherLine(tetherDiagnostics);
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
document.body.dataset.phase7 = "ready";
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
  renderer.dispose();
}, { once: true });
