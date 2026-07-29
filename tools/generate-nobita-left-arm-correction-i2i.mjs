#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.GAME_SERVICE_URL || "http://180.76.242.105:2201";
const TOKEN = process.env.GAME_SERVICE_TOKEN;
const VARIANT_KEY = process.env.NOBITA_ARM_VARIANT || "r1";
const VARIANTS = {
  r1: {
    runId: "2026-07-23-nobita-left-arm-correction-from-r2-04-r1",
    prompt:
      "双腿保持不变，身子保持朝左竖直；反转人物双臂的前后位置：人物自身左臂向前摆、右臂向后摆。",
    seedBase: 82000,
    targetPose: "右腿在前、左腿在后；左臂向前、右臂向后",
    reference:
      "artifacts/profile-sprite-review/2026-07-22-nobita-left-reverse-from-a14-r2/candidates/candidate-04.png",
    referenceSha256: "1412e15f5ffc655f51980fd80710936cb658d267944162d99ad14c49f3aa930c",
    referencePose: "右腿在前、左腿在后；双臂尚未形成对应的对侧摆动",
    inputPolicy: "每个候选只上传同一张 R2-04，不上传其他帧、其他方向或其他资产。",
    method: "single-image-arm-position-reversal"
  },
  r2: {
    runId: "2026-07-23-nobita-left-arm-correction-from-r2-04-r2",
    prompt:
      "双腿保持不变。将画面左侧向前伸出的手臂移到身体后方，将画面右侧垂下的手臂移到身体前方。",
    seedBase: 83000,
    targetPose: "保持腿序；按画面空间交换前后两条手臂的位置",
    reference:
      "artifacts/profile-sprite-review/2026-07-22-nobita-left-reverse-from-a14-r2/candidates/candidate-04.png",
    referenceSha256: "1412e15f5ffc655f51980fd80710936cb658d267944162d99ad14c49f3aa930c",
    referencePose: "右腿在前、左腿在后；双臂尚未形成对应的对侧摆动",
    inputPolicy: "每个候选只上传同一张 R2-04，不上传其他帧、其他方向或其他资产。",
    method: "single-image-arm-position-reversal"
  },
  r3: {
    runId: "2026-07-23-nobita-left-arm-swap-structural-r1",
    prompt: "修复人物双臂的自然连接，双腿和身子保持不变。",
    seedBase: 84000,
    targetPose: "保留粗结构图中已交换的长臂与弯曲臂位置，只修复自然连接",
    reference:
      "artifacts/profile-sprite-review/2026-07-23-nobita-left-arm-swap-structural-r1/arm-swap-rough-guide.png",
    referenceSha256: "835948409601b4aeddefced2c81cc75ac355a087575946ded1774f1838ec0a98",
    referencePose: "腿序正确；画面左侧为长臂、画面右侧为弯曲臂的粗结构图",
    inputPolicy: "每个候选只上传同一张本地粗结构图，不上传 R2-04 原图、其他帧或其他资产。",
    method: "single-image-structural-arm-swap-cleanup"
  },
  r4: {
    runId: "2026-07-23-nobita-left-arm-swap-composite-r1",
    prompt: "只修复画面右侧弯曲手臂与肩膀的连接，手臂位置、双腿和身子保持不变。",
    seedBase: 85000,
    targetPose: "保留自然长前臂与自然弯曲后臂的位置，只修复右肩接缝",
    reference:
      "artifacts/profile-sprite-review/2026-07-23-nobita-left-arm-swap-composite-r1/arm-swap-composite-guide-v2.png",
    referenceSha256: "1685c31df8ae6f254aa68f1002b0780a347a18f845f074a98f78af6cc959f925",
    referencePose: "腿序正确；画面左侧为自然长臂、画面右侧为自然弯曲臂，右肩接缝待修复",
    inputPolicy: "每个候选只上传同一张本地自然像素拼接图，不上传其他帧、其他方向或其他资产。",
    method: "single-image-natural-arm-composite-cleanup"
  },
  r5: {
    runId: "2026-07-23-nobita-left-arm-swap-cleanup-r1",
    prompt: "只保留两条手臂，修复画面右侧弯曲手臂与肩膀的自然连接，手臂位置、双腿和身子保持不变。",
    seedBase: 86000,
    targetPose: "保留长前臂与胸前弯曲后臂，清理多余肢体并修复肩部连接",
    reference:
      "artifacts/profile-sprite-review/2026-07-23-nobita-left-arm-swap-cleanup-r1/remove-extra-arm-guide-v2.png",
    referenceSha256: "c466717c9bd654e015bea87ac43be3f6060d18ff564d893bbed04e8901c42b82",
    referencePose: "腿序正确；两条主手臂已反转；最右侧多余拳头已在本地清除",
    inputPolicy: "每个候选只上传同一张已清除多余拳头的单图，不上传其他帧、其他方向或其他资产。",
    method: "single-image-extra-limb-cleanup"
  }
};
const VARIANT = VARIANTS[VARIANT_KEY];
const RUN_ID = VARIANT?.runId;
const RUN = path.join(ROOT, "artifacts", "profile-sprite-review", RUN_ID);
const CANDIDATES = path.join(RUN, "candidates");
const REFERENCE = path.join(ROOT, VARIANT?.reference || "");
const REFERENCE_SHA256 = VARIANT?.referenceSha256;
const PROMPT = VARIANT?.prompt;
const SEED_BASE = VARIANT?.seedBase;
const MAX_CANDIDATES = 16;
const BATCH_START = Number(process.env.NOBITA_ARM_BATCH_START || 1);
const BATCH_SIZE = Number(process.env.NOBITA_ARM_BATCH_SIZE || 4);

