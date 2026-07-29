#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BASE_URL = process.env.GAME_SERVICE_URL || "http://180.76.242.105:2201";
const RUN_ID = process.env.PROFILE_ROOM_V3_RUN || "2026-07-17-living-r1";
const ROUND = process.env.PROFILE_ROOM_V3_ROUND || "r1";
const OUT_DIR = path.resolve(ROOT, process.env.PROFILE_ROOM_V3_OUT || `artifacts/profile-room-v3-review/${RUN_ID}`);
const OLD_REVIEW = path.join(ROOT, "artifacts/profile-sprite-review/2026-07-17-topdown-r1");

const actorSpecs = {
  nobita: {
    identity: "Nobita Nobi, the same slim Japanese schoolboy from the identity reference: child proportions, large round black glasses, short black hair, yellow short-sleeve polo, navy shorts, white socks and pale blue shoes",
    key: "#00FF00"
  },
  doraemon: {
    identity: "Doraemon, the same round blue-and-white robotic cat from the identity reference: no ears, one red nose, white muzzle and belly, red collar, small gold bell, short round limbs and white feet",
    key: "#00FF00"
  },
  shizuka: {
    identity: "Shizuka Minamoto, the same Japanese schoolgirl from the identity reference: child proportions, black hair in two short low pigtails, pink-and-white outfit, white socks and red shoes",
    key: "#00FFFF"
  },
  gian: {
    identity: "Takeshi Gian Goda, the same unmistakably broad stocky Japanese schoolboy from the identity reference: child proportions, square jaw, large cheeks, short black hair, thick eyebrows, orange top with dark middle stripe, blue trousers and pale blue shoes; never an adult and never slim",
    key: "#00FF00"
  },
  suneo: {
    identity: "Suneo Honekawa, the same very small slim Japanese schoolboy from the identity reference: long flat black hair wedge projecting horizontally to screen-right with two sharp prongs, narrow side-facing wedge face, pointed mouth and nose, large vertical oval eyes, green checkered shirt, orange-brown shorts, white socks and green shoes; never generic symmetric spiky hair",
    key: "#FF00FF"
  }
};

const officialSource = (id) => {
  const clean = path.join(OLD_REVIEW, "sources", `${id}-official-clean.png`);
  const full = path.join(OLD_REVIEW, "sources", `${id}-official.png`);
  return fs.access(clean).then(() => clean).catch(() => full);
};

const sheetReference = (id) => path.join(OLD_REVIEW, "final-contact-sheets", `${id}-3x3.png`);

async function tokenFromEnvironmentOrPrompt() {
  if (process.env.GAME_SERVICE_TOKEN) return process.env.GAME_SERVICE_TOKEN;
  const terminal = readline.createInterface({ input, output, terminal: true });
  const token = await terminal.question("GAME_SERVICE_TOKEN (not persisted): ");
  terminal.close();
  if (!token.trim()) throw new Error("GAME_SERVICE_TOKEN is required.");
  return token.trim();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 1200)}`);
  return JSON.parse(body);
}

async function poll(token, jobId) {
  const started = Date.now();
  for (;;) {
    const job = await requestJson(`${BASE_URL}/v1/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    process.stdout.write(`\r${jobId} ${job.state || job.current_stage || "queued"}          `);
    if (["succeeded", "failed", "cancelled"].includes(job.state)) {
      process.stdout.write("\n");
      if (job.state !== "succeeded") throw new Error(`${jobId}: ${job.error || job.state}`);
      return job;
    }
    if (Date.now() - started > 1_250_000) throw new Error(`${jobId} timed out.`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function downloadArtifact(token, job, destination) {
  const artifact = (job.artifacts || []).find((entry) => /\.(png|webp|jpe?g)$/i.test(entry.filename));
  if (!artifact) throw new Error(`No image artifact returned for ${job.job_id}`);
  const url = artifact.url.startsWith("http") ? artifact.url : `${BASE_URL}${artifact.url}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Artifact download failed: ${response.status}`);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
  await fs.writeFile(destination.replace(/\.[^.]+$/, ".job.json"), `${JSON.stringify(job, null, 2)}\n`);
}

