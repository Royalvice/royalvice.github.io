from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GLB = ROOT / "public/assets/gallery/models/wooden-gallery-cabinet.glb"
REPORT = ROOT / "public/assets/gallery/models/wooden-gallery-cabinet.report.json"
BLENDER = Path("/Applications/Blender 4.2 LTS.app/Contents/MacOS/Blender")

REQUIRED_MATERIALS = [
    "mat_dark_walnut_frame",
    "mat_warm_wood_interior",
    "mat_black_lacquer_trim",
    "mat_brass_trim",
    "mat_light_diffuser",
    "mat_glass_edge",
]

REQUIRED_NODES = ["cabinet-root"] + [
    f"slot-{i}" for i in range(4)
] + [
    f"slot-{i}.{anchor}"
    for i in range(4)
    for anchor in ("hero-anchor", "trophy-anchor", "glass-anchor", "light-anchor", "nameplate-anchor")
]


BLENDER_VALIDATOR = r"""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

glb = Path(sys.argv[-3])
out = Path(sys.argv[-2])
required_materials = json.loads(sys.argv[-1])
required_nodes = json.loads(sys.argv[-4])

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=str(glb))

objects = list(bpy.context.scene.objects)
nodes = {obj.name for obj in objects}
materials = {mat.name for mat in bpy.data.materials}
mesh_objects = [obj for obj in objects if obj.type == "MESH"]

triangles = 0
uv_failures = []
negative_scale = []
verts = []
for obj in mesh_objects:
    triangles += sum(max(0, len(poly.vertices) - 2) for poly in obj.data.polygons)
    if len(obj.data.uv_layers) < 1:
        uv_failures.append(obj.name)
    if obj.scale.x < 0 or obj.scale.y < 0 or obj.scale.z < 0:
        negative_scale.append(obj.name)
    for corner in obj.bound_box:
        verts.append(obj.matrix_world @ Vector(corner))

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
if uv_failures:
    issues.append("meshes without UV0: " + ", ".join(uv_failures[:8]))
if negative_scale:
    issues.append("negative scale objects: " + ", ".join(negative_scale[:8]))
if triangles >= 60000:
    issues.append(f"triangles {triangles} >= 60000")
if glb.stat().st_size >= 12 * 1024 * 1024:
    issues.append(f"glb size {glb.stat().st_size} >= 12MB")
if not (4.9 <= sorted_dims[0] <= 5.5 and 4.35 <= sorted_dims[1] <= 4.9 and 0.85 <= sorted_dims[2] <= 1.25):
    issues.append(f"unexpected bbox sorted dims: {sorted_dims}")

report = {
    "glb": str(glb),
    "glbBytes": glb.stat().st_size,
    "nodeCount": len(objects),
    "meshCount": len(mesh_objects),
    "materials": sorted(materials),
    "missingNodes": missing_nodes,
    "missingMaterials": missing_materials,
    "uvFailures": uv_failures,
    "negativeScale": negative_scale,
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
