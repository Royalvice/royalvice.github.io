#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BASE_URL = process.env.GAME_SERVICE_URL || "http://180.76.242.105:2201";
const RUN = path.join(ROOT, "artifacts/profile-room-grounded-v4-review/2026-07-17-grounded-r1");
const REFERENCES = path.join(RUN, "references");
const GUIDES = path.join(RUN, "guides");
const CANDIDATES = path.join(RUN, "candidates");
const ROOM_SCREENSHOT = "/var/folders/bh/9kgdlh4s5ddbf29f4qfpsjsw0000gn/T/paseo-attachments-kDYqV8/cfa734d49982f5511f21495daf63565e13ab39ea4e0506895cfe3ac6dd636a89.png";

const base = `Use case: style-transfer. Asset type: production pixel-game furniture sprite. Input image one is the current object and controls material language. Input image two is a strict axis-and-silhouette guide and controls geometry, alignment and orientation. Input image three is the current room screenshot and controls only palette, pixel density and upper-left warm lighting. Create exactly one isolated object centered with generous padding on a perfectly flat solid #00FF00 chroma-key background. Crisp deliberate pixel clusters, one-to-two-pixel dark outline at final 128px game scale, limited warm walnut, aged copper, deep teal and amber palette. No room, floor, cast shadow, text, label, border, grid, watermark, extra object or cropping. Do not copy the geometric tilt of input image one when it conflicts with input image two.`;

const prompts = {
  blackboard: `${base} A wide front-facing classroom blackboard fixed to a vertical wall. Top and bottom edges are perfectly horizontal; left and right edges perfectly vertical; maximum edge drift one final pixel. Walnut and dark-copper frame, deep teal-black writing surface, shallow lower chalk tray. No perspective skew, no diagonal outer edge, no detached eraser.`,
  desk: `${base} A compact high-overhead research desk whose long front and rear edges are perfectly horizontal and parallel to the room tile grid. Restrained top-down depth only, symmetrical grounded legs touching one shared baseline, walnut construction, papers and one small teal research instrument on the top. No diagonal placement, no three-quarter rotation, no floating feet.`,
  chair: `${base} One matching walnut research chair aligned straight north-south to the desk, high-overhead view, centered backrest, centered seat, two readable front legs sharing one baseline. No diagonal rotation and no cast shadow.`,
  sofa: `${base} A deep-teal two-seat sofa seen from high overhead and facing north toward a television located above it. Show the rear/top of the backrest as one horizontal bar along the lower/south edge; place both seat cushions above/north of that bar. The viewer must not see a front-facing upright pair of back cushions. Symmetric arms, short grounded feet, exact horizontal axis. It must read as an upward-facing gameplay sprite, never as a furniture catalog front view.`,
  "tv-cabinet": `${base} A front-aligned CRT television integrated into a low horizontal walnut cabinet and facing south. The CRT bezel is thick, symmetric and level. The screen aperture is a perfectly rectangular #00FF00 opening with a clear continuous bezel around all four sides so a live game can be drawn behind it. Cabinet feet share one baseline. Include a stable flat cabinet-top area on the right for a separate game console, but do not draw the console. No perspective skew.`,
  "bulkhead-lamp": `${base} A bunker bulkhead wall lamp, front-facing and vertically mounted: dark-copper rear wall plate, short top hook, protective copper cage, amber glass and compact flame. It must unmistakably hang on a wall, not stand on a table or floor. Same strict centered silhouette.`
};

async function token() {
  if (process.env.GAME_SERVICE_TOKEN) return process.env.GAME_SERVICE_TOKEN;
  const terminal = readline.createInterface({ input, output, terminal: true });
  const answer = await terminal.question("GAME_SERVICE_TOKEN (not persisted): ");
  terminal.close();
  if (!answer.trim()) throw new Error("GAME_SERVICE_TOKEN is required");
  return answer.trim();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 1000)}`);
  return JSON.parse(body);
}

async function poll(auth, jobId) {
  const start = Date.now();
  for (;;) {
    const job = await requestJson(`${BASE_URL}/v1/jobs/${jobId}`, { headers: { Authorization: `Bearer ${auth}` } });
    process.stdout.write(`\r${jobId} ${job.state || job.current_stage || "queued"}        `);
    if (["succeeded", "failed", "cancelled"].includes(job.state)) {
      process.stdout.write("\n");
      if (job.state !== "succeeded") throw new Error(`${jobId}: ${job.error || job.state}`);
      return job;
    }
    if (Date.now() - start > 1_250_000) throw new Error(`${jobId} timed out`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function submit(auth, id, variant, seed) {
  const destination = path.join(CANDIDATES, `${id}-${variant}.png`);
  try {
    await fs.access(destination);
    console.log(`reuse ${path.relative(ROOT, destination)}`);
    return;
  } catch { /* generate missing files only */ }
  const form = new FormData();
  form.set("request", JSON.stringify({
    mode: "i2i", prompt: prompts[id], width: 1024, height: 1024, seed,
    num_steps: 4, guidance: 1, prompt_upsampling: false, format: "png", num_images: 1
  }));
  for (const reference of [
    path.join(REFERENCES, `${id}-current.png`),
    path.join(GUIDES, `${id}-axis-guide.png`),
    ROOM_SCREENSHOT
  ]) {
    const bytes = await fs.readFile(reference);
    form.append("images", new Blob([bytes], { type: "image/png" }), path.basename(reference));
  }
  const queued = await requestJson(`${BASE_URL}/v1/flux2/jobs`, {
    method: "POST", headers: { Authorization: `Bearer ${auth}` }, body: form
  });
  console.log(`submitted ${queued.job_id} -> ${id}-${variant}.png`);
  const job = await poll(auth, queued.job_id);
  const artifact = (job.artifacts || []).find((entry) => /\.(png|webp|jpe?g)$/i.test(entry.filename));
  if (!artifact) throw new Error(`No image artifact for ${job.job_id}`);
  const url = artifact.url.startsWith("http") ? artifact.url : `${BASE_URL}${artifact.url}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${auth}` } });
  if (!response.ok) throw new Error(`Artifact download failed: ${response.status}`);
  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
  await fs.writeFile(destination.replace(/\.png$/, ".job.json"), `${JSON.stringify(job, null, 2)}\n`);
}

async function main() {
  await fs.mkdir(CANDIDATES, { recursive: true });
  const spec = await requestJson(`${BASE_URL}/v1/spec.json`);
  await fs.writeFile(path.join(RUN, "service-spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
  await fs.writeFile(path.join(RUN, "prompts.json"), `${JSON.stringify(prompts, null, 2)}\n`);
  const auth = await token();
  const only = new Set((process.env.PROFILE_ROOM_V4_ONLY || "").split(",").map((value) => value.trim()).filter(Boolean));
  const variantNames = (process.env.PROFILE_ROOM_V4_VARIANTS || "a,b").split(",").map((value) => value.trim()).filter(Boolean);
  let offset = 0;
  for (const id of Object.keys(prompts)) {
    if (only.size && !only.has(id)) continue;
    for (let variantIndex = 0; variantIndex < variantNames.length; variantIndex += 1) {
      await submit(auth, id, variantNames[variantIndex], 96137 + offset * 59 + variantIndex * 101);
    }
    offset += 1;
  }
}

await main();
