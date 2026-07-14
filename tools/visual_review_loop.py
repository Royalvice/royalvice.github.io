from __future__ import annotations

import argparse
import json
import os
import subprocess
import textwrap
import time
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_URL = "http://127.0.0.1:8767/"
DEFAULT_OUT_ROOT = Path("/tmp/royalvice-wooden-cabinet-review")


CAPTURE_SCRIPT = r"""
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const url = process.argv[2];
const out = process.argv[3];
fs.mkdirSync(out, { recursive: true });

const viewports = [
  ['desktop', { width: 1440, height: 1000 }],
  ['wide', { width: 1728, height: 1050 }],
  ['mobile', { width: 390, height: 1100 }]
];

async function safeGalleryClip(page, outputPath) {
  const locator = page.locator('[data-playcanvas-gallery]');
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(360);
  const gallery = await locator.boundingBox();
  const viewport = page.viewportSize();
  if (!gallery || !viewport) return null;
  const clip = {
    x: Math.max(0, gallery.x),
    y: Math.max(0, gallery.y),
    width: Math.min(gallery.width, viewport.width - Math.max(0, gallery.x)),
    height: Math.min(gallery.height, viewport.height - Math.max(0, gallery.y))
  };
  if (clip.width <= 0 || clip.height <= 0) return null;
  await page.screenshot({ path: outputPath, clip });
  return clip;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: viewports[0][1], deviceScaleFactor: 1 });
  const page = await context.newPage();
  const messages = [];
  const pageErrors = [];
  const results = [];

  page.on('console', msg => {
    const type = msg.type();
    if (['error', 'warning'].includes(type)) {
      const text = msg.text();
      if (!text.includes('GPU stall due to ReadPixels')) messages.push({ type, text });
    }
  });
  page.on('pageerror', err => pageErrors.push(String(err.stack || err.message || err)));

  await page.addInitScript(() => {
    window.__webglContexts = 0;
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === 'webgl' || type === 'webgl2' || type === 'webgpu') {
        window.__webglContexts += 1;
      }
      return orig.call(this, type, ...args);
    };
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-playcanvas-gallery] canvas', { timeout: 12000 });
  await page.waitForFunction(() => {
    try {
      return typeof window.__galleryDebug === 'function' && window.__galleryDebug()?.cabinetLoaded;
    } catch {
      return false;
    }
  }, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(2200);

  for (const [name, viewport] of viewports) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.waitForTimeout(name === 'mobile' ? 900 : 520);
    if (name === 'mobile') {
      await page.locator('[data-playcanvas-gallery]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(420);
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(160);
    }

    await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });
    const galleryClip = await safeGalleryClip(page, path.join(out, `${name}-gallery.png`));

    if (name === 'desktop') {
      const firstCard = page.locator('.gallery-ui-card').first();
      if (await firstCard.count()) {
        await firstCard.hover();
        await page.waitForTimeout(740);
      }
      await page.screenshot({ path: path.join(out, 'desktop-hover.png'), fullPage: false });
      await safeGalleryClip(page, path.join(out, 'desktop-hover-gallery.png'));
    }

    const metrics = await page.evaluate(() => ({
      canvasCount: document.querySelectorAll('canvas').length,
      galleryCanvasCount: document.querySelectorAll('[data-playcanvas-gallery] canvas').length,
      exhibitCanvasCount: document.querySelectorAll('.exhibit-canvas').length,
      exhibitCellCount: document.querySelectorAll('.exhibit-cell').length,
      galleryCardCount: document.querySelectorAll('.gallery-ui-card').length,
      webglContexts: window.__webglContexts,
      bodyScrollWidth: document.body.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
      horizontalOverflow: document.body.scrollWidth > document.documentElement.clientWidth + 1,
      galleryRect: (() => {
        const r = document.querySelector('[data-playcanvas-gallery]')?.getBoundingClientRect();
        return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
      })(),
      activeCard: document.querySelector('.gallery-ui-card.is-active')?.getAttribute('data-project') || null,
      galleryDebug: (() => {
        try {
          return typeof window.__galleryDebug === 'function' ? window.__galleryDebug() : null;
        } catch (error) {
          return { error: String(error) };
        }
      })()
    }));

    results.push({ name, viewport, metrics, galleryClip, messages: [...messages], pageErrors: [...pageErrors] });
  }

  await context.close();
  await browser.close();
  fs.writeFileSync(path.join(out, 'runtime-report.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})();
"""


