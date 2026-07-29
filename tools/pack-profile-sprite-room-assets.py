#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "artifacts/profile-sprite-review/2026-07-17-topdown-r1"
CANDIDATES = RUN / "candidates"
PUBLIC = ROOT / "public/assets/profile/adventure/sprites-v2"
CONTACTS = RUN / "final-contact-sheets"
ENLARGED = RUN / "enlarged-frames"

FRAME_NAMES = [
    "idle",
    "walk-contact",
    "walk-passing",
    "walk-opposite-contact",
    "interaction-a",
    "interaction-b",
    "portal-reaction",
    "celebration",
    "character-signature",
]

KEYS = {
    "doraemon": (0, 255, 0),
    "nobita": (0, 255, 0),
    "shizuka": (0, 255, 255),
    "gian": (0, 255, 0),
    "suneo": (255, 0, 255),
}

# Each tuple is (candidate file, zero-based source cell). This explicitly
# records the visual review decision instead of silently accepting a whole job.
SELECTIONS = {
    "doraemon": [("doraemon-sheet-r2.png", i) for i in range(9)],
    "nobita": [("nobita-sheet-r2.png", i) for i in range(9)],
    "shizuka": [("shizuka-sheet-r1.png", i) for i in range(9)],
    "gian": [
        ("gian-sheet-r2.png", 0),
        ("gian-sheet-r2.png", 1),
        ("gian-sheet-r2.png", 2),
        ("gian-sheet-r2.png", 3),
        ("gian-sheet-r2.png", 4),
        ("gian-sheet-r1.png", 5),
        ("gian-sheet-r2.png", 6),
        ("gian-sheet-r2.png", 7),
        ("gian-sheet-r2.png", 8),
    ],
    "suneo": [
        ("suneo-sheet-r4.png", 0),
        ("suneo-sheet-r4.png", 1),
        ("suneo-sheet-r4.png", 2),
        ("suneo-sheet-r2.png", 7),
        ("suneo-sheet-r4.png", 4),
        ("suneo-sheet-r4.png", 5),
        ("suneo-sheet-r4.png", 6),
        ("suneo-sheet-r4.png", 7),
        ("suneo-sheet-r4.png", 8),
    ],
}


def separator_runs(image: Image.Image, axis: int) -> list[tuple[int, int]]:
    rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
    dark = np.max(rgb, axis=2) < 35
    scores = dark.mean(axis=axis)
    indices = np.flatnonzero(scores > 0.72)
    runs: list[tuple[int, int]] = []
    if not len(indices):
        return runs
    start = previous = int(indices[0])
    for value in map(int, indices[1:]):
        if value > previous + 1:
            if previous - start >= 1:
                runs.append((start, previous + 1))
            start = value
        previous = value
    if previous - start >= 1:
        runs.append((start, previous + 1))
    return runs


