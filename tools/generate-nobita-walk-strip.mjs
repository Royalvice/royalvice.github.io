#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.GAME_SERVICE_URL || "http://180.76.242.105:2201";
const TOKEN = process.env.GAME_SERVICE_TOKEN;
const RUN_ID = process.env.NOBITA_WALK_STRIP_RUN || "2026-07-20-nobita-walk-strip-r1";
const RUN = path.join(ROOT, "artifacts", "profile-sprite-review", RUN_ID);
const WIDTH = 1024;
const HEIGHT = 576;
const DIRECTION_FILTER = process.env.NOBITA_WALK_DIRECTION || null;
const SEED_BASE = Number(process.env.NOBITA_WALK_SEED_BASE || 24100);
const POSE_GUIDE_ROOT = process.env.NOBITA_WALK_POSE_GUIDE_ROOT
  ? path.resolve(ROOT, process.env.NOBITA_WALK_POSE_GUIDE_ROOT)
  : null;
const POSE_GUIDE_FIRST = process.env.NOBITA_WALK_POSE_GUIDE_FIRST === "1";
const GENERATE_POSE_SOURCE = process.env.NOBITA_WALK_GENERATE_POSE_SOURCE === "1";

const REFERENCE_ROOT = process.env.NOBITA_WALK_REFERENCE_ROOT
  ? path.resolve(ROOT, process.env.NOBITA_WALK_REFERENCE_ROOT)
  : path.join(
      ROOT,
      "artifacts",
      "profile-sprite-review",
      "final-directional-references",
      "nobita"
    );

const directions = [
  {
    id: "down",
    label: "DOWN front view",
    reference: "nobita-direction-down-reference.png",
    poseSourcePrompt: [
      "生成一张 1024×576 横向 1×2 2D pixel sprite pose reference。画面只有两个完全相同的无身份儿童人偶，严格正面，圆形无五官头部、蓝色短袖上衣、深蓝短裤、白鞋，尺寸与 baseline 一致。",
      "画布左边人偶：画面左腿向下前方落地，右腿向上后方落地；右臂向前，左臂向后。画布右边人偶：采用左边姿势的精确 horizontal mirror，右腿向下前方落地，左腿向上后方落地；左臂向前，右臂向后。",
      "两幅都是小步慢走 contact pose，四肢清楚分离，连续纯色 #00FF00 chroma-key 背景。"
    ].join(" "),
    prompt: [
      "上传图已经在横向 1×2 画布中放好两个完全相同的《哆啦A梦》野比大雄正面。把它们编辑成两张 2D pixel walking key poses；严格保留两边原有的闭嘴正脸、眼镜、发型、躯干、服装、尺寸、位置和 baseline，只重新摆放手臂与腿。",
      "画布左边的大雄做自然小步 contact pose：画面左侧鞋向下前方落地，画面右侧鞋向上后方落地；画面右侧手臂向前，画面左侧手臂向后。",
      "画布右边的大雄采用左边姿势的精确 horizontal mirror：画面右侧鞋向下前方落地，画面左侧鞋向上后方落地，双臂也左右互换；头脸仍严格正面。两幅双脚着地，连续纯色 #00FF00 chroma-key 背景。"
    ].join(" ")
  },
  {
    id: "up",
    label: "UP back view",
    reference: "nobita-direction-up-reference.png",
    poseSourcePrompt: [
      "生成一张 1024×576 横向 1×2 2D pixel sprite pose reference。画面只有两个完全相同的无身份儿童人偶，严格正背面并朝画面上方，圆形头部、蓝色短袖上衣、深蓝短裤、白鞋，尺寸与 baseline 一致。",
      "画布左边人偶做自然小步 contact pose，画布右边人偶采用左边姿势的精确 horizontal mirror；左右腿和左右臂同时换边，双脚落地。",
      "两幅四肢清楚分离，连续纯色 #00FF00 chroma-key 背景。"
    ].join(" "),
    prompt: [
      "上传图已经在横向 1×2 画布中放好两个完全相同的《哆啦A梦》野比大雄背面。把它们编辑成两张 2D pixel walking key poses；严格保留两边原有的后脑、发型、躯干、衣背、尺寸、位置和 baseline，只重新摆放手臂与腿，两个人始终正背面朝画面上方。",
      "画布左边的大雄做自然小步 contact pose：画面左侧鞋向上前方落地，画面右侧鞋向下后方落地；画面右侧手臂向前，画面左侧手臂向后。",
      "画布右边的大雄采用左边姿势的精确 horizontal mirror：画面右侧鞋向上前方落地，画面左侧鞋向下后方落地，双臂也左右互换；后脑和衣背仍严格正背面。两幅双脚着地，连续纯色 #00FF00 chroma-key 背景。"
    ].join(" ")
  },
  {
    id: "left",
    label: "LEFT strict profile",
    reference: "nobita-direction-left-reference.png",
    poseSourcePrompt: [
      "生成一张 1024×576 横向 1×2 2D pixel sprite pose reference。画面只有两个完全相同的无身份儿童人偶，严格左侧面，圆形无五官头部、蓝色短袖上衣、深蓝短裤、白鞋，尺寸与 baseline 一致。",
      "画布左边人偶是迈步 contact pose，前脚向左、后脚向右，双臂反向摆动。画布右边人偶是紧接着的 passing pose，支撑脚在身体下方，另一只脚贴地经过，两腿靠拢。",
      "两幅鼻尖方向都朝左，连续纯色 #00FF00 chroma-key 背景。"
    ].join(" "),
    prompt: [
      "上传图已经在横向 1×2 画布中放好两个完全相同的《哆啦A梦》野比大雄左侧面。把它们编辑成两张 2D pixel walking key poses；严格保留两边原有的闭嘴侧脸、鼻尖朝左、眼镜、发型、躯干、服装、尺寸、位置和 baseline，只重新摆放手臂与腿。",
      "画布左边的大雄做 contact pose：前侧鞋向画面左方落地，后侧鞋向右后方落地；前摆手臂朝左，后摆手臂朝右，步幅适中。",
      "画布右边的大雄做紧接着的 passing pose：支撑脚位于身体正下方，另一只脚的脚尖从支撑脚旁贴地经过，两条腿靠拢；两只手臂经过身体两侧的中间位置。两格鼻尖都朝左，连续纯色 #00FF00 chroma-key 背景。"
    ].join(" ")
  }
];

