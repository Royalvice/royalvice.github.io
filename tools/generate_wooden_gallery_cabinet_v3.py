from __future__ import annotations

import json
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
OUT_GLB = ROOT / "public/assets/gallery/models/wooden-gallery-cabinet-v3.glb"
OUT_REPORT = ROOT / "public/assets/gallery/models/wooden-gallery-cabinet-v3.report.json"

WIDTH = 5.55
HEIGHT = 4.78
DEPTH = 1.22
FRAME = 0.28
DIVIDER = 0.20
PANEL = 0.085
BEVEL = 0.032

INNER_W = (WIDTH - 2 * FRAME - DIVIDER) / 2
INNER_H = (HEIGHT - 2 * FRAME - DIVIDER) / 2
FRONT_Y = -DEPTH / 2
BACK_Y = DEPTH / 2

GLASS_MARGIN_X = 0.135
GLASS_MARGIN_Z = 0.145
GLASS_EDGE = 0.032
PLAQUE_W = 1.18
PLAQUE_H = 0.42

SLOT_CENTERS = [
    (-DIVIDER / 2 - INNER_W / 2, DIVIDER / 2 + INNER_H / 2),
    (DIVIDER / 2 + INNER_W / 2, DIVIDER / 2 + INNER_H / 2),
    (-DIVIDER / 2 - INNER_W / 2, -DIVIDER / 2 - INNER_H / 2),
    (DIVIDER / 2 + INNER_W / 2, -DIVIDER / 2 - INNER_H / 2),
]

TROPHY_TIERS = ["legendary-holo", "legendary-holo", "blue-crystal", "silver"]

MATERIALS = {
    "mat_walnut_outer": (0.18, 0.105, 0.058, 1.0),
    "mat_cherry_interior": (0.50, 0.245, 0.115, 1.0),
    "mat_right_wall_dark": (0.16, 0.060, 0.030, 1.0),
    "mat_dark_floor": (0.08, 0.052, 0.034, 1.0),
    "mat_corner_shadow": (0.020, 0.006, 0.002, 0.66),
    "mat_black_lacquer_trim": (0.010, 0.009, 0.008, 1.0),
    "mat_brass_trim": (0.86, 0.57, 0.25, 1.0),
    "mat_light_diffuser": (1.0, 0.84, 0.52, 1.0),
    "mat_glass_edge": (0.64, 0.90, 1.0, 0.34),
    "mat_glass_pane": (0.74, 0.92, 1.0, 0.16),
    "mat_card_frame": (0.020, 0.017, 0.014, 1.0),
    "mat_plaque_lcd": (0.020, 0.070, 0.072, 1.0),
    "mat_obsidian_plinth": (0.012, 0.011, 0.010, 1.0),
    "mat_legendary_holo": (0.78, 0.58, 1.0, 0.58),
    "mat_gold_trophy": (1.0, 0.66, 0.22, 1.0),
    "mat_silver_trophy": (0.82, 0.88, 0.96, 1.0),
    "mat_blue_crystal": (0.22, 0.78, 1.0, 0.62),
    "mat_soft_shadow": (0.0, 0.0, 0.0, 0.30),
}


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(block):
            block.remove(item)


def create_material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = color
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = color[3]
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = 1.0 if any(key in name for key in ("brass", "gold", "silver")) else 0.0
        if "Roughness" in bsdf.inputs:
            if "corner_shadow" in name:
                bsdf.inputs["Roughness"].default_value = 0.92
            elif "right_wall_dark" in name:
                bsdf.inputs["Roughness"].default_value = 0.84
            elif "lacquer" in name or "obsidian" in name:
                bsdf.inputs["Roughness"].default_value = 0.18
            elif "brass" in name or "trophy" in name:
                bsdf.inputs["Roughness"].default_value = 0.32
            elif "glass" in name or "holo" in name or "crystal" in name:
                bsdf.inputs["Roughness"].default_value = 0.08
            else:
                bsdf.inputs["Roughness"].default_value = 0.46
        if "Emission Color" in bsdf.inputs and ("light" in name or "plaque" in name):
            bsdf.inputs["Emission Color"].default_value = (color[0], color[1], color[2], 1.0)
        if "Emission Strength" in bsdf.inputs and ("light" in name or "plaque" in name):
            bsdf.inputs["Emission Strength"].default_value = 1.1 if "light" in name else 0.35
    material.diffuse_color = color
    if color[3] < 1:
        material.blend_method = "BLEND"
        material.use_screen_refraction = True
        material.show_transparent_back = True
    return material


