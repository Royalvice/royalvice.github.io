#!/usr/bin/env python3
"""Build one-image, two-position i2i templates from approved Nobita canonicals."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = (
    ROOT
    / "artifacts"
    / "profile-sprite-review"
    / "final-directional-references"
    / "nobita"
)
OUTPUT_ROOT = (
    ROOT
    / "artifacts"
    / "profile-sprite-review"
    / "nobita-walk-pair-references-r1"
)

CANVAS_SIZE = (1024, 576)
CELL_CENTERS = (256, 768)
BASELINE_Y = 536
MAX_SUBJECT_SIZE = (380, 480)
CHROMA_KEY = (0, 255, 0, 255)

FILES = (
    "nobita-direction-down-reference.png",
    "nobita-direction-up-reference.png",
    "nobita-direction-left-reference.png",
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_pair(source_path: Path, output_path: Path) -> dict[str, object]:
    source = Image.open(source_path).convert("RGBA")
    alpha_bbox = source.getchannel("A").getbbox()
    if alpha_bbox is None:
        raise ValueError(f"No opaque subject found in {source_path}")

    subject = source.crop(alpha_bbox)
    scale = min(
        MAX_SUBJECT_SIZE[0] / subject.width,
        MAX_SUBJECT_SIZE[1] / subject.height,
    )
    resized_size = (
        max(1, round(subject.width * scale)),
        max(1, round(subject.height * scale)),
    )
    subject = subject.resize(resized_size, Image.Resampling.NEAREST)

    canvas = Image.new("RGBA", CANVAS_SIZE, CHROMA_KEY)
    placements: list[list[int]] = []
    for center_x in CELL_CENTERS:
        x = round(center_x - subject.width / 2)
        y = BASELINE_Y - subject.height
        canvas.alpha_composite(subject, (x, y))
        placements.append([x, y, subject.width, subject.height])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path)
    return {
        "source": str(source_path.relative_to(ROOT)),
        "output": str(output_path.relative_to(ROOT)),
        "sourceSha256": sha256(source_path),
        "outputSha256": sha256(output_path),
        "sourceAlphaBbox": list(alpha_bbox),
        "subjectSize": list(resized_size),
        "placements": placements,
        "baselineY": BASELINE_Y,
    }


def main() -> None:
    records = []
    for filename in FILES:
        records.append(build_pair(SOURCE_ROOT / filename, OUTPUT_ROOT / filename))
    (OUTPUT_ROOT / "manifest.json").write_text(
        json.dumps(
            {
                "description": "Two identical placements derived from one approved canonical frame; no action candidate is used.",
                "canvasSize": list(CANVAS_SIZE),
                "chromaKey": "#00FF00",
                "records": records,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
