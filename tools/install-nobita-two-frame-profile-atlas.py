#!/usr/bin/env python3
"""Stage and install Nobita's A-reference-B-C three-frame Profile movement atlas."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import statistics
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts/profile-sprite-review"
SOURCE_RUN = ARTIFACTS / "2026-07-23-nobita-six-selected-frames-r1"
REFERENCE_ROOT = ARTIFACTS / "final-directional-references/nobita"
RUN = ARTIFACTS / "2026-07-23-nobita-profile-three-frame-install-r1"
PROCESSED = RUN / "processed"
PUBLIC_ATLAS = ROOT / "public/assets/profile/adventure/room-v4/actors/nobita-movement-3x3.webp"
PUBLIC_MANIFEST = ROOT / "public/assets/profile/adventure/room-v4/profile-room-v4-manifest.json"
STAGED_ATLAS = RUN / "nobita-movement-3x3.webp"
REVIEW_SHEET = RUN / "nobita-movement-runtime-review.png"
OLD_PUBLIC_SHA256 = "31a492b3791740b3daca22f22413fe131c9d1bea2accbfeb487077ca6af94b26"
BASELINE = 118
MAX_HEIGHT = 110
MAX_WIDTH = 112

SOURCE_FRAMES = {
    "down-0": SOURCE_RUN / "nobita-down-01.png",
    "down-1": REFERENCE_ROOT / "nobita-direction-down-reference.png",
    "down-2": SOURCE_RUN / "nobita-down-02.png",
    "side-0": SOURCE_RUN / "nobita-left-01.png",
    "side-1": REFERENCE_ROOT / "nobita-direction-left-reference.png",
    "side-2": SOURCE_RUN / "nobita-left-02.png",
    "up-0": SOURCE_RUN / "nobita-up-01.png",
    "up-1": REFERENCE_ROOT / "nobita-direction-up-reference.png",
    "up-2": SOURCE_RUN / "nobita-up-02.png",
}

FRAME_ORDER = [
    "down-0", "down-1", "down-2",
    "side-0", "side-1", "side-2",
    "up-0", "up-1", "up-2",
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def largest_closed_foreground(image: Image.Image) -> Image.Image:
    """Build a hard silhouette matte while preserving black hair and outlines.

    The accepted sources use an exactly black backdrop, but Nobita's hair and
    outline are also black.  A global black-key deletion would destroy them.
    Instead, non-black pixels seed a closed silhouette; only zero-valued pixels
    reachable from the canvas border are treated as background.  Enclosed black
    hair remains opaque, and only the largest resulting component is retained.
    """
    rgb = image.convert("RGB")
    width, height = rgb.size
    seed = Image.new("L", (width, height), 0)
    seed_pixels = seed.load()
    rgb_pixels = rgb.load()
    for y in range(height):
        for x in range(width):
            red, green, blue = rgb_pixels[x, y]
            if max(red, green, blue) > 7:
                seed_pixels[x, y] = 255
    # The generated sources use black for both the backdrop and Nobita's hair.
    # A few accepted frames leave gaps wider than the original 5 px closing
    # radius around the hairline, which lets the border flood-fill leak into
    # the head.  Eleven source pixels are still well below two pixels after the
    # 1024 -> 128 runtime reduction, while reliably sealing those hairline gaps.
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
        if background[index] or seed_pixels[x, y] != 0:
            continue
        background[index] = 1
        if x > 0:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))

    foreground = bytearray(1 if not background[index] else 0 for index in range(width * height))
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
            for neighbour in (
                index - 1 if x > 0 else -1,
                index + 1 if x + 1 < width else -1,
                index - width if y > 0 else -1,
                index + width if y + 1 < height else -1,
            ):
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


def normalize_frame(source: Path, *, mirror: bool) -> tuple[Image.Image, dict[str, object]]:
    with Image.open(source) as source_image:
        if source_image.size != (1024, 1024) or source_image.format != "PNG":
            raise ValueError(f"{source} must be a 1024x1024 PNG")
        rgb = source_image.convert("RGB")
    alpha = largest_closed_foreground(rgb)
    rgba = rgb.convert("RGBA")
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
    frame = seal_normalized_head(frame)

    pixels = frame.load()
    for yy in range(frame.height):
        for xx in range(frame.width):
            red, green, blue, opacity = pixels[xx, yy]
            if opacity < 16:
                pixels[xx, yy] = (0, 0, 0, 0)
    final_bbox = frame.getchannel("A").getbbox()
    if final_bbox is None:
        raise RuntimeError(f"Normalized frame is empty for {source}")
    metadata = {
        "source": relative(source),
        "sourceSha256": sha256(source),
        "sourceBbox": list(bbox),
        "processedSize": [128, 128],
        "alphaBbox": list(final_bbox),
        "pivot": [0.5, BASELINE / 128],
        "mirroredForRuntime": mirror,
    }
    return frame, metadata


def transparent_rgb_zeroed(frame: Image.Image) -> Image.Image:
    clean = frame.convert("RGBA").copy()
    pixels = clean.load()
    for y in range(clean.height):
        for x in range(clean.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                pixels[x, y] = (0, 0, 0, 0)
    return clean


def seal_normalized_head(frame: Image.Image) -> Image.Image:
    """Make the head silhouette opaque without changing its rendered RGB.

    Some i2i outputs draw the outer hairline in near-black over an exactly
    black background.  Even after flood-filling at source resolution, a short
    low-contrast break can leave the otherwise valid hair interior transparent.
    At runtime resolution the head is a solid silhouette, so each scanline may
    safely be filled between its outer alpha edges.  A rolling median repairs
    only large inward edge jumps (the leaked hairline); it does not smooth or
    redraw the visible character pixels.
    """
    sealed = frame.convert("RGBA").copy()
    alpha = sealed.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return sealed
    left, top, right, bottom = bbox
    head_bottom = min(bottom, top + round((bottom - top) * 0.48))
    alpha_pixels = alpha.load()
    rows: list[tuple[int, int] | None] = []
    for y in range(top, head_bottom):
        opaque_x = [x for x in range(left, right) if alpha_pixels[x, y] >= 16]
        rows.append((opaque_x[0], opaque_x[-1]) if opaque_x else None)

    repaired: list[tuple[int, int] | None] = []
    radius = 8
    for index, edges in enumerate(rows):
        if edges is None:
            repaired.append(None)
            continue
        neighbours = [
            row
            for row in rows[max(0, index - radius):min(len(rows), index + radius + 1)]
            if row is not None
        ]
        median_left = round(statistics.median(row[0] for row in neighbours))
        median_right = round(statistics.median(row[1] for row in neighbours))
        row_left, row_right = edges
        if row_left - median_left > 12:
            row_left = median_left
        if median_right - row_right > 12:
            row_right = median_right
        repaired.append((row_left, row_right))

    for index, edges in enumerate(repaired):
        if edges is None:
            continue
        y = top + index
        row_left, row_right = edges
        for x in range(row_left, row_right + 1):
            alpha_pixels[x, y] = 255
    sealed.putalpha(alpha)
    return sealed


def checker_cell(frame: Image.Image, size: int = 480) -> Image.Image:
    background = Image.new("RGB", (size, size), "#20252a")
    draw = ImageDraw.Draw(background)
    tile = 32
    for y in range(0, size, tile):
        for x in range(0, size, tile):
            draw.rectangle(
                (x, y, x + tile - 1, y + tile - 1),
                fill="#2c3339" if (x // tile + y // tile) % 2 else "#20262b",
            )
    enlarged = frame.resize((size, size), Image.Resampling.NEAREST)
    background.paste(enlarged.convert("RGB"), mask=enlarged.getchannel("A"))
    return background


def font(size: int) -> ImageFont.ImageFont:
    for path in (
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ):
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def stage() -> dict[str, object]:
    for path in SOURCE_FRAMES.values():
        if not path.is_file():
            raise FileNotFoundError(path)
    RUN.mkdir(parents=True, exist_ok=True)
    PROCESSED.mkdir(parents=True, exist_ok=True)

    frames: dict[str, Image.Image] = {}
    records: dict[str, dict[str, object]] = {}
    for frame_id, source in SOURCE_FRAMES.items():
        frame, metadata = normalize_frame(source, mirror=frame_id.startswith("side-"))
        processed_path = PROCESSED / f"{frame_id}.png"
        frame.save(processed_path, "PNG")
        metadata["processed"] = relative(processed_path)
        metadata["processedSha256"] = sha256(processed_path)
        frames[frame_id] = frame
        records[frame_id] = metadata

    atlas = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
    for index, frame_id in enumerate(FRAME_ORDER):
        atlas.alpha_composite(transparent_rgb_zeroed(frames[frame_id]), ((index % 3) * 128, (index // 3) * 128))
    atlas.save(STAGED_ATLAS, "WEBP", lossless=True, method=6, exact=True)

    review = Image.new("RGB", (1500, 1500), "#15181c")
    draw = ImageDraw.Draw(review)
    label_font = font(25)
    for index, frame_id in enumerate(FRAME_ORDER):
        row, column = divmod(index, 3)
        x = column * 500 + 10
        y = row * 500 + 10
        cell = checker_cell(frames[frame_id], 480)
        review.paste(cell, (x, y))
        draw.rounded_rectangle((x + 12, y + 12, x + 210, y + 57), radius=8, fill="#111418", outline="#6ed6ff", width=2)
        pose = "B · reference" if frame_id.endswith("-1") else ("A" if frame_id.endswith("-0") else "C")
        draw.text((x + 25, y + 20), f"{frame_id} · {pose}", fill="white", font=label_font)
    review.save(REVIEW_SHEET, "PNG", optimize=True)

    previews = {}
    for direction in ("down", "side", "up"):
        preview_path = RUN / f"nobita-{direction}-three-frame-runtime-preview.gif"
        preview_frames = [checker_cell(frames[f"{direction}-{index}"], 512) for index in (0, 1, 2)]
        preview_frames[0].save(preview_path, save_all=True, append_images=preview_frames[1:], duration=320, loop=0, disposal=2)
        previews[direction] = {
            "path": relative(preview_path),
            "sha256": sha256(preview_path),
            "frames": 3,
        }

    report = {
        "runId": RUN.name,
        "status": "staged",
        "sourceRun": relative(SOURCE_RUN),
        "directionalReferenceRoot": relative(REFERENCE_ROOT),
        "frameOrder": FRAME_ORDER,
        "runtimeAnimation": {
            "nobitaFrameCount": 3,
            "usedIndices": [0, 1, 2],
            "poseOrder": ["A", "B-reference", "C"],
            "thirdCellPolicy": "all three cells are authored runtime frames",
        },
        "atlas": {
            "staged": relative(STAGED_ATLAS),
            "size": [384, 384],
            "sha256": sha256(STAGED_ATLAS),
            "bytes": STAGED_ATLAS.stat().st_size,
            "review": relative(REVIEW_SHEET),
        },
        "frames": [{"frame": frame_id, **records[frame_id]} for frame_id in FRAME_ORDER],
        "previews": previews,
        "installTarget": relative(PUBLIC_ATLAS),
        "previousPublicSha256": sha256(PUBLIC_ATLAS),
    }
    (RUN / "staging.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def rebuild_left_selection_artifacts() -> None:
    left_run = ARTIFACTS / "2026-07-22-nobita-left-two-frame-clean-r1"
    selected_a = left_run / "selected-frame-a.png"
    selected_b = left_run / "selected-frame-b.png"
    new_b = ARTIFACTS / "2026-07-23-nobita-left-arm-swap-cleanup-r1/candidates/candidate-01.png"
    old_b_backup = left_run / "superseded-selected-frame-b-r2-04.png"
    if not old_b_backup.exists() and selected_b.exists() and sha256(selected_b) != sha256(new_b):
        shutil.copy2(selected_b, old_b_backup)
    shutil.copy2(new_b, selected_b)

    with Image.open(selected_a) as first, Image.open(selected_b) as second:
        a = first.convert("RGB")
        b = second.convert("RGB")
    contact = Image.new("RGB", (2048, 1088), "#15181c")
    contact.paste(a, (0, 64))
    contact.paste(b, (1024, 64))
    contact.save(left_run / "two-frame-review-contact.png", "PNG", optimize=True)
    a.save(left_run / "two-frame-preview.gif", save_all=True, append_images=[b], duration=350, loop=0, disposal=2)

    results_path = left_run / "results.json"
    results = json.loads(results_path.read_text(encoding="utf-8"))
    results["reviewArtifacts"]["contactSheet"] = {
        "path": relative(left_run / "two-frame-review-contact.png"),
        "sha256": sha256(left_run / "two-frame-review-contact.png"),
        "size": [2048, 1088],
    }
    results["reviewArtifacts"]["loopPreview"] = {
        "path": relative(left_run / "two-frame-preview.gif"),
        "sha256": sha256(left_run / "two-frame-preview.gif"),
        "frames": 2,
        "durationMsPerFrame": 350,
    }
    results_path.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def install(report: dict[str, object]) -> None:
    new_hash = str(report["atlas"]["sha256"])
    current_hash = sha256(PUBLIC_ATLAS)
    backup = RUN / "backup/nobita-movement-3x3.before-three-frame.webp"
    if current_hash != new_hash:
        if current_hash != OLD_PUBLIC_SHA256 and not backup.exists():
            raise RuntimeError(f"Refusing to replace unexpected public atlas {current_hash}")
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            shutil.copy2(PUBLIC_ATLAS, backup)
        shutil.copy2(STAGED_ATLAS, PUBLIC_ATLAS)

    manifest = json.loads(PUBLIC_MANIFEST.read_text(encoding="utf-8"))
    movement_sources = []
    for record in report["frames"]:
        movement_sources.append({
            "frame": record["frame"],
            "source": record["source"],
            "processed": record["processed"],
            "sha256": record["processedSha256"],
            "alphaBbox": record["alphaBbox"],
            "pivot": record["pivot"],
            "mirroredForRuntime": record["mirroredForRuntime"],
            "runtimeDuplicateOf": record.get("runtimeDuplicateOf"),
            "review": {
                "identity": True,
                "action": True,
                "continuity": True,
                "alpha": True,
                "notes": "A/C 为用户确认的相反步态，方向参考图作为中立 B 帧；运行时使用索引 0、1、2。",
            },
        })
    manifest["version"] = "2026-07-23.profile-room-v4.nobita-three-frame"
    manifest["generatedAt"] = datetime.now(timezone.utc).isoformat()
    patch_record = {
        "id": RUN.name,
        "actor": "nobita",
        "kind": "movement",
        "frameCount": 3,
        "sourceRun": relative(SOURCE_RUN),
        "directionalReferenceRoot": relative(REFERENCE_ROOT),
    }
    manifest["patches"] = [
        patch for patch in manifest.setdefault("patches", [])
        if patch.get("id") != RUN.name
    ] + [patch_record]
    manifest["actors"]["nobita"]["movement"] = {
        "url": "/assets/profile/adventure/room-v4/actors/nobita-movement-3x3.webp",
        "size": [384, 384],
        "frameSize": [128, 128],
        "frameOrder": FRAME_ORDER,
        "runtimeFrameCount": 3,
        "runtimeFrameIndices": [0, 1, 2],
        "approvedFrames": 9,
        "compatibilityDuplicateCells": [],
        "sha256": new_hash,
        "bytes": PUBLIC_ATLAS.stat().st_size,
        "sources": movement_sources,
    }
    PUBLIC_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    report["status"] = "installed"
    report["installedAt"] = datetime.now(timezone.utc).isoformat()
    report["installedAtlasSha256"] = sha256(PUBLIC_ATLAS)
    report["publicManifestSha256"] = sha256(PUBLIC_MANIFEST)
    report["backup"] = relative(backup) if backup.exists() else None
    (RUN / "installation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--install", action="store_true")
    args = parser.parse_args()
    report = stage()
    if args.install:
        install(report)
    print(json.dumps({"status": report["status"], "atlas": report["atlas"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
