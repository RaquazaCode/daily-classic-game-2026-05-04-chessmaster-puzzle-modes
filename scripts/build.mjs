import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const distDir = path.join(rootDir, "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(path.join(rootDir, "src"), distDir, { recursive: true });
await cp(path.join(rootDir, "assets"), path.join(distDir, "assets"), { recursive: true });

const indexPath = path.join(distDir, "index.html");
const indexHtml = await readFile(indexPath, "utf8");
await writeFile(indexPath, indexHtml.replace("../assets/favicon.svg", "./assets/favicon.svg"), "utf8");

console.log("build complete");
