#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "artifacts/profile-room-grounded-v4-review/2026-07-17-grounded-r1"
REFERENCES = RUN / "references"
GUIDES = RUN / "guides"
SOURCE_ATLAS = ROOT / "public/assets/profile/adventure/room-v3/furniture/furniture-3x3.webp"
SOURCE_LAMPS = ROOT / "public/assets/profile/adventure/room-v3/props/fuel-lamp-4x1.webp"

FURNITURE_CELLS = {
    "blackboard": 1,
    "desk": 3,
    "chair": 4,
    "sofa": 5,
    "tv-cabinet": 7,
}


def on_key_background(source: Image.Image, size: tuple[int, int] = (1024, 1024)) -> Image.Image:
    source = source.convert("RGBA")
    alpha = source.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError("reference cell has no visible pixels")
    source = source.crop(bbox)
    scale = min(size[0] * 0.78 / source.width, size[1] * 0.78 / source.height)
    source = source.resize((round(source.width * scale), round(source.height * scale)), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", size, "#00ff00")
    canvas.alpha_composite(source, ((size[0] - source.width) // 2, (size[1] - source.height) // 2))
    return canvas.convert("RGB")


def furniture_reference(name: str, cell: int) -> None:
    atlas = Image.open(SOURCE_ATLAS).convert("RGBA")
    x = cell % 3 * 128
    y = cell // 3 * 128
    on_key_background(atlas.crop((x, y, x + 128, y + 128))).save(REFERENCES / f"{name}-current.png")


def guide(name: str) -> None:
    image = Image.new("RGB", (1024, 1024), "#00ff00")
    draw = ImageDraw.Draw(image)
    dark = "#20150e"
    copper = "#9c6836"
    wood = "#704321"
    teal = "#164f49"
    cyan = "#8edfd6"
    white = "#e8ede8"

    if name == "blackboard":
        draw.rectangle((112, 260, 912, 690), fill=copper, outline=dark, width=24)
        draw.rectangle((150, 298, 874, 630), fill="#102d29", outline="#4c2c18", width=12)
        draw.rectangle((142, 642, 882, 684), fill=wood, outline=dark, width=10)
        draw.rectangle((665, 623, 768, 649), fill="#59635b", outline=dark, width=8)
    elif name == "desk":
        # Strong horizontal footprint with a restrained top-down depth axis.
        draw.polygon(((120, 330), (850, 330), (920, 610), (95, 610)), fill=wood, outline=dark)
        draw.line((120, 330, 850, 330), fill=copper, width=24)
        draw.line((95, 610, 920, 610), fill=dark, width=28)
        draw.rectangle((130, 610, 205, 880), fill="#442817", outline=dark, width=12)
        draw.rectangle((805, 610, 880, 880), fill="#442817", outline=dark, width=12)
        draw.rectangle((335, 412, 615, 525), fill="#d7c99e", outline=dark, width=10)
    elif name == "chair":
        draw.rectangle((325, 300, 700, 520), fill=wood, outline=dark, width=18)
        draw.polygon(((300, 545), (725, 545), (660, 720), (365, 720)), fill="#8a5a32", outline=dark)
        draw.rectangle((345, 700, 405, 900), fill="#432817", outline=dark, width=10)
        draw.rectangle((620, 700, 680, 900), fill="#432817", outline=dark, width=10)
    elif name == "sofa":
        # Faces north: seat is above the lower/back edge, aligned to the TV.
        draw.rounded_rectangle((100, 260, 920, 830), radius=70, fill="#0d302d", outline=dark, width=24)
        draw.rectangle((150, 320, 870, 610), fill=teal, outline="#0a2422", width=14)
        draw.line((510, 325, 510, 605), fill="#0a2422", width=12)
        draw.rectangle((150, 610, 870, 780), fill="#216a63", outline=dark, width=18)
        draw.rectangle((96, 365, 170, 760), fill="#164b46", outline=dark, width=16)
        draw.rectangle((850, 365, 924, 760), fill="#164b46", outline=dark, width=16)
    elif name == "tv-cabinet":
        draw.rectangle((108, 270, 916, 870), fill=wood, outline=dark, width=24)
        draw.rounded_rectangle((230, 295, 730, 660), radius=45, fill="#11191b", outline="#301c13", width=22)
        # Exactly rectangular transparent-key screen aperture.
        draw.rectangle((278, 344, 682, 610), fill="#00ff00", outline="#060a0b", width=12)
        draw.rectangle((145, 700, 878, 845), fill="#7f4f27", outline=dark, width=18)
        draw.rectangle((190, 733, 425, 817), fill="#3e2718", outline=dark, width=10)
        draw.rectangle((455, 733, 690, 817), fill="#3e2718", outline=dark, width=10)
        draw.rectangle((760, 682, 840, 802), fill=white, outline=dark, width=12)
        draw.line((800, 704, 800, 781), fill=cyan, width=8)
    elif name == "bulkhead-lamp":
        draw.rectangle((330, 145, 694, 866), fill="#3c2718", outline=dark, width=26)
        draw.rounded_rectangle((390, 255, 634, 712), radius=90, fill="#b77b37", outline="#1b120c", width=22)
        draw.rectangle((438, 310, 586, 650), fill="#ffe07d", outline="#5c3415", width=15)
        for x in (380, 485, 590):
            draw.rectangle((x, 245, x + 24, 730), fill="#5b391f", outline=dark, width=7)
        draw.rectangle((300, 105, 724, 220), fill="#724723", outline=dark, width=20)
        draw.rectangle((462, 60, 562, 130), fill="#604021", outline=dark, width=16)
    else:
        raise ValueError(name)
    image.save(GUIDES / f"{name}-axis-guide.png")


def main() -> None:
    REFERENCES.mkdir(parents=True, exist_ok=True)
    GUIDES.mkdir(parents=True, exist_ok=True)
    for name, cell in FURNITURE_CELLS.items():
        furniture_reference(name, cell)
    lamps = Image.open(SOURCE_LAMPS).convert("RGBA").crop((0, 0, 64, 96))
    on_key_background(lamps).save(REFERENCES / "bulkhead-lamp-current.png")
    for name in (*FURNITURE_CELLS, "bulkhead-lamp"):
        guide(name)


if __name__ == "__main__":
    main()
