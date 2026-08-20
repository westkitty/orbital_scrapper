import { spawn, spawnSync } from "node:child_process";

const APP_URL = "http://127.0.0.1:4173/";
const DEVTOOLS_URL = "http://127.0.0.1:9222/json";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function findBrowser() {
  const candidates = [process.env.CHROME_PATH, "google-chrome", "chromium-browser", "chromium"].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes("/")) return candidate;
    const probe = spawnSync("which", [candidate], { encoding: "utf8" });
    if (probe.status === 0) return probe.stdout.trim();
  }
  throw new Error("No Chrome/Chromium executable found for the Phase 7 browser smoke test");
}

async function fetchTargets() {
  try {
    const response = await fetch(DEVTOOLS_URL);
    if (response.ok) return await response.json();
  } catch {}
  return [];
}

async function callCdp(wsUrl, method, params = {}) {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`Timed out waiting for Chrome DevTools Protocol method ${method}`));
    }, 3000);
    socket.addEventListener("open", () => socket.send(JSON.stringify({ id: 1, method, params })));
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data.toString());
      if (message.id !== 1) return;
      clearTimeout(timeout);
      socket.close();
      if (message.error) reject(new Error(message.error.message ?? JSON.stringify(message.error)));
      else resolve(message.result);
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error(`Chrome DevTools Protocol websocket failed for ${method}`));
    });
  });
}

async function evaluate(wsUrl, expression) {
  const result = await callCdp(wsUrl, "Runtime.evaluate", { expression, returnByValue: true });
  if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
  return result?.result?.value;
}

async function currentState(wsUrl) {
  return await evaluate(wsUrl, `(() => {
    const number = (selector) => Number.parseFloat(document.querySelector(selector)?.textContent ?? 'NaN');
    const integer = (selector) => Number.parseInt(document.querySelector(selector)?.textContent ?? '0', 10);
    return {
      ready: document.body.dataset.phase7 === 'ready',
      bodies: integer('#diag-bodies'),
      components: integer('#diag-components'),
      connections: integer('#diag-connections'),
      graphNodes: integer('#diag-graph-nodes'),
      graphEdges: integer('#diag-graph-edges'),
      scanTarget: document.querySelector('#diag-scan-target')?.textContent ?? '',
      scanRisk: document.querySelector('#diag-scan-risk')?.textContent ?? '',
      cutTarget: document.querySelector('#diag-cut-target')?.textContent ?? '',
      cutState: document.querySelector('#diag-cut-state')?.textContent ?? '',
      lastCut: document.querySelector('#diag-last-cut')?.textContent ?? '',
      collapseState: document.querySelector('#diag-collapse-state')?.textContent ?? '',
      severity: integer('#diag-collapse-severity'),
      hull: number('#diag-hull'),
      threat: document.querySelector('#diag-collapse-threat')?.textContent ?? '',
      warning: document.querySelector('#diag-collapse-warning')?.textContent ?? '',
      cue: document.querySelector('#diag-collapse-cue')?.textContent ?? '',
      impactBody: document.querySelector('#diag-impact-body')?.textContent ?? '',
      impactImpulse: number('#diag-impact-impulse'),
      impactDamage: number('#diag-impact-damage'),
      secondaryBreaks: integer('#diag-secondary-breaks'),
      input: document.querySelector('#diag-input')?.textContent ?? ''
    };
  })()`);
}

async function waitForReadyPage() {
  let lastState = null;
  let lastError = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const targets = await fetchTargets();
    const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl && target.url?.startsWith(APP_URL));
    if (page) {
      try {
        lastState = await currentState(page.webSocketDebuggerUrl);
        if (lastState?.ready && lastState.bodies === 7 && lastState.components === 6 && lastState.connections === 6
          && lastState.graphNodes === 6 && lastState.graphEdges === 6 && lastState.scanTarget === "spine-engine"
          && lastState.scanRisk === "high estimate" && lastState.cutTarget === "spine-engine"
          && Math.abs(lastState.hull - 100) < 0.01 && lastState.collapseState === "stable") {
          return { page, state: lastState };
        }
      } catch (error) {
        lastError = error;
      }
    }
    await sleep(100);
  }
  throw new Error(`Phase 7 app did not initialize on the critical engine fixture. lastState=${JSON.stringify(lastState)} lastError=${lastError?.message ?? "none"}\n${browserOutput}`);
}

async function key(wsUrl, type, keyValue, code, virtualKeyCode) {
  await callCdp(wsUrl, "Input.dispatchKeyEvent", {
    type,
    key: keyValue,
    code,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode,
  });
}