const mkdir = (directory) => fs.mkdir(directory, { recursive: true });

function buildPrompt(direction, poseGuidePath) {
  if (!poseGuidePath) return direction.prompt;
  const roles = POSE_GUIDE_FIRST
    ? "输入图 1 是无身份的 walking pose reference，只负责两个人物的关节、四肢方向和步态差异；它的人偶外观、衣服、材质和背景不进入最终图。输入图 2 只负责野比大雄的身份、像素风格、固定视角和左右布局。"
    : "输入图 1 只负责野比大雄的身份、像素风格、固定视角和左右布局。输入图 2 是无身份的 walking pose reference，只负责两个人物的关节、四肢方向和步态差异；它的人偶外观、衣服、材质和背景不进入最终图。";
  return `${roles} ${direction.prompt}`;
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
    if (Date.now() - started > 1_250_000) {
      throw new Error(`${jobId} timed out.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function generateStrip(direction) {
  const outputDir = path.join(RUN, "candidates", direction.id);
  const outputPath = path.join(outputDir, `nobita-walk-${direction.id}-1x2.png`);
  const canonicalPath = path.join(REFERENCE_ROOT, direction.reference);
  await mkdir(outputDir);
  const poseGuidePath = POSE_GUIDE_ROOT
    ? path.join(POSE_GUIDE_ROOT, `nobita-walk-${direction.id}-pose-guide.png`)
    : null;
  const prompt = GENERATE_POSE_SOURCE
    ? direction.poseSourcePrompt
    : buildPrompt(direction, poseGuidePath);
  await fs.writeFile(`${outputPath}.prompt.txt`, `${prompt}\n`);

  const form = new FormData();
  form.set(
    "request",
    JSON.stringify({
      mode: GENERATE_POSE_SOURCE ? "t2i" : "i2i",
      prompt,
      width: WIDTH,
      height: HEIGHT,
      seed: SEED_BASE + directions.findIndex((item) => item.id === direction.id) * 100,
      num_steps: 4,
      guidance: 1.0,
      prompt_upsampling: false,
      num_images: 1,
      format: "png"
    })
  );
  const references = [];
  const appendImage = async (imagePath) => {
    const bytes = await fs.readFile(imagePath);
    form.append("images", new Blob([bytes], { type: "image/png" }), path.basename(imagePath));
    references.push(path.relative(ROOT, imagePath));
  };
  if (!GENERATE_POSE_SOURCE) {
    if (poseGuidePath && POSE_GUIDE_FIRST) {
      await appendImage(poseGuidePath);
      await appendImage(canonicalPath);
    } else {
      await appendImage(canonicalPath);
      if (poseGuidePath) await appendImage(poseGuidePath);
    }
  }

  const queued = await requestJson(`${BASE_URL}/v1/flux2/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form
  });
  console.log(`submitted 大雄 ${direction.label} 1x2 (${queued.job_id})`);
  const job = await poll(queued.job_id);
  const artifact = (job.artifacts || []).find((entry) => /\.(png|webp|jpe?g)$/i.test(entry.filename));
  if (!artifact) throw new Error(`No image artifact returned for ${queued.job_id}`);
  const url = artifact.url.startsWith("http") ? artifact.url : `${BASE_URL}${artifact.url}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!response.ok) throw new Error(`Artifact download failed: ${response.status}`);
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  await fs.writeFile(`${outputPath}.job.json`, `${JSON.stringify(job, null, 2)}\n`);
  return {
    direction: direction.id,
    output: path.relative(ROOT, outputPath),
    prompt,
    jobId: queued.job_id,
    references
  };
}

async function main() {
  if (!TOKEN) throw new Error("GAME_SERVICE_TOKEN is required and is not persisted.");
  await mkdir(RUN);
  const selected = directions.filter((direction) => !DIRECTION_FILTER || direction.id === DIRECTION_FILTER);
  for (const direction of selected) {
    if (!GENERATE_POSE_SOURCE) {
      await fs.access(path.join(REFERENCE_ROOT, direction.reference));
    }
    if (!GENERATE_POSE_SOURCE && POSE_GUIDE_ROOT) {
      await fs.access(path.join(POSE_GUIDE_ROOT, `nobita-walk-${direction.id}-pose-guide.png`));
    }
  }

  const spec = await requestJson(`${BASE_URL}/v1/spec.json`);
  await fs.writeFile(path.join(RUN, "service-spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
  const allowed = spec?.flux2?.sizes || spec?.flux?.sizes || [];
  if (Array.isArray(allowed) && allowed.length && !allowed.some((size) => size[0] === WIDTH && size[1] === HEIGHT)) {
    throw new Error(`Flux spec does not advertise ${WIDTH}x${HEIGHT}; available sizes: ${JSON.stringify(allowed)}`);
  }

  await fs.writeFile(
    path.join(RUN, "prompts.json"),
    `${JSON.stringify({
      runId: RUN_ID,
      actor: "nobita",
      layout: "1x2 horizontal strip",
      width: WIDTH,
      height: HEIGHT,
      seedBase: SEED_BASE,
      generatePoseSource: GENERATE_POSE_SOURCE,
      poseGuideRoot: POSE_GUIDE_ROOT ? path.relative(ROOT, POSE_GUIDE_ROOT) : null,
      poseGuideFirst: POSE_GUIDE_FIRST,
      generation: GENERATE_POSE_SOURCE
        ? "one independent Flux t2i pose-source job per direction"
        : POSE_GUIDE_ROOT
          ? "one independent Flux i2i job per direction; one paired canonical plus one identity-free pose diagram"
          : "one independent Flux i2i job per direction; one reference image per job",
      strips: selected.map((direction) => ({
        direction: direction.id,
        reference: path.relative(ROOT, path.join(REFERENCE_ROOT, direction.reference)),
        prompt: GENERATE_POSE_SOURCE
          ? direction.poseSourcePrompt
          : buildPrompt(
              direction,
              POSE_GUIDE_ROOT
                ? path.join(POSE_GUIDE_ROOT, `nobita-walk-${direction.id}-pose-guide.png`)
                : null
            )
      }))
    }, null, 2)}\n`
  );

  const results = [];
  for (const direction of selected) {
    results.push(await generateStrip(direction));
  }
  await fs.writeFile(path.join(RUN, "prompts-and-results.json"), `${JSON.stringify({ runId: RUN_ID, strips: results }, null, 2)}\n`);
  console.log(`Saved ${results.length} Nobita 1x2 strips under ${path.relative(ROOT, RUN)}`);
}

await main();
