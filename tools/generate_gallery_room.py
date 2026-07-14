from __future__ import annotations

import math
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "gallery" / "models" / "gallery-room.glb"


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def set_input(node: bpy.types.Node, names: tuple[str, ...], value) -> None:
    for name in names:
        if name in node.inputs:
            node.inputs[name].default_value = value
            return


def make_mat(
    name: str,
    base: tuple[float, float, float, float],
    roughness: float = 0.55,
    metallic: float = 0.0,
    alpha: float = 1.0,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (base[0], base[1], base[2], alpha)
    mat.use_screen_refraction = alpha < 1.0
    mat.blend_method = "BLEND" if alpha < 1.0 else "OPAQUE"
    mat.show_transparent_back = alpha >= 1.0

    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        set_input(bsdf, ("Base Color",), (base[0], base[1], base[2], alpha))
        set_input(bsdf, ("Metallic",), metallic)
        set_input(bsdf, ("Roughness",), roughness)
        set_input(bsdf, ("Alpha",), alpha)
        if emission is not None:
            set_input(bsdf, ("Emission Color", "Emission"), emission)
            set_input(bsdf, ("Emission Strength",), emission_strength)
    return mat


MATS: dict[str, bpy.types.Material] = {}


def setup_materials() -> None:
    MATS.update(
        {
            "wall_back": make_mat("museum_low_saturation_back_wall", (0.38, 0.39, 0.38, 1), 0.72),
            "wall_left": make_mat("warm_oak_side_wall", (0.47, 0.34, 0.23, 1), 0.58),
            "wall_right": make_mat("sage_green_side_wall", (0.32, 0.40, 0.34, 1), 0.64),
            "floor": make_mat("dark_satin_floor", (0.26, 0.25, 0.23, 1), 0.46),
            "ceiling": make_mat("warm_gray_ceiling", (0.34, 0.34, 0.32, 1), 0.62),
            "blackboard": make_mat("hero_blackboard_glass_off", (0.015, 0.019, 0.022, 1), 0.23, 0.0),
            "screen": make_mat(
                "hero_screen_placeholder_emissive",
                (0.64, 0.70, 0.72, 1),
                0.32,
                0.0,
                1.0,
                (0.36, 0.42, 0.46, 1),
                0.45,
            ),
            "screen_frame": make_mat("brushed_dark_bronze_frame", (0.72, 0.53, 0.28, 1), 0.31, 0.72),
            "cabinet_frame": make_mat("gunmetal_beveled_frame", (0.075, 0.077, 0.078, 1), 0.28, 0.78),
            "glass": make_mat("clear_front_glass_subtle", (0.82, 0.94, 1.0, 0.24), 0.035, 0.0, 0.24),
            "light": make_mat(
                "warm_rect_area_light_surface",
                (1.0, 0.88, 0.62, 1),
                0.18,
                0.0,
                1.0,
                (1.0, 0.78, 0.42, 1),
                1.35,
            ),
            "obsidian": make_mat("glossy_black_obsidian_plinth", (0.014, 0.013, 0.012, 1), 0.18, 0.45),
            "trophy": make_mat("replaceable_trophy_pbr_socket", (0.92, 0.78, 0.43, 1), 0.34, 0.92),
            "ao": make_mat("baked_contact_shadow_planes", (0.0, 0.0, 0.0, 0.34), 0.95, 0.0, 0.34),
        }
    )


def add_bevel(obj: bpy.types.Object, width: float, segments: int = 3) -> None:
    if width <= 0:
        return
    bevel = obj.modifiers.new("small_real_bevel", "BEVEL")
    bevel.width = width
    bevel.segments = segments
    bevel.affect = "EDGES"
    bevel.harden_normals = True
    obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")


def box(
    name: str,
    parent: bpy.types.Object,
    loc: tuple[float, float, float],
    dims: tuple[float, float, float],
    mat: bpy.types.Material,
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}.mesh"
    obj.parent = parent
    obj.location = loc
    obj.dimensions = dims
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    add_bevel(obj, bevel)
    return obj


def cylinder(
    name: str,
    parent: bpy.types.Object,
    loc: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
    vertices: int = 64,
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}.mesh"
    obj.parent = parent
    obj.location = loc
    obj.data.materials.append(mat)
    add_bevel(obj, bevel, 4)
    return obj


def sphere(
    name: str,
    parent: bpy.types.Object,
    loc: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=1)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}.mesh"
    obj.parent = parent
    obj.location = loc
    obj.scale = scale
    obj.data.materials.append(mat)
    obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    return obj


