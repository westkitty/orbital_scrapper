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
  throw new Error("No Chrome/Chromium executable found for the Phase 6 browser smoke test");
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
    const position = (document.querySelector('#diag-position')?.textContent ?? '').split(',').map((value) => Number.parseFloat(value));
    return {
      ready: document.body.dataset.phase6 === 'ready',
      bodies: integer('#diag-bodies'),
      components: integer('#diag-components'),
      connections: integer('#diag-connections'),
      severed: integer('#diag-severed'),
      graphNodes: integer('#diag-graph-nodes'),
      graphEdges: integer('#diag-graph-edges'),
      graphSupports: integer('#diag-graph-supports'),
      speed: number('#diag-speed'),
      distance: number('#diag-distance'),
      scanTarget: document.querySelector('#diag-scan-target')?.textContent ?? '',
      scanRelationship: document.querySelector('#diag-scan-relationship')?.textContent ?? '',
      scanObject: document.querySelector('#diag-scan-object')?.textContent ?? '',
      scanType: document.querySelector('#diag-scan-type')?.textContent ?? '',
      scanMass: document.querySelector('#diag-scan-mass')?.textContent ?? '',
      scanValue: document.querySelector('#diag-scan-value')?.textContent ?? '',
      scanFree: document.querySelector('#diag-scan-free')?.textContent ?? '',
      scanPath: document.querySelector('#diag-scan-path')?.textContent ?? '',
      scanSupport: document.querySelector('#diag-scan-support')?.textContent ?? '',
      scanRisk: document.querySelector('#diag-scan-risk')?.textContent ?? '',
      scanScore: integer('#diag-scan-score'),
      scanReasons: document.querySelector('#diag-scan-reasons')?.textContent ?? '',
      cutTarget: document.querySelector('#diag-cut-target')?.textContent ?? '',
      cutState: document.querySelector('#diag-cut-state')?.textContent ?? '',
      lastCut: document.querySelector('#diag-last-cut')?.textContent ?? '',
      tetherTarget: document.querySelector('#diag-tether-target')?.textContent ?? '',
      tetherState: document.querySelector('#diag-tether-state')?.textContent ?? '',
      x: position[0], y: position[1], z: position[2]
    };
  })()`);
}

async function waitForReadyPage() {
  let lastState = null;
  let lastError = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const targets = await fetchTargets();
    const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl && target.url?.startsWith(APP_URL));
    if (page) {
      try {
        lastState = await currentState(page.webSocketDebuggerUrl);
        if (lastState?.ready && lastState.bodies === 7 && lastState.components === 6 && lastState.connections === 6
          && lastState.graphNodes === 6 && lastState.graphEdges === 6 && lastState.scanTarget === "spine-panel"
          && lastState.scanRisk === "moderate estimate" && lastState.scanObject === "panel") {
          return { page, state: lastState };
        }
      } catch (error) {
        lastError = error;
      }
    }
    await sleep(250);
  }
  throw new Error(`Phase 6 app did not initialize with a live scanner estimate. lastState=${JSON.stringify(lastState)} lastError=${lastError?.message ?? "none"}\n${browserOutput}`);
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

async function hold(wsUrl, keyValue, code, virtualKeyCode, milliseconds) {
  await key(wsUrl, "keyDown", keyValue, code, virtualKeyCode);
  await sleep(milliseconds);
  await key(wsUrl, "keyUp", keyValue, code, virtualKeyCode);
}

async function brakeToStop(wsUrl) {
  await key(wsUrl, "keyDown", " ", "Space", 32);
  let state = await currentState(wsUrl);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(100);
    state = await currentState(wsUrl);
    if (state.speed < 0.5) break;
  }
  await key(wsUrl, "keyUp", " ", "Space", 32);
  return state;
}

async function approachWreck(wsUrl) {
  let state = await currentState(wsUrl);
  for (let pass = 0; pass < 8 && state.distance > 8.1; pass += 1) {
    await hold(wsUrl, "w", "KeyW", 87, state.distance > 11 ? 850 : 500);
    state = await brakeToStop(wsUrl);
    if (state.distance < 3.5) throw new Error(`Approach overshot safe scanner/cutter setup. state=${JSON.stringify(state)}`);
  }
  return await currentState(wsUrl);
}

async function strafeToPanel(wsUrl) {
  let state = await currentState(wsUrl);
  for (let pass = 0; pass < 8 && state.x < 2.1; pass += 1) {
    await hold(wsUrl, "d", "KeyD", 68, 260);
    state = await brakeToStop(wsUrl);
  }
  return await currentState(wsUrl);
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
  if (!response?.ok) throw new Error(`Vite preview failed to serve the Phase 6 build.\n${previewOutput}`);

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

  const { page, state: initial } = await waitForReadyPage();
  const wsUrl = page.webSocketDebuggerUrl;
  if (!(initial.scanRelationship === "spine ↔ panel" && initial.scanType === "panel" && initial.scanMass === "light"
    && initial.scanValue === "250 units" && initial.scanFree === "panel" && initial.scanPath.includes("bridge")
    && initial.scanReasons.includes("Bridge connection"))) {
    throw new Error(`Initial scanner explanation is incomplete. state=${JSON.stringify(initial)}`);
  }

  let working = await approachWreck(wsUrl);
  if (!(working.distance <= 8.1 && working.speed < 0.7 && working.cutTarget === "spine-panel" && working.scanTarget === "spine-panel")) {
    throw new Error(`Could not establish a valid scanner/cutter setup. state=${JSON.stringify(working)}`);
  }

  working = await strafeToPanel(wsUrl);
  if (!(working.x >= 2.0 && working.x <= 4.8 && working.speed < 0.7 && working.scanTarget === "spine-panel" && working.scanRisk === "moderate estimate")) {
    throw new Error(`Could not align with the panel for bracing. state=${JSON.stringify(working)}`);
  }

  await key(wsUrl, "keyDown", "t", "KeyT", 84);
  let supported = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(80);
    const state = await currentState(wsUrl);
    if (state.tetherState === "attached" && state.tetherTarget === "panel" && state.graphSupports === 1 && state.scanSupport === "active") {
      supported = state;
      break;
    }
  }
  if (!supported || supported.scanTarget !== "spine-panel" || supported.scanRisk !== "low estimate" || !(supported.scanScore < working.scanScore)) {
    throw new Error(`Live brace did not lower the scanner estimate. before=${JSON.stringify(working)} supported=${JSON.stringify(supported ?? await currentState(wsUrl))}`);
  }

  await key(wsUrl, "keyUp", "t", "KeyT", 84);
  await sleep(220);
  const released = await currentState(wsUrl);
  if (!(released.tetherState === "idle" && released.graphSupports === 0 && released.scanSupport === "none"
    && released.scanTarget === "spine-panel" && released.scanRisk === "moderate estimate")) {
    throw new Error(`Live support release did not restore the unsupported prediction. state=${JSON.stringify(released)}`);
  }

  await key(wsUrl, "keyDown", "c", "KeyC", 67);
  let completed = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(100);
    const state = await currentState(wsUrl);
    if (state.connections === 5 && state.graphEdges === 5 && state.cutState === "complete") {
      completed = state;
      break;
    }
  }
  await key(wsUrl, "keyUp", "c", "KeyC", 67);
  if (!completed || completed.lastCut !== "spine-panel" || completed.scanTarget === "spine-panel" || completed.graphNodes !== 6) {
    throw new Error(`Live cut did not refresh scanner topology. state=${JSON.stringify(completed ?? await currentState(wsUrl))}`);
  }

  await hold(wsUrl, "x", "KeyX", 88, 40);
  await sleep(450);
  const reset = await currentState(wsUrl);
  if (!(reset.bodies === 7 && reset.components === 6 && reset.connections === 6 && reset.severed === 0
    && reset.graphNodes === 6 && reset.graphEdges === 6 && reset.graphSupports === 0
    && reset.scanTarget === "spine-panel" && reset.scanRisk === "moderate estimate" && reset.scanObject === "panel"
    && Math.abs(reset.x) < 0.15 && Math.abs(reset.y) < 0.15 && Math.abs(reset.z - 14) < 0.2)) {
    throw new Error(`Live reset did not restore physical, graph, and scanner baselines. state=${JSON.stringify(reset)}`);
  }

  console.log(`phase6 smoke: scanner explainability + brace risk change + post-cut freshness + exact reset passed in ${browserPath}; risk=moderate->low->moderate; graph=6->5->6`);
} finally {
  await stopProcess(browser);
  await stopProcess(preview);
}
