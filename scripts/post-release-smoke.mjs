import { mkdirSync, rmSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const APP_URL = "http://127.0.0.1:4173/";
const DEVTOOLS_URL = "http://127.0.0.1:9226/json";
const PROFILE = "/tmp/orbital-scrapper-post-release-chrome";
const SAVE_KEY = "orbital-scrapper-progression-v1";
const BACKUP_KEY = "orbital-scrapper-progression-v1-backup";
const STARTING_CREDITS = 500;
const TOTAL_UPGRADE_COST = 450;
const BASE_CAPTURE_LIMIT = 1.35;
const UPGRADED_CAPTURE_LIMIT = 2.0;
const BASE_CUTTER_RANGE = 9;
const UPGRADED_CUTTER_RANGE = 12;
const BASE_TETHER_TENSION = 70;
const UPGRADED_TETHER_TENSION = 105;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
mkdirSync(PROFILE, { recursive: true });

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
  throw new Error("No Chrome/Chromium executable found for post-release smoke");
}

async function fetchTargets() {
  try {
    const response = await fetch(DEVTOOLS_URL);
    if (response.ok) return await response.json();
  } catch {}
  return [];
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
  throw new Error(`Post-release Chrome target never appeared. browserExit=${browser?.exitCode ?? "running"} targets=${JSON.stringify(lastTargets.map((target) => ({ type: target.type, url: target.url })))}\n${browserOutput}`);
}

async function callCdp(wsUrl, method, params = {}) {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`Timed out waiting for Chrome DevTools Protocol method ${method}`));
    }, 5000);
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
  const result = await callCdp(wsUrl, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
  return result?.result?.value;
}

