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

const app = document.querySelector("#app");
if (!app) throw new Error("Missing #app root");

app.innerHTML = `
  <section class="viewport" aria-label="Phase 3 cutting and physical separation viewport"></section>
  <aside class="panel" aria-label="Phase 3 cutter controls and diagnostics">
    <p class="eyebrow">ORBITAL SCRAPPER // PHASE 3</p>
    <h1>Cutting & Physical Separation</h1>
    <p class="copy">Aim the craft at a designated joint, hold the cutter in range, and sever the real Rapier constraint. Components remain physical after separation.</p>

    <div class="control-grid" aria-label="Flight and cutter controls">
      <div><strong>Thrust</strong><span><kbd>W</kbd>/<kbd>S</kbd></span></div>
      <div><strong>Strafe</strong><span><kbd>A</kbd>/<kbd>D</kbd></span></div>
      <div><strong>Vertical</strong><span><kbd>R</kbd>/<kbd>F</kbd></span></div>
      <div><strong>Pitch / yaw</strong><span><kbd>↑↓</kbd> <kbd>←→</kbd></span></div>
      <div><strong>Roll</strong><span><kbd>Q</kbd>/<kbd>E</kbd></span></div>
      <div><strong>Brake</strong><span><kbd>Space</kbd></span></div>
      <div><strong>Cutter</strong><span><kbd>C</kbd> hold</span></div>
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
      <div><dt>Cut target</dt><dd id="diag-cut-target">—</dd></div>
      <div><dt>Cut class</dt><dd id="diag-cut-class">—</dd></div>
      <div><dt>Target range</dt><dd id="diag-cut-range">—</dd></div>
      <div><dt>Aim</dt><dd id="diag-cut-aim">—</dd></div>
      <div><dt>Cutter state</dt><dd id="diag-cut-state">—</dd></div>
      <div><dt>Cut progress</dt><dd id="diag-cut-progress">—</dd></div>
      <div><dt>Last cut</dt><dd id="diag-last-cut">—</dd></div>
      <div><dt>Separation</dt><dd id="diag-cut-separation">—</dd></div>
      <div><dt>Max joint error</dt><dd id="diag-joint-error">—</dd></div>
      <div><dt>Rigid bodies</dt><dd id="diag-bodies">—</dd></div>
      <div><dt>Fixed step</dt><dd id="diag-step">—</dd></div>
      <div><dt>Input</dt><dd id="diag-input">neutral</dd></div>
    </dl>

    <p class="course" id="course">The green panel joint is the low-risk cut. The orange engine joint is the large-mass cut. Aim with the craft and hold <kbd>C</kbd>.</p>
    <p class="status" id="status" role="status">Initializing cutter scene…</p>
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

const sandbox = await WreckSandbox.create();
const controller = new FlightController();
const cutter = new CuttingSystem();
const presenter = new FlightScenePresenter(scene);
presenter.rebuild(sandbox);
const loop = new FixedStepLoop(FIXED_TIMESTEP_SECONDS, 5);

let lastTime = performance.now();
let disposed = false;

function resetScene() {
  sandbox.reset();
  cutter.reset();
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

function describeInput(state, cutActive) {
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

function updateDiagnostics() {
  const diagnostics = sandbox.getDiagnostics();
  const cut = cutter.getDiagnostics(sandbox);
  const flightState = input?.getState?.() ?? { forward: 0, strafe: 0, vertical: 0, pitch: 0, yaw: 0, roll: 0, brake: false };
  const cutActive = input?.isCutActive?.() ?? false;

  document.querySelector("#diag-speed").textContent = `${diagnostics.linearSpeed.toFixed(2)} m/s`;
  document.querySelector("#diag-distance").textContent = `${diagnostics.distanceToWreck.toFixed(2)} m`;
  document.querySelector("#diag-position").textContent = `${diagnostics.position.x.toFixed(1)}, ${diagnostics.position.y.toFixed(1)}, ${diagnostics.position.z.toFixed(1)}`;
  document.querySelector("#diag-components").textContent = String(diagnostics.wreckComponentCount);
  document.querySelector("#diag-connections").textContent = String(diagnostics.wreckConnectionCount);
  document.querySelector("#diag-cuttable").textContent = String(diagnostics.wreckCuttableConnectionCount);
  document.querySelector("#diag-severed").textContent = String(diagnostics.wreckSeveredConnectionCount);
  document.querySelector("#diag-cut-target").textContent = cut.targetId ?? "none";
  document.querySelector("#diag-cut-class").textContent = cut.targetClass ?? "none";
  document.querySelector("#diag-cut-range").textContent = Number.isFinite(cut.targetDistance) ? `${cut.targetDistance.toFixed(2)} m` : "—";
  document.querySelector("#diag-cut-aim").textContent = Number.isFinite(cut.aimAlignment) ? cut.aimAlignment.toFixed(3) : "—";
  document.querySelector("#diag-cut-state").textContent = cut.state;
  document.querySelector("#diag-cut-progress").textContent = `${Math.round(cut.progress01 * 100)}%`;
  document.querySelector("#diag-last-cut").textContent = cut.lastCompletedConnectionId ?? "none";
  document.querySelector("#diag-cut-separation").textContent = `${cut.lastSeparationDistance.toFixed(3)} m`;
  document.querySelector("#diag-joint-error").textContent = `${(diagnostics.maxConnectionError * 1000).toFixed(2)} mm`;
  document.querySelector("#diag-bodies").textContent = String(diagnostics.activeBodies);
  document.querySelector("#diag-step").textContent = `${(diagnostics.fixedTimestepSeconds * 1000).toFixed(2)} ms`;
  document.querySelector("#diag-input").textContent = describeInput(flightState, cutActive);

  if (cut.state === "complete") {
    course.textContent = `Cut complete: ${cut.lastCompletedConnectionId}. The body remains physical; release C before attempting another cut.`;
    status.textContent = `Joint severed. ${diagnostics.wreckConnectionCount} live structural joints remain.`;
  } else if (diagnostics.distanceToWreck > CUTTER_RANGE_METERS) {
    course.textContent = `Approach under control. Cutter range is ${CUTTER_RANGE_METERS.toFixed(0)} m.`;
    status.textContent = "Cutter ready; target is outside working range.";
  } else if (!cut.canCut) {
    course.textContent = `Aim the craft toward the marked joint. Required aim alignment: ${CUTTER_AIM_COSINE.toFixed(2)}.`;
    status.textContent = "Cutter ready; hold aim and range before cutting.";
  } else if (cut.state === "cutting") {
    course.textContent = `Cutting ${cut.targetId}: ${Math.round(cut.progress01 * 100)}%. Leaving range or aim interrupts progress.`;
    status.textContent = "Cutter engaged on a live Rapier joint.";
  } else {
    course.textContent = `Target locked: ${cut.targetId} (${cut.targetClass}). Hold C to sever the physical joint.`;
    status.textContent = "Cutter ready; valid joint target acquired.";
  }
  updateCutMarker(cut);
}

function frame(now) {
  if (disposed) return;
  const delta = (now - lastTime) / 1000;
  lastTime = now;
  loop.advance(delta, () => {
    cutter.step(sandbox, input.isCutActive());
    sandbox.step(controller, input.getState());
  });
  presenter.sync(sandbox);
  presenter.updateCamera(sandbox, camera);
  updateDiagnostics();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

presenter.updateCamera(sandbox, camera);
updateDiagnostics();
document.body.dataset.phase3 = "ready";
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
  renderer.dispose();
}, { once: true });
