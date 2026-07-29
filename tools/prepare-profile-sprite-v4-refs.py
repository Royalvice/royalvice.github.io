#!/usr/bin/env python3
"""Prepare private identity/style references for the strict sprite run."""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "artifacts/profile-sprite-review/2026-07-18-strict-v4"
SOURCE = ROOT / "artifacts/profile-sprite-review/2026-07-17-topdown-r1/sources"
STYLE = ROOT / "artifacts/profile-room-v3-review/2026-07-17-living-r1/enlarged-frames"

# Card interiors omit the title, logo and bottom copy while retaining the
# character's face, hair, clothing and body silhouette. These crops are
# private generation references and are never copied to public assets.
CROPS = {
    # Keep the character identity while deliberately excluding the card's
    # header/logo and the magenta title ribbon.  These are private i2i
    # references, not production art, so a slightly tighter crop is safer
    # than leaking printed marks into the generated frames.
    "nobita": (70, 92, 402, 472),
    "doraemon": (48, 112, 302, 472),
    "shizuka": (152, 28, 372, 472),
    "gian": (52, 112, 282, 424),
    "suneo": (78, 70, 356, 410),
}


def main() -> None:
    for sub in ("official", "identity-crops", "current-best-style"):
        (RUN / "sources" / sub).mkdir(parents=True, exist_ok=True)
    for actor, box in CROPS.items():
        source = SOURCE / f"{actor}-official.png"
        if source.exists():
            image = Image.open(source).convert("RGB")
            image.crop(box).save(RUN / "sources" / "identity-crops" / f"{actor}-identity.png")
            shutil.copy2(source, RUN / "sources" / "official" / source.name)
        style = STYLE / f"{actor}-movement-01-down-0.png"
        if style.exists():
            shutil.copy2(style, RUN / "sources" / "current-best-style" / f"{actor}-style.png")
    print(RUN / "sources")


if __name__ == "__main__":
    main()
