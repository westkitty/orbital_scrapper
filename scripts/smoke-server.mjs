import { spawn, spawnSync } from "node:child_process";

const child = spawn(process.execPath, ["./node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "4173"], {
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => { output += chunk.toString(); });
child.stderr.on("data", (chunk) => { output += chunk.toString(); });

async function stop() {
  if (!child.killed) child.kill("SIGTERM");
  if (child.exitCode === null) await new Promise((resolve) => child.once("exit", resolve));
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

try {
  let response;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      response = await fetch("http://127.0.0.1:4173/");
      if (response.ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (!response?.ok) throw new Error(`Vite preview failed to serve the build.\n${output}`);
  const html = await response.text();
  if (!html.includes("Orbital Scrapper")) throw new Error("Served HTML did not contain the expected project title");

  const browser = findBrowser();
  const smoke = spawnSync(browser, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--virtual-time-budget=4000",
    "--dump-dom",
    "http://127.0.0.1:4173/",
  ], { encoding: "utf8", timeout: 15000 });

  if (smoke.status !== 0) {
    throw new Error(`Headless browser failed to launch the built app.\n${smoke.stderr || smoke.stdout}`);
  }
  if (!smoke.stdout.includes("Bridge joint active")) {
    throw new Error(`Browser loaded HTML but the Rapier runtime did not reach the initialized Phase 0 state.\n${smoke.stdout}`);
  }

  console.log(`phase0 smoke: built app initialized in ${browser}`);
} finally {
  await stop();
}
