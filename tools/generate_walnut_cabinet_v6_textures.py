from __future__ import annotations

import json
import math
import shutil
import colorsys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/assets/gallery/materials/polyhaven_candidates/european_walnut_veneer_05"
OUT = ROOT / "public/assets/gallery/materials/walnut_cabinet_v6"


VARIANTS = {
    "walnut_wall_basecolor_v6.jpg": {
        "target_hue": 0.074,
        "hue_mix": 0.78,
        "sat": 1.34,
        "sat_floor": 0.34,
        "value": 1.02,
        "contrast": 1.28,
        "brightness": 0.98,
        "gamma": 0.78,
        "grain": 0.22,
        "line_strength": 0.090,
    },
    "walnut_side_basecolor_v6.jpg": {
        "target_hue": 0.070,
        "hue_mix": 0.82,
        "sat": 1.42,
        "sat_floor": 0.38,
        "value": 0.96,
        "contrast": 1.34,
        "brightness": 0.92,
        "gamma": 0.78,
        "grain": 0.24,
        "line_strength": 0.105,
    },
    "walnut_frame_basecolor_v6.jpg": {
        "target_hue": 0.068,
        "hue_mix": 0.84,
        "sat": 1.42,
        "sat_floor": 0.40,
        "value": 0.88,
        "contrast": 1.34,
        "brightness": 0.88,
        "gamma": 0.78,
        "grain": 0.24,
        "line_strength": 0.085,
    },
    "walnut_floor_basecolor_v6.jpg": {
        "target_hue": 0.072,
        "hue_mix": 0.82,
        "sat": 1.40,
        "sat_floor": 0.38,
        "value": 0.94,
        "contrast": 1.28,
        "brightness": 0.92,
        "gamma": 0.78,
        "grain": 0.20,
        "line_strength": 0.085,
    },
}


def wrap_hue_lerp(source: float, target: float, mix: float) -> float:
    delta = ((target - source + 0.5) % 1.0) - 0.5
    return (source + delta * mix) % 1.0


def grade_basecolor(source: Image.Image, config: dict[str, float]) -> Image.Image:
    rgb = source.convert("RGB")
    blurred = rgb.filter(ImageFilter.GaussianBlur(radius=18))
    px = rgb.load()
    blur_px = blurred.load()
    width, height = rgb.size

    out = Image.new("RGB", rgb.size)
    out_px = out.load()

    target_hue = config["target_hue"]
    hue_mix = config["hue_mix"]
    sat_mul = config["sat"]
    sat_floor = config["sat_floor"]
    value_mul = config["value"]
    gamma = config["gamma"]
    grain = config["grain"]
    line_strength = config.get("line_strength", 0.0)

    for y in range(height):
        wave = math.sin(y / max(1.0, height) * math.tau * 9.0) * 0.020
        macro_line = math.sin(y / max(1.0, height) * math.tau * 19.0) * 0.5 + 0.5
        micro_line = math.sin(y / max(1.0, height) * math.tau * 83.0 + 0.7) * 0.5 + 0.5
        for x in range(width):
            r, g, b = px[x, y]
            br, bg, bb = blur_px[x, y]
            grain_luma = ((r + g + b) - (br + bg + bb)) / (255.0 * 3.0)
            long_wave = math.sin(
                y / max(1.0, height) * math.tau * 31.0
                + math.sin(x / max(1.0, width) * math.tau * 2.5) * 0.75
            ) * 0.5 + 0.5
            dark_line = (
                max(0.0, 0.55 - macro_line) * 0.70
                + max(0.0, 0.50 - micro_line) * 0.30
                + max(0.0, 0.52 - long_wave) * 0.55
            ) * line_strength
            h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
            h = wrap_hue_lerp(h, target_hue + wave, hue_mix)
            s = min(0.72, max(sat_floor, s * sat_mul + abs(grain_luma) * 0.18 + dark_line * 0.35))
            v = max(0.02, min(0.94, (v ** gamma) * value_mul + grain_luma * grain - dark_line))
            rr, gg, bb2 = colorsys.hsv_to_rgb(h, s, v)
            out_px[x, y] = (
                int(max(0, min(255, rr * 255))),
                int(max(0, min(255, gg * 255))),
                int(max(0, min(255, bb2 * 255))),
            )

    out = ImageEnhance.Contrast(out).enhance(config["contrast"])
    out = ImageEnhance.Brightness(out).enhance(config["brightness"])
    return out