async function submit(token, request, references, destination) {
  try {
    await fs.access(destination);
    console.log(`reuse ${path.relative(ROOT, destination)}`);
    return;
  } catch {
    // Generate only missing candidates so an interrupted review can resume.
  }
  const form = new FormData();
  form.set("request", JSON.stringify({
    num_steps: 4,
    guidance: 1,
    prompt_upsampling: false,
    format: "png",
    num_images: 1,
    ...request
  }));
  for (const reference of references) {
    const bytes = await fs.readFile(reference);
    form.append("images", new Blob([bytes], { type: "image/png" }), path.basename(reference));
  }
  const queued = await requestJson(`${BASE_URL}/v1/flux2/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  console.log(`submitted ${queued.job_id} -> ${path.basename(destination)}`);
  await downloadArtifact(token, await poll(token, queued.job_id), destination);
}

const commonActorSheet = (key) => `A production-ready top-down pixel game sprite sheet. Exactly one character repeated exactly nine times in an exact 3 by 3 layout with nine equal invisible cells. Approximately seventy-degree high three-quarter overhead view, compact readable silhouette, visible top of the head, shoulders and feet, consistent scale and foot pivot. Crisp deliberate pixel clusters, dark one-to-two-pixel outline at final game resolution, limited palette, warm upper-left room light. Preserve the exact same identity, face, body proportions, clothing and colors in every cell. The character wears absolutely no crown, tiara, hat, head ornament or royal accessory; ignore and remove any such accidental item from a reference. Perfectly flat solid ${key} chroma-key background. No floor, no cast shadow, no scenery, no furniture, no text, no labels, no grid lines, no card frame, no logo, no watermark, no cropped head or feet, no overlap between cells, no extra people, no duplicated limbs.`;

const movementPrompt = (actor) => `${commonActorSheet(actor.key)} Use image one as canonical identity and image two as the already approved pixel rendering reference. Subject: ${actor.identity}. The character walks with the same small natural stride in all cells. Exact reading order: row one contains three walk-down frames facing toward the lower edge (left foot contact, passing pose, right foot contact); row two contains three walk-side frames facing screen-right (left foot contact, passing pose, right foot contact); row three contains three walk-up frames facing away toward the top edge (left foot contact, passing pose, right foot contact). The top/down/side directions must be unmistakable at thumbnail size. No props.`;

const lifePrompt = (actor) => `${commonActorSheet(actor.key)} Use image one as canonical identity and image two as the already approved pixel rendering reference. Subject: ${actor.identity}. Exact reading order: thinking pose A with hand near chin; thinking pose B with a small idea reaction; drinking from a tiny paper cup A; drinking from a tiny paper cup B; sitting and playing a video game A; sitting and playing a video game B; stepping into an unseen portal while facing screen-right; returning from an unseen portal while facing screen-left; surprised room reaction. Only the tiny cup or game controller may appear. No portal, chair or furniture is drawn in the cells. Sitting poses must share the same seat baseline.`;

const furniturePrompt = `Production-ready top-down pixel-art furniture atlas for a warm cinematic research dungeon room. Exactly nine separate objects in an exact three-by-three arrangement with equal invisible cells. Approximately seventy-degree high three-quarter overhead view, walnut wood, aged dark copper, teal stone accents, warm upper-left lantern light, crisp deliberate pixel clusters, one-to-two-pixel dark outline, limited palette matching a premium pixel roguelite room. Exact reading order: ornate hanging chandelier seen from above; wide classroom blackboard with wooden frame; small blackboard eraser; compact second research desk with papers; matching wooden chair; deep teal two-seat sofa; retro water cooler with translucent blue bottle; CRT television integrated into a low walnut TV cabinet; white modern game console resembling a PS5 with black center. Perfectly flat solid #00FF00 chroma-key background. No room, no floor, no cast shadows, no people, no text, no labels, no grid lines, no border, no logo, no watermark, no overlap, no cropped objects.`;

const doorPrompt = `Production-ready top-down pixel-art two-frame sprite strip of one freestanding pink Anywhere Door for a warm cinematic research dungeon. Exactly two equal invisible cells in one horizontal row. Left cell: fully closed pink enamel door with dark copper hinges and brass handle. Right cell: fully open door at the same position and scale, showing a luminous pearly cyan interior and the visible angled door leaf. Approximately seventy-degree high three-quarter overhead view, warm upper-left light, crisp deliberate pixel clusters, one-to-two-pixel dark outline, limited palette. Perfectly flat solid #00FF00 chroma-key background. No room, no floor, no cast shadow, no people, no third state, no text, no labels, no divider, no border, no logo, no watermark, no cropping.`;

const lampPrompt = `Production-ready top-down pixel-art four-frame sprite strip of one antique wall-mounted fuel lamp for a dark research dungeon. Exactly four equal invisible cells in one horizontal row. Same dark copper lamp and glass reservoir in every cell. Flame sequence: low flame, flame leaning left, tall bright flame, flame leaning right. Approximately seventy-degree high three-quarter overhead view, warm amber fire, crisp deliberate pixel clusters, one-to-two-pixel outline, limited palette. Perfectly flat solid #00FF00 chroma-key background. No wall, no room, no cast shadow, no text, no labels, no dividers, no border, no logo, no watermark, no cropping.`;

async function main() {
  await fs.mkdir(path.join(OUT_DIR, "candidates"), { recursive: true });
  const spec = await requestJson(`${BASE_URL}/v1/spec.json`);
  await fs.writeFile(path.join(OUT_DIR, "service-spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
  const token = await tokenFromEnvironmentOrPrompt();
  const prompts = { actors: {}, furniture: furniturePrompt, door: doorPrompt, lamps: lampPrompt };
  const only = new Set((process.env.PROFILE_ROOM_V3_ONLY || "").split(",").map((value) => value.trim()).filter(Boolean));
  const enabled = (id) => only.size === 0 || only.has(id);

  let index = 0;
  for (const [id, actor] of Object.entries(actorSpecs)) {
    const identity = await officialSource(id);
    const approved = sheetReference(id);
    prompts.actors[id] = { movement: movementPrompt(actor), life: lifePrompt(actor) };
    if (enabled(`${id}-movement`) || enabled(id)) {
      await submit(token, {
        mode: "i2i",
        prompt: prompts.actors[id].movement,
        width: 1024,
        height: 1024,
        seed: 81100 + index * 31
      }, [identity, approved], path.join(OUT_DIR, "candidates", `${id}-movement-${ROUND}.png`));
    }
    if (enabled(`${id}-life`) || enabled(id)) {
      await submit(token, {
        mode: "i2i",
        prompt: prompts.actors[id].life,
        width: 1024,
        height: 1024,
        seed: 82100 + index * 37
      }, [identity, approved], path.join(OUT_DIR, "candidates", `${id}-life-${ROUND}.png`));
    }
    index += 1;
  }

  if (enabled("furniture")) {
    await submit(token, { mode: "t2i", prompt: furniturePrompt, width: 1024, height: 1024, seed: ROUND === "r1" ? 83117 : 84117 }, [], path.join(OUT_DIR, "candidates", `furniture-${ROUND}.png`));
  }
  if (enabled("door")) {
    await submit(token, { mode: "t2i", prompt: doorPrompt, width: 1024, height: 1024, seed: ROUND === "r1" ? 83129 : 84129 }, [], path.join(OUT_DIR, "candidates", `anywhere-door-${ROUND}.png`));
  }
  if (enabled("lamps")) {
    await submit(token, { mode: "t2i", prompt: lampPrompt, width: 1024, height: 1024, seed: ROUND === "r1" ? 83143 : 84143 }, [], path.join(OUT_DIR, "candidates", `fuel-lamp-${ROUND}.png`));
  }
  await fs.writeFile(path.join(OUT_DIR, "prompts.json"), `${JSON.stringify(prompts, null, 2)}\n`);
  console.log(`Flux room-v3 candidates saved under ${path.relative(ROOT, OUT_DIR)}`);
}

await main();
