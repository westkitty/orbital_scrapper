// @ts-nocheck
import * as THREE from "three";
import "./style.css";
import { PhysicsSandbox, FIXED_TIMESTEP_SECONDS } from "./physics/PhysicsSandbox.js";
import { FixedStepLoop } from "./runtime/FixedStepLoop.js";
import { InputBindings } from "./runtime/InputBindings.js";
import { ScenePresenter } from "./presentation/ScenePresenter.js";

const app = document.querySelector("#app");
if (!app) throw new Error("Missing #app root");

app.innerHTML = `
  <section class="viewport" aria-label="Physics sandbox viewport"></section>
  <aside class="panel" aria-label="Phase 0 controls and diagnostics">
    <p class="eyebrow">ORBITAL SCRAPPER // PHASE 0</p>
    <h1>Runtime + Physics Proof</h1>
    <p class="copy">A disposable greybox proving fixed-step simulation, runtime joint removal, diagnostics, and clean reset.</p>
    <div class="controls">
      <button id="reset" type="button">Reset scene <kbd>R</kbd></button>
      <button id="constraint" type="button">Remove bridge joint <kbd>C</kbd></button>
    </div>
    <dl class="diagnostics">
      <div><dt>Generation</dt><dd id="diag-generation">—</dd></div>
      <div><dt>Rigid bodies</dt><dd id="diag-bodies">—</dd></div>
      <div><dt>Constraints</dt><dd id="diag-constraints">—</dd></div>
      <div><dt>Fixed step</dt><dd id="diag-step">—</dd></div>
      <div><dt>Last action</dt><dd id="diag-action">Boot</dd></div>
    </dl>
    <p class="status" id="status" role="status">Initializing Rapier…</p>
  </aside>
`;

const viewport = app.querySelector(".viewport");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.shadowMap.enabled = true;
viewport.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030712);
const camera = new THREE.PerspectiveCamera(52, viewport.clientWidth / viewport.clientHeight, 0.1, 100);
camera.position.set(8, 6, 10);
camera.lookAt(0, 2, 0);

scene.add(new THREE.HemisphereLight(0xbfd7ff, 0x111827, 2.2));
const workLight = new THREE.DirectionalLight(0xffffff, 3.5);
workLight.position.set(4, 10, 6);
workLight.castShadow = true;
scene.add(workLight);
scene.add(new THREE.GridHelper(12, 24, 0x334155, 0x172033));

const sandbox = await PhysicsSandbox.create();
const presenter = new ScenePresenter(scene);
presenter.rebuild(sandbox);
const loop = new FixedStepLoop(FIXED_TIMESTEP_SECONDS, 5);

let lastTime = performance.now();
let disposed = false;

const resetButton = document.querySelector("#reset");
const constraintButton = document.querySelector("#constraint");
const status = document.querySelector("#status");
const action = document.querySelector("#diag-action");

function updateDiagnostics() {
  const diagnostics = sandbox.getDiagnostics();
  document.querySelector("#diag-generation").textContent = String(diagnostics.generation);
  document.querySelector("#diag-bodies").textContent = String(diagnostics.activeBodies);
  document.querySelector("#diag-constraints").textContent = String(diagnostics.activeConstraints);
  document.querySelector("#diag-step").textContent = `${(diagnostics.fixedTimestepSeconds * 1000).toFixed(2)} ms`;
  constraintButton.firstChild.textContent = diagnostics.bridgeConstraintPresent ? "Remove bridge joint " : "Create bridge joint ";
  status.textContent = diagnostics.bridgeConstraintPresent
    ? "Bridge joint active. Remove it to prove runtime constraint disposal."
    : "Bridge joint removed. The paired bodies now simulate independently.";
}

function resetScene() {
  sandbox.reset();
  loop.reset();
  presenter.rebuild(sandbox);
  action.textContent = "Scene reset";
  updateDiagnostics();
}

function toggleConstraint() {
  if (sandbox.hasBridgeConstraint()) {
    sandbox.removeBridgeConstraint();
    action.textContent = "Bridge joint removed";
  } else {
    sandbox.createBridgeConstraint();
    action.textContent = "Bridge joint created";
  }
  updateDiagnostics();
}

resetButton.addEventListener("click", resetScene);
constraintButton.addEventListener("click", toggleConstraint);
const input = new InputBindings(window, { reset: resetScene, toggleConstraint });
input.attach();

function resize() {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

function frame(now) {
  if (disposed) return;
  const delta = (now - lastTime) / 1000;
  lastTime = now;
  loop.advance(delta, () => sandbox.step());
  presenter.sync(sandbox);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

updateDiagnostics();
requestAnimationFrame(frame);

window.addEventListener("beforeunload", () => {
  disposed = true;
  input.detach();
  window.removeEventListener("resize", resize);
  resetButton.removeEventListener("click", resetScene);
  constraintButton.removeEventListener("click", toggleConstraint);
  presenter.dispose();
  sandbox.dispose();
  renderer.dispose();
}, { once: true });
