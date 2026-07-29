#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BASE_URL = process.env.GAME_SERVICE_URL || "http://180.76.242.105:2201";
const RUN_ID = process.env.PROFILE_SPRITE_STRICT_RUN || "2026-07-18-strict-v4";
const ROUND = process.env.PROFILE_SPRITE_ROUND || "r1";
// 1024 is the audit default from the approved workflow.  A smaller source
// size is useful for a long strict run because every final frame is reduced
// to a 128px cell; the output is still independently reviewed and normalized.
const IMAGE_SIZE = Number(process.env.PROFILE_SPRITE_SIZE || 1024);
const RUN = path.resolve(ROOT, `artifacts/profile-sprite-review/${RUN_ID}`);
const OFFICIAL_ROOT = path.join(ROOT, "artifacts/profile-sprite-review/2026-07-17-topdown-r1/sources");
const CURRENT_ROOT = path.join(ROOT, "artifacts/profile-room-v3-review/2026-07-17-living-r1/enlarged-frames");

const actorSpecs = {
  nobita: {
    key: "#00FF00",
    identity: "Nobita Nobi, a slim Japanese schoolboy child with a round black eyeglass frame over both eyes, short black hair, a yellow short-sleeve shirt, navy shorts, white socks and pale blue shoes. Keep the exact child proportions and recognizable round glasses in every frame.",
    forbidden: "no missing glasses, no adult body, no long hair, no changed outfit, no single eyepiece, no goggles",
    signature: "a small bamboo-copter held above his head without changing his body proportions"
  },
  doraemon: {
    key: "#00FF00",
    identity: "Doraemon, the round blue-and-white robotic cat with no ears, one red round nose, white muzzle and belly, red collar, small gold bell, very short round limbs and white feet. Keep the same circular head and short body in every frame.",
    forbidden: "no ears, no human face, no pointed cat muzzle, no blue-clothed human, no animal tail, no realistic robot details",
    signature: "one small gadget emerging from his four-dimensional pocket while the round blue body remains unchanged"
  },
  shizuka: {
    key: "#00FFFF",
    identity: "Shizuka Minamoto, a Japanese schoolgirl child with black hair in two short low pigtails, a pink-and-white outfit, white socks and red shoes. Keep a gentle round child face and the two pigtails in every frame.",
    forbidden: "no adult woman proportions, no long loose hair, no missing pigtails, no changed clothing colors, no mature makeup",
    signature: "a gentle friendly wave with both low pigtails and the same pink-and-white child outfit"
  },
  gian: {
    key: "#00FF00",
    identity: "Takeshi Gian Goda, a broad stocky Japanese schoolboy child with a square jaw, large cheeks, thick eyebrows, short black hair, orange shirt with a dark middle stripe, blue lower clothing and pale blue shoes. He must be visibly wider and heavier than the other children but never an adult.",
    forbidden: "no slim body, no adult man, no athletic model proportions, no beige outfit, no missing dark shirt stripe, no narrow jaw",
    signature: "a forceful child-sized stomp with one fist raised, keeping the broad shoulders and square jaw"
  },
  suneo: {
    key: "#FF00FF",
    identity: "Suneo Honekawa, a very small slim Japanese schoolboy with a long flat black hair wedge projecting horizontally to screen-right and ending in two sharp prongs, a narrow pointed side-facing mouth and nose, large vertical oval eyes, green checkered shirt, orange-brown shorts, white socks and green shoes.",
    forbidden: "no round-faced generic boy, no symmetric spiky hair, no short fringe, no centered bowl cut, no wide body, no hair direction reversal",
    signature: "a proud side-profile showing-off pose that preserves the long screen-right hair wedge and pointed face"
  }
};

