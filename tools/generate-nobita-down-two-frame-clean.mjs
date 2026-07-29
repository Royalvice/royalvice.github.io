#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.GAME_SERVICE_URL || "http://180.76.242.105:2201";
const TOKEN = process.env.GAME_SERVICE_TOKEN;
const MAX_CANDIDATES = 16;
const BATCH_START = Number(process.env.NOBITA_TWO_FRAME_BATCH_START || 1);
const BATCH_SIZE = Number(process.env.NOBITA_TWO_FRAME_BATCH_SIZE || 4);
const FRAME_KEY = process.env.NOBITA_TWO_FRAME_POSE;
const DIRECTION_KEY = process.env.NOBITA_TWO_FRAME_DIRECTION || "down";

const DIRECTIONS = {
  down: {
    runId: "2026-07-22-nobita-down-two-frame-clean-r1",
    referenceName: "nobita-direction-down-reference.png",
    referenceSha256: "c5153e06eff9e628483b29570c7400672030c355bc6c0b0518c2c600c6de2022",
    bodyPhrase: "身子保持正面竖直",
    seedBaseA: 74000,
    seedBaseB: 75000
  },
  left: {
    runId: "2026-07-22-nobita-left-two-frame-clean-r1",
    referenceName: "nobita-direction-left-reference.png",
    referenceSha256: "a999bad373a5b7e8aced59a826daf0502503942e32e0f64ab0e7981fd0121e9b",
    bodyPhrase: "身子保持朝左竖直",
    seedBaseA: 76000,
    seedBaseB: 77000
  },
  up: {
    runId: "2026-07-22-nobita-up-two-frame-clean-r1",
    referenceName: "nobita-direction-up-reference.png",
    referenceSha256: "d19ba29d82a6d89abf901f23853953b7089793060e7bc361a269675f5abb65aa",
    bodyPhrase: "身子保持背面竖直",
    seedBaseA: 78000,
    seedBaseB: 79000
  }
};

const DIRECTION = DIRECTIONS[DIRECTION_KEY];
const RUN_ID = DIRECTION?.runId;
const RUN = RUN_ID
  ? path.join(ROOT, "artifacts", "profile-sprite-review", RUN_ID)
  : null;
const REFERENCE = DIRECTION
  ? path.join(
      ROOT,
      "artifacts",
      "profile-sprite-review",
      "final-directional-references",
      "nobita",
      DIRECTION.referenceName
    )
  : null;
const EXPECTED_REFERENCE_SHA256 = DIRECTION?.referenceSha256;

const FRAMES = {
  a: {
    id: "frame-a",
    label: "角色自身左腿在前",
    prompt: DIRECTION
      ? `把参考图中的人物改成走路姿势，${DIRECTION.bodyPhrase}，人物自身左腿在前、右腿在后、右臂在前、左臂在后，双脚着地。`
      : "",
    seedBase: DIRECTION?.seedBaseA
  },
  b: {
    id: "frame-b",
    label: "角色自身右腿在前",
    prompt: DIRECTION
      ? `把参考图中的人物改成走路姿势，${DIRECTION.bodyPhrase}，人物自身右腿在前、左腿在后、左臂在前、右臂在后，双脚着地。`
      : "",
    seedBase: DIRECTION?.seedBaseB
  }
};

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
  const signature = "89504e470d0a1a0a";
  if (bytes.subarray(0, 8).toString("hex") !== signature) {
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

async function readFrameResults(frameDir) {
  const resultsPath = path.join(frameDir, "results.json");
  if (!(await exists(resultsPath))) return [];
  const parsed = JSON.parse(await fs.readFile(resultsPath, "utf8"));
  return Array.isArray(parsed.results) ? parsed.results : [];
}

async function verifyOrCreateRecords(referenceSha256, referenceSize, frame) {
  const shared = {
    runId: RUN_ID,
    reference: relative(REFERENCE),
    referenceSha256,
    referenceSize,
    inputImageCount: 1,
    prompts: {
      "frame-a": FRAMES.a.prompt,
      "frame-b": FRAMES.b.prompt
    },
    promptUpsampling: false,
    maxCandidatesPerFrame: MAX_CANDIDATES,
    batchSize: 4,
    ...(DIRECTION_KEY === "down" ? {} : { direction: DIRECTION_KEY }),
    leftRightConvention:
      DIRECTION_KEY === "down"
        ? "角色自身左侧对应正面图的画面右侧"
        : "始终按角色自身解剖学左右，不按画面左右",
    inputPolicy: "每个候选只上传同一张对应方向的中立参考图；两帧互不作为输入。"
  };
  const rootRequestPath = path.join(RUN, "request.json");
  if (!(await exists(rootRequestPath))) {
    await writeJson(rootRequestPath, shared);
  } else {
    const existing = JSON.parse(await fs.readFile(rootRequestPath, "utf8"));
    if (JSON.stringify(existing) !== JSON.stringify(shared)) {
      throw new Error(`Existing ${relative(rootRequestPath)} does not match the approved clean request.`);
    }
  }

  const frameDir = path.join(RUN, frame.id);
  const frameRequest = {
    runId: RUN_ID,
    frame: frame.id,
    label: frame.label,
    ...(DIRECTION_KEY === "down" ? {} : { direction: DIRECTION_KEY }),
    reference: relative(REFERENCE),
    referenceSha256,
    referenceSize,
    inputImageCount: 1,
    prompt: frame.prompt,
    requestParams: REQUEST_PARAMS,
    maxCandidates: MAX_CANDIDATES,
    seedBase: frame.seedBase
  };
  const frameRequestPath = path.join(frameDir, "request.json");
  if (!(await exists(frameRequestPath))) {
    await writeJson(frameRequestPath, frameRequest);
  } else {
    const existing = JSON.parse(await fs.readFile(frameRequestPath, "utf8"));
    if (JSON.stringify(existing) !== JSON.stringify(frameRequest)) {
      throw new Error(`Existing ${relative(frameRequestPath)} does not match ${frame.id}.`);
    }
  }
}

async function generate(candidateIndex, referenceBytes, frame, frameDir) {
  const stem = `candidate-${String(candidateIndex).padStart(2, "0")}`;
  const outputPath = path.join(frameDir, `${stem}.png`);
  const promptPath = path.join(frameDir, `${stem}.prompt.txt`);
  const jobPath = path.join(frameDir, `${stem}.job.json`);
  if ((await exists(outputPath)) || (await exists(promptPath)) || (await exists(jobPath))) {
    throw new Error(`Refusing to overwrite ${frame.id} candidate ${candidateIndex}.`);
  }

  const request = {
    ...REQUEST_PARAMS,
    prompt: frame.prompt,
    seed: frame.seedBase + candidateIndex - 1
  };
  if (request.mode !== "i2i" || request.prompt_upsampling !== false || request.num_images !== 1) {
    throw new Error("The clean single-image i2i request invariants were violated.");
  }
  await fs.writeFile(promptPath, `${frame.prompt}\n`);

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
  console.log(`submitted ${frame.id} candidate ${candidateIndex} (${queued.job_id})`);
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
    prompt: frame.prompt,
    promptUpsampling: false,
    inputImageCount: 1,
    jobId: queued.job_id,
    output: relative(outputPath),
    outputSha256: crypto.createHash("sha256").update(outputBytes).digest("hex"),
    outputSize,
    reference: relative(REFERENCE),
    referenceSha256: EXPECTED_REFERENCE_SHA256
  };
}

