import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const APP_URL = "http://127.0.0.1:4173/";
const DEVTOOLS_URL = "http://127.0.0.1:9224/json";
const SAVE_KEY = "orbital-scrapper-progression-v1";
const BACKUP_KEY = "orbital-scrapper-progression-v1-backup";
const PROFILE = "/tmp/orbital-scrapper-phase12-chrome";
const EVIDENCE_PATH = "performance-evidence/phase12-ci-capture.json";
const UPGRADE_COST = 150;
const BASE_CAPTURE_LIMIT = 1.35;
const UPGRADED_CAPTURE_LIMIT = 2.0;
const BUDGET = Object.freeze({
  minimumFrames: 300,
  frameP95Ms: 33.4,
  frameP99Ms: 50,
  slowFrameThresholdMs: 50,
  slowFramePercent: 2,
  callbackP95Ms: 20,
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
mkdirSync("performance-evidence", { recursive: true });

const preview = spawn(process.execPath, ["./node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "4173"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let previewOutput = "";
preview.stdout.on("data", (chunk) => { previewOutput += chunk.toString(); });
preview.stderr.on("data", (chunk) => { previewOutput += chunk.toString(); });
let browser = null;
let browserOutput = "";

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), sleep(1500)]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
function removeProfileBestEffort() {
  try { rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
}
function findBrowser() {
  const candidates = [process.env.CHROME_PATH, "google-chrome", "chromium-browser", "chromium"].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes("/")) return candidate;
    const probe = spawnSync("which", [candidate], { encoding: "utf8" });
    if (probe.status === 0) return probe.stdout.trim();
  }
  throw new Error("No Chrome/Chromium executable found for the Phase 12 browser gate");
}
async function fetchTargets() {
  try { const response = await fetch(DEVTOOLS_URL); if (response.ok) return await response.json(); } catch {}
  return [];
}
async function callCdp(wsUrl, method, params = {}) {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const timeout = setTimeout(() => { socket.close(); reject(new Error(`Timed out waiting for ${method}`)); }, 5000);
    socket.addEventListener("open", () => socket.send(JSON.stringify({ id: 1, method, params })));
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data.toString());
      if (message.id !== 1) return;
      clearTimeout(timeout); socket.close();
      if (message.error) reject(new Error(message.error.message ?? JSON.stringify(message.error)));
      else resolve(message.result);
    });
    socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error(`CDP websocket failed for ${method}`)); });
  });
}
async function evaluate(wsUrl, expression) {
  const result = await callCdp(wsUrl, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
  return result?.result?.value;
}
async function waitForTarget() {
  let lastTargets = [];
  for (let attempt = 0; attempt < 300; attempt += 1) {
    lastTargets = await fetchTargets();
    const page = lastTargets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
    if (page) return page;
    if (browser?.exitCode !== null) break;
    await sleep(100);
  }
  throw new Error(`Phase 12 Chrome target never appeared. browserExit=${browser?.exitCode ?? "running"} targets=${JSON.stringify(lastTargets)}\n${browserOutput}`);
}

const INSTRUMENTATION = `(() => {
  const state = { frameDeltas: [], callbackDurations: [], lastFrame: null, activeListeners: 0 };
  const registry = new WeakMap();
  const originalAdd = EventTarget.prototype.addEventListener;
  const originalRemove = EventTarget.prototype.removeEventListener;
  const bucketFor = (target, type) => {
    let byType = registry.get(target);
    if (!byType) { byType = new Map(); registry.set(target, byType); }
    let listeners = byType.get(type);
    if (!listeners) { listeners = new Set(); byType.set(type, listeners); }
    return listeners;
  };
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (listener) {
      const bucket = bucketFor(this, type);
      if (!bucket.has(listener)) { bucket.add(listener); state.activeListeners += 1; }
    }
    return originalAdd.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    if (listener) {
      const bucket = bucketFor(this, type);
      if (bucket.delete(listener)) state.activeListeners -= 1;
    }
    return originalRemove.call(this, type, listener, options);
  };
  const originalRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => originalRaf((timestamp) => {
    if (state.lastFrame !== null) {
      state.frameDeltas.push(timestamp - state.lastFrame);
      if (state.frameDeltas.length > 4000) state.frameDeltas.shift();
    }
    state.lastFrame = timestamp;
    const start = performance.now();
    try { return callback(timestamp); }
    finally {
      state.callbackDurations.push(performance.now() - start);
      if (state.callbackDurations.length > 4000) state.callbackDurations.shift();
    }
  });
  window.__phase12Probe = {
    snapshot: () => ({
      frameDeltas: state.frameDeltas.slice(),
      callbackDurations: state.callbackDurations.slice(),
      activeListeners: state.activeListeners,
    }),
    resetSamples: () => { state.frameDeltas.length = 0; state.callbackDurations.length = 0; state.lastFrame = null; },
  };
})();`;

async function currentState(wsUrl) {
  return await evaluate(wsUrl, `(() => {
    const text = (selector) => document.querySelector(selector)?.textContent ?? '';
    const number = (selector) => Number.parseFloat(text(selector));
    const integer = (selector) => Number.parseInt(text(selector), 10);
    const probe = window.__phase12Probe?.snapshot?.() ?? { activeListeners: -1 };
    return {
      ready: document.body.dataset.phase9 === 'ready' && document.body.dataset.phase11 === 'ready' && document.body.dataset.presentation === 'production',
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      runState: text('#diag-run-state'), runId: integer('#diag-run-id'), credits: integer('#diag-credits'), upgrade: text('#diag-upgrade'),
      clampLimit: number('#diag-clamp-limit'), completedRuns: integer('#diag-completed-runs'), failedRuns: integer('#diag-failed-runs'), saveState: text('#diag-save-state'),
      scanTarget: text('#diag-scan-target'), cutTarget: text('#diag-cut-target'), cutState: text('#diag-cut-state'), lastCut: text('#diag-last-cut'),
      tetherTarget: text('#diag-tether-target'), tetherState: text('#diag-tether-state'), cargoState: text('#diag-cargo-state'), secured: text('#diag-cargo-secured'),
      cargoCondition: number('#diag-cargo-condition'), settlement: text('#diag-settlement-state'), payout: integer('#diag-payout'), distance: number('#diag-distance'),
      hull: number('#diag-hull'), graph: text('#diag-graph'), bodies: integer('#diag-bodies'), presentationMeshes: Number.parseInt(document.body.dataset.presentationMeshes ?? '0', 10),
      audioState: document.body.dataset.audioState, dockHidden: document.querySelector('#dock-panel')?.hidden ?? true,
      buyDisabled: document.querySelector('#buy-clamp-dampers')?.disabled ?? true, launchDisabled: document.querySelector('#launch-next-run')?.disabled ?? true,
      activeListeners: probe.activeListeners,
    };
  })()`);
}
async function waitForState(wsUrl, predicate, attempts, label) {
  let state = null; let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { state = await currentState(wsUrl); if (predicate(state)) return state; } catch (error) { lastError = error; }
    await sleep(100);
  }
  throw new Error(`${label} did not reach expected state. state=${JSON.stringify(state)} error=${lastError?.message ?? "none"}`);
}
async function key(wsUrl, type, keyValue, code, virtualKeyCode) {
  await callCdp(wsUrl, "Input.dispatchKeyEvent", { type, key: keyValue, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode });
}
async function holdFor(wsUrl, keySpec, milliseconds) { await key(wsUrl, "keyDown", ...keySpec); await sleep(milliseconds); await key(wsUrl, "keyUp", ...keySpec); }
async function holdUntil(wsUrl, keySpec, predicate, attempts, label) {
  await key(wsUrl, "keyDown", ...keySpec); let state = null;
  try { for (let attempt = 0; attempt < attempts; attempt += 1) { await sleep(50); state = await currentState(wsUrl); if (predicate(state)) return state; } }
  finally { await key(wsUrl, "keyUp", ...keySpec); }
  throw new Error(`${label} did not reach expected state. state=${JSON.stringify(state)}`);
}
async function clickElement(wsUrl, selector) {
  const point = await evaluate(wsUrl, `(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e) throw new Error('missing click target'); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,disabled:e.disabled}; })()`);
  if (point.disabled) throw new Error(`Click target ${selector} is disabled`);
  await callCdp(wsUrl, "Input.dispatchMouseEvent", { type:"mouseMoved", x:point.x, y:point.y });
  await callCdp(wsUrl, "Input.dispatchMouseEvent", { type:"mousePressed", x:point.x, y:point.y, button:"left", clickCount:1 });
  await callCdp(wsUrl, "Input.dispatchMouseEvent", { type:"mouseReleased", x:point.x, y:point.y, button:"left", clickCount:1 });
}
async function approachWreck(wsUrl) {
  let state = await currentState(wsUrl);
  for (let pass = 0; pass < 14 && state.distance > 8.2; pass += 1) {
    await holdFor(wsUrl, ["w", "KeyW", 87], state.distance > 11.5 ? 450 : 240);
    await holdFor(wsUrl, [" ", "Space", 32], 750);
    state = await currentState(wsUrl);
    if (state.hull < 99.9 || state.distance < 4) throw new Error(`Endurance approach lost the protected safe path. state=${JSON.stringify(state)}`);
  }
  return state;
}
async function completePanelRun(wsUrl, expectedCompletedRuns) {
  const approach = await approachWreck(wsUrl);
  if (!(approach.distance <= 8.2 && approach.distance >= 4 && approach.cutTarget === "spine-panel" && approach.scanTarget === "spine-panel")) {
    throw new Error(`Could not establish panel cut for endurance run ${expectedCompletedRuns}. state=${JSON.stringify(approach)}`);
  }
  await holdUntil(wsUrl, ["c", "KeyC", 67], (s) => s.cutState === "complete" && s.lastCut === "spine-panel", 50, `Endurance cut ${expectedCompletedRuns}`);
  const secured = await holdUntil(wsUrl, ["t", "KeyT", 84], (s) => s.cargoState === "secured" && s.secured === "panel" && s.settlement === "returning", 320, `Endurance tether/capture ${expectedCompletedRuns}`);
  const docked = await holdUntil(wsUrl, ["s", "KeyS", 83], (s) => s.runState === "dock" && s.settlement === "settled" && s.completedRuns === expectedCompletedRuns && s.payout > 0, 180, `Endurance return/sale ${expectedCompletedRuns}`);
  return { secured, docked };
}
function percentile(values, q) {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * q) - 1))];
}
function analyzeProbe(probe) {
  const frames = probe.frameDeltas.filter((value) => Number.isFinite(value) && value > 0);
  const callbacks = probe.callbackDurations.filter((value) => Number.isFinite(value) && value >= 0);
  const slowFrames = frames.filter((value) => value > BUDGET.slowFrameThresholdMs).length;
  return {
    frameCount: frames.length,
    frameP50Ms: percentile(frames, 0.5),
    frameP95Ms: percentile(frames, 0.95),
    frameP99Ms: percentile(frames, 0.99),
    frameMaxMs: Math.max(...frames),
    slowFrameCount: slowFrames,
    slowFramePercent: frames.length ? (slowFrames / frames.length) * 100 : 100,
    callbackCount: callbacks.length,
    callbackP95Ms: percentile(callbacks, 0.95),
    callbackP99Ms: percentile(callbacks, 0.99),
    callbackMaxMs: Math.max(...callbacks),
    activeListeners: probe.activeListeners,
  };
}
function metricsMap(result) {
  return Object.fromEntries((result?.metrics ?? []).map((entry) => [entry.name, entry.value]));
}
function assertPerformance(performance) {
  if (performance.frameCount < BUDGET.minimumFrames) throw new Error(`Insufficient frame evidence: ${performance.frameCount}/${BUDGET.minimumFrames}`);
  if (performance.frameP95Ms > BUDGET.frameP95Ms) throw new Error(`Frame p95 budget failed: ${performance.frameP95Ms.toFixed(2)} > ${BUDGET.frameP95Ms}`);
  if (performance.frameP99Ms > BUDGET.frameP99Ms) throw new Error(`Frame p99 budget failed: ${performance.frameP99Ms.toFixed(2)} > ${BUDGET.frameP99Ms}`);
  if (performance.slowFramePercent > BUDGET.slowFramePercent) throw new Error(`Slow-frame budget failed: ${performance.slowFramePercent.toFixed(2)}% > ${BUDGET.slowFramePercent}%`);
  if (performance.callbackP95Ms > BUDGET.callbackP95Ms) throw new Error(`Frame callback p95 budget failed: ${performance.callbackP95Ms.toFixed(2)} > ${BUDGET.callbackP95Ms}`);
}

