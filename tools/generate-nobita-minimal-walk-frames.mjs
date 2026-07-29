#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.GAME_SERVICE_URL || "http://180.76.242.105:2201";
const TOKEN = process.env.GAME_SERVICE_TOKEN;
const RUN_ID = process.env.NOBITA_MINIMAL_WALK_RUN || "2026-07-21-nobita-minimal-walk-r1";
const RUN = path.join(ROOT, "artifacts", "profile-sprite-review", RUN_ID);
const REFERENCE = path.join(
  ROOT,
  "artifacts",
  "profile-sprite-review",
  "final-directional-references",
  "nobita",
  "nobita-direction-down-reference.png"
);
const VARIANTS = Number(process.env.NOBITA_MINIMAL_WALK_VARIANTS || 2);
const SEED_BASE = Number(process.env.NOBITA_MINIMAL_WALK_SEED_BASE || 60000);

const poses = [
  {
    id: "left-leg-forward",
    prompt: "把参考图中的野比大雄改成自然走路姿势，左腿向前、右腿向后、右臂向前、左臂向后。"
  },
  {
    id: "right-leg-forward",
    prompt: "把参考图中的野比大雄改成自然走路姿势，右腿向前、左腿向后、左臂向前、右臂向后。"
  }
];

const mkdir = (directory) => fs.mkdir(directory, { recursive: true });

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
      if (job.state !== "succeeded") throw new Error(`${jobId}: ${job.error || job.state}`);
      return job;
    }
    if (Date.now() - started > 1_250_000) throw new Error(`${jobId} timed out.`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function generate(pose, poseIndex, variantIndex) {
  const outputDir = path.join(RUN, "candidates", pose.id);
  const outputPath = path.join(outputDir, `${pose.id}-v${variantIndex + 1}.png`);
  await mkdir(outputDir);
  await fs.writeFile(`${outputPath}.prompt.txt`, `${pose.prompt}\n`);

  const form = new FormData();
  form.set(
    "request",
    JSON.stringify({
      mode: "i2i",
      prompt: pose.prompt,
      width: 1024,
      height: 1024,
      seed: SEED_BASE + poseIndex * 1000 + variantIndex,
      num_steps: 4,
      guidance: 1.0,
      prompt_upsampling: false,
      num_images: 1,
      format: "png"
    })
  );
  const referenceBytes = await fs.readFile(REFERENCE);
  form.append("images", new Blob([referenceBytes], { type: "image/png" }), path.basename(REFERENCE));

  const queued = await requestJson(`${BASE_URL}/v1/flux2/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form
  });
  console.log(`submitted ${pose.id} v${variantIndex + 1} (${queued.job_id})`);
  const job = await poll(queued.job_id);
  const artifact = (job.artifacts || []).find((entry) => /\.(png|webp|jpe?g)$/i.test(entry.filename));
  if (!artifact) throw new Error(`No image artifact returned for ${queued.job_id}`);
  const url = artifact.url.startsWith("http") ? artifact.url : `${BASE_URL}${artifact.url}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!response.ok) throw new Error(`Artifact download failed: ${response.status}`);
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  await fs.writeFile(`${outputPath}.job.json`, `${JSON.stringify(job, null, 2)}\n`);
  return {
    pose: pose.id,
    variant: variantIndex + 1,
    seed: SEED_BASE + poseIndex * 1000 + variantIndex,
    prompt: pose.prompt,
    jobId: queued.job_id,
    output: path.relative(ROOT, outputPath),
    reference: path.relative(ROOT, REFERENCE)
  };
}

async function main() {
  if (!TOKEN) throw new Error("GAME_SERVICE_TOKEN is required and is not persisted.");
  if (!Number.isInteger(VARIANTS) || VARIANTS < 1) throw new Error("VARIANTS must be a positive integer.");
  await fs.access(REFERENCE);
  await mkdir(RUN);
  const spec = await requestJson(`${BASE_URL}/v1/spec.json`);
  await fs.writeFile(path.join(RUN, "service-spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
  await fs.writeFile(
    path.join(RUN, "prompts.json"),
    `${JSON.stringify({ runId: RUN_ID, reference: path.relative(ROOT, REFERENCE), variants: VARIANTS, poses }, null, 2)}\n`
  );

  const results = [];
  for (let poseIndex = 0; poseIndex < poses.length; poseIndex += 1) {
    for (let variantIndex = 0; variantIndex < VARIANTS; variantIndex += 1) {
      results.push(await generate(poses[poseIndex], poseIndex, variantIndex));
    }
  }
  await fs.writeFile(path.join(RUN, "results.json"), `${JSON.stringify({ runId: RUN_ID, results }, null, 2)}\n`);
  console.log(`Saved ${results.length} minimal single-frame candidates under ${path.relative(ROOT, RUN)}`);
}

await main();
