#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const BASE_URL = process.env.GAME_SERVICE_URL || "http://180.76.242.105:2201";
const RUN_ID = process.env.PROFILE_SPRITE_RUN || new Date().toISOString().replaceAll(/[:.]/g, "-");
const OUT_DIR = path.resolve(process.env.PROFILE_SPRITE_OUT || `artifacts/profile-sprite-review/${RUN_ID}`);
const ROUND = process.env.PROFILE_SPRITE_ROUND || "r1";

const sources = {
  doraemon: "https://dora-world.com/assets/images/characters/doraemon/doraemon/d_001_card.png",
  nobita: "https://dora-world.com/assets/images/characters/doraemon/nobita/d_002_card.png",
  shizuka: "https://dora-world.com/assets/images/characters/doraemon/shizuka/d_003_card.png",
  gian: "https://dora-world.com/assets/images/characters/doraemon/gian/d_004_card.png",
  suneo: "https://dora-world.com/assets/images/characters/doraemon/suneo/d_005_card.png"
};

const actorSpecs = {
  doraemon: {
    key: "#00FF00",
    identity: "Doraemon, the exact child-friendly blue and white round robotic cat from the supplied official identity card: no ears, one red round nose, white muzzle and belly, red collar, one small golden bell, very short round limbs and white feet",
    actions: "idle; walking contact; walking passing; opposite walking contact; searching his belly pocket; opening a freestanding door; pointing into a portal; raising both paws in celebration; pulling a small gadget from his belly pocket"
  },
  nobita: {
    key: "#00FF00",
    identity: "Nobita Nobi, the exact slim Japanese schoolboy from the supplied official identity card: child proportions, large circular black glasses, short black hair, yellow short-sleeve polo shirt, navy shorts, white socks and pale blue shoes",
    actions: "idle; walking contact; walking passing; opposite walking contact; receiving a gadget; waving to a friend; startled step backward; both arms raised in celebration; wearing a small bamboo copter above his head"
  },
  shizuka: {
    key: "#00FFFF",
    identity: "Shizuka Minamoto, the exact Japanese schoolgirl from the supplied official identity card: child proportions, black hair in two short low pigtails, pink and white classic outfit, white socks and red shoes",
    actions: "idle; walking contact; walking passing; opposite walking contact; waving to a friend; gentle clap; surprised hands near mouth; happy applause; warm friendly wave"
  },
  gian: {
    key: "#00FF00",
    identity: "Takeshi Gian Goda, the exact stocky Japanese schoolboy from the supplied official identity card: unmistakably broad child body, square jaw, large cheeks, short black hair, thick eyebrows, orange top with dark center band, blue trousers and pale blue shoes; never an adult man, never slim or athletic-model proportions",
    actions: "arms-crossed idle; heavy walking contact; heavy walking passing; opposite heavy walking contact; nudging a smaller friend; hands-on-hips broad laugh; protective stance in front of friends; one fist raised in celebration; forceful signature stomp"
  },
  suneo: {
    key: "#FF00FF",
    identity: "Suneo Honekawa, the exact small slim Japanese schoolboy from the supplied official identity card. His silhouette must be unmistakable in every cell: an extremely long flat black hair wedge projects horizontally to screen-right and ends in two sharp prongs; his face is a narrow side-facing wedge with a long pointed triangular mouth and nose, one cheek projecting forward, and large vertical oval eyes. He wears a green checkered shirt, orange-brown shorts, white socks and green shoes. Never draw a generic round-faced boy, bowl cut, short fringe, centered anime face, or symmetric spiky hair. Preserve the same screen-right hair wedge and pointed side-profile in all nine cells",
    actions: "idle; quick walking contact; quick walking passing; opposite walking contact; whispering toward a larger friend; pointing toward a portal; exaggerated backward recoil; smug applause; proud side-profile showing off pose"
  }
};

async function authToken() {
  if (process.env.GAME_SERVICE_TOKEN) return process.env.GAME_SERVICE_TOKEN;
  const terminal = readline.createInterface({ input, output, terminal: true });
  const token = await terminal.question("GAME_SERVICE_TOKEN (not persisted): ");
  terminal.close();
  if (!token.trim()) throw new Error("GAME_SERVICE_TOKEN is required.");
  return token.trim();
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 1200)}`);
  return JSON.parse(text);
}

async function poll(token, jobId) {
  const started = Date.now();
  for (;;) {
    const job = await requestJson(`${BASE_URL}/v1/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    process.stdout.write(`\r${jobId} ${job.state || job.current_stage || "queued"}       `);
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
  const artifact = (job.artifacts || []).find((item) => /\.(png|webp|jpe?g)$/i.test(item.filename));
  if (!artifact) throw new Error(`No image artifact for ${job.job_id}`);
  const url = artifact.url.startsWith("http") ? artifact.url : `${BASE_URL}${artifact.url}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Artifact download failed: ${response.status}`);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
  await fs.writeFile(destination.replace(/\.[^.]+$/, ".job.json"), `${JSON.stringify(job, null, 2)}\n`);
  return destination;
}