def torus(
    name: str,
    parent: bpy.types.Object,
    loc: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    mat: bpy.types.Material,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(major_radius=major_radius, minor_radius=minor_radius, major_segments=72, minor_segments=16)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}.mesh"
    obj.parent = parent
    obj.location = loc
    obj.rotation_euler = tuple(math.radians(v) for v in rotation)
    obj.data.materials.append(mat)
    obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    return obj


def empty(name: str, parent: bpy.types.Object | None, loc: tuple[float, float, float]) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type = "CUBE"
    obj.empty_display_size = 0.12
    obj.parent = parent
    obj.location = loc
    return obj


def add_room(slot: bpy.types.Object, idx: int) -> None:
    prefix = f"slot-{idx}"
    w = 3.22
    h = 2.14
    d = 1.52
    t = 0.075

    box(f"{prefix}.room.back-wall", slot, (0, d / 2, 0), (w, t, h), MATS["wall_back"], 0.018)
    box(f"{prefix}.room.left-wall", slot, (-w / 2, 0, 0), (t, d, h), MATS["wall_left"], 0.018)
    box(f"{prefix}.room.right-wall", slot, (w / 2, 0, 0), (t, d, h), MATS["wall_right"], 0.018)
    box(f"{prefix}.room.floor", slot, (0, 0, -h / 2), (w, d, t), MATS["floor"], 0.018)
    box(f"{prefix}.room.ceiling", slot, (0, 0, h / 2), (w, d, t), MATS["ceiling"], 0.018)

    box(f"{prefix}.room.rear-corner-ao", slot, (0, d / 2 - 0.048, -h / 2 + 0.04), (w - 0.34, 0.012, 0.09), MATS["ao"], 0.0)
    box(f"{prefix}.room.left-corner-ao", slot, (-w / 2 + 0.045, d / 2 - 0.22, 0), (0.018, 0.28, h - 0.3), MATS["ao"], 0.0)
    box(f"{prefix}.room.right-corner-ao", slot, (w / 2 - 0.045, d / 2 - 0.22, 0), (0.018, 0.28, h - 0.3), MATS["ao"], 0.0)

    frame_z = 0
    front_y = -d / 2 - 0.03
    bar = 0.105
    box(f"{prefix}.front-frame.top", slot, (0, front_y, h / 2 - bar / 2), (w + 0.18, 0.16, bar), MATS["cabinet_frame"], 0.025)
    box(f"{prefix}.front-frame.bottom", slot, (0, front_y, -h / 2 + bar / 2), (w + 0.18, 0.16, bar), MATS["cabinet_frame"], 0.025)
    box(f"{prefix}.front-frame.left", slot, (-w / 2 - bar / 2, front_y, frame_z), (bar, 0.16, h + 0.08), MATS["cabinet_frame"], 0.025)
    box(f"{prefix}.front-frame.right", slot, (w / 2 + bar / 2, front_y, frame_z), (bar, 0.16, h + 0.08), MATS["cabinet_frame"], 0.025)

    box(f"{prefix}.glass", slot, (0, front_y - 0.012, 0), (w - 0.46, 0.018, h - 0.43), MATS["glass"], 0.012)
    box(f"{prefix}.top-light", slot, (0, -0.03, h / 2 - 0.083), (0.92, 0.28, 0.018), MATS["light"], 0.015)

    box(f"{prefix}.hero-blackboard", slot, (-0.38, d / 2 - 0.06, 0.18), (1.74, 0.045, 1.12), MATS["blackboard"], 0.018)
    box(f"{prefix}.hero-frame.top", slot, (-0.38, d / 2 - 0.095, 0.18 + 0.59), (1.88, 0.075, 0.065), MATS["screen_frame"], 0.012)
    box(f"{prefix}.hero-frame.bottom", slot, (-0.38, d / 2 - 0.095, 0.18 - 0.59), (1.88, 0.075, 0.065), MATS["screen_frame"], 0.012)
    box(f"{prefix}.hero-frame.left", slot, (-0.38 - 0.94, d / 2 - 0.095, 0.18), (0.065, 0.075, 1.16), MATS["screen_frame"], 0.012)
    box(f"{prefix}.hero-frame.right", slot, (-0.38 + 0.94, d / 2 - 0.095, 0.18), (0.065, 0.075, 1.16), MATS["screen_frame"], 0.012)
    box(f"{prefix}.hero-screen", slot, (-0.38, d / 2 - 0.125, 0.18), (1.62, 0.024, 1.01), MATS["screen"], 0.006)

    anchor = empty(f"{prefix}.nameplate-anchor", slot, (-1.18, front_y - 0.12, 0.86))
    anchor.empty_display_size = 0.08


