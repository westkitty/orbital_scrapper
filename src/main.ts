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
import { ProductionAudio } from "./presentation/ProductionAudio.js";
import { ProductionFx } from "./presentation/ProductionFx.js";
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
  <main class="game-shell">
    <section class="viewport" aria-label="Orbital Scrapper production salvage viewport">
      <div class="cockpit-frame" aria-hidden="true">
        <span class="cockpit-strut cockpit-strut-left"></span>
        <span class="cockpit-strut cockpit-strut-right"></span>
        <span class="cockpit-sill"></span>
      </div>

      <header class="hud hud-mission" aria-label="Mission status">
        <p class="eyebrow">ORBITAL SCRAPPER // SALVAGE CONTROL</p>
        <div class="mission-row"><strong id="hud-run-state">FIELD</strong><span id="hud-run-id">RUN —</span><span id="hud-credits">0 U</span></div>
        <p id="hud-objective">Read structure. Take only what you can bring home.</p>
      </header>

      <section class="hud scanner-card" id="scanner-card" aria-label="Scanner target">
        <p class="hud-label">STRUCTURAL SCAN</p>
        <div class="scanner-primary"><strong id="hud-scan-target">NO TARGET</strong><span id="hud-scan-risk">—</span></div>
        <p id="hud-scan-detail">Aim at a live connection to read risk and value.</p>
      </section>

      <section class="hud hull-card" aria-label="Hull integrity">
        <div class="meter-row"><span>HULL</span><strong id="hud-hull-text">100%</strong></div>
        <div class="meter"><span id="hud-hull-meter"></span></div>
        <p id="hud-collapse">STRUCTURE STABLE</p>
      </section>

      <div class="reticle-stack" aria-hidden="true">
        <div class="reticle"><i></i><i></i><i></i><i></i></div>
        <div id="hazard-direction" class="hazard-direction" data-direction="none">NO ACTIVE THREAT</div>
      </div>

      <section class="hud tool-card" aria-label="Tool status">
        <div class="tool-row"><span>CUTTER</span><strong id="hud-cutter">IDLE</strong></div>
        <div class="meter tool-meter"><span id="hud-cutter-meter"></span></div>
        <div class="tool-row"><span>TETHER</span><strong id="hud-tether">IDLE</strong></div>
        <div class="meter tool-meter"><span id="hud-tether-meter"></span></div>
        <div class="tool-row"><span>CARGO</span><strong id="hud-cargo">NONE</strong></div>
      </section>

      <section class="hud action-strip" aria-label="Primary controls">
        <span><kbd>WASD</kbd> translate</span>
        <span><kbd>Q/E</kbd> roll</span>
        <span><kbd>Space</kbd> brake</span>
        <span><kbd>C</kbd> cut</span>
        <span><kbd>T</kbd> tether</span>
        <button id="audio-toggle" class="hud-button" type="button" aria-pressed="false">Enable cockpit audio</button>
        <button id="reset" class="hud-button" type="button">Reset / recover <kbd>X</kbd></button>
      </section>

      <section class="hud narrative-strip" aria-label="Current salvage guidance">
        <p class="course" id="course">Use the scanner to compare the lower-value moderate-risk panel with the higher-value high-risk engine. Recover the panel first to prove the complete loop safely.</p>
        <p class="status" id="status" role="status">Initializing production salvage presentation…</p>
        <p class="status settlement-summary" id="settlement-summary" aria-live="polite">No settlement yet.</p>
      </section>

      <details class="telemetry-drawer">
        <summary>Telemetry / controls</summary>
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
          <div><dt>Audio</dt><dd id="diag-audio">muted</dd></div>
          <div><dt>Presentation meshes</dt><dd id="diag-presentation">—</dd></div>
        </dl>
      </details>
    </section>

    <aside id="dock-panel" class="dock-panel" aria-label="Preparation and upgrade state" hidden>
      <p class="eyebrow">PREPARATION DOCK</p>
      <h1>Salvage secured.</h1>
      <p id="dock-summary">Return with salvage to prepare the next run.</p>
      <button id="buy-clamp-dampers" type="button">Buy Clamp Dampers — ${CLAMP_DAMPERS_COST_UNITS} units</button>
      <button id="launch-next-run" type="button">Launch next salvage run</button>
    </aside>
  </main>