async function completeCriticalCut(wsUrl) {
  await key(wsUrl, "keyDown", "c", "KeyC", 67);
  let completed = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(50);
    const state = await currentState(wsUrl);
    if (state.connections === 5 && state.graphEdges === 5 && state.cutState === "complete" && state.lastCut === "spine-engine") {
      completed = state;
      break;
    }
  }
  await key(wsUrl, "keyUp", "c", "KeyC", 67);
  if (!completed) throw new Error(`Critical engine cut did not complete through live C input. state=${JSON.stringify(await currentState(wsUrl))}`);
  return completed;
}

async function pressReset(wsUrl) {
  await key(wsUrl, "keyDown", "x", "KeyX", 88);
  await key(wsUrl, "keyUp", "x", "KeyX", 88);
  let state = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(50);
    state = await currentState(wsUrl);
    if (state.connections === 6 && state.graphEdges === 6 && Math.abs(state.hull - 100) < 0.01
      && state.collapseState === "stable" && state.scanTarget === "spine-engine") return state;
  }
  throw new Error(`Phase 7 reset did not restore exact baseline. state=${JSON.stringify(state)}`);
}

try {
  let response;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      response = await fetch(APP_URL);
      if (response.ok) break;
    } catch {}
    await sleep(250);
  }
  if (!response?.ok) throw new Error(`Vite preview failed to serve the Phase 7 build.\n${previewOutput}`);

  const browserPath = findBrowser();
  browser = spawn(browserPath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--enable-unsafe-swiftshader",
    "--use-gl=swiftshader",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=9222",
    APP_URL,
  ], { stdio: ["ignore", "pipe", "pipe"] });
  browser.stdout.on("data", (chunk) => { browserOutput += chunk.toString(); });
  browser.stderr.on("data", (chunk) => { browserOutput += chunk.toString(); });

  const { page } = await waitForReadyPage();
  const wsUrl = page.webSocketDebuggerUrl;

  await completeCriticalCut(wsUrl);
  let maximumStationarySeverity = 0;
  let sawCritical = false;
  let sawAhead = false;
  let stationary = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await sleep(50);
    const state = await currentState(wsUrl);
    maximumStationarySeverity = Math.max(maximumStationarySeverity, state.severity);
    if (state.cue === "critical-alarm" || state.cue === "hull-failure") sawCritical = true;
    if (state.warning === "ahead") sawAhead = true;
    stationary = state;
    if (state.collapseState === "destroyed") break;
  }

  if (!stationary || maximumStationarySeverity < 70 || !sawCritical || !sawAhead
    || stationary.collapseState !== "destroyed" || stationary.hull > 0.01
    || stationary.impactBody !== "engine" || !(stationary.impactImpulse > 0)) {
    throw new Error(`Stationary critical cut did not produce the verified dangerous failure. maxSeverity=${maximumStationarySeverity} state=${JSON.stringify(stationary)}`);
  }

  await pressReset(wsUrl);
  await completeCriticalCut(wsUrl);
  await key(wsUrl, "keyDown", "s", "KeyS", 83);
  let maximumEscapeSeverity = 0;
  let minimumEscapeHull = 100;
  let escapeState = null;
  for (let attempt = 0; attempt < 70; attempt += 1) {
    await sleep(50);
    const state = await currentState(wsUrl);
    maximumEscapeSeverity = Math.max(maximumEscapeSeverity, state.severity);
    minimumEscapeHull = Math.min(minimumEscapeHull, state.hull);
    escapeState = state;
    if (state.collapseState === "destroyed") break;
  }
  await key(wsUrl, "keyUp", "s", "KeyS", 83);
  await sleep(500);
  escapeState = await currentState(wsUrl);

  if (!escapeState || escapeState.collapseState === "destroyed" || minimumEscapeHull < 99.99
    || maximumEscapeSeverity < 70 || escapeState.severity >= 20 || escapeState.cue !== "quiet") {
    throw new Error(`Reverse thrust did not turn the same critical cut into a survival path. maxSeverity=${maximumEscapeSeverity} minHull=${minimumEscapeHull} state=${JSON.stringify(escapeState)}`);
  }

  const restored = await pressReset(wsUrl);
  if (!(restored.connections === 6 && restored.graphEdges === 6 && restored.scanTarget === "spine-engine"
    && restored.scanRisk === "high estimate" && restored.collapseState === "stable" && Math.abs(restored.hull - 100) < 0.01)) {
    throw new Error(`Final Phase 7 reset was not exact. state=${JSON.stringify(restored)}`);
  }

  console.log(`phase7 smoke: live critical-cut hull failure + reverse-thrust survival + exact reset passed in ${browserPath}; stationaryMax=${maximumStationarySeverity}; escapeMax=${maximumEscapeSeverity}; escapeHull=${minimumEscapeHull.toFixed(1)}; graph=6->5->6`);
} finally {
  await stopProcess(browser);
  await stopProcess(preview);
}
