#!/usr/bin/env python3
"""Create a strict-v4 review ledger after frame candidates are processed."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ACTORS = ["nobita", "doraemon", "shizuka", "gian", "suneo"]
KINDS = {
    "base": ["idle", "walk-contact", "walk-passing", "walk-opposite-contact", "interaction-a", "interaction-b", "portal-reaction", "celebration", "character-signature"],
    "movement": ["down-0", "down-1", "down-2", "side-0", "side-1", "side-2", "up-0", "up-1", "up-2"],
    "life": ["think-a", "think-b", "drink-a", "drink-b", "sit-game-a", "sit-game-b", "portal-enter", "portal-return", "room-reaction"],
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default="2026-07-18-strict-v4")
    args = parser.parse_args()
    run = ROOT / "artifacts/profile-sprite-review" / args.run
    actors: dict[str, object] = {}
    for actor in ACTORS:
        actors[actor] = {}
        for kind, frames in KINDS.items():
            records = []
            for frame in frames:
                processed = run / "processed" / actor / kind / f"{frame}.png"
                review_image = run / "enlarged-frames" / actor / kind / f"{frame}-8x.png"
                metadata = processed.with_suffix(".json")
                info = json.loads(metadata.read_text()) if metadata.exists() else {}
                candidates = sorted((run / "candidates" / actor / kind / frame).glob(f"{actor}-{kind}-{frame}-*.png"))
                records.append({
                    "frame": frame,
                    "source": str(candidates[0].relative_to(ROOT)) if candidates else "",
                    "processed": str(processed.relative_to(ROOT)),
                    "reviewImage": str(review_image.relative_to(ROOT)),
                    "alphaBbox": info.get("alphaBbox"),
                    "pivot": info.get("pivot"),
                    "status": "pending",
                    "review": {"identity": False, "action": False, "continuity": False, "alpha": False, "notes": ""},
                })
            actors[actor][kind] = records
    review = {
        "version": "2026-07-18.profile-room-v4.strict-review",
        "generationMethod": "per-frame-t2i-i2i",
        "run": args.run,
        "viewAngle": "70-degree-high-three-quarter-overhead",
        "actors": actors,
        "sequenceReviews": [],
        "runtimeReviews": [],
    }
    run.mkdir(parents=True, exist_ok=True)
    (run / "review.json").write_text(json.dumps(review, indent=2, ensure_ascii=False) + "\n")
    print(run / "review.json")


if __name__ == "__main__":
    main()
