#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BASE_URL = process.env.GAME_SERVICE_URL || "http://180.76.242.105:2201";
const TOKEN = process.env.GAME_SERVICE_TOKEN;
const RUN_ID = process.env.GIAN_DIRECTIONAL_RUN || "2026-07-20-gian-directional-reference-r1";
const ROUND = process.env.GIAN_DIRECTIONAL_ROUND || "r1";
const FILTER = process.env.GIAN_DIRECTIONAL_DIRECTION || null;
const COUNT = Math.max(1, Number(process.env.GIAN_DIRECTIONAL_COUNT || 1));
const ROOT_RUN = path.join(ROOT, "artifacts", "profile-sprite-review", RUN_ID);
const REFERENCE = path.join(
  ROOT,
  "artifacts",
  "profile-sprite-review",
  "final-front-references",
  "gian-front-reference.png"
);
const SIZE = 1024;

const directions = [
  {
    id: "down",
    seed: 16100,
    description:
      "胖虎严格面向画面下方，镜头位于身体正中，头部和躯干不向左或右旋转，是真正对称正面朝向观察者的中立站立姿势；保持儿童角色但明显比其他孩子更高壮，左右肩线、双眼、鼻子和方下颌中轴对称，宽肩、宽躯干、大手、粗眉和短黑发清楚可见，橙色上衣的深色横向中间条、蓝色长裤和浅青色鞋正面完整，双脚稳定落在同一条水平基线。"
  },
  {
    id: "up",
    seed: 16101,
    description:
      "胖虎严格背向观察者并面向画面上方；看到宽肩宽躯干、短黑发后侧、橙色上衣背面和深色横向中间条、蓝色长裤背面与浅青色鞋后部，保持儿童体型和明显的壮实轮廓，双脚落在同一条水平基线；这个方向只表达真实背面。"
  },
  {
    id: "left",
    seed: 16102,
    description:
      "胖虎严格朝画面左侧的正交 profile side view，身体和头部完全侧向左方，不朝镜头转动；只显示一只眼睛，鼻子、嘴和方下颌轮廓全部朝左，远侧眼睛、远侧肩膀和远侧手臂被身体遮住，近侧手臂垂直落下，胸前深色横向中间条在侧面只呈一条窄切片，近侧腿和远侧腿前后重叠；短黑发和宽厚颈肩保持胖虎身份，蓝色长裤和浅青色鞋完整；这是纯侧面剪影，不是三分之四正面。"
  }
];

const mkdir = (directory) => fs.mkdir(directory, { recursive: true });

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 1200)}`);
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

function buildPrompt(direction) {
  return [
    "Use case: stylized-concept.",
    "Asset type: isolated 2D pixel sprite directional canonical reference for a top-down research-room game.",
    "Input image: Image 1 is the only identity reference; preserve the exact Gian identity, broad child proportions, wide shoulders, wide torso, large hands, square jaw, thick eyebrows, short black hair, orange shirt with dark horizontal middle stripe, blue pants, light cyan shoes and pixel density.",
    "Subject: 胖虎，经典儿童体型但明显高壮宽厚，方下颌、大脸颊、粗眉、短黑发，橙色上衣带深色横向中间条，蓝色长裤和浅青色鞋。",
    `View and pose: ${direction.description}`,
    "Camera and style: warm 70-degree top-down 2D pixel sprite, crisp pixel clusters, limited palette, stable dark outline, readable at 128px, full body centered with generous padding.",
    "Background: perfectly flat solid #00FF00 chroma-key color, uniform and untextured.",
    "Output: one character, one static directional reference, complete head and feet, no scene lighting, no ground contact shadow, and a clean chroma-key gap beneath both feet."
  ].join(" ");
}

async function generate(direction, candidateIndex) {
  const outputDir = path.join(ROOT_RUN, "candidates", direction.id);
  const suffix = COUNT > 1 ? `${ROUND}-c${candidateIndex + 1}` : ROUND;
  const outputPath = path.join(outputDir, `gian-direction-${direction.id}-${suffix}.png`);
  const prompt = buildPrompt(direction);
  await mkdir(outputDir);
  await fs.writeFile(`${outputPath}.prompt.txt`, `${prompt}\n`);

  const form = new FormData();
  form.set(
    "request",
    JSON.stringify({
      mode: "i2i",
      prompt,
      width: SIZE,
      height: SIZE,
      seed: direction.seed + candidateIndex,
      num_steps: 4,
      guidance: 1,
      prompt_upsampling: false,
      num_images: 1,
      format: "png"
    })
  );
  const bytes = await fs.readFile(REFERENCE);
  form.append("images", new Blob([bytes], { type: "image/png" }), "gian-front-reference.png");

  const queued = await requestJson(`${BASE_URL}/v1/flux2/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form
  });
  console.log(`submitted 胖虎 ${direction.id} ${suffix} (${queued.job_id})`);
  const job = await poll(queued.job_id);
  const artifact = (job.artifacts || []).find((entry) => /\.(png|webp|jpe?g)$/i.test(entry.filename));
  if (!artifact) throw new Error(`No image artifact returned for ${queued.job_id}`);
  const url = artifact.url.startsWith("http") ? artifact.url : `${BASE_URL}${artifact.url}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!response.ok) throw new Error(`Artifact download failed: ${response.status}`);
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  await fs.writeFile(`${outputPath}.job.json`, `${JSON.stringify(job, null, 2)}\n`);
  return { direction: direction.id, candidate: candidateIndex + 1, output: path.relative(ROOT, outputPath), prompt, jobId: queued.job_id };
}

async function main() {
  if (!TOKEN) throw new Error("GAME_SERVICE_TOKEN is required and is not persisted.");
  await fs.access(REFERENCE);
  await mkdir(ROOT_RUN);
  const spec = await requestJson(`${BASE_URL}/v1/spec.json`);
  await fs.writeFile(path.join(ROOT_RUN, "service-spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
  const selected = FILTER ? directions.filter((direction) => direction.id === FILTER) : directions;
  if (!selected.length) throw new Error(`Unknown direction filter: ${FILTER}`);
  const results = [];
  for (const direction of selected) {
    for (let index = 0; index < COUNT; index += 1) results.push(await generate(direction, index));
  }
  const resultName = FILTER ? `prompts-and-results-${FILTER}-${ROUND}.json` : "prompts-and-results.json";
  await fs.writeFile(path.join(ROOT_RUN, resultName), `${JSON.stringify({
    runId: RUN_ID,
    actor: "gian",
    reference: path.relative(ROOT, REFERENCE),
    directions: results
  }, null, 2)}\n`);
  console.log(`Saved ${results.length} Gian directional references under ${path.relative(ROOT, ROOT_RUN)}`);
}

await main();
