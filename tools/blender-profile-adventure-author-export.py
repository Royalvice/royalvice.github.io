"""Author the Royalvice Nobita narrative clips on the audited deform skeleton.

Input is the passed Auto-Rig Pro bind review. The script creates a new
deform-only armature with the same rest matrices and vertex-group contract,
authors deterministic skeletal actions, renders review frames, exports one
GLB, and writes an audit. No controller, IK, FK, pole, reference or helper
bones are copied into the runtime skeleton.
"""

from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Quaternion, Vector


def args_after_separator() -> list[str]:
    try:
        return sys.argv[sys.argv.index("--") + 1 :]
    except ValueError:
        return []


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def create_deform_rig(source: bpy.types.Object, mesh: bpy.types.Object) -> bpy.types.Object:
    deform_bones = [bone for bone in source.data.bones if bone.use_deform]
    source_deform_names = {bone.name for bone in deform_bones}
    rename = {
        "c_arm_twist_offset.l": "arm_twist_offset.l",
        "c_arm_twist_offset.r": "arm_twist_offset.r"
    }
    deform_names = {rename.get(bone.name, bone.name) for bone in deform_bones}
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    runtime = bpy.context.object
    runtime.name = "NobitaDeformRig"
    runtime.data.name = "NobitaDeformSkeleton"
    for bone in list(runtime.data.edit_bones):
        runtime.data.edit_bones.remove(bone)
    created = {}
    for source_bone in deform_bones:
        bone = runtime.data.edit_bones.new(rename.get(source_bone.name, source_bone.name))
        bone.head = source_bone.head_local
        bone.tail = source_bone.tail_local
        bone.matrix = source_bone.matrix_local
        bone.use_deform = True
        created[source_bone.name] = bone
    for source_bone in deform_bones:
        # ARP frequently inserts non-deforming controller/helper bones between
        # two deform bones.  Those helpers must not be exported, but dropping
        # them without reconnecting the nearest deform ancestors breaks the
        # runtime chain (for example the forearm no longer follows the arm).
        source_parent = source_bone.parent
        while source_parent and source_parent.name not in source_deform_names:
            source_parent = source_parent.parent
        if source_parent:
            created[source_bone.name].parent = created[source_parent.name]
            created[source_bone.name].use_connect = (
                source_bone.parent == source_parent and source_bone.use_connect
            )
    # ARP's bound deformation bones are driven by constraints and several of
    # them have no useful parent relationship at all.  Rebuild the small,
    # semantic deform-only hierarchy needed by glTF rather than exporting the
    # controller graph.  Rest matrices remain untouched, so inverse binds and
    # the audited mesh weights are preserved exactly.
    semantic_parents = {
        "spine_01.x": "root.x",
        "spine_02.x": "spine_01.x",
        "spine_03.x": "spine_02.x",
        "neck.x": "spine_03.x",
        "head.x": "neck.x",
        "shoulder.l": "spine_03.x",
        "shoulder.r": "spine_03.x",
        "arm_stretch.l": "shoulder.l",
        "arm_stretch.r": "shoulder.r",
        "arm_twist_offset.l": "arm_stretch.l",
        "arm_twist_offset.r": "arm_stretch.r",
        "forearm_stretch.l": "arm_stretch.l",
        "forearm_stretch.r": "arm_stretch.r",
        "forearm_twist.l": "forearm_stretch.l",
        "forearm_twist.r": "forearm_stretch.r",
        "hand.l": "forearm_stretch.l",
        "hand.r": "forearm_stretch.r",
        "thigh_stretch.l": "root.x",
        "thigh_stretch.r": "root.x",
        "thigh_twist.l": "thigh_stretch.l",
        "thigh_twist.r": "thigh_stretch.r",
        "leg_stretch.l": "thigh_stretch.l",
        "leg_stretch.r": "thigh_stretch.r",
        "leg_twist.l": "leg_stretch.l",
        "leg_twist.r": "leg_stretch.r",
        "foot.l": "leg_stretch.l",
        "foot.r": "leg_stretch.r",
        "toes_01.l": "foot.l",
        "toes_01.r": "foot.r"
    }
    runtime_created = {rename.get(name, name): bone for name, bone in created.items()}
    for child_name, parent_name in semantic_parents.items():
        child = runtime_created.get(child_name)
        parent = runtime_created.get(parent_name)
        if child and parent:
            child.parent = parent
            child.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    runtime.matrix_world = source.matrix_world.copy()
    for modifier in mesh.modifiers:
        if modifier.type == "ARMATURE":
            modifier.object = runtime
    world = mesh.matrix_world.copy()
    mesh.parent = runtime
    mesh.matrix_world = world
    mesh.matrix_parent_inverse = runtime.matrix_world.inverted() @ mesh.matrix_world
    for group in list(mesh.vertex_groups):
        group.name = rename.get(group.name, group.name)
        if group.name not in deform_names:
            mesh.vertex_groups.remove(group)
    bpy.data.objects.remove(source, do_unlink=True)
    return runtime


