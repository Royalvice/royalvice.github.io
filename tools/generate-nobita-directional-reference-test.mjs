#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BASE_URL = process.env.GAME_SERVICE_URL || "http://180.76.242.105:2201";
const TOKEN = process.env.GAME_SERVICE_TOKEN;
const RUN_ID = process.env.NOBITA_DIRECTIONAL_TEST_RUN || "2026-07-20-nobita-directional-reference-r1";
const RUN = path.join(ROOT, "artifacts", "profile-sprite-review", RUN_ID);
const REFERENCE = path.join(ROOT, "artifacts", "profile-sprite-review", "final-front-references", "nobita-front-reference.png");
const ROUND = process.env.NOBITA_DIRECTIONAL_TEST_ROUND || "r1";
const DIRECTION_FILTER = process.env.NOBITA_DIRECTIONAL_TEST_DIRECTION || null;
const CANDIDATE_COUNT = Math.max(1, Number(process.env.NOBITA_DIRECTIONAL_TEST_COUNT || 1));
const SIZE = 1024;

const identity = "大雄：儿童体型，黑色短发，圆形黑框眼镜，黄色短袖上衣，深蓝短裤，白袜和浅蓝鞋；保持同一个经典人物身份、同一身体比例和同一像素密度。";

const directions = [
  {
    id: "down",
    seed: 13100,
    view: "DOWN-facing canonical reference：严格正面朝向画面下方和观察者，镜头与人物身体中轴对齐，左右肩膀对称，双眼和双镜片同高，鼻子位于脸部中央；脸部、圆形黑框眼镜、黄色上衣正面和鞋尖清楚可见，双脚自然分开并完整落地。"
  },
  {
    id: "up",
    seed: 13101,
    view: "UP-facing canonical reference：大雄背向观察者并面向画面上方，只显示黑色短发后脑、黄色上衣背面、深蓝短裤背面、白袜和浅蓝鞋后部；保持真实背面轮廓，不绘制脸、眼镜或正面五官。"
  },
  {
    id: "left",
    seed: 13102,
    view: "LEFT-facing canonical reference：大雄严格朝画面左侧的真实侧面，鼻子和嘴朝左，圆形眼镜显示合理侧框，黑色短发、黄色上衣、深蓝短裤和两只鞋保持完整；这是中立站立侧面，不是斜向正面。"
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

async function generate(direction, candidateIndex) {
  const outputDir = path.join(RUN, "candidates", direction.id);
  const suffix = CANDIDATE_COUNT > 1 ? `${ROUND}-c${candidateIndex + 1}` : ROUND;
  const outputPath = path.join(outputDir, `nobita-direction-${direction.id}-${suffix}.png`);
  const prompt = [
    "Use case: stylized-concept.",
    "Asset type: one isolated 2D pixel sprite directional canonical reference.",
    "Input image: the only identity reference is the transparent final Nobita reference image; preserve its face, glasses, hair, clothing colors, body scale and pixel density.",
    `Subject identity: ${identity}`,
    `Required view: ${direction.view}`,
    "Pose: one neutral standing reference pose, not a walk frame; both feet planted on one stable foot baseline, complete head-to-feet silhouette.",
    "Camera and style: consistent warm top-down research-dungeon pixel style, crisp deliberate pixel clusters, limited palette, stable dark outline, readable at 128px, mild high-angle view while preserving the required direction.",
    "Background: perfectly flat solid #00FF00 chroma-key color for local alpha removal.",
    "Create exactly one character and one direction in one image. No sprite sheet, no grid, no room, no floor, no cast shadow, no reflection, no furniture, no prop, no second character, no text, no logo, no watermark, no border, no cropped head or feet, no extra limbs."
  ].join(" ");
  await mkdir(outputDir);
  await fs.writeFile(`${outputPath}.prompt.txt`, `${prompt}\n`);
  const form = new FormData();
  form.set("request", JSON.stringify({
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
  }));
  const bytes = await fs.readFile(REFERENCE);
  form.append("images", new Blob([bytes], { type: "image/png" }), "nobita-front-reference.png");
  const queued = await requestJson(`${BASE_URL}/v1/flux2/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form
  });
  console.log(`submitted 大雄 ${direction.id} ${queued.job_id}`);
  const job = await poll(queued.job_id);
  const artifact = (job.artifacts || []).find((entry) => /\.(png|webp|jpe?g)$/i.test(entry.filename));
  if (!artifact) throw new Error(`No image artifact returned for ${queued.job_id}`);
  const url = artifact.url.startsWith("http") ? artifact.url : `${BASE_URL}${artifact.url}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!response.ok) throw new Error(`Artifact download failed: ${response.status}`);
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  await fs.writeFile(`${outputPath}.job.json`, `${JSON.stringify(job, null, 2)}\n`);
  return { direction: direction.id, output: path.relative(ROOT, outputPath), prompt, jobId: queued.job_id };
}

async function main() {
  if (!TOKEN) throw new Error("GAME_SERVICE_TOKEN is required and is not persisted.");
  await mkdir(RUN);
  const spec = await requestJson(`${BASE_URL}/v1/spec.json`);
  await fs.writeFile(path.join(RUN, "service-spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
  const selectedDirections = DIRECTION_FILTER ? directions.filter((direction) => direction.id === DIRECTION_FILTER) : directions;
  if (!selectedDirections.length) throw new Error(`Unknown direction filter: ${DIRECTION_FILTER}`);
  const results = [];
  for (const direction of selectedDirections) {
    for (let candidateIndex = 0; candidateIndex < CANDIDATE_COUNT; candidateIndex += 1) {
      results.push(await generate(direction, candidateIndex));
    }
  }
  const resultName = DIRECTION_FILTER ? `prompts-and-results-${DIRECTION_FILTER}-${ROUND}.json` : "prompts-and-results.json";
  await fs.writeFile(path.join(RUN, resultName), `${JSON.stringify({ runId: RUN_ID, actor: "nobita", reference: path.relative(ROOT, REFERENCE), directions: results }, null, 2)}\n`);
  console.log(`Saved ${results.length} independent Nobita directional references under ${path.relative(ROOT, RUN)}`);
}

await main();
