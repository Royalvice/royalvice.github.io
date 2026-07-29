#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REVIEW_ROOT = path.join(ROOT, "artifacts", "profile-sprite-review");
const REFERENCE_ROOT = path.join(REVIEW_ROOT, "final-directional-references");
const BASE_URL = process.env.GAME_SERVICE_URL || "http://180.76.242.105:2201";
const TOKEN = process.env.GAME_SERVICE_TOKEN;
const MAX_CANDIDATES = 16;

const ACTORS = {
  doraemon: { displayName: "哆啦A梦", seedBase: 100000 },
  shizuka: { displayName: "静香", seedBase: 110000 },
  gian: { displayName: "胖虎", seedBase: 120000 },
  suneo: { displayName: "小夫", seedBase: 130000 }
};

const DIRECTIONS = {
  down: { bodyPhrase: "身子保持正面竖直", seedOffset: 0 },
  left: { bodyPhrase: "身子保持朝左竖直", seedOffset: 200 },
  up: { bodyPhrase: "身子保持背面竖直", seedOffset: 400 }
};

const POSES = {
  a: {
    label: "A · 角色自身左腿在前",
    seedOffset: 0,
    action: "人物自身左腿在前、右腿在后、右臂在前、左臂在后"
  },
  c: {
    label: "C · 角色自身右腿在前",
    seedOffset: 100,
    action: "人物自身右腿在前、左腿在后、左臂在前、右臂在后"
  }
};

const REQUEST_PARAMS = Object.freeze({
  mode: "i2i",
  width: 1024,
  height: 1024,
  num_steps: 4,
  guidance: 1,
  prompt_upsampling: false,
  num_images: 1,
  format: "png"
});

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) throw new Error(`Unexpected argument: ${item}`);
    const key = item.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${item}`);
    values[key] = value;
    index += 1;
  }
  return values;
}

const args = parseArgs(process.argv.slice(2));
const actorId = args.actor;
const directionId = args.direction;
const poseId = args.pose;
const strategy = args.strategy || "neutral-b";
const referenceCandidate = Number(args["reference-candidate"] || 0);
const batchStart = Number(args["batch-start"] || 1);
const batchSize = Number(args["batch-size"] || 4);
const actor = ACTORS[actorId];
const direction = DIRECTIONS[directionId];
const pose = POSES[poseId];

const relative = (value) => path.relative(ROOT, value);
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const writeJson = (filePath, value) => fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function pngDimensions(bytes) {
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Input or output is not a PNG file.");
  }
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 1200)}`);
  return JSON.parse(body);
}

