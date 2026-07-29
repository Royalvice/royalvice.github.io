#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BASE_URL = process.env.GAME_SERVICE_URL || "http://180.76.242.105:2201";
const TOKEN = process.env.GAME_SERVICE_TOKEN;
const RUN_ID = process.env.PROFILE_SPRITE_I2I_TEST_RUN || "2026-07-20-i2i-single-frame-r1";
const RUN = path.join(ROOT, "artifacts", "profile-sprite-review", RUN_ID);
const REF_ROOT = path.join(ROOT, "artifacts", "profile-sprite-review", "final-front-references");
const SIZE = 1024;
const ROUND = process.env.PROFILE_SPRITE_I2I_TEST_ROUND || "r1";
const ACTOR_FILTER = process.env.PROFILE_SPRITE_I2I_TEST_ACTOR || null;
const FRAME = process.env.PROFILE_SPRITE_I2I_TEST_FRAME || "idle";

const FRAME_ACTIONS = {
  idle: "中立站立 idle pose：双臂自然下垂，双脚完整落地，身体重心稳定。",
  "down-contact": "向画面下方行走的第一帧 contact pose：左脚向前并接触脚底 baseline，右脚向后并略微抬起，双臂与腿反向摆动，重心落在左脚。"
};

const actors = [
  {
    id: "nobita",
    name: "大雄",
    reference: "nobita-front-reference.png",
    key: "#00FF00",
    identity: "大雄：儿童体型，黑色短发，圆形黑框眼镜，黄色上衣，深蓝短裤，白袜和浅蓝鞋。"
  },
  {
    id: "doraemon",
    name: "哆啦A梦",
    reference: "doraemon-front-reference.png",
    key: "#00FF00",
    identity: "哆啦A梦：蓝白圆形机器人猫，无耳，红鼻子，白色脸部和肚子，红项圈，金铃铛，短圆四肢和白脚。"
  },
  {
    id: "shizuka",
    name: "静香",
    reference: "shizuka-front-reference.png",
    key: "#00FFFF",
    identity: "静香：儿童体型，黑色双低辫，粉白上衣，红色格纹裙，白袜和红鞋，温和的儿童脸型。"
  },
  {
    id: "gian",
    name: "胖虎",
    reference: "gian-front-reference.png",
    key: "#00FF00",
    identity: "胖虎：儿童体型但明显宽肩宽躯干，方下颌，短黑发，粗眉，橙色上衣和深色横条，蓝色下装，浅蓝鞋。"
  },
  {
    id: "suneo",
    name: "小夫",
    reference: "suneo-front-reference.png",
    key: "#0000FF",
    identity: "小夫：五人中偏瘦小，横向伸出的黑色三尖发，尖鼻侧脸，绿色格纹上衣，橙棕短裤，白袜和绿色鞋。"
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

async function submit(actor, index) {
  const referencePath = path.join(REF_ROOT, actor.reference);
  const outputDir = path.join(RUN, "candidates", actor.id, FRAME);
  const outputPath = path.join(outputDir, `${actor.id}-${FRAME}-i2i-${ROUND}.png`);
  const action = FRAME_ACTIONS[FRAME];
  if (!action) throw new Error(`Unknown frame: ${FRAME}`);
  const prompt = [
    "Use case: stylized-concept.",
    "Asset type: one isolated 2D pixel sprite frame for a game character.",
    `Input image: ${actor.name} final identity reference; preserve the identity exactly.`,
    `Subject: ${actor.identity}`,
    `Pose: one single-frame action only. ${action} Keep the complete head-to-feet silhouette.`,
    "Camera: strict high three-quarter overhead view around 70 degrees, matching a warm top-down pixel research dungeon; show the top planes of the head, shoulders and shoes, with a stable foot baseline.",
    "Style: crisp deliberate pixel clusters, limited warm palette, stable dark outline, readable at 128px, consistent upper-left light.",
    `Background: perfectly flat solid ${actor.key} chroma-key color for local removal, no shadow or gradient.`,
    "Create exactly one character and one pose in one image. No sprite sheet, no grid, no room, no furniture, no prop, no second character, no text, no logo, no watermark, no border, no cropped head or feet, no extra limbs."
  ].join(" ");

  await mkdir(outputDir);
  await fs.writeFile(`${outputPath}.prompt.txt`, `${prompt}\n`);
  const form = new FormData();
  form.set("request", JSON.stringify({
    mode: "i2i",
    prompt,
    width: SIZE,
    height: SIZE,
    seed: 12000 + index,
    num_steps: 4,
    guidance: 1,
    prompt_upsampling: false,
    num_images: 1,
    format: "png"
  }));
  const bytes = await fs.readFile(referencePath);
  form.append("images", new Blob([bytes], { type: "image/png" }), actor.reference);
  const queued = await requestJson(`${BASE_URL}/v1/flux2/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form
  });
  console.log(`submitted ${actor.name} ${queued.job_id}`);
  const job = await poll(queued.job_id);
  const artifact = (job.artifacts || []).find((entry) => /\.(png|webp|jpe?g)$/i.test(entry.filename));
  if (!artifact) throw new Error(`No image artifact returned for ${queued.job_id}`);
  const url = artifact.url.startsWith("http") ? artifact.url : `${BASE_URL}${artifact.url}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!response.ok) throw new Error(`Artifact download failed: ${response.status}`);
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  await fs.writeFile(`${outputPath}.job.json`, `${JSON.stringify(job, null, 2)}\n`);
  return { actor: actor.id, name: actor.name, reference: actor.reference, output: path.relative(ROOT, outputPath), prompt, jobId: queued.job_id };
}

async function main() {
  if (!TOKEN) throw new Error("GAME_SERVICE_TOKEN is required and is not persisted.");
  await mkdir(RUN);
  const spec = await requestJson(`${BASE_URL}/v1/spec.json`);
  await fs.writeFile(path.join(RUN, "service-spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
  const selectedActors = ACTOR_FILTER ? actors.filter((actor) => actor.id === ACTOR_FILTER) : actors;
  if (!selectedActors.length) throw new Error(`Unknown actor filter: ${ACTOR_FILTER}`);
  const results = [];
  for (let index = 0; index < selectedActors.length; index += 1) results.push(await submit(selectedActors[index], index));
  await fs.writeFile(path.join(RUN, `prompts-and-results-${FRAME}-${ROUND}.json`), `${JSON.stringify({ runId: RUN_ID, round: ROUND, frame: FRAME, results }, null, 2)}\n`);
  console.log(`Saved ${results.length} independent i2i frame candidates under ${path.relative(ROOT, RUN)}`);
}

await main();