JUDGE_PROMPT = """
你是一个极严的前端 UI 大师、游戏 UI 设计大师、PlayCanvas/PBR 技术美术总监。你热爱哆啦 A 梦、像素游戏、温暖治愈的街机美术，但你的审美标准是 v5 温暖高级木质游戏登录收藏展柜，不接受网页 card 感、占位感、阴间光照、黄泥材质、灰白/灰黑木墙或 artifact。

请只读评审，不要修改文件，不要运行命令。你会看到本轮截图：desktop gallery、desktop hover gallery、wide gallery、mobile gallery。目标是右侧 single PlayCanvas canvas 内的 v5 2x2 暖木 PBR 项目展柜，左侧 profile 应像同一套木质游戏登录终端。

硬约束：
1. 页面必须读成一个 single PlayCanvas canvas 内的整体木质 2x2 收藏展柜，而不是 Cbox、网页 card、旧 v1 原型或四个独立盒子。
2. 木柜必须贴合右侧前端容器，主体周围不应有明显空背景。
3. 木纹、黑漆、黄铜、玻璃、hero 屏幕、奖杯必须有可区分的 PBR 反射响应。
4. hero 图必须在后墙平面上，像嵌入式展板/黑板，不能悬浮或遮挡错位。
5. trophy 必须来自 v5 GLB mesh，在前景，有明确接触阴影和遮挡关系；不能看起来像旧 runtime primitive 占位。
6. 前玻璃必须可见，至少通过边缘、固定 catchlight、轻微折射/反射三者中的两项成立，但不能灰雾、鬼影、强扭曲或糊掉 hero/trophy。
7. 顶灯必须嵌入木柜天花板/灯槽，不能漂浮到柜体外，灯光要塑造空间层次。
8. DOM overlay 应主要是透明点击热区；可见项目信息优先读成 3D plaque 或柜内 UI，不能遮挡 hero/trophy 主视觉。
9. hover/selected 只能带来轻微物理响应和小控制台，不允许大面积蒙版。
10. mobile 必须能完整看到一个主 box，不能只剩顶部条、不能水平溢出，overlay 不得吃掉主视觉。
11. 右墙和背墙必须读成暖木 PBR：木纹、拼缝和暖色饱和度要明显，不能接近纯灰、灰白或灰黑。
12. hero PNG/MP4 必须尽量保持源图/视频原色：不能被金色 card、黑色遮罩、绿色 Matrix 字、全局 tint 或扫描线覆盖；DirectL 必须是视频状态 ready。

请按照以下维度逐项审查，分数 0-100：
- rendering: PBR 观感、artifact、曝光、清晰度
- layout: 2x2 cabinet、容器贴合、空背景比例
- material: 木纹/黑漆/黄铜/玻璃/屏幕材质可信度
- lighting: 嵌入顶灯、阴影、AO、HDR 反射层次
- interaction: hover/active overlay 是否稳定且不遮挡
- animation: 动态是否克制、有游戏感且不破坏画面
- box_fit: 木柜和每个格子是否完整并贴近容器/cell
- glass_visibility: 玻璃是否可见且干净
- hero_position: hero 是否明确在后墙
- trophy_position: trophy 是否明确在前景落地
- nameplate_occlusion: 铭牌是否贴边且不遮挡主体
- mobile_crop: mobile 是否完整、无横向溢出
- warm_wall: 右墙/背墙是否不灰白不灰黑、木纹和暖色是否成立
- hero_color: hero PNG/MP4 是否保持原色、DirectL 视频是否可读

输出必须是纯 JSON，不要 Markdown。结构：
{
  "iteration": ITERATION_NUMBER,
  "scores": {
    "rendering": 0,
    "layout": 0,
    "material": 0,
    "lighting": 0,
    "interaction": 0,
    "animation": 0,
    "box_fit": 0,
    "glass_visibility": 0,
    "hero_position": 0,
    "trophy_position": 0,
    "nameplate_occlusion": 0,
    "mobile_crop": 0,
    "warm_wall": 0,
    "hero_color": 0
  },
  "fatal_issues": ["..."],
  "priority_fixes": [
    {"priority": 1, "target": "layout|glass|overlay|camera|lighting|mobile", "change": "具体怎么改", "expected_effect": "改完应看到什么"}
  ],
  "pass": false
}
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run PlayCanvas wooden PBR gallery screenshot/runtime review.")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--iterations", type=int, default=10)
    parser.add_argument("--out-root", type=Path, default=DEFAULT_OUT_ROOT)
    parser.add_argument("--no-codex", action="store_true", help="Only capture screenshots and runtime metrics.")
    parser.add_argument("--codex-timeout", type=int, default=420)
    return parser.parse_args()


def run_capture(iter_dir: Path, url: str) -> dict:
    script_path = iter_dir / "capture.cjs"
    script_path.write_text(CAPTURE_SCRIPT, encoding="utf-8")
    env = os.environ.copy()
    env["NODE_PATH"] = str(ROOT / "node_modules")
    proc = subprocess.run(
        ["node", str(script_path), url, str(iter_dir)],
        cwd=ROOT,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=180,
    )
    (iter_dir / "capture.stdout.txt").write_text(proc.stdout, encoding="utf-8")
    (iter_dir / "capture.stderr.txt").write_text(proc.stderr, encoding="utf-8")
    if proc.returncode != 0:
      raise RuntimeError(f"Playwright capture failed for {iter_dir}: {proc.stderr}")
    report_path = iter_dir / "runtime-report.json"
    return json.loads(report_path.read_text(encoding="utf-8"))


def runtime_gate(runtime_report: list[dict]) -> list[str]:
    issues: list[str] = []
    for entry in runtime_report:
        name = entry["name"]
        metrics = entry["metrics"]
        if metrics.get("canvasCount") != 1:
            issues.append(f"{name}: canvasCount={metrics.get('canvasCount')} expected 1")
        if metrics.get("galleryCanvasCount") != 1:
            issues.append(f"{name}: galleryCanvasCount={metrics.get('galleryCanvasCount')} expected 1")
        if metrics.get("exhibitCanvasCount") != 0:
            issues.append(f"{name}: exhibitCanvasCount={metrics.get('exhibitCanvasCount')} expected 0")
        if metrics.get("exhibitCellCount") != 0:
            issues.append(f"{name}: exhibitCellCount={metrics.get('exhibitCellCount')} expected 0")
        if metrics.get("webglContexts") != 1:
            issues.append(f"{name}: webglContexts={metrics.get('webglContexts')} expected 1")
        debug = metrics.get("galleryDebug")
        if not debug:
            issues.append(f"{name}: missing __galleryDebug()")
        elif debug.get("error"):
            issues.append(f"{name}: __galleryDebug error={debug.get('error')}")
        else:
            if not debug.get("cabinetLoaded"):
                issues.append(f"{name}: wooden cabinet GLB not loaded")
            if debug.get("cabinetVersion") != "v5":
                issues.append(f"{name}: cabinetVersion={debug.get('cabinetVersion')} expected v5")
            if debug.get("source") != "wooden-gallery-cabinet-v5.glb":
                issues.append(f"{name}: unexpected gallery source={debug.get('source')}")
            if debug.get("anchorsFound", 0) < 32:
                issues.append(f"{name}: anchorsFound={debug.get('anchorsFound')} expected at least 32")
            if not debug.get("envAtlas"):
                issues.append(f"{name}: envAtlas not ready")
            if not debug.get("lightmapReady"):
                issues.append(f"{name}: cabinet lightmap not ready")
            bindings = debug.get("materialBindings") or {}
            missing = [key for key, value in bindings.items() if not value]
            if missing:
                issues.append(f"{name}: missing material bindings {missing}")
            generated_media = debug.get("generatedHeroMedia") or {}
            missing_media = [project for project in ("ssat", "directl", "eva01", "docdiff") if not generated_media.get(project)]
            if missing_media:
                issues.append(f"{name}: missing generated hero media {missing_media}")
            color_probe = debug.get("heroColorProbe") or {}
            missing_probe = [project for project in ("ssat", "directl", "eva01", "docdiff") if project not in color_probe]
            if missing_probe:
                issues.append(f"{name}: missing hero color probe {missing_probe}")
            hero_videos = debug.get("heroVideos") or {}
            directl_video = hero_videos.get("directl") or {}
            if not directl_video.get("ready"):
                issues.append(f"{name}: DirectL hero video not ready")
            trophy_meshes = debug.get("trophyMeshes") or {}
            missing_trophies = [project for project in ("ssat", "directl", "eva01", "docdiff") if not trophy_meshes.get(project)]
            if missing_trophies:
                issues.append(f"{name}: missing v5 trophy meshes {missing_trophies}")
        if metrics.get("horizontalOverflow"):
            issues.append(f"{name}: horizontal overflow")
        if entry.get("messages"):
            issues.append(f"{name}: console warnings/errors present")
        if entry.get("pageErrors"):
            issues.append(f"{name}: page errors present")
    return issues


def extract_jsonish(text: str) -> dict | None:
    stripped = text.strip()
    if not stripped:
        return None
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(stripped[start : end + 1])
        except json.JSONDecodeError:
            return None
    return None


def run_codex_judge(iter_dir: Path, iteration: int, runtime_issues: list[str], timeout: int) -> dict:
    images = [
        iter_dir / "desktop-gallery.png",
        iter_dir / "desktop-hover-gallery.png",
        iter_dir / "wide-gallery.png",
        iter_dir / "mobile-gallery.png",
    ]
    prompt = JUDGE_PROMPT.replace("ITERATION_NUMBER", str(iteration))
    prompt += "\n\nRuntime gate issues:\n"
    prompt += json.dumps(runtime_issues, ensure_ascii=False, indent=2)
    prompt += "\n\n请把 runtime gate issue 视为硬失败；如果没有 issue，就只按截图审查。"

    output_path = iter_dir / "codex-judge.md"
    cmd = [
        "codex",
        "exec",
        "--ephemeral",
        "--sandbox",
        "read-only",
        "-C",
        str(ROOT),
        "-o",
        str(output_path),
    ]
    for image in images:
        if image.exists():
            cmd.extend(["--image", str(image)])
    cmd.append("-")

    proc = subprocess.run(
        cmd,
        cwd=ROOT,
        input=prompt,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
    )
    (iter_dir / "codex.stdout.txt").write_text(proc.stdout, encoding="utf-8")
    (iter_dir / "codex.stderr.txt").write_text(proc.stderr, encoding="utf-8")

    raw = output_path.read_text(encoding="utf-8") if output_path.exists() else proc.stdout
    parsed = extract_jsonish(raw)
    judge = {
        "returncode": proc.returncode,
        "raw_path": str(output_path),
        "parsed": parsed,
    }
    if proc.returncode != 0:
        judge["error"] = proc.stderr[-4000:]
    return judge


def summarize_scores(judge: dict | None) -> dict:
    if not judge or not judge.get("parsed"):
        return {"average": None, "pass": False}
    scores = judge["parsed"].get("scores") or {}
    numeric = [float(value) for value in scores.values() if isinstance(value, (int, float))]
    average = round(sum(numeric) / len(numeric), 2) if numeric else None
    return {
        "average": average,
        "pass": bool(judge["parsed"].get("pass")) and average is not None and average >= 95,
    }


def main() -> None:
    args = parse_args()
    if not args.no_codex and args.iterations < 10:
        raise SystemExit("--iterations must be at least 10 when codex judging is enabled.")
    if args.no_codex and args.iterations < 1:
        raise SystemExit("--iterations must be at least 1.")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = args.out_root / stamp
    run_dir.mkdir(parents=True, exist_ok=True)

    summary: list[dict] = []
    for iteration in range(1, args.iterations + 1):
        iter_dir = run_dir / f"iter-{iteration:02d}"
        iter_dir.mkdir(parents=True, exist_ok=True)
        print(f"[iter {iteration:02d}] capture -> {iter_dir}", flush=True)
        runtime_report = run_capture(iter_dir, args.url)
        issues = runtime_gate(runtime_report)

        judge = None
        if not args.no_codex:
            print(f"[iter {iteration:02d}] codex judge", flush=True)
            try:
                judge = run_codex_judge(iter_dir, iteration, issues, args.codex_timeout)
            except subprocess.TimeoutExpired as exc:
                judge = {
                    "returncode": -1,
                    "error": f"codex judge timed out after {args.codex_timeout}s",
                    "stdout": exc.stdout,
                    "stderr": exc.stderr,
                    "parsed": None,
                }
                (iter_dir / "codex-timeout.json").write_text(json.dumps(judge, ensure_ascii=False, indent=2), encoding="utf-8")

        item = {
            "iteration": iteration,
            "dir": str(iter_dir),
            "runtime_issues": issues,
            "judge": judge,
            "score_summary": summarize_scores(judge),
        }
        summary.append(item)
        (iter_dir / "review.json").write_text(json.dumps(item, ensure_ascii=False, indent=2), encoding="utf-8")
        (run_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[iter {iteration:02d}] done score={item['score_summary']['average']} pass={item['score_summary']['pass']}", flush=True)

        # Give the dev server and GPU process a breath between heavy screenshots.
        time.sleep(0.4)

    print(str(run_dir))


if __name__ == "__main__":
    main()
