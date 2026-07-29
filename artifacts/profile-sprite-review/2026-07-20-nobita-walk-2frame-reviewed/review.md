# 大雄 2 帧步态候选复审

本轮针对 DOWN 与 LEFT 两帧被生成成近似同一姿势的问题重新抽卡，并对每张透明化结果、原尺寸图和 176px 缩略 contact sheet 做了实际视觉检查。

## 选中的 review 候选

| 方向 | 第 1 帧 | 第 2 帧 | 视觉结论 |
| --- | --- | --- | --- |
| DOWN | `selected/down/nobita-walk-down-01.png` | `selected/down/nobita-walk-down-02.png` | 通过：前后脚位置左右反转，手臂由下垂切换到外摆，缩略尺寸仍能读出两帧差异 |
| LEFT | `selected/left/nobita-walk-left-01.png` | `selected/left/nobita-walk-left-02.png` | 通过：前伸手臂切换为收回弯臂，脚步保持左侧 profile，两个 silhouette 不再相同 |
| UP | `selected/up/nobita-walk-up-01.png` | `selected/up/nobita-walk-up-02.png` | 通过：背面左右手臂和腿部交替明显 |

## 实际查看材料

- `down-2frame-contact.png`
- `left-2frame-contact.png`
- `up-2frame-contact.png`
- `all-directions-thumbnail-contact.png`
- 六张 `selected/` 原尺寸透明 PNG

所有材料均使用 `view_image` 实际打开后才进入本目录。

## 生成与回退说明

- 每个 Flux job 的 `images` 字段只包含一张图。
- DOWN 第 2 帧使用单张镜像 pose guide 后重新 i2i，以保证前脚左右交换；没有把两帧同时上传给 Flux。
- LEFT 第 2 帧使用单张已检查的左侧 passing pose raw candidate 与单帧 lower-leg swap pose guide 后重新 i2i，以保留收臂姿势并让步幅落在相反侧；没有把相邻帧作为第二张输入。
- UP 使用 `2026-07-20-nobita-walk-2frame-r2-contrast` 中通过查看的两帧。
- 旧的相似候选仍保留在各自 run 目录中，未覆盖、未删除，也未进入生产 atlas。

## 文件校验

六张文件均为 `1024×1024 RGBA PNG`，四角 alpha 均为 `0`。SHA-256 记录见生成目录的 job JSON 与本轮 shell 校验输出。

本轮只完成 review 候选整理，没有替换 `public/` 或 Canvas 运行时资源。