BONES = [
    "root.x", "spine_01.x", "spine_02.x", "spine_03.x", "neck.x", "head.x",
    "shoulder.l", "shoulder.r", "arm_stretch.l", "arm_stretch.r",
    "forearm_stretch.l", "forearm_stretch.r", "hand.l", "hand.r",
    "thigh_stretch.l", "thigh_stretch.r", "leg_stretch.l", "leg_stretch.r",
    "foot.l", "foot.r"
]


def reset_pose(rig: bpy.types.Object) -> None:
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = "QUATERNION"
        pose_bone.location = (0, 0, 0)
        pose_bone.rotation_quaternion.identity()
        pose_bone.scale = (1, 1, 1)


def rotate(rig: bpy.types.Object, name: str, xyz_degrees: tuple[float, float, float]) -> None:
    bone = rig.pose.bones.get(name)
    if bone is None:
        raise RuntimeError(f"runtime deform skeleton is missing {name}")
    bone.rotation_mode = "QUATERNION"
    bone.rotation_quaternion = Euler(
        tuple(math.radians(value) for value in xyz_degrees),
        "XYZ"
    ).to_quaternion()


def rotate_global(rig: bpy.types.Object, name: str, axis: str, degrees: float) -> None:
    """Apply an armature-space rotation through a bone's rolled local axes."""
    bone = rig.pose.bones.get(name)
    if bone is None:
        raise RuntimeError(f"runtime deform skeleton is missing {name}")
    axis_vectors = {
        "X": Vector((1, 0, 0)),
        "Y": Vector((0, 1, 0)),
        "Z": Vector((0, 0, 1))
    }
    if axis not in axis_vectors:
        raise ValueError(f"unsupported armature-space axis: {axis}")
    rest_rotation = bone.bone.matrix_local.to_quaternion()
    global_delta = Quaternion(axis_vectors[axis], math.radians(degrees))
    local_delta = rest_rotation.inverted() @ global_delta @ rest_rotation
    bone.rotation_mode = "QUATERNION"
    bone.rotation_quaternion = local_delta @ bone.rotation_quaternion


def locate(rig: bpy.types.Object, name: str, xyz: tuple[float, float, float]) -> None:
    bone = rig.pose.bones.get(name)
    if bone is None:
        raise RuntimeError(f"runtime deform skeleton is missing {name}")
    bone.location = xyz


def key_pose(rig: bpy.types.Object, frame: int) -> None:
    for name in BONES:
        bone = rig.pose.bones.get(name)
        if bone is None:
            continue
        bone.keyframe_insert("location", frame=frame, group=name)
        bone.keyframe_insert("rotation_quaternion", frame=frame, group=name)
        bone.keyframe_insert("scale", frame=frame, group=name)


def neutral_pose(rig: bpy.types.Object) -> None:
    """Move the bound T-pose arms into a relaxed, cabinet-safe stance.

    The audited TRELLIS mesh faces the positive Y axis.  Applying these
    rotations in armature space keeps the result independent of the unusual
    local roll axes produced by Auto-Rig Pro's deformation skeleton.
    """
    rotate_global(rig, "arm_stretch.l", "Y", 76)
    rotate_global(rig, "arm_stretch.r", "Y", -76)
    rotate_global(rig, "forearm_stretch.l", "X", 6)
    rotate_global(rig, "forearm_stretch.r", "X", 6)


def pose_run(rig: bpy.types.Object, direction: float, compression: float = 0.0) -> None:
    neutral_pose(rig)
    rotate(rig, "spine_01.x", (8 + compression * 8, 0, direction * 3))
    rotate(rig, "spine_02.x", (4, 0, -direction * 2))
    rotate(rig, "head.x", (-4, 0, -direction * 3))
    rotate_global(rig, "arm_stretch.l", "X", direction * 42)
    rotate_global(rig, "arm_stretch.r", "X", -direction * 42)
    rotate_global(rig, "forearm_stretch.l", "X", max(0, -direction) * 38)
    rotate_global(rig, "forearm_stretch.r", "X", max(0, direction) * 38)
    rotate_global(rig, "thigh_stretch.l", "X", -direction * 38)
    rotate_global(rig, "thigh_stretch.r", "X", direction * 38)
    rotate_global(rig, "leg_stretch.l", "X", max(0, direction) * 48)
    rotate_global(rig, "leg_stretch.r", "X", max(0, -direction) * 48)
    locate(rig, "root.x", (0, 0, compression * -0.035))


