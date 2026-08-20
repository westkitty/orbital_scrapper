// @ts-nocheck
import * as THREE from "three";
import "./style.css";
import { CuttingSystem, CUTTER_AIM_COSINE, CUTTER_RANGE_METERS } from "./cutting/CuttingSystem.js";
import { FlightController } from "./flight/FlightController.js";
import { WreckSandbox } from "./physics/WreckSandbox.js";
import { FIXED_TIMESTEP_SECONDS } from "./physics/PhysicsSandbox.js";
import { FlightScenePresenter } from "./presentation/FlightScenePresenter.js";
import { FixedStepLoop } from "./runtime/FixedStepLoop.js";
import { FlightInputBindings } from "./runtime/FlightInputBindings.js";
import { StructuralGraph } from "./structure/StructuralGraph.js";
import { TETHER_MAX_TENSION_NEWTONS, TETHER_RANGE_METERS, TetherSystem } from "./tether/TetherSystem.js";

const app = document.querySelector("#app");
if (!app) throw new Error("Missing #app root");

app.innerHTML = `
  <section class="viewport" aria-label="Phase 5 structural graph synchronization viewport"></section>
  <aside class="panel" aria-label="Phase 5 structural graph diagnostics and salvage controls">
    <p class="eyebrow">ORBITAL SCRAPPER // PHASE 5</p>
    <h1>Structural Graph Synchronization</h1>
    <p class="copy">The physical wreck remains authoritative. A synchronized graph now mirrors live modules and joints, while active tether braces appear only as temporary support state.</p>

    <div class="control-grid" aria-label="Flight, cutter, and tether controls">
      <div><strong>Thrust</strong><span><kbd>W</kbd>/<kbd>S</kbd></span></div>
      <div><strong>Strafe</strong><span><kbd>A</kbd>/<kbd>D</kbd></span></div>
      <div><strong>Vertical</strong><span><kbd>R</kbd>/<kbd>F</kbd></span></div>
      <div><strong>Pitch / yaw</strong><span><kbd>↑↓</kbd> <kbd>←→</kbd></span></div>
      <div><strong>Roll</strong><span><kbd>Q</kbd>/<kbd>E</kbd></span></div>
      <div><strong>Brake</strong><span><kbd>Space</kbd></span></div>
      <div><strong>Cutter</strong><span><kbd>C</kbd> hold</span></div>
      <div><strong>Tether</strong><span><kbd>T</kbd> hold</span></div>
    </div>

    <button id="reset" type="button">Reset wreck scene <kbd>X</kbd></button>

    <dl class="diagnostics">
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

    <p class="course" id="course">The graph starts with six nodes and six physical edges. Cut the panel and watch one graph edge disappear while the panel node remains.</p>
    <p class="status" id="status" role="status">Initializing structural graph…</p>
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

const tetherPositions = new Float32Array(6);
const tetherGeometry = new THREE.BufferGeometry();
tetherGeometry.setAttribute("position", new THREE.BufferAttribute(tetherPositions, 3));
const tetherLine = new THREE.Line(
  tetherGeometry,
  new THREE.LineBasicMaterial({ color: 0x7dd3fc }),
);
tetherLine.visible = false;
scene.add(tetherLine);

const sandbox = await WreckSandbox.create();
const controller = new FlightController();
const cutter = new CuttingSystem();
const tether = new TetherSystem();
const graph = new StructuralGraph();
graph.sync(sandbox, tether.getDiagnostics(sandbox));
const presenter = new FlightScenePresenter(scene);
presenter.rebuild(sandbox);
const loop = new FixedStepLoop(FIXED_TIMESTEP_SECONDS, 5);

let lastTime = performance.now();
let disposed = false;

function resetScene() {
  sandbox.reset();
  cutter.reset();
  tether.reset();
  graph.sync(sandbox, tether.getDiagnostics(sandbox));
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
  const flightState = input?.getState?.() ?? { forward: 0, strafe: 0, vertical: 0, pitch: 0, yaw: 0, roll: 0, brake: false };
  const cutActive = input?.isCutActive?.() ?? false;
  const tetherActive = input?.isTetherActive?.() ?? false;

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
  document.querySelector("#diag-input").textContent = describeInput(flightState, cutActive, tetherActive);

  if (graphDiagnostics.nodeCount !== diagnostics.wreckComponentCount || graphDiagnostics.edgeCount !== diagnostics.wreckConnectionCount) {
    course.textContent = "Graph/physics mismatch detected. Phase 5 must not proceed with divergent topology.";
    status.textContent = "Structural graph synchronization failure.";
  } else if (tetherDiagnostics.state === "snapped") {
    course.textContent = `Tether overload exceeded ${TETHER_MAX_TENSION_NEWTONS.toFixed(0)} N. Temporary graph support is removed until re-engagement.`;
    status.textContent = "Tether snapped; permanent graph topology remains unchanged.";
  } else if (tetherDiagnostics.state === "attached") {
    course.textContent = `Temporary support active on ${tetherDiagnostics.targetId}. Permanent edges remain tied only to live wreck joints.`;
    status.textContent = "Graph mirrors physical topology plus one temporary tether support.";
  } else if (cut.state === "complete") {
    course.textContent = `Cut complete: ${cut.lastCompletedConnectionId}. Graph now has ${graphDiagnostics.edgeCount} live edges while all ${graphDiagnostics.nodeCount} component nodes remain.`;
    status.textContent = "Physical joint removal and graph edge removal are synchronized.";
  } else if (diagnostics.distanceToWreck > CUTTER_RANGE_METERS) {
    course.textContent = `Approach under control. Cutter range is ${CUTTER_RANGE_METERS.toFixed(0)} m; tether range is ${TETHER_RANGE_METERS.toFixed(0)} m.`;
    status.textContent = "Graph is synchronized; salvage tools are outside working range.";
  } else if (!cut.canCut) {
    course.textContent = `Aim toward the marked cut joint. Current bridge set: ${graphDiagnostics.bridgeConnectionIds.join(", ") || "none"}.`;
    status.textContent = "Topology queries are live; scanner risk prediction is intentionally not implemented yet.";
  } else if (cut.state === "cutting") {
    course.textContent = `Cutting ${cut.targetId}: ${Math.round(cut.progress01 * 100)}%. Graph changes only when the physical joint actually disappears.`;
    status.textContent = "Structural graph is following the live wreck, not predicting it.";
  } else {
    course.textContent = `Graph synchronized: ${graphDiagnostics.nodeCount} nodes, ${graphDiagnostics.edgeCount} edges, ${graphDiagnostics.bridgeConnectionIds.length} bridges.`;
    status.textContent = "Physical wreck remains authoritative; graph is ready for structural reasoning tests.";
  }
  updateCutMarker(cut);
  updateTetherLine(tetherDiagnostics);
}

function frame(now) {
  if (disposed) return;
  const delta = (now - lastTime) / 1000;
  lastTime = now;
  loop.advance(delta, () => {
    cutter.step(sandbox, input.isCutActive());
    tether.step(sandbox, input.isTetherActive());
    sandbox.step(controller, input.getState());
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
document.body.dataset.phase5 = "ready";
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
  tetherGeometry.dispose();
  tetherLine.material.dispose();
  renderer.dispose();
}, { once: true });
