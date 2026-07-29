#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.GAME_SERVICE_URL || "http://180.76.242.105:2201";
const TOKEN = process.env.GAME_SERVICE_TOKEN;
const RUN_ID = process.env.NOBITA_WALK_RUN || "2026-07-20-nobita-walk-4frame-r1";
const RUN = path.join(ROOT, "artifacts", "profile-sprite-review", RUN_ID);
const SIZE = 1024;
const FRAME_MODE = process.env.NOBITA_WALK_FRAME_MODE || "four";
const GENERATION_MODE = process.env.NOBITA_WALK_GENERATION_MODE || "i2i";
const DIRECTION_FILTER = process.env.NOBITA_WALK_DIRECTION || null;
const FRAME_FILTER = new Set(
  (process.env.NOBITA_WALK_FRAMES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const SEED_OFFSET = Number(process.env.NOBITA_WALK_SEED_OFFSET || 0);
const PROMPT_NOTE = process.env.NOBITA_WALK_PROMPT_NOTE || "";
const COMPACT_PROMPT = process.env.NOBITA_WALK_COMPACT_PROMPT === "1";
const SKIP_FRAME_DESCRIPTION = process.env.NOBITA_WALK_SKIP_FRAME_DESCRIPTION === "1";
const MINIMAL_PROMPT = process.env.NOBITA_WALK_MINIMAL_PROMPT === "1";
const MINIMAL_GREEN = process.env.NOBITA_WALK_MINIMAL_GREEN === "1";
const BIOMECH_PROMPT = process.env.NOBITA_WALK_BIOMECH_PROMPT === "1";
const BIOMECH_V2_PROMPT = process.env.NOBITA_WALK_BIOMECH_V2_PROMPT === "1";
const BIOMECH_V3_PROMPT = process.env.NOBITA_WALK_BIOMECH_V3_PROMPT === "1";
// Optional single-image override used only for isolated review experiments.
// It deliberately accepts one input image, never a pair, so a frame can be
// regenerated from a previously inspected pose without changing production
// references or the runtime asset pipeline.
const REFERENCE_OVERRIDE = process.env.NOBITA_WALK_REFERENCE_OVERRIDE || null;
const REFERENCE_ROOT = path.join(
  ROOT,
  "artifacts",
  "profile-sprite-review",
  "final-directional-references",
  "nobita"
);

const identity =
  "大雄（Nobita）：儿童体型，黑色短发，圆形黑框眼镜，黄色短袖上衣，深蓝短裤，白袜和浅蓝鞋；保持与参考图完全相同的脸型、发型、服装配色、身体高度、像素密度和脚底 pivot。";

const directions = [
  {
    id: "down",
    label: "向画面下方行走",
    seed: 23100,
    reference: "nobita-direction-down-reference.png",
    view:
      "严格 DOWN-facing front view，面向画面下方和观察者，双眼、双圆形镜片、鼻子和肩线清楚可见；身体中轴稳定，不旋转成侧面。",
    frames: [
      {
        id: "01-left-contact",
        description:
          "第 1 帧 contact：大雄的左脚向画面下方伸出并落地，右脚留在身体后方；右臂向左前下方摆，左臂向右后上方摆；躯干轻微前倾，重心落在左脚。"
      },
      {
        id: "02-left-passing",
        description:
          "第 2 帧 passing：右脚支撑身体，左腿屈膝从身体下方经过；双脚靠近但不重叠；右臂回到身体右侧，左臂开始向前下方摆；髋部位于两脚正中，身体略微升高。"
      },
      {
        id: "03-right-contact",
        description:
          "第 3 帧 opposite contact：右脚向画面下方伸出并落地，左脚退到身体后方；左臂向右前下方摆，右臂向左后上方摆；重心落在右脚，肩线和头部高度与第 1 帧一致。"
      },
      {
        id: "04-right-passing",
        description:
          "第 4 帧 opposite passing：左脚支撑身体，右腿屈膝从身体下方收回并经过；双脚再次靠近但位置与第 2 帧相反；左臂回到身体左侧，右臂开始向前下方摆；身体准备进入下一步，但不复制第 1 帧。"
      }
    ]
  },
  {
    id: "up",
    label: "向画面上方行走",
    seed: 23200,
    reference: "nobita-direction-up-reference.png",
    view:
      "严格 UP-facing back view，背向观察者并面向画面上方，只显示黑色短发后脑、黄色上衣背面、深蓝短裤背面、白袜和浅蓝鞋；不出现正面五官或眼镜。",
    frames: [
      {
        id: "01-left-contact",
        description:
          "第 1 帧 contact：背面大雄的左脚向画面上方伸出并落地，右脚留在身体下方后侧；右臂向画面左上方摆，左臂向画面右下方摆；肩胛和衣服背面随步伐轻微前倾，重心落在左脚。"
      },
      {
        id: "02-left-passing",
        description:
          "第 2 帧 passing：右脚支撑，左腿屈膝从身体下方经过；双脚靠近但不重叠；右臂回到右侧，左臂开始向左上方摆；黄色上衣背面保持水平，身体略微升高。"
      },
      {
        id: "03-right-contact",
        description:
          "第 3 帧 opposite contact：右脚向画面上方伸出并落地，左脚退到身体下方后侧；左臂向画面右上方摆，右臂向画面左下方摆；重心落在右脚，后脑和肩线高度与第 1 帧一致。"
      },
      {
        id: "04-right-passing",
        description:
          "第 4 帧 opposite passing：左脚支撑，右腿屈膝从身体下方收回并经过；双脚靠近但位置与第 2 帧相反；左臂回到左侧，右臂开始向右上方摆；保持背面连续性，不复制第 1 帧。"
      }
    ]
  },
  {
    id: "left",
    label: "向画面左侧行走",
    seed: 23300,
    reference: "nobita-direction-left-reference.png",
    view:
      "严格 LEFT-facing orthographic profile，鼻子和嘴朝画面左侧，只显示一只眼睛和合理的圆形眼镜侧框；身体、胸口和脚尖保持纯侧面，不回转成三分之四。",
    frames: [
      {
        id: "01-left-contact",
        description:
          "第 1 帧 contact：左腿作为前导腿向画面左侧伸出并落地，右腿向画面右后方拖后；大雄的右臂向左前方摆，左臂向右后方摆，后侧手臂部分被躯干遮挡；身体轻微向左前倾。"
      },
      {
        id: "02-left-passing",
        description:
          "第 2 帧 passing：右脚支撑，左腿屈膝从身体下方向前经过；双脚在 profile 中前后错开但不重叠；右臂回落到身体前侧，左臂开始向左前方摆；头部保持纯左侧面。"
      },
      {
        id: "03-right-contact",
        description:
          "第 3 帧 opposite contact：右腿向画面左侧伸出并落地，左腿向画面右后方拖后；左臂向左前方摆，右臂向右后方摆并被躯干部分遮挡；重心落在右脚，侧脸和眼镜高度与第 1 帧一致。"
      },
      {
        id: "04-right-passing",
        description:
          "第 4 帧 opposite passing：左脚支撑，右腿屈膝从身体下方向前经过；双脚在 profile 中交换前后位置；左臂回落，右臂开始向左前方摆；身体准备进入下一步，但不复制第 1 帧。"
      }
    ]
  }
];

const twoFrameDirections = directions.map((direction) => {
  const frames = {
    down: [
      {
        id: "01-left-arm-forward",
        description:
          "第 1 帧：DOWN-facing 正面向画面下方行走；大雄左臂（画面右侧）大幅向前下方伸直至肩高，右臂（画面左侧）明显向后上方拉开；右腿向画面下方大步前跨并弯曲，左腿在后方伸直；形成清楚的前后错位 silhouette，绝不是 neutral idle。"
      },
      {
        id: "02-right-arm-forward",
        description:
          "第 2 帧：DOWN-facing 正面向画面下方行走；大雄右臂（画面左侧）大幅向前下方伸直至肩高，左臂（画面右侧）明显向后上方拉开；左腿向画面下方大步前跨并弯曲，右腿在后方伸直；手臂和腿与第 1 帧完全左右交换，形成相反 silhouette，绝不接近第 1 帧。"
      }
    ],
    up: [
      {
        id: "01-left-arm-forward",
        description:
          "第 1 帧：UP-facing 真实背面向画面上方行走；大雄左臂向行走方向前上方摆出，右臂向画面下方后摆；右腿向画面上方前跨并落地，左腿向后拖后；只显示后脑、黄色上衣背面和鞋后部。"
      },
      {
        id: "02-right-arm-forward",
        description:
          "第 2 帧：UP-facing 真实背面向画面上方行走；大雄右臂向行走方向前上方摆出，左臂向画面下方后摆；左腿向画面上方前跨并落地，右腿向后拖后；手臂和腿与第 1 帧完全交换，不出现正面五官或眼镜。"
      }
    ],
    left: [
      {
        id: "01-left-arm-forward",
        description:
          "第 1 帧：LEFT-facing strict profile 向画面左侧行走；大雄左臂完全伸直指向画面左方，右臂向画面右方后摆并在躯干后形成清楚的弯肘轮廓；右腿向画面左方大步前跨并伸直，左膝在画面右后方明显弯曲抬起；保持纯侧面，形成宽大步幅。"
      },
      {
        id: "02-right-arm-forward",
        description:
          "第 2 帧：LEFT-facing strict profile 向画面左侧行走；大雄右臂完全伸直指向画面左方，左臂向画面右方后摆并在躯干后形成清楚的弯肘轮廓；左腿向画面左方大步前跨并伸直，右膝在画面右后方明显弯曲抬起；四肢与第 1 帧完全交换，身体不回转成三分之四。"
      }
    ]
  };
  return { ...direction, frames: frames[direction.id] };
});

const activeDirections = FRAME_MODE === "two" ? twoFrameDirections : directions;

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

function buildPrompt(direction, frame) {
  if (BIOMECH_V3_PROMPT) {
    const first = frame.id.startsWith("01");
    const poses = {
      down: first
        ? "DOWN正面 contact pose：左脚承重落地，右腿向前摆；右臂前摆、左臂后摆，膝盖朝前，双脚接触线清楚。"
        : "DOWN正面 passing pose：左脚承重，右膝抬起从身体下方经过；右臂后摆、左臂前摆，骨盆稳定，双脚不交叉。",
      up: first
        ? "UP背面 contact pose：左脚承重落地，右腿向上方前摆；右臂前摆、左臂后摆，膝盖朝前，背部中轴稳定。"
        : "UP背面 passing pose：右脚承重，左膝抬起向上方经过；左臂后摆、右臂前摆，骨盆稳定，双脚不交叉。",
      left: first
        ? "LEFT纯侧面 contact pose：右脚承重落地，左腿向左前摆；近侧手臂前摆、远侧手臂后摆，膝盖和脚尖朝左。"
        : "LEFT纯侧面 passing pose：左脚承重，右膝抬起向左方经过；近侧手臂后摆、远侧手臂前摆，身体保持纯侧面。"
    };
    return [
      "参考大雄图，保持同一脸型、圆眼镜、黑短发、黄上衣、蓝短裤、白袜、浅蓝鞋和2D pixel sprite风格。",
      poses[direction.id],
      "完整全身，anatomically correct，四肢自然，#00FF00 chroma-key绿幕。",
      PROMPT_NOTE
    ].filter(Boolean).join(" ");
  }
  if (BIOMECH_V2_PROMPT) {
    const first = frame.id.startsWith("01");
    const poses = {
      down: first
        ? "DOWN front contact pose：左脚承重落地，右腿向后自然伸展；右臂前摆、左臂后摆，肘部轻弯，骨盆与肩线反向微转。"
        : "DOWN front contact pose：右脚承重落地，左腿向后自然伸展；左臂前摆、右臂后摆，肘部轻弯，骨盆与肩线反向微转。",
      up: first
        ? "UP back contact pose：左脚承重落地，右腿沿画面上方前摆；右臂前摆、左臂后摆，膝盖朝行走方向弯曲，骨盆与肩线反向微转。"
        : "UP back contact pose：右脚承重落地，左腿沿画面上方前摆；左臂前摆、右臂后摆，膝盖朝行走方向弯曲，骨盆与肩线反向微转。",
      left: first
        ? "LEFT strict profile contact pose：右脚承重，左腿向左前摆；近侧手臂前摆、远侧手臂后摆，膝盖和脚尖朝左，身体保持纯侧面。"
        : "LEFT strict profile contact pose：左脚承重，右腿向左前摆；近侧手臂后摆、远侧手臂前摆，膝盖和脚尖朝左，身体保持纯侧面。"
    };
    return [
      "参考大雄图，保持大雄脸型、圆眼镜、黑短发、黄上衣、蓝短裤、白袜、浅蓝鞋与2D pixel sprite比例、脚底pivot。",
      poses[direction.id],
      "anatomically correct，完整全身，关节自然，脚底接触线清楚，纯#00FF00 chroma-key绿幕。",
      PROMPT_NOTE
    ].filter(Boolean).join(" ");
  }
  if (BIOMECH_PROMPT) {
    const first = frame.id.startsWith("01");
    const poses = {
      down: first
        ? "DOWN正面步态：左脚支撑，右腿前摆屈膝；右臂前摆、左臂后摆；肩线与骨盆反向微转，手肘膝盖脚掌分开，重心在左脚。"
        : "DOWN正面步态：右脚支撑，左腿前摆屈膝；左臂前摆、右臂后摆；肩线与骨盆反向微转，手肘膝盖脚掌分开，重心在右脚。",
      up: first
        ? "UP背面步态：左脚支撑，右腿向上方前摆屈膝；右臂前摆、左臂后摆；肩胯反向微转，后脑衣背膝盖鞋底清楚，重心在左脚。"
        : "UP背面步态：右脚支撑，左腿向上方前摆屈膝；左臂前摆、右臂后摆；肩胯反向微转，后脑衣背膝盖鞋底清楚，重心在右脚。",
      left: first
        ? "LEFT纯侧面步态：右脚支撑，左腿向左前摆屈膝；左臂前摆、右臂后摆；保持单一侧面，髋部带动步幅，手肘膝盖脚掌分开，重心在右脚。"
        : "LEFT纯侧面步态：左脚支撑，右腿向左前摆屈膝；右臂前摆、左臂后摆；保持单一侧面，髋部带动步幅，手肘膝盖脚掌分开，重心在左脚。"
    };
    return [
      "参考大雄方向图，保持大雄脸型、圆眼镜、黑短发、黄上衣、蓝短裤、白袜、浅蓝鞋、2D pixel sprite风格和脚底pivot。",
      poses[direction.id],
      "单个角色全身，#00FF00 chroma-key绿幕，脚下纯绿色。",
      PROMPT_NOTE
    ].filter(Boolean).join(" ");
  }
  if (MINIMAL_PROMPT) {
    const first = frame.id.startsWith("01");
    const poses = {
      down: first
        ? "正面，左臂前摆，右臂后摆，右腿前跨，左腿后收。"
        : "正面，右臂前摆，左臂后摆，左腿前跨，右腿后收。",
      up: first
        ? "背面，右臂前摆，左臂后摆，右腿直向上跨，左膝明显后抬。"
        : "背面，左臂前摆，右臂后摆，左腿直向上跨，右膝明显后抬。",
      left: first
        ? "左侧面，前臂向左伸直，后臂向右弯曲，右腿左跨，左膝后抬。"
        : "左侧面，前臂贴胸弯曲，后臂向右伸直，左腿左跨，右膝后抬。"
    };
    return [
      `参考大雄图，人物不变，2D sprite风格不变；${poses[direction.id]}`,
      MINIMAL_GREEN ? "绿幕。" : "",
      PROMPT_NOTE
    ].filter(Boolean).join("；");
  }
  if (COMPACT_PROMPT) {
    return [
      "One isolated 2D pixel sprite frame of Nobita Nobi, the same slim Japanese schoolboy with round black glasses, short black hair, yellow shirt, navy shorts, white socks and pale blue shoes.",
      `Strict ${direction.id.toUpperCase()} facing view from the supplied single reference image; preserve the exact identity, face, clothing, pixel density and foot baseline.`,
      ...(SKIP_FRAME_DESCRIPTION ? [] : [frame.description]),
      PROMPT_NOTE,
      "Exaggerated hand-drawn 2D animation key pose, clear opposite arm and leg swing, both arms and legs separate, full head-to-feet silhouette, crisp pixel clusters, dark outline, flat #00FF00 chroma-key background. Exactly one character, no room, no furniture, no text, no shadow."
    ].filter(Boolean).join(" ");
  }
  return [
    "Use case: stylized-concept.",
    "Asset type: one isolated 2D pixel sprite animation frame, a single PNG on a 1:1 1024x1024 canvas.",
    `Image 1 role: ${direction.label} 的唯一正式透明 canonical reference；本次 i2i 只上传这一张图，保持其 view、脸型、发型、服装、身体比例和脚底 pivot。`,
    `Subject: ${identity}`,
    `View: ${direction.view}`,
    `Animation pose: ${frame.description}`,
    `Continuity: 这是 ${direction.frames.length} 帧交替步态中的 ${frame.id}；完整显示头到脚，角色高度、脚底 baseline、头部中心和衣服颜色保持稳定；动作轮廓清楚、重心自然、四肢互不融合。`,
    "Action contrast: 两帧必须是明显相反的 walking silhouette，前伸手臂、后摆手臂、前跨腿和后腿弯曲都要清楚可见；不要 neutral idle、双臂对称下垂或几乎不动的姿势。",
    "Style: warm top-down 2D pixel sprite, crisp intentional pixel clusters, limited palette, stable dark outline, readable at 128px, no perspective drift.",
    "Background: perfectly flat solid #00FF00 chroma-key, clean gap around the silhouette, no cast shadow or floor plane.",
    PROMPT_NOTE,
    "Output exactly one character and one frame; do not create a sprite sheet, grid, contact sheet, room, furniture, prop, text, logo, watermark or extra character."
  ].filter(Boolean).join(" ");
}

async function generateFrame(direction, frame) {
  const outputDir = path.join(RUN, "candidates", direction.id);
  const outputPath = path.join(outputDir, `nobita-walk-${direction.id}-${frame.id}.png`);
  const prompt = buildPrompt(direction, frame);
  await mkdir(outputDir);
  await fs.writeFile(`${outputPath}.prompt.txt`, `${prompt}\n`);

  const form = new FormData();
  form.set(
    "request",
    JSON.stringify({
      mode: GENERATION_MODE,
      prompt,
      width: SIZE,
      height: SIZE,
      seed: direction.seed + SEED_OFFSET + Number(frame.id.slice(0, 2)),
      num_steps: 4,
      guidance: 1.0,
      prompt_upsampling: false,
      num_images: 1,
      format: "png"
    })
  );

  const canonicalPath = REFERENCE_OVERRIDE
    ? path.resolve(ROOT, REFERENCE_OVERRIDE)
    : path.join(REFERENCE_ROOT, direction.reference);
  if (GENERATION_MODE === "i2i") {
    const canonicalBytes = await fs.readFile(canonicalPath);
    form.append("images", new Blob([canonicalBytes], { type: "image/png" }), path.basename(canonicalPath));
  }

  const queued = await requestJson(`${BASE_URL}/v1/flux2/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form
  });
  console.log(`submitted 大雄 ${direction.id} ${frame.id} (${queued.job_id})`);
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
    frame: frame.id,
    output: path.relative(ROOT, outputPath),
    prompt,
    jobId: queued.job_id,
    references: [
      path.relative(ROOT, canonicalPath)
    ]
  };
}

async function main() {
  if (!TOKEN) throw new Error("GAME_SERVICE_TOKEN is required and is not persisted.");
  await mkdir(RUN);
  await fs.access(path.join(REFERENCE_ROOT, "nobita-direction-down-reference.png"));
  await fs.access(path.join(REFERENCE_ROOT, "nobita-direction-up-reference.png"));
  await fs.access(path.join(REFERENCE_ROOT, "nobita-direction-left-reference.png"));

  const spec = await requestJson(`${BASE_URL}/v1/spec.json`);
  await fs.writeFile(path.join(RUN, "service-spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
  await fs.writeFile(
    path.join(RUN, "prompts.json"),
    `${JSON.stringify({
      runId: RUN_ID,
      actor: "nobita",
      frameMode: FRAME_MODE,
      generation: `one independent Flux ${GENERATION_MODE} job per frame`,
      references: activeDirections.map((direction) => ({
        direction: direction.id,
        file: path.relative(ROOT, path.join(REFERENCE_ROOT, direction.reference))
      })),
      frames: activeDirections.flatMap((direction) =>
        direction.frames.map((frame) => ({ direction: direction.id, frame: frame.id, prompt: buildPrompt(direction, frame) }))
      )
    }, null, 2)}\n`
  );

  const selectedDirections = activeDirections
    .filter((direction) => !DIRECTION_FILTER || direction.id === DIRECTION_FILTER)
    .map((direction) => ({
      ...direction,
      frames: FRAME_FILTER.size
        ? direction.frames.filter((frame) => FRAME_FILTER.has(frame.id))
        : direction.frames
    }))
    .filter((direction) => direction.frames.length > 0);
  if (!selectedDirections.length) throw new Error("No frames matched the requested filters.");

  const results = [];
  for (const direction of selectedDirections) {
    for (const frame of direction.frames) {
      const result = await generateFrame(direction, frame);
      results.push(result);
    }
  }
  await fs.writeFile(
    path.join(RUN, "prompts-and-results.json"),
    `${JSON.stringify({ runId: RUN_ID, actor: "nobita", frames: results }, null, 2)}\n`
  );
  console.log(`Saved ${results.length} independent Nobita walk frames under ${path.relative(ROOT, RUN)}`);
}

await main();