async function poll(jobId) {
  const started = Date.now();
  let previousState = "";
  for (;;) {
    const job = await requestJson(`${BASE_URL}/v1/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    const state = job.state || job.current_stage || "queued";
    if (state !== previousState) {
      console.log(`${jobId} ${state}`);
      previousState = state;
    }
    if (["succeeded", "failed", "cancelled"].includes(job.state)) {
      if (job.state !== "succeeded") throw new Error(`${jobId}: ${job.error || job.state}`);
      return job;
    }
    if (Date.now() - started > 1_250_000) throw new Error(`${jobId} timed out.`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function generate(candidateIndex, referenceBytes, referencePath, prompt, outputDir, seedBase) {
  const stem = `candidate-${String(candidateIndex).padStart(2, "0")}`;
  const outputPath = path.join(outputDir, `${stem}.png`);
  const promptPath = path.join(outputDir, `${stem}.prompt.txt`);
  const requestPath = path.join(outputDir, `${stem}.request.json`);
  const jobPath = path.join(outputDir, `${stem}.job.json`);
  for (const candidatePath of [outputPath, promptPath, requestPath, jobPath]) {
    if (await exists(candidatePath)) throw new Error(`Refusing to overwrite ${relative(candidatePath)}`);
  }

  const seed = seedBase + candidateIndex - 1;
  const request = { ...REQUEST_PARAMS, prompt, seed };
  if (request.mode !== "i2i" || request.prompt_upsampling !== false || request.num_images !== 1) {
    throw new Error("Single-image clean i2i invariants were violated.");
  }
  await fs.writeFile(promptPath, `${prompt}\n`);
  await writeJson(requestPath, request);

  const form = new FormData();
  form.set("request", JSON.stringify(request));
  form.append("images", new Blob([referenceBytes], { type: "image/png" }), path.basename(referencePath));
  const queued = await requestJson(`${BASE_URL}/v1/flux2/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form
  });
  console.log(`submitted ${actorId}/${directionId}/${poseId} candidate ${candidateIndex} (${queued.job_id})`);
  const job = await poll(queued.job_id);
  const artifact = (job.artifacts || []).find((entry) => /\.(png|webp|jpe?g)$/i.test(entry.filename));
  if (!artifact) throw new Error(`No image artifact returned for ${queued.job_id}`);
  const artifactUrl = artifact.url.startsWith("http") ? artifact.url : `${BASE_URL}${artifact.url}`;
  const response = await fetch(artifactUrl, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!response.ok) throw new Error(`Artifact download failed: ${response.status}`);
  const outputBytes = Buffer.from(await response.arrayBuffer());
  const outputSize = pngDimensions(outputBytes);
  if (outputSize[0] !== 1024 || outputSize[1] !== 1024) {
    throw new Error(`${queued.job_id} returned ${outputSize.join("x")} instead of 1024x1024.`);
  }
  await fs.writeFile(outputPath, outputBytes);
  await writeJson(jobPath, job);
  return {
    candidate: candidateIndex,
    seed,
    jobId: queued.job_id,
    prompt,
    promptUpsampling: false,
    inputImageCount: 1,
    reference: relative(referencePath),
    referenceSha256: sha256(referenceBytes),
    output: relative(outputPath),
    outputSha256: sha256(outputBytes),
    outputSize
  };
}