try {
  let response;
  for (let attempt = 0; attempt < 40; attempt += 1) { try { response = await fetch(APP_URL); if (response.ok) break; } catch {} await sleep(250); }
  if (!response?.ok) throw new Error(`Vite preview failed to serve the Phase 12 build.\n${previewOutput}`);

  const browserPath = findBrowser();
  browser = spawn(browserPath, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--window-size=1280,900", `--user-data-dir=${PROFILE}`,
    "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=9224", "about:blank",
  ], { stdio:["ignore","pipe","pipe"] });
  browser.stdout.on("data", (chunk) => { browserOutput += chunk.toString(); }); browser.stderr.on("data", (chunk) => { browserOutput += chunk.toString(); });
  const page = await waitForTarget(); const wsUrl = page.webSocketDebuggerUrl;

  await callCdp(wsUrl, "Page.enable");
  await callCdp(wsUrl, "Performance.enable");
  const bootstrapSource = `try { localStorage.removeItem(${JSON.stringify(SAVE_KEY)}); localStorage.removeItem(${JSON.stringify(BACKUP_KEY)}); } catch {}\n${INSTRUMENTATION}`;
  const bootstrap = await callCdp(wsUrl, "Page.addScriptToEvaluateOnNewDocument", { source: bootstrapSource });
  await callCdp(wsUrl, "Emulation.setEmulatedMedia", { media: "screen", features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await callCdp(wsUrl, "Page.navigate", { url: APP_URL });
  const clean = await waitForState(wsUrl, (s) => s.ready && s.reducedMotion && s.runState === "field" && s.runId === 1 && s.completedRuns === 0 && s.failedRuns === 0 && s.bodies === 7 && s.graph.includes("6 nodes / 6 edges / 0 supports") && s.presentationMeshes > 0 && s.activeListeners > 0, 300, "Clean reduced-motion Phase 12 start");
  if (bootstrap?.identifier) await callCdp(wsUrl, "Page.removeScriptToEvaluateOnNewDocument", { identifier: bootstrap.identifier });
  const baselineListeners = clean.activeListeners;
  const baselineMeshes = clean.presentationMeshes;

  await clickElement(wsUrl, "#audio-toggle");
  const audioReady = await waitForState(wsUrl, (s) => s.audioState === "ready", 80, "Audio enable for endurance run");
  if (!audioReady.reducedMotion) throw new Error("Reduced-motion preference was lost when audio was enabled");
  await evaluate(wsUrl, `window.__phase12Probe.resetSamples(); true`);
  await callCdp(wsUrl, "HeapProfiler.collectGarbage");
  const baselineMetrics = metricsMap(await callCdp(wsUrl, "Performance.getMetrics"));

  const runEvidence = [];
  let previousCredits = 0;
  for (let runIndex = 1; runIndex <= 3; runIndex += 1) {
    const { secured, docked } = await completePanelRun(wsUrl, runIndex);
    if (!(secured.cargoCondition > 0 && secured.cargoCondition <= 100)) throw new Error(`Invalid cargo condition during endurance run ${runIndex}: ${JSON.stringify(secured)}`);
    if (!(docked.credits > previousCredits || (runIndex === 1 && docked.credits === docked.payout))) throw new Error(`Progression did not advance exactly through settlement ${runIndex}: ${JSON.stringify(docked)}`);
    previousCredits = docked.credits;

    if (runIndex === 1 && docked.upgrade === "Clamp Dampers — not owned") {
      if (docked.payout < UPGRADE_COST || docked.buyDisabled) throw new Error(`First endurance payout could not fund Clamp Dampers: ${JSON.stringify(docked)}`);
      await clickElement(wsUrl, "#buy-clamp-dampers");
      await waitForState(wsUrl, (s) => s.upgrade === "Clamp Dampers — owned", 80, "Endurance Clamp Dampers purchase");
      previousCredits -= UPGRADE_COST;
    }

    runEvidence.push({ run: runIndex, payout: docked.payout, creditsAfterSettlement: docked.credits, condition: secured.cargoCondition });
    await clickElement(wsUrl, "#launch-next-run");
    const fresh = await waitForState(wsUrl, (s) => s.runState === "field" && s.completedRuns === runIndex && s.failedRuns === 0 && s.bodies === 7 && s.graph.includes("6 nodes / 6 edges / 0 supports") && s.settlement === "field", 120, `Fresh run after endurance settlement ${runIndex}`);
    if (fresh.activeListeners !== baselineListeners) throw new Error(`Listener count grew after run ${runIndex}: ${fresh.activeListeners} vs ${baselineListeners}`);
    if (fresh.presentationMeshes !== baselineMeshes) throw new Error(`Presentation mesh count drifted after run ${runIndex}: ${fresh.presentationMeshes} vs ${baselineMeshes}`);
    if (Math.abs(fresh.clampLimit - UPGRADED_CAPTURE_LIMIT) > 0.001) throw new Error(`Purchased clamp capability was not preserved on fresh run ${runIndex + 1}: ${JSON.stringify(fresh)}`);
  }

  const beforeRecovery = await currentState(wsUrl);
  const expectedCredits = beforeRecovery.credits;
  const expectedCompletedRuns = beforeRecovery.completedRuns;
  const expectedRunId = beforeRecovery.runId;
  const saveCopies = await evaluate(wsUrl, `({ primary: localStorage.getItem(${JSON.stringify(SAVE_KEY)}), backup: localStorage.getItem(${JSON.stringify(BACKUP_KEY)}) })`);
  if (!saveCopies.primary || saveCopies.primary !== saveCopies.backup) throw new Error("Primary and backup progression copies were not synchronized before corruption recovery");

  const probe = await evaluate(wsUrl, `window.__phase12Probe.snapshot()`);
  const performance = analyzeProbe(probe);
  assertPerformance(performance);
  await callCdp(wsUrl, "HeapProfiler.collectGarbage");
  const finalMetrics = metricsMap(await callCdp(wsUrl, "Performance.getMetrics"));

  await evaluate(wsUrl, `localStorage.setItem(${JSON.stringify(SAVE_KEY)}, '{corrupt-primary'); location.reload(); true`);
  const recovered = await waitForState(wsUrl, (s) => s.ready && s.saveState.includes("recovered-backup") && s.completedRuns === expectedCompletedRuns && s.credits === expectedCredits && s.upgrade === "Clamp Dampers — owned" && s.runId > expectedRunId && s.bodies === 7 && s.graph.includes("6 nodes / 6 edges / 0 supports"), 300, "Last-known-good save recovery");
  const healedCopies = await evaluate(wsUrl, `({ primary: localStorage.getItem(${JSON.stringify(SAVE_KEY)}), backup: localStorage.getItem(${JSON.stringify(BACKUP_KEY)}) })`);
  if (!healedCopies.primary || healedCopies.primary !== healedCopies.backup || healedCopies.primary.startsWith("{corrupt")) throw new Error("Backup recovery did not heal the primary save copy");

  const evidence = {
    schemaVersion: 1,
    project: "orbital_scrapper",
    build: "phase12-candidate",
    scenario: { id: "phase12-endurance-v1", warmStart: true, fullSalvageRuns: 3, reducedMotion: true },
    environment: {
      runner: "github-hosted-ubuntu",
      browserPath,
      browserVersion: browserOutput.match(/Chrome\/[0-9.]+/)?.[0] ?? "reported-by-runner-unavailable",
      renderer: "WebGL / SwiftShader requested by gate",
      viewport: { width: 1280, height: 900 },
      devicePixelRatio: 1,
      network: "localhost production preview",
    },
    budgets: BUDGET,
    performance,
    lifecycle: { baselineListeners, finalListenersBeforeReload: beforeRecovery.activeListeners, baselineMeshes, finalMeshesBeforeReload: beforeRecovery.presentationMeshes, freshBodyRecords: beforeRecovery.bodies, freshGraph: beforeRecovery.graph },
    progression: { completedRuns: expectedCompletedRuns, credits: expectedCredits, recoveredLoadState: recovered.saveState, runEvidence },
    browserMetrics: {
      baseline: { JSHeapUsedSize: baselineMetrics.JSHeapUsedSize ?? null, Nodes: baselineMetrics.Nodes ?? null, TaskDuration: baselineMetrics.TaskDuration ?? null },
      afterEnduranceAndGc: { JSHeapUsedSize: finalMetrics.JSHeapUsedSize ?? null, Nodes: finalMetrics.Nodes ?? null, TaskDuration: finalMetrics.TaskDuration ?? null },
      note: "Browser heap/native allocation metrics are diagnostic only; Phase 12 does not infer complete memory cleanup from them.",
    },
    unknowns: ["consumer GPU performance", "mobile thermals", "Safari", "Firefox", "screen-reader conformance", "gamepad/remapping"],
  };
  writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);

  console.log(`phase12 smoke: three-run endurance/reduced-motion/save-recovery/performance gate passed in ${browserPath}; frames=${performance.frameCount}; p95=${performance.frameP95Ms.toFixed(2)}ms; p99=${performance.frameP99Ms.toFixed(2)}ms; slow=${performance.slowFramePercent.toFixed(2)}%; callbackP95=${performance.callbackP95Ms.toFixed(2)}ms; listeners=${baselineListeners}; meshes=${baselineMeshes}; completed=${expectedCompletedRuns}; credits=${expectedCredits}`);
} finally {
  await stopProcess(browser);
  await stopProcess(preview);
  removeProfileBestEffort();
}
