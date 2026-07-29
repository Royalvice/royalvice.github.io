#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const BASE_URL = process.env.GAME_SERVICE_URL || "http://180.76.242.105:2201";
const OUT_DIR = process.env.PROFILE_ADVENTURE_OUT || "/private/tmp/royalvice-profile-adventure-generation";
const TPOSE = "/private/tmp/royalvice-nobita-tpose-pixel-final-white.png";

const mode = process.argv.includes("--trellis-1024")
  ? "trellis-1024"
  : process.argv.includes("--trellis-preview")
    ? "trellis-preview"
    : process.argv.includes("--all")
      ? "all"
      : process.argv.includes("--canonicals") ? "canonicals" : "pilot";

async function token() {
  if (process.env.GAME_SERVICE_TOKEN) return process.env.GAME_SERVICE_TOKEN;
  const terminal = readline.createInterface({ input, output, terminal: true });
  const value = await terminal.question("GAME_SERVICE_TOKEN (input is not persisted): ");
  terminal.close();
  if (!value.trim()) throw new Error("GAME_SERVICE_TOKEN is required.");
  return value.trim();
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 1000)}`);
  return JSON.parse(text);
}

async function poll(auth, jobId, timeoutMs = 1_200_000) {
  const started = Date.now();
  for (;;) {
    const job = await requestJson(`${BASE_URL}/v1/jobs/${jobId}`, { headers: { Authorization: `Bearer ${auth}` } });
    process.stdout.write(`\r${jobId} ${job.state || job.current_stage || "queued"}      `);
    if (["succeeded", "failed", "cancelled"].includes(job.state)) {
      process.stdout.write("\n");
      if (job.state !== "succeeded") throw new Error(`${jobId} failed: ${job.error || job.state}`);
      return job;
    }
    if (Date.now() - started > timeoutMs) throw new Error(`${jobId} timed out.`);
    await new Promise((resolve) => setTimeout(resolve, 1400));
  }
}

async function download(auth, job, filename) {
  const artifact = job.artifacts.find((item) => item.filename === filename)
    || job.artifacts.find((item) => /\.(png|webp|jpe?g)$/i.test(item.filename));
  if (!artifact) throw new Error(`No image artifact returned for ${job.job_id}`);
  const url = artifact.url.startsWith("http") ? artifact.url : `${BASE_URL}${artifact.url}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${auth}` } });
  if (!response.ok) throw new Error(`Artifact download failed: ${response.status}`);
  const destination = path.join(OUT_DIR, filename);
  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
  await fs.writeFile(path.join(OUT_DIR, `${path.parse(filename).name}.job.json`), `${JSON.stringify(job, null, 2)}\n`);
  return destination;
}

async function downloadAll(auth, job, directory) {
  await fs.mkdir(directory, { recursive: true });
  for (const artifact of job.artifacts || []) {
    const url = artifact.url.startsWith("http") ? artifact.url : `${BASE_URL}${artifact.url}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${auth}` } });
    if (!response.ok) throw new Error(`Artifact download failed: ${response.status}`);
    await fs.writeFile(path.join(directory, artifact.filename), Buffer.from(await response.arrayBuffer()));
  }
  await fs.writeFile(path.join(directory, "job.json"), `${JSON.stringify(job, null, 2)}\n`);
}

async function trellis(auth, resolution) {
  const form = new FormData();
  form.set("request", JSON.stringify({
    resolution,
    seed: 42601,
    decimation_target: resolution === "512" ? 120000 : 60000,
    texture_size: resolution === "512" ? 1024 : 2048,
    include_mp4: true,
    video_resolution: 768,
    num_frames: 90,
    fps: 15
  }));
  const bytes = await fs.readFile(TPOSE);
  form.append("image", new Blob([bytes], { type: "image/png" }), path.basename(TPOSE));
  const submitted = await requestJson(`${BASE_URL}/v1/trellis2/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth}` },
    body: form
  });
  console.log(`submitted ${submitted.job_id} → TRELLIS2 ${resolution}`);
  const job = await poll(auth, submitted.job_id, 1_800_000);
  const directory = path.join(OUT_DIR, `trellis-${resolution}`);
  await downloadAll(auth, job, directory);
  console.log(`TRELLIS2 artifacts saved under ${directory}`);
}

async function flux(auth, request, filename, references = []) {
  const existing = path.join(OUT_DIR, filename);
  try {
    await fs.access(existing);
    console.log(`reuse ${existing}`);
    return existing;
  } catch {
    // Generate only assets that are not already present. Use a clean output
    // directory when deliberate regeneration with new seeds is required.
  }
  const form = new FormData();
  form.set("request", JSON.stringify({
    num_steps: 4,
    guidance: 1.0,
    prompt_upsampling: false,
    ...request
  }));
  for (const reference of references) {
    const bytes = await fs.readFile(reference);
    form.append("images", new Blob([bytes], { type: "image/png" }), path.basename(reference));
  }
  const submitted = await requestJson(`${BASE_URL}/v1/flux2/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth}` },
    body: form
  });
  console.log(`submitted ${submitted.job_id} → ${filename}`);
  const job = await poll(auth, submitted.job_id);
  return download(auth, job, filename);
}

const qualityContract = `Cinematic hyper-detailed pixel art sprite production asset, authentic classic Japanese family animation character identity, physically plausible fabric and skin shading translated into deliberate 2D pixels, coherent 3/4 front view, crisp 2-pixel contour, exact stable proportions and clothing across every frame. Flat chroma key background exactly #00FF00. No floor, no cast shadow, no reflection, no gradient, no text, no logo, no border, no frame dividers, no scenery, no cropped head or feet.`;

