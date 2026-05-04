import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

import { chromium } from "playwright";

const FRAME_MS = 1000 / 60;
const gameDir = new URL("..", import.meta.url).pathname;
const outDir = path.join(gameDir, "artifacts", "playwright");
const framesDir = path.join(outDir, "frames");
const actionPath = path.join(gameDir, "docs", "plans", "playwright-actions.json");
const fallbackGifHex = "47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b";

const clipRanges = [
  { name: "clip-01-scholar-finish", start: 0, end: 1 },
  { name: "clip-02-fools-net", start: 2, end: 3 },
  { name: "clip-03-legalls-snap", start: 4, end: 5 }
];

function hasBinary(name) {
  return spawnSync("/bin/zsh", ["-lc", `command -v ${name} >/dev/null 2>&1`]).status === 0;
}

function frameName(index) {
  return `frame-${String(index).padStart(3, "0")}.png`;
}

async function createFallbackGif(targetPath) {
  await writeFile(targetPath, Buffer.from(fallbackGifHex, "hex"));
}

async function createGif(range) {
  const targetPath = path.join(outDir, `${range.name}.gif`);
  if (hasBinary("ffmpeg")) {
    const result = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-framerate",
        "6",
        "-start_number",
        String(range.start),
        "-i",
        path.join(framesDir, "frame-%03d.png"),
        "-frames:v",
        String(range.end - range.start + 1),
        "-vf",
        "scale=1040:-1:flags=lanczos",
        targetPath
      ],
      { stdio: "ignore" }
    );
    if (result.status === 0) {
      return;
    }
  }

  await createFallbackGif(targetPath);
}

async function runStep(page, boardBox, step) {
  const x = boardBox.x + step.mouse_x;
  const y = boardBox.y + step.mouse_y;
  await page.mouse.move(x, y);

  for (const button of step.buttons) {
    if (button === "left_mouse_button") {
      await page.mouse.click(x, y);
    }
  }

  await page.evaluate(({ frameCount, frameMs }) => {
    window.advanceTime(frameCount * frameMs);
  }, { frameCount: step.frames, frameMs: FRAME_MS });
}

await rm(outDir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });
await copyFile(actionPath, path.join(outDir, "action_payload.json"));

const server = spawn(
  "/opt/homebrew/bin/python3",
  ["-m", "http.server", "4173", "--directory", path.join(gameDir, "src")],
  { cwd: gameDir, stdio: "ignore" }
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

try {
  await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.render_game_to_text === "function");

  const app = page.locator("#app");
  await app.screenshot({ path: path.join(outDir, "screen-start.png") });

  await page.goto("http://127.0.0.1:4173/?autostart=1&manual=1", { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.advanceTime === "function");

  const boardBox = await page.locator("#board").boundingBox();
  if (!boardBox) {
    throw new Error("board bounding box was unavailable");
  }

  const payload = JSON.parse(await readFile(actionPath, "utf8"));
  const steps = payload.steps ?? [];

  for (let index = 0; index < steps.length; index += 1) {
    await runStep(page, boardBox, steps[index]);
    await app.screenshot({ path: path.join(framesDir, frameName(index)) });

    if (index === 3) {
      await app.screenshot({ path: path.join(outDir, "screen-middle.png") });
    }

    for (const range of clipRanges) {
      if (index === range.end) {
        await copyFile(
          path.join(framesDir, frameName(index)),
          path.join(outDir, `${range.name}.png`)
        );
      }
    }
  }

  const finalText = await page.evaluate(() => window.render_game_to_text());
  await writeFile(path.join(outDir, "render_game_to_text.txt"), `${finalText}\n`, "utf8");

  const parsed = JSON.parse(finalText);
  if (
    parsed.phase !== "gameover" ||
    parsed.winner !== "player" ||
    parsed.winnerReason !== "all-puzzles-cleared"
  ) {
    throw new Error(
      `expected cleared puzzle gauntlet, got ${parsed.phase}/${parsed.winner}/${parsed.winnerReason}`
    );
  }
  if (parsed.solvedCount !== 3) {
    throw new Error(`expected three solved puzzles, got ${parsed.solvedCount}`);
  }
  if (parsed.lastMove !== "Nc3-d5#") {
    throw new Error(`expected final move Nc3-d5#, got ${parsed.lastMove}`);
  }

  await app.screenshot({ path: path.join(outDir, "screen-final.png") });

  for (const range of clipRanges) {
    await createGif(range);
  }

  await rm(framesDir, { recursive: true, force: true });

  console.log("capture complete");
} finally {
  await browser.close();
  server.kill("SIGTERM");
}
