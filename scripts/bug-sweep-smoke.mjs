import { mkdirSync, rmSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const APP_URL = "http://127.0.0.1:4173/";
const DEVTOOLS_URL = "http://127.0.0.1:9225/json";
const PROFILE = "/tmp/orbital-scrapper-bug-sweep-chrome";
const SAVE_KEY = "orbital-scrapper-progression-v1";
const BACKUP_KEY = "orbital-scrapper-progression-v1-backup";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
mkdirSync(PROFILE, { recursive: true });
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
function findBrowser() {
  const candidates = [process.env.CHROME_PATH, "google-chrome", "chromium-browser", "chromium"].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes("/")) return candidate;
    const probe = spawnSync("which", [candidate], { encoding: "utf8" });
    if (probe.status === 0) return probe.stdout.trim();
  }
  throw new Error("No Chrome/Chromium executable found for bug-sweep smoke");
}
async function fetchTargets() {
  try { const response = await fetch(DEVTOOLS_URL); if (response.ok) return await response.json(); } catch {}
  return [];
}
async function waitForTarget() {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const targets = await fetchTargets();
    const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl && target.url?.startsWith(APP_URL));
    if (page) return page;
    if (browser?.exitCode !== null) break;
    await sleep(100);
  }
  throw new Error(`Bug-sweep Chrome target never appeared. browserExit=${browser?.exitCode ?? "running"}\n${browserOutput}`);
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
async function currentState(wsUrl) {
  return await evaluate(wsUrl, `(() => ({
    ready: document.body.dataset.phase9 === 'ready' && document.body.dataset.phase11 === 'ready',
    cutterRange: Number.parseFloat(document.body.dataset.cutterRange ?? '0'),
    tetherMaxTension: Number.parseFloat(document.body.dataset.tetherMaxTension ?? '0'),
    clampLimit: Number.parseFloat(document.querySelector('#diag-clamp-limit')?.textContent ?? '0'),
    runId: Number.parseInt(document.querySelector('#diag-run-id')?.textContent ?? '0', 10),
    graph: document.querySelector('#diag-graph')?.textContent ?? '',
    bodies: Number.parseInt(document.querySelector('#diag-bodies')?.textContent ?? '0', 10),
  }))()`);
}
async function waitForState(wsUrl, predicate, label) {
  let state = null;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    state = await currentState(wsUrl);
    if (predicate(state)) return state;
    await sleep(100);
  }
  throw new Error(`${label} did not reach expected state: ${JSON.stringify(state)}`);
}

try {
  let response;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { response = await fetch(APP_URL); if (response.ok) break; } catch {}
    await sleep(250);
  }
  if (!response?.ok) throw new Error(`Vite preview failed to serve bug-sweep build.\n${previewOutput}`);

  const browserPath = findBrowser();
  browser = spawn(browserPath, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader", "--use-gl=swiftshader",
    "--window-size=1280,900", `--user-data-dir=${PROFILE}`, "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=9225", APP_URL,
  ], { stdio: ["ignore", "pipe", "pipe"] });
  browser.stdout.on("data", (chunk) => { browserOutput += chunk.toString(); });
  browser.stderr.on("data", (chunk) => { browserOutput += chunk.toString(); });
  const page = await waitForTarget();
  const wsUrl = page.webSocketDebuggerUrl;
  await waitForState(wsUrl, (state) => state.ready, "Initial bug-sweep boot");

  const ownedSave = {
    version: 2,
    credits: 500,
    upgrades: { clampDampers: true, tetherReinforcement: true, cutterOptics: true },
    nextRunId: 1,
    completedRuns: 0,
    failedRuns: 0,
    lastSettledRunId: null,
    lastFailedRunId: null,
  };
  const serialized = JSON.stringify(ownedSave);
  await evaluate(wsUrl, `localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(serialized)}); localStorage.setItem(${JSON.stringify(BACKUP_KEY)}, ${JSON.stringify(serialized)}); location.reload(); true`);
  const upgraded = await waitForState(wsUrl, (state) => state.ready && state.runId === 1 && state.cutterRange === 12 && state.tetherMaxTension === 105 && state.clampLimit === 2 && state.bodies === 7 && state.graph.includes("6 nodes / 6 edges / 0 supports"), "Persisted upgrade runtime application");

  console.log(`bug-sweep smoke: persisted runtime capabilities passed in ${browserPath}; cutter=${upgraded.cutterRange.toFixed(2)}m; tether=${upgraded.tetherMaxTension.toFixed(2)}N; clamp=${upgraded.clampLimit.toFixed(2)}m/s; run=${upgraded.runId}`);
} finally {
  await stopProcess(browser);
  await stopProcess(preview);
  try { rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
}
