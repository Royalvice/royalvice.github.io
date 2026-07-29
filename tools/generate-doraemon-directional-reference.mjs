#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BASE_URL = process.env.GAME_SERVICE_URL || "http://180.76.242.105:2201";
const TOKEN = process.env.GAME_SERVICE_TOKEN;
const RUN_ID = process.env.DORAEMON_DIRECTIONAL_RUN || "2026-07-20-doraemon-directional-reference-r1";
const ROUND = process.env.DORAEMON_DIRECTIONAL_ROUND || "r1";
const FILTER = process.env.DORAEMON_DIRECTIONAL_DIRECTION || null;
const COUNT = Math.max(1, Number(process.env.DORAEMON_DIRECTIONAL_COUNT || 1));
const ROOT_RUN = path.join(ROOT, "artifacts", "profile-sprite-review", RUN_ID);
const REFERENCE = path.join(
  ROOT,
  "artifacts",
  "profile-sprite-review",
  "final-front-references",
  "doraemon-front-reference.png"
);
const SIZE = 1024;

const directions = [
  {
    id: "down",
    seed: 14100,
    description:
      "哆啦 A 梦严格面向画面下方，是真正正面朝向观察者的中立站立姿势；圆脸左右对称，双眼同高，红鼻子位于脸部中轴，白色脸部和肚子正面清楚可见，红项圈和金铃铛位于身体中心，两只白脚自然分开并落在同一条水平基线。"
  },
  {
    id: "up",
    seed: 14101,
    description:
      "哆啦 A 梦严格背向观察者并面向画面上方；看到蓝色圆形后脑、蓝色身体背面、红项圈后侧、短圆四肢和两只白脚，头顶轮廓是一条连续平滑的蓝色圆弧，绝对没有耳朵、白色凸起或其他头部器官；身体中轴稳定，脚底落在同一条水平基线；这个方向只表达真实背面轮廓。"
  },
  {
    id: "left",
    seed: 14102,
    description:
      "哆啦 A 梦严格朝画面左侧的真实 profile side view；头部和身体呈清晰侧面轮廓，红鼻子位于最左侧，白色口鼻区域向左突出，只显示一只眼睛和一侧胡须线，另一只眼睛不可见；身体朝左，红项圈和金铃铛保持正确相对位置，短圆四肢和两只白脚完整落地；不是斜向正面。"
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
    "Input image: Image 1 is the only identity reference; preserve the exact Doraemon identity, blue-and-white round body, white face and belly, red nose, red collar, gold bell, short rounded limbs, white feet, proportions and pixel density.",
    "Subject: 哆啦 A 梦，经典蓝白圆形机器人猫，保持无耳、圆脸、短四肢和儿童玩偶般比例。",
    `View and pose: ${direction.description}`,
    "Camera and style: warm 70-degree top-down 2D pixel sprite, crisp pixel clusters, limited palette, stable dark outline, readable at 128px, full body centered with generous padding.",
    "Background: perfectly flat solid #00FF00 chroma-key color, uniform and untextured.",
    "Output: one character, one static directional reference, complete head and feet, no scene lighting, no ground contact shadow, and a clean chroma-key gap beneath both feet."
  ].join(" ");
}

async function generate(direction, candidateIndex) {
  const outputDir = path.join(ROOT_RUN, "candidates", direction.id);
  const suffix = COUNT > 1 ? `${ROUND}-c${candidateIndex + 1}` : ROUND;
  const outputPath = path.join(outputDir, `doraemon-direction-${direction.id}-${suffix}.png`);
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
  form.append("images", new Blob([bytes], { type: "image/png" }), "doraemon-front-reference.png");

  const queued = await requestJson(`${BASE_URL}/v1/flux2/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form
  });
  console.log(`submitted 哆啦 A 梦 ${direction.id} ${suffix} (${queued.job_id})`);
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
    actor: "doraemon",
    reference: path.relative(ROOT, REFERENCE),
    directions: results
  }, null, 2)}\n`);
  console.log(`Saved ${results.length} Doraemon directional references under ${path.relative(ROOT, ROOT_RUN)}`);
}

await main();
