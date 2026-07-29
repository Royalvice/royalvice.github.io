#!/usr/bin/env python3
"""Create identity-free two-pose diagrams for Flux multi-reference experiments."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = (
    ROOT
    / "artifacts"
    / "profile-sprite-review"
    / "nobita-walk-pose-guides-r1"
)
SIZE = (1024, 576)
BACKGROUND = (8, 10, 14, 255)
JOINT = (255, 245, 225, 255)
TORSO = (80, 190, 255, 255)
LEFT_LIMB = (255, 92, 92, 255)
RIGHT_LIMB = (96, 235, 145, 255)
LINE_WIDTH = 12
JOINT_RADIUS = 9


def line(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], color: tuple[int, int, int, int]) -> None:
    draw.line(points, fill=color, width=LINE_WIDTH, joint="curve")
    for x, y in points:
        draw.ellipse(
            (x - JOINT_RADIUS, y - JOINT_RADIUS, x + JOINT_RADIUS, y + JOINT_RADIUS),
            fill=JOINT,
        )


def draw_front_or_back_pose(
    draw: ImageDraw.ImageDraw,
    center_x: int,
    mirrored: bool,
) -> None:
    head = (center_x, 135)
    neck = (center_x, 205)
    pelvis = (center_x, 360)
    left_shoulder = (center_x - 58, 225)
    right_shoulder = (center_x + 58, 225)
    left_hip = (center_x - 30, 360)
    right_hip = (center_x + 30, 360)

    draw.ellipse((head[0] - 52, head[1] - 52, head[0] + 52, head[1] + 52), outline=JOINT, width=LINE_WIDTH)
    line(draw, [neck, pelvis], TORSO)
    line(draw, [left_shoulder, right_shoulder], TORSO)
    line(draw, [left_hip, right_hip], TORSO)

    if not mirrored:
        left_hand = (center_x - 92, 330)
        right_hand = (center_x + 86, 285)
        left_knee = (center_x - 62, 435)
        left_foot = (center_x - 92, 520)
        right_knee = (center_x + 48, 420)
        right_foot = (center_x + 66, 485)
    else:
        left_hand = (center_x - 86, 285)
        right_hand = (center_x + 92, 330)
        left_knee = (center_x - 48, 420)
        left_foot = (center_x - 66, 485)
        right_knee = (center_x + 62, 435)
        right_foot = (center_x + 92, 520)

    line(draw, [left_shoulder, (center_x - 76, 270), left_hand], LEFT_LIMB)
    line(draw, [right_shoulder, (center_x + 76, 270), right_hand], RIGHT_LIMB)
    line(draw, [left_hip, left_knee, left_foot], LEFT_LIMB)
    line(draw, [right_hip, right_knee, right_foot], RIGHT_LIMB)


def draw_side_pose(draw: ImageDraw.ImageDraw, center_x: int, passing: bool) -> None:
    head = (center_x, 135)
    neck = (center_x, 205)
    pelvis = (center_x, 360)
    shoulder = (center_x, 225)
    hip = (center_x, 360)

    draw.ellipse((head[0] - 52, head[1] - 52, head[0] + 52, head[1] + 52), outline=JOINT, width=LINE_WIDTH)
    line(draw, [neck, pelvis], TORSO)

    if not passing:
        line(draw, [shoulder, (center_x - 42, 275), (center_x - 82, 322)], RIGHT_LIMB)
        line(draw, [shoulder, (center_x + 38, 275), (center_x + 76, 330)], LEFT_LIMB)
        line(draw, [hip, (center_x - 45, 430), (center_x - 96, 512)], LEFT_LIMB)
        line(draw, [hip, (center_x + 42, 425), (center_x + 78, 492)], RIGHT_LIMB)
    else:
        line(draw, [shoulder, (center_x - 12, 280), (center_x - 18, 340)], LEFT_LIMB)
        line(draw, [shoulder, (center_x + 12, 280), (center_x + 18, 340)], RIGHT_LIMB)
        line(draw, [hip, (center_x - 12, 430), (center_x - 18, 510)], LEFT_LIMB)
        line(draw, [hip, (center_x + 18, 425), (center_x + 28, 500)], RIGHT_LIMB)


def save_guide(direction: str) -> None:
    image = Image.new("RGBA", SIZE, BACKGROUND)
    draw = ImageDraw.Draw(image)
    if direction in {"down", "up"}:
        draw_front_or_back_pose(draw, 256, mirrored=False)
        draw_front_or_back_pose(draw, 768, mirrored=True)
    else:
        draw_side_pose(draw, 256, passing=False)
        draw_side_pose(draw, 768, passing=True)
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT_ROOT / f"nobita-walk-{direction}-pose-guide.png")


def main() -> None:
    for direction in ("down", "up", "left"):
        save_guide(direction)


if __name__ == "__main__":
    main()