const REQUEST_PARAMS = Object.freeze({
  mode: "i2i",
  width: 1024,
  height: 1024,
  num_steps: 4,
  guidance: 1.0,
  prompt_upsampling: false,
  num_images: 1,
  format: "png"
});

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

function pngDimensions(bytes) {
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error(`${relative(REFERENCE)} is not a PNG file.`);
  }
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
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
  const filePath = path.join(RUN, "results.json");
  if (!(await exists(filePath))) return [];
  const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
  return Array.isArray(parsed.results) ? parsed.results : [];
}

async function generate(candidateIndex, referenceBytes) {
  const stem = `candidate-${String(candidateIndex).padStart(2, "0")}`;
  const outputPath = path.join(CANDIDATES, `${stem}.png`);
  const promptPath = path.join(CANDIDATES, `${stem}.prompt.txt`);
  const jobPath = path.join(CANDIDATES, `${stem}.job.json`);
  if ((await exists(outputPath)) || (await exists(jobPath))) {
    throw new Error(`Refusing to overwrite arm-correction candidate ${candidateIndex}.`);
  }

  if (await exists(promptPath)) {
    const existingPrompt = await fs.readFile(promptPath, "utf8");
    if (existingPrompt !== `${PROMPT}\n`) {
      throw new Error(`Existing prompt does not match for arm-correction candidate ${candidateIndex}.`);
    }
  }

  const request = {
    ...REQUEST_PARAMS,
    prompt: PROMPT,
    seed: SEED_BASE + candidateIndex - 1
  };
  if (!(await exists(promptPath))) {
    await fs.writeFile(promptPath, `${PROMPT}\n`);
  }

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
  console.log(`submitted arm-correction candidate ${candidateIndex} (${queued.job_id})`);
  const job = await poll(queued.job_id);
  const artifact = (job.artifacts || []).find((entry) =>
    /\.(png|webp|jpe?g)$/i.test(entry.filename)
  );
  if (!artifact) throw new Error(`No image artifact returned for ${queued.job_id}`);
  const artifactUrl = artifact.url.startsWith("http")
    ? artifact.url
    : `${BASE_URL}${artifact.url}`;
  const response = await fetch(artifactUrl, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
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
    seed: request.seed,
    prompt: PROMPT,
    promptUpsampling: false,
    inputImageCount: 1,
    jobId: queued.job_id,
    output: relative(outputPath),
    outputSha256: crypto.createHash("sha256").update(outputBytes).digest("hex"),
    outputSize,
    reference: relative(REFERENCE),
    referenceSha256: REFERENCE_SHA256
  };
}

async function main() {
  if (!TOKEN) throw new Error("GAME_SERVICE_TOKEN is required and is not persisted.");
  if (!Object.hasOwn(VARIANTS, VARIANT_KEY)) {
    throw new Error("NOBITA_ARM_VARIANT must be exactly 'r1', 'r2', 'r3', 'r4' or 'r5'.");
  }
  if (!Number.isInteger(BATCH_START) || BATCH_START < 1) {
    throw new Error("NOBITA_ARM_BATCH_START must be a positive integer.");
  }
  if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE < 1 || BATCH_SIZE > 4) {
    throw new Error("NOBITA_ARM_BATCH_SIZE must be an integer from 1 to 4.");
  }
  const batchEnd = BATCH_START + BATCH_SIZE - 1;
  if (batchEnd > MAX_CANDIDATES) {
    throw new Error(`Candidate range must end at or before ${MAX_CANDIDATES}.`);
  }

  const referenceBytes = await fs.readFile(REFERENCE);
  const actualSha256 = crypto.createHash("sha256").update(referenceBytes).digest("hex");
  if (actualSha256 !== REFERENCE_SHA256) {
    throw new Error(`Reference SHA256 changed: ${actualSha256}`);
  }
  const referenceSize = pngDimensions(referenceBytes);
  if (referenceSize[0] !== 1024 || referenceSize[1] !== 1024) {
    throw new Error(`Reference must be 1024x1024, got ${referenceSize.join("x")}.`);
  }

  await fs.mkdir(CANDIDATES, { recursive: true });
  const requestPath = path.join(RUN, "request.json");
  const requestRecord = {
    runId: RUN_ID,
    method: VARIANT.method,
    reference: relative(REFERENCE),
    referenceSha256: REFERENCE_SHA256,
    referenceSize,
    referencePose: VARIANT.referencePose,
    targetPose: VARIANT.targetPose,
    inputImageCount: 1,
    prompt: PROMPT,
    requestParams: REQUEST_PARAMS,
    seedBase: SEED_BASE,
    maxCandidates: MAX_CANDIDATES,
    inputPolicy: VARIANT.inputPolicy
  };
  if (!(await exists(requestPath))) {
    await writeJson(requestPath, requestRecord);
  } else {
    const existing = JSON.parse(await fs.readFile(requestPath, "utf8"));
    if (JSON.stringify(existing) !== JSON.stringify(requestRecord)) {
      throw new Error(`Existing ${relative(requestPath)} does not match this experiment.`);
    }
  }

  const results = await readResults();
  for (let candidateIndex = BATCH_START; candidateIndex <= batchEnd; candidateIndex += 1) {
    const result = await generate(candidateIndex, referenceBytes);
    results.push(result);
    await writeJson(path.join(RUN, "results.json"), {
      runId: RUN_ID,
      results
    });
  }
  console.log(`Saved arm-correction candidates ${BATCH_START}-${batchEnd} under ${relative(CANDIDATES)}`);
}

await main();
