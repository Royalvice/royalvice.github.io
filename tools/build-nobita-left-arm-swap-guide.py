#!/usr/bin/env python3
"""Create a single rough i2i input with Nobita's visible arm shapes swapped."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts/profile-sprite-review"
SOURCE = (
    ARTIFACTS
    / "2026-07-22-nobita-left-reverse-from-a14-r2/candidates/candidate-04.png"
)
SOURCE_SHA256 = "1412e15f5ffc655f51980fd80710936cb658d267944162d99ad14c49f3aa930c"
RUN = ARTIFACTS / "2026-07-23-nobita-left-arm-swap-structural-r1"
OUTPUT = RUN / "arm-swap-rough-guide.png"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    if sha256(SOURCE) != SOURCE_SHA256:
        raise ValueError("R2-04 source hash changed")
    with Image.open(SOURCE) as source_image:
        if source_image.size != (1024, 1024):
            raise ValueError(f"Unexpected source size: {source_image.size}")
        image = source_image.convert("RGB").copy()

    draw = ImageDraw.Draw(image)
    background = (0, 0, 0)
    outline = (3, 3, 2)
    shirt = (249, 175, 0)
    shirt_shadow = (219, 108, 0)
    skin = (253, 187, 72)
    skin_shadow = (231, 112, 24)

    # Remove the two old visible arm silhouettes while leaving the legs untouched.
    draw.polygon(
        [(318, 600), (421, 574), (441, 602), (431, 677), (387, 693), (326, 677)],
        fill=background,
    )
    draw.polygon(
        [(532, 543), (616, 532), (649, 720), (624, 750), (572, 747), (547, 681)],
        fill=background,
    )

    # Rebuild the shirt edges erased together with the old sleeves.
    draw.polygon(
        [(418, 535), (454, 526), (454, 668), (418, 668)],
        fill=outline,
    )
    draw.polygon(
        [(430, 540), (454, 534), (454, 662), (430, 662)],
        fill=shirt,
    )
    draw.polygon(
        [(548, 535), (594, 541), (606, 583), (566, 595), (548, 581)],
        fill=outline,
    )
    draw.polygon(
        [(557, 544), (586, 548), (596, 578), (570, 586), (558, 577)],
        fill=shirt,
    )

    # New front arm: use the long-arm silhouette on the screen-left/front side.
    draw.line([(425, 565), (402, 610)], fill=outline, width=50)
    draw.line([(425, 565), (402, 610)], fill=shirt, width=34)
    draw.line([(401, 610), (370, 654), (329, 681)], fill=outline, width=38, joint="curve")
    draw.line([(401, 610), (370, 654), (329, 681)], fill=skin, width=25, joint="curve")
    draw.ellipse((312, 662, 345, 696), fill=outline)
    draw.ellipse((321, 669, 340, 690), fill=skin)
    draw.line([(393, 623), (360, 663)], fill=skin_shadow, width=5)

    # New back arm: use the compact bent-arm silhouette on the screen-right/back side.
    draw.line([(580, 566), (610, 602)], fill=outline, width=48)
    draw.line([(580, 566), (610, 602)], fill=shirt, width=32)
    draw.line([(610, 602), (635, 638), (670, 617)], fill=outline, width=38, joint="curve")
    draw.line([(610, 602), (635, 638), (670, 617)], fill=skin, width=25, joint="curve")
    draw.ellipse((657, 600, 688, 630), fill=outline)
    draw.ellipse((663, 606, 682, 624), fill=skin)
    draw.line([(624, 614), (641, 634)], fill=skin_shadow, width=5)

    # A little sleeve shading helps the i2i model read depth without adding another input.
    draw.line([(415, 582), (400, 610)], fill=shirt_shadow, width=5)
    draw.line([(593, 580), (608, 600)], fill=shirt_shadow, width=5)

    RUN.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, format="PNG", optimize=True)
    record = {
        "method": "single-image-structural-arm-swap-guide",
        "source": SOURCE.relative_to(ROOT).as_posix(),
        "sourceSha256": SOURCE_SHA256,
        "sourceSize": [1024, 1024],
        "output": OUTPUT.relative_to(ROOT).as_posix(),
        "outputSha256": sha256(OUTPUT),
        "outputSize": [1024, 1024],
        "inputImageCountForNextI2I": 1,
        "changes": [
            "Only the two arm regions were locally redrawn.",
            "The long visible arm shape was moved to the screen-left/front side.",
            "The compact bent arm shape was moved to the screen-right/back side.",
            "The legs, head and main torso pixels were not transformed.",
        ],
    }
    (RUN / "guide.json").write_text(
        json.dumps(record, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(OUTPUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
