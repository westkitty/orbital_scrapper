import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["./node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "4173"], {
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => { output += chunk.toString(); });
child.stderr.on("data", (chunk) => { output += chunk.toString(); });

async function stop() {
  if (!child.killed) child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
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
  console.log("phase0 smoke: preview server returned the Orbital Scrapper build");
} finally {
  await stop();
}
