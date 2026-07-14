from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GLB = ROOT / "public/assets/gallery/models/wooden-gallery-cabinet-v3.glb"
REPORT = ROOT / "public/assets/gallery/models/wooden-gallery-cabinet-v3.validation.json"
SOURCE_REPORT = ROOT / "public/assets/gallery/models/wooden-gallery-cabinet-v3.report.json"
BLENDER = Path("/Applications/Blender 4.2 LTS.app/Contents/MacOS/Blender")

REQUIRED_MATERIALS = [
    "mat_walnut_outer",
    "mat_cherry_interior",
    "mat_right_wall_dark",
    "mat_dark_floor",
    "mat_corner_shadow",
    "mat_black_lacquer_trim",
    "mat_brass_trim",
    "mat_light_diffuser",
    "mat_glass_edge",
    "mat_glass_pane",
    "mat_card_frame",
    "mat_plaque_lcd",
    "mat_obsidian_plinth",
    "mat_legendary_holo",
    "mat_gold_trophy",
    "mat_silver_trophy",
    "mat_blue_crystal",
    "mat_soft_shadow",
]

REQUIRED_NODES = ["cabinet-root"] + [
    f"slot-{i}" for i in range(4)
] + [
    f"slot-{i}.{anchor}"
    for i in range(4)
    for anchor in (
        "hero-anchor",
        "trophy-anchor",
        "glass-anchor",
        "light-anchor",
        "nameplate-anchor",
        "plaque-anchor",
        "card-frame-anchor",
        "rim-light-anchor",
    )
]


BLENDER_VALIDATOR = r"""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

required_nodes = json.loads(sys.argv[-4])
glb = Path(sys.argv[-3])
out = Path(sys.argv[-2])
required_materials = json.loads(sys.argv[-1])

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=str(glb))

objects = list(bpy.context.scene.objects)
nodes = {obj.name for obj in objects}
materials = {mat.name for mat in bpy.data.materials}
mesh_objects = [obj for obj in objects if obj.type == "MESH"]

triangles = 0
uv0_failures = []
uv1_failures = []
negative_scale = []
empty_anchors = []
verts = []

for obj in mesh_objects:
    triangles += sum(max(0, len(poly.vertices) - 2) for poly in obj.data.polygons)
    if len(obj.data.uv_layers) < 1:
        uv0_failures.append(obj.name)
    if len(obj.data.uv_layers) < 2:
        uv1_failures.append(obj.name)
    if obj.scale.x < 0 or obj.scale.y < 0 or obj.scale.z < 0:
        negative_scale.append(obj.name)
    for corner in obj.bound_box:
        verts.append(obj.matrix_world @ Vector(corner))

for node in required_nodes:
    obj = bpy.data.objects.get(node)
    if obj is not None and obj.type == "EMPTY" and obj.empty_display_size <= 0:
        empty_anchors.append(node)

if verts:
    min_v = Vector((min(v.x for v in verts), min(v.y for v in verts), min(v.z for v in verts)))
    max_v = Vector((max(v.x for v in verts), max(v.y for v in verts), max(v.z for v in verts)))
    dims = max_v - min_v
    sorted_dims = sorted([dims.x, dims.y, dims.z], reverse=True)
else:
    dims = Vector((0, 0, 0))
    sorted_dims = [0, 0, 0]

missing_nodes = [name for name in required_nodes if name not in nodes]
missing_materials = [name for name in required_materials if name not in materials]

issues = []
if not mesh_objects:
    issues.append("no mesh objects")
if missing_nodes:
    issues.append("missing nodes: " + ", ".join(missing_nodes))
if missing_materials:
    issues.append("missing materials: " + ", ".join(missing_materials))
if uv0_failures:
    issues.append("meshes without UV0: " + ", ".join(uv0_failures[:10]))
if uv1_failures:
    issues.append("meshes without UV1: " + ", ".join(uv1_failures[:10]))
if negative_scale:
    issues.append("negative scale objects: " + ", ".join(negative_scale[:10]))
if triangles >= 120000:
    issues.append(f"triangles {triangles} >= 120000")
if glb.stat().st_size >= 20 * 1024 * 1024:
    issues.append(f"glb size {glb.stat().st_size} >= 20MB")
if not (5.35 <= sorted_dims[0] <= 5.85 and 4.55 <= sorted_dims[1] <= 5.05 and 1.05 <= sorted_dims[2] <= 1.45):
    issues.append(f"unexpected bbox sorted dims: {sorted_dims}")

report = {
    "cabinetVersion": "v3",
    "glb": str(glb),
    "glbBytes": glb.stat().st_size,
    "nodeCount": len(objects),
    "meshCount": len(mesh_objects),
    "materialCount": len(materials),
    "materials": sorted(materials),
    "missingNodes": missing_nodes,
    "missingMaterials": missing_materials,
    "uv0Failures": uv0_failures,
    "uv1Failures": uv1_failures,
    "negativeScale": negative_scale,
    "emptyAnchorWarnings": empty_anchors,
    "bbox": {
        "x": dims.x,
        "y": dims.y,
        "z": dims.z,
        "sorted": sorted_dims,
    },
    "triangles": triangles,
    "issues": issues,
    "passed": not issues,
}
out.write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
sys.exit(0 if report["passed"] else 1)
"""


def main() -> None:
    if not BLENDER.exists():
        raise SystemExit(f"Blender not found: {BLENDER}")
    if not GLB.exists():
        raise SystemExit(f"GLB not found: {GLB}")
    if SOURCE_REPORT.exists():
        source = json.loads(SOURCE_REPORT.read_text(encoding="utf-8"))
        if source.get("version") != "v3":
            raise SystemExit(f"Unexpected source report version: {source.get('version')}")

    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as tmp:
        tmp.write(BLENDER_VALIDATOR)
        tmp_path = Path(tmp.name)

    try:
        proc = subprocess.run(
            [
                str(BLENDER),
                "--background",
                "--python",
                str(tmp_path),
                "--",
                json.dumps(REQUIRED_NODES),
                str(GLB),
                str(REPORT),
                json.dumps(REQUIRED_MATERIALS),
            ],
            cwd=ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=180,
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    sys.stdout.write(proc.stdout)
    sys.stderr.write(proc.stderr)
    if proc.returncode != 0:
        raise SystemExit(proc.returncode)


if __name__ == "__main__":
    main()
