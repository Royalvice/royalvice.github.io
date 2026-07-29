# 大雄 1×2 走路精灵：Prompt 与普通 i2i 姿势控制复核

## 最终结论

当前 Flux 服务不能只依靠 prompt 或普通多图 i2i reference，稳定生成同一大雄的两张指定交替步态。没有任何候选被批准进入生产资源。

服务实际模型与固定参数：

```text
black-forest-labs/FLUX.2-klein-9B
num_steps = 4（固定）
guidance = 1（固定）
prompt_upsampling = false（固定）
```

`/v1/spec.json` 只声明普通 `t2i / i2i` 与最多四张 reference image，没有 OpenPose、ControlNet、mask、denoise strength 或 reference role 权重。

## 实际 view_image 发现的问题

- DOWN：大量候选的两格始终是同一只前脚；偶尔第二格退回 idle，或整个人转为三分之四侧面。
- UP：能偶尔生成相反鞋位，但双臂变成平举或踢腿姿势，无法同时满足自然慢走与正背面锁定。
- LEFT：两格几乎总是同一剪影；模型有时通过翻转整个人朝向来“制造差异”，导致一格朝右、一格朝左。
- 即使输入正确的相反步态人偶图，普通 i2i 仍会在加入大雄 canonical 后丢失前脚换边关系。

## 已测试策略

| Run | 策略 | 结果 |
| --- | --- | --- |
| r40 | 长 prompt，两个相反 contact pose | DOWN 第二格退回 idle；UP/LEFT 未换脚 |
| r41 | 短 prompt，Pose A/B | DOWN 腿位不明确；UP 一格 idle；LEFT 朝向互相相反 |
| r42 | 角色自身左/右脚命名 | DOWN/LEFT 同一前脚；UP 漂为三分之四背面 |
| r43 | 单帧 canonical 复制成 1×2 输入 | UP 腿位部分换边；DOWN/LEFT 同一前脚 |
| r44 | 更换 seed | 两格动作继续复制 |
| r45 | 把 Pose A/B 明确绑定到画布左右 | DOWN 右格转身；LEFT 同一剪影 |
| r46 | 正背面使用 horizontal mirror；侧面用 passing pose | DOWN 右格转三分之四；LEFT 忽略 passing pose |
| r47 | canonical 第一、彩色骨架第二 | DOWN 两格同一前脚 |
| r48 | 彩色骨架第一、canonical 第二 | 两格有差异，但仍未正确换脚 |
| r49 | 无 reference 的 t2i 无身份人偶动作源 | **成功生成正确的镜像交替步态** |
| r50 | r49 动作源第一、canonical 第二 | 身份稳定，但两格重新变成同一前脚 |
| r51 | canonical 第一、r49 动作源第二 | 身份稳定，但两格仍是同一前脚 |

## 关键证据

```text
r47 DOWN  flux2-f970123622f248dd
r48 DOWN  flux2-c484cdc072f44b0b
r49 DOWN  flux2-866cf7ce54874ada
r50 DOWN  flux2-eb854e6666d046da
r51 DOWN  flux2-8d6a33fb4a9745cf
```

r49 证明 prompt 可以生成正确的无身份步态；r50 与 r51 证明当前普通 multi-reference i2i 无法同时保留该步态和 canonical 身份。这不是继续增加负面词或更换左右脚表述可以解决的问题。

## 可行后续路线

1. 使用真正支持 OpenPose/ControlNet 的图像端点，canonical 管身份、pose condition 管关节。
2. 对 approved canonical 做确定性的 2D cutout rig，把头、躯干、上臂、前臂、大腿、小腿和鞋按关节旋转，直接渲染准确的 A/B 帧。
3. Flux 只用于最终局部边缘修整，不再负责决定四肢位置。

在其中一条姿势控制路线落地前，禁止把本轮任何 DOWN/UP/LEFT 候选写入 `public` 或角色 atlas。
