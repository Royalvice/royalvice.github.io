#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "artifacts/profile-room-grounded-v4-review/2026-07-17-grounded-r1"
CANDIDATES = RUN / "candidates"
PUBLIC = ROOT / "public/assets/profile/adventure/room-v3"
OLD_ATLAS = PUBLIC / "furniture/furniture-3x3.webp"
CONTACTS = RUN / "final-contact-sheets"
ENLARGED = RUN / "enlarged-8x"

ORDER = ["chandelier", "blackboard", "eraser", "secondary-desk", "chair", "sofa", "water-cooler", "tv-cabinet", "ps5"]
SELECTIONS = {
    "blackboard": "blackboard-b.png",
    "secondary-desk": "desk-a.png",
    "chair": "chair-b.png",
    "sofa": "sofa-d.png",
    "tv-cabinet": "tv-cabinet-a.png",
    "bulkhead-lamp": "bulkhead-lamp-a.png",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def remove_green(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8).copy()
    rgb = rgba[:, :, :3].astype(np.int16)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    dominance = g - np.maximum(r, b)
    transparent = (g > 120) & (dominance > 35) & (g > r * 1.35) & (g > b * 1.35)
    soft = (g > 80) & (dominance > 18) & ~transparent
    rgba[:, :, 3][transparent] = 0
    rgba[:, :, 3][soft] = np.minimum(rgba[:, :, 3][soft], np.clip(255 - (dominance[soft] - 18) * 7, 0, 255)).astype(np.uint8)
    fringe = (rgba[:, :, 3] > 0) & (rgba[:, :, 3] < 245)
    rgba[:, :, 1][fringe] = np.minimum(rgba[:, :, 1][fringe], np.maximum(rgba[:, :, 0][fringe], rgba[:, :, 2][fringe]) + 12)
    return Image.fromarray(rgba, "RGBA")


def crop_visible(image: Image.Image, margin: int = 3) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError("empty image after chroma removal")
    left = max(0, bbox[0] - margin)
    top = max(0, bbox[1] - margin)
    right = min(image.width, bbox[2] + margin)
    bottom = min(image.height, bbox[3] + margin)
    return image.crop((left, top, right, bottom))


def normalize(source: Image.Image, max_size: tuple[int, int], *, center_y: int | None = None, baseline: int | None = None) -> Image.Image:
    subject = crop_visible(source)
    scale = min(max_size[0] / subject.width, max_size[1] / subject.height)
    target = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(target, Image.Resampling.NEAREST)
    frame = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    x = (128 - subject.width) // 2
    if baseline is not None:
        y = baseline - subject.height
    elif center_y is not None:
        y = center_y - subject.height // 2
    else:
        y = (128 - subject.height) // 2
    frame.alpha_composite(subject, (x, y))
    return frame


def old_cell(index: int) -> Image.Image:
    source = Image.open(OLD_ATLAS).convert("RGBA")
    return source.crop(((index % 3) * 128, (index // 3) * 128, (index % 3 + 1) * 128, (index // 3 + 1) * 128))


def make_eraser() -> Image.Image:
    frame = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    draw.rectangle((35, 55, 94, 72), fill="#21150f")
    draw.rectangle((38, 54, 91, 66), fill="#d5c8a0")
    draw.rectangle((41, 58, 88, 68), fill="#58645e")
    draw.rectangle((43, 58, 86, 60), fill="#7c8d83")
    return frame


def make_ps5() -> Image.Image:
    frame = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    draw.polygon([(44, 117), (48, 31), (62, 22), (61, 118)], fill="#eff1ec", outline="#18212b")
    draw.polygon([(61, 118), (62, 22), (73, 27), (76, 118)], fill="#101823", outline="#05080b")
    draw.polygon([(76, 118), (73, 27), (87, 34), (90, 116)], fill="#f8f9f3", outline="#18212b")
    draw.line((79, 42, 83, 103), fill="#3f78ff", width=2)
    draw.rectangle((66, 105, 70, 109), fill="#56b7ff")
    return frame


def make_north_facing_sofa() -> Image.Image:
    """Pixel-correct the accepted rear-view sofa into a readable high-overhead footprint."""
    frame = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    outline = "#071b1a"
    deep = "#0b3733"
    body = "#0f5751"
    seat = "#14746b"
    highlight = "#299187"
    shadow = "#082b28"
    wood = "#7b5428"
    # Arms run north-south; seat cushions are north of the south/back rail.
    draw.rectangle((6, 37, 121, 116), fill=outline)
    draw.rectangle((10, 41, 24, 112), fill=deep)
    draw.rectangle((103, 41, 117, 112), fill=deep)
    draw.rectangle((24, 42, 103, 91), fill=shadow)
    draw.rectangle((27, 45, 62, 87), fill=seat)
    draw.rectangle((65, 45, 100, 87), fill=seat)
    draw.rectangle((29, 47, 60, 50), fill=highlight)
    draw.rectangle((67, 47, 98, 50), fill=highlight)
    draw.rectangle((61, 45, 65, 89), fill=outline)
    # The lower rail is the sofa back, clearly behind the two seated actors.
    draw.rectangle((23, 88, 104, 114), fill=outline)
    draw.rectangle((27, 91, 100, 109), fill=body)
    draw.rectangle((28, 92, 99, 95), fill=highlight)
    draw.rectangle((10, 43, 13, 96), fill="#1a766d")
    draw.rectangle((114, 43, 117, 96), fill="#06302d")
    draw.rectangle((12, 114, 22, 120), fill=wood)
    draw.rectangle((106, 114, 116, 120), fill=wood)
    return frame


def selected_frame(name: str) -> Image.Image:
    source = Image.open(CANDIDATES / SELECTIONS[name]).convert("RGBA")
    if name == "sofa":
        # The third i2i round correctly produced the rear/up-facing sofa but also a separate TV above it.
        # Crop away only that rejected extra component before chroma removal.
        source = source.crop((0, 390, source.width, source.height))
    keyed = remove_green(source)
    settings = {
        "blackboard": ((116, 70), None, 64),
        "secondary-desk": ((116, 108), 121, None),
        "chair": ((78, 108), 121, None),
        "sofa": ((116, 92), 121, None),
        "tv-cabinet": ((116, 110), 121, None),
    }
    maximum, baseline, center_y = settings[name]
    return normalize(keyed, maximum, baseline=baseline, center_y=center_y)


def enclosed_transparent_bbox(frame: Image.Image) -> tuple[int, int, int, int]:
    alpha = np.asarray(frame.getchannel("A"))
    transparent = alpha < 16
    height, width = transparent.shape
    outside = np.zeros_like(transparent, dtype=bool)
    stack: list[tuple[int, int]] = []
    for x in range(width):
        if transparent[0, x]: stack.append((0, x))
        if transparent[height - 1, x]: stack.append((height - 1, x))
    for y in range(height):
        if transparent[y, 0]: stack.append((y, 0))
        if transparent[y, width - 1]: stack.append((y, width - 1))
    while stack:
        y, x = stack.pop()
        if outside[y, x] or not transparent[y, x]:
            continue
        outside[y, x] = True
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < height and 0 <= nx < width and transparent[ny, nx] and not outside[ny, nx]:
                stack.append((ny, nx))
    holes = transparent & ~outside
    ys, xs = np.nonzero(holes)
    if not len(xs):
        raise RuntimeError("TV sprite lost its transparent screen aperture")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def pack_furniture() -> tuple[dict[str, object], list[Image.Image]]:
    frames: dict[str, Image.Image] = {
        "chandelier": old_cell(0),
        "blackboard": selected_frame("blackboard"),
        "eraser": make_eraser(),
        "secondary-desk": selected_frame("secondary-desk"),
        "chair": selected_frame("chair"),
        "sofa": make_north_facing_sofa(),
        "water-cooler": old_cell(6),
        "tv-cabinet": selected_frame("tv-cabinet"),
        "ps5": make_ps5(),
    }
    sheet = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
    metadata: dict[str, object] = {}
    for index, name in enumerate(ORDER):
        frame = frames[name]
        sheet.alpha_composite(frame, ((index % 3) * 128, (index // 3) * 128))
        frame.resize((1024, 1024), Image.Resampling.NEAREST).save(ENLARGED / f"{index + 1:02d}-{name}-8x.png")
        bbox = frame.getchannel("A").getbbox()
        metadata[name] = {"alphaBbox": list(bbox) if bbox else None}
    screen = enclosed_transparent_bbox(frames["tv-cabinet"])
    metadata["tv-cabinet"] = {
        **metadata["tv-cabinet"],
        "screenRectPixels": list(screen),
        "screenRectNormalized": [round(screen[0] / 128, 6), round(screen[1] / 128, 6), round((screen[2] - screen[0]) / 128, 6), round((screen[3] - screen[1]) / 128, 6)],
        "childAnchors": {"ps5": [0.73, 0.61]},
    }
    destination = PUBLIC / "furniture/furniture-grounded-v4-3x3.webp"
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, "WEBP", lossless=True, method=6)
    sheet.save(CONTACTS / "furniture-grounded-v4-3x3.png")
    return {
        "url": "/assets/profile/adventure/room-v3/furniture/furniture-grounded-v4-3x3.webp",
        "size": [384, 384], "frameSize": [128, 128], "frameOrder": ORDER,
        "sha256": sha256(destination), "bytes": destination.stat().st_size,
        "layoutVersion": "grounded-v4", "sprites": metadata,
        "selectedCandidates": {key: value for key, value in SELECTIONS.items() if key != "bulkhead-lamp"},
    }, [frames[name] for name in ORDER]


def lamp_frames() -> list[Image.Image]:
    base = normalize(remove_green(Image.open(CANDIDATES / SELECTIONS["bulkhead-lamp"])), (58, 90), baseline=94)
    frames: list[Image.Image] = []
    for index in range(4):
        rgba = np.asarray(base, dtype=np.uint8).copy()
        warm = (rgba[:, :, 3] > 0) & (rgba[:, :, 0] > 185) & (rgba[:, :, 1] > 55) & (rgba[:, :, 2] < 95)
        if index == 0:
            rgba[:, :, :3][warm] = (rgba[:, :, :3][warm].astype(np.float32) * np.array([0.92, 0.82, 0.78])).clip(0, 255).astype(np.uint8)
        elif index == 1:
            rgba[:, :, 0][warm] = np.minimum(255, rgba[:, :, 0][warm].astype(np.int16) + 12).astype(np.uint8)
        elif index == 2:
            rgba[:, :, 0][warm] = np.minimum(255, rgba[:, :, 0][warm].astype(np.int16) + 28).astype(np.uint8)
            rgba[:, :, 1][warm] = np.minimum(255, rgba[:, :, 1][warm].astype(np.int16) + 18).astype(np.uint8)
        else:
            rgba[:, :, 1][warm] = np.minimum(255, rgba[:, :, 1][warm].astype(np.int16) + 10).astype(np.uint8)
        frame = Image.fromarray(rgba, "RGBA")
        frames.append(frame)
    return frames


def pack_lamps() -> dict[str, object]:
    frames = lamp_frames()
    strip = Image.new("RGBA", (256, 96), (0, 0, 0, 0))
    names = ["low", "left", "high", "right"]
    for index, frame in enumerate(frames):
        cell = frame.resize((64, 96), Image.Resampling.NEAREST)
        strip.alpha_composite(cell, (index * 64, 0))
        cell.resize((512, 768), Image.Resampling.NEAREST).save(ENLARGED / f"bulkhead-wall-lamp-{names[index]}-8x.png")
    destination = PUBLIC / "props/bulkhead-wall-lamp-v4-4x1.webp"
    destination.parent.mkdir(parents=True, exist_ok=True)
    strip.save(destination, "WEBP", lossless=True, method=6)
    strip.save(CONTACTS / "bulkhead-wall-lamp-v4-4x1.png")
    return {
        "url": "/assets/profile/adventure/room-v3/props/bulkhead-wall-lamp-v4-4x1.webp",
        "size": [256, 96], "frameSize": [64, 96], "frameOrder": names,
        "sha256": sha256(destination), "bytes": destination.stat().st_size,
        "layoutVersion": "grounded-v4", "selectedCandidate": SELECTIONS["bulkhead-lamp"],
    }


def update_manifest(furniture: dict[str, object], lamps: dict[str, object]) -> None:
    path = PUBLIC / "profile-room-v3-manifest.json"
    manifest = json.loads(path.read_text())
    manifest["version"] = "2026-07-17.profile-room-grounded-v4.1"
    manifest["layoutVersion"] = "grounded-v4"
    manifest["generatedAt"] = datetime.now(timezone.utc).isoformat()
    manifest["furniture"] = furniture
    manifest["lamps"] = lamps
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


def write_review(furniture: dict[str, object], lamps: dict[str, object]) -> None:
    lines = [
        "# Profile room grounded-v4 visual review",
        "",
        "All candidates below were opened with `view_image` at original resolution before selection.",
        "",
        "| Asset | Accepted | Rejected | Review |",
        "|---|---|---|---|",
        "| Blackboard | blackboard-b | blackboard-a | Both level; B has the cleanest single continuous tray. |",
        "| Desk | desk-a | desk-b | A has the most readable horizontal front/rear axes and grounded shared baseline. |",
        "| Chair | chair-b | chair-a | B has clearer seat depth and matching walnut highlights. |",
        "| North-facing sofa | sofa-d (TV component removed) | sofa-a, sofa-b, sofa-c | A/B face south; C/D fixed the rear view, D has cleaner proportions. |",
        "| CRT cabinet | tv-cabinet-a | tv-cabinet-b | A has a clearer 4:3 transparent aperture and classic cabinet silhouette. |",
        "| Bulkhead lamp | bulkhead-lamp-a | bulkhead-lamp-b | A has rear plate, hook and cage; B still reads as a floor/table lantern. |",
        "",
        f"Furniture SHA-256: `{furniture['sha256']}`",
        f"Bulkhead lamps SHA-256: `{lamps['sha256']}`",
        f"TV screen rect: `{furniture['sprites']['tv-cabinet']['screenRectPixels']}` in the 128x128 cell.",
        "",
        "The sofa-d source contained a separate TV above the accepted sofa. The packer crops that disconnected rejected component and keeps the single north-facing sofa instance only.",
    ]
    (RUN / "review.md").write_text("\n".join(lines) + "\n")


def main() -> None:
    CONTACTS.mkdir(parents=True, exist_ok=True)
    ENLARGED.mkdir(parents=True, exist_ok=True)
    furniture, _ = pack_furniture()
    lamps = pack_lamps()
    update_manifest(furniture, lamps)
    write_review(furniture, lamps)
    (RUN / "asset-metadata.json").write_text(json.dumps({"furniture": furniture, "lamps": lamps}, indent=2) + "\n")
    print(json.dumps({"furniture": furniture, "lamps": lamps}, indent=2))


if __name__ == "__main__":
    main()
