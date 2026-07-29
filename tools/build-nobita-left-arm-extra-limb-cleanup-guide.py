#!/usr/bin/env python3
"""Remove the detached third hand from the first visibly arm-swapped candidate."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts/profile-sprite-review"
SOURCE = (
    ARTIFACTS
    / "2026-07-23-nobita-left-arm-swap-composite-r1/candidates/candidate-04.png"
)
SOURCE_SHA256 = "eeb77e570b9056e3b9c65cee5c263dd1755d54b14d108ae31ed2ffa45418b6f4"
RUN = ARTIFACTS / "2026-07-23-nobita-left-arm-swap-cleanup-r1"
OUTPUT = RUN / "remove-extra-arm-guide-v2.png"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    if sha256(SOURCE) != SOURCE_SHA256:
        raise ValueError("Composite C04 source hash changed")
    with Image.open(SOURCE) as source_image:
        if source_image.size != (1024, 1024):
            raise ValueError(f"Unexpected source size: {source_image.size}")
        image = source_image.convert("RGB").copy()

    # The detached third forearm/fist occupies only the far screen-right region.
    # Keep the long screen-left arm and the bent arm crossing the torso untouched.
    draw = ImageDraw.Draw(image)
    draw.polygon(
        [(618, 548), (706, 552), (712, 690), (608, 694), (608, 632)],
        fill=(0, 0, 0),
    )

    RUN.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, format="PNG", compress_level=6)
    record = {
        "method": "single-image-extra-limb-removal-guide",
        "source": SOURCE.relative_to(ROOT).as_posix(),
        "sourceSha256": SOURCE_SHA256,
        "output": OUTPUT.relative_to(ROOT).as_posix(),
        "outputSha256": sha256(OUTPUT),
        "outputSize": [1024, 1024],
        "inputImageCountForNextI2I": 1,
        "kept": [
            "screen-left long arm",
            "bent arm crossing the torso",
            "head, torso, legs and left-facing direction"
        ],
        "removed": "detached far screen-right third forearm and fist"
    }
    (RUN / "guide.json").write_text(
        json.dumps(record, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(OUTPUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
