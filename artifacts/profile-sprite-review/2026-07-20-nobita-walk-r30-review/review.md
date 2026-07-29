# Nobita walk i2i review — contact / passing

本轮使用约 150 字的 biomechanical prompt。每一帧是独立 Flux i2i job，每个 job 只上传一个对应方向的 canonical reference；没有上一帧输入、pose guide 或 sheet。

## Prompt 结构

1. 固定大雄脸型、眼镜、服装、2D pixel sprite 风格和脚底 pivot。
2. 使用动画术语 `contact pose` 与 `passing pose`。
3. 明确承重脚、摆动腿、膝盖方向、手臂反向摆动、肩胯微转和脚底接触线。
4. 使用 `anatomically correct`、完整全身和纯 `#00FF00 chroma-key` 背景。

Prompt 长度（按 JavaScript `.length`）：DOWN 164/166 字符，UP 163/162 字符，LEFT 165/166 字符。

## 视觉审查

| 方向 | 结论 |
| --- | --- |
| DOWN | 通过：两帧分别为 contact 与 passing，左/右承重脚、抬膝和手臂对摆可读；四肢轴线自然 |
| UP | 通过：背面中轴稳定，左右腿交替抬步，手臂反向摆动，脚底没有可见地面影子 |
| LEFT | 通过：保持纯侧面，两帧分别为左腿前摆和右膝抬起，身体没有回转成三分之四 |

所有 6 张图都实际用 `view_image` 查看，并制作了 1024px 浅灰背景 contact sheet 与 128px 目标尺寸 contact sheet：

- `../2026-07-20-nobita-walk-2frame-r30-contact-passing/review-light-full.png`
- `../2026-07-20-nobita-walk-2frame-r30-contact-passing/review-light-128.png`

所有选定图均为 `1024×1024 RGBA`，四角 alpha 为 0。绿幕使用本地 `remove_chroma_key.py` 去除，阈值为 64，保留像素轮廓并清除低透明度地面影子。

## 生产状态

本轮只生成 review 候选，未替换 `public/` atlas，未修改页面运行时引用。
