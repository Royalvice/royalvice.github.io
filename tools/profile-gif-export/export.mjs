#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DEFAULTS = {
  baseUrl: "http://127.0.0.1:4173",
  outDir: path.join(ROOT, "dist/profile-gifs"),
  width: 720,
  fps: 24,
  maxBytes: 36_700_160,
  only: "all"
};

const CARD_SPECS = {
  profile: {
    id: "profile-card",
    file: "profile-card.gif",
    selector: ".profile-top",
    width: 720,
    height: 340,
    frames: 192,
    duration: 8,
    keyframes: [0, 12, 36, 61, 84, 108, 168, 180, 191]
  },
  room: {
    id: "sprite-room",
    file: "sprite-room.gif",
    selector: "[data-profile-gif-room]",
    width: 720,
    height: 350,
    frames: 1_440,
    duration: 60,
    keyframes: [0, 240, 480, 720, 960, 1_200, 1_320, 1_416, 1_439]
  },
  news: {
    id: "news-terminal",
    file: "news-terminal.gif",
    selector: ".terminal-shell",
    width: 720,
    height: 350,
    frames: 240,
    duration: 10,
    keyframes: [0, 1, 29, 58, 116, 174, 202, 216, 239]
  }
};

function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--base-url") options.baseUrl = value, index += 1;
    else if (arg === "--out-dir") options.outDir = path.resolve(value), index += 1;
    else if (arg === "--width") options.width = Number(value), index += 1;
    else if (arg === "--fps") options.fps = Number(value), index += 1;
    else if (arg === "--max-bytes") options.maxBytes = Number(value), index += 1;
    else if (arg === "--only") options.only = value, index += 1;
    else if (arg === "--help" || arg === "-h") {
      process.stdout.write(`Usage: npm run export:profile-gifs -- [options]\n\n` +
        `  --base-url <url>      Vite development server (default ${DEFAULTS.baseUrl})\n` +
        `  --out-dir <path>      Published output directory\n` +
        `  --width <pixels>      Required output width (locked to 720)\n` +
        `  --fps <number>        Required frame rate (locked to 24)\n` +
        `  --max-bytes <bytes>   Per-GIF hard cap (default 36700160)\n` +
        `  --only <name>         all, profile, room, or news (development aid)\n`);
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.width !== 720) throw new Error("Profile GIF publication is locked to 720px width.");
  if (options.fps !== 24) throw new Error("Profile GIF publication is locked to 24fps.");
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) throw new Error("--max-bytes must be a positive integer.");
  if (!Object.hasOwn(CARD_SPECS, options.only) && options.only !== "all") throw new Error("--only must be all, profile, room, or news.");
  options.baseUrl = options.baseUrl.replace(/\/$/, "");
  return options;
}

function run(command, args, { cwd = ROOT, capture = false, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit"
    });
    const stdout = [];
    const stderr = [];
    if (capture) {
      child.stdout.on("data", (chunk) => stdout.push(chunk));
      child.stderr.on("data", (chunk) => stderr.push(chunk));
    }
    child.on("error", reject);
    child.on("close", (code) => {
      const result = { code, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) };
      if (code === 0) resolve(result);
      else reject(new Error(`${command} exited with ${code}${capture ? `\n${result.stderr.toString()}` : ""}`));
    });
  });
}

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const fileSha256 = async (file) => sha256(await readFile(file));