const BASE_FRAMES = [
  ["idle", "neutral standing idle, relaxed arms, both feet planted"],
  ["walk-contact", "one natural walking contact pose, front-facing direction, one foot contacting the floor"],
  ["walk-passing", "natural walking passing pose, body weight over the middle, one leg crossing through"],
  ["walk-opposite-contact", "the opposite walking contact pose, opposite foot contacting the floor"],
  ["interaction-a", "a clear small-room interaction gesture, one hand reaching naturally"],
  ["interaction-b", "a second distinct small-room interaction gesture, different hand and weight shift"],
  ["portal-reaction", "a surprised but readable reaction, one step backward and hands naturally raised"],
  ["celebration", "a readable celebration pose with balanced feet and raised arms"],
  ["character-signature", "CHARACTER_SIGNATURE"],
];

const MOVEMENT_FRAMES = [
  ["down-0", "walk toward the lower edge, left-foot contact pose"],
  ["down-1", "walk toward the lower edge, passing pose with body weight centered"],
  ["down-2", "walk toward the lower edge, right-foot contact pose"],
  ["side-0", "walk toward screen-right in a true side view, left-foot contact pose"],
  ["side-1", "walk toward screen-right in a true side view, passing pose"],
  ["side-2", "walk toward screen-right in a true side view, right-foot contact pose"],
  ["up-0", "walk toward the upper edge with the back visible, left-foot contact pose"],
  ["up-1", "walk toward the upper edge with the back visible, passing pose"],
  ["up-2", "walk toward the upper edge with the back visible, right-foot contact pose"],
];

const LIFE_FRAMES = [
  ["think-a", "thinking pose A, one hand near the chin, balanced feet"],
  ["think-b", "thinking pose B, a small idea reaction, same body scale and baseline"],
  ["drink-a", "drinking pose A, a tiny paper cup held naturally to the mouth"],
  ["drink-b", "drinking pose B, the same tiny paper cup lowered slightly, natural elbow movement"],
  ["sit-game-a", "seated gameplay pose A with legs and feet visible, no chair or furniture"],
  ["sit-game-b", "seated gameplay pose B with a small controller in both hands, no chair or furniture"],
  ["portal-enter", "leaning into an unseen portal toward screen-right, no portal drawn"],
  ["portal-return", "returning from an unseen portal toward screen-left, no portal drawn"],
  ["room-reaction", "a readable surprised room reaction, same clothing and proportions"],
];

const allFrames = {
  base: BASE_FRAMES,
  movement: MOVEMENT_FRAMES,
  life: LIFE_FRAMES,
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const result = { stage: "canonical", actor: null, kind: null, frame: null, count: 3, force: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--stage") result.stage = args[++index] || result.stage;
    else if (arg === "--actor") result.actor = args[++index] || null;
    else if (arg === "--kind") result.kind = args[++index] || null;
    else if (arg === "--frame") result.frame = args[++index] || null;
    else if (arg === "--count") result.count = Math.max(1, Number(args[++index]) || 3);
    else if (arg === "--force") result.force = true;
  }
  return result;
};

const mkdir = (directory) => fs.mkdir(directory, { recursive: true });
const fileExists = async (file) => fs.access(file).then(() => true).catch(() => false);

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 1200)}`);
  return JSON.parse(body);
}

async function poll(token, jobId) {
  const started = Date.now();
  for (;;) {
    const job = await requestJson(`${BASE_URL}/v1/jobs/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
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
  await mkdir(path.dirname(destination));
  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
  await fs.writeFile(`${destination}.job.json`, `${JSON.stringify(job, null, 2)}\n`);
}