def image_stats(path: Path) -> dict[str, object]:
    image = Image.open(path).convert("RGB").resize((128, 128), Image.Resampling.BILINEAR)
    total = 0
    rgb = [0.0, 0.0, 0.0]
    hsv = [0.0, 0.0, 0.0]
    grayish = 0
    for r, g, b in image.getdata():
        total += 1
        rgb[0] += r
        rgb[1] += g
        rgb[2] += b
        h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
        hsv[0] += h
        hsv[1] += s
        hsv[2] += v
        if s < 0.18 and v > 0.28:
            grayish += 1
    return {
        "meanRgb": [round(value / total, 2) for value in rgb],
        "meanHsv": [round(value / total, 4) for value in hsv],
        "grayishRatio": round(grayish / total, 4),
    }


def main() -> None:
    source_diff = SOURCE / "diff_original.jpg"
    if not source_diff.exists():
        source_diff = SOURCE / "diff.jpg"
    if not source_diff.exists():
        raise SystemExit(f"Missing walnut source diffuse: {source_diff}")

    OUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(source_diff).convert("RGB")

    report: dict[str, object] = {
        "version": "v6",
        "source": str(source_diff.relative_to(ROOT)),
        "license": "CC0 / Public Domain via Poly Haven European Walnut Veneer 05",
        "purpose": "Chroma-stable premium walnut cabinet runtime albedo set.",
        "outputs": {},
    }

    for filename, config in VARIANTS.items():
        target = OUT / filename
        grade_basecolor(source, config).save(target, quality=93, subsampling=1, optimize=True)
        report["outputs"][filename] = image_stats(target)  # type: ignore[index]

    for src_name, dst_name in (
        ("normal.jpg", "walnut_normal_v6.jpg"),
        ("ao.jpg", "walnut_ao_v6.jpg"),
    ):
        src = SOURCE / src_name
        dst = OUT / dst_name
        if not src.exists():
            raise SystemExit(f"Missing walnut source map: {src}")
        shutil.copyfile(src, dst)
        report["outputs"][dst_name] = {"copiedFrom": str(src.relative_to(ROOT))}  # type: ignore[index]

    rough_src = SOURCE / "rough.jpg"
    rough_dst = OUT / "walnut_roughness_v6.jpg"
    if not rough_src.exists():
        raise SystemExit(f"Missing walnut source map: {rough_src}")
    rough = Image.open(rough_src).convert("L")
    # The raw Poly Haven veneer roughness is handsome but too matte once inside
    # the small dark cabinet. Compress it toward a satin walnut finish so HDR
    # highlights can prove that this is PBR wood, not a flat brown bitmap.
    rough = ImageEnhance.Contrast(rough).enhance(0.82)
    rough = ImageEnhance.Brightness(rough).enhance(0.70)
    rough.save(rough_dst, quality=93, optimize=True)
    report["outputs"]["walnut_roughness_v6.jpg"] = image_stats(rough_dst)  # type: ignore[index]

    floor_rough_dst = OUT / "walnut_floor_roughness_v6.jpg"
    floor_rough = Image.open(rough_src).convert("L")
    # A separate floor roughness map makes the base read like polished metal-
    # lacquered wood/inlay under HDR, while walls stay satin rather than wet.
    floor_rough = ImageEnhance.Contrast(floor_rough).enhance(0.76)
    floor_rough = ImageEnhance.Brightness(floor_rough).enhance(0.42)
    floor_rough.save(floor_rough_dst, quality=93, optimize=True)
    report["outputs"]["walnut_floor_roughness_v6.jpg"] = image_stats(floor_rough_dst)  # type: ignore[index]

    report_path = OUT / "walnut_cabinet_v6.report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
