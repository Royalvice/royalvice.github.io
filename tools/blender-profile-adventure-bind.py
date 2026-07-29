"""Blender 5.1 compatibility entrypoint for the existing ARP bind audit.

The upstream review harness still validates and returns Blender 4.x's
``BLENDER_EEVEE_NEXT`` enum. Blender 5.1 renamed the same engine enum back to
``BLENDER_EEVEE``. Keep every bind, weight, semantic-chain and render audit
unchanged; adapt only that post-validation runtime enum.
"""

from pathlib import Path
import sys


PIPELINE = Path("/Users/vice/code/game/tools/asset_pipeline")
if str(PIPELINE) not in sys.path:
    sys.path.insert(0, str(PIPELINE))

import blender_motion_bind_review as bind_review


original_load_review_studio = bind_review.load_review_studio


def load_review_studio_blender_51(path: Path):
    studio = original_load_review_studio(path)
    if studio["render"]["engine"] == "BLENDER_EEVEE_NEXT":
        studio["render"]["engine"] = "BLENDER_EEVEE"
    return studio


bind_review.load_review_studio = load_review_studio_blender_51


if __name__ == "__main__":
    raise SystemExit(bind_review.main())
