#!/usr/bin/env python3
"""Build deterministic review contact sheets from processed 128px frames."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ACTORS = ["nobita", "doraemon", "shizuka", "gian", "suneo"]
KINDS = {
    "base": ["idle", "walk-contact", "walk-passing", "walk-opposite-contact", "interaction-a", "interaction-b", "portal-reaction", "celebration", "character-signature"],
    "movement": ["down-0", "down-1", "down-2", "side-0", "side-1", "side-2", "up-0", "up-1", "up-2"],
    "life": ["think-a", "think-b", "drink-a", "drink-b", "sit-game-a", "sit-game-b", "portal-enter", "portal-return", "room-reaction"],
}


def fit(image: Image.Image, size: int = 160) -> Image.Image:
    background = Image.new("RGBA", (size, size), (19, 24, 24, 255))
    sprite = image.convert("RGBA").resize((size, size), Image.Resampling.NEAREST)
    background.alpha_composite(sprite)
    return background.convert("RGB")


def make_sheet(run: Path, actor: str, kind: str) -> Path:
    out_dir = run / "sequence-reviews" / actor
    out_dir.mkdir(parents=True, exist_ok=True)
    frames = KINDS[kind]
    cell_w, cell_h = 180, 186
    sheet = Image.new("RGB", (cell_w * 3, cell_h * 3), "#0a0d0d")
    draw = ImageDraw.Draw(sheet)
    for index, frame in enumerate(frames):
        path = run / "processed" / actor / kind / f"{frame}.png"
        if path.exists():
            image = fit(Image.open(path))
            sheet.paste(image, ((index % 3) * cell_w + 10, (index // 3) * cell_h + 4))
        else:
            draw.rectangle(((index % 3) * cell_w + 10, (index // 3) * cell_h + 4, (index % 3) * cell_w + 170, (index // 3) * cell_h + 164), outline="#9a4b4b", width=2)
        draw.text(((index % 3) * cell_w + 8, (index // 3) * cell_h + 167), frame, fill="#e8d8aa")
    target = out_dir / f"{kind}-contact.png"
    sheet.save(target)
    return target


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default="2026-07-18-strict-v4")
    parser.add_argument("--actor")
    parser.add_argument("--kind")
    args = parser.parse_args()
    run = ROOT / "artifacts/profile-sprite-review" / args.run
    actors = [args.actor] if args.actor else ACTORS
    kinds = [args.kind] if args.kind else list(KINDS)
    for actor in actors:
        for kind in kinds:
            print(make_sheet(run, actor, kind))


if __name__ == "__main__":
    main()
