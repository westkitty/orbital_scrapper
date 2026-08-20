import { rmSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const APP_URL = "http://127.0.0.1:4173/";
const DEVTOOLS_URL = "http://127.0.0.1:9223/json";
const SAVE_KEY = "orbital-scrapper-progression-v1";
const PROFILE = "/tmp/orbital-scrapper-phase11-chrome";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

const preview = spawn(process.execPath, ["./node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "4173"], { stdio: ["ignore", "pipe", "pipe"] });
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
  throw new Error("No Chrome/Chromium executable found for the Phase 11 browser smoke test");
}

async function fetchTargets() {
  try { const response = await fetch(DEVTOOLS_URL); if (response.ok) return await response.json(); } catch {}
  return [];
}

async function callCdp(wsUrl, method, params = {}) {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const timeout = setTimeout(() => { socket.close(); reject(new Error(`Timed out waiting for ${method}`)); }, 4000);
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
  const result = await callCdp(wsUrl, "Runtime.evaluate", { expression, returnByValue: true });
  if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
  return result?.result?.value;
}

async function currentState(wsUrl) {
  return await evaluate(wsUrl, `(() => {
    const text = (selector) => document.querySelector(selector)?.textContent ?? '';
    const number = (selector) => Number.parseFloat(text(selector));
    const rect = (selector) => {
      const node = document.querySelector(selector); if (!node) return null; const r = node.getBoundingClientRect();
      return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
    };
    const overlaps = (a,b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const scannerRect = rect('#scanner-card'); const reticleRect = rect('.reticle'); const viewportRect = rect('.viewport'); const canvasRect = rect('.viewport canvas');
    return {
      phase9: document.body.dataset.phase9,
      phase11: document.body.dataset.phase11,
      presentation: document.body.dataset.presentation,
      presentationMeshes: Number.parseInt(document.body.dataset.presentationMeshes ?? '0', 10),
      fxRoot: document.body.dataset.fxRoot,
      audioState: document.body.dataset.audioState,
      audioSeverity: Number.parseFloat(document.body.dataset.audioSeverity ?? '0'),
      scanTarget: text('#diag-scan-target'), scanRisk: text('#diag-scan-risk'), scanDetail: text('#hud-scan-detail'),
      cutTarget: text('#diag-cut-target'), cutState: text('#diag-cut-state'), lastCut: text('#diag-last-cut'), hudCutter: text('#hud-cutter'),
      tetherState: text('#diag-tether-state'), tetherTarget: text('#diag-tether-target'), hudTether: text('#hud-tether'),
      cargoState: text('#diag-cargo-state'), distance: number('#diag-distance'), hull: number('#diag-hull'), graph: text('#diag-graph'), bodies: Number.parseInt(text('#diag-bodies'), 10),
      hazard: text('#hazard-direction'), telemetryOpen: document.querySelector('.telemetry-drawer')?.open ?? true,
      scannerOverReticle: overlaps(scannerRect, reticleRect), viewportRect, canvasRect,
      audioPressed: document.querySelector('#audio-toggle')?.getAttribute('aria-pressed') ?? 'false',
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
  throw new Error(`Phase 11 Chrome target never appeared. browserExit=${browser?.exitCode ?? "running"} targets=${JSON.stringify(lastTargets.map((target) => ({ type: target.type, url: target.url })))}\n${browserOutput}`);
}

async function waitForState(wsUrl, predicate, attempts, label) {
  let state = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    state = await currentState(wsUrl);
    if (predicate(state)) return state;
    await sleep(100);
  }
  throw new Error(`${label} did not reach expected state. state=${JSON.stringify(state)}`);
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
    if (state.hull < 99.9 || state.distance < 4) throw new Error(`Production approach lost readability/safety. state=${JSON.stringify(state)}`);
  }
  return state;
}

try {
  let response;
  for (let attempt = 0; attempt < 40; attempt += 1) { try { response = await fetch(APP_URL); if (response.ok) break; } catch {} await sleep(250); }
  if (!response?.ok) throw new Error(`Vite preview failed to serve Phase 11 build.\n${previewOutput}`);

  const browserPath = findBrowser();
  browser = spawn(browserPath, ["--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-background-timer-throttling","--disable-renderer-backgrounding","--enable-unsafe-swiftshader","--use-gl=swiftshader","--window-size=1280,900",`--user-data-dir=${PROFILE}`,"--remote-debugging-address=127.0.0.1","--remote-debugging-port=9223",APP_URL], { stdio:["ignore","pipe","pipe"] });
  browser.stdout.on("data", (chunk) => { browserOutput += chunk.toString(); }); browser.stderr.on("data", (chunk) => { browserOutput += chunk.toString(); });
  const page = await waitForTarget(); const wsUrl = page.webSocketDebuggerUrl;
  await waitForState(wsUrl, (s) => s.phase11 === "ready", 300, "Initial Phase 11 boot");
  await evaluate(wsUrl, `localStorage.removeItem(${JSON.stringify(SAVE_KEY)}); location.reload(); true`);
  const clean = await waitForState(wsUrl, (s) => s.phase11 === "ready" && s.phase9 === "ready" && s.presentation === "production" && s.presentationMeshes > 20 && s.fxRoot === "phase11-fx-root" && s.scanTarget === "spine-panel" && s.scanRisk.includes("moderate estimate") && s.bodies === 7 && s.graph.includes("6 nodes / 6 edges"), 300, "Clean production presentation");
  if (clean.telemetryOpen) throw new Error(`Detailed telemetry should be collapsed during normal play. state=${JSON.stringify(clean)}`);
  if (clean.scannerOverReticle) throw new Error(`Scanner overlay obscures the center reticle. state=${JSON.stringify(clean)}`);
  if (!(clean.viewportRect?.width > 900 && clean.viewportRect?.height > 700 && clean.canvasRect?.width >= clean.viewportRect.width - 1 && clean.canvasRect?.height >= clean.viewportRect.height - 1)) throw new Error(`Worksite canvas is not the dominant viewport. state=${JSON.stringify(clean)}`);

  await clickElement(wsUrl, "#audio-toggle");
  const audioOn = await waitForState(wsUrl, (s) => s.audioState === "ready" && s.audioPressed === "true", 80, "User-enabled cockpit audio");
  if (!(audioOn.audioSeverity > 0)) throw new Error(`Severity-driven music bed is not receiving the stable live score. state=${JSON.stringify(audioOn)}`);

  const approach = await approachWreck(wsUrl);
  if (!(approach.distance >= 4 && approach.distance <= 8.2 && approach.cutTarget === "spine-panel")) throw new Error(`Could not establish production cutter setup. state=${JSON.stringify(approach)}`);

  await key(wsUrl, "keyDown", "c", "KeyC", 67); await sleep(250);
  const cutting = await currentState(wsUrl); await key(wsUrl, "keyUp", "c", "KeyC", 67);
  if (!(cutting.cutState === "cutting" && /CUTTING/i.test(cutting.hudCutter))) throw new Error(`Live cutter presentation did not expose progress state. state=${JSON.stringify(cutting)}`);

  const cut = await holdUntil(wsUrl, ["c","KeyC",67], (s) => s.cutState === "complete" && s.lastCut === "spine-panel", 50, "Production panel cut");
  if (cut.graph.includes("6 nodes / 6 edges")) throw new Error(`Graph did not reflect production-path physical cut. state=${JSON.stringify(cut)}`);

  await key(wsUrl, "keyDown", "t", "KeyT", 84); await sleep(180);
  const tethered = await currentState(wsUrl); await key(wsUrl, "keyUp", "t", "KeyT", 84);
  if (!(tethered.tetherState === "attached" && tethered.tetherTarget === "panel" && /LOAD/i.test(tethered.hudTether))) throw new Error(`Live tether presentation did not expose target/load. state=${JSON.stringify(tethered)}`);

  await holdFor(wsUrl, ["x","KeyX",88], 80);
  const reset = await waitForState(wsUrl, (s) => s.graph.includes("6 nodes / 6 edges") && s.bodies === 7 && s.lastCut === "none" && s.hull >= 99.9, 100, "Production presentation reset");
  if (reset.scannerOverReticle) throw new Error(`Scanner overlay obstructed center after reset. state=${JSON.stringify(reset)}`);

  console.log(`phase11 smoke: production HUD/asset/VFX/audio path passed in ${browserPath}; meshes=${clean.presentationMeshes}; scan=${clean.scanTarget}; audio=${audioOn.audioState}; cut=${cut.lastCut}; tether=${tethered.tetherTarget}; reset=${reset.graph}`);
} finally {
  await stopProcess(browser);
  await stopProcess(preview);
  removeProfileBestEffort();
}
