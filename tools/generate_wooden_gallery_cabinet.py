from __future__ import annotations

import json
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
OUT_GLB = ROOT / "public/assets/gallery/models/wooden-gallery-cabinet.glb"
OUT_REPORT = ROOT / "public/assets/gallery/models/wooden-gallery-cabinet.report.json"

WIDTH = 5.2
HEIGHT = 4.65
DEPTH = 1.05
FRAME = 0.18
DIVIDER = 0.12
PANEL = 0.08
BEVEL = 0.025

INNER_W = (WIDTH - 2 * FRAME - DIVIDER) / 2
INNER_H = (HEIGHT - 2 * FRAME - DIVIDER) / 2
FRONT_Y = -DEPTH / 2
BACK_Y = DEPTH / 2

SLOT_CENTERS = [
    (-DIVIDER / 2 - INNER_W / 2, DIVIDER / 2 + INNER_H / 2),
    (DIVIDER / 2 + INNER_W / 2, DIVIDER / 2 + INNER_H / 2),
    (-DIVIDER / 2 - INNER_W / 2, -DIVIDER / 2 - INNER_H / 2),
    (DIVIDER / 2 + INNER_W / 2, -DIVIDER / 2 - INNER_H / 2),
]

MATERIALS = {
    "mat_dark_walnut_frame": (0.22, 0.105, 0.045, 1.0),
    "mat_warm_wood_interior": (0.58, 0.36, 0.18, 1.0),
    "mat_black_lacquer_trim": (0.012, 0.011, 0.01, 1.0),
    "mat_brass_trim": (0.82, 0.55, 0.24, 1.0),
    "mat_light_diffuser": (1.0, 0.86, 0.58, 1.0),
    "mat_glass_edge": (0.65, 0.9, 1.0, 0.28),
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
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = 0.38 if "lacquer" in name else 0.52
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = 1.0 if "brass" in name else 0.0
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = color[3]
        if "Emission Strength" in bsdf.inputs and "light" in name:
            bsdf.inputs["Emission Strength"].default_value = 1.2
    material.diffuse_color = color
    if color[3] < 1:
        material.blend_method = "BLEND"
        material.use_screen_refraction = True
    return material


def apply_modifier(obj: bpy.types.Object, name: str) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=name)


def assign_box_uvs(obj: bpy.types.Object, tile_scale: float = 1.0) -> None:
    mesh = obj.data
    while mesh.uv_layers:
        mesh.uv_layers.remove(mesh.uv_layers[0])
    uv0 = mesh.uv_layers.new(name="UVMap")
    uv1 = mesh.uv_layers.new(name="LightmapUV")

    coords = [v.co.copy() for v in mesh.vertices]
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
            uv0.data[loop_index].uv = (u, v)
            uv1.data[loop_index].uv = (
                (co.x - min_co.x) / span.x,
                (co.z - min_co.z) / span.z if ax != 2 else (co.y - min_co.y) / span.y,
            )


