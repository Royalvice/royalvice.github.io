"""Package generated backgrounds at a consistent, pixel-friendly display size."""
from pathlib import Path
from PIL import Image, ImageDraw
import json

root = Path(__file__).resolve().parents[1]
review = root / 'artifacts/anywhere-door-v2'
output = root / 'public/assets/profile/anywhere-door-v2'
output.mkdir(parents=True, exist_ok=True)
generation = json.loads((review / 'generation.json').read_text())
scenes = generation['scenes']
assert len(scenes) == 15 and len({s['id'] for s in scenes}) == 15
sheet = Image.new('RGB', (1000, 900), '#111c19')
draw = ImageDraw.Draw(sheet)
manifest = []
for i, scene in enumerate(scenes):
    original = Image.open(scene['source']).convert('RGB')
    # No semantic edits: only loss-controlled resizing and web texture encoding.
    image = original.resize((384, 768), Image.Resampling.LANCZOS)
    image.save(output / (scene['id'] + '.webp'), quality=92, method=6)
    x, y = i % 5 * 200 + 30, i // 5 * 300
    sheet.paste(original.resize((135, 270), Image.Resampling.LANCZOS), (x, y))
    draw.text((x, y + 276), str(i + 1).zfill(2) + ' ' + scene['id'], fill='#e7d8ab')
    manifest.append({'id': scene['id'], 'name': scene['name'],
                     'url': '/assets/profile/anywhere-door-v2/' + scene['id'] + '.webp',
                     'focusX': {'lantern': .72, 'aurora': .25, 'wisteria': .35, 'oceanmoon': .85}.get(scene['id'], .5)})
(output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
sheet.save(review / 'contact-sheet.jpg', quality=94)
print('Packaged 15 destinations:', sum(p.stat().st_size for p in output.glob('*.webp')), 'bytes')