`;

const viewport = app.querySelector(".viewport");
const resetButton = document.querySelector("#reset");
const audioToggle = document.querySelector("#audio-toggle");
const buyUpgradeButton = document.querySelector("#buy-clamp-dampers");
const launchNextRunButton = document.querySelector("#launch-next-run");
const dockPanel = document.querySelector("#dock-panel");
const dockSummary = document.querySelector("#dock-summary");
const status = document.querySelector("#status");
const course = document.querySelector("#course");
const settlementSummary = document.querySelector("#settlement-summary");
const scannerCard = document.querySelector("#scanner-card");
const hazardDirection = document.querySelector("#hazard-direction");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.setAttribute("aria-label", "Three-dimensional salvage worksite");
viewport.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02040a);
scene.fog = new THREE.FogExp2(0x02040a, 0.0075);

const camera = new THREE.PerspectiveCamera(62, viewport.clientWidth / viewport.clientHeight, 0.1, 220);
scene.add(new THREE.HemisphereLight(0xbfd8f2, 0x02040a, 1.05));
const workLight = new THREE.DirectionalLight(0xf8fafc, 3.5);
workLight.position.set(8, 12, 10);
workLight.castShadow = true;
workLight.shadow.mapSize.set(1024, 1024);
scene.add(workLight);
const coldFill = new THREE.PointLight(0x38bdf8, 18, 32, 2);
coldFill.position.set(-6, 3, 10);
scene.add(coldFill);
const amberFill = new THREE.PointLight(0xf59e0b, 7, 20, 2);
amberFill.position.set(8, -2, -2);
scene.add(amberFill);

function createStarfield() {
  let seed = 0x51f15e;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const positions = new Float32Array(1200 * 3);
  for (let index = 0; index < 1200; index += 1) {
    const radius = 55 + random() * 110;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[index * 3 + 1] = Math.cos(phi) * radius;
    positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xcbd5e1, size: 0.12, transparent: true, opacity: 0.72, sizeAttenuation: true }));
  points.name = "phase11-starfield";
  return points;
}
const starfield = createStarfield();
scene.add(starfield);

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
const fx = new ProductionFx(scene);
const audio = new ProductionAudio();
const loop = new FixedStepLoop(FIXED_TIMESTEP_SECONDS, 5);

let runMode = "field";
let dockReason = "none";
let activeRunId = progression.beginRun();
let settlementApplied = false;
let failureApplied = false;
let lastTime = performance.now();
let disposed = false;
let lastThrustLevel = 0;

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

async function handleAudioToggle() {
  const diagnostics = audio.getDiagnostics();
  if (diagnostics.enabled) audio.disable();
  else await audio.enable();
  updateDiagnostics();
}
audioToggle.addEventListener("click", handleAudioToggle);

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

function meter(element, value) {
  element.style.transform = `scaleX(${Math.max(0, Math.min(1, value))})`;
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
  const presentationMetrics = presenter.getPresentationMetrics();
  const fxDiagnostics = fx.getDiagnostics();
  const audioDiagnostics = audio.getDiagnostics();
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
  document.querySelector("#diag-audio").textContent = `${audioDiagnostics.state} / severity ${audioDiagnostics.severityGain.toFixed(3)}`;
  document.querySelector("#diag-presentation").textContent = `${presentationMetrics.detailMeshes} meshes / ${fxDiagnostics.objectCount} fx`;

  document.querySelector("#hud-run-state").textContent = runMode.toUpperCase();
  document.querySelector("#hud-run-id").textContent = `RUN ${activeRunId}`;
  document.querySelector("#hud-credits").textContent = `${progressionDiagnostics.credits} U`;
  document.querySelector("#hud-hull-text").textContent = `${collapseDiagnostics.hullIntegrity.toFixed(0)}%`;
  meter(document.querySelector("#hud-hull-meter"), collapseDiagnostics.hullIntegrity / 100);
  document.querySelector("#hud-collapse").textContent = `${collapseDiagnostics.severityState.toUpperCase()} / ${collapseDiagnostics.severityScore.toFixed(0)}`;

  const scanTargetText = scan.state === "locked" ? scan.connectionId.replaceAll("-", " ").toUpperCase() : "NO TARGET";
  document.querySelector("#hud-scan-target").textContent = scanTargetText;
  document.querySelector("#hud-scan-risk").textContent = scan.state === "locked" ? `${scan.riskLevel.toUpperCase()} RISK` : "—";
  document.querySelector("#hud-scan-detail").textContent = scan.state === "locked"
    ? `${scan.placeholderValueUnits} U · ${scan.displayComponentId} · ${scan.massClass} mass · ${scan.isBridge ? "single load path" : "alternate load path"}`
    : "Aim at a live connection to read risk and value.";
  scannerCard.dataset.risk = scan.state === "locked" ? scan.riskLevel : "none";

  document.querySelector("#hud-cutter").textContent = cut.targetId ? `${cut.state.toUpperCase()} · ${cut.targetId.replaceAll("spine-", "")}` : cut.state.toUpperCase();
  meter(document.querySelector("#hud-cutter-meter"), cut.progress01 ?? 0);
  document.querySelector("#hud-tether").textContent = tetherDiagnostics.state === "attached"
    ? `${tetherDiagnostics.targetId} · ${(tetherDiagnostics.loadRatio * 100).toFixed(0)}% LOAD`
    : tetherDiagnostics.state.toUpperCase();
  meter(document.querySelector("#hud-tether-meter"), tetherDiagnostics.loadRatio ?? 0);
  document.querySelector("#hud-cargo").textContent = cargoDiagnostics.securedCargoCount > 0
    ? `${cargoDiagnostics.securedCargoCount} SECURED`
    : cargoDiagnostics.candidateId
      ? `${cargoDiagnostics.candidateId} ${cargoDiagnostics.candidateCondition.toFixed(0)}%`
      : "NONE";

  hazardDirection.dataset.direction = collapseDiagnostics.warningDirection;
  hazardDirection.dataset.severity = collapseDiagnostics.severityState;
  hazardDirection.textContent = collapseDiagnostics.warningDirection === "none"
    ? "NO ACTIVE THREAT"
    : `${collapseDiagnostics.warningDirection.toUpperCase()} · ${collapseDiagnostics.severityState.toUpperCase()}`;

  audioToggle.textContent = audioDiagnostics.state === "ready" ? "Mute cockpit audio" : audioDiagnostics.state === "unavailable" ? "Audio unavailable" : "Enable cockpit audio";
  audioToggle.setAttribute("aria-pressed", audioDiagnostics.enabled ? "true" : "false");
  audioToggle.disabled = audioDiagnostics.state === "unavailable";

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
      dockSummary.textContent = "Failed run recovered cleanly. Persistent credits and installed upgrades are intact; launch a fresh run when ready.";
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
    document.querySelector("#hud-objective").textContent = "Hull lost. Recover to dock when the field is safe.";
  } else if (runMode === "dock") {
    course.textContent = progressionDiagnostics.upgrades.clampDampers
      ? "Launch the next run. The installed dampers will apply only to the fresh run's clamp configuration."
      : `Spend ${CLAMP_DAMPERS_COST_UNITS} units on Clamp Dampers, then launch the next run.`;
    status.textContent = "Preparation state: physics is paused; persistent progression is visible and actionable.";
    document.querySelector("#hud-objective").textContent = "Settlement complete. Prepare the next salvage run.";
  } else if (cargoDiagnostics.captureState === "blocked-speed") {
    course.textContent = `Clamp rejected ${cargoDiagnostics.candidateId}: ${cargoDiagnostics.candidateRelativeSpeed.toFixed(2)} m/s exceeds this run's ${currentCaptureLimit.toFixed(2)} m/s ceiling.`;
    status.textContent = "Loose salvage remains physical and hazardous until the active run's capture rule is satisfied.";
    document.querySelector("#hud-objective").textContent = "Bleed relative velocity before bringing salvage into the clamp.";
  } else if (cargoDiagnostics.captureState === "secured") {
    course.textContent = `${cargoDiagnostics.candidateId} secured at ${cargoDiagnostics.candidateCondition.toFixed(1)}% condition. Retreat to extraction range.`;
    status.textContent = "Secured cargo is disabled from loose physics; return to sell it into persistent credits.";
    document.querySelector("#hud-objective").textContent = `Cargo secured. Clear ${CARGO_EXTRACTION_DISTANCE_METERS.toFixed(1)} m for settlement.`;
  } else if (tetherDiagnostics.state === "attached") {
    course.textContent = `Winching ${tetherDiagnostics.targetId} toward the ${CARGO_CAPTURE_RADIUS_METERS.toFixed(0)} m clamp. This run allows up to ${currentCaptureLimit.toFixed(2)} m/s relative speed.`;
    status.textContent = "Tether force remains physical and bounded; line color and HUD load reflect current tension.";
    document.querySelector("#hud-objective").textContent = `Recover ${tetherDiagnostics.targetId}. Watch tether load and relative speed.`;
  } else if (cut.state === "complete") {
    course.textContent = `Cut complete: ${cut.lastCompletedConnectionId}. Aim at detached salvage and hold T for physical recovery.`;
    status.textContent = "The component remains a live Rapier body until it is actually captured.";
    document.querySelector("#hud-objective").textContent = "Connection severed. Control the free mass before recovery.";
  } else if (scan.state === "locked") {
    course.textContent = `${scan.connectionId}: ${scan.riskLevel} estimate / ${scan.placeholderValueUnits} units. Lower risk and higher value are deliberately not the same choice.`;
    status.textContent = "Scanner information is advisory. Visible hardpoints and live marker geometry identify the physical relationship being evaluated.";
    document.querySelector("#hud-objective").textContent = "Choose the cut from current structure, value, and escape room.";
  } else if (diagnostics.distanceToWreck > SCANNER_RANGE_METERS) {
    course.textContent = `Approach the wreck. Scanner ${SCANNER_RANGE_METERS.toFixed(0)} m; cutter ${CUTTER_RANGE_METERS.toFixed(0)} m; tether ${TETHER_RANGE_METERS.toFixed(0)} m.`;
    status.textContent = "Begin the next salvage decision from current physical structure.";
    document.querySelector("#hud-objective").textContent = "Close to scanner range and identify a recoverable section.";
  } else {
    course.textContent = "Aim toward a cuttable connection to compare structural risk and salvage value.";
    status.textContent = "Scanner information is advisory; physical structure and player action remain authoritative.";
    document.querySelector("#hud-objective").textContent = "Read the hardpoints. Find a cut with room to survive the release.";
  }

  fx.update(sandbox, scan, cut, tetherDiagnostics, collapseDiagnostics, diagnostics.elapsedSeconds);
  audio.update({
    severityScore: collapseDiagnostics.severityScore,
    severityState: collapseDiagnostics.severityState,
    warningCue: collapseDiagnostics.warningCue,
    thrustLevel: lastThrustLevel,
    tetherLoadRatio: tetherDiagnostics.loadRatio,
    cutterProgress01: cut.progress01,
    cutterActive: cutActive,
    impactImpulse: collapseDiagnostics.lastImpactImpulse,
    hullIntegrity: collapseDiagnostics.hullIntegrity,
  });

  const updatedAudio = audio.getDiagnostics();
  const updatedFx = fx.getDiagnostics();
  document.body.dataset.phase9 = "ready";
  document.body.dataset.phase11 = "ready";
  document.body.dataset.presentation = "production";
  document.body.dataset.audioState = updatedAudio.state;
  document.body.dataset.audioSeverity = updatedAudio.severityGain.toFixed(3);
  document.body.dataset.presentationMeshes = String(presentationMetrics.detailMeshes);
  document.body.dataset.fxRoot = updatedFx.rootName;
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
  lastThrustLevel = presenter.setFlightEffects(runMode === "field" ? input.getState() : NEUTRAL_FLIGHT_INPUT);
  presenter.updateCamera(sandbox, camera);
  updateDiagnostics();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

presenter.updateCamera(sandbox, camera);
updateDiagnostics();
requestAnimationFrame(frame);

window.addEventListener("beforeunload", () => {
  disposed = true;
  input.detach();
  window.removeEventListener("resize", resize);
  resetButton.removeEventListener("click", handleResetAction);
  audioToggle.removeEventListener("click", handleAudioToggle);
  buyUpgradeButton.removeEventListener("click", handleBuyUpgrade);
  launchNextRunButton.removeEventListener("click", handleLaunchNextRun);
  presenter.dispose();
  fx.dispose();
  void audio.dispose();
  sandbox.dispose();
  starfield.geometry.dispose();
  starfield.material.dispose();
  renderer.dispose();
}, { once: true });
