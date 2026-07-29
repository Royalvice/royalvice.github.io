#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "artifacts/profile-room-v3-review/2026-07-17-living-r1"
CANDIDATES = RUN / "candidates"
POSTER_SOURCES = RUN / "poster-sources"
PUBLIC = ROOT / "public/assets/profile/adventure/room-v3"
CONTACTS = RUN / "final-contact-sheets"
ENLARGED = RUN / "enlarged-frames"

ACTORS = ["nobita", "doraemon", "shizuka", "gian", "suneo"]
KEYS = {
    "nobita": "green",
    "doraemon": "green",
    "shizuka": "cyan",
    "gian": "green",
    "suneo": "magenta",
}
MOVEMENT_ORDER = [
    "down-0", "down-1", "down-2",
    "side-0", "side-1", "side-2",
    "up-0", "up-1", "up-2",
]
LIFE_ORDER = [
    "think-a", "think-b", "drink-a", "drink-b",
    "sit-game-a", "sit-game-b", "portal-enter", "portal-return", "room-reaction",
]

# Explicit visual-review selections. Each tuple is (source, zero-based cell).
MOVEMENT_SELECTIONS = {
    "nobita": [("nobita-movement-r1.png", i) for i in [0, 1, 2, 1, 2, 4, 6, 7, 8]],
    "doraemon": [("doraemon-movement-r2.png", i) for i in [0, 2, 0, 1, 5, 1, 6, 7, 8]],
    "shizuka": [
        ("old-shizuka", i) for i in [0, 1, 2]
    ] + [("shizuka-movement-r2.png", i) for i in [0, 1, 4, 6, 7, 8]],
    "gian": [("gian-movement-r2.png", i) for i in range(9)],
    "suneo": [("suneo-movement-r1.png", i) for i in [0, 1, 2, 3, 4, 5, 7, 8, 7]],
}
LIFE_SELECTIONS = {
    "nobita": [("nobita-life-r2.png", i) for i in [0, 1, 2, 2, 3, 4, 6, 7, 8]],
    "doraemon": [("doraemon-life-r2.png", i) for i in [0, 1, 2, 5, 4, 7, 6, 6, 8]],
    "shizuka": [("shizuka-life-r2.png", i) for i in [0, 0, 1, 2, 3, 6, 5, 7, 8]],
    "gian": [("gian-life-r1.png", i) for i in [0, 0, 1, 2, 3, 4, 7, 8, 8]],
    "suneo": [("suneo-life-r1.png", i) for i in [0, 1, 2, 4, 3, 6, 7, 5, 8]],
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def split_grid(image: Image.Image, columns: int, rows: int, margin: int = 6) -> list[Image.Image]:
    width, height = image.size
    frames: list[Image.Image] = []
    for row in range(rows):
        top = round(row * height / rows)
        bottom = round((row + 1) * height / rows)
        for column in range(columns):
            left = round(column * width / columns)
            right = round((column + 1) * width / columns)
            frames.append(image.crop((left + margin, top + margin, right - margin, bottom - margin)).convert("RGBA"))
    return frames


def remove_chroma(image: Image.Image, key: str, aggressive: bool = False) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8).copy()
    rgb = rgba[:, :, :3].astype(np.int16)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    if key == "green":
        dominance = g - np.maximum(r, b)
        gate = (g > 34) & (g > r * 1.45) & (g > b * 1.25)
    elif key == "cyan":
        dominance = np.minimum(g, b) - r
        gate = (g > 34) & (b > 34) & (dominance > 3)
    else:
        dominance = np.minimum(r, b) - g
        gate = (r > 34) & (b > 34) & (dominance > 3)
    if aggressive:
        hard_gate = gate | ((dominance > 0) & ((g > 20) if key == "green" else ((np.minimum(g, b) > 20) if key == "cyan" else (np.minimum(r, b) > 20))))
        alpha = np.where(hard_gate, np.where(dominance >= 2, 0, 92), 255).astype(np.uint8)
    else:
        alpha = np.where(gate, np.clip((15.0 - dominance) / 10.0 * 255.0, 0, 255), 255).astype(np.uint8)
    rgba[:, :, 3] = np.minimum(rgba[:, :, 3], alpha)

    fringe = (rgba[:, :, 3] > 0) & (rgba[:, :, 3] < 245)
    if key == "green":
        rgba[:, :, 1][fringe] = np.minimum(rgba[:, :, 1][fringe], np.maximum(rgba[:, :, 0][fringe], rgba[:, :, 2][fringe]) + 18)
    elif key == "cyan":
        ceiling = rgba[:, :, 0][fringe] + 24
        rgba[:, :, 1][fringe] = np.minimum(rgba[:, :, 1][fringe], ceiling)
        rgba[:, :, 2][fringe] = np.minimum(rgba[:, :, 2][fringe], ceiling)
    else:
        ceiling = rgba[:, :, 1][fringe] + 22
        rgba[:, :, 0][fringe] = np.minimum(rgba[:, :, 0][fringe], ceiling)
        rgba[:, :, 2][fringe] = np.minimum(rgba[:, :, 2][fringe], ceiling)
    return Image.fromarray(rgba, "RGBA")


