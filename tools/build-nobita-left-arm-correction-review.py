#!/usr/bin/env python3
"""Build a numbered review sheet for a Nobita left-facing arm correction run."""

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts/profile-sprite-review"
VARIANT = os.environ.get("NOBITA_ARM_VARIANT", "r1")
RUN_NAMES = {
    "r1": "2026-07-23-nobita-left-arm-correction-from-r2-04-r1",
    "r2": "2026-07-23-nobita-left-arm-correction-from-r2-04-r2",
    "r3": "2026-07-23-nobita-left-arm-swap-structural-r1",
    "r4": "2026-07-23-nobita-left-arm-swap-composite-r1",
    "r5": "2026-07-23-nobita-left-arm-swap-cleanup-r1",
}
if VARIANT not in RUN_NAMES:
    raise ValueError("NOBITA_ARM_VARIANT must be exactly 'r1', 'r2', 'r3', 'r4' or 'r5'")
RUN = ARTIFACTS / RUN_NAMES[VARIANT]
OUTPUT = RUN / "nobita-left-arm-correction-review-numbered.png"
ANIMATED_OUTPUT = RUN / "nobita-left-arm-correction-pair-previews.gif"
FOCUS_PREVIEW = RUN / "nobita-left-a14-c01-two-frame-preview.gif"
FOCUS_CONTACT = RUN / "nobita-left-a14-c01-contact.png"
EDIT_SOURCE = (
    RUN / "arm-swap-rough-guide.png"
    if VARIANT == "r3"
    else RUN / "arm-swap-composite-guide-v2.png"
    if VARIANT == "r4"
    else RUN / "remove-extra-arm-guide-v2.png"
    if VARIANT == "r5"
    else ARTIFACTS / "2026-07-22-nobita-left-reverse-from-a14-r2/candidates/candidate-04.png"
)
EDIT_SOURCE_LABEL = (
    "STRUCTURAL GUIDE"
    if VARIANT == "r3"
    else "COMPOSITE GUIDE"
    if VARIANT == "r4"
    else "TWO-ARM CLEANUP GUIDE"
    if VARIANT == "r5"
    else "EDIT SOURCE - R2-04"
)

ITEMS = (
    (
        "PAIR FRAME A - A14",
        ARTIFACTS
        / "2026-07-22-nobita-left-two-frame-clean-r1/frame-a/candidate-14.png",
    ),
    (
        EDIT_SOURCE_LABEL,
        EDIT_SOURCE,
    ),
    ("C01", RUN / "candidates/candidate-01.png"),
    ("C02", RUN / "candidates/candidate-02.png"),
    ("C03", RUN / "candidates/candidate-03.png"),
    ("C04", RUN / "candidates/candidate-04.png"),
)


def load_font(size: int, *, bold: bool = False) -> ImageFont.ImageFont:
    paths = (
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
        if bold
        else Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
        if bold
        else Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    )
    for path in paths:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def main() -> None:
    for _, path in ITEMS:
        if not path.is_file():
            raise FileNotFoundError(path)

    canvas = Image.new("RGB", (1640, 2510), "#15181c")
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(45, bold=True)
    note_font = load_font(23)
    label_font = load_font(29, bold=True)

    draw.text(
        (60, 34),
        f"NOBITA LEFT - ARM SWING CORRECTION {VARIANT.upper()}",
        fill="white",
        font=title_font,
    )
    draw.text(
        (60, 94),
        (
            "Input: structural guide only. Legs must stay unchanged. Compare each candidate with A14."
            if VARIANT in {"r3", "r4", "r5"}
            else "Input: R2-04 only. Legs must stay unchanged. Compare each candidate with A14."
        ),
        fill="#aeb8c2",
        font=note_font,
    )

    thumb_size = 720
    x_positions = (80, 840)
    y_positions = (210, 980, 1750)
    for index, (label, path) in enumerate(ITEMS):
        row, column = divmod(index, 2)
        x = x_positions[column]
        y = y_positions[row]
        with Image.open(path) as image:
            if image.size != (1024, 1024):
                raise ValueError(f"Unexpected size for {path}: {image.size}")
            thumb = image.convert("RGB").resize(
                (thumb_size, thumb_size), Image.Resampling.LANCZOS
            )
        canvas.paste(thumb, (x, y))
        draw.rectangle(
            (x, y, x + thumb_size - 1, y + thumb_size - 1),
            outline="#515a64",
            width=2,
        )
        label_width = 450 if index < 2 else 130
        draw.rounded_rectangle(
            (x + 14, y + 14, x + 14 + label_width, y + 65),
            radius=9,
            fill="#111418",
            outline="#6ed6ff",
            width=2,
        )
        draw.text((x + 28, y + 23), label, fill="white", font=label_font)

    canvas.save(OUTPUT, format="PNG", optimize=True)
    build_animated_pair_preview(label_font)
    build_focus_pair()
    print(OUTPUT.relative_to(ROOT))
    print(ANIMATED_OUTPUT.relative_to(ROOT))
    print(FOCUS_PREVIEW.relative_to(ROOT))
    print(FOCUS_CONTACT.relative_to(ROOT))


def build_animated_pair_preview(label_font: ImageFont.ImageFont) -> None:
    pair_a_path = ITEMS[0][1]
    candidate_items = ITEMS[2:]
    frame_canvases: list[Image.Image] = []
    for phase in ("a14", "candidate"):
        canvas = Image.new("RGB", (1460, 1460), "#15181c")
        draw = ImageDraw.Draw(canvas)
        for index, (candidate_label, candidate_path) in enumerate(candidate_items):
            row, column = divmod(index, 2)
            x = 20 + column * 720
            y = 20 + row * 720
            image_path = pair_a_path if phase == "a14" else candidate_path
            with Image.open(image_path) as image:
                sprite = image.convert("RGB").resize((700, 700), Image.Resampling.LANCZOS)
            canvas.paste(sprite, (x, y))
            draw.rectangle((x, y, x + 699, y + 699), outline="#515a64", width=2)
            draw.rounded_rectangle(
                (x + 14, y + 14, x + 250, y + 65),
                radius=9,
                fill="#111418",
                outline="#6ed6ff",
                width=2,
            )
            draw.text(
                (x + 28, y + 23),
                f"A14 / {candidate_label}",
                fill="white",
                font=label_font,
            )
        frame_canvases.append(canvas)

    frame_canvases[0].save(
        ANIMATED_OUTPUT,
        save_all=True,
        append_images=frame_canvases[1:],
        duration=500,
        loop=0,
        disposal=2,
    )


def build_focus_pair() -> None:
    images: list[Image.Image] = []
    for path in (ITEMS[0][1], ITEMS[2][1]):
        with Image.open(path) as image:
            images.append(image.convert("RGB").copy())
    images[0].save(
        FOCUS_PREVIEW,
        save_all=True,
        append_images=images[1:],
        duration=500,
        loop=0,
        disposal=2,
    )
    contact = Image.new("RGB", (2048, 1024), "black")
    contact.paste(images[0], (0, 0))
    contact.paste(images[1], (1024, 0))
    contact.save(FOCUS_CONTACT, format="PNG", optimize=True)


if __name__ == "__main__":
    main()