async function submitFlux(token, request, references, destination) {
  try {
    await fs.access(destination);
    console.log(`reuse ${destination}`);
    return destination;
  } catch {
    // Generate missing candidates only. A new run id produces a clean iteration.
  }
  const form = new FormData();
  form.set("request", JSON.stringify({
    num_steps: 4,
    guidance: 1.0,
    prompt_upsampling: false,
    format: "png",
    num_images: 1,
    ...request
  }));
  for (const reference of references) {
    const bytes = await fs.readFile(reference);
    form.append("images", new Blob([bytes], { type: "image/png" }), path.basename(reference));
  }
  const submitted = await requestJson(`${BASE_URL}/v1/flux2/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  console.log(`submitted ${submitted.job_id} -> ${path.basename(destination)}`);
  return downloadArtifact(token, await poll(token, submitted.job_id), destination);
}

async function downloadSources() {
  const records = {};
  for (const [id, url] of Object.entries(sources)) {
    const destination = path.join(OUT_DIR, "sources", `${id}-official.png`);
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!response.ok) throw new Error(`${id} source failed: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, bytes);
    records[id] = {
      url,
      file: path.relative(OUT_DIR, destination),
      sha256: crypto.createHash("sha256").update(bytes).digest("hex")
    };
  }
  await fs.writeFile(path.join(OUT_DIR, "sources.json"), `${JSON.stringify(records, null, 2)}\n`);
}

const commonSheet = (key) => `Production-ready cinematic top-down pixel game sprite sheet. Exactly one character repeated exactly nine times in a clean 3 by 3 arrangement, three columns and three rows, nine equal invisible cells. High three-quarter overhead camera, approximately seventy degrees downward, oversized readable head, short compact body, visible feet and consistent foot pivot. Deliberate crisp pixel clusters, one-to-two-pixel dark outline at final game resolution, limited color palette, warm upper-left light. Every pose must preserve exactly the same identity, age, face, body proportions, clothing, colors, scale and camera angle. Perfectly flat solid ${key} chroma-key background. No floor, no contact shadow, no cast shadow, no scenery, no props except the explicitly requested signature item, no cell borders, no grid lines, no card frame, no Japanese text, no English text, no logo, no watermark, no labels, no cropped head or feet, no overlap between cells, no extra people, no duplicated limbs.`;

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const spec = await requestJson(`${BASE_URL}/v1/spec.json`);
  await fs.writeFile(path.join(OUT_DIR, "service-spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
  await downloadSources();
  const token = await authToken();
  const prompts = {};

  const stylePrompt = `${commonSheet("#00FF00")} An original anonymous child adventurer mannequin with neutral brown hair, beige tunic and dark teal shorts. The nine poses are: idle; walk contact; walk passing; opposite walk contact; reaching toward an object; pointing; startled backward reaction; celebration; signature confident pose. This is a camera, scale and pixel-density guide only and must not resemble any established character.`;
  prompts.styleGuide = stylePrompt;
  const styleGuide = await submitFlux(token, {
    mode: "t2i",
    prompt: stylePrompt,
    width: 1024,
    height: 1024,
    seed: Number(process.env.PROFILE_STYLE_SEED || 73101)
  }, [], path.join(OUT_DIR, "candidates", "topdown-style-guide-r1.png"));

  const only = process.env.PROFILE_ACTOR_ONLY;
  for (const [index, [id, actor]] of Object.entries(actorSpecs).entries()) {
    if (only && only !== id) continue;
    const prompt = `${commonSheet(actor.key)} Use the first supplied image only as the canonical identity reference and ignore its card frame, background, printed words and logos. Use the second supplied image only as the overhead game-sprite camera and pixel-density reference. Subject identity: ${actor.identity}. Nine cells in exact reading order: ${actor.actions}. The character must look like the same child in every cell.`;
    prompts[id] = prompt;
    const cleanedReference = path.join(OUT_DIR, "sources", `${id}-official-clean.png`);
    let identityReference = path.join(OUT_DIR, "sources", `${id}-official.png`);
    try {
      await fs.access(cleanedReference);
      identityReference = cleanedReference;
    } catch {
      // The full official card remains the source of truth when no cleaned crop exists.
    }
    const references = [identityReference];
    if (!process.env.PROFILE_SKIP_STYLE_REFERENCE) references.push(styleGuide);
    if (process.env.PROFILE_PREVIOUS_REFERENCE) {
      references.push(path.resolve(process.env.PROFILE_PREVIOUS_REFERENCE));
    }
    await submitFlux(token, {
      mode: "i2i",
      prompt,
      width: 1024,
      height: 1024,
      seed: Number(process.env.PROFILE_ACTOR_SEED || 73200) + index
    }, references, path.join(OUT_DIR, "candidates", `${id}-sheet-${ROUND}.png`));
  }
  await fs.writeFile(path.join(OUT_DIR, "prompts.json"), `${JSON.stringify(prompts, null, 2)}\n`);
  console.log(`Flux candidates saved under ${OUT_DIR}`);
}

await main();
