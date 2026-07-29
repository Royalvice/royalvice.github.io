# 大雄两帧交替步态候选审查

## 生成配置

- 角色：大雄（Nobita）
- 方向：`DOWN / UP / LEFT`
- 每个方向：2 帧
- 合计：6 张独立 PNG
- Flux 模式：`i2i`
- 每个任务只上传 1 张对应方向 canonical reference
- 不上传上一帧，不上传 OpenPose，不生成 sprite sheet
- 输出：`1024×1024 PNG RGBA`
- 透明化：本地 chroma-key removal，soft matte，despill

## 两帧动作规则

每个方向的两张图采用明确的交替步态：

- 第 1 帧：左臂在行走方向前方，右臂在后方；右腿前跨。
- 第 2 帧：右臂在行走方向前方，左臂在后方；左腿前跨。

## 实际视觉审查

已使用 `view_image` 逐张打开 6 张透明结果，并打开 DOWN、UP、LEFT 三组 contact sheet：

- DOWN：`2/2` 通过；正面身份、圆形黑框眼镜、左右摆臂和对侧腿交换清楚。
- UP：`2/2` 通过；真实背面、左右手臂交换清楚，没有正面五官、地面阴影或孤立杂点。
- LEFT：`2/2` 通过；严格左侧 profile，左右手臂和前后腿交换清楚，没有回转成三分之四。

最终选定文件位于：

```text
artifacts/profile-sprite-review/2026-07-20-nobita-walk-2frame-r1/selected/
```

本轮仍只产生候选素材，不替换生产 atlas，不修改 Canvas 状态机。
