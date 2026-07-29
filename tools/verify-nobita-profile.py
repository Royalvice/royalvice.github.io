#!/usr/bin/env python3
"""Verify Nobita's installed A-B-C movement atlas in the live Profile UI."""

from __future__ import annotations

import base64
import io
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/profile-sprite-review/2026-07-23-nobita-profile-three-frame-install-r1"
SAMPLES = OUT / "runtime-samples"
URL = "http://127.0.0.1:4180/"
ATLAS_PATH = "/assets/profile/adventure/room-v4/actors/nobita-movement-3x3.webp"
TARGETS = [
    "movement:down:0",
    "movement:down:1",
    "movement:down:2",
    "movement:side:0",
    "movement:side:1",
    "movement:side:2",
    "movement:up:0",
    "movement:up:1",
    "movement:up:2",
]


def font(size: int) -> ImageFont.ImageFont:
    for path in (
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ):
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def decode_data_url(data_url: str) -> Image.Image:
    payload = data_url.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(payload))).convert("RGB")


def make_contact(samples: dict[str, dict[str, object]]) -> Path:
    review = Image.new("RGB", (900, 900), "#11171a")
    label_font = font(19)
    detail_font = font(14)
    for index, target in enumerate(TARGETS):
        sample = samples[target]
        canvas = decode_data_url(str(sample["canvasDataUrl"]))
        width, height = canvas.size
        position = sample["position"]
        x = round(float(position[0]) * width)
        y = round(float(position[1]) * height)
        crop_size = 96
        left = max(0, min(width - crop_size, x - crop_size // 2))
        top = max(0, min(height - crop_size, y - 75))
        crop = canvas.crop((left, top, left + crop_size, top + crop_size))
        crop = crop.resize((288, 288), Image.Resampling.NEAREST)
        column = index % 3
        row = index // 3
        tile_x = column * 300
        tile_y = row * 300
        review.paste(crop, (tile_x + 6, tile_y + 6))
        draw = ImageDraw.Draw(review)
        draw.rounded_rectangle(
            (tile_x + 13, tile_y + 13, tile_x + 286, tile_y + 62),
            radius=7,
            fill="#0c1215",
            outline="#64dfff",
            width=2,
        )
        direction = target.split(":")[1]
        frame_index = target.rsplit(":", 1)[1]
        pose = ("A", "B · REFERENCE", "C")[int(frame_index)]
        draw.text((tile_x + 24, tile_y + 21), f"{direction.upper()} · {pose}", fill="white", font=label_font)
        draw.text(
            (tile_x + 24, tile_y + 43),
            f"t={float(sample['time']):.2f}s · facing={sample['facing']}",
            fill="#9de9ff",
            font=detail_font,
        )
    path = OUT / "profile-nobita-runtime-nine-state-review.png"
    review.save(path, "PNG", optimize=True)
    return path


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    SAMPLES.mkdir(parents=True, exist_ok=True)
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_requests: list[dict[str, str]] = []
    atlas_responses: list[dict[str, object]] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 1100}, color_scheme="dark")
        page.set_default_timeout(60_000)
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on(
            "requestfailed",
            lambda request: failed_requests.append(
                {
                    "method": request.method,
                    "url": request.url,
                    "failure": request.failure or "unknown",
                }
            ),
        )

        def record_response(response) -> None:
            if response.url.endswith(ATLAS_PATH):
                atlas_responses.append({"url": response.url, "status": response.status, "ok": response.ok})

        page.on("response", record_response)
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        stage = page.locator(".profile-adventure-stage")
        canvas = page.locator(".profile-sprite-canvas")
        stage.wait_for(state="visible", timeout=60_000)
        canvas.wait_for(state="visible", timeout=60_000)
        page.wait_for_function("() => window.__profileAdventureDebug?.getState().ready", timeout=60_000)

        live_checks = page.evaluate(
            """async (atlasPath) => {
                const atlasResponse = await fetch(atlasPath, { cache: 'no-store' });
                const manifestResponse = await fetch('/assets/profile/adventure/room-v4/profile-room-v4-manifest.json', { cache: 'no-store' });
                const manifest = await manifestResponse.json();
                const state = window.__profileAdventureDebug.getState();
                return {
                    atlasStatus: atlasResponse.status,
                    atlasBytes: (await atlasResponse.arrayBuffer()).byteLength,
                    manifestStatus: manifestResponse.status,
                    movement: manifest.actors.nobita.movement,
                    assets: state.assets,
                    canvas: [document.querySelector('.profile-sprite-canvas').width, document.querySelector('.profile-sprite-canvas').height]
                };
            }""",
            ATLAS_PATH,
        )
        if live_checks["atlasStatus"] != 200:
            raise RuntimeError(f"Nobita atlas returned {live_checks['atlasStatus']}")
        if live_checks["movement"]["runtimeFrameIndices"] != [0, 1, 2]:
            raise RuntimeError("Manifest does not expose the A-B-C runtime indices")
        if live_checks["assets"]["actors"]["nobita"] != "ready":
            raise RuntimeError("Nobita atlas was not ready in the live stage")

        scan_cache_path = OUT / "browser-runtime-scan.json"
        cached_times = None
        if scan_cache_path.is_file():
            cached_scan = json.loads(scan_cache_path.read_text(encoding="utf-8"))
            cached_times = {
                target: cached_scan["samples"][target]["time"]
                for target in TARGETS
                if target in cached_scan.get("samples", {})
            }
            if len(cached_times) != len(TARGETS):
                cached_times = None
        scan = page.evaluate(
            """({ targets, cachedTimes }) => {
                const debug = window.__profileAdventureDebug;
                if (cachedTimes) {
                    const samples = {};
                    for (const target of targets) {
                        debug.setTime(cachedTimes[target]);
                        const state = debug.getState();
                        const actor = state.actors.nobita;
                        if (actor.state !== 'walking' || actor.frame !== target) break;
                        samples[target] = {
                            time: state.simulationElapsed,
                            frame: actor.frame,
                            facing: actor.facing,
                            position: actor.position,
                            canvasDataUrl: document.querySelector('.profile-sprite-canvas').toDataURL('image/png')
                        };
                    }
                    if (Object.keys(samples).length === targets.length) {
                        return { samples, unexpectedFrames: [], finalState: debug.getState(), reusedDeterministicTimes: true };
                    }
                }
                debug.reset();
                debug.pause();
                const wanted = new Set(targets);
                const samples = {};
                const unexpectedFrames = [];
                for (let step = 0; step <= 1500 && Object.keys(samples).length < targets.length; step += 1) {
                    const state = debug.getState();
                    const actor = state.actors.nobita;
                    if (actor.state === 'walking' && actor.frame.startsWith('movement:')) {
                        const frameIndex = Number(actor.frame.split(':').at(-1));
                        if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex > 2) {
                            unexpectedFrames.push({ time: state.simulationElapsed, frame: actor.frame });
                        }
                        if (wanted.has(actor.frame) && !samples[actor.frame]) {
                            samples[actor.frame] = {
                                time: state.simulationElapsed,
                                frame: actor.frame,
                                facing: actor.facing,
                                position: actor.position,
                                canvasDataUrl: document.querySelector('.profile-sprite-canvas').toDataURL('image/png')
                            };
                        }
                    }
                    debug.advanceTime(0.2);
                }
                return { samples, unexpectedFrames, finalState: debug.getState(), reusedDeterministicTimes: false };
            }""",
            {"targets": TARGETS, "cachedTimes": cached_times},
        )
        missing = [target for target in TARGETS if target not in scan["samples"]]
        if missing:
            raise RuntimeError(f"Did not observe live Nobita frames: {missing}")
        if scan["unexpectedFrames"]:
            raise RuntimeError(f"Runtime selected unexpected frame indices: {scan['unexpectedFrames'][:3]}")

        serializable_samples: dict[str, dict[str, object]] = {}
        for target in TARGETS:
            sample = scan["samples"][target]
            canvas_image = decode_data_url(sample["canvasDataUrl"])
            sample_path = SAMPLES / f"{target.replace(':', '-')}.png"
            canvas_image.save(sample_path, "PNG", optimize=True)
            serializable_samples[target] = {
                key: value for key, value in sample.items() if key != "canvasDataUrl"
            }
        contact = make_contact(scan["samples"])
        (OUT / "browser-runtime-scan.json").write_text(
            json.dumps(
                {
                    "samples": serializable_samples,
                    "unexpectedFrames": scan["unexpectedFrames"],
                },
                ensure_ascii=False,
                indent=2,
            ) + "\n",
            encoding="utf-8",
        )

        representative_time = float(scan["samples"]["movement:side:0"]["time"])
        page.evaluate("(time) => window.__profileAdventureDebug.setTime(time)", representative_time)
        page.wait_for_timeout(200)
        stage.scroll_into_view_if_needed()
        page.wait_for_timeout(200)
        stage_shot = OUT / "profile-nobita-live-stage.png"
        page_shot = OUT / "profile-nobita-live-page.png"
        stage_box = stage.bounding_box()
        if stage_box is None:
            raise RuntimeError("Profile stage has no live bounding box")
        page.screenshot(path=str(stage_shot), clip=stage_box, animations="disabled", caret="hide")
        page.screenshot(path=str(page_shot), full_page=False, animations="disabled", caret="hide")
        browser.close()

    report = {
        "status": "passed",
        "url": URL,
        "selectors": {
            "stageVisible": True,
            "canvasVisible": True,
        },
        "network": {
            "atlasResponses": atlas_responses,
            "liveChecks": live_checks,
            "failedRequests": failed_requests,
        },
        "runtime": {
            "samples": serializable_samples,
            "unexpectedFrames": scan["unexpectedFrames"],
            "reusedDeterministicTimes": scan["reusedDeterministicTimes"],
        },
        "errors": {
            "console": console_errors,
            "page": page_errors,
        },
        "screenshots": {
            "stage": str(stage_shot.relative_to(ROOT)),
            "page": str(page_shot.relative_to(ROOT)),
            "nineStateReview": str(contact.relative_to(ROOT)),
        },
    }
    profile_failed_requests = [request for request in failed_requests if "/assets/profile/" in request["url"]]
    report["network"]["profileFailedRequests"] = profile_failed_requests
    report["network"]["outOfScopeRequestWarnings"] = [
        request for request in failed_requests if request not in profile_failed_requests
    ]
    if console_errors or page_errors or profile_failed_requests:
        report["status"] = "failed"
    report_path = OUT / "browser-verification.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if report["status"] != "passed":
        raise RuntimeError(f"Browser verification failed; see {report_path}")
    print(json.dumps({"status": "passed", "report": str(report_path), "review": str(contact)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
