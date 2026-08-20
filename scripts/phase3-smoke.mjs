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
  throw new Error("No Chrome/Chromium executable found for the Phase 3 browser smoke test");
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
      ready: document.body.dataset.phase3 === 'ready',
      bodies: integer('#diag-bodies'),
      components: integer('#diag-components'),
      connections: integer('#diag-connections'),
      cuttable: integer('#diag-cuttable'),
      severed: integer('#diag-severed'),
      speed: number('#diag-speed'),
      distance: number('#diag-distance'),
      target: document.querySelector('#diag-cut-target')?.textContent ?? '',
      cutClass: document.querySelector('#diag-cut-class')?.textContent ?? '',
      targetRange: number('#diag-cut-range'),
      aim: number('#diag-cut-aim'),
      cutState: document.querySelector('#diag-cut-state')?.textContent ?? '',
      progress: number('#diag-cut-progress'),
      lastCut: document.querySelector('#diag-last-cut')?.textContent ?? '',
      separation: number('#diag-cut-separation'),
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
        if (lastState?.ready && lastState.bodies === 7 && lastState.components === 6 && lastState.connections === 6 && lastState.cuttable === 2) {
          return { page, state: lastState };
        }
      } catch (error) {
        lastError = error;
      }
    }
    await sleep(250);
  }
  throw new Error(`Phase 3 app did not initialize. lastState=${JSON.stringify(lastState)} lastError=${lastError?.message ?? "none"}\n${browserOutput}`);
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

try {
  let response;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      response = await fetch(APP_URL);
      if (response.ok) break;
    } catch {}
    await sleep(250);
  }
  if (!response?.ok) throw new Error(`Vite preview failed to serve the Phase 3 build.\n${previewOutput}`);

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
  if (initial.target !== "spine-panel" || initial.cutClass !== "low-risk") {
    throw new Error(`Expected low-risk panel as initial cut target. state=${JSON.stringify(initial)}`);
  }

  let working = initial;
  for (let pass = 0; pass < 8 && working.distance > 8.1; pass += 1) {
    await hold(wsUrl, "w", "KeyW", 87, working.distance > 11 ? 850 : 500);
    working = await brakeToStop(wsUrl);
    if (working.distance < 3.5) throw new Error(`Approach overshot safe cutter setup. state=${JSON.stringify(working)}`);
  }
  working = await currentState(wsUrl);
  if (!(working.distance <= 8.1 && working.speed < 0.7 && working.target === "spine-panel" && working.targetRange <= 9 && working.aim >= 0.92)) {
    throw new Error(`Could not establish a valid live cut setup. state=${JSON.stringify(working)}`);
  }

  await hold(wsUrl, "c", "KeyC", 67, 250);
  await sleep(150);
  const interrupted = await currentState(wsUrl);
  if (!(interrupted.connections === 6 && interrupted.severed === 0 && interrupted.progress === 0)) {
    throw new Error(`Short cutter hold should interrupt without severing. state=${JSON.stringify(interrupted)}`);
  }

  await key(wsUrl, "keyDown", "c", "KeyC", 67);
  let completed = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(100);
    const state = await currentState(wsUrl);
    if (state.connections === 5 && state.cutState === "complete") {
      completed = state;
      break;
    }
  }
  if (!completed) throw new Error(`Live cutter never completed the panel joint. state=${JSON.stringify(await currentState(wsUrl))}`);
  if (!(completed.bodies === 7 && completed.components === 6 && completed.severed === 1 && completed.lastCut === "spine-panel")) {
    throw new Error(`Cut removed more than the intended joint or deleted a body. state=${JSON.stringify(completed)}`);
  }

  await sleep(700);
  const heldAfterComplete = await currentState(wsUrl);
  if (!(heldAfterComplete.connections === 5 && heldAfterComplete.severed === 1 && heldAfterComplete.separation > 0.03)) {
    throw new Error(`Completed cut did not remain single-shot or separate physically. state=${JSON.stringify(heldAfterComplete)}`);
  }
  await key(wsUrl, "keyUp", "c", "KeyC", 67);

  await hold(wsUrl, "x", "KeyX", 88, 40);
  await sleep(450);
  const reset = await currentState(wsUrl);
  if (!(reset.bodies === 7 && reset.components === 6 && reset.connections === 6 && reset.cuttable === 2 && reset.severed === 0 && reset.lastCut === "none" && Math.abs(reset.x) < 0.15 && Math.abs(reset.y) < 0.15 && Math.abs(reset.z - 14) < 0.2)) {
    throw new Error(`Live reset did not restore the Phase 3 baseline. state=${JSON.stringify(reset)}`);
  }

  console.log(`phase3 smoke: interrupted hold + live panel cut + physical separation + exact reset passed in ${browserPath}; bodies=7; joints=6->5->6`);
} finally {
  await stopProcess(browser);
  await stopProcess(preview);
}
