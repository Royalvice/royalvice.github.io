#!/usr/bin/env python3
"""Create screen-space LOD GLBs for the cabinet trophies and Voyage fleet.

These models are always viewed at a controlled distance.  The source GLBs
remain untouched; this script writes adjacent `v3-lod` files so runtime can
fall back safely while preserving the authored WebP textures and materials.

Run with Blender 4.2+:
  /Applications/Blender\ 4.2\ LTS.app/Contents/MacOS/Blender --background \
    --python tools/build-webgl-scene-lods.py -- --all --force
"""

from __future__ import annotations

import argparse
import sys
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import bpy


ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class LodJob:
    name: str
    source: Path
    destination: Path
    ratio: float


GALLERY_DIR = ROOT / "public/assets/gallery/models/generated"
VOYAGE_DIR = ROOT / "public/assets/voyage/models"

JOBS = (
    LodJob("trophy-ssat", GALLERY_DIR / "trophy-ssat-v2-perf.glb", GALLERY_DIR / "trophy-ssat-v3-lod.glb", 0.35),
    LodJob("trophy-directl", GALLERY_DIR / "trophy-directl-v2-perf.glb", GALLERY_DIR / "trophy-directl-v3-lod.glb", 0.35),
    LodJob("trophy-eva01", GALLERY_DIR / "trophy-eva01-v2-perf.glb", GALLERY_DIR / "trophy-eva01-v3-lod.glb", 0.35),
    LodJob("trophy-docdiff", GALLERY_DIR / "trophy-docdiff-v2-perf.glb", GALLERY_DIR / "trophy-docdiff-v3-lod.glb", 0.35),
    LodJob("voyage-boat", VOYAGE_DIR / "research-boat-v2.glb", VOYAGE_DIR / "research-boat-v3-lod.glb", 0.40),
    LodJob("voyage-dock", VOYAGE_DIR / "landmarks/v2/dock.glb", VOYAGE_DIR / "landmarks/v3/dock.glb", 0.35),
    LodJob("voyage-prism", VOYAGE_DIR / "landmarks/v2/prism.glb", VOYAGE_DIR / "landmarks/v3/prism.glb", 0.35),
    LodJob("voyage-lighthouse", VOYAGE_DIR / "landmarks/v2/lighthouse.glb", VOYAGE_DIR / "landmarks/v3/lighthouse.glb", 0.35),
    LodJob("voyage-harbor", VOYAGE_DIR / "landmarks/v2/harbor.glb", VOYAGE_DIR / "landmarks/v3/harbor.glb", 0.35),
    LodJob("voyage-gate", VOYAGE_DIR / "landmarks/v2/gate.glb", VOYAGE_DIR / "landmarks/v3/gate.glb", 0.35),
)


def parsed_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all", action="store_true", help="Build every listed LOD.")
    parser.add_argument("--only", action="append", default=[], help="Build one named job (repeatable).")
    parser.add_argument("--force", action="store_true", help="Allow replacing an already generated LOD.")
    cli_args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(cli_args)


def triangles(objects: Iterable[bpy.types.Object]) -> int:
    return sum(len(mesh.data.polygons) for mesh in objects if mesh.type == "MESH")


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def optimize_meshes(objects: list[bpy.types.Object], ratio: float) -> None:
    for mesh in objects:
        bpy.context.view_layer.objects.active = mesh
        mesh.select_set(True)
        modifier = mesh.modifiers.new(name="webgl-screen-space-lod", type="DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        mesh.select_set(False)


def export_glb(destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(destination),
        export_format="GLB",
        export_image_format="WEBP",
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_yup=True,
        export_apply=False,
        export_extras=True,
        export_attributes=True,
        # Attribute quantization is applied afterward with glTF-Transform.
        # Keeping the browser payload decoder-free avoids introducing a
        # foreground Draco worker during the first interactive frame.
        export_draco_mesh_compression_enable=False,
    )


def quantize_glb(source: Path, destination: Path) -> None:
    command = [
        "npx", "-y", "@gltf-transform/cli", "quantize", str(source), str(destination),
        "--quantize-position", "14",
        "--quantize-normal", "10",
        "--quantize-texcoord", "12",
        "--quantize-color", "8",
        "--quantize-generic", "12",
    ]
    subprocess.run(command, check=True)


def build(job: LodJob, force: bool) -> None:
    if not job.source.is_file():
        raise FileNotFoundError(job.source)
    if job.destination.exists() and not force:
        print(f"SKIP {job.name}: destination already exists ({job.destination})")
        return
    clean_scene()
    bpy.ops.import_scene.gltf(filepath=str(job.source))
    meshes = [object_ for object_ in bpy.context.scene.objects if object_.type == "MESH"]
    before = triangles(meshes)
    if not meshes or before <= 0:
        raise RuntimeError(f"{job.name} did not import any drawable meshes")
    optimize_meshes(meshes, job.ratio)
    after = triangles(meshes)
    raw_destination = job.destination.with_suffix(".raw.glb")
    if raw_destination.exists():
        raw_destination.unlink()
    export_glb(raw_destination)
    quantize_glb(raw_destination, job.destination)
    raw_destination.unlink()
    print(
        f"BUILT {job.name}: triangles {before:,} -> {after:,} "
        f"({after / before:.1%}), {job.destination.stat().st_size / 1024:.1f} KiB"
    )


def main() -> None:
    args = parsed_arguments()
    selected_names = set(args.only)
    if not args.all and not selected_names:
        raise SystemExit("Choose --all or at least one --only JOB. Available: " + ", ".join(job.name for job in JOBS))
    unknown = selected_names - {job.name for job in JOBS}
    if unknown:
        raise SystemExit("Unknown job(s): " + ", ".join(sorted(unknown)))
    selected = JOBS if args.all else tuple(job for job in JOBS if job.name in selected_names)
    for job in selected:
        build(job, args.force)


if __name__ == "__main__":
    main()