async function main() {
  if (!TOKEN) throw new Error("GAME_SERVICE_TOKEN is required and is not persisted.");
  if (!Object.hasOwn(DIRECTIONS, DIRECTION_KEY)) {
    throw new Error("NOBITA_TWO_FRAME_DIRECTION must be exactly 'down', 'left', or 'up'.");
  }
  if (!Object.hasOwn(FRAMES, FRAME_KEY)) {
    throw new Error("NOBITA_TWO_FRAME_POSE must be exactly 'a' or 'b'.");
  }
  if (!Number.isInteger(BATCH_START) || BATCH_START < 1) {
    throw new Error("NOBITA_TWO_FRAME_BATCH_START must be a positive integer.");
  }
  if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE < 1 || BATCH_SIZE > 4) {
    throw new Error("NOBITA_TWO_FRAME_BATCH_SIZE must be an integer from 1 to 4.");
  }
  const batchEnd = BATCH_START + BATCH_SIZE - 1;
  if (batchEnd > MAX_CANDIDATES) {
    throw new Error(`Candidate range must end at or before ${MAX_CANDIDATES}.`);
  }

  const frame = FRAMES[FRAME_KEY];
  const frameDir = path.join(RUN, frame.id);
  const referenceBytes = await fs.readFile(REFERENCE);
  const referenceSha256 = crypto.createHash("sha256").update(referenceBytes).digest("hex");
  if (referenceSha256 !== EXPECTED_REFERENCE_SHA256) {
    throw new Error(`Reference SHA256 changed: ${referenceSha256}`);
  }
  const referenceSize = pngDimensions(referenceBytes);
  if (referenceSize[0] !== 1024 || referenceSize[1] !== 1024) {
    throw new Error(`Reference must be 1024x1024, got ${referenceSize.join("x")}.`);
  }

  await fs.mkdir(frameDir, { recursive: true });
  await verifyOrCreateRecords(referenceSha256, referenceSize, frame);
  const specPath = path.join(RUN, "service-spec.json");
  if (!(await exists(specPath))) {
    await writeJson(specPath, await requestJson(`${BASE_URL}/v1/spec.json`));
  }

  const results = await readFrameResults(frameDir);
  for (let candidateIndex = BATCH_START; candidateIndex <= batchEnd; candidateIndex += 1) {
    const result = await generate(candidateIndex, referenceBytes, frame, frameDir);
    results.push(result);
    await writeJson(path.join(frameDir, "results.json"), {
      runId: RUN_ID,
      frame: frame.id,
      results
    });
  }
  console.log(`Saved ${frame.id} candidates ${BATCH_START}-${batchEnd} under ${relative(frameDir)}`);
}

await main();
