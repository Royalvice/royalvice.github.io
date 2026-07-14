from __future__ import annotations

from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "assets" / "gallery" / "models" / "cbox" / "CornellBox.source.glb"
OUT = ROOT / "public" / "assets" / "gallery" / "models" / "cbox" / "CornellBox.normalized.glb"


TARGET_WIDTH = 2.52
TARGET_DEPTH = 1.36
TARGET_HEIGHT = 2.34


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def bounds_of(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    world = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    lo = Vector((min(v.x for v in world), min(v.y for v in world), min(v.z for v in world)))
    hi = Vector((max(v.x for v in world), max(v.y for v in world), max(v.z for v in world)))
    return lo, hi


def recenter_and_scale_box(obj: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    lo, hi = bounds_of(obj)
    size = hi - lo
    scale = Vector((TARGET_WIDTH / size.x, TARGET_DEPTH / size.y, TARGET_HEIGHT / size.z))
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    lo, hi = bounds_of(obj)
    center = (lo + hi) * 0.5
    obj.location -= center
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    obj.name = "cbox-shell"
    obj.data.name = "cbox-shell.mesh"

    bevel = obj.modifiers.new("source_edge_normal_cleanup", "WEIGHTED_NORMAL")
    bevel.keep_sharp = True


def empty(name: str, loc: tuple[float, float, float], parent: bpy.types.Object | None = None) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type = "CUBE"
    obj.empty_display_size = 0.08
    obj.location = loc
    obj.parent = parent
    return obj


def add_anchor_nodes(parent: bpy.types.Object) -> None:
    # Blender coordinates export to glTF/PlayCanvas with Y-up conversion; the runtime
    # still uses these named anchors as stable semantic sockets, not exact layout truth.
    empty("hero-anchor", (0.0, TARGET_DEPTH * 0.5 - 0.035, 0.25), parent)
    empty("trophy-anchor", (0.58, -TARGET_DEPTH * 0.22, -TARGET_HEIGHT * 0.5 + 0.18), parent)
    empty("glass-anchor", (0.0, -TARGET_DEPTH * 0.5 - 0.025, 0.0), parent)
    empty("top-light-anchor", (0.0, 0.0, TARGET_HEIGHT * 0.5 - 0.08), parent)
    empty("nameplate-anchor", (-TARGET_WIDTH * 0.48, -TARGET_DEPTH * 0.55, TARGET_HEIGHT * 0.5 + 0.08), parent)


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing source asset: {SOURCE}")

    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))

    shell = bpy.data.objects.get("cornell.box")
    if shell is None:
        shell = bpy.data.objects.get("cornell_box")
    if shell is None:
        raise RuntimeError("Could not find cornell.box mesh in source GLB.")

    for obj in list(bpy.context.scene.objects):
        if obj != shell:
            bpy.data.objects.remove(obj, do_unlink=True)

    root = empty("cbox-root", (0.0, 0.0, 0.0), None)
    shell.parent = root
    recenter_and_scale_box(shell)
    add_anchor_nodes(root)

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
    print(f"exported {OUT}")


if __name__ == "__main__":
    main()