async function currentState(wsUrl) {
  return await evaluate(wsUrl, `(() => {
    const text = (selector) => document.querySelector(selector)?.textContent ?? '';
    const number = (selector) => Number.parseFloat(text(selector));
    const integer = (selector) => Number.parseInt(text(selector), 10);
    let save = null;
    try { save = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}) ?? 'null'); } catch {}
    return {
      ready: document.body.dataset.phase9 === 'ready' && document.body.dataset.phase11 === 'ready',
      runState: text('#diag-run-state'),
      runId: integer('#diag-run-id'),
      credits: integer('#diag-credits'),
      clampUpgrade: text('#diag-upgrade'),
      clampLimit: number('#diag-clamp-limit'),
      cutterRange: Number.parseFloat(document.body.dataset.cutterRange ?? '0'),
      tetherMaxTension: Number.parseFloat(document.body.dataset.tetherMaxTension ?? '0'),
      completedRuns: integer('#diag-completed-runs'),
      failedRuns: integer('#diag-failed-runs'),
      scanTarget: text('#diag-scan-target'),
      scanRisk: text('#diag-scan-risk'),
      cutTarget: text('#diag-cut-target'),
      cutState: text('#diag-cut-state'),
      lastCut: text('#diag-last-cut'),
      cargoState: text('#diag-cargo-state'),
      cargoCondition: number('#diag-cargo-condition'),
      secured: text('#diag-cargo-secured'),
      settlement: text('#diag-settlement-state'),
      payout: integer('#diag-payout'),
      distance: number('#diag-distance'),
      hull: number('#diag-hull'),
      collapse: text('#diag-collapse-state'),
      graph: text('#diag-graph'),
      bodies: integer('#diag-bodies'),
      dockHidden: document.querySelector('#dock-panel')?.hidden ?? true,
      clampButton: text('#buy-clamp-dampers'),
      clampDisabled: document.querySelector('#buy-clamp-dampers')?.disabled ?? true,
      tetherButton: text('#buy-tether-reinforcement'),
      tetherDisabled: document.querySelector('#buy-tether-reinforcement')?.disabled ?? true,
      cutterButton: text('#buy-cutter-optics'),
      cutterDisabled: document.querySelector('#buy-cutter-optics')?.disabled ?? true,
      launchDisabled: document.querySelector('#launch-next-run')?.disabled ?? true,
      owned: save?.upgrades ?? null,
    };
  })()`);
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
  if (!response?.ok) throw new Error(`Vite preview failed to serve post-release build.\n${previewOutput}`);

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
    `--user-data-dir=${PROFILE}`,
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=9226",
    APP_URL,
  ], { stdio: ["ignore", "pipe", "pipe"] });
  browser.stdout.on("data", (chunk) => { browserOutput += chunk.toString(); });
  browser.stderr.on("data", (chunk) => { browserOutput += chunk.toString(); });

  const page = await waitForTarget();
  const wsUrl = page.webSocketDebuggerUrl;
  await waitForState(wsUrl, (state) => state.ready, 300, "Initial post-release app boot");

  const seededSave = {
    version: 2,
    credits: STARTING_CREDITS,
    upgrades: { clampDampers: false, tetherReinforcement: false, cutterOptics: false },
    nextRunId: 1,
    completedRuns: 0,
    failedRuns: 0,
    lastSettledRunId: null,
    lastFailedRunId: null,
  };
  const serialized = JSON.stringify(seededSave);
  await evaluate(wsUrl, `localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(serialized)}); localStorage.setItem(${JSON.stringify(BACKUP_KEY)}, ${JSON.stringify(serialized)}); location.reload(); true`);

  const clean = await waitForState(wsUrl, (state) => state.ready
    && state.runState === "field"
    && state.runId === 1
    && state.credits === STARTING_CREDITS
    && state.clampUpgrade === "Clamp Dampers — not owned"
    && Math.abs(state.clampLimit - BASE_CAPTURE_LIMIT) < 0.001
    && Math.abs(state.cutterRange - BASE_CUTTER_RANGE) < 0.001
    && Math.abs(state.tetherMaxTension - BASE_TETHER_TENSION) < 0.001
    && state.scanTarget === "spine-panel"
    && state.scanRisk.includes("moderate estimate")
    && state.settlement === "field"
    && state.bodies === 7,
  300, "Seeded post-release start");
  const firstRunId = clean.runId;

  const approach = await approachWreck(wsUrl);
  if (!(approach.distance <= 8.2 && approach.distance >= 4 && approach.cutTarget === "spine-panel" && approach.hull >= 99.9)) {
    throw new Error(`Could not establish safe post-release panel cutter setup. state=${JSON.stringify(approach)}`);
  }

  const cut = await holdUntil(
    wsUrl,
    ["c", "KeyC", 67],
    (state) => state.cutState === "complete" && state.lastCut === "spine-panel",
    50,
    "Post-release panel cut",
  );
  if (cut.graph.includes("6 nodes / 6 edges")) throw new Error(`Graph did not reflect post-release physical cut: ${JSON.stringify(cut)}`);

  const secured = await holdUntil(
    wsUrl,
    ["t", "KeyT", 84],
    (state) => state.cargoState === "secured" && state.secured === "panel" && state.settlement === "returning",
    320,
    "Post-release physical tether recovery",
  );
  if (!(secured.cargoCondition > 0 && secured.cargoCondition <= 100)) {
    throw new Error(`Post-release recovery produced invalid cargo condition: ${JSON.stringify(secured)}`);
  }

  const docked = await holdUntil(
    wsUrl,
    ["s", "KeyS", 83],
    (state) => state.runState === "dock"
      && state.settlement === "settled"
      && state.payout > 0
      && state.credits === STARTING_CREDITS + state.payout,
    180,
    "Post-release return and sale",
  );
  if (!(docked.distance >= 11.5 && docked.completedRuns === 1 && docked.failedRuns === 0 && docked.dockHidden === false)) {
    throw new Error(`Post-release settlement did not enter valid preparation dock. state=${JSON.stringify(docked)}`);
  }
  if (docked.clampDisabled || docked.tetherDisabled || docked.cutterDisabled) {
    throw new Error(`Seeded settlement should make all three dock upgrades affordable. state=${JSON.stringify(docked)}`);
  }
  const payout = docked.payout;

  await clickElement(wsUrl, "#buy-clamp-dampers");
  await clickElement(wsUrl, "#buy-tether-reinforcement");
  await clickElement(wsUrl, "#buy-cutter-optics");

  const purchased = await waitForState(wsUrl, (state) => state.runState === "dock"
    && state.owned?.clampDampers === true
    && state.owned?.tetherReinforcement === true
    && state.owned?.cutterOptics === true
    && state.clampDisabled
    && state.tetherDisabled
    && state.cutterDisabled
    && state.credits === STARTING_CREDITS + payout - TOTAL_UPGRADE_COST,
  100, "All three dock purchases");
  const remainingCredits = purchased.credits;

  if (Math.abs(purchased.clampLimit - BASE_CAPTURE_LIMIT) > 0.001
    || Math.abs(purchased.cutterRange - BASE_CUTTER_RANGE) > 0.001
    || Math.abs(purchased.tetherMaxTension - BASE_TETHER_TENSION) > 0.001) {
    throw new Error(`Dock purchases changed the already-completed run retroactively. state=${JSON.stringify(purchased)}`);
  }

  await clickElement(wsUrl, "#launch-next-run");
  const nextRun = await waitForState(wsUrl, (state) => state.runState === "field"
    && state.runId > firstRunId
    && state.owned?.clampDampers === true
    && state.owned?.tetherReinforcement === true
    && state.owned?.cutterOptics === true
    && state.credits === remainingCredits
    && Math.abs(state.clampLimit - UPGRADED_CAPTURE_LIMIT) < 0.001
    && Math.abs(state.cutterRange - UPGRADED_CUTTER_RANGE) < 0.001
    && Math.abs(state.tetherMaxTension - UPGRADED_TETHER_TENSION) < 0.001
    && state.graph.includes("6 nodes / 6 edges")
    && state.bodies === 7
    && state.settlement === "field",
  150, "Complete upgraded next-run launch");
  const nextRunId = nextRun.runId;

  await callCdp(wsUrl, "Page.reload", { ignoreCache: true });
  const reloaded = await waitForState(wsUrl, (state) => state.ready
    && state.runState === "field"
    && state.runId > nextRunId
    && state.owned?.clampDampers === true
    && state.owned?.tetherReinforcement === true
    && state.owned?.cutterOptics === true
    && state.credits === remainingCredits
    && Math.abs(state.clampLimit - UPGRADED_CAPTURE_LIMIT) < 0.001
    && Math.abs(state.cutterRange - UPGRADED_CUTTER_RANGE) < 0.001
    && Math.abs(state.tetherMaxTension - UPGRADED_TETHER_TENSION) < 0.001
    && state.completedRuns === 1
    && state.failedRuns === 0
    && state.graph.includes("6 nodes / 6 edges")
    && state.bodies === 7,
  300, "Persisted complete loadout after reload");

  console.log(`post-release smoke: full settlement/all-three-dock-upgrades/next-run/reload passed in ${browserPath}; payout=${payout}; credits=${remainingCredits}; clamp=${reloaded.clampLimit.toFixed(2)}m/s; tether=${reloaded.tetherMaxTension.toFixed(0)}N; cutter=${reloaded.cutterRange.toFixed(0)}m; runs=${firstRunId}->${nextRunId}->${reloaded.runId}; condition=${secured.cargoCondition.toFixed(1)}`);
} finally {
  await stopProcess(browser);
  await stopProcess(preview);
  try { rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
}
