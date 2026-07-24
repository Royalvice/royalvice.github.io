#!/usr/bin/env python3
"""Stage and install reviewed A/B/C Profile movement atlases for four actors."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
REVIEW_ROOT = ROOT / "artifacts/profile-sprite-review"
REFERENCE_ROOT = REVIEW_ROOT / "final-directional-references"
RUN = REVIEW_ROOT / "2026-07-24-profile-walk-abc-all-actors-r1"
PUBLIC_ROOT = ROOT / "public/assets/profile/adventure/room-v4"
PUBLIC_ACTORS = PUBLIC_ROOT / "actors"
PUBLIC_MANIFEST = PUBLIC_ROOT / "profile-room-v4-manifest.json"
BASELINE = 118
MAX_HEIGHT = 110
MAX_WIDTH = 112
FRAME_ORDER = [
    "down-0", "down-1", "down-2",
    "side-0", "side-1", "side-2",
    "up-0", "up-1", "up-2",
]
ACTOR_LABELS = {
    "doraemon": "DORAEMON",
    "shizuka": "SHIZUKA",
    "gian": "GIAN",
    "suneo": "SUNEO",
}


SELECTIONS: dict[str, dict[str, tuple[str, int]]] = {
    "doraemon": {
        "down-a": ("2026-07-23-doraemon-abc-clean-r1", 2),
        "down-c": ("2026-07-23-doraemon-abc-clean-r1", 4),
        "left-a": ("2026-07-23-doraemon-abc-clean-r1", 2),
        "left-c": ("2026-07-23-doraemon-abc-reverse-explicit-r3", 5),
        "up-a": ("2026-07-23-doraemon-abc-clean-r1", 1),
        "up-c": ("2026-07-23-doraemon-abc-clean-r1", 2),
    },
    "shizuka": {
        "down-a": ("2026-07-23-shizuka-abc-clean-r1", 1),
        "down-c": ("2026-07-23-shizuka-abc-clean-r1", 3),
        "left-a": ("2026-07-23-shizuka-abc-clean-r1", 1),
        "left-c": ("2026-07-23-shizuka-abc-clean-r1", 14),
        "up-a": ("2026-07-23-shizuka-abc-clean-r1", 3),
        "up-c": ("2026-07-23-shizuka-abc-clean-r1", 8),
    },
    "gian": {
        "down-a": ("2026-07-23-gian-abc-clean-r1", 1),
        "down-c": ("2026-07-23-gian-abc-clean-r1", 4),
        "left-a": ("2026-07-23-gian-abc-clean-r1", 2),
        "left-c": ("2026-07-23-gian-abc-reverse-explicit-r3", 1),
        "up-a": ("2026-07-23-gian-abc-clean-r1", 2),
        "up-c": ("2026-07-23-gian-abc-clean-r1", 4),
    },
    "suneo": {
        "down-a": ("2026-07-23-suneo-abc-clean-r1", 1),
        "down-c": ("2026-07-23-suneo-abc-clean-r1", 4),
        "left-a": ("2026-07-23-suneo-abc-clean-r1", 4),
        "left-c": ("2026-07-23-suneo-abc-reverse-explicit-r3", 1),
        "up-a": ("2026-07-23-suneo-abc-clean-r1", 3),
        "up-c": ("2026-07-23-suneo-abc-clean-r1", 1),
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def font(size: int) -> ImageFont.ImageFont:
    for path in (
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ):
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def closed_foreground_alpha(image: Image.Image) -> Image.Image:
    """Extract a black-background subject without deleting enclosed black details."""
    rgb = image.convert("RGB")
    width, height = rgb.size
    seed = Image.new("L", (width, height), 0)
    seed_pixels = seed.load()
    rgb_pixels = rgb.load()
    for y in range(height):
        for x in range(width):
            if max(rgb_pixels[x, y]) > 7:
                seed_pixels[x, y] = 255
    seed = seed.filter(ImageFilter.MaxFilter(11))
    seed_pixels = seed.load()

    background = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(1, height - 1):
        queue.append((0, y))
        queue.append((width - 1, y))
    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if background[index] or seed_pixels[x, y]:
            continue
        background[index] = 1
        if x:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))

    foreground = bytearray(0 if background[index] else 1 for index in range(width * height))
    visited = bytearray(width * height)
    largest: list[int] = []
    for start in range(width * height):
        if not foreground[start] or visited[start]:
            continue
        component: list[int] = []
        component_queue = deque([start])
        visited[start] = 1
        while component_queue:
            index = component_queue.popleft()
            component.append(index)
            x = index % width
            y = index // width
            neighbours = (
                index - 1 if x else -1,
                index + 1 if x + 1 < width else -1,
                index - width if y else -1,
                index + width if y + 1 < height else -1,
            )
            for neighbour in neighbours:
                if neighbour >= 0 and foreground[neighbour] and not visited[neighbour]:
                    visited[neighbour] = 1
                    component_queue.append(neighbour)
        if len(component) > len(largest):
            largest = component
    if not largest:
        raise RuntimeError("No foreground component found")
    alpha = Image.new("L", (width, height), 0)
    alpha_pixels = alpha.load()
    for index in largest:
        alpha_pixels[index % width, index // width] = 255
    return alpha


def source_alpha(image: Image.Image) -> tuple[Image.Image, str]:
    if "A" in image.getbands():
        alpha = image.getchannel("A")
        minimum, maximum = alpha.getextrema()
        if minimum < 255 and maximum > 0:
            return alpha, "source-alpha"
    return closed_foreground_alpha(image), "closed-black-background"


def normalize_frame(source: Path, *, mirror: bool) -> tuple[Image.Image, dict[str, object]]:
    with Image.open(source) as opened:
        opened.load()
        if opened.size != (1024, 1024) or opened.format != "PNG":
            raise ValueError(f"{source} must be a 1024x1024 PNG")
        rgba = opened.convert("RGBA")
        alpha, alpha_method = source_alpha(opened)
    rgba.putalpha(alpha)
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError(f"No subject in {source}")
    subject = rgba.crop(bbox)
    scale = min(MAX_WIDTH / subject.width, MAX_HEIGHT / subject.height)
    width = max(1, round(subject.width * scale))
    height = max(1, round(subject.height * scale))
    subject = subject.resize((width, height), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    x = (128 - width) // 2
    y = BASELINE - height
    frame.alpha_composite(subject, (x, y))
    if mirror:
        frame = frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    pixels = frame.load()
    for yy in range(128):
        for xx in range(128):
            red, green, blue, opacity = pixels[xx, yy]
            if opacity < 16:
                pixels[xx, yy] = (0, 0, 0, 0)
    final_bbox = frame.getchannel("A").getbbox()
    if final_bbox is None:
        raise RuntimeError(f"Normalized frame is empty for {source}")
    return frame, {
        "source": relative(source),
        "sourceSha256": sha256(source),
        "sourceBbox": list(bbox),
        "alphaMethod": alpha_method,
        "processedSize": [128, 128],
        "alphaBbox": list(final_bbox),
        "pivot": [0.5, BASELINE / 128],
        "mirroredForRuntime": mirror,
    }


def candidate_source(actor: str, key: str) -> tuple[Path, dict[str, object]]:
    run_id, candidate = SELECTIONS[actor][key]
    direction, pose = key.split("-")
    pose_dir = REVIEW_ROOT / run_id / direction / f"frame-{pose}"
    source = pose_dir / f"candidate-{candidate:02d}.png"
    results_path = pose_dir / "results.json"
    if not source.is_file() or not results_path.is_file():
        raise FileNotFoundError(source if not source.is_file() else results_path)
    results = json.loads(results_path.read_text(encoding="utf-8"))["results"]
    record = next((item for item in results if item["candidate"] == candidate), None)
    if record is None:
        raise RuntimeError(f"Candidate {candidate} missing from {results_path}")
    invariants = {
        "inputImageCount": record.get("inputImageCount"),
        "promptUpsampling": record.get("promptUpsampling"),
        "outputSize": record.get("outputSize"),
        "outputSha256": record.get("outputSha256"),
    }
    expected = {
        "inputImageCount": 1,
        "promptUpsampling": False,
        "outputSize": [1024, 1024],
        "outputSha256": sha256(source),
    }
    if invariants != expected:
        raise ValueError(f"Generation invariants failed for {source}: {invariants}")
    return source, {
        "role": "selected-i2i",
        "selectionKey": key,
        "candidate": candidate,
        "runId": run_id,
        "seed": record["seed"],
        "jobId": record["jobId"],
        "prompt": record["prompt"],
        "reference": record["reference"],
        "referenceSha256": record["referenceSha256"],
        "inputImageCount": 1,
        "promptUpsampling": False,
    }


def reference_source(actor: str, direction: str) -> tuple[Path, dict[str, object]]:
    source = REFERENCE_ROOT / actor / f"{actor}-direction-{direction}-reference.png"
    manifest = json.loads((REFERENCE_ROOT / "manifest.json").read_text(encoding="utf-8"))
    expected = manifest["actors"][actor]["frames"][direction]["sha256"]
    if sha256(source) != expected:
        raise ValueError(f"Reference SHA mismatch for {actor}/{direction}")
    return source, {
        "role": "B-reference",
        "direction": direction,
        "referenceManifestSha256": expected,
    }


def checker(frame: Image.Image, size: int = 300) -> Image.Image:
    background = Image.new("RGB", (size, size), "#20252a")
    draw = ImageDraw.Draw(background)
    tile = 20
    for y in range(0, size, tile):
        for x in range(0, size, tile):
            color = "#303840" if (x // tile + y // tile) % 2 else "#20262b"
            draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=color)
    enlarged = frame.resize((size, size), Image.Resampling.NEAREST)
    background.paste(enlarged.convert("RGB"), mask=enlarged.getchannel("A"))
    return background


def clean_transparent_rgb(frame: Image.Image) -> Image.Image:
    cleaned = frame.convert("RGBA").copy()
    pixels = cleaned.load()
    for y in range(cleaned.height):
        for x in range(cleaned.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                pixels[x, y] = (0, 0, 0, 0)
    return cleaned


def stage_actor(actor: str) -> dict[str, object]:
    actor_dir = RUN / actor
    processed_dir = actor_dir / "processed"
    selected_dir = actor_dir / "selected-sources"
    processed_dir.mkdir(parents=True, exist_ok=True)
    selected_dir.mkdir(parents=True, exist_ok=True)
    source_specs: dict[str, tuple[Path, dict[str, object]]] = {
        "down-0": candidate_source(actor, "down-a"),
        "down-1": reference_source(actor, "down"),
        "down-2": candidate_source(actor, "down-c"),
        "side-0": candidate_source(actor, "left-a"),
        "side-1": reference_source(actor, "left"),
        "side-2": candidate_source(actor, "left-c"),
        "up-0": candidate_source(actor, "up-a"),
        "up-1": reference_source(actor, "up"),
        "up-2": candidate_source(actor, "up-c"),
    }
    frames: dict[str, Image.Image] = {}
    records: dict[str, dict[str, object]] = {}
    for frame_id in FRAME_ORDER:
        source, selection = source_specs[frame_id]
        frame, processing = normalize_frame(source, mirror=frame_id.startswith("side-"))
        processed_path = processed_dir / f"{frame_id}.png"
        frame.save(processed_path, "PNG", optimize=True)
        selected_copy = selected_dir / f"{frame_id}.png"
        shutil.copy2(source, selected_copy)
        frames[frame_id] = frame
        records[frame_id] = {
            "frame": frame_id,
            **selection,
            **processing,
            "selectedCopy": relative(selected_copy),
            "processed": relative(processed_path),
            "processedSha256": sha256(processed_path),
        }

    staged_dir = RUN / "staged"
    staged_dir.mkdir(parents=True, exist_ok=True)
    atlas_path = staged_dir / f"{actor}-movement-3x3.webp"
    atlas = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
    for index, frame_id in enumerate(FRAME_ORDER):
        atlas.alpha_composite(
            clean_transparent_rgb(frames[frame_id]),
            ((index % 3) * 128, (index // 3) * 128),
        )
    atlas.save(atlas_path, "WEBP", lossless=True, method=6, exact=True)

    review_path = actor_dir / f"{actor}-runtime-review-960.png"
    review = Image.new("RGB", (960, 960), "#15181c")
    draw = ImageDraw.Draw(review)
    label_font = font(18)
    for index, frame_id in enumerate(FRAME_ORDER):
        row, column = divmod(index, 3)
        x, y = column * 320 + 10, row * 320 + 10
        review.paste(checker(frames[frame_id], 300), (x, y))
        pose = "B" if frame_id.endswith("-1") else ("A" if frame_id.endswith("-0") else "C")
        draw.rounded_rectangle((x + 8, y + 8, x + 158, y + 38), 6, fill="#101419", outline="#6ed6ff")
        draw.text((x + 17, y + 13), f"{frame_id} · {pose}", fill="white", font=label_font)
    review.save(review_path, "PNG", optimize=True)

    previews: dict[str, dict[str, object]] = {}
    for direction in ("down", "side", "up"):
        preview_path = actor_dir / f"{actor}-{direction}-abc.gif"
        images = [checker(frames[f"{direction}-{index}"], 384) for index in (0, 1, 2)]
        images[0].save(preview_path, save_all=True, append_images=images[1:], duration=300, loop=0, disposal=2)
        previews[direction] = {"path": relative(preview_path), "sha256": sha256(preview_path)}

    public_path = PUBLIC_ACTORS / f"{actor}-movement-3x3.webp"
    return {
        "actor": actor,
        "status": "staged",
        "atlas": {
            "path": relative(atlas_path),
            "sha256": sha256(atlas_path),
            "bytes": atlas_path.stat().st_size,
            "size": [384, 384],
        },
        "review": {"path": relative(review_path), "sha256": sha256(review_path), "size": [960, 960]},
        "previews": previews,
        "frames": [records[frame_id] for frame_id in FRAME_ORDER],
        "installTarget": relative(public_path),
        "previousPublicSha256": sha256(public_path),
    }


def stage_all() -> dict[str, object]:
    RUN.mkdir(parents=True, exist_ok=True)
    actors = {actor: stage_actor(actor) for actor in SELECTIONS}
    combined_review_path = RUN / "all-actors-runtime-review-1000.png"
    combined_review = Image.new("RGB", (1000, 1000), "#101419")
    combined_draw = ImageDraw.Draw(combined_review)
    actor_font = font(20)
    for index, actor in enumerate(SELECTIONS):
        row, column = divmod(index, 2)
        x, y = column * 500, row * 500
        with Image.open(ROOT / actors[actor]["review"]["path"]) as opened:
            card = opened.convert("RGB").resize((500, 500), Image.Resampling.LANCZOS)
        combined_review.paste(card, (x, y))
        combined_draw.rectangle((x, y, x + 499, y + 499), outline="#6ed6ff", width=2)
        label = ACTOR_LABELS[actor]
        label_box = combined_draw.textbbox((0, 0), label, font=actor_font)
        label_width = label_box[2] - label_box[0]
        combined_draw.rounded_rectangle(
            (x + 488 - label_width, y + 10, x + 490, y + 40),
            radius=6,
            fill="#101419",
            outline="#6ed6ff",
        )
        combined_draw.text((x + 478 - label_width, y + 15), label, fill="white", font=actor_font)
    combined_review.save(combined_review_path, "PNG", optimize=True)
    report = {
        "runId": RUN.name,
        "status": "staged",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "acceptance": "visual-gait-priority",
        "frameOrder": FRAME_ORDER,
        "actors": actors,
        "combinedReview": {
            "path": relative(combined_review_path),
            "sha256": sha256(combined_review_path),
            "size": [1000, 1000],
        },
    }
    (RUN / "staging.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def install(report: dict[str, object]) -> None:
    backup_dir = RUN / "backup"
    backup_dir.mkdir(parents=True, exist_ok=True)
    for actor, actor_report in report["actors"].items():
        staged = ROOT / actor_report["atlas"]["path"]
        public = ROOT / actor_report["installTarget"]
        backup = backup_dir / public.name
        if not backup.exists():
            shutil.copy2(public, backup)
        shutil.copy2(staged, public)
        if sha256(public) != actor_report["atlas"]["sha256"]:
            raise RuntimeError(f"Installed atlas hash mismatch for {actor}")
        actor_report["status"] = "installed"
        actor_report["backup"] = relative(backup)

    manifest = json.loads(PUBLIC_MANIFEST.read_text(encoding="utf-8"))
    patch_id = RUN.name
    manifest["version"] = "2026-07-24.profile-room-v4.all-actors-three-frame"
    manifest["generatedAt"] = datetime.now(timezone.utc).isoformat()
    manifest["patches"] = [patch for patch in manifest.get("patches", []) if patch.get("id") != patch_id]
    manifest["patches"].append({
        "id": patch_id,
        "actors": list(SELECTIONS),
        "kind": "movement",
        "frameCountPerActor": 9,
        "acceptance": "visual-gait-priority",
    })
    for actor, actor_report in report["actors"].items():
        sources = []
        for record in actor_report["frames"]:
            sources.append({
                "frame": record["frame"],
                "role": record["role"],
                "source": record["source"],
                "sourceSha256": record["sourceSha256"],
                "processed": record["processed"],
                "sha256": record["processedSha256"],
                "alphaMethod": record["alphaMethod"],
                "alphaBbox": record["alphaBbox"],
                "pivot": record["pivot"],
                "mirroredForRuntime": record["mirroredForRuntime"],
                "candidate": record.get("candidate"),
                "seed": record.get("seed"),
                "jobId": record.get("jobId"),
                "reference": record.get("reference"),
                "review": {
                    "identity": True,
                    "upright": True,
                    "visualGaitDifference": True,
                    "alpha": True,
                },
            })
        manifest["actors"][actor]["movement"] = {
            "url": f"/assets/profile/adventure/room-v4/actors/{actor}-movement-3x3.webp",
            "size": [384, 384],
            "frameSize": [128, 128],
            "frameOrder": FRAME_ORDER,
            "runtimeFrameCount": 3,
            "runtimeFrameIndices": [0, 1, 2],
            "approvedFrames": 9,
            "compatibilityDuplicateCells": [],
            "sha256": actor_report["atlas"]["sha256"],
            "bytes": (ROOT / actor_report["installTarget"]).stat().st_size,
            "sources": sources,
        }
    PUBLIC_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report["status"] = "installed"
    report["installedAt"] = datetime.now(timezone.utc).isoformat()
    report["publicManifestSha256"] = sha256(PUBLIC_MANIFEST)
    (RUN / "installation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--install", action="store_true")
    args = parser.parse_args()
    report = stage_all()
    if args.install:
        install(report)
    print(json.dumps({
        "status": report["status"],
        "actors": {actor: actor_report["atlas"] for actor, actor_report in report["actors"].items()},
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
