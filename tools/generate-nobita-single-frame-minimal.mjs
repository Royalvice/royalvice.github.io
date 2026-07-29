#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.GAME_SERVICE_URL || "http://180.76.242.105:2201";
const TOKEN = process.env.GAME_SERVICE_TOKEN;
const RUN_ID =
  process.env.NOBITA_SINGLE_FRAME_RUN ||
  "2026-07-22-nobita-single-frame-left-leg-forward-straight-r2";
const RUN = path.join(ROOT, "artifacts", "profile-sprite-review", RUN_ID);
const REFERENCE = path.join(
  ROOT,
  "artifacts",
  "profile-sprite-review",
  "final-directional-references",
  "nobita",
  "nobita-direction-down-reference.png"
);
const PROMPT =
  "把参考图中的人物改成走路姿势，身子保持正面竖直，人物自身左腿向前、右腿向后、右臂向前、左臂向后。";
const BATCH_START = Number(process.env.NOBITA_SINGLE_FRAME_BATCH_START || 1);
const BATCH_SIZE = Number(process.env.NOBITA_SINGLE_FRAME_BATCH_SIZE || 4);
const MAX_CANDIDATES = Number(
  process.env.NOBITA_SINGLE_FRAME_MAX_CANDIDATES || 64
);
const SEED_BASE = Number(process.env.NOBITA_SINGLE_FRAME_SEED_BASE || 73000);

const relative = (value) => path.relative(ROOT, value);
const writeJson = (filePath, value) =>
  fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 1200)}`);
  }
  return JSON.parse(body);
}

async function poll(jobId) {
  const started = Date.now();
  for (;;) {
    const job = await requestJson(`${BASE_URL}/v1/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    process.stdout.write(`\r${jobId} ${job.state || job.current_stage || "queued"}          `);
    if (["succeeded", "failed", "cancelled"].includes(job.state)) {
      process.stdout.write("\n");
      if (job.state !== "succeeded") {
        throw new Error(`${jobId}: ${job.error || job.state}`);
      }
      return job;
    }
    if (Date.now() - started > 1_250_000) throw new Error(`${jobId} timed out.`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function readResults() {
  const resultsPath = path.join(RUN, "results.json");
  if (!(await exists(resultsPath))) return [];
  const parsed = JSON.parse(await fs.readFile(resultsPath, "utf8"));
  return Array.isArray(parsed.results) ? parsed.results : [];
}

async function verifyOrCreateRequestRecord(referenceSha256) {
  const recordPath = path.join(RUN, "request.json");
  const record = {
    runId: RUN_ID,
    reference: relative(REFERENCE),
    referenceSha256,
    inputImageCount: 1,
    prompt: PROMPT,
    promptUpsampling: false,
    maxCandidates: MAX_CANDIDATES,
    stabilityTarget: "同一轮四张中至少两张满足角色自身四肢方向"
  };
  if (!(await exists(recordPath))) {
    await writeJson(recordPath, record);
    return;
  }
  const existing = JSON.parse(await fs.readFile(recordPath, "utf8"));
  if (
    existing.reference !== record.reference ||
    existing.referenceSha256 !== record.referenceSha256 ||
    existing.inputImageCount !== 1 ||
    existing.prompt !== PROMPT ||
    existing.promptUpsampling !== false
  ) {
    throw new Error(`Existing ${relative(recordPath)} does not match the fixed single-frame request.`);
  }
  if (
    existing.maxCandidates !== record.maxCandidates ||
    existing.stabilityTarget !== record.stabilityTarget
  ) {
    await writeJson(recordPath, { ...existing, ...record });
  }
}

async function generate(candidateIndex, referenceBytes) {
  const outputPath = path.join(RUN, `candidate-${String(candidateIndex).padStart(2, "0")}.png`);
  const promptPath = `${outputPath}.prompt.txt`;
  const jobPath = `${outputPath}.job.json`;
  if ((await exists(outputPath)) || (await exists(promptPath)) || (await exists(jobPath))) {
    throw new Error(`Refusing to overwrite candidate ${candidateIndex}.`);
  }

  const request = {
    mode: "i2i",
    prompt: PROMPT,
    width: 1024,
    height: 1024,
    seed: SEED_BASE + candidateIndex - 1,
    num_steps: 4,
    guidance: 1.0,
    prompt_upsampling: false,
    num_images: 1,
    format: "png"
  };
  await fs.writeFile(promptPath, `${PROMPT}\n`);

  const form = new FormData();
  form.set("request", JSON.stringify(request));
  form.append(
    "images",
    new Blob([referenceBytes], { type: "image/png" }),
    path.basename(REFERENCE)
  );

  const queued = await requestJson(`${BASE_URL}/v1/flux2/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form
  });
  console.log(`submitted candidate ${candidateIndex} (${queued.job_id})`);
  const job = await poll(queued.job_id);
  const artifact = (job.artifacts || []).find((entry) =>
    /\.(png|webp|jpe?g)$/i.test(entry.filename)
  );
  if (!artifact) throw new Error(`No image artifact returned for ${queued.job_id}`);
  const url = artifact.url.startsWith("http") ? artifact.url : `${BASE_URL}${artifact.url}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  if (!response.ok) throw new Error(`Artifact download failed: ${response.status}`);
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  await writeJson(jobPath, job);

  return {
    candidate: candidateIndex,
    seed: request.seed,
    prompt: PROMPT,
    promptUpsampling: false,
    inputImageCount: 1,
    jobId: queued.job_id,
    output: relative(outputPath),
    reference: relative(REFERENCE)
  };
}

async function main() {
  if (!TOKEN) throw new Error("GAME_SERVICE_TOKEN is required and is not persisted.");
  if (!Number.isInteger(BATCH_START) || BATCH_START < 1) {
    throw new Error("NOBITA_SINGLE_FRAME_BATCH_START must be a positive integer.");
  }
  if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE < 1) {
    throw new Error("NOBITA_SINGLE_FRAME_BATCH_SIZE must be a positive integer.");
  }
  const batchEnd = BATCH_START + BATCH_SIZE - 1;
  if (batchEnd > MAX_CANDIDATES) {
    throw new Error(`Candidate range must end at or before ${MAX_CANDIDATES}.`);
  }

  const referenceBytes = await fs.readFile(REFERENCE);
  const referenceSha256 = crypto.createHash("sha256").update(referenceBytes).digest("hex");
  await fs.mkdir(RUN, { recursive: true });
  await verifyOrCreateRequestRecord(referenceSha256);

  const specPath = path.join(RUN, "service-spec.json");
  if (!(await exists(specPath))) {
    await writeJson(specPath, await requestJson(`${BASE_URL}/v1/spec.json`));
  }

  const results = await readResults();
  for (let candidateIndex = BATCH_START; candidateIndex <= batchEnd; candidateIndex += 1) {
    const result = await generate(candidateIndex, referenceBytes);
    results.push(result);
    await writeJson(path.join(RUN, "results.json"), { runId: RUN_ID, results });
  }
  console.log(`Saved candidates ${BATCH_START}-${batchEnd} under ${relative(RUN)}`);
}

await main();
