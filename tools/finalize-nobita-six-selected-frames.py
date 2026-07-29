#!/usr/bin/env python3
"""Collect the six user-approved Nobita walk frames into one review package."""

from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


REPO_ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_ROOT = REPO_ROOT / "artifacts/profile-sprite-review"
OUTPUT_DIR = ARTIFACT_ROOT / "2026-07-23-nobita-six-selected-frames-r1"

FRAMES = (
    {
        "direction": "down",
        "frame": "01",
        "source_label": "A09",
        "seed": 74008,
        "job_id": "flux2-5bdb7009822c4e97",
        "source": ARTIFACT_ROOT
        / "2026-07-22-nobita-down-two-frame-clean-r1/selected-frame-a.png",
        "job_record": ARTIFACT_ROOT
        / "2026-07-22-nobita-down-two-frame-clean-r1/frame-a/candidate-09.job.json",
    },
    {
        "direction": "down",
        "frame": "02",
        "source_label": "B01",
        "seed": 75000,
        "job_id": "flux2-c00bf79c90dc4d54",
        "source": ARTIFACT_ROOT
        / "2026-07-22-nobita-down-two-frame-clean-r1/selected-frame-b.png",
        "job_record": ARTIFACT_ROOT
        / "2026-07-22-nobita-down-two-frame-clean-r1/frame-b/candidate-01.job.json",
    },
    {
        "direction": "up",
        "frame": "01",
        "source_label": "B01",
        "seed": 79000,
        "job_id": "flux2-93c1321227e4493e",
        "source": ARTIFACT_ROOT
        / "2026-07-22-nobita-up-two-frame-clean-r1/selected-frame-a.png",
        "job_record": ARTIFACT_ROOT
        / "2026-07-22-nobita-up-two-frame-clean-r1/frame-b/candidate-01.job.json",
    },
    {
        "direction": "up",
        "frame": "02",
        "source_label": "B04",
        "seed": 79003,
        "job_id": "flux2-1ea283280c3140f4",
        "source": ARTIFACT_ROOT
        / "2026-07-22-nobita-up-two-frame-clean-r1/selected-frame-b.png",
        "job_record": ARTIFACT_ROOT
        / "2026-07-22-nobita-up-two-frame-clean-r1/frame-b/candidate-04.job.json",
    },
    {
        "direction": "left",
        "frame": "01",
        "source_label": "A14",
        "seed": 76013,
        "job_id": "flux2-f8b7eed5bd1b4f7a",
        "source": ARTIFACT_ROOT
        / "2026-07-22-nobita-left-two-frame-clean-r1/selected-frame-a.png",
        "job_record": ARTIFACT_ROOT
        / "2026-07-22-nobita-left-two-frame-clean-r1/frame-a/candidate-14.job.json",
    },
    {
        "direction": "left",
        "frame": "02",
        "source_label": "R5-C01",
        "seed": 86000,
        "job_id": "flux2-6779f8c898f345c0",
        "source": ARTIFACT_ROOT
        / "2026-07-23-nobita-left-arm-swap-cleanup-r1/candidates/candidate-01.png",
        "job_record": ARTIFACT_ROOT
        / "2026-07-23-nobita-left-arm-swap-cleanup-r1/candidates/candidate-01.job.json",
    },
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative(path: Path) -> str:
    return path.relative_to(REPO_ROOT).as_posix()


def font(size: int, *, bold: bool = False) -> ImageFont.ImageFont:
    candidates = (
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
        if bold
        else Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
        Path("/System/Library/Fonts/Helvetica.ttc"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
        if bold
        else Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    )
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def validate_source(frame: dict[str, object]) -> dict[str, object]:
    source = frame["source"]
    job_record = frame["job_record"]
    assert isinstance(source, Path)
    assert isinstance(job_record, Path)
    if not source.is_file():
        raise FileNotFoundError(source)
    if not job_record.is_file():
        raise FileNotFoundError(job_record)
    with Image.open(source) as image:
        image.load()
        if image.size != (1024, 1024):
            raise ValueError(f"Unexpected image size for {source}: {image.size}")
        if image.format != "PNG":
            raise ValueError(f"Unexpected format for {source}: {image.format}")
        source_mode = image.mode
        has_alpha = source_mode in {"RGBA", "LA"} or "transparency" in image.info
    job = json.loads(job_record.read_text(encoding="utf-8"))
    params = job["actual_parameters"]
    expected_request = {
        "mode": "i2i",
        "width": 1024,
        "height": 1024,
        "num_images": 1,
        "num_reference_images": 1,
        "num_steps": 4,
        "guidance": 1,
        "prompt_upsampling": False,
    }
    actual_request = {key: params.get(key) for key in expected_request}
    if actual_request != expected_request:
        raise ValueError(f"Unexpected i2i request for {job_record}: {actual_request}")
    if params.get("seed") != frame["seed"] or job.get("job_id") != frame["job_id"]:
        raise ValueError(f"Seed or job id mismatch for {job_record}")
    return {
        "sha256": sha256(source),
        "size": [1024, 1024],
        "format": "PNG",
        "mode": source_mode,
        "hasAlpha": has_alpha,
        "jobRecord": relative(job_record),
        "request": {
            **actual_request,
            "prompt": params["prompt"],
            "seed": params["seed"],
        },
    }


def build_clean_sheet(records: list[dict[str, object]]) -> Path:
    output = OUTPUT_DIR / "nobita-six-frame-sheet.png"
    sheet = Image.new("RGB", (2048, 3072), "black")
    for index, record in enumerate(records):
        with Image.open(REPO_ROOT / str(record["output"])) as image:
            row, column = divmod(index, 2)
            sheet.paste(image.convert("RGB"), (column * 1024, row * 1024))
    sheet.save(output, format="PNG", optimize=True)
    return output


def build_review_sheet(records: list[dict[str, object]]) -> Path:
    output = OUTPUT_DIR / "nobita-six-frame-review-numbered.png"
    canvas = Image.new("RGB", (1640, 2510), "#15181c")
    draw = ImageDraw.Draw(canvas)
    title_font = font(48, bold=True)
    row_font = font(30, bold=True)
    label_font = font(27, bold=True)
    note_font = font(22)

    draw.text((60, 34), "NOBITA - 6 APPROVED WALK FRAMES", fill="#ffffff", font=title_font)
    draw.text(
        (60, 96),
        "Rows: DOWN / UP / LEFT    Columns: FRAME 01 / FRAME 02",
        fill="#aeb8c2",
        font=note_font,
    )

    thumb_size = 720
    left_positions = (80, 840)
    row_tops = (210, 980, 1750)
    for index, record in enumerate(records):
        row, column = divmod(index, 2)
        x = left_positions[column]
        y = row_tops[row]
        if column == 0:
            draw.text(
                (x, y - 46),
                str(record["direction"]).upper(),
                fill="#6ed6ff",
                font=row_font,
            )
        with Image.open(REPO_ROOT / str(record["output"])) as image:
            thumb = image.convert("RGB").resize((thumb_size, thumb_size), Image.Resampling.LANCZOS)
        canvas.paste(thumb, (x, y))
        draw.rectangle((x, y, x + thumb_size - 1, y + thumb_size - 1), outline="#515a64", width=2)
        label = (
            f"{str(record['direction']).upper()}-{record['frame']}"
            f"   source {record['sourceLabel']}"
        )
        draw.rounded_rectangle(
            (x + 14, y + 14, x + 405, y + 61),
            radius=9,
            fill="#111418",
            outline="#6ed6ff",
            width=2,
        )
        draw.text((x + 28, y + 22), label, fill="#ffffff", font=label_font)

    canvas.save(output, format="PNG", optimize=True)
    return output


def build_previews(records: list[dict[str, object]]) -> list[Path]:
    outputs: list[Path] = []
    for direction in ("down", "up", "left"):
        pair = [record for record in records if record["direction"] == direction]
        images: list[Image.Image] = []
        for record in pair:
            with Image.open(REPO_ROOT / str(record["output"])) as image:
                images.append(image.convert("RGB").copy())
        output = OUTPUT_DIR / f"nobita-{direction}-two-frame-preview.gif"
        images[0].save(
            output,
            save_all=True,
            append_images=images[1:],
            duration=350,
            loop=0,
            disposal=2,
        )
        outputs.append(output)
    return outputs


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, object]] = []

    for frame in FRAMES:
        validation = validate_source(frame)
        source = frame["source"]
        assert isinstance(source, Path)
        output = OUTPUT_DIR / f"nobita-{frame['direction']}-{frame['frame']}.png"
        shutil.copy2(source, output)
        copied_hash = sha256(output)
        if copied_hash != validation["sha256"]:
            raise ValueError(f"Copy hash mismatch for {output}")
        records.append(
            {
                "direction": frame["direction"],
                "frame": frame["frame"],
                "sourceLabel": frame["source_label"],
                "seed": frame["seed"],
                "jobId": frame["job_id"],
                "source": relative(source),
                "output": relative(output),
                **validation,
            }
        )

    clean_sheet = build_clean_sheet(records)
    review_sheet = build_review_sheet(records)
    previews = build_previews(records)

    manifest = {
        "runId": OUTPUT_DIR.name,
        "character": "nobita",
        "status": "accepted-six-frames",
        "acceptedBy": "user-visual-review",
        "directions": ["down", "up", "left"],
        "framesPerDirection": 2,
        "frameCount": len(records),
        "sheetLayout": {
            "rows": ["down", "up", "left"],
            "columns": ["frame-01", "frame-02"],
            "cellSize": [1024, 1024],
        },
        "frames": records,
        "artifacts": {
            "cleanSheet": relative(clean_sheet),
            "reviewSheet": relative(review_sheet),
            "previews": [relative(path) for path in previews],
        },
        "scope": {
            "runtimeAssetsModified": False,
            "roomV4Modified": False,
            "rightDirectionGenerated": False,
            "alphaProcessingApplied": False,
            "newImageGenerationPerformed": False,
        },
        "notes": [
            "DOWN uses the previously accepted A09 and B01 pair.",
            "UP uses the user-selected B01 and B04 pair; both came from the original frame-b candidate group.",
            "LEFT uses A14 plus the user-confirmed leg-and-arm reversed candidate R5-C01.",
            "The source images are retained byte-for-byte; the collection step performs no visual modification.",
        ],
    }
    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    verification = {
        "verifiedAt": datetime.now(timezone.utc).isoformat(),
        "status": "passed",
        "checks": {
            "allSixSourceFilesPresent": len(records) == 6,
            "allFramesAre1024SquarePng": all(record["size"] == [1024, 1024] for record in records),
            "copiedFilesMatchSourceHashes": all(
                sha256(REPO_ROOT / str(record["output"])) == record["sha256"] for record in records
            ),
            "allSourcesAreSingleImageI2ISelections": all(
                record["request"]["mode"] == "i2i"
                and record["request"]["num_reference_images"] == 1
                and record["request"]["num_images"] == 1
                and record["request"]["prompt_upsampling"] is False
                for record in records
            ),
            "selectionPairs": {
                "down": ["A09", "B01"],
                "up": ["B01", "B04"],
                "left": ["A14", "R5-C01"],
            },
            "cleanSheet": {
                "path": relative(clean_sheet),
                "size": list(Image.open(clean_sheet).size),
                "sha256": sha256(clean_sheet),
            },
            "reviewSheet": {
                "path": relative(review_sheet),
                "size": list(Image.open(review_sheet).size),
                "sha256": sha256(review_sheet),
            },
            "previews": [
                {
                    "path": relative(path),
                    "frameCount": getattr(Image.open(path), "n_frames", 1),
                    "sha256": sha256(path),
                }
                for path in previews
            ],
        },
    }
    (OUTPUT_DIR / "verification.json").write_text(
        json.dumps(verification, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(json.dumps({"outputDir": relative(OUTPUT_DIR), "status": "passed"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