def apply_modifier(obj: bpy.types.Object, name: str) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=name)


def ensure_uvs(obj: bpy.types.Object, tile_scale: float = 1.0) -> None:
    mesh = obj.data
    while len(mesh.uv_layers) < 2:
        mesh.uv_layers.new(name="UVMap" if len(mesh.uv_layers) == 0 else "LightmapUV")

    coords = [v.co.copy() for v in mesh.vertices]
    if not coords:
        return
    min_co = Vector((min(v.x for v in coords), min(v.y for v in coords), min(v.z for v in coords)))
    max_co = Vector((max(v.x for v in coords), max(v.y for v in coords), max(v.z for v in coords)))
    span = max_co - min_co
    span.x = max(span.x, 0.001)
    span.y = max(span.y, 0.001)
    span.z = max(span.z, 0.001)

    for poly in mesh.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs((n.x, n.y, n.z)[i]))
        for loop_index in poly.loop_indices:
            co = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            if ax == 0:
                u = (co.y - min_co.y) / span.y * DEPTH * tile_scale
                v = (co.z - min_co.z) / span.z * HEIGHT * tile_scale
            elif ax == 1:
                u = (co.x - min_co.x) / span.x * WIDTH * tile_scale
                v = (co.z - min_co.z) / span.z * HEIGHT * tile_scale
            else:
                u = (co.x - min_co.x) / span.x * WIDTH * tile_scale
                v = (co.y - min_co.y) / span.y * DEPTH * tile_scale
            mesh.uv_layers[0].data[loop_index].uv = (u, v)
            mesh.uv_layers[1].data[loop_index].uv = (
                (co.x - min_co.x) / span.x,
                (co.z - min_co.z) / span.z if ax != 2 else (co.y - min_co.y) / span.y,
            )


def finish_mesh(obj: bpy.types.Object, bevel: float = 0.0, tile_scale: float = 1.0) -> bpy.types.Object:
    if bevel > 0:
        bevel_mod = obj.modifiers.new("v2_edge_bevel", "BEVEL")
        bevel_mod.width = bevel
        bevel_mod.segments = 3
        bevel_mod.affect = "EDGES"
        apply_modifier(obj, bevel_mod.name)
    normal_mod = obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    normal_mod.keep_sharp = True
    apply_modifier(obj, normal_mod.name)
    ensure_uvs(obj, tile_scale)
    return obj


def add_empty(name: str, location: tuple[float, float, float], parent: bpy.types.Object | None = None) -> bpy.types.Object:
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 0.08
    bpy.context.collection.objects.link(empty)
    empty.parent = parent
    empty.location = location
    return empty


def add_panel(
    name: str,
    center: tuple[float, float, float],
    size: tuple[float, float, float],
    material: bpy.types.Material,
    parent: bpy.types.Object,
    bevel: float = BEVEL,
    tile_scale: float = 1.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}-mesh"
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    obj.parent = parent
    return finish_mesh(obj, bevel=bevel, tile_scale=tile_scale)


def add_ao_strip(
    name: str,
    center: tuple[float, float, float],
    size: tuple[float, float, float],
    material: bpy.types.Material,
    parent: bpy.types.Object,
    tile_scale: float = 0.18,
) -> bpy.types.Object:
    return add_panel(name, center, size, material, parent, bevel=0.002, tile_scale=tile_scale)