def cells(image: Image.Image) -> list[Image.Image]:
    vertical = separator_runs(image, axis=0)
    horizontal = separator_runs(image, axis=1)
    if len(vertical) >= 2:
        x_edges = [0, vertical[0][0], vertical[0][1], vertical[1][0], vertical[1][1], image.width]
        x_ranges = [(x_edges[0], x_edges[1]), (x_edges[2], x_edges[3]), (x_edges[4], x_edges[5])]
    else:
        x_ranges = [(0, image.width // 3), (image.width // 3, image.width * 2 // 3), (image.width * 2 // 3, image.width)]
    if len(horizontal) >= 2:
        y_edges = [0, horizontal[0][0], horizontal[0][1], horizontal[1][0], horizontal[1][1], image.height]
        y_ranges = [(y_edges[0], y_edges[1]), (y_edges[2], y_edges[3]), (y_edges[4], y_edges[5])]
    else:
        y_ranges = [(0, image.height // 3), (image.height // 3, image.height * 2 // 3), (image.height * 2 // 3, image.height)]
    result = []
    for top, bottom in y_ranges:
        for left, right in x_ranges:
            result.append(image.crop((left + 4, top + 4, right - 4, bottom - 4)).convert("RGBA"))
    return result


def connected_components(mask: np.ndarray) -> list[list[tuple[int, int]]]:
    height, width = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    result: list[list[tuple[int, int]]] = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        queue = deque([(int(y), int(x))])
        seen[y, x] = True
        component: list[tuple[int, int]] = []
        while queue:
            cy, cx = queue.popleft()
            component.append((cy, cx))
            for ny in range(max(0, cy - 1), min(height, cy + 2)):
                for nx in range(max(0, cx - 1), min(width, cx + 2)):
                    if mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
        result.append(component)
    return result


def remove_key(cell: Image.Image, key: tuple[int, int, int]) -> Image.Image:
    rgba = np.asarray(cell.convert("RGBA"), dtype=np.uint8).copy()
    rgb = rgba[:, :, :3].astype(np.int16)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    if key == (0, 255, 0):
        dominance = g - np.maximum(r, b)
        chroma_gate = g > 72
    elif key == (255, 0, 255):
        dominance = np.minimum(r, b) - g
        chroma_gate = (r > 72) & (b > 72)
    else:
        dominance = np.minimum(g, b) - r
        chroma_gate = (g > 72) & (b > 72)
    alpha = np.where(
        chroma_gate,
        np.clip((78.0 - dominance) / 44.0 * 255.0, 0, 255),
        255,
    ).astype(np.uint8)
    rgba[:, :, 3] = alpha

    mask = alpha > 70
    components = connected_components(mask)
    if components:
        largest = max(len(component) for component in components)
        keep = np.zeros_like(mask)
        for component in components:
            ys = np.array([point[0] for point in component])
            xs = np.array([point[1] for point in component])
            component_width = int(xs.max() - xs.min() + 1)
            component_height = int(ys.max() - ys.min() + 1)
            separator_fragment = (
                component_width <= 7 and component_height > cell.height * 0.34
            ) or (
                component_height <= 7 and component_width > cell.width * 0.34
            )
            border_rectangle = (
                component_width > cell.width * 0.82
                and component_height > cell.height * 0.82
                and len(component) < component_width * component_height * 0.12
            )
            if separator_fragment or border_rectangle:
                continue
            center_distance = abs(xs.mean() - cell.width / 2) + abs(ys.mean() - cell.height / 2)
            if len(component) >= max(90, largest * 0.018) or center_distance < min(cell.width, cell.height) * 0.18:
                keep[ys, xs] = True
        rgba[:, :, 3] = np.where(keep, rgba[:, :, 3], 0).astype(np.uint8)

    # Despill chroma from antialiased edge pixels without touching opaque color.
    fringe = (rgba[:, :, 3] > 0) & (rgba[:, :, 3] < 245)
    if key[1] == 255 and key[0] == 0:
        rgba[:, :, 1][fringe] = np.minimum(rgba[:, :, 1][fringe], np.maximum(rgba[:, :, 0][fringe], rgba[:, :, 2][fringe]) + 22)
    elif key[0] == 255 and key[2] == 255:
        ceiling = rgba[:, :, 1][fringe] + 26
        rgba[:, :, 0][fringe] = np.minimum(rgba[:, :, 0][fringe], ceiling)
        rgba[:, :, 2][fringe] = np.minimum(rgba[:, :, 2][fringe], ceiling)
    elif key[1] == 255 and key[2] == 255:
        ceiling = rgba[:, :, 0][fringe] + 28
        rgba[:, :, 1][fringe] = np.minimum(rgba[:, :, 1][fringe], ceiling)
        rgba[:, :, 2][fringe] = np.minimum(rgba[:, :, 2][fringe], ceiling)
    return Image.fromarray(rgba, "RGBA")


def normalize_frame(image: Image.Image) -> Image.Image:
    alpha = np.asarray(image.getchannel("A"))
    ys, xs = np.nonzero(alpha > 16)
    if not len(xs):
        raise RuntimeError("Sprite frame became empty after chroma removal")
    left, right = max(0, int(xs.min()) - 4), min(image.width, int(xs.max()) + 5)
    top, bottom = max(0, int(ys.min()) - 4), min(image.height, int(ys.max()) + 5)
    subject = image.crop((left, top, right, bottom))
    max_width, max_height = 108, 108
    scale = min(max_width / subject.width, max_height / subject.height)
    target = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(target, Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    x = (128 - subject.width) // 2
    y = 116 - subject.height
    frame.alpha_composite(subject, (x, y))
    return frame


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    CONTACTS.mkdir(parents=True, exist_ok=True)
    ENLARGED.mkdir(parents=True, exist_ok=True)
    source_cache: dict[str, list[Image.Image]] = {}
    manifest: dict[str, object] = {
        "version": "2026-07-17.profile-sprite-room.v2",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sheetSize": [384, 384],
        "frameSize": [128, 128],
        "columns": 3,
        "rows": 3,
        "frameOrder": FRAME_NAMES,
        "actors": {},
    }
    review_lines = [
        "# Profile sprite visual review",
        "",
        "Every selected sheet and final contact sheet was inspected with view_image.",
        "",
    ]
    for actor, selections in SELECTIONS.items():
        final_frames: list[Image.Image] = []
        source_records = []
        for source_name, index in selections:
            if source_name not in source_cache:
                source_cache[source_name] = cells(Image.open(CANDIDATES / source_name))
            cleaned = remove_key(source_cache[source_name][index], KEYS[actor])
            final_frames.append(normalize_frame(cleaned))
            source_records.append({"frame": FRAME_NAMES[len(final_frames) - 1], "candidate": source_name, "cell": index + 1})

        sheet = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
        for index, frame in enumerate(final_frames):
            sheet.alpha_composite(frame, ((index % 3) * 128, (index // 3) * 128))
            enlarged = frame.resize((512, 512), Image.Resampling.NEAREST)
            enlarged.save(ENLARGED / f"{actor}-{index + 1:02d}-{FRAME_NAMES[index]}.png")
        destination = PUBLIC / f"{actor}-3x3.webp"
        sheet.save(destination, "WEBP", lossless=True, method=6)
        sheet.save(CONTACTS / f"{actor}-3x3.png")
        actor_manifest = {
            "url": f"/assets/profile/adventure/sprites-v2/{actor}-3x3.webp",
            "approvedFrames": 9,
            "pivot": [0.5, 0.90625],
            "sha256": sha256(destination),
            "sources": source_records,
        }
        manifest["actors"][actor] = actor_manifest
        review_lines.extend([
            f"## {actor}",
            "",
            "- Status: 9/9 approved",
            f"- Final: `{destination.relative_to(ROOT)}`",
            f"- SHA-256: `{actor_manifest['sha256']}`",
            f"- Source selections: {', '.join(f'{item['candidate']}#{item['cell']}' for item in source_records)}",
            "",
        ])

    manifest_path = ROOT / "public/assets/profile/adventure/atlases/profile-sprite-room-atlas.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    review_lines.extend([
        "## Rejected candidates",
        "",
        "- Doraemon r1: cell 9 changed into a human face wearing a blue costume.",
        "- Gian r1: identity remained too generic; r2 improved the stocky child silhouette.",
        "- Gian r2 cell 6: orange clothing drifted to beige, replaced from r1.",
        "- Suneo r1-r3: several cells collapsed to a generic symmetric anime boy; r4 preserved the horizontal hair wedge consistently.",
        "",
    ])
    (RUN / "review.md").write_text("\n".join(review_lines))
    print(manifest_path.relative_to(ROOT))
    for actor in SELECTIONS:
        print(f"{actor}: 9/9 -> {PUBLIC / f'{actor}-3x3.webp'}")


if __name__ == "__main__":
    main()