async function main() {
  if (!TOKEN) throw new Error("GAME_SERVICE_TOKEN is required and is not persisted.");
  if (!actor) throw new Error(`--actor must be one of: ${Object.keys(ACTORS).join(", ")}`);
  if (!direction) throw new Error(`--direction must be one of: ${Object.keys(DIRECTIONS).join(", ")}`);
  if (!pose) throw new Error(`--pose must be one of: ${Object.keys(POSES).join(", ")}`);
  if (!["neutral-b", "reverse-left-a", "reverse-left-a-explicit"].includes(strategy)) {
    throw new Error("--strategy must be neutral-b, reverse-left-a, or reverse-left-a-explicit.");
  }
  const reverseStrategy = strategy.startsWith("reverse-left-a");
  if (reverseStrategy && (directionId !== "left" || poseId !== "c")) {
    throw new Error("Left A reverse strategies are only valid for --direction left --pose c.");
  }
  if (reverseStrategy && (!Number.isInteger(referenceCandidate) || referenceCandidate < 1 || referenceCandidate > 16)) {
    throw new Error("Left A reverse strategies require --reference-candidate 1-16 from the accepted Left A run.");
  }
  if (!Number.isInteger(batchStart) || batchStart < 1) throw new Error("--batch-start must be a positive integer.");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 4) throw new Error("--batch-size must be 1-4.");
  const batchEnd = batchStart + batchSize - 1;
  if (batchEnd > MAX_CANDIDATES) throw new Error(`Candidate range must end at or before ${MAX_CANDIDATES}.`);

  const runId = strategy === "reverse-left-a"
    ? `2026-07-23-${actorId}-abc-reverse-r2`
    : strategy === "reverse-left-a-explicit"
      ? `2026-07-23-${actorId}-abc-reverse-explicit-r3`
      : `2026-07-23-${actorId}-abc-clean-r1`;
  const runDir = path.join(REVIEW_ROOT, runId);
  const outputDir = path.join(runDir, directionId, `frame-${poseId}`);
  const referencePath = reverseStrategy
    ? path.join(
        REVIEW_ROOT,
        `2026-07-23-${actorId}-abc-clean-r1`,
        "left",
        "frame-a",
        `candidate-${String(referenceCandidate).padStart(2, "0")}.png`
      )
    : path.join(REFERENCE_ROOT, actorId, `${actorId}-direction-${directionId}-reference.png`);
  const referenceBytes = await fs.readFile(referencePath);
  const referenceSize = pngDimensions(referenceBytes);
  if (referenceSize[0] !== 1024 || referenceSize[1] !== 1024) {
    throw new Error(`Reference must be 1024x1024, got ${referenceSize.join("x")}.`);
  }
  const actualHash = sha256(referenceBytes);
  if (strategy === "neutral-b") {
    const manifest = JSON.parse(await fs.readFile(path.join(REFERENCE_ROOT, "manifest.json"), "utf8"));
    const expectedHash = manifest.actors?.[actorId]?.frames?.[directionId]?.sha256;
    if (!expectedHash || actualHash !== expectedHash) {
      throw new Error(`Reference SHA256 mismatch for ${actorId}/${directionId}: ${actualHash}`);
    }
  }

  const prompt = strategy === "reverse-left-a"
    ? "把参考图中的人物的走路姿势反转，身子保持朝左竖直，左右腿和左右臂的前后关系互换，双脚着地。"
    : strategy === "reverse-left-a-explicit"
      ? "把参考图中人物原来向前的腿和胳膊改到后面，原来向后的腿和胳膊改到前面，身子保持朝左竖直，双脚着地。"
      : `把参考图中的人物改成走路姿势，${direction.bodyPhrase}，${pose.action}，双脚着地。`;
  const seedBase = strategy === "reverse-left-a"
    ? actor.seedBase + 800
    : strategy === "reverse-left-a-explicit"
      ? actor.seedBase + 900
    : actor.seedBase + direction.seedOffset + pose.seedOffset;
  await fs.mkdir(outputDir, { recursive: true });
  const runRequestPath = path.join(runDir, "request.json");
  const runRequest = {
    runId,
    actor: actorId,
    displayName: actor.displayName,
    service: BASE_URL,
    strategy,
    inputPolicy: reverseStrategy
      ? "每个候选只上传当前角色已通过的 Left A；只反转当前走路姿势。"
      : "每个候选只上传当前角色、当前方向的同一张中立 B 参考图；A/C 互不作为输入。",
    inputImageCount: 1,
    maxCandidatesPerPose: MAX_CANDIDATES,
    batchSize: 4,
    requestParams: REQUEST_PARAMS,
    seedPolicy: {
      actorBase: actor.seedBase,
      directionOffsets: Object.fromEntries(Object.entries(DIRECTIONS).map(([id, value]) => [id, value.seedOffset])),
      poseOffsets: Object.fromEntries(Object.entries(POSES).map(([id, value]) => [id, value.seedOffset]))
    }
  };
  if (!(await exists(runRequestPath))) await writeJson(runRequestPath, runRequest);
  const poseRequestPath = path.join(outputDir, "request.json");
  const poseRequest = {
    runId,
    actor: actorId,
    direction: directionId,
    pose: poseId,
    label: reverseStrategy ? "C · 以 Left A 为单图 reference 整体反转" : pose.label,
    strategy,
    reference: relative(referencePath),
    referenceSha256: actualHash,
    referenceSize,
    inputImageCount: 1,
    prompt,
    requestParams: REQUEST_PARAMS,
    seedBase,
    maxCandidates: MAX_CANDIDATES
  };
  if (!(await exists(poseRequestPath))) await writeJson(poseRequestPath, poseRequest);
  const specPath = path.join(runDir, "service-spec.json");
  if (!(await exists(specPath))) await writeJson(specPath, await requestJson(`${BASE_URL}/v1/spec.json`));

  const resultsPath = path.join(outputDir, "results.json");
  const prior = (await exists(resultsPath))
    ? JSON.parse(await fs.readFile(resultsPath, "utf8")).results || []
    : [];
  const indices = Array.from({ length: batchSize }, (_, index) => batchStart + index);
  const generated = await Promise.all(indices.map((index) => generate(index, referenceBytes, referencePath, prompt, outputDir, seedBase)));
  const results = [...prior, ...generated].sort((left, right) => left.candidate - right.candidate);
  await writeJson(resultsPath, { runId, actor: actorId, direction: directionId, pose: poseId, results });
  console.log(`saved ${actorId}/${directionId}/${poseId} candidates ${batchStart}-${batchEnd}`);
}

await main();
