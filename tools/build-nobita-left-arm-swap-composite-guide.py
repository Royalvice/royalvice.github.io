#!/usr/bin/env python3
"""Composite a natural long front arm and mirrored bent back arm into one i2i input."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts/profile-sprite-review"
BASE = (
    ARTIFACTS
    / "2026-07-23-nobita-left-arm-swap-structural-r1/candidates/candidate-03.png"
)
BASE_SHA256 = "3487be15e82a4170dd47f3769e227accfd66b5ccb73daa3a6694061b0cbadadc"
ARM_SOURCE = (
    ARTIFACTS
    / "2026-07-22-nobita-left-two-frame-clean-r1/frame-a/candidate-14.png"
)
ARM_SOURCE_SHA256 = "97274ec46daaf94f412ebd8100bc22e8b5856b17464587d13082f80ff5399b83"
RUN = ARTIFACTS / "2026-07-23-nobita-left-arm-swap-composite-r1"
OUTPUT = RUN / "arm-swap-composite-guide-v2.png"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    if sha256(BASE) != BASE_SHA256:
        raise ValueError("Structural C03 base hash changed")
    if sha256(ARM_SOURCE) != ARM_SOURCE_SHA256:
        raise ValueError("A14 arm source hash changed")

    with Image.open(BASE) as base_image:
        image = base_image.convert("RGB").copy()
    with Image.open(ARM_SOURCE) as arm_source_image:
        arm_source = arm_source_image.convert("RGB")
    if image.size != (1024, 1024) or arm_source.size != (1024, 1024):
        raise ValueError("Both sources must be 1024x1024")

    # Remove only C03's screen-right/back arm; keep its natural long front arm.
    background = Image.new("RGB", image.size, (0, 0, 0))
    clear_mask = Image.new("L", image.size, 0)
    from PIL import ImageDraw

    clear_draw = ImageDraw.Draw(clear_mask)
    clear_draw.polygon(
        [(545, 518), (631, 516), (704, 713), (682, 754), (606, 758), (559, 667)],
        fill=255,
    )
    image.paste(background, mask=clear_mask)

    # A14's bent front arm has the shoulder on the crop's right and fist on the left.
    # Mirroring the crop puts the shoulder on the left and fist on the right, which is
    # the desired screen-right/back arm shape for the opposite contact pose.
    crop_box = (318, 570, 438, 700)
    arm_crop = arm_source.crop(crop_box)
    foreground = arm_crop.convert("RGB").point(
        lambda value: 255 if value > 22 else 0
    ).convert("L")
    foreground = foreground.filter(ImageFilter.MaxFilter(7))
    arm_crop = arm_crop.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    foreground = foreground.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.paste(arm_crop, (586, 542), foreground)

    RUN.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, format="PNG", optimize=True)
    record = {
        "method": "single-image-natural-arm-composite-guide",
        "base": BASE.relative_to(ROOT).as_posix(),
        "baseSha256": BASE_SHA256,
        "armSource": ARM_SOURCE.relative_to(ROOT).as_posix(),
        "armSourceSha256": ARM_SOURCE_SHA256,
        "output": OUTPUT.relative_to(ROOT).as_posix(),
        "outputSha256": sha256(OUTPUT),
        "outputSize": [1024, 1024],
        "inputImageCountForNextI2I": 1,
        "composition": {
            "keptFromBase": "head, torso, legs and natural long screen-left/front arm",
            "mirroredFromA14": "natural bent arm placed on the screen-right/back side",
            "nextEditTarget": "only repair the screen-right shoulder connection"
        }
    }
    (RUN / "guide.json").write_text(
        json.dumps(record, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(OUTPUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
