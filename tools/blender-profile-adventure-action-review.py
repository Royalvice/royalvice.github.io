"""Blender 5.1 entrypoint for the existing ARP action-review harness."""

from pathlib import Path
import sys


PIPELINE = Path("/Users/vice/code/game/tools/asset_pipeline")
if str(PIPELINE) not in sys.path:
    sys.path.insert(0, str(PIPELINE))

import blender_motion_action_review as action_review


original_load_review_studio = action_review.load_review_studio


def load_review_studio_blender_51(path: Path):
    studio = original_load_review_studio(path)
    if studio["render"]["engine"] == "BLENDER_EEVEE_NEXT":
        studio["render"]["engine"] = "BLENDER_EEVEE"
    return studio


action_review.load_review_studio = load_review_studio_blender_51


if __name__ == "__main__":
    exit_code = action_review.main()
    if exit_code is not None:
        raise SystemExit(exit_code)
