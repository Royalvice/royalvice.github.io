from __future__ import annotations

import json
from colorsys import rgb_to_hsv
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/assets/gallery/materials/dark_wood/dark_wood_diff_2k.jpg"
OUT_DIR = ROOT / "public/assets/gallery/materials/warm_cabinet_wood"


PRESETS = {
    "warm_wall_basecolor_v5.jpg": {
        "black": (54, 28, 14),
        "white": (194, 108, 58),
        "contrast": 1.12,
        "color": 0.96,
        "brightness": 1.08,
    },
    "warm_frame_basecolor_v5.jpg": {
        "black": (28, 14, 7),
        "white": (138, 70, 36),
        "contrast": 1.10,
        "color": 0.96,
        "brightness": 0.98,
    },
    "warm_floor_basecolor_v5.jpg": {
        "black": (34, 16, 9),
        "white": (118, 58, 31),
        "contrast": 1.08,
        "color": 0.94,
        "brightness": 0.90,
    },
}


def mean_hsv(path: Path) -> dict[str, float | list[int]]:
    img = Image.open(path).convert("RGB").resize((96, 96), Image.Resampling.BILINEAR)
    pixels = list(img.getdata())
    avg_rgb = [sum(pixel[i] for pixel in pixels) / len(pixels) for i in range(3)]
    hsv = [rgb_to_hsv(pixel[0] / 255, pixel[1] / 255, pixel[2] / 255) for pixel in pixels]
    return {
        "avgRgb": [round(value, 2) for value in avg_rgb],
        "avgHue": round(sum(item[0] for item in hsv) / len(hsv), 4),
        "avgSaturation": round(sum(item[1] for item in hsv) / len(hsv), 4),
        "avgValue": round(sum(item[2] for item in hsv) / len(hsv), 4),
    }


def make_texture(source: Image.Image, name: str, config: dict) -> Path:
    gray = ImageOps.grayscale(source)
    graded = ImageOps.colorize(gray, black=config["black"], white=config["white"]).convert("RGB")
    graded = ImageEnhance.Contrast(graded).enhance(config["contrast"])
    graded = ImageEnhance.Color(graded).enhance(config["color"])
    graded = ImageEnhance.Brightness(graded).enhance(config["brightness"])
    out = OUT_DIR / name
    graded.save(out, quality=92, optimize=True)
    return out


def main() -> None:
    if not SRC.exists():
        raise FileNotFoundError(SRC)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SRC).convert("RGB")
    report = {"source": str(SRC.relative_to(ROOT)), "outputs": {}}
    for name, config in PRESETS.items():
        out = make_texture(source, name, config)
        report["outputs"][name] = {
            "path": str(out.relative_to(ROOT)),
            "bytes": out.stat().st_size,
            **mean_hsv(out),
        }
    report_path = OUT_DIR / "warm_cabinet_wood_v5.report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
