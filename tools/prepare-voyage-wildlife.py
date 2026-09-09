"""Optimize licensed GLBs without changing geometry, skins, or animation tracks.

Usage: python3 tools/prepare-voyage-wildlife.py SOURCE_GLB DESTINATION_GLB
Requires Pillow. Texture images keep their original UVs and color-space semantics.
"""
import io
import json
import struct
import sys
from pathlib import Path
from PIL import Image


def optimize(source: Path, destination: Path):
    data = source.read_bytes()
    json_size = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20 + json_size])
    binary = data[28 + json_size:]
    color_images = set()
    for material in document.get('materials', []):
        texture = material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if texture:
            color_images.add(document['textures'][texture['index']]['source'])
    replacements = {}
    for index, image in enumerate(document.get('images', [])):
        view = document['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        original = binary[start:start + view['byteLength']]
        decoded = Image.open(io.BytesIO(original))
        decoded.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        if index in color_images and decoded.mode == 'RGB':
            decoded.save(output, format='JPEG', quality=92, subsampling=0, optimize=True)
            image['mimeType'] = 'image/jpeg'
        else:
            decoded.save(output, format='PNG', optimize=True)
            image['mimeType'] = 'image/png'
        replacements[image['bufferView']] = output.getvalue()
    packed = bytearray()
    for index, view in enumerate(document['bufferViews']):
        packed.extend(b'\0' * (-len(packed) % 4))
        start = view.get('byteOffset', 0)
        chunk = replacements.get(index, binary[start:start + view['byteLength']])
        view['byteOffset'] = len(packed)
        view['byteLength'] = len(chunk)
        packed.extend(chunk)
    packed.extend(b'\0' * (-len(packed) % 4))
    document['buffers'][0]['byteLength'] = len(packed)
    metadata = json.dumps(document, separators=(',', ':')).encode()
    metadata += b' ' * (-len(metadata) % 4)
    result = struct.pack('<III', 0x46546c67, 2, 28 + len(metadata) + len(packed))
    result += struct.pack('<II', len(metadata), 0x4e4f534a) + metadata
    result += struct.pack('<II', len(packed), 0x004e4942) + packed
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(result)
    print(f'{destination.name}: {len(data):,} -> {len(result):,} bytes')


if __name__ == '__main__':
    optimize(Path(sys.argv[1]), Path(sys.argv[2]))
