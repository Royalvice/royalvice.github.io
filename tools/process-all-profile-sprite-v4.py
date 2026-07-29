#!/usr/bin/env python3
"""Process the independent strict-v4 Flux candidates into review frames.

Generation and visual approval stay separate: this helper only performs the
deterministic chroma-key/normalisation step.  It never marks a frame approved;
the review ledger is written only after the contact sheets have been opened.
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ACTORS = ["nobita", "doraemon", "shizuka", "gian", "suneo"]
KINDS = {
    "base": ["idle", "walk-contact", "walk-passing", "walk-opposite-contact", "interaction-a", "interaction-b", "portal-reaction", "celebration", "character-signature"],
    "movement": ["down-0", "down-1", "down-2", "side-0", "side-1", "side-2", "up-0", "up-1", "up-2"],
    "life": ["think-a", "think-b", "drink-a", "drink-b", "sit-game-a", "sit-game-b", "portal-enter", "portal-return", "room-reaction"],
}
KEYS = {"nobita": "#00FF00", "doraemon": "#00FF00", "shizuka": "#00FFFF", "gian": "#00FF00", "suneo": "#FF00FF"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default="2026-07-18-strict-v4")
    parser.add_argument("--actor")
    parser.add_argument("--kind")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    run = ROOT / "artifacts/profile-sprite-review" / args.run
    actors = [args.actor] if args.actor else ACTORS
    kinds = [args.kind] if args.kind else list(KINDS)
    for actor in actors:
        for kind in kinds:
            for frame in KINDS[kind]:
                candidates = sorted((run / "candidates" / actor / kind / frame).glob(f"{actor}-{kind}-{frame}-*.png"))
                if not candidates:
                    print(f"pending {actor}/{kind}/{frame}")
                    continue
                # Candidate 1 is the deterministic first draw.  If a later
                # candidate is selected during review, the ledger's source is
                # updated and this command can be rerun with an explicit copy.
                source = candidates[0]
                out = run / "processed" / actor / kind / f"{frame}.png"
                review = run / "enlarged-frames" / actor / kind / f"{frame}-8x.png"
                command = [
                    "python3",
                    str(ROOT / "tools/process-profile-sprite-v4.py"),
                    "--input",
                    str(source),
                    "--out",
                    str(out),
                    "--key",
                    KEYS[actor],
                    "--review",
                    str(review),
                ]
                if args.force:
                    command.append("--force")
                subprocess.run(command, check=True)


if __name__ == "__main__":
    main()