def add_panel(
    name: str,
    center: tuple[float, float, float],
    size: tuple[float, float, float],
    material: bpy.types.Material,
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

    if bevel > 0:
        bevel_mod = obj.modifiers.new("cabinet_edge_bevel", "BEVEL")
        bevel_mod.width = bevel
        bevel_mod.segments = 3
        bevel_mod.affect = "EDGES"
        apply_modifier(obj, bevel_mod.name)

    normal_mod = obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    normal_mod.keep_sharp = True
    apply_modifier(obj, normal_mod.name)

    assign_box_uvs(obj, tile_scale)
    return obj


def add_empty(name: str, location: tuple[float, float, float], parent: bpy.types.Object | None = None) -> bpy.types.Object:
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 0.08
    bpy.context.collection.objects.link(empty)
    empty.parent = parent
    empty.location = location
    return empty


def build_cabinet() -> dict:
    materials = {name: create_material(name, color) for name, color in MATERIALS.items()}
    root = add_empty("cabinet-root", (0, 0, 0))

    panels: list[bpy.types.Object] = []

    def panel(name: str, center, size, material_name: str, bevel: float = BEVEL, tile_scale: float = 1.0):
        obj = add_panel(name, center, size, materials[material_name], bevel=bevel, tile_scale=tile_scale)
        obj.parent = root
        panels.append(obj)
        return obj

    # Continuous furniture frame.
    panel("outer-frame-left", (-WIDTH / 2 + FRAME / 2, 0, 0), (FRAME, DEPTH, HEIGHT), "mat_dark_walnut_frame")
    panel("outer-frame-right", (WIDTH / 2 - FRAME / 2, 0, 0), (FRAME, DEPTH, HEIGHT), "mat_dark_walnut_frame")
    panel("outer-frame-top", (0, 0, HEIGHT / 2 - FRAME / 2), (WIDTH, DEPTH, FRAME), "mat_dark_walnut_frame")
    panel("outer-frame-bottom", (0, 0, -HEIGHT / 2 + FRAME / 2), (WIDTH, DEPTH, FRAME), "mat_dark_walnut_frame")
    panel("divider-vertical", (0, 0, 0), (DIVIDER, DEPTH, HEIGHT - 2 * FRAME), "mat_dark_walnut_frame")
    panel("divider-horizontal", (0, 0, 0), (WIDTH - 2 * FRAME, DEPTH, DIVIDER), "mat_dark_walnut_frame")

    # Thin brass highlight lines on the front plane.
    brass_y = FRONT_Y - 0.045
    panel("brass-outer-top", (0, brass_y, HEIGHT / 2 - 0.032), (WIDTH, 0.018, 0.018), "mat_brass_trim", bevel=0.006)
    panel("brass-outer-bottom", (0, brass_y, -HEIGHT / 2 + 0.032), (WIDTH, 0.018, 0.018), "mat_brass_trim", bevel=0.006)
    panel("brass-outer-left", (-WIDTH / 2 + 0.032, brass_y, 0), (0.018, 0.018, HEIGHT), "mat_brass_trim", bevel=0.006)
    panel("brass-outer-right", (WIDTH / 2 - 0.032, brass_y, 0), (0.018, 0.018, HEIGHT), "mat_brass_trim", bevel=0.006)
    panel("brass-divider-vertical", (0, brass_y - 0.002, 0), (0.015, 0.016, HEIGHT - 2 * FRAME), "mat_brass_trim", bevel=0.005)
    panel("brass-divider-horizontal", (0, brass_y - 0.003, 0), (WIDTH - 2 * FRAME, 0.016, 0.015), "mat_brass_trim", bevel=0.005)

    slots: list[dict] = []
    for index, (slot_x, slot_z) in enumerate(SLOT_CENTERS):
        slot = add_empty(f"slot-{index}", (slot_x, 0, slot_z), parent=root)
        slots.append({"name": slot.name, "center": [slot_x, 0, slot_z]})

        prefix = f"slot-{index}"
        left_x = slot_x - INNER_W / 2
        right_x = slot_x + INNER_W / 2
        bottom_z = slot_z - INNER_H / 2
        top_z = slot_z + INNER_H / 2

        panel(f"{prefix}.back-panel", (slot_x, BACK_Y - PANEL / 2, slot_z), (INNER_W, PANEL, INNER_H), "mat_warm_wood_interior", bevel=0.012, tile_scale=1.25)
        panel(f"{prefix}.floor-panel", (slot_x, 0, bottom_z + PANEL / 2), (INNER_W, DEPTH, PANEL), "mat_warm_wood_interior", bevel=0.012, tile_scale=1.1)
        panel(f"{prefix}.ceiling-panel", (slot_x, 0, top_z - PANEL / 2), (INNER_W, DEPTH, PANEL), "mat_warm_wood_interior", bevel=0.012, tile_scale=1.1)
        panel(f"{prefix}.left-panel", (left_x + PANEL / 2, 0, slot_z), (PANEL, DEPTH, INNER_H), "mat_warm_wood_interior", bevel=0.012, tile_scale=1.1)
        panel(f"{prefix}.right-panel", (right_x - PANEL / 2, 0, slot_z), (PANEL, DEPTH, INNER_H), "mat_warm_wood_interior", bevel=0.012, tile_scale=1.1)
        panel(f"{prefix}.light-housing", (slot_x, FRONT_Y + 0.38, top_z - 0.09), (0.86, 0.25, 0.055), "mat_black_lacquer_trim", bevel=0.014, tile_scale=0.7)
        panel(f"{prefix}.light-diffuser", (slot_x, FRONT_Y + 0.38, top_z - 0.122), (0.68, 0.19, 0.012), "mat_light_diffuser", bevel=0.008, tile_scale=0.6)
        panel(f"{prefix}.front-glass-top-edge", (slot_x, FRONT_Y - 0.035, top_z - 0.04), (INNER_W * 0.86, 0.018, 0.018), "mat_glass_edge", bevel=0.004)
        panel(f"{prefix}.front-glass-bottom-edge", (slot_x, FRONT_Y - 0.035, bottom_z + 0.04), (INNER_W * 0.86, 0.018, 0.018), "mat_glass_edge", bevel=0.004)
        panel(f"{prefix}.front-glass-left-edge", (left_x + 0.04, FRONT_Y - 0.035, slot_z), (0.018, 0.018, INNER_H * 0.86), "mat_glass_edge", bevel=0.004)
        panel(f"{prefix}.front-glass-right-edge", (right_x - 0.04, FRONT_Y - 0.035, slot_z), (0.018, 0.018, INNER_H * 0.86), "mat_glass_edge", bevel=0.004)

        add_empty(f"{prefix}.hero-anchor", (-0.22, BACK_Y - 0.105, 0.24), parent=slot)
        add_empty(f"{prefix}.trophy-anchor", (0.48, FRONT_Y + 0.34, -INNER_H / 2 + 0.34), parent=slot)
        add_empty(f"{prefix}.glass-anchor", (0, FRONT_Y - 0.055, 0), parent=slot)
        add_empty(f"{prefix}.light-anchor", (0, FRONT_Y + 0.38, INNER_H / 2 - 0.11), parent=slot)
        add_empty(f"{prefix}.nameplate-anchor", (-INNER_W / 2 + 0.42, FRONT_Y - 0.075, INNER_H / 2 - 0.2), parent=slot)

    return {
        "width": WIDTH,
        "height": HEIGHT,
        "depth": DEPTH,
        "innerSlotWidth": INNER_W,
        "innerSlotHeight": INNER_H,
        "frontY": FRONT_Y,
        "backY": BACK_Y,
        "meshCount": len(panels),
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
