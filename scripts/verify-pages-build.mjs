import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const outputRoot = resolve("dist-pages");
const indexPath = resolve(outputRoot, "index.html");
if (!existsSync(indexPath)) throw new Error("Pages build is missing dist-pages/index.html");

const html = readFileSync(indexPath, "utf8");
const assetUrls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
const bundledAssets = assetUrls.filter((url) => url.includes("/assets/"));

if (bundledAssets.length < 2) {
  throw new Error(`Pages build did not expose the expected JS/CSS assets: ${JSON.stringify(assetUrls)}`);
}

for (const url of bundledAssets) {
  if (!url.startsWith("/orbital_scrapper/assets/")) {
    throw new Error(`Pages asset escaped the repository base path: ${url}`);
  }
  const relative = url.replace(/^\/orbital_scrapper\//, "");
  if (!existsSync(resolve(outputRoot, relative))) {
    throw new Error(`Pages asset URL has no matching built file: ${url}`);
  }
}

if (html.includes('src="/assets/') || html.includes('href="/assets/')) {
  throw new Error("Pages build contains a root-relative /assets URL that would break under the repository subpath");
}

console.log(`pages build: ${bundledAssets.length} bundled asset references correctly rooted at /orbital_scrapper/`);
