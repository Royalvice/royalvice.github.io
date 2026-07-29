#!/usr/bin/env python3
"""Build a numbered contact sheet for one Profile A/C candidate pose."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
REVIEW_ROOT = ROOT / "artifacts/profile-sprite-review"


def font(size: int) -> ImageFont.ImageFont:
    for candidate in (
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ):
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--actor", required=True)
    parser.add_argument("--direction", choices=("down", "left", "up"), required=True)
    parser.add_argument("--pose", choices=("a", "c"), required=True)
    parser.add_argument("--run-id")
    args = parser.parse_args()

    run = REVIEW_ROOT / (args.run_id or f"2026-07-23-{args.actor}-abc-clean-r1")
    pose_dir = run / args.direction / f"frame-{args.pose}"
    candidates = sorted(
        candidate
        for candidate in pose_dir.glob("candidate-*.png")
        if re.fullmatch(r"candidate-\d{2}\.png", candidate.name)
    )
    if not candidates:
        raise FileNotFoundError(f"No candidates under {pose_dir}")

    columns = 4
    rows = (len(candidates) + columns - 1) // columns
    cell = 520
    sheet = Image.new("RGB", (columns * cell, rows * cell), "#161b1f")
    label_font = font(28)
    detail_font = font(18)
    for index, candidate in enumerate(candidates):
        with Image.open(candidate) as source:
            image = source.convert("RGB")
        image.thumbnail((500, 500), Image.Resampling.LANCZOS)
        column = index % columns
        row = index // columns
        x = column * cell + (cell - image.width) // 2
        y = row * cell + (cell - image.height) // 2
        sheet.paste(image, (x, y))
        draw = ImageDraw.Draw(sheet)
        draw.rounded_rectangle(
            (column * cell + 12, row * cell + 12, column * cell + 244, row * cell + 76),
            radius=9,
            fill="#0e1317",
            outline="#69ddff",
            width=2,
        )
        draw.text(
            (column * cell + 25, row * cell + 20),
            candidate.stem.upper(),
            fill="white",
            font=label_font,
        )
        draw.text(
            (column * cell + 25, row * cell + 51),
            f"{args.actor} · {args.direction} · {args.pose.upper()}",
            fill="#a5ebff",
            font=detail_font,
        )
    output = pose_dir / "candidate-review-contact.png"
    sheet.save(output, "PNG", optimize=True)
    print(output)


if __name__ == "__main__":
    main()
