# 大雄 1×2 走路精灵 Strip Review

> **已废弃（2026-07-21）**：后续逐帧复核确认，本报告所列 r35/r36/r38 组合并没有形成正确的左右换脚步态。它们仅满足方向和身份基本稳定，不能作为动画帧进入生产。新的结论见 `../2026-07-21-nobita-walk-pose-control-review/review.md`。

本轮使用 Flux i2i，每个方向独立提交一个任务，输入只有对应方向的 canonical reference。输出尺寸为 `1024×576`，每个方向在一张横向画布中放置两个相邻动作，未进入 `public` 生产目录。

## 通过组合

| 方向 | 采用候选 | Flux job | 视觉结果 |
| --- | --- | --- | --- |
| DOWN | r38 | `flux2-748f1c23601643ed` | 两格均为正面；左格 contact、右格 passing；中央为连续绿幕，无分隔线 |
| UP | r36 | `flux2-00f5682f9cb44c0b` | 两格均为背面；左格 contact、右格抬膝 passing；后脑、衣背和鞋色保持一致 |
| LEFT | r35 | `flux2-ba3530d4126740da` | 两格均为严格左侧面；摆臂和腿位有可读变化；右走可由镜像得到 |

## 实际检查

- 已使用 `view_image` 打开三张原始绿幕 strip。
- 已使用 `remove_chroma_key.py` 做 `--soft-matte --despill --edge-contract 1` 透明化。
- 已使用 `view_image` 打开三张透明 strip。
- 每个 strip 已拆成两个 `512×576` 单格。
- 每个单格已 nearest-neighbor 缩到 `128×144`，并在中性灰背景 contact sheet 上复核。
- 三张透明 strip 四角 alpha 均为透明，尺寸均为 `1024×576`。
- 运行时尺寸下，DOWN/UP/LEFT 的两个动作仍能分辨；人物身份、服装、眼镜、发型和方向没有跳变。

## 文件

```text
source/nobita-walk-down-1x2-r38.png
source/nobita-walk-up-1x2-r36.png
source/nobita-walk-left-1x2-r35.png
processed/down/nobita-walk-down-1x2-alpha.png
processed/up/nobita-walk-up-1x2-alpha.png
processed/left/nobita-walk-left-1x2-alpha.png
down-runtime-128-contact.png
up-runtime-128-contact.png
left-runtime-128-contact.png
```

## SHA-256

```text
fda34039d646db47bbc97865dea496c56b548d8df5090aa290e0abf9bc02464a  source/nobita-walk-down-1x2-r38.png
407d7c97ae3f7cdfb6c903f71908d8042a8a0e0c25ef1c92239cd167021be54d  source/nobita-walk-up-1x2-r36.png
d5322ca5ca19237eba9247623c321ccbd0d9bd73e3898773ca67c7e9b095b055  source/nobita-walk-left-1x2-r35.png
cc66d7ecd86ab5739513fd3b5889b546d7e75903e4119ec009683c639884ac2c  processed/down/nobita-walk-down-1x2-alpha.png
ffbd1422a821b573c3515e88759d86c004556e687a21dbf8e091258751085e7d  processed/up/nobita-walk-up-1x2-alpha.png
1cf025b0a07d6ffdf51356b877ca6e946e0a3a65316eee3b897b712376c471b8  processed/left/nobita-walk-left-1x2-alpha.png
```

## 未采用候选

- r31：DOWN 右格漂成三分之四视角，UP 腿部不自然，LEFT 动作差异不足。
- r33：DOWN 两格正面稳定，但动作变化太小。
- r34：DOWN 右格漂成三分之四视角；UP/LEFT 仅作为比较材料。
- r35 DOWN：右格漂成三分之四视角。
- r35 UP：出现中央黑线和鞋色异常。
- r36 DOWN：两格方向正确，但中央黑线明显、左格脚部重叠。
- r37 DOWN：中央白色分隔线明显，未采用。
- r39 全方向：DOWN 右格嘴型漂移；UP 左格鞋底出现异常深色块；LEFT 右格脚下生成地面线，均未采用。
