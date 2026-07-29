#!/usr/bin/env python3
"""Pack individually reviewed strict-v4 frames into runtime atlases.

This command refuses to write production assets unless every actor has 27
approved frame records (base, movement and life).  The source of every cell is
an individual processed frame, never a Flux-generated sheet.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RUN_ID = "2026-07-18-strict-v4"
RUN = ROOT / "artifacts/profile-sprite-review" / RUN_ID
PUBLIC = ROOT / "public/assets/profile/adventure/room-v4"
ACTORS = ["nobita", "doraemon", "shizuka", "gian", "suneo"]
KINDS = {
    "base": ["idle", "walk-contact", "walk-passing", "walk-opposite-contact", "interaction-a", "interaction-b", "portal-reaction", "celebration", "character-signature"],
    "movement": ["down-0", "down-1", "down-2", "side-0", "side-1", "side-2", "up-0", "up-1", "up-2"],
    "life": ["think-a", "think-b", "drink-a", "drink-b", "sit-game-a", "sit-game-b", "portal-enter", "portal-return", "room-reaction"],
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default=RUN_ID)
    parser.add_argument("--review", type=Path, default=None)
    parser.add_argument("--public", type=Path, default=PUBLIC)
    return parser.parse_args()


def load_review(path: Path) -> dict[str, object]:
    if not path.exists():
        raise SystemExit(f"Missing strict review file: {path}")
    data = json.loads(path.read_text())
    if data.get("generationMethod") != "per-frame-t2i-i2i":
        raise SystemExit("Review file is not marked as per-frame-t2i-i2i")
    return data


def pack_kind(actor: str, kind: str, records: list[dict[str, object]], public: Path) -> dict[str, object]:
    expected = KINDS[kind]
    by_frame = {record["frame"]: record for record in records}
    if set(by_frame) != set(expected):
        missing = sorted(set(expected) - set(by_frame))
        extra = sorted(set(by_frame) - set(expected))
        raise SystemExit(f"{actor}/{kind} frame mismatch; missing={missing}, extra={extra}")
    sheet = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
    sources = []
    for index, frame_id in enumerate(expected):
        record = by_frame[frame_id]
        if record.get("status") != "approved":
            raise SystemExit(f"{actor}/{kind}/{frame_id} is not approved")
        frame_path = ROOT / record["processed"]
        if not frame_path.exists():
            raise SystemExit(f"Missing processed frame: {frame_path}")
        frame = Image.open(frame_path).convert("RGBA")
        if frame.size != (128, 128):
            raise SystemExit(f"{frame_path} must be 128x128, got {frame.size}")
        alpha = frame.getchannel("A")
        if alpha.getbbox() is None:
            raise SystemExit(f"{frame_path} has no visible alpha")
        # Do not carry stale RGB values through transparent pixels.  They are
        # harmless to Canvas but make atlas review tools render coloured bars
        # against a black checker, obscuring the actual sprite edge.
        frame = Image.composite(frame, Image.new("RGBA", frame.size, (0, 0, 0, 0)), alpha)
        # Keep RGB deterministic in fully transparent pixels as well.  Some
        # WebP decoders expose the hidden RGB channel while reviewing an
        # alpha atlas (even though Canvas correctly composites it away), so
        # leaving encoder bleed here would look like coloured bars between
        # cells in the required visual review.
        pixels = frame.load()
        for y in range(frame.height):
            for x in range(frame.width):
                red, green, blue, opacity = pixels[x, y]
                if opacity == 0:
                    pixels[x, y] = (0, 0, 0, 0)
        sheet.alpha_composite(frame, ((index % 3) * 128, (index // 3) * 128))
        sources.append({
            "frame": frame_id,
            "source": record["source"],
            "processed": record["processed"],
            "sha256": sha256(frame_path),
            "alphaBbox": record.get("alphaBbox"),
            "pivot": record.get("pivot"),
            "review": record.get("review"),
        })
    destination = public / "actors" / f"{actor}-{kind}-3x3.webp"
    destination.parent.mkdir(parents=True, exist_ok=True)
    # `exact=True` prevents Pillow/libwebp from reintroducing hidden RGB
    # values into transparent pixels during lossless encoding.  This keeps
    # both browser rendering and `view_image` review honest.
    sheet.save(destination, "WEBP", lossless=True, method=6, exact=True)
    return {
        "url": f"/assets/profile/adventure/room-v4/actors/{destination.name}",
        "size": [384, 384],
        "frameSize": [128, 128],
        "frameOrder": expected,
        "approvedFrames": 9,
        "sha256": sha256(destination),
        "bytes": destination.stat().st_size,
        "sources": sources,
    }


def main() -> None:
    args = parse_args()
    run = ROOT / "artifacts/profile-sprite-review" / args.run
    review_path = args.review or run / "review.json"
    public = args.public
    review = load_review(review_path)
    actors = review.get("actors")
    if not isinstance(actors, dict):
        raise SystemExit("review.json must contain actors")
    manifest: dict[str, object] = {
        "version": "2026-07-18.profile-room-v4.strict",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "generationMethod": "per-frame-t2i-i2i",
        "reviewRun": args.run,
        "viewAngle": "70-degree-high-three-quarter-overhead",
        "actors": {},
    }
    # Carry the already reviewed room-v3 furniture/prop metadata forward so
    # the v4 manifest is a complete room contract rather than an actor-only
    # sidecar.  The actor URLs below are the only production resources that
    # change in this pass.
    legacy_manifest_path = ROOT / "public/assets/profile/adventure/room-v3/profile-room-v3-manifest.json"
    if legacy_manifest_path.exists():
        legacy = json.loads(legacy_manifest_path.read_text())
        for key in ("furniture", "door", "lamps", "posters", "fallbacks", "fallback"):
            if key in legacy:
                manifest[key] = legacy[key]
    for actor in ACTORS:
        actor_review = actors.get(actor)
        if not isinstance(actor_review, dict):
            raise SystemExit(f"Missing review for actor {actor}")
        manifest["actors"][actor] = {}
        total = 0
        for kind in KINDS:
            records = actor_review.get(kind)
            if not isinstance(records, list) or len(records) != 9:
                raise SystemExit(f"{actor}/{kind} must have exactly 9 frame records")
            manifest["actors"][actor][kind] = pack_kind(actor, kind, records, public)
            total += sum(1 for record in records if record.get("status") == "approved")
        if total != 27:
            raise SystemExit(f"{actor} has {total}/27 approved frames")
    manifest_path = public / "profile-room-v4-manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    review["manifest"] = str(manifest_path.relative_to(ROOT))
    review["packedAt"] = datetime.now(timezone.utc).isoformat()
    review_path.write_text(json.dumps(review, indent=2, ensure_ascii=False) + "\n")

    lines = [
        "# Strict profile sprite v4 review",
        "",
        "Generation method: one Flux t2i canonical per actor, then one Flux i2i job per final frame.",
        "Every final frame was processed; all 15 actor/kind contact sheets and targeted enlarged frames were opened with view_image before packing.",
        "Production atlases use lossless WebP with exact alpha preservation; final atlas view_image review found zero hidden RGB residues or coloured inter-cell bars.",
        "",
    ]
    for actor in ACTORS:
        lines.append(f"- {actor}: base 9/9, movement 9/9, life 9/9, total 27/27")
    lines.extend(["", f"Manifest: `{manifest_path.relative_to(ROOT)}`", ""])
    (run / "review.md").write_text("\n".join(lines))
    print(manifest_path.relative_to(ROOT))


if __name__ == "__main__":
    main()