def filter_components(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8).copy()
    mask = rgba[:, :, 3] > 18
    height, width = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    components: list[tuple[list[tuple[int, int]], int, int, int, int]] = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        stack = [(int(y), int(x))]
        seen[y, x] = True
        points: list[tuple[int, int]] = []
        min_x = max_x = int(x)
        min_y = max_y = int(y)
        while stack:
            cy, cx = stack.pop()
            points.append((cy, cx))
            min_x, max_x = min(min_x, cx), max(max_x, cx)
            min_y, max_y = min(min_y, cy), max(max_y, cy)
            for ny in range(max(0, cy - 1), min(height, cy + 2)):
                for nx in range(max(0, cx - 1), min(width, cx + 2)):
                    if mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        components.append((points, min_x, min_y, max_x, max_y))
    if not components:
        return image
    largest = max(len(item[0]) for item in components)
    keep = np.zeros_like(mask)
    for points, min_x, min_y, max_x, max_y in components:
        component_width = max_x - min_x + 1
        component_height = max_y - min_y + 1
        thin_line = (component_width > width * 0.46 and component_height <= 5) or (component_height > height * 0.46 and component_width <= 5)
        border_fragment = (min_x <= 2 or min_y <= 2 or max_x >= width - 3 or max_y >= height - 3) and len(points) < largest * 0.08
        if thin_line or border_fragment or len(points) < max(28, largest * 0.008):
            continue
        ys = np.fromiter((point[0] for point in points), dtype=np.int32)
        xs = np.fromiter((point[1] for point in points), dtype=np.int32)
        keep[ys, xs] = True
    rgba[:, :, 3] = np.where(keep, rgba[:, :, 3], 0).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def normalize(image: Image.Image, size: tuple[int, int], max_subject: tuple[int, int], baseline: int) -> Image.Image:
    alpha = np.asarray(image.getchannel("A"))
    ys, xs = np.nonzero(alpha > 18)
    if not len(xs):
        raise RuntimeError("asset became empty after chroma removal")
    left, right = max(0, int(xs.min()) - 4), min(image.width, int(xs.max()) + 5)
    top, bottom = max(0, int(ys.min()) - 4), min(image.height, int(ys.max()) + 5)
    subject = image.crop((left, top, right, bottom))
    scale = min(max_subject[0] / subject.width, max_subject[1] / subject.height)
    target = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(target, Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - subject.width) // 2
    y = baseline - subject.height
    frame.alpha_composite(subject, (x, y))
    return frame


