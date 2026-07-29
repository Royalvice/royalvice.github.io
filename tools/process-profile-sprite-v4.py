#!/usr/bin/env python3
"""Process one independent Flux sprite frame for strict-v4 review.

The Flux output remains in the review run.  This command invokes the shared
imagegen chroma-key helper first, then normalizes the resulting alpha image to
the 128px runtime cell and writes an enlarged nearest-neighbour review image.
"""

from __future__ import annotations

import argparse
from collections import deque
import json
from statistics import median
import subprocess
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
REMOVE_KEY = Path.home() / ".codex/skills/.system/imagegen/scripts/remove_chroma_key.py"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--key", required=True)
    parser.add_argument("--review", type=Path, required=True)
    parser.add_argument("--max-height", type=int, default=110)
    parser.add_argument("--baseline", type=int, default=118)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def sample_border_color(source: Path) -> tuple[int, int, int]:
    image = Image.open(source).convert("RGB")
    samples = []
    for x in range(image.width):
        samples.extend((image.getpixel((x, 0)), image.getpixel((x, image.height - 1))))
    for y in range(1, image.height - 1):
        samples.extend((image.getpixel((0, y)), image.getpixel((image.width - 1, y))))
    return tuple(round(median(channel)) for channel in zip(*samples))


def clear_connected_background(source: Path, keyed: Path, key_rgb: tuple[int, int, int]) -> None:
    """Clear border-connected chroma and its soft cast shadow only.

    Flux occasionally paints a dark translucent shadow beneath a character.
    A global colour deletion would damage skin and orange clothing, so this is
    deliberately a flood fill from the image border.  The backdrop and its
    connected shadow are removed while similarly coloured interior pixels stay
    untouched.
    """
    raw = Image.open(source).convert("RGB")
    image = Image.open(keyed).convert("RGBA")
    width, height = raw.size
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        queue.append((x, 0)); queue.append((x, height - 1))
    for y in range(1, height - 1):
        queue.append((0, y)); queue.append((width - 1, y))

    def close(pixel: tuple[int, int, int]) -> bool:
        return sum((pixel[index] - key_rgb[index]) ** 2 for index in range(3)) ** 0.5 <= 100

    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if visited[index]:
            continue
        visited[index] = 1
        if not close(raw.getpixel((x, y))):
            continue
        image.putpixel((x, y), (*image.getpixel((x, y))[:3], 0))
        if x > 0: queue.append((x - 1, y))
        if x + 1 < width: queue.append((x + 1, y))
        if y > 0: queue.append((x, y - 1))
        if y + 1 < height: queue.append((x, y + 1))
    image.save(keyed, "PNG")


def invoke_keyer(source: Path, temporary: Path, key: str, force: bool) -> None:
    sampled = sample_border_color(source)
    sampled_hex = "#%02x%02x%02x" % sampled
    command = [
        sys.executable,
        str(REMOVE_KEY),
        "--input",
        str(source),
        "--out",
        str(temporary),
        "--key-color",
        sampled_hex,
        "--auto-key",
        "none",
        "--tolerance",
        "48",
        "--edge-contract",
        "1",
        "--despill",
    ]
    if force:
        command.append("--force")
    subprocess.run(command, check=True)
    clear_connected_background(source, temporary, sampled)


