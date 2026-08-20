import { spawn, spawnSync } from "node:child_process";

const APP_URL = "http://127.0.0.1:4173/";
const DEVTOOLS_URL = "http://127.0.0.1:9222/json";
const SAVE_KEY = "orbital-scrapper-progression-v1";
const UPGRADE_COST = 150;
const BASE_CAPTURE_LIMIT = 1.35;
const UPGRADED_CAPTURE_LIMIT = 2.0;
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
  throw new Error("No Chrome/Chromium executable found for the Phase 9 browser smoke test");
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
    }, 4000);
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
    const text = (selector) => document.querySelector(selector)?.textContent ?? '';
    const number = (selector) => Number.parseFloat(text(selector));
    const integer = (selector) => Number.parseInt(text(selector), 10);
    return {
      ready: document.body.dataset.phase9 === 'ready',
      runState: text('#diag-run-state'),
      runId: integer('#diag-run-id'),
      credits: integer('#diag-credits'),
      upgrade: text('#diag-upgrade'),
      clampLimit: number('#diag-clamp-limit'),
      completedRuns: integer('#diag-completed-runs'),
      failedRuns: integer('#diag-failed-runs'),
      saveState: text('#diag-save-state'),
      scanTarget: text('#diag-scan-target'),
      scanRisk: text('#diag-scan-risk'),
      cutTarget: text('#diag-cut-target'),
      cutState: text('#diag-cut-state'),
      lastCut: text('#diag-last-cut'),
      tetherTarget: text('#diag-tether-target'),
      tetherState: text('#diag-tether-state'),
      cargoState: text('#diag-cargo-state'),
      cargoTarget: text('#diag-cargo-target'),
      cargoCondition: number('#diag-cargo-condition'),
      secured: text('#diag-cargo-secured'),
      settlement: text('#diag-settlement-state'),
      payout: integer('#diag-payout'),
      distance: number('#diag-distance'),
      hull: number('#diag-hull'),
      collapse: text('#diag-collapse-state'),
      graph: text('#diag-graph'),
      bodies: integer('#diag-bodies'),
      summary: text('#settlement-summary'),
      dockHidden: document.querySelector('#dock-panel')?.hidden ?? true,
      buyDisabled: document.querySelector('#buy-clamp-dampers')?.disabled ?? true,
      launchDisabled: document.querySelector('#launch-next-run')?.disabled ?? true,
    };
  })()`);
}

async function waitForTarget() {
  let lastTargets = [];
  for (let attempt = 0; attempt < 300; attempt += 1) {
    lastTargets = await fetchTargets();
    const page = lastTargets.find((target) => target.type === "page" && target.webSocketDebuggerUrl && target.url?.startsWith(APP_URL));
    if (page) return page;
    if (browser?.exitCode !== null) break;
    await sleep(100);
  }
  throw new Error(`Phase 9 Chrome target never appeared. browserExit=${browser?.exitCode ?? "running"} targets=${JSON.stringify(lastTargets.map((target) => ({ type: target.type, url: target.url })))}\n${browserOutput}`);
}

async function waitForState(wsUrl, predicate, attempts, label) {
  let state = null;
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      state = await currentState(wsUrl);
      if (predicate(state)) return state;
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`${label} did not reach expected state. state=${JSON.stringify(state)} error=${lastError?.message ?? "none"}`);
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

async function holdFor(wsUrl, keySpec, milliseconds) {
  await key(wsUrl, "keyDown", ...keySpec);
  await sleep(milliseconds);
  await key(wsUrl, "keyUp", ...keySpec);
}

async function holdUntil(wsUrl, keySpec, predicate, attempts, label) {
  await key(wsUrl, "keyDown", ...keySpec);
  let state = null;
  try {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await sleep(50);
      state = await currentState(wsUrl);
      if (predicate(state)) return state;
    }
  } finally {
    await key(wsUrl, "keyUp", ...keySpec);
  }
  throw new Error(`${label} did not reach expected state. state=${JSON.stringify(state)}`);
}

async function clickElement(wsUrl, selector) {
  const point = await evaluate(wsUrl, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) throw new Error('missing click target');
    element.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, disabled: element.disabled };
  })()`);
  if (point.disabled) throw new Error(`Click target ${selector} is disabled`);
  await callCdp(wsUrl, "Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await callCdp(wsUrl, "Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await callCdp(wsUrl, "Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

async function approachWreck(wsUrl) {
  let state = await currentState(wsUrl);
  for (let pass = 0; pass < 14 && state.distance > 8.2; pass += 1) {
    const thrustMs = state.distance > 11.5 ? 450 : 240;
    await holdFor(wsUrl, ["w", "KeyW", 87], thrustMs);
    await holdFor(wsUrl, [" ", "Space", 32], 750);
    state = await currentState(wsUrl);
    if (state.hull < 99.9 || state.collapse === "destroyed") {
      throw new Error(`Bounded approach contacted the wreck. state=${JSON.stringify(state)}`);
    }
    if (state.distance < 4) throw new Error(`Bounded approach overshot safe cutter distance. state=${JSON.stringify(state)}`);
  }
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
  if (!response?.ok) throw new Error(`Vite preview failed to serve the Phase 9 build.\n${previewOutput}`);

  const browserPath = findBrowser();
  browser = spawn(browserPath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--enable-unsafe-swiftshader",
    "--use-gl=swiftshader",
    "--window-size=1280,900",
    "--user-data-dir=/tmp/orbital-scrapper-phase9-chrome",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=9222",
    APP_URL,
  ], { stdio: ["ignore", "pipe", "pipe"] });
  browser.stdout.on("data", (chunk) => { browserOutput += chunk.toString(); });
  browser.stderr.on("data", (chunk) => { browserOutput += chunk.toString(); });

  const page = await waitForTarget();
  const wsUrl = page.webSocketDebuggerUrl;
  await waitForState(wsUrl, (state) => state.ready, 300, "Initial Phase 9 app boot");

  await evaluate(wsUrl, `localStorage.removeItem(${JSON.stringify(SAVE_KEY)}); location.reload(); true`);
  const clean = await waitForState(wsUrl, (state) => state.ready
    && state.runState === "field"
    && state.runId === 1
    && state.credits === 0
    && state.upgrade === "Clamp Dampers — not owned"
    && Math.abs(state.clampLimit - BASE_CAPTURE_LIMIT) < 0.001
    && state.scanTarget === "spine-panel"
    && state.scanRisk.includes("moderate estimate")
    && state.scanRisk.includes("250 units")
    && state.settlement === "field"
    && state.bodies === 7,
  300, "Clean Phase 9 start");
  const firstRunId = clean.runId;

  const approach = await approachWreck(wsUrl);
  if (!(approach.distance <= 8.2 && approach.distance >= 4 && approach.cutTarget === "spine-panel"
    && approach.scanTarget === "spine-panel" && approach.hull >= 99.9)) {
    throw new Error(`Could not establish safe Phase 9 panel cutter setup. state=${JSON.stringify(approach)}`);
  }

  const cut = await holdUntil(
    wsUrl,
    ["c", "KeyC", 67],
    (state) => state.cutState === "complete" && state.lastCut === "spine-panel",
    50,
    "Live Phase 9 panel cut",
  );
  if (cut.graph.includes("6 nodes / 6 edges")) throw new Error(`Graph did not reflect Phase 9 physical cut: ${JSON.stringify(cut)}`);

  const secured = await holdUntil(
    wsUrl,
    ["t", "KeyT", 84],
    (state) => state.cargoState === "secured" && state.secured === "panel" && state.settlement === "returning",
    320,
    "Live Phase 9 physical tether recovery",
  );
  if (!(secured.cargoCondition > 0 && secured.cargoCondition <= 100)) {
    throw new Error(`Phase 9 recovery produced invalid cargo condition: ${JSON.stringify(secured)}`);
  }

  const docked = await holdUntil(
    wsUrl,
    ["s", "KeyS", 83],
    (state) => state.runState === "dock" && state.settlement === "settled" && state.payout > 0 && state.credits === state.payout,
    180,
    "Live Phase 9 return and sale",
  );
  if (!(docked.distance >= 11.5 && docked.completedRuns === 1 && docked.failedRuns === 0 && docked.dockHidden === false)) {
    throw new Error(`Phase 9 settlement did not enter a valid preparation dock. state=${JSON.stringify(docked)}`);
  }
  if (docked.payout < UPGRADE_COST || docked.buyDisabled) {
    throw new Error(`Recovered payout cannot fund the required Phase 9 upgrade. state=${JSON.stringify(docked)}`);
  }
  const payout = docked.payout;

  await clickElement(wsUrl, "#buy-clamp-dampers");
  const purchased = await waitForState(wsUrl, (state) => state.runState === "dock"
    && state.upgrade === "Clamp Dampers — owned"
    && state.credits === payout - UPGRADE_COST,
  80, "Clamp Dampers purchase");
  const remainingCredits = purchased.credits;
  if (Math.abs(purchased.clampLimit - BASE_CAPTURE_LIMIT) > 0.001) {
    throw new Error(`Upgrade changed the already-active settled run retroactively. state=${JSON.stringify(purchased)}`);
  }

  await clickElement(wsUrl, "#launch-next-run");
  const nextRun = await waitForState(wsUrl, (state) => state.runState === "field"
    && state.runId > firstRunId
    && state.upgrade === "Clamp Dampers — owned"
    && state.credits === remainingCredits
    && Math.abs(state.clampLimit - UPGRADED_CAPTURE_LIMIT) < 0.001
    && state.graph.includes("6 nodes / 6 edges")
    && state.bodies === 7
    && state.settlement === "field",
  120, "Upgraded next run launch");
  const nextRunId = nextRun.runId;

  await callCdp(wsUrl, "Page.reload", { ignoreCache: true });
  const reloaded = await waitForState(wsUrl, (state) => state.ready
    && state.runState === "field"
    && state.runId > nextRunId
    && state.upgrade === "Clamp Dampers — owned"
    && state.credits === remainingCredits
    && Math.abs(state.clampLimit - UPGRADED_CAPTURE_LIMIT) < 0.001
    && state.completedRuns === 1
    && state.failedRuns === 0
    && state.graph.includes("6 nodes / 6 edges")
    && state.bodies === 7,
  300, "Persisted upgraded run after reload");

  console.log(`phase9 smoke: full scan/cut/tether/capture/return/sell/upgrade/next-run/reload loop passed in ${browserPath}; payout=${payout}; credits=${remainingCredits}; clamp=${reloaded.clampLimit.toFixed(2)}; runs=${firstRunId}->${nextRunId}->${reloaded.runId}; condition=${secured.cargoCondition.toFixed(1)}`);
} finally {
  await stopProcess(browser);
  await stopProcess(preview);
}