def add_cylinder(
    name: str,
    parent: bpy.types.Object,
    material: bpy.types.Material,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    vertices: int = 48,
    bevel: float = 0.0,
    rotation: tuple[float, float, float] | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}-mesh"
    obj.data.materials.append(material)
    if rotation:
        obj.rotation_euler = rotation
    obj.parent = parent
    obj.location = location
    return finish_mesh(obj, bevel=bevel, tile_scale=0.8)


def add_cone(
    name: str,
    parent: bpy.types.Object,
    material: bpy.types.Material,
    location: tuple[float, float, float],
    radius1: float,
    radius2: float,
    depth: float,
    vertices: int = 48,
    bevel: float = 0.0,
    rotation: tuple[float, float, float] | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}-mesh"
    obj.data.materials.append(material)
    if rotation:
        obj.rotation_euler = rotation
    obj.parent = parent
    obj.location = location
    return finish_mesh(obj, bevel=bevel, tile_scale=0.8)


def add_sphere(
    name: str,
    parent: bpy.types.Object,
    material: bpy.types.Material,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    segments: int = 48,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=24, radius=1, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}-mesh"
    obj.scale = scale
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.parent = parent
    obj.location = location
    return finish_mesh(obj, bevel=0.0, tile_scale=0.5)


def add_trophy(prefix: str, slot: bpy.types.Object, tier: str, materials: dict[str, bpy.types.Material]) -> bpy.types.Object:
    trophy = add_empty(f"{prefix}.trophy-root", (0.52, FRONT_Y + 0.37, -INNER_H / 2 + 0.35), parent=slot)
    add_cylinder(f"{prefix}.trophy-shadow", trophy, materials["mat_soft_shadow"], (0, 0, 0.012), 0.38, 0.012, vertices=64)
    add_panel(f"{prefix}.trophy-plinth", (0, 0, 0.10), (0.58, 0.42, 0.20), materials["mat_obsidian_plinth"], trophy, bevel=0.035, tile_scale=0.4)
    add_panel(f"{prefix}.trophy-brass-lip", (0, -0.01, 0.225), (0.62, 0.45, 0.035), materials["mat_brass_trim"], trophy, bevel=0.012, tile_scale=0.25)

    if tier == "legendary-holo":
        add_cylinder(f"{prefix}.trophy-gold-core", trophy, materials["mat_gold_trophy"], (0, 0, 0.48), 0.07, 0.46, vertices=40, bevel=0.008)
        add_sphere(f"{prefix}.trophy-holo-orb", trophy, materials["mat_legendary_holo"], (0, 0, 0.78), (0.25, 0.25, 0.25))
        add_cone(f"{prefix}.trophy-holo-spire", trophy, materials["mat_legendary_holo"], (0, 0, 1.08), 0.18, 0.045, 0.42, vertices=5, bevel=0.006)
        add_cylinder(f"{prefix}.trophy-gold-ring", trophy, materials["mat_gold_trophy"], (0, 0, 0.77), 0.30, 0.025, vertices=64, bevel=0.004, rotation=(1.5708, 0, 0))
    elif tier == "blue-crystal":
        add_cylinder(f"{prefix}.trophy-crystal-column", trophy, materials["mat_blue_crystal"], (0, 0, 0.58), 0.16, 0.62, vertices=6, bevel=0.012)
        add_cone(f"{prefix}.trophy-crystal-top", trophy, materials["mat_blue_crystal"], (0, 0, 0.98), 0.17, 0.02, 0.26, vertices=6, bevel=0.006)
        add_cone(f"{prefix}.trophy-crystal-bottom", trophy, materials["mat_blue_crystal"], (0, 0, 0.29), 0.02, 0.15, 0.18, vertices=6, bevel=0.006)
        add_cylinder(f"{prefix}.trophy-silver-ring", trophy, materials["mat_silver_trophy"], (0, 0, 0.48), 0.22, 0.026, vertices=48, bevel=0.004, rotation=(1.5708, 0, 0))
    elif tier == "gold":
        add_cylinder(f"{prefix}.trophy-gold-stem", trophy, materials["mat_gold_trophy"], (0, 0, 0.50), 0.09, 0.46, vertices=48, bevel=0.008)
        add_sphere(f"{prefix}.trophy-gold-medal", trophy, materials["mat_gold_trophy"], (0, 0, 0.82), (0.29, 0.12, 0.29))
        add_cone(f"{prefix}.trophy-gold-crown", trophy, materials["mat_gold_trophy"], (0, 0, 1.05), 0.22, 0.10, 0.25, vertices=6, bevel=0.008)
    else:
        add_cylinder(f"{prefix}.trophy-silver-stem", trophy, materials["mat_silver_trophy"], (0, 0, 0.49), 0.085, 0.44, vertices=48, bevel=0.008)
        add_sphere(f"{prefix}.trophy-silver-orb", trophy, materials["mat_silver_trophy"], (0, 0, 0.76), (0.24, 0.24, 0.24))
        add_cone(f"{prefix}.trophy-silver-spire", trophy, materials["mat_silver_trophy"], (0, 0, 1.06), 0.19, 0.08, 0.34, vertices=48, bevel=0.006)

    return trophy


