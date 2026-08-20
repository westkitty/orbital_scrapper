// @ts-nocheck
import * as THREE from "three";
import "./style.css";
import { FlightController } from "./flight/FlightController.js";
import { FlightSandbox } from "./physics/FlightSandbox.js";
import { FIXED_TIMESTEP_SECONDS } from "./physics/PhysicsSandbox.js";
import { FlightScenePresenter } from "./presentation/FlightScenePresenter.js";
import { FixedStepLoop } from "./runtime/FixedStepLoop.js";
import { FlightInputBindings } from "./runtime/FlightInputBindings.js";

const app = document.querySelector("#app");
if (!app) throw new Error("Missing #app root");

app.innerHTML = `
  <section class="viewport" aria-label="Phase 1 salvage craft flight viewport"></section>
  <aside class="panel" aria-label="Phase 1 flight controls and diagnostics">
    <p class="eyebrow">ORBITAL SCRAPPER // PHASE 1</p>
    <h1>Salvage Craft Flight</h1>
    <p class="copy">Greybox six-degree-of-freedom handling proof. Momentum is real; braking is counter-thrust, not teleportation.</p>

    <div class="control-grid" aria-label="Flight controls">
      <div><strong>Thrust</strong><span><kbd>W</kbd>/<kbd>S</kbd></span></div>
      <div><strong>Strafe</strong><span><kbd>A</kbd>/<kbd>D</kbd></span></div>
      <div><strong>Vertical</strong><span><kbd>R</kbd>/<kbd>F</kbd></span></div>
      <div><strong>Pitch / yaw</strong><span><kbd>↑↓</kbd> <kbd>←→</kbd></span></div>
      <div><strong>Roll</strong><span><kbd>Q</kbd>/<kbd>E</kbd></span></div>
      <div><strong>Brake</strong><span><kbd>Space</kbd></span></div>
    </div>

    <button id="reset" type="button">Reset flight course <kbd>X</kbd></button>

    <dl class="diagnostics">
      <div><dt>Speed</dt><dd id="diag-speed">—</dd></div>
      <div><dt>Angular speed</dt><dd id="diag-angular-speed">—</dd></div>
      <div><dt>Target distance</dt><dd id="diag-distance">—</dd></div>
      <div><dt>Position</dt><dd id="diag-position">—</dd></div>
      <div><dt>Orientation</dt><dd id="diag-orientation">—</dd></div>
      <div><dt>Rigid bodies</dt><dd id="diag-bodies">—</dd></div>
      <div><dt>Fixed step</dt><dd id="diag-step">—</dd></div>
      <div><dt>Input</dt><dd id="diag-input">neutral</dd></div>
    </dl>

    <p class="course" id="course">Course: approach the yellow target, brake before contact, translate around it, rotate, then retreat.</p>
    <p class="status" id="status" role="status">Initializing Rapier flight scene…</p>
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
scene.fog = new THREE.Fog(0x020617, 35, 95);

const camera = new THREE.PerspectiveCamera(62, viewport.clientWidth / viewport.clientHeight, 0.1, 160);
scene.add(new THREE.HemisphereLight(0xcbd5e1, 0x020617, 1.7));
const workLight = new THREE.DirectionalLight(0xffffff, 3.2);
workLight.position.set(6, 10, 12);
workLight.castShadow = true;
scene.add(workLight);
const fillLight = new THREE.PointLight(0x38bdf8, 18, 24);
fillLight.position.set(-4, 2, 8);
scene.add(fillLight);

const referenceGrid = new THREE.GridHelper(60, 60, 0x334155, 0x0f172a);
referenceGrid.position.y = -4;
scene.add(referenceGrid);
const axesHelper = new THREE.AxesHelper(3);
scene.add(axesHelper);

const sandbox = await FlightSandbox.create();
const controller = new FlightController();
const presenter = new FlightScenePresenter(scene);
presenter.rebuild(sandbox);
const loop = new FixedStepLoop(FIXED_TIMESTEP_SECONDS, 5);

let lastTime = performance.now();
let disposed = false;

function resetScene() {
  sandbox.reset();
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

function describeInput(state) {
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
  return active.length ? active.join(" + ") : "neutral";
}

function updateDiagnostics() {
  const diagnostics = sandbox.getDiagnostics();
  const quaternion = new THREE.Quaternion(
    diagnostics.rotation.x,
    diagnostics.rotation.y,
    diagnostics.rotation.z,
    diagnostics.rotation.w,
  );
  const euler = new THREE.Euler().setFromQuaternion(quaternion, "YXZ");
  const degrees = 180 / Math.PI;
  const state = input?.getState?.() ?? { forward: 0, strafe: 0, vertical: 0, pitch: 0, yaw: 0, roll: 0, brake: false };

  document.querySelector("#diag-speed").textContent = `${diagnostics.linearSpeed.toFixed(2)} m/s`;
  document.querySelector("#diag-angular-speed").textContent = `${diagnostics.angularSpeed.toFixed(2)} rad/s`;
  document.querySelector("#diag-distance").textContent = `${diagnostics.distanceToTarget.toFixed(2)} m`;
  document.querySelector("#diag-position").textContent = `${diagnostics.position.x.toFixed(1)}, ${diagnostics.position.y.toFixed(1)}, ${diagnostics.position.z.toFixed(1)}`;
  document.querySelector("#diag-orientation").textContent = `P ${(euler.x * degrees).toFixed(0)}° · Y ${(euler.y * degrees).toFixed(0)}° · R ${(euler.z * degrees).toFixed(0)}°`;
  document.querySelector("#diag-bodies").textContent = String(diagnostics.activeBodies);
  document.querySelector("#diag-step").textContent = `${(diagnostics.fixedTimestepSeconds * 1000).toFixed(2)} ms`;
  document.querySelector("#diag-input").textContent = describeInput(state);

  if (diagnostics.distanceToTarget > 8) course.textContent = "Course stage: approach the yellow target through the first gate.";
  else if (diagnostics.linearSpeed > 1.2) course.textContent = "Course stage: counter-thrust now; arrive under control.";
  else course.textContent = "Course stage: hold working distance, translate around the target, rotate, then retreat.";
}

function frame(now) {
  if (disposed) return;
  const delta = (now - lastTime) / 1000;
  lastTime = now;
  loop.advance(delta, () => sandbox.step(controller, input.getState()));
  presenter.sync(sandbox);
  presenter.updateCamera(sandbox, camera);
  updateDiagnostics();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

presenter.updateCamera(sandbox, camera);
updateDiagnostics();
status.textContent = "Flight controls ready. Momentum and braking are running through the fixed-step physics path.";
document.body.dataset.phase1 = "ready";
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
  renderer.dispose();
}, { once: true });