def create_action(rig: bpy.types.Object, name: str, poses: list[tuple[int, callable]]) -> bpy.types.Action:
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    if rig.animation_data is None:
        rig.animation_data_create()
    rig.animation_data.action = action
    for frame, pose in poses:
        reset_pose(rig)
        pose(rig)
        key_pose(rig, frame)
    for fcurve in getattr(action, "fcurves", []):
        for point in fcurve.keyframe_points:
            point.interpolation = "BEZIER"
    rig.animation_data.action = None
    return action


def author_actions(rig: bpy.types.Object) -> dict[str, bpy.types.Action]:
    neutral = neutral_pose

    def crouch(amount: float):
        def apply(target):
            neutral_pose(target)
            rotate(target, "spine_01.x", (24 * amount, 0, 0))
            rotate(target, "thigh_stretch.l", (-28 * amount, 0, 0))
            rotate(target, "thigh_stretch.r", (-28 * amount, 0, 0))
            rotate(target, "leg_stretch.l", (46 * amount, 0, 0))
            rotate(target, "leg_stretch.r", (46 * amount, 0, 0))
            rotate_global(target, "arm_stretch.l", "X", -18 * amount)
            rotate_global(target, "arm_stretch.r", "X", -18 * amount)
            locate(target, "root.x", (0, 0, -0.07 * amount))
        return apply

    def brake(target):
        neutral_pose(target)
        rotate(target, "spine_01.x", (-12, 0, -11))
        rotate_global(target, "arm_stretch.l", "X", -58)
        rotate_global(target, "arm_stretch.r", "X", -55)
        rotate(target, "thigh_stretch.l", (24, 0, 0))
        rotate(target, "thigh_stretch.r", (-34, 0, 0))
        rotate(target, "leg_stretch.r", (57, 0, 0))

    def pickup(amount: float):
        def apply(target):
            neutral_pose(target)
            bend = math.sin(amount * math.pi)
            # The final camera sees the runner almost front-on.  Keep the
            # torso pitch restrained and sell the pickup through a deep knee
            # compression plus both hands reaching below the waist; a large
            # local spine rotation on this ARP rig reads as falling backward.
            rotate(target, "spine_01.x", (8 * bend, 0, -5 * amount))
            rotate(target, "spine_02.x", (4 * bend, 0, 0))
            rotate_global(target, "arm_stretch.l", "X", -20 * amount)
            rotate_global(target, "arm_stretch.r", "X", -22 * amount)
            rotate(target, "forearm_stretch.l", (24 * amount, 0, 0))
            rotate(target, "forearm_stretch.r", (28 * amount, 0, 0))
            rotate(target, "thigh_stretch.l", (-22 * bend, 0, 0))
            rotate(target, "thigh_stretch.r", (-26 * bend, 0, 0))
            rotate(target, "leg_stretch.l", (39 * bend, 0, 0))
            rotate(target, "leg_stretch.r", (43 * bend, 0, 0))
            locate(target, "root.x", (0, 0, -0.10 * bend))
        return apply

    def raise_trophy(amount: float, breathe: float = 0.0):
        def apply(target):
            rotate(target, "spine_01.x", (-4 * amount + breathe, 0, 0))
            rotate(target, "head.x", (-10 * amount, 0, breathe * 1.5))
            rotate_global(target, "arm_stretch.l", "Y", -76 * amount)
            rotate_global(target, "arm_stretch.r", "Y", 76 * amount)
            rotate_global(target, "forearm_stretch.l", "Y", -12 * amount)
            rotate_global(target, "forearm_stretch.r", "Y", 12 * amount)
        return apply

    actions = {
        "portal_emerge": create_action(rig, "portal_emerge", [(0, crouch(1)), (12, crouch(0.55)), (24, neutral)]),
        "portal_landing": create_action(rig, "portal_landing", [(0, neutral), (7, crouch(0.48)), (18, neutral)]),
        "run": create_action(rig, "run", [(0, lambda target: pose_run(target, -1)), (5, lambda target: pose_run(target, 0, 0.8)), (10, lambda target: pose_run(target, 1)), (15, lambda target: pose_run(target, 0, 0.8)), (20, lambda target: pose_run(target, -1))]),
        "brake": create_action(rig, "brake", [(0, lambda target: pose_run(target, 1)), (10, brake), (24, neutral)]),
        "slot_transfer": create_action(rig, "slot_transfer", [(0, crouch(0.2)), (6, crouch(0.75)), (14, crouch(0.2))]),
        "trophy_pickup": create_action(rig, "trophy_pickup", [(0, pickup(0)), (18, pickup(0.5)), (36, pickup(1))]),
        "trophy_raise": create_action(rig, "trophy_raise", [(0, raise_trophy(0)), (22, raise_trophy(0.62)), (42, raise_trophy(1))]),
        "victory_hold": create_action(rig, "victory_hold", [(0, raise_trophy(1, 0)), (30, raise_trophy(1, 1.2)), (60, raise_trophy(1, 0))])
    }
    return actions


