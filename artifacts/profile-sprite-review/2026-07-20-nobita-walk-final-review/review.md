# Nobita 2-frame directional i2i review

生成方式：每个方向每帧一个独立 Flux i2i job；每个 job 只上传该方向的一张 canonical reference。没有上传上一帧、pose guide 或 sprite sheet。

## 选定候选

| 方向 | 帧 | 来源 run | 视觉结论 |
| --- | --- | --- | --- |
| DOWN | 01 | `r20-minimal-green` | 通过：正面、左臂前摆、右腿前跨，人物身份和眼镜稳定 |
| DOWN | 02 | `r20-minimal-green` | 通过：右臂前摆、左腿前跨，与 DOWN-01 形成清楚反向 silhouette |
| UP | 01 | `r25-up-arm-clean` | 通过：真实背面，右腿抬步，脚下无可见地面影子 |
| UP | 02 | `r26-up-arm-swap` | 通过：真实背面，左臂抬高、右臂后摆，另一条腿抬步 |
| LEFT | 01 | `r20-minimal-green` | 通过：纯左侧面，前臂前伸、后臂后摆，右腿前跨 |
| LEFT | 02 | `r23-left-fix` | 通过：纯左侧面，前臂收胸、后臂后伸，左腿前跨，动作与 LEFT-01 可区分 |

## 处理与验证

- 生成原图全部为 `1024×1024` PNG。
- 使用 `remove_chroma_key.py` 去除绿幕；最终候选为 `RGBA`，四角 alpha 均为 `0`。
- UP 帧使用 `transparent-threshold=64` 去除 Flux 偶发的低透明度地面影子；不改变角色主体颜色和轮廓。
- 6 张最终候选均实际 `view_image` 检查，并另行缩放到 `128×128` 进行运行时尺寸审查。
- 最终选定 contact sheet：`../2026-07-20-nobita-walk-reviewed-final-contact-v3.png`。
- 128px contact sheet：`../2026-07-20-nobita-walk-reviewed-final-128px-v3.png`。

## 生产状态

这些文件目前只放在 review 目录，尚未替换 `public/` 生产 atlas，也没有修改页面运行时引用。

## SHA-256

- DOWN-01 `b22b5dd0ecedd37d31086f47b9a2d46fc06c0821a4572eb2d955350e7d6bf83d`
- DOWN-02 `eed80dead5b954515a9d0cf23adf05685249f24f0ac35a4b00bc1e92e1ea1430`
- UP-01 `d2c04d319eb188282e94d0a34335d56f1ceb0dc2ee94883d7e7f9421e670068d`
- UP-02 `47e01d14bebfcbe9faa70918b36a57fbd5e7e77c66868dbce5c891dac29efebf`
- LEFT-01 `ea665d1e774dff6e812dddeba41509487fbad12e99c6283d7f45a005b9c657e3`
- LEFT-02 `e21c809bbe4ade3686ded5f8a20da73e30672db764157606441076573e3d096c`