async function submit(token, request, references, destination, force = false) {
  if (!force && await fileExists(destination)) {
    console.log(`reuse ${path.relative(ROOT, destination)}`);
    return null;
  }
  const form = new FormData();
  form.set("request", JSON.stringify({
    num_steps: 4,
    guidance: 1,
    prompt_upsampling: false,
    format: "png",
    num_images: 1,
    ...request,
  }));
  for (const reference of references) {
    const bytes = await fs.readFile(reference);
    form.append("images", new Blob([bytes], { type: "image/png" }), path.basename(reference));
  }
  const queued = await requestJson(`${BASE_URL}/v1/flux2/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  console.log(`submitted ${queued.job_id} -> ${path.relative(ROOT, destination)}`);
  const job = await poll(token, queued.job_id);
  await downloadArtifact(token, job, destination);
  return job;
}

const common = (actor, key) => `Use case: stylized-concept. Asset type: one production pixel-game character frame. Single isolated ${actor} character only. Camera: strict seventy-degree high three-quarter overhead view matching a warm top-down research dungeon, not a frontal illustration and not an orthographic diagram. Keep the complete character visible from head to feet with a fixed foot baseline and compact readable silhouette. Crisp deliberate pixel clusters, limited warm palette, stable dark outline, consistent upper-left room light. Create exactly one pose in this one image, never multiple poses or a sheet. Background must be a perfectly flat solid ${key} chroma-key color with no gradient. No floor, no cast shadow, no reflection, no furniture, no room, no second character, no text, no logo, no border, no grid, no watermark, no card frame, no cropped head or feet, no duplicated limbs, no accidental accessories.`;

const canonicalPrompt = (actor, spec) => `${common(spec.identity, spec.key)} This is the canonical neutral identity reference for ${actor}. ${spec.identity} Neutral standing idle pose, both feet planted, arms relaxed, no prop. The camera is physically elevated above the character at approximately seventy degrees downward: the top plane of the hair, shoulders and shoe tops must be visible, the feet are foreshortened toward the lower edge, and the face is seen from a high three-quarter angle. Absolutely no eye-level portrait, no flat front view, no studio character sheet. Preserve classic child-friendly proportions and clothing colors. ${spec.forbidden}`;

const framePrompt = (actor, spec, kind, frameId, action) => {
  const signature = action === "CHARACTER_SIGNATURE" ? spec.signature : action;
  const continuity = kind === "movement"
    ? "This frame belongs to a three-frame walk sequence. Keep the same foot baseline, body size, camera angle, face, hair and clothing as the canonical reference and the neighboring accepted frame. Do not invent a new character."
    : "This is an isolated action frame. Keep the same identity, camera angle, scale, foot baseline, hair, face and clothing as the canonical reference. Do not draw the room or any furniture.";
  return `${common(spec.identity, spec.key)} Subject identity: ${spec.identity} Frame id: ${frameId}. Action: ${signature}. ${continuity} ${spec.forbidden}`;
};

async function prepareReferences() {
  await mkdir(path.join(RUN, "sources", "official"));
  await mkdir(path.join(RUN, "sources", "identity-crops"));
  await mkdir(path.join(RUN, "sources", "current-best-style"));
  const prompts = { version: "strict-v4", view: "70-degree high three-quarter overhead", actors: {} };
  for (const [id, spec] of Object.entries(actorSpecs)) {
    const official = path.join(OFFICIAL_ROOT, `${id}-official.png`);
    const current = path.join(CURRENT_ROOT, `${id}-movement-01-down-0.png`);
    const officialCopy = path.join(RUN, "sources", "official", `${id}-official.png`);
    const styleCopy = path.join(RUN, "sources", "current-best-style", `${id}-style.png`);
    if (await fileExists(official) && !(await fileExists(officialCopy))) await fs.copyFile(official, officialCopy);
    if (await fileExists(current) && !(await fileExists(styleCopy))) await fs.copyFile(current, styleCopy);
    // The crop is intentionally kept as a separate review input. The first
    // pass uses the official card with an explicit “ignore card text” prompt;
    // a human-approved crop can replace this file before i2i begins.
    const crop = path.join(RUN, "sources", "identity-crops", `${id}-identity.png`);
    if (!(await fileExists(crop)) && await fileExists(officialCopy)) await fs.copyFile(officialCopy, crop);
    prompts.actors[id] = { identity: spec.identity, forbidden: spec.forbidden, canonical: canonicalPrompt(id, spec), frames: {} };
    for (const [kind, frames] of Object.entries(allFrames)) {
      prompts.actors[id].frames[kind] = Object.fromEntries(frames.map(([frameId, action]) => [frameId, framePrompt(id, spec, kind, frameId, action)]));
    }
  }
  await fs.writeFile(path.join(RUN, "prompts.json"), `${JSON.stringify(prompts, null, 2)}\n`);
}

async function generateCanonical(token, options) {
  const actorIds = options.actor ? [options.actor] : Object.keys(actorSpecs);
  for (const id of actorIds) {
    const spec = actorSpecs[id];
    if (!spec) throw new Error(`Unknown actor: ${id}`);
    const directory = path.join(RUN, "canonical", id);
    await mkdir(directory);
    for (let index = 0; index < options.count; index += 1) {
      const destination = path.join(directory, `${id}-canonical-t2i-${ROUND}-${index + 1}.png`);
      await submit(token, {
        mode: "t2i",
        prompt: canonicalPrompt(id, spec),
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
        seed: 94000 + Object.keys(actorSpecs).indexOf(id) * 100 + index,
      }, [], destination, options.force);
    }
  }
}

async function generateFrames(token, options) {
  if (!options.actor) throw new Error("--actor is required for --stage frames");
  const spec = actorSpecs[options.actor];
  if (!spec) throw new Error(`Unknown actor: ${options.actor}`);
  const canonical = process.env.PROFILE_SPRITE_CANONICAL || path.join(RUN, "canonical", options.actor, `${options.actor}-canonical-selected.png`);
  if (!(await fileExists(canonical))) throw new Error(`Missing selected canonical: ${canonical}`);
  const official = path.join(RUN, "sources", "identity-crops", `${options.actor}-identity.png`);
  const style = path.join(RUN, "sources", "current-best-style", `${options.actor}-style.png`);
  const kinds = options.kind ? [options.kind] : Object.keys(allFrames);
  for (const kind of kinds) {
    const frameSpecs = allFrames[kind];
    if (!frameSpecs) throw new Error(`Unknown frame kind: ${kind}`);
    for (const [frameId, action] of frameSpecs) {
      if (options.frame && options.frame !== frameId) continue;
      const directory = path.join(RUN, "candidates", options.actor, kind, frameId);
      await mkdir(directory);
      const previous = process.env.PROFILE_SPRITE_NEIGHBOR && await fileExists(process.env.PROFILE_SPRITE_NEIGHBOR)
        ? process.env.PROFILE_SPRITE_NEIGHBOR
        : null;
      const references = [canonical, official, style].filter(Boolean);
      if (previous) references.push(previous);
      for (let index = 0; index < options.count; index += 1) {
        const destination = path.join(directory, `${options.actor}-${kind}-${frameId}-${ROUND}-${index + 1}.png`);
        await submit(token, {
          mode: "i2i",
          prompt: framePrompt(options.actor, spec, kind, frameId, action),
          width: IMAGE_SIZE,
          height: IMAGE_SIZE,
          seed: 95000 + Object.keys(actorSpecs).indexOf(options.actor) * 1000 + Object.keys(allFrames).indexOf(kind) * 100 + frameSpecs.findIndex(([id]) => id === frameId) * 10 + index,
        }, references, destination, options.force);
      }
    }
  }
}

async function main() {
  const options = parseArgs();
  await mkdir(RUN);
  await prepareReferences();
  const spec = await requestJson(`${BASE_URL}/v1/spec.json`);
  await fs.writeFile(path.join(RUN, "service-spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
  const token = process.env.GAME_SERVICE_TOKEN;
  if (!token) throw new Error("GAME_SERVICE_TOKEN is required and is intentionally not persisted.");
  if (options.stage === "canonical" || options.stage === "all") await generateCanonical(token, options);
  if (options.stage === "frames" || options.stage === "all") await generateFrames(token, options);
  console.log(`Strict sprite candidates saved under ${path.relative(ROOT, RUN)}`);
}

await main();