def strip_key_halo(source: Image.Image, key: str) -> Image.Image:
    """Remove residual saturated key-colour pixels left by antialiasing.

    The shared keyer despills most edges, but the generated sheets sometimes
    retain one-pixel magenta/green/cyan halos.  Those colours are not present
    in the approved wardrobe, so removing only pixels close to the requested
    key is safe and keeps the final alpha edge clean at 128px.
    """
    rgb = tuple(int(key[index:index + 2], 16) for index in (1, 3, 5))
    key_upper = key.upper()
    image = source.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha < 24:
                pixels[x, y] = (red, green, blue, 0)
                continue
            distance = ((red - rgb[0]) ** 2 + (green - rgb[1]) ** 2 + (blue - rgb[2]) ** 2) ** 0.5
            # Auto-key sampling can pick a slightly shifted hue (Flux often
            # turns #ff00ff into a pink-magenta).  Also reject that hue family
            # by channel dominance so a one-pixel halo cannot survive merely
            # because the sampled border was not exactly the requested key.
            family_match = False
            if key_upper == "#00FF00":
                family_match = green > 125 and green - max(red, blue) > 48
            elif key_upper == "#00FFFF":
                family_match = green > 125 and blue > 125 and red < 135 and green + blue - red * 2 > 150
            elif key_upper == "#FF00FF":
                # Keep warm skin/orange cloth intact; only remove the very
                # saturated pink-magenta family used by the chroma backdrop.
                family_match = red > 170 and blue > 145 and green < 115 and red + blue - green * 2 > 180
            if family_match:
                distance = min(distance, 70)
            if distance < 95:
                pixels[x, y] = (red, green, blue, 0)
            elif distance < 155:
                pixels[x, y] = (red, green, blue, round(alpha * (distance - 95) / 60))
    return image


def normalize(source: Image.Image, max_height: int, baseline: int, key: str) -> tuple[Image.Image, dict[str, object]]:
    image = strip_key_halo(source, key)
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError("The chroma-key result contains no visible subject")
    # Keep a small transparent margin so the final frame can be reviewed for
    # edge halos without touching the character silhouette.
    left = max(0, bbox[0] - 5)
    top = max(0, bbox[1] - 5)
    right = min(image.width, bbox[2] + 5)
    bottom = min(image.height, bbox[3] + 5)
    subject = image.crop((left, top, right, bottom))
    scale = min(110 / max(1, subject.width), max_height / max(1, subject.height))
    width = max(1, round(subject.width * scale))
    height = max(1, round(subject.height * scale))
    subject = subject.resize((width, height), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    x = (128 - width) // 2
    y = baseline - height
    frame.alpha_composite(subject, (x, y))
    # Lanczos resampling can reintroduce a faint key-colour fringe even after
    # the source matte was cleaned.  Run the same family filter on the final
    # 128px frame and quantise barely visible alpha to transparent.
    frame = strip_key_halo(frame, key)
    final_pixels = frame.load()
    for yy in range(frame.height):
        for xx in range(frame.width):
            red, green, blue, alpha = final_pixels[xx, yy]
            if alpha < 32:
                final_pixels[xx, yy] = (0, 0, 0, 0)
    final_bbox = frame.getchannel("A").getbbox()
    if final_bbox is None:
        raise RuntimeError("Normalized frame contains no alpha")
    alpha_pixels = sum(1 for value in frame.getchannel("A").getdata() if value > 18)
    metadata = {
        "sourceBbox": list(bbox),
        "alphaBbox": list(final_bbox),
        "pivot": [0.5, baseline / 128],
        "visiblePixels": alpha_pixels,
        "coverage": alpha_pixels / (128 * 128),
        "size": [128, 128],
        "baseline": baseline,
    }
    return frame, metadata


def main() -> None:
    args = parse_args()
    if args.out.exists() and not args.force:
        print(f"reuse {args.out}")
        return
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.review.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.out.with_suffix(".keyed.png")
    invoke_keyer(args.input, temporary, args.key, args.force)
    frame, metadata = normalize(Image.open(temporary), args.max_height, args.baseline, args.key)
    frame.save(args.out, "PNG")
    enlarged = frame.resize((1024, 1024), Image.Resampling.NEAREST)
    enlarged.save(args.review, "PNG")
    metadata["input"] = str(args.input)
    metadata["output"] = str(args.out)
    metadata["reviewImage"] = str(args.review)
    args.out.with_suffix(".json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n")
    temporary.unlink(missing_ok=True)
    print(json.dumps(metadata, ensure_ascii=False))


if __name__ == "__main__":
    main()
