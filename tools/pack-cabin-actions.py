"""Pack generated action sheets into aligned, transparent runtime clips.
Preserve source sheets and generation prompts for review; never modify v3.9.
"""
from pathlib import Path
import json, argparse
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
root=Path(__file__).resolve().parents[1]
src=root/'artifacts/dungeon-rebuild/generated';out=root/'public/assets/profile/dungeon-v5/actions';out.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('--actor');args=parser.parse_args()
manifest=json.loads((out/'manifest.json').read_text()) if args.actor else {};report=json.loads((root/'artifacts/dungeon-rebuild/action-pack-report.json').read_text()) if args.actor else []
if args.actor:report=[r for r in report if not r['clip'].startswith(args.actor+'/')]

for path in sorted(src.glob('*.png')):
 if args.actor and not path.name.startswith(args.actor+'-'):continue
 actor=path.name.split('-')[0];action=path.stem[len(actor)+1:]
 im=Image.open(path).convert('RGBA');a=np.array(im)
 # Some image outputs retain a chroma backdrop rather than an alpha channel.
 chroma=(a[:,:,0]>140)&(a[:,:,2]>140)&(a[:,:,1]<120)&(np.minimum(a[:,:,0],a[:,:,2])-a[:,:,1]>80)
 a[chroma,3]=0;a[a[:,:,3]<32,3]=0
 im=Image.fromarray(a)
 frames=[];bounds=[]
 for i in range(8):
  x0=round(i%4*im.width/4);x1=round((i%4+1)*im.width/4);y0=round(i//4*im.height/2);y1=round((i//4+1)*im.height/2)
  f=im.crop((x0,y0,x1,y1))
  # Isolate the central character, rejecting neighbouring-frame fragments.
  mask=f.getchannel('A').point(lambda v:255 if v>64 else 0).filter(ImageFilter.MaxFilter(3))
  arr=np.array(mask);ys,xs=np.where(arr>0)
  if not len(xs):raise ValueError(f'Empty frame: {path} / {i}')
  nearest=np.argmin((xs-f.width*.5)**2+(ys-f.height*.60)**2)
  ImageDraw.floodfill(mask,(int(xs[nearest]),int(ys[nearest])),128,thresh=0)
  keep=np.array(mask)==128;pixels=np.array(f);pixels[~keep,3]=0;f=Image.fromarray(pixels);b=f.getbbox()
  if not b:raise ValueError(f'Empty frame: {path} / {i}')
  frames.append(f);bounds.append(b)
 target=160 if action in ['nap','computer','sleep'] else 186
 if actor=='ruru':target=184
 scale=min(target/max(b[3]-b[1] for b in bounds),230/max(b[2]-b[0] for b in bounds))
 packed=[]
 anchors=[];headwidths=[]
 for f,b in zip(frames,bounds):
  alpha=np.array(f.getchannel('A'));pix=np.array(f);h=b[3]-b[1]
  # Use the torso/pelvis, never the alternating planted foot, as horizontal origin.
  centers=[];widths=[]
  for y in range(round(b[1]+h*.65),round(b[1]+h*.85)):
   xs=np.flatnonzero(alpha[y]>64)
   if len(xs):centers.append((xs[0]+xs[-1])*.5)
  cx=float(np.median(centers)) if centers else (b[0]+b[2])*.5
  for y in range(round(b[1]+h*.22),round(b[1]+h*.43)):
   xs=np.flatnonzero(alpha[y]>64)
   if len(xs):widths.append(xs[-1]-xs[0])
  anchors.append((cx,b[1]+h*.76));headwidths.append(float(np.median(widths)) if widths else b[2]-b[0])
 referenceHead=float(np.median(headwidths));groundOffset=float(np.median([(b[3]-cy)*scale for b,(_,cy) in zip(bounds,anchors)]))
 alignment=[]
 for index,(f,b) in enumerate(zip(frames,bounds)):
  alpha=np.array(f.getchannel('A'));footys,footxs=np.where(alpha[max(b[1],b[3]-12):b[3]]>64);footcenter=float(np.median(footxs)) if len(footxs) else (b[0]+b[2])/2
  k=scale;cx,cy=anchors[index]
  stable=actor=='ruru' and action!='sleep'
  if stable:k*=max(.85,min(1.15,referenceHead/max(1,headwidths[index])))
  else:cx=footcenter
  offset=(cx-b[0])*k
  f=f.crop(b);f=f.resize((max(1,round(f.width*k)),max(1,round(f.height*k))),Image.Resampling.NEAREST)
  canvas=Image.new('RGBA',(256,256));x=round(126-offset);y=round(218-groundOffset-(cy-b[1])*k) if stable else 218-f.height
  canvas.alpha_composite(f,(x,y));packed.append(canvas)
  alignment.append({'sourceCenter':[cx,cy],'translation':[x,y],'scale':k,'alignedCenter':[x+offset,y+(cy-b[1])*k]})
 # A return stroke closes repeating gestures; one-shot crafting ends on its final pose.
 oneshot=action in ['paper-plane','pocket','sleep']
 seq=list(range(8)) if oneshot or action.startswith('walk') else list(range(8))+list(range(6,0,-1))
 if actor=='ruru' and action=='sleep':seq=[0,1,2,3,2,6,7,7]
 count=len(seq);sheet=Image.new('RGBA',(1024,256*((count+3)//4)))
 for j,i in enumerate(seq):sheet.paste(packed[i],(j%4*256,j//4*256))
 name=path.stem+'.webp';sheet.save(out/name,lossless=True)
 clip={'image':name,'fps':8,'count':count,'loop':not oneshot,'frames':[{'rect':[i%4*256,i//4*256,256,256],'pivot':[126,218]} for i in range(count)],'source':'imagegen','sourceSheet':str(path.relative_to(root))}
 manifest[f'{actor}/{action}']=clip
 unique=len({f.tobytes() for f in packed});report.append({'clip':f'{actor}/{action}','frames':count,'uniqueSourceFrames':unique,'feetY':218,'sourceMode':Image.open(path).mode,'alignment':alignment,'anchor':'torso' if actor=='ruru' and action!='sleep' else 'feet'})
 # Small contact sheet is safe to inspect and records all eight authored poses.
 contact=Image.new('RGB',(768,384),'#182b24')
 for i,f in enumerate(packed):thumb=f.resize((192,192),Image.Resampling.NEAREST);contact.paste(thumb,(i%4*192,i//4*192),thumb)
 contact.save(src/(path.stem+'-review.jpg'),quality=92)
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
(root/'artifacts/dungeon-rebuild/action-pack-report.json').write_text(json.dumps(report,indent=2))
print(f'Packed {len(manifest)} generated animation clips. All original frames retained for review.')

# Re-register all runtime pivots after any regenerated action atlas.
import subprocess,sys
subprocess.run([sys.executable,str(root/"tools/register-cabin-sprites.py")],check=True)