def add_trophy(slot: bpy.types.Object, idx: int) -> None:
    prefix = f"slot-{idx}"
    trophy = empty(f"{prefix}.trophy", slot, (0.58, -0.28, -0.63))
    trophy.empty_display_type = "SPHERE"
    trophy.empty_display_size = 0.22

    cylinder(f"{prefix}.trophy.plinth", trophy, (0, 0, 0.06), 0.37, 0.16, MATS["obsidian"], 64, 0.018)
    cylinder(f"{prefix}.trophy.base-ring", trophy, (0, 0, 0.18), 0.29, 0.09, MATS["trophy"], 64, 0.012)
    cylinder(f"{prefix}.trophy.stem", trophy, (0, 0, 0.43), 0.08, 0.44, MATS["trophy"], 48, 0.008)
    sphere(f"{prefix}.trophy.cup", trophy, (0, 0, 0.79), (0.31, 0.31, 0.29), MATS["trophy"])
    box(f"{prefix}.trophy.cup-cut-mask", trophy, (0, 0, 1.0), (0.46, 0.46, 0.08), MATS["trophy"], 0.01)
    torus(f"{prefix}.trophy.rim", trophy, (0, 0, 1.0), 0.31, 0.035, MATS["trophy"])
    torus(f"{prefix}.trophy.left-handle", trophy, (-0.28, 0, 0.82), 0.16, 0.024, MATS["trophy"], (0, 68, 0))
    torus(f"{prefix}.trophy.right-handle", trophy, (0.28, 0, 0.82), 0.16, 0.024, MATS["trophy"], (0, -68, 0))
    box(f"{prefix}.trophy.contact-shadow", slot, (0.58, -0.28, -1.03), (0.86, 0.48, 0.012), MATS["ao"], 0.03)


def add_slot(idx: int, loc: tuple[float, float, float]) -> None:
    root = empty(f"slot-{idx}", None, loc)
    add_room(root, idx)
    add_trophy(root, idx)


def add_camera_and_world() -> None:
    bpy.ops.object.light_add(type="AREA", location=(0, -4.5, 4.5))
    key = bpy.context.object
    key.name = "preview_softbox_key"
    key.data.energy = 280
    key.data.size = 5.2

    bpy.ops.object.camera_add(location=(0, -8.6, 1.0), rotation=(math.radians(83), 0, 0))
    bpy.context.scene.camera = bpy.context.object

    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 96
    bpy.context.scene.view_settings.view_transform = "AgX"
    bpy.context.scene.view_settings.look = "AgX - Medium High Contrast"
    bpy.context.scene.world.color = (0.025, 0.026, 0.028)


def export_glb() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_lights=False,
        export_cameras=False,
        use_selection=False,
    )


def main() -> None:
    clear_scene()
    setup_materials()
    add_slot(0, (-1.92, 0, 1.28))
    add_slot(1, (1.92, 0, 1.28))
    add_slot(2, (-1.92, 0, -1.28))
    add_slot(3, (1.92, 0, -1.28))
    add_camera_and_world()
    export_glb()
    print(f"exported {OUT}")


if __name__ == "__main__":
    main()