async function fetchVisitorSnapshot() {
  const fallback = { today: "--", total: "----", source: "stable-placeholder" };
  try {
    const response = await fetch("https://visitorbadge.io/status?path=https%3A%2F%2Froyalvice.github.io%2F", {
      headers: { "user-agent": "Royalvice-Profile-GIF-Exporter/1.0" },
      signal: AbortSignal.timeout(12_000)
    });
    if (!response.ok) return fallback;
    const body = await response.text();
    if (/Attention Required|Cloudflare|unable to access/i.test(body)) return fallback;
    const today = body.match(/Today(?:&#x27;|')s Visitors<\/dt>[\s\S]{0,240}?<span[^>]*>([0-9][0-9,]*)<\/span>/i)?.[1];
    const total = body.match(/Total Visitors<\/dt>[\s\S]{0,240}?<span[^>]*>([0-9][0-9,]*)<\/span>/i)?.[1];
    if (!today || !total) return fallback;
    return { today, total, source: "visitorbadge-status" };
  } catch {
    return fallback;
  }
}

function visitorSvg(snapshot) {
  const value = `${snapshot.today} / ${snapshot.total}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="134" height="20" role="img" aria-label="${value}">` +
    `<rect width="134" height="20" fill="#060d09"/><rect x="61" width="73" height="20" fill="#1b6e3a"/>` +
    `<text x="6" y="14" fill="#9df5aa" font-family="monospace" font-size="9">VISITORS</text>` +
    `<text x="67" y="14" fill="#fff" font-family="monospace" font-size="9">${value}</text></svg>`;
}

async function prepareMainPage(browser, options, visitor, diagnostics) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "no-preference"
  });
  await context.addInitScript(() => {
    let randomState = 0x7f4a7c15;
    Math.random = () => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 0x100000000;
    };
    let idleCall = 0;
    window.requestIdleCallback = (callback) => {
      idleCall += 1;
      if (idleCall === 1) return 2_000_000_001;
      return window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0);
    };
    window.cancelIdleCallback = (handle) => window.clearTimeout(handle);
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("ERR_BLOCKED_BY_CLIENT")) errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!/\/assets\/(gallery|voyage|horizon)\//.test(url)) errors.push(`request: ${url} (${request.failure()?.errorText || "failed"})`);
  });
  await page.route(/\/assets\/(gallery|voyage|horizon)\//, (route) => route.abort("blockedbyclient"));
  await page.route("https://api.visitorbadge.io/api/combined?*", (route) => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: visitorSvg(visitor)
  }));
  await page.goto(`${options.baseUrl}/?profile-gif-export=1`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForFunction(() => document.fonts.status === "loaded", null, { timeout: 30_000 });
  await page.waitForFunction(() => window.__profileAdventureDebug?.getState().ready, null, { timeout: 90_000 });
  await page.waitForFunction(() => {
    const state = window.__profileAdventureDebug?.getState();
    return state && Object.values(state.assets.actors).every((value) => value === "ready")
      && state.assets.furniture === "ready"
      && state.assets.door === "ready"
      && state.assets.lamps === "ready"
      && state.assets.posters === "ready";
  }, null, { timeout: 90_000 });
  await page.evaluate(() => {
    document.documentElement.dataset.profileGifExport = "main";
    window.__profileAdventureDebug?.pause();
    const terminal = document.querySelector(".terminal-shell");
    terminal?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    if (terminal instanceof HTMLElement) {
      terminal.dataset.paused = "false";
      terminal.dataset.pauseSource = "";
      const state = terminal.querySelector("[data-terminal-state]");
      const footer = terminal.querySelector("[data-terminal-footer]");
      if (state) state.textContent = "FOLLOW";
      if (footer) footer.textContent = "follow mode · watching deterministic timeline";
    }
    document.getAnimations({ subtree: true }).forEach((animation) => {
      animation.pause();
      animation.currentTime = 0;
    });
  });
  await page.addStyleTag({ content: `
    html[data-profile-gif-export="main"] body { scroll-behavior:auto !important; }
    html[data-profile-gif-export="main"] .profile-reveal { opacity:1 !important; transform:none !important; animation:none !important; }
    html[data-profile-gif-export="main"] .scene:not(#profile),
    html[data-profile-gif-export="main"] .chapter-nav,
    html[data-profile-gif-export="main"] .scene-nav { visibility:hidden !important; }
    html[data-profile-gif-export="main"] .avatar-curtain,
    html[data-profile-gif-export="main"] .spotlight-beam,
    html[data-profile-gif-export="main"] .spotlight-ring,
    html[data-profile-gif-export="main"] .avatar-main,
    html[data-profile-gif-export="main"] .avatar-projection,
    html[data-profile-gif-export="main"] .visitor-signal,
    html[data-profile-gif-export="main"] .terminal-telemetry-rain span,
    html[data-profile-gif-export="main"] .terminal-domain-badge,
    html[data-profile-gif-export="main"] .terminal-output-cursor i { animation-play-state:paused !important; }
    html[data-profile-gif-export="main"] .godot-status.profile-gif-fire .godot-edge-flame:not(.flame-surge),
    html[data-profile-gif-export="main"] .godot-status.profile-gif-fire .godot-sparks { opacity:1; }
    html[data-profile-gif-export="main"] .godot-status.profile-gif-fire .godot-rail::before { animation:temperature-rise 3.2s cubic-bezier(.36,.02,.33,1) forwards; }
    html[data-profile-gif-export="main"] .godot-status.profile-gif-fire .godot-rail { animation:temperature-case 3.2s linear forwards; }
    html[data-profile-gif-export="main"] .godot-status.profile-gif-fire .flame-surge { animation:surge-visible .28s ease-out 3.05s forwards,edge-flame-surge .38s ease-in-out 3.05s infinite alternate; }
    html[data-profile-gif-export="main"] .godot-status.profile-gif-fire .godot-steam i { animation:steam-rise calc(1.55s + var(--steam) * .08s) ease-out infinite; animation-delay:calc(3.15s + var(--steam) * .14s); }
    html[data-profile-gif-export="main"] .godot-status.profile-gif-fire .godot-copy { color:#f4dfb0; background:none; -webkit-text-fill-color:#f4dfb0; -webkit-text-stroke:.25px rgba(31,9,3,.9); text-shadow:0 1px 0 #1b0703,0 0 2px rgba(0,0,0,.95); filter:drop-shadow(0 2px 2px rgba(255,165,45,.3)); }
  ` });
  await mkdir(diagnostics, { recursive: true });
  return { context, page, errors };
}

