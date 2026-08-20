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
  throw new Error("No Chrome/Chromium executable found for the Phase 8 browser smoke test");
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
    const text = (selector) => document.querySelector(selector)?.textContent ?? '';
    const number = (selector) => Number.parseFloat(text(selector));
    return {
      ready: document.body.dataset.phase8 === 'ready',
      scanTarget: text('#diag-scan-target'),
      scanRisk: text('#diag-scan-risk'),
      cutTarget: text('#diag-cut-target'),
      cutState: text('#diag-cut-state'),
      lastCut: text('#diag-last-cut'),
      tetherTarget: text('#diag-tether-target'),
      tetherState: text('#diag-tether-state'),
      cargoState: text('#diag-cargo-state'),
      cargoTarget: text('#diag-cargo-target'),
      cargoRelativeSpeed: number('#diag-cargo-relative-speed'),
      cargoCondition: number('#diag-cargo-condition'),
      secured: text('#diag-cargo-secured'),
      settlement: text('#diag-settlement-state'),
      payout: number('#diag-payout'),
      distance: number('#diag-distance'),
      hull: number('#diag-hull'),
      collapse: text('#diag-collapse-state'),
      graph: text('#diag-graph'),
      bodies: Number.parseInt(text('#diag-bodies'), 10),
      input: text('#diag-input'),
      summary: text('#settlement-summary')
    };
  })()`);
}

async function waitForPage() {
  let lastState = null;
  let lastError = null;
  let lastTargets = [];
  for (let attempt = 0; attempt < 300; attempt += 1) {
    lastTargets = await fetchTargets();
    const page = lastTargets.find((target) => target.type === "page" && target.webSocketDebuggerUrl && target.url?.startsWith(APP_URL));
    if (page) {
      try {
        lastState = await currentState(page.webSocketDebuggerUrl);
        if (lastState?.ready && lastState.scanTarget === "spine-panel" && lastState.scanRisk === "moderate estimate"
          && lastState.settlement === "field" && lastState.secured === "none" && lastState.payout === 0
          && lastState.hull === 100 && lastState.bodies === 7) {
          return { page, state: lastState };
        }
      } catch (error) {
        lastError = error;
      }
    }
    if (browser?.exitCode !== null) break;
    await sleep(100);
  }
  throw new Error(`Phase 8 app did not initialize on the panel recovery fixture. browserExit=${browser?.exitCode ?? "running"} targets=${JSON.stringify(lastTargets.map((target) => ({ type: target.type, url: target.url })))} state=${JSON.stringify(lastState)} error=${lastError?.message ?? "none"}\n${browserOutput}`);
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
  if (!response?.ok) throw new Error(`Vite preview failed to serve the Phase 8 build.\n${previewOutput}`);

  const browserPath = findBrowser();
  browser = spawn(browserPath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--enable-unsafe-swiftshader",
    "--use-gl=swiftshader",
    "--user-data-dir=/tmp/orbital-scrapper-phase8-chrome",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=9222",
    APP_URL,
  ], { stdio: ["ignore", "pipe", "pipe"] });
  browser.stdout.on("data", (chunk) => { browserOutput += chunk.toString(); });
  browser.stderr.on("data", (chunk) => { browserOutput += chunk.toString(); });

  const { page } = await waitForPage();
  const wsUrl = page.webSocketDebuggerUrl;

  const approach = await approachWreck(wsUrl);
  if (!(approach.distance <= 8.2 && approach.distance >= 4 && approach.cutTarget === "spine-panel"
    && approach.scanTarget === "spine-panel" && approach.hull >= 99.9)) {
    throw new Error(`Could not establish a safe live scanner/cutter setup. state=${JSON.stringify(approach)}`);
  }

  const cut = await holdUntil(
    wsUrl,
    ["c", "KeyC", 67],
    (state) => state.cutState === "complete" && state.lastCut === "spine-panel",
    50,
    "Live panel cut",
  );
  if (cut.graph.includes("6 nodes / 6 edges")) throw new Error(`Graph did not reflect physical cut: ${JSON.stringify(cut)}`);

  const secured = await holdUntil(
    wsUrl,
    ["t", "KeyT", 84],
    (state) => state.cargoState === "secured" && state.secured === "panel" && state.settlement === "returning",
    320,
    "Physical tether recovery",
  );
  if (secured.cargoCondition < 99.9) throw new Error(`Careful browser recovery damaged cargo unexpectedly: ${JSON.stringify(secured)}`);

  const settled = await holdUntil(
    wsUrl,
    ["s", "KeyS", 83],
    (state) => state.settlement === "settled" && state.payout > 0,
    180,
    "Physical extraction retreat",
  );
  if (settled.payout !== 250 || !settled.summary.includes("panel 100.0% = 250")) {
    throw new Error(`Settlement summary/payout mismatch: ${JSON.stringify(settled)}`);
  }
  if (!(settled.distance >= 11.5)) throw new Error(`Settlement occurred before extraction distance: ${JSON.stringify(settled)}`);

  await key(wsUrl, "keyDown", "x", "KeyX", 88);
  await key(wsUrl, "keyUp", "x", "KeyX", 88);
  let reset = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(50);
    reset = await currentState(wsUrl);
    if (reset.settlement === "field" && reset.secured === "none" && reset.payout === 0
      && reset.scanTarget === "spine-panel" && reset.scanRisk === "moderate estimate" && reset.bodies === 7) break;
  }
  if (!reset || reset.settlement !== "field" || reset.secured !== "none" || reset.payout !== 0
    || reset.scanTarget !== "spine-panel" || reset.bodies !== 7) {
    throw new Error(`Phase 8 reset did not restore exact recovery baseline: ${JSON.stringify(reset)}`);
  }

  console.log(`phase8 smoke: live scan/cut/tether/capture/return/settlement/reset passed in ${browserPath}; payout=${settled.payout}; condition=${settled.cargoCondition.toFixed(1)}; distance=${settled.distance.toFixed(2)}; reset=${reset.settlement}`);
} finally {
  await stopProcess(browser);
  await stopProcess(preview);
}
