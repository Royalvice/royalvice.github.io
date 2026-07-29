# 大雄 4 帧步态候选审查

## 生成配置

- 角色：大雄（Nobita）
- 方向：`DOWN / UP / LEFT`
- 每个方向：4 帧，合计 12 张独立 PNG
- Flux 模式：`i2i`
- 每个任务的 `images` 数量：`1`
- 唯一输入：对应方向的正式 canonical reference
- 没有输入上一帧，没有输入 OpenPose，没有生成 sprite sheet
- 输出尺寸：`1024×1024 PNG`
- 透明化：本地 chroma-key removal，`#00FF00`、soft matte、despill

## 选定结果

实际使用 `view_image` 逐帧检查，并用三组 contact sheet 检查动作连续性：

- DOWN：`4/4` 通过；左脚接触、左脚经过、右脚接触、右脚经过的重心和摆臂可区分。
- UP：`4/4` 通过；保持真实背面，左右脚交替，最终第 4 帧来自单独重抽 `r2-retry-up-04-b`。
- LEFT：`4/4` 通过；保持严格左侧 profile，前后腿和双臂摆动有明显变化。

选定文件位于：

```text
artifacts/profile-sprite-review/2026-07-20-nobita-walk-4frame-r2-single-ref/selected/
```

## 打回记录

- `2026-07-20-nobita-walk-4frame-r1`：不采用。多个相邻帧差异过小；UP-03/04 还出现地面阴影。
- `2026-07-20-nobita-walk-4frame-r2-single-ref` 的初始 UP-04：不采用，头发右侧有孤立白色像素。
- `2026-07-20-nobita-walk-4frame-r2-retry-up-04`：不采用，重新生成了明显地面阴影。
- `2026-07-20-nobita-walk-4frame-r2-retry-up-04-b`：通过，脚底区域干净，替换初始 UP-04。

这些失败候选保留在各自的审查目录中，不进入 `selected/`，也不进入生产 atlas。

## 运行时边界

本轮只完成方向步态候选和视觉审查，不替换现有生产 sprite，不修改 Canvas 状态机，不生成 atlas。
