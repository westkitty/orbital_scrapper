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
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(1500),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function findBrowser() {
  const candidates = [process.env.CHROME_PATH, "google-chrome", "chromium-browser", "chromium"].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes("/")) return candidate;
    const probe = spawnSync("which", [candidate], { encoding: "utf8" });
    if (probe.status === 0) return probe.stdout.trim();
  }
  throw new Error("No Chrome/Chromium executable found for the Phase 1 browser smoke test");
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

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ id: 1, method, params }));
    });

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
    const position = (document.querySelector('#diag-position')?.textContent ?? '').split(',').map((value) => Number.parseFloat(value));
    return {
      ready: document.body.dataset.phase1 === 'ready',
      status: document.querySelector('#status')?.textContent ?? '',
      bodies: Number.parseInt(document.querySelector('#diag-bodies')?.textContent ?? '0', 10),
      speed: number('#diag-speed'),
      distance: number('#diag-distance'),
      x: position[0],
      y: position[1],
      z: position[2]
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
        if (lastState?.ready && lastState.status.includes("Flight controls ready") && lastState.bodies === 8) {
          return { page, state: lastState };
        }
      } catch (error) {
        lastError = error;
      }
    }
    await sleep(250);
  }
  throw new Error(`Phase 1 app did not initialize. lastState=${JSON.stringify(lastState)} lastError=${lastError?.message ?? "none"}\n${browserOutput}`);
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

try {
  let response;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      response = await fetch(APP_URL);
      if (response.ok) break;
    } catch {}
    await sleep(250);
  }
  if (!response?.ok) throw new Error(`Vite preview failed to serve the Phase 1 build.\n${previewOutput}`);

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

  await key(wsUrl, "keyDown", "w", "KeyW", 87);
  await sleep(1100);
  await key(wsUrl, "keyUp", "w", "KeyW", 87);
  await sleep(150);
  const afterThrust = await currentState(wsUrl);
  if (!(afterThrust.z < initial.z - 0.5 && afterThrust.speed > 0.5)) {
    throw new Error(`Keyboard thrust did not move the craft through the live browser path. initial=${JSON.stringify(initial)} after=${JSON.stringify(afterThrust)}`);
  }

  await key(wsUrl, "keyDown", " ", "Space", 32);
  await sleep(1200);
  await key(wsUrl, "keyUp", " ", "Space", 32);
  await sleep(180);
  const afterBrake = await currentState(wsUrl);
  if (!(afterBrake.speed < afterThrust.speed * 0.5)) {
    throw new Error(`Keyboard braking did not materially reduce speed. thrust=${JSON.stringify(afterThrust)} brake=${JSON.stringify(afterBrake)}`);
  }

  await key(wsUrl, "keyDown", "x", "KeyX", 88);
  await key(wsUrl, "keyUp", "x", "KeyX", 88);
  await sleep(400);
  const afterReset = await currentState(wsUrl);
  if (!(Math.abs(afterReset.x) < 0.15 && Math.abs(afterReset.y) < 0.15 && Math.abs(afterReset.z - 12) < 0.2 && afterReset.speed < 0.2)) {
    throw new Error(`Keyboard reset did not restore the flight baseline. reset=${JSON.stringify(afterReset)}`);
  }

  console.log(`phase1 smoke: live keyboard thrust/brake/reset passed in ${browserPath}; bodies=${initial.bodies}`);
} finally {
  await stopProcess(browser);
  await stopProcess(preview);
}