const nobitaStrip = `${qualityContract} A single horizontal four-frame sprite strip with four equal cells and generous empty chroma space between poses. Only Nobita Nobi appears, exactly once per cell: short slim Japanese schoolboy, large round black glasses, black bowl-cut hair, yellow polo shirt with white collar, navy blue shorts, white socks, pale blue shoes. Cell 1 relaxed idle. Cell 2 energetic run cycle contact pose. Cell 3 skidding brake and stumble. Cell 4 joyful victory with both arms raised. Identical face, glasses, hair, clothing, pixel density, scale and lighting in all four cells.`;

const actorSpecs = {
  doraemon: {
    canonical: "Doraemon, round blue robotic cat, white face and belly, red nose, red collar with gold bell, no ears, short white paws and feet",
    actions: "relaxed idle; walking turn; searching the four-dimensional belly pocket; joyful cheer with raised paws"
  },
  shizuka: {
    canonical: "Shizuka Minamoto, slim Japanese schoolgirl, straight dark brown twin-tail hair, pink long-sleeve dress with white collar, white socks, red shoes",
    actions: "relaxed idle; friendly wave; happy clapping; surprised reaction with hands near face"
  },
  gian: {
    canonical: "Takeshi Gian Goda, tall stocky Japanese schoolboy, short black hair, orange sweater with pale center stripe, dark trousers, sturdy shoes",
    actions: "arms-crossed idle; broad laugh; forceful stomp; victory fist raised"
  },
  suneo: {
    canonical: "Suneo Honekawa, short slim Japanese schoolboy, distinctive pointed black hair and fox-like face, green polo shirt, tan shorts, white socks, dark shoes",
    actions: "relaxed idle; pointing sideways; smug smirk; comic recoil"
  }
};

async function generatePilot(auth) {
  await flux(auth, {
    mode: "t2i",
    prompt: nobitaStrip,
    width: 1360,
    height: 768,
    seed: 41701
  }, "nobita-strip-t2i.png");
  await flux(auth, {
    mode: "i2i",
    prompt: `${nobitaStrip} Preserve the supplied canonical character identity and clothing exactly; reinterpret the white reference background as exact #00FF00 chroma key.`,
    width: 1360,
    height: 768,
    seed: 41701
  }, "nobita-strip-i2i.png", [TPOSE]);
}

async function generateCanonicals(auth) {
  for (const [id, specification] of Object.entries(actorSpecs)) {
    await flux(auth, {
      mode: "t2i",
      prompt: `${qualityContract} One centered full-body canonical character only: ${specification.canonical}. Neutral relaxed A-pose, both arms slightly away from torso, front-facing with a subtle three-quarter turn, complete silhouette with empty green margin around every edge.`,
      width: 1024,
      height: 1024,
      seed: 41800 + Object.keys(actorSpecs).indexOf(id)
    }, `${id}-canonical.png`);
  }
  await flux(auth, {
    mode: "t2i",
    prompt: `${qualityContract} One centered full-body iconic pink Anywhere Door as a freestanding physical prop, closed state, glossy pink enamel frame and door leaf, small round golden handle, straight front three-quarter view, complete silhouette and empty green margin.`,
    width: 1024,
    height: 1024,
    seed: 41890
  }, "anywhere-door-canonical.png");
}

async function generateAll(auth) {
  await generatePilot(auth);
  await generateCanonicals(auth);
  for (const [id, specification] of Object.entries(actorSpecs)) {
    const reference = path.join(OUT_DIR, `${id}-canonical.png`);
    await flux(auth, {
      mode: "i2i",
      prompt: `${qualityContract} A single horizontal four-frame sprite strip with four equal cells and generous empty chroma space between poses. Only the exact supplied canonical ${specification.canonical} appears once in each cell. Four actions from left to right: ${specification.actions}. Preserve identical face, body proportions, clothing, colors, pixel density, scale and lighting in all cells.`,
      width: 1360,
      height: 768,
      seed: 41900 + Object.keys(actorSpecs).indexOf(id)
    }, `${id}-strip-i2i.png`, [reference]);
  }
  await flux(auth, {
    mode: "t2i",
    prompt: `${qualityContract} One horizontal four-item prop sheet, each iconic gadget appears once with generous green separation and identical pixel density: bamboo copter with yellow rotor and blue head mount; gray-blue air cannon cylinder with open muzzle; red four-dimensional pocket with white interior; compact shrink light torch emitting no beam. Centered complete silhouettes, no hands, no characters.`,
    width: 1360,
    height: 768,
    seed: 41980
  }, "adventure-props.png");
}

await fs.mkdir(OUT_DIR, { recursive: true });
const auth = await token();
const spec = await requestJson(`${BASE_URL}/v1/spec.json`);
await fs.writeFile(path.join(OUT_DIR, "service-spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
if (mode === "trellis-1024") await trellis(auth, "1024_cascade");
else if (mode === "trellis-preview") await trellis(auth, "512");
else if (mode === "all") await generateAll(auth);
else if (mode === "canonicals") await generateCanonicals(auth);
else await generatePilot(auth);
console.log(`Flux outputs saved under ${OUT_DIR}`);