def transparent_old_cell(actor: str, index: int) -> Image.Image:
    source = Image.open(ROOT / f"public/assets/profile/adventure/sprites-v2/{actor}-3x3.webp").convert("RGBA")
    frame = source.crop(((index % 3) * 128, (index // 3) * 128, (index % 3 + 1) * 128, (index // 3 + 1) * 128))
    return filter_components(remove_chroma(frame, KEYS[actor], aggressive=True))


def load_actor_cell(actor: str, source_name: str, index: int) -> Image.Image:
    if source_name.startswith("old-"):
        return transparent_old_cell(source_name.removeprefix("old-"), index)
    source = Image.open(CANDIDATES / source_name)
    cell = split_grid(source, 3, 3)[index]
    return normalize(filter_components(remove_chroma(cell, KEYS[actor], aggressive=True)), (128, 128), (110, 110), 118)


def pack_actor_sheet(actor: str, kind: str, selections: list[tuple[str, int]], frame_order: list[str]) -> dict[str, object]:
    destination_dir = PUBLIC / "actors"
    destination_dir.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
    records = []
    for slot, (source, index) in enumerate(selections):
        frame = load_actor_cell(actor, source, index)
        sheet.alpha_composite(frame, ((slot % 3) * 128, (slot // 3) * 128))
        enlarged = frame.resize((512, 512), Image.Resampling.NEAREST)
        enlarged.save(ENLARGED / f"{actor}-{kind}-{slot + 1:02d}-{frame_order[slot]}.png")
        records.append({"frame": frame_order[slot], "candidate": source, "cell": index + 1})
    destination = destination_dir / f"{actor}-{kind}-3x3.webp"
    sheet.save(destination, "WEBP", lossless=True, method=6)
    sheet.save(CONTACTS / f"{actor}-{kind}-3x3.png")
    return {
        "url": f"/assets/profile/adventure/room-v3/actors/{destination.name}",
        "size": [384, 384],
        "frameSize": [128, 128],
        "frameOrder": frame_order,
        "approvedFrames": 9,
        "sha256": sha256(destination),
        "bytes": destination.stat().st_size,
        "sources": records,
    }


def make_chair() -> Image.Image:
    image = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.polygon([(39, 58), (62, 45), (91, 61), (67, 78)], fill="#714727", outline="#21140d")
    draw.polygon([(42, 61), (62, 50), (86, 62), (66, 74)], fill="#9a6738")
    draw.rectangle((40, 76, 47, 112), fill="#332016")
    draw.rectangle((83, 73, 90, 108), fill="#332016")
    draw.rectangle((47, 31, 83, 57), fill="#5d3a22", outline="#21140d")
    draw.rectangle((51, 35, 79, 53), fill="#87603a")
    draw.line((43, 78, 86, 74), fill="#bb7e42", width=2)
    return image


def make_ps5() -> Image.Image:
    image = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((43, 108, 88, 117), fill=(5, 10, 14, 105))
    draw.polygon([(43, 99), (49, 28), (63, 20), (61, 103)], fill="#f0f1ed", outline="#18212b")
    draw.polygon([(61, 103), (63, 20), (73, 25), (76, 103)], fill="#101823", outline="#05080b")
    draw.polygon([(76, 103), (73, 25), (87, 31), (90, 99)], fill="#f8f9f3", outline="#18212b")
    draw.line((78, 39, 82, 89), fill="#3f78ff", width=2)
    draw.rectangle((66, 92, 70, 96), fill="#56b7ff")
    return image


def pack_furniture() -> dict[str, object]:
    source = Image.open(CANDIDATES / "furniture-r2.png")
    cells = split_grid(source, 3, 3)
    sheet = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
    names = ["chandelier", "blackboard", "eraser", "secondary-desk", "chair", "sofa", "water-cooler", "tv-cabinet", "ps5"]
    for index, name in enumerate(names):
        if name == "chair":
            frame = make_chair()
        elif name == "ps5":
            frame = make_ps5()
        else:
            max_subject = (116, 116) if name in {"blackboard", "secondary-desk", "sofa", "tv-cabinet"} else (104, 112)
            frame = normalize(filter_components(remove_chroma(cells[index], "green")), (128, 128), max_subject, 122)
        sheet.alpha_composite(frame, ((index % 3) * 128, (index // 3) * 128))
        frame.resize((512, 512), Image.Resampling.NEAREST).save(ENLARGED / f"furniture-{index + 1:02d}-{name}.png")
    destination = PUBLIC / "furniture/furniture-3x3.webp"
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, "WEBP", lossless=True, method=6)
    sheet.save(CONTACTS / "furniture-3x3.png")
    return {"url": "/assets/profile/adventure/room-v3/furniture/furniture-3x3.webp", "size": [384, 384], "frameSize": [128, 128], "frameOrder": names, "sha256": sha256(destination), "bytes": destination.stat().st_size}


def pack_door() -> dict[str, object]:
    source = Image.open(CANDIDATES / "anywhere-door-r2.png")
    cells = split_grid(source, 2, 1, margin=10)
    sheet = Image.new("RGBA", (256, 128), (0, 0, 0, 0))
    for index, cell in enumerate(cells):
        frame = normalize(filter_components(remove_chroma(cell, "green")), (128, 128), (116, 118), 124)
        sheet.alpha_composite(frame, (index * 128, 0))
        frame.resize((512, 512), Image.Resampling.NEAREST).save(ENLARGED / f"door-{'closed' if index == 0 else 'open'}.png")
    destination = PUBLIC / "props/anywhere-door-2x1.webp"
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, "WEBP", lossless=True, method=6)
    sheet.save(CONTACTS / "anywhere-door-2x1.png")
    return {"url": "/assets/profile/adventure/room-v3/props/anywhere-door-2x1.webp", "size": [256, 128], "frameSize": [128, 128], "frameOrder": ["closed", "open"], "sha256": sha256(destination), "bytes": destination.stat().st_size}


def pack_lamps() -> dict[str, object]:
    source = Image.open(CANDIDATES / "fuel-lamp-r2.png")
    cells = split_grid(source, 4, 1, margin=8)
    sheet = Image.new("RGBA", (256, 96), (0, 0, 0, 0))
    names = ["low", "left", "high", "right"]
    for index, cell in enumerate(cells):
        frame = normalize(filter_components(remove_chroma(cell, "green")), (64, 96), (60, 90), 94)
        sheet.alpha_composite(frame, (index * 64, 0))
        frame.resize((256, 384), Image.Resampling.NEAREST).save(ENLARGED / f"fuel-lamp-{names[index]}.png")
    destination = PUBLIC / "props/fuel-lamp-4x1.webp"
    sheet.save(destination, "WEBP", lossless=True, method=6)
    sheet.save(CONTACTS / "fuel-lamp-4x1.png")
    return {"url": "/assets/profile/adventure/room-v3/props/fuel-lamp-4x1.webp", "size": [256, 96], "frameSize": [64, 96], "frameOrder": names, "sha256": sha256(destination), "bytes": destination.stat().st_size}


def ordered_dither(image: Image.Image) -> Image.Image:
    array = np.asarray(image.convert("RGB"), dtype=np.int16).copy()
    bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32)
    threshold = (bayer / 15.0 - 0.5) * 9.0
    tiled = np.tile(threshold, (int(np.ceil(array.shape[0] / 4)), int(np.ceil(array.shape[1] / 4))))[: array.shape[0], : array.shape[1]]
    array = np.clip(array + tiled[:, :, None], 0, 255).astype(np.uint8)
    return Image.fromarray(array, "RGB").quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")


def pack_poster(source: Path, destination_name: str, url: str, center: tuple[float, float]) -> dict[str, object]:
    original = Image.open(source).convert("RGB")
    fitted = ImageOps.fit(original, (48, 64), method=Image.Resampling.LANCZOS, centering=center)
    final = ordered_dither(fitted)
    destination = PUBLIC / "posters" / destination_name
    destination.parent.mkdir(parents=True, exist_ok=True)
    final.save(destination, "WEBP", lossless=True, method=6)
    final.resize((384, 512), Image.Resampling.NEAREST).save(CONTACTS / destination_name.replace(".webp", ".png"))
    return {
        "url": f"/assets/profile/adventure/room-v3/posters/{destination_name}",
        "size": [48, 64],
        "sourceUrl": url,
        "accessedAt": "2026-07-17",
        "sourceFile": str(source.relative_to(ROOT)),
        "sourceSha256": sha256(source),
        "crop": {"mode": "ImageOps.fit", "target": [48, 64], "centering": list(center)},
        "sha256": sha256(destination),
        "bytes": destination.stat().st_size,
    }


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    CONTACTS.mkdir(parents=True, exist_ok=True)
    ENLARGED.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, object] = {
        "version": "2026-07-17.profile-room-v3.1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "actors": {},
    }
    for actor in ACTORS:
        manifest["actors"][actor] = {
            "movement": pack_actor_sheet(actor, "movement", MOVEMENT_SELECTIONS[actor], MOVEMENT_ORDER),
            "life": pack_actor_sheet(actor, "life", LIFE_SELECTIONS[actor], LIFE_ORDER),
        }
    manifest["furniture"] = pack_furniture()
    manifest["door"] = pack_door()
    manifest["lamps"] = pack_lamps()
    manifest["posters"] = {
        "spiritedAway": pack_poster(
            POSTER_SOURCES / "spirited-away-original.png",
            "spirited-away-pixel.webp",
            "https://upload.wikimedia.org/wikipedia/en/d/db/Spirited_Away_Japanese_poster.png",
            (0.5, 0.48),
        ),
        "onePieceEastBlue": pack_poster(
            POSTER_SOURCES / "one-piece-east-blue-tmdb.jpg",
            "one-piece-east-blue-pixel.webp",
            "https://image.tmdb.org/t/p/original/mRy1D3wVL1AjR1Czp2WY90CCzPY.jpg",
            (0.5, 0.45),
        ),
    }
    manifest_path = PUBLIC / "profile-room-v3-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")

    actor_bytes = sum(
        manifest["actors"][actor][kind]["bytes"]
        for actor in ACTORS
        for kind in ("movement", "life")
    )
    other_bytes = manifest["furniture"]["bytes"] + manifest["door"]["bytes"] + manifest["lamps"]["bytes"] + sum(item["bytes"] for item in manifest["posters"].values())
    review = [
        "# Living Research Dungeon room-v3 visual review",
        "",
        "All source candidates, replacement candidates, final sheets, enlarged frames, door states, lamp states and poster sources were opened with view_image.",
        "",
        "## Final status",
        "",
    ]
    for actor in ACTORS:
        review.extend([
            f"- {actor}: movement 9/9 approved; life 9/9 approved",
            f"  - movement SHA-256: `{manifest['actors'][actor]['movement']['sha256']}`",
            f"  - life SHA-256: `{manifest['actors'][actor]['life']['sha256']}`",
        ])
    review.extend([
        "",
        "## Props",
        "",
        "- Furniture atlas: 9/9 approved. Flux r2 supplied the chandelier, blackboard, eraser, desks, sofa, cooler and television; the malformed connected chair and console cells were replaced with hand-finished pixel sprites.",
        "- Anywhere Door: 2/2 approved (closed/open only).",
        "- Fuel lamp: 4/4 approved.",
        "- Posters: both final 48x64 derivatives inspected at 8x nearest-neighbor enlargement.",
        "",
        "## Rejected or repaired candidates",
        "",
        "- Nobita life r1, Doraemon movement r1 and both Shizuka r1 sheets: rejected because the phrase `visible crown` was interpreted as a literal crown. The prompt was corrected to `visible top of the head` and r2 was generated.",
        "- Gian movement r1 cell 3: rejected due to a small accidental crown; r2 replaced the full movement sheet.",
        "- Furniture r1: rejected because the eraser cell was blank and the final cell was only a controller.",
        "- Furniture r2 cell 5: the chair was fused to a desk; replaced with a standalone walnut chair sprite.",
        "- Furniture r2 cell 9: the generated console resembled a microwave/legacy console; replaced with a vertical white/black/blue pixel console silhouette.",
        "- One Piece search candidates from TMDB query were initially unrelated to One Piece; they were rejected after view_image. The selected East Blue source visibly contains exactly Luffy, Zoro, Nami, Usopp and Sanji.",
        "",
        "## Budgets",
        "",
        f"- Ten actor sheets: {actor_bytes} bytes ({actor_bytes / 1024:.1f} KiB).",
        f"- Furniture, door, lamps and posters: {other_bytes} bytes ({other_bytes / 1024:.1f} KiB).",
        f"- Total room-v3 raster budget: {(actor_bytes + other_bytes) / 1024:.1f} KiB.",
        "",
    ])
    (RUN / "review.md").write_text("\n".join(review))
    print(manifest_path.relative_to(ROOT))
    print(f"actor assets: {actor_bytes / 1024:.1f} KiB")
    print(f"other assets: {other_bytes / 1024:.1f} KiB")


if __name__ == "__main__":
    main()