def build_cabinet() -> dict:
    materials = {name: create_material(name, color) for name, color in MATERIALS.items()}
    root = add_empty("cabinet-root", (0, 0, 0))
    mesh_names: list[str] = []

    def panel(name: str, center, size, material_name: str, parent: bpy.types.Object = root, bevel: float = BEVEL, tile_scale: float = 1.0):
        obj = add_panel(name, center, size, materials[material_name], parent, bevel=bevel, tile_scale=tile_scale)
        mesh_names.append(obj.name)
        return obj

    # Heavy furniture shell.
    panel("outer-frame-left", (-WIDTH / 2 + FRAME / 2, 0, 0), (FRAME, DEPTH, HEIGHT), "mat_walnut_outer")
    panel("outer-frame-right", (WIDTH / 2 - FRAME / 2, 0, 0), (FRAME, DEPTH, HEIGHT), "mat_walnut_outer")
    panel("outer-frame-top", (0, 0, HEIGHT / 2 - FRAME / 2), (WIDTH, DEPTH, FRAME), "mat_walnut_outer")
    panel("outer-frame-bottom", (0, 0, -HEIGHT / 2 + FRAME / 2), (WIDTH, DEPTH, FRAME), "mat_walnut_outer")
    panel("divider-vertical-core", (0, 0, 0), (DIVIDER, DEPTH, HEIGHT - 2 * FRAME), "mat_walnut_outer")
    panel("divider-horizontal-core", (0, 0, 0), (WIDTH - 2 * FRAME, DEPTH, DIVIDER), "mat_walnut_outer")

    # Black lacquer depth ribs make the structure read as furniture, not line art.
    rib_y = FRONT_Y - 0.035
    panel("lacquer-outer-top-rib", (0, rib_y, HEIGHT / 2 - 0.115), (WIDTH - 0.26, 0.055, 0.055), "mat_black_lacquer_trim", bevel=0.014, tile_scale=0.35)
    panel("lacquer-outer-bottom-rib", (0, rib_y, -HEIGHT / 2 + 0.115), (WIDTH - 0.26, 0.055, 0.055), "mat_black_lacquer_trim", bevel=0.014, tile_scale=0.35)
    panel("lacquer-outer-left-rib", (-WIDTH / 2 + 0.115, rib_y, 0), (0.055, 0.055, HEIGHT - 0.26), "mat_black_lacquer_trim", bevel=0.014, tile_scale=0.35)
    panel("lacquer-outer-right-rib", (WIDTH / 2 - 0.115, rib_y, 0), (0.055, 0.055, HEIGHT - 0.26), "mat_black_lacquer_trim", bevel=0.014, tile_scale=0.35)

    brass_y = FRONT_Y - 0.072
    panel("brass-outer-top", (0, brass_y, HEIGHT / 2 - 0.040), (WIDTH, 0.034, 0.034), "mat_brass_trim", bevel=0.010, tile_scale=0.25)
    panel("brass-outer-bottom", (0, brass_y, -HEIGHT / 2 + 0.040), (WIDTH, 0.034, 0.034), "mat_brass_trim", bevel=0.010, tile_scale=0.25)
    panel("brass-outer-left", (-WIDTH / 2 + 0.040, brass_y, 0), (0.034, 0.034, HEIGHT), "mat_brass_trim", bevel=0.010, tile_scale=0.25)
    panel("brass-outer-right", (WIDTH / 2 - 0.040, brass_y, 0), (0.034, 0.034, HEIGHT), "mat_brass_trim", bevel=0.010, tile_scale=0.25)
    glass_y = FRONT_Y - 0.088
    outer_glass_w = WIDTH - 2 * FRAME + 0.11
    outer_glass_h = HEIGHT - 2 * FRAME + 0.08
    panel("front-glass-outer-pane", (0, glass_y, 0), (outer_glass_w, 0.010, outer_glass_h), "mat_glass_pane", bevel=0.006, tile_scale=0.18)
    panel("front-glass-outer-top-edge", (0, glass_y - 0.008, outer_glass_h / 2), (outer_glass_w, 0.028, 0.026), "mat_glass_edge", bevel=0.007)
    panel("front-glass-outer-bottom-edge", (0, glass_y - 0.008, -outer_glass_h / 2), (outer_glass_w, 0.028, 0.026), "mat_glass_edge", bevel=0.007)
    panel("front-glass-outer-left-edge", (-outer_glass_w / 2, glass_y - 0.008, 0), (0.026, 0.028, outer_glass_h), "mat_glass_edge", bevel=0.007)
    panel("front-glass-outer-right-edge", (outer_glass_w / 2, glass_y - 0.008, 0), (0.026, 0.028, outer_glass_h), "mat_glass_edge", bevel=0.007)

    slots: list[dict] = []
    for index, (slot_x, slot_z) in enumerate(SLOT_CENTERS):
        slot = add_empty(f"slot-{index}", (slot_x, 0, slot_z), parent=root)
        slots.append({"name": slot.name, "center": [slot_x, 0, slot_z], "tier": TROPHY_TIERS[index]})

        prefix = f"slot-{index}"
        left_x = slot_x - INNER_W / 2
        right_x = slot_x + INNER_W / 2
        bottom_z = slot_z - INNER_H / 2
        top_z = slot_z + INNER_H / 2

        panel(f"{prefix}.back-panel", (slot_x, BACK_Y - PANEL / 2, slot_z), (INNER_W, PANEL, INNER_H), "mat_cherry_interior", bevel=0.014, tile_scale=1.45)
        panel(f"{prefix}.floor-panel", (slot_x, 0, bottom_z + PANEL / 2), (INNER_W, DEPTH, PANEL), "mat_dark_floor", bevel=0.014, tile_scale=1.25)
        panel(f"{prefix}.ceiling-panel", (slot_x, 0, top_z - PANEL / 2), (INNER_W, DEPTH, PANEL), "mat_cherry_interior", bevel=0.014, tile_scale=1.25)
        panel(f"{prefix}.left-panel", (left_x + PANEL / 2, 0, slot_z), (PANEL, DEPTH, INNER_H), "mat_cherry_interior", bevel=0.014, tile_scale=1.2)
        panel(f"{prefix}.right-panel", (right_x - PANEL / 2, 0, slot_z), (PANEL, DEPTH, INNER_H), "mat_right_wall_dark", bevel=0.014, tile_scale=1.45)

        # V3 baked-visual occlusion geometry. These thin matte overlays are
        # intentional: they pin the side walls and floor into the cabinet volume
        # so PlayCanvas realtime lighting no longer has to invent contact AO.
        add_ao_strip(f"{prefix}.ao-back-floor", (slot_x, BACK_Y - PANEL - 0.014, bottom_z + 0.060), (INNER_W - 0.10, 0.014, 0.105), materials["mat_corner_shadow"], root)
        add_ao_strip(f"{prefix}.ao-left-floor", (left_x + PANEL + 0.014, 0.02, bottom_z + 0.060), (0.028, DEPTH - 0.12, 0.105), materials["mat_corner_shadow"], root)
        add_ao_strip(f"{prefix}.ao-right-floor", (right_x - PANEL - 0.014, 0.02, bottom_z + 0.060), (0.032, DEPTH - 0.12, 0.115), materials["mat_corner_shadow"], root)
        add_ao_strip(f"{prefix}.ao-back-right-corner", (right_x - PANEL - 0.016, BACK_Y - PANEL - 0.018, slot_z), (0.032, 0.016, INNER_H - 0.20), materials["mat_corner_shadow"], root)
        add_ao_strip(f"{prefix}.ao-back-left-corner", (left_x + PANEL + 0.014, BACK_Y - PANEL - 0.018, slot_z), (0.028, 0.016, INNER_H - 0.24), materials["mat_corner_shadow"], root)
        add_ao_strip(f"{prefix}.ao-ceiling-back", (slot_x, BACK_Y - PANEL - 0.015, top_z - PANEL - 0.070), (INNER_W - 0.15, 0.014, 0.085), materials["mat_corner_shadow"], root)

        panel(f"{prefix}.light-housing", (slot_x, FRONT_Y + 0.36, top_z - 0.105), (0.98, 0.30, 0.072), "mat_black_lacquer_trim", bevel=0.018, tile_scale=0.5)
        panel(f"{prefix}.light-diffuser", (slot_x, FRONT_Y + 0.36, top_z - 0.147), (0.76, 0.22, 0.018), "mat_light_diffuser", bevel=0.010, tile_scale=0.45)
        panel(f"{prefix}.light-brass-lip", (slot_x, FRONT_Y + 0.195, top_z - 0.106), (1.04, 0.035, 0.026), "mat_brass_trim", bevel=0.007, tile_scale=0.2)
        panel(f"{prefix}.light-baffle-back", (slot_x, FRONT_Y + 0.515, top_z - 0.134), (1.02, 0.035, 0.092), "mat_black_lacquer_trim", bevel=0.008, tile_scale=0.20)
        panel(f"{prefix}.light-baffle-right", (slot_x + 0.525, FRONT_Y + 0.36, top_z - 0.132), (0.035, 0.30, 0.085), "mat_black_lacquer_trim", bevel=0.006, tile_scale=0.16)

        # Back-wall collectible card frame.
        card_x = slot_x - 0.25
        card_z = slot_z + 0.25
        card_y = BACK_Y - 0.128
        panel(f"{prefix}.card-frame-top", (card_x, card_y, card_z + 0.445), (1.62, 0.030, 0.045), "mat_card_frame", bevel=0.010, tile_scale=0.25)
        panel(f"{prefix}.card-frame-bottom", (card_x, card_y, card_z - 0.445), (1.62, 0.030, 0.045), "mat_card_frame", bevel=0.010, tile_scale=0.25)
        panel(f"{prefix}.card-frame-left", (card_x - 0.81, card_y, card_z), (0.045, 0.030, 0.89), "mat_card_frame", bevel=0.010, tile_scale=0.25)
        panel(f"{prefix}.card-frame-right", (card_x + 0.81, card_y, card_z), (0.045, 0.030, 0.89), "mat_card_frame", bevel=0.010, tile_scale=0.25)
        panel(f"{prefix}.card-brass-name-lip", (card_x - 0.43, card_y - 0.018, card_z + 0.39), (0.74, 0.018, 0.030), "mat_brass_trim", bevel=0.004, tile_scale=0.16)

        # Slot glass remains as a nearly invisible material layer. The visible
        # rails live only on the full 2x2 outer door to avoid decorative clutter.
        glass_w = INNER_W - GLASS_MARGIN_X * 2
        glass_h = INNER_H - GLASS_MARGIN_Z * 2
        glass_left = slot_x - glass_w / 2
        glass_top = slot_z + glass_h / 2
        panel(f"{prefix}.front-glass-pane", (slot_x, glass_y, slot_z), (glass_w, 0.010, glass_h), "mat_glass_pane", bevel=0.006, tile_scale=0.2)

        # In-cabinet Matrix-style LCD plaque. It is deliberately aligned to the
        # visible top-left datum of each slot, with a thin frame so the green
        # screen reads as a cabinet label instead of a second heavy card.
        plaque_x = left_x + 0.070 + PLAQUE_W / 2
        plaque_z = top_z - 0.205 - PLAQUE_H / 2
        panel(f"{prefix}.plaque-body", (plaque_x, glass_y - 0.030, plaque_z), (PLAQUE_W, 0.026, PLAQUE_H), "mat_black_lacquer_trim", bevel=0.007, tile_scale=0.16)
        panel(f"{prefix}.plaque-screen", (plaque_x, glass_y - 0.048, plaque_z), (PLAQUE_W - 0.036, 0.010, PLAQUE_H - 0.036), "mat_plaque_lcd", bevel=0.004, tile_scale=0.205)

        add_empty(f"{prefix}.hero-anchor", (-0.25, BACK_Y - 0.155, 0.25), parent=slot)
        add_empty(f"{prefix}.trophy-anchor", (0.52, FRONT_Y + 0.37, -INNER_H / 2 + 0.35), parent=slot)
        add_empty(f"{prefix}.glass-anchor", (0, glass_y, 0), parent=slot)
        add_empty(f"{prefix}.light-anchor", (0, FRONT_Y + 0.36, INNER_H / 2 - 0.14), parent=slot)
        add_empty(f"{prefix}.nameplate-anchor", (plaque_x - slot_x, glass_y - 0.064, plaque_z - slot_z), parent=slot)
        add_empty(f"{prefix}.plaque-anchor", (plaque_x - slot_x, glass_y - 0.064, plaque_z - slot_z), parent=slot)
        add_empty(f"{prefix}.card-frame-anchor", (-0.25, BACK_Y - 0.155, 0.25), parent=slot)
        add_empty(f"{prefix}.rim-light-anchor", (0.35, FRONT_Y + 0.31, -INNER_H / 2 + 0.88), parent=slot)

        add_trophy(prefix, slot, TROPHY_TIERS[index], materials)

    return {
        "version": "v3",
        "width": WIDTH,
        "height": HEIGHT,
        "depth": DEPTH,
        "innerSlotWidth": INNER_W,
        "innerSlotHeight": INNER_H,
        "frontY": FRONT_Y,
        "backY": BACK_Y,
        "meshCount": len([obj for obj in bpy.context.scene.objects if obj.type == "MESH"]),
        "slotCount": len(slots),
        "materials": sorted(MATERIALS),
        "slots": slots,
    }


def export_glb() -> None:
    OUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )


def triangle_count() -> int:
    total = 0
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        total += sum(max(0, len(poly.vertices) - 2) for poly in obj.data.polygons)
    return total


def main() -> None:
    clear_scene()
    report = build_cabinet()
    report["triangles"] = triangle_count()
    export_glb()
    report["glb"] = str(OUT_GLB.relative_to(ROOT))
    report["glbBytes"] = OUT_GLB.stat().st_size
    report["passed"] = True
    OUT_REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
