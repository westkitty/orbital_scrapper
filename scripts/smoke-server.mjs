import { spawn, spawnSync } from "node:child_process";

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
    new Promise((resolve) => setTimeout(resolve, 1500)),
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
  throw new Error("No Chrome/Chromium executable found for the Phase 0 browser smoke test");
}

async function pollJson(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function evaluate(wsUrl, expression) {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Timed out waiting for Chrome DevTools Protocol evaluation"));
    }, 10000);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: {
          expression,
          awaitPromise: true,
          returnByValue: true,
        },
      }));
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data.toString());
      if (message.id !== 1) return;
      clearTimeout(timeout);
      socket.close();
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result?.result?.value);
    });

    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("Chrome DevTools Protocol websocket failed"));
    });
  });
}

try {
  let response;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      response = await fetch("http://127.0.0.1:4173/");
      if (response.ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (!response?.ok) throw new Error(`Vite preview failed to serve the build.\n${previewOutput}`);
  const html = await response.text();
  if (!html.includes("Orbital Scrapper")) throw new Error("Served HTML did not contain the expected project title");

  const browserPath = findBrowser();
  browser = spawn(browserPath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--enable-unsafe-swiftshader",
    "--use-gl=swiftshader",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=9222",
    "http://127.0.0.1:4173/",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  browser.stdout.on("data", (chunk) => { browserOutput += chunk.toString(); });
  browser.stderr.on("data", (chunk) => { browserOutput += chunk.toString(); });

  const targets = await pollJson("http://127.0.0.1:9222/json");
  const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
  if (!page) throw new Error(`Chrome started but no debuggable page target appeared.\n${browserOutput}`);

  const state = await evaluate(page.webSocketDebuggerUrl, `
    new Promise((resolve) => {
      const started = Date.now();
      const inspect = () => {
        const status = document.querySelector('#status')?.textContent ?? '';
        const bodies = document.querySelector('#diag-bodies')?.textContent ?? '';
        const constraints = document.querySelector('#diag-constraints')?.textContent ?? '';
        if (status.includes('Bridge joint active')) {
          resolve({ ready: true, status, bodies, constraints });
          return;
        }
        if (Date.now() - started > 8000) {
          resolve({ ready: false, status, bodies, constraints });
          return;
        }
        setTimeout(inspect, 100);
      };
      inspect();
    })
  `);

  if (!state?.ready || state.bodies !== "4" || state.constraints !== "1") {
    throw new Error(`Built app did not reach the expected initialized browser state: ${JSON.stringify(state)}\n${browserOutput}`);
  }

  console.log(`phase0 smoke: initialized in ${browserPath}; bodies=${state.bodies}; constraints=${state.constraints}`);
} finally {
  await stopProcess(browser);
  await stopProcess(preview);
}