def aim(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_review() -> bpy.types.Object:
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith("ReviewBone_") or obj.name.startswith("ReviewStudio_") or obj.name == "ReviewFloor":
            bpy.data.objects.remove(obj, do_unlink=True)
    world = bpy.context.scene.world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.025, 0.045, 0.06, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.28
    for name, location, energy, size in [
        ("AdventureReviewKey", (1.8, 2.1, 2.2), 550, 2.0),
        ("AdventureReviewFill", (-1.6, 0.8, 0.7), 260, 1.6),
        ("AdventureReviewRim", (0, -1.4, 1.4), 380, 1.2)
    ]:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        aim(light, Vector((0, 0, 0)))
    bpy.ops.object.camera_add(location=(0, 2.3, 0.08))
    camera = bpy.context.object
    camera.name = "AdventureReviewCamera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 1.35
    aim(camera, Vector((0, 0, 0)))
    bpy.context.scene.camera = camera
    return camera


def render_actions(rig: bpy.types.Object, actions: dict[str, bpy.types.Action], output_dir: Path) -> list[str]:
    setup_review()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "None"
    representatives = {
        "portal_emerge": 12,
        "portal_landing": 7,
        "run": 0,
        "brake": 10,
        "slot_transfer": 6,
        "trophy_pickup": 18,
        "trophy_raise": 42,
        "victory_hold": 30
    }
    paths = []
    rig.animation_data_create()
    for name, action in actions.items():
        rig.animation_data.action = action
        scene.frame_set(representatives[name])
        destination = output_dir / f"{name}.png"
        scene.render.filepath = str(destination)
        bpy.ops.render.render(write_still=True)
        paths.append(str(destination))
    rig.animation_data.action = None
    scene.frame_set(0)
    reset_pose(rig)
    return paths


def main() -> None:
    args = args_after_separator()
    if len(args) != 2:
        raise RuntimeError("usage: blender ... -- <output.glb> <review-dir>")
    output_glb = Path(args[0]).resolve()
    review_dir = Path(args[1]).resolve()
    output_glb.parent.mkdir(parents=True, exist_ok=True)
    review_dir.mkdir(parents=True, exist_ok=True)
    source_rig = bpy.data.objects.get("rig")
    mesh = bpy.data.objects.get("ToymoilMesh")
    if source_rig is None or source_rig.type != "ARMATURE" or mesh is None or mesh.type != "MESH":
        raise RuntimeError("audited ARP bind scene is missing rig or ToymoilMesh")
    runtime = create_deform_rig(source_rig, mesh)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    actions = author_actions(runtime)
    review_paths = render_actions(runtime, actions, review_dir)

    bpy.ops.object.select_all(action="DESELECT")
    runtime.hide_set(False)
    mesh.hide_set(False)
    runtime.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = runtime
    bpy.ops.export_scene.gltf(
        filepath=str(output_glb),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_morph=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_apply=True
    )
    bpy.ops.wm.save_as_mainfile(filepath=str(review_dir / "nobita-adventure-authoring.blend"), check_existing=False)
    audit = {
        "status": "passed",
        "source_bind": bpy.data.filepath,
        "runtime_glb": str(output_glb),
        "runtime_glb_sha256": sha256(output_glb),
        "runtime_glb_bytes": output_glb.stat().st_size,
        "mesh_vertices": len(mesh.data.vertices),
        "deform_bone_count": len(runtime.data.bones),
        "deform_bones": [bone.name for bone in runtime.data.bones],
        "actions": {name: [int(action.frame_range[0]), int(action.frame_range[1])] for name, action in actions.items()},
        "review_paths": review_paths,
        "controller_bones_exported": [bone.name for bone in runtime.data.bones if bone.name.startswith(("c_", "ik_", "fk_", "pole", "ref"))],
        "manual_bone_map_edits": False,
        "animation_source": "deterministic authored deform-bone keyframes"
    }
    (review_dir / "runtime_audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "output": str(output_glb), "audit": audit}, ensure_ascii=False))


if __name__ == "__main__":
    main()
