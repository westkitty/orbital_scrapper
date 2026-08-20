import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = process.cwd();
const DIST = join(ROOT, "dist");
const RELEASE = join(ROOT, "release", "orbital-scrapper-web");
const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

if (!statSync(DIST, { throwIfNoEntry: false })?.isDirectory()) {
  throw new Error("Production dist/ is missing; run the build before packaging");
}

rmSync(RELEASE, { recursive: true, force: true });
mkdirSync(RELEASE, { recursive: true });
cpSync(DIST, RELEASE, { recursive: true });

const productionFiles = walk(RELEASE)
  .map((path) => ({
    path,
    relativePath: relative(RELEASE, path).replaceAll("\\", "/"),
  }))
  .filter((entry) => entry.relativePath !== "RELEASE_MANIFEST.json" && entry.relativePath !== "README.txt")
  .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

const manifest = {
  schemaVersion: 1,
  packageName: packageJson.name,
  packageVersion: packageJson.version,
  target: "desktop-chromium-static-web",
  entrypoint: "index.html",
  files: productionFiles.map((entry) => ({
    path: entry.relativePath,
    bytes: statSync(entry.path).size,
    sha256: sha256(entry.path),
  })),
};

if (!manifest.files.some((file) => file.path === manifest.entrypoint)) {
  throw new Error("Release package is missing index.html");
}
if (!manifest.files.some((file) => file.path.startsWith("assets/") && file.path.endsWith(".js"))) {
  throw new Error("Release package is missing its production JavaScript asset");
}

writeFileSync(join(RELEASE, "RELEASE_MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(RELEASE, "README.txt"), [
  "ORBITAL SCRAPPER — PHASE 12 CONCEPT RELEASE",
  "",
  "Target: desktop Chromium-class browser, static HTTP hosting.",
  "Entrypoint: index.html",
  "",
  "Serve this directory with an ordinary static HTTP server.",
  "The Phase 12 concept release does not claim file:// loading, native installation, signing, or store packaging.",
  "RELEASE_MANIFEST.json contains SHA-256 digests for the production files created by Vite.",
  "",
].join("\n"));

const packagedBytes = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
console.log(`release package: ${manifest.files.length} production files / ${packagedBytes} bytes -> ${relative(ROOT, RELEASE)}`);