async function prepareRoomPage(browser, options) {
  const context = await browser.newContext({
    viewport: { width: 720, height: 350 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "no-preference"
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => errors.push(`request: ${request.url()} (${request.failure()?.errorText || "failed"})`));
  await page.goto(`${options.baseUrl}/tools/profile-gif-export/room-harness.html`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForFunction(() => window.__profileRoomGifHarness?.ready, null, { timeout: 90_000 });
  const automaton = await page.evaluate(() => window.__profileRoomGifHarness?.validate());
  return { context, page, errors, automaton };
}

async function resetDirectory(directory) {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
}

async function screenshotElement(page, selector, destination, spec) {
  const locator = page.locator(selector);
  await locator.waitFor({ state: "visible", timeout: 30_000 });
  await locator.evaluate((element, dimensions) => {
    Object.assign(element.style, {
      boxSizing: "border-box",
      width: `${dimensions.width}px`,
      minWidth: `${dimensions.width}px`,
      maxWidth: `${dimensions.width}px`,
      height: `${dimensions.height}px`,
      minHeight: `${dimensions.height}px`,
      maxHeight: `${dimensions.height}px`
    });
  }, { width: spec.width, height: spec.height });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Could not measure ${selector}.`);
  if (box.width < spec.width - 1 || box.height < spec.height - 1) {
    throw new Error(`${selector} is ${box.width}x${box.height}, smaller than ${spec.width}x${spec.height}.`);
  }
  await page.screenshot({
    path: destination,
    animations: "allow",
    caret: "hide",
    scale: "css",
    clip: { x: Math.floor(box.x), y: Math.floor(box.y), width: spec.width, height: spec.height }
  });
}

function framePath(directory, frame) {
  return path.join(directory, `frame-${String(frame).padStart(4, "0")}.png`);
}

async function captureProfileFrames(page, framesDir, spec) {
  let triggered = false;
  let settled = false;
  let settledFrame = null;
  let resultBeforeFire = null;
  for (let frame = 0; frame < spec.frames - 1; frame += 1) {
    const seconds = frame / 24;
    if (!triggered && seconds >= 0.5) {
      await page.locator(".siggraph-lever").click();
      triggered = true;
    }
    if (triggered && !settled && seconds >= 2.58) {
      await page.evaluate(() => {
        const reelAnimation = document.querySelector("[data-siggraph-track]")?.getAnimations()[0];
        if (reelAnimation) reelAnimation.currentTime = 2_050;
      });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));
      settled = true;
      settledFrame = frame;
    }
    await page.evaluate(({ seconds, triggered, settled }) => {
      const machine = document.querySelector("[data-siggraph-machine]");
      const godot = document.querySelector(".godot-status");
      godot?.classList.toggle("profile-gif-fire", seconds >= 4 && seconds < 7.5);
      if (seconds >= 7.5 && machine) {
        machine.classList.remove("is-resolving", "is-pulling", "is-settled", "is-payout");
        machine.dataset.result = "rolling";
        const track = machine.querySelector("[data-siggraph-track]");
        if (track instanceof HTMLElement) track.style.transform = "translate3d(0,0,0)";
      } else if (settled && machine) {
        machine.dataset.result = "3";
        machine.classList.remove("is-resolving", "is-pulling");
        machine.classList.add("is-settled");
        machine.classList.toggle("is-payout", seconds < 3.95);
      }
      const elementForAnimation = (animation) => {
        const target = animation.effect?.target;
        return target instanceof Element ? target : target?.element || target?.parentElement || null;
      };
      document.getAnimations({ subtree: true }).forEach((animation) => {
        const element = elementForAnimation(animation);
        let time = 0;
        if (element?.closest(".slot-coin")) time = Math.max(0, seconds - 2.58) * 1_000;
        else if (element?.closest(".godot-status")) time = Math.max(0, seconds - 4) * 1_000;
        else if (element?.closest("[data-siggraph-machine]")) time = triggered ? Math.max(0, seconds - 0.5) * 1_000 : 0;
        animation.pause();
        try { animation.currentTime = time; } catch {}
      });
    }, { seconds, triggered, settled });
    if (frame === 96) {
      resultBeforeFire = await page.locator("[data-siggraph-machine]").getAttribute("data-result");
      if (resultBeforeFire !== "3") throw new Error(`Slot machine was ${resultBeforeFire || "unset"} when the fire timeline began.`);
    }
    await screenshotElement(page, spec.selector, framePath(framesDir, frame), spec);
    if (frame && frame % 48 === 0) process.stdout.write(`[profile-card] ${frame}/${spec.frames}\n`);
  }
  await copyFile(framePath(framesDir, 0), framePath(framesDir, spec.frames - 1));
  return {
    timeline: "slot-machine-then-godot-fire",
    slotTriggeredFrame: 12,
    slotSettledFrame: settledFrame,
    fireStartFrame: 96,
    resultBeforeFire,
    mainEffectsOverlap: false,
    returnedToInitialFrame: spec.frames - 1
  };
}

async function captureRoomFrames(page, framesDir, spec) {
  for (let frame = 0; frame < spec.frames - 1; frame += 1) {
    await page.evaluate((value) => window.__profileRoomGifHarness?.setFrame(value), frame);
    await screenshotElement(page, spec.selector, framePath(framesDir, frame), spec);
    if (frame && frame % 120 === 0) process.stdout.write(`[sprite-room] ${frame}/${spec.frames}\n`);
  }
  await copyFile(framePath(framesDir, 0), framePath(framesDir, spec.frames - 1));
  return await page.evaluate(() => window.__profileRoomGifHarness?.validate());
}

async function captureNewsFrames(page, framesDir, spec) {
  const expectedOrder = ["thoth-010", "eva01", "eccv-2026", "siggraph-2026", "iccv-2025", "directl-2024", "docdiff-2023"];
  const observedOrder = await page.locator(".terminal-line").evaluateAll((lines) => lines.map((line) => line.getAttribute("data-news-id")));
  if (JSON.stringify(observedOrder) !== JSON.stringify(expectedOrder)) throw new Error(`Terminal news order drifted: ${observedOrder.join(", ")}.`);
  const eventLefts = await page.locator(".terminal-event").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().left));
  const alignmentError = Math.max(...eventLefts) - Math.min(...eventLefts);
  if (alignmentError >= 1) throw new Error(`Accepted/Released event columns differ by ${alignmentError.toFixed(3)}px.`);
  const highlightCounts = Object.fromEntries(expectedOrder.map((id) => [id, 0]));
  let previousIndex = -1;
  let boundaryFrames = 0;

  for (let frame = 0; frame < spec.frames - 1; frame += 1) {
    const seconds = frame / 24;
    const index = seconds > 0 && seconds < 8.4 ? Math.min(6, Math.floor(seconds / 1.2)) : -1;
    const boundary = seconds >= 8.4 && seconds < 9.2;
    if (index >= 0 && index !== previousIndex) highlightCounts[expectedOrder[index]] += 1;
    previousIndex = index;
    if (boundary) boundaryFrames += 1;
    await page.evaluate(({ index, boundary, localTime }) => {
      const shell = document.querySelector(".terminal-shell");
      shell?.classList.toggle("is-ingesting", index >= 0);
      shell?.classList.toggle("is-loop-boundary", boundary);
      shell?.querySelectorAll(".terminal-line").forEach((line, lineIndex) => line.classList.toggle("is-ingesting", lineIndex === index));
      const state = shell?.querySelector("[data-terminal-state]");
      const footer = shell?.querySelector("[data-terminal-footer]");
      if (state) state.textContent = index >= 0 ? "INGEST" : "FOLLOW";
      if (footer) footer.textContent = boundary
        ? "end of news · closing deterministic loop"
        : index >= 0 ? "record signal refreshed" : "follow mode · watching deterministic timeline";
      document.getAnimations({ subtree: true }).forEach((animation) => {
        const target = animation.effect?.target;
        const element = target instanceof Element ? target : target?.parentElement || null;
        animation.pause();
        try {
          animation.currentTime = element?.closest(".terminal-shell")
            ? Math.max(0, localTime) * 1_000
            : 0;
        } catch {}
      });
    }, { index, boundary, localTime: index >= 0 ? seconds - index * 1.2 : boundary ? seconds - 8.4 : 0 });
    await screenshotElement(page, spec.selector, framePath(framesDir, frame), spec);
    if (frame && frame % 48 === 0) process.stdout.write(`[news-terminal] ${frame}/${spec.frames}\n`);
  }
  await copyFile(framePath(framesDir, 0), framePath(framesDir, spec.frames - 1));
  if (Object.values(highlightCounts).some((count) => count !== 1)) throw new Error(`Terminal highlight counts invalid: ${JSON.stringify(highlightCounts)}.`);
  return { expectedOrder, observedOrder, highlightCounts, boundaryFrames, eventColumnAlignmentError: alignmentError };
}

async function makeContactSheet(framesDir, diagnosticsDir, spec) {
  const keyDir = path.join(diagnosticsDir, `${spec.id}-keyframes`);
  await resetDirectory(keyDir);
  for (const [index, frame] of spec.keyframes.entries()) {
    await copyFile(framePath(framesDir, frame), path.join(keyDir, `key-${String(index).padStart(2, "0")}-frame-${String(frame).padStart(4, "0")}.png`));
  }
  const contact = path.join(diagnosticsDir, `${spec.id}-contact-sheet.png`);
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-framerate", "1", "-pattern_type", "glob", "-i", path.join(keyDir, "key-*.png"),
    "-vf", "scale=292:-1:flags=neighbor,tile=3x3:padding=4:margin=4:color=#07100e",
    "-frames:v", "1", contact
  ]);
  return {
    contactSheet: `diagnostics/${path.basename(contact)}`,
    keyframeDirectory: `diagnostics/${path.basename(keyDir)}`,
    keyframes: spec.keyframes
  };
}

async function encodeGif(framesDir, output, spec, options) {
  const attempts = [128, 96, 80];
  const encodingAttempts = [];
  for (const colors of attempts) {
    const palette = path.join(framesDir, `palette-${colors}.png`);
    const temporary = `${output}.${colors}.tmp.gif`;
    await run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-framerate", String(options.fps), "-i", path.join(framesDir, "frame-%04d.png"),
      "-vf", `palettegen=max_colors=${colors}:reserve_transparent=0:stats_mode=diff`,
      palette
    ]);
    await run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-framerate", String(options.fps), "-i", path.join(framesDir, "frame-%04d.png"),
      "-i", palette,
      "-lavfi", "paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
      "-loop", "0", temporary
    ]);
    const bytes = (await stat(temporary)).size;
    encodingAttempts.push({ colors, bytes });
    if (bytes <= options.maxBytes) {
      await rm(output, { force: true });
      await rename(temporary, output);
      for (const attempt of attempts) if (attempt !== colors) await rm(`${output}.${attempt}.tmp.gif`, { force: true });
      return { colors, bytes, attempts: encodingAttempts };
    }
    await rm(temporary, { force: true });
  }
  throw new Error(`${spec.file} exceeds ${options.maxBytes} bytes after the 80-color profile: ${JSON.stringify(encodingAttempts)}.`);
}

async function probeGif(file) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-count_frames", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,avg_frame_rate,nb_read_frames,duration:format=duration,size",
    "-of", "json", file
  ], { capture: true });
  return JSON.parse(stdout.toString());
}

async function decodedPixelHash(file, frame) {
  const escaped = `select=eq(n\\,${frame})`;
  const { stdout } = await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-i", file,
    "-vf", escaped, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"
  ], { capture: true });
  if (!stdout.length) throw new Error(`Could not decode frame ${frame} from ${file}.`);
  return sha256(stdout);
}

async function verifyEncodedGif(file, spec, options) {
  const probe = await probeGif(file);
  const stream = probe.streams?.[0] || {};
  const frameCount = Number(stream.nb_read_frames);
  const duration = Number(stream.duration || probe.format?.duration);
  const bytes = Number(probe.format?.size || (await stat(file)).size);
  const effectiveFps = frameCount / duration;
  if (Number(stream.width) !== spec.width || Number(stream.height) !== spec.height) throw new Error(`${spec.file} is ${stream.width}x${stream.height}; expected ${spec.width}x${spec.height}.`);
  if (frameCount !== spec.frames) throw new Error(`${spec.file} has ${frameCount} frames; expected ${spec.frames}.`);
  if (Math.abs(duration - spec.duration) > 0.03) throw new Error(`${spec.file} duration is ${duration}; expected ${spec.duration}.`);
  if (Math.abs(effectiveFps - options.fps) > 0.08) throw new Error(`${spec.file} effective fps is ${effectiveFps}; expected ${options.fps}.`);
  if (bytes > options.maxBytes) throw new Error(`${spec.file} is ${bytes} bytes, over ${options.maxBytes}.`);
  const firstPixelSha256 = await decodedPixelHash(file, 0);
  const lastPixelSha256 = await decodedPixelHash(file, spec.frames - 1);
  if (firstPixelSha256 !== lastPixelSha256) throw new Error(`${spec.file} decoded first/last pixels do not match.`);
  return { probe, frameCount, duration, effectiveFps, bytes, firstPixelSha256, lastPixelSha256, sha256: await fileSha256(file) };
}

async function exportCard(key, browser, mainPage, options, directories, visitor) {
  const spec = CARD_SPECS[key];
  const framesDir = path.join(directories.working, spec.id);
  await resetDirectory(framesDir);
  let page = mainPage.page;
  let context = null;
  let errors = mainPage.errors;
  let semantic;
  if (key === "room") {
    const roomPage = await prepareRoomPage(browser, options);
    page = roomPage.page;
    context = roomPage.context;
    errors = roomPage.errors;
    semantic = roomPage.automaton;
  }

  process.stdout.write(`Capturing ${spec.id}: ${spec.frames} frames at ${options.fps}fps...\n`);
  if (key === "profile") semantic = await captureProfileFrames(page, framesDir, spec);
  if (key === "room") semantic = await captureRoomFrames(page, framesDir, spec);
  if (key === "news") semantic = await captureNewsFrames(page, framesDir, spec);
  if (errors.length) throw new Error(`${spec.id} browser errors:\n${errors.join("\n")}`);

  const diagnostics = await makeContactSheet(framesDir, directories.diagnostics, spec);
  const output = path.join(options.outDir, spec.file);
  const encoding = await encodeGif(framesDir, output, spec, options);
  const verification = await verifyEncodedGif(output, spec, options);
  await context?.close();
  await rm(framesDir, { recursive: true, force: true });
  return {
    id: spec.id,
    file: spec.file,
    width: spec.width,
    height: spec.height,
    fps: options.fps,
    frames: spec.frames,
    duration: spec.duration,
    maxBytes: options.maxBytes,
    visitor: key === "profile" ? visitor : undefined,
    semantic,
    diagnostics,
    encoding,
    verification
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const directories = {
    working: path.join(options.outDir, ".work"),
    diagnostics: path.join(options.outDir, "diagnostics")
  };
  await mkdir(options.outDir, { recursive: true });
  await resetDirectory(directories.working);
  await resetDirectory(directories.diagnostics);
  const visitor = await fetchVisitorSnapshot();
  process.stdout.write(`Visitor snapshot: ${visitor.today} / ${visitor.total} (${visitor.source})\n`);

  const browser = await chromium.launch({ headless: true });
  const mainPage = await prepareMainPage(browser, options, visitor, directories.diagnostics);
  const requested = options.only === "all" ? ["profile", "room", "news"] : [options.only];
  const cards = [];
  try {
    for (const key of requested) cards.push(await exportCard(key, browser, mainPage, options, directories, visitor));
  } finally {
    await mainPage.context.close();
    await browser.close();
    await rm(directories.working, { recursive: true, force: true });
  }

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceCommit: process.env.GITHUB_SHA || (await run("git", ["rev-parse", "HEAD"], { capture: true })).stdout.toString().trim(),
    baseUrl: options.baseUrl,
    publication: { width: options.width, fps: options.fps, maxBytes: options.maxBytes, order: ["profile-card", "news-terminal", "sprite-room"] },
    visitor,
    cards
  };
  await writeFile(path.join(options.outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ output: options.outDir, cards: cards.map((card) => ({ file: card.file, bytes: card.verification.bytes, sha256: card.verification.sha256 })) }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
