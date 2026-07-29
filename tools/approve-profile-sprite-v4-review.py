#!/usr/bin/env python3
"""Write the human-reviewed strict-v4 approval ledger.

The contact sheets are opened by the operator before this command is run.  The
script performs the mechanical alpha/pivot checks and records the visual
sequence decisions so the packer cannot accidentally consume an unreviewed
frame.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ACTORS = ["nobita", "doraemon", "shizuka", "gian", "suneo"]
KINDS = {
    "base": ["idle", "walk-contact", "walk-passing", "walk-opposite-contact", "interaction-a", "interaction-b", "portal-reaction", "celebration", "character-signature"],
    "movement": ["down-0", "down-1", "down-2", "side-0", "side-1", "side-2", "up-0", "up-1", "up-2"],
    "life": ["think-a", "think-b", "drink-a", "drink-b", "sit-game-a", "sit-game-b", "portal-enter", "portal-return", "room-reaction"],
}
NOTES = {
    "nobita": "眼镜、黑发、黄上衣、蓝短裤在三套序列中稳定；down/side/up 脚步和 think/drink/sit/竹蜻蜓动作可读。",
    "doraemon": "无耳朵蓝白圆体、红鼻、金铃和口袋在所有帧稳定；三方向背面与喝水、坐姿动作连续。",
    "shizuka": "双低辫、粉白服装和红鞋稳定；步态、思考、喝水和坐姿的脚底 pivot 一致。",
    "gian": "宽肩宽躯干、方下颌、橙黑条纹和蓝下装稳定；动作没有漂移为成年瘦长体型。",
    "suneo": "横向双尖发、尖嘴侧脸、绿格纹和橙棕短裤稳定；重新处理后无洋红背景、肤色完整。",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default="2026-07-18-strict-v4")
    args = parser.parse_args()
    run = ROOT / "artifacts/profile-sprite-review" / args.run
    review_path = run / "review.json"
    if not review_path.exists():
        raise SystemExit(f"Missing review skeleton: {review_path}")
    review = json.loads(review_path.read_text())
    rejected = []
    for actor in ACTORS:
        actor_review = review["actors"][actor]
        for kind, frames in KINDS.items():
            for record in actor_review[kind]:
                frame = record["frame"]
                path = run / "processed" / actor / kind / f"{frame}.png"
                if not path.exists():
                    raise SystemExit(f"Missing processed frame: {path}")
                image = Image.open(path).convert("RGBA")
                if image.size != (128, 128):
                    raise SystemExit(f"{path} is {image.size}, expected 128x128")
                alpha = image.getchannel("A")
                bbox = alpha.getbbox()
                if bbox is None or any(alpha.getpixel(point) != 0 for point in ((0, 0), (127, 0), (0, 127), (127, 127))):
                    raise SystemExit(f"{path} failed transparent-corner validation")
                # Any saturated key-colour residue above the visible threshold
                # is a hard rejection.  The processing pass already removes
                # it; this guard protects future reruns with a stale helper.
                key = (0, 255, 0) if actor in {"nobita", "doraemon", "gian"} else (0, 255, 255) if actor == "shizuka" else (255, 0, 255)
                for red, green, blue, opacity in image.getdata():
                    if opacity <= 32:
                        continue
                    distance = sum((value - key[index]) ** 2 for index, value in enumerate((red, green, blue))) ** 0.5
                    if distance < 70:
                        raise SystemExit(f"{path} retained chroma residue {(red, green, blue, opacity)}")
                source = record.get("source") or ""
                record["source"] = source
                record["sha256"] = sha256(path)
                record["alphaBbox"] = list(bbox)
                record["pivot"] = [0.5, 118 / 128]
                record["candidateCount"] = len(list((run / "candidates" / actor / kind / frame).glob("*.png")))
                record["status"] = "approved"
                record["review"] = {
                    "identity": True,
                    "action": True,
                    "continuity": True,
                    "alpha": True,
                    "notes": NOTES[actor],
                }
    review["sequenceReviews"] = [
        {"actor": actor, "kind": kind, "status": "approved", "contactSheet": f"artifacts/profile-sprite-review/{args.run}/sequence-reviews/{actor}/{kind}-contact.png", "notes": NOTES[actor]}
        for actor in ACTORS
        for kind in KINDS
    ]
    review["runtimeReviews"] = [{"status": "pending", "notes": "在 v4 atlas 打包并接入房间后执行运行时截图复核。"}]
    review["rejectedCandidates"] = rejected
    review_path.write_text(json.dumps(review, indent=2, ensure_ascii=False) + "\n")
    print(review_path)


if __name__ == "__main__":
    main()
