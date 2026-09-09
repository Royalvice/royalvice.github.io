"""Audit every runtime frame; register its torso instead of a swinging hand or foot.
Only pivots change. Source art, frame timing, proportions and natural vertical gait remain intact.
"""
from pathlib import Path
import json, numpy as np
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1];out=root/'artifacts/cabin-v7';out.mkdir(exist_ok=True)
report=[]
def center(im,actor):
 a=np.asarray(im);r,g,b=[a[:,:,i].astype(float) for i in range(3)];alpha=a[:,:,3]>96
 ys,xs=np.where(alpha);l,t,rr,bb=xs.min(),ys.min(),xs.max(),ys.max();h=bb-t
 bands=np.zeros_like(alpha);bands[round(t+h*.58):round(t+h*.83)+1]=True
 if actor=='nobita':mask=(r>115)&(g>80)&(b<110)&(r<g*1.65)&(b<g*.68)
 elif actor=='gian':mask=(r>120)&(g>45)&(g<190)&(b<95)&(r>g*1.20)
 elif actor=='shizuka':mask=(r>110)&(g>35)&(b>35)&(r>g*1.17)&(r>b*.92)
 elif actor=='suneo':mask=(g>r*1.04)&(g>b*1.09)&(g>55)
 elif actor=='doraemon':mask=(b>100)&(r<b*.65)&(g>55)
 else:mask=(r>150)&(g>55)&(g<200)&(b<90)
 mask &= alpha&bands
 rows=[]
 for y in np.flatnonzero(mask.sum(axis=1)>=3):
  xx=np.flatnonzero(mask[y]);rows.append((float(np.quantile(xx,.15)+np.quantile(xx,.85))/2,int(y),len(xx)))
 if len(rows)<4:
  mask=alpha&bands;rows=[((np.flatnonzero(mask[y])[0]+np.flatnonzero(mask[y])[-1])/2,int(y),int(mask[y].sum())) for y in np.flatnonzero(mask.sum(axis=1)>=3)]
 # Lower torso is less affected by gesturing arms. Trim outlying row centres.
 mid=float(np.median([x for x,y,n in rows]));rows=[p for p in rows if abs(p[0]-mid)<max(5,(rr-l)*.15)]
 return float(np.median([p[0] for p in rows])), [int(l),int(t),int(rr+1),int(bb+1)],len(rows)
for sub in ['sprites','actions']:
 base=root/f'public/assets/profile/dungeon-v5/{sub}';path=base/'manifest.json';m=json.loads(path.read_text());backup=out/(sub+'-manifest-before.json')
 if not backup.exists():backup.write_text(json.dumps(m))
 items={f'{a}/{k}':v for a,c in m.items() for k,v in c.items()} if sub=='sprites' else m
 contacts={}
 for key,clip in items.items():
  actor,action=key.split('/');sheet=Image.open(base/clip['image']).convert('RGBA');measure=[];frames=[]
  for f in clip['frames']:
   x,y,w,h=f['rect'];im=sheet.crop((x,y,x+w,y+h));cx,bounds,confidence=center(im,actor);old=f.get('registration',{}).get('originalPivot',f['pivot'][:]);f['registration']={'originalPivot':old,'bodyCenterX':round(cx,3),'sampleRows':confidence};f['pivot']=[round(cx,3),old[1]];measure.append({'x':cx,'beforeError':cx-old[0],'afterError':cx-f['pivot'][0],'bounds':bounds,'rows':confidence});frames.append(im)
  before=[f['beforeError'] for f in measure];report.append({'clip':key,'frames':len(frames),'beforeCenterRange':round(max(before)-min(before),3),'maxCorrection':round(max(abs(x) for x in before),3),'residual':round(max(abs(f['afterError']) for f in measure),4),'framesAudit':measure})
  review=Image.new('RGB',(1024,110),'#182a24');d=ImageDraw.Draw(review);d.text((2,5),action,fill='#dfcda6')
  for j in range(8):
   i=round(j*(len(frames)-1)/7);f=clip['frames'][i];tile=Image.new('RGBA',(300,270));tile.alpha_composite(frames[i],(round(150-f['pivot'][0]),0));tile=tile.resize((96,86),Image.Resampling.NEAREST);review.paste(tile,(170+j*105,20),tile);d.line((218+j*105,20,218+j*105,106),fill='#748467')
  contacts.setdefault(actor,[]).append(review)
 path.write_text(json.dumps(m,ensure_ascii=False))
 for actor,rows in contacts.items():
  for i in range(0,len(rows),6):
   im=Image.new('RGB',(1024,min(6,len(rows)-i)*110),'#182a24')
   for j,row in enumerate(rows[i:i+6]):im.paste(row,(0,j*110))
   im.save(out/f'aligned-{sub}-{actor}-{i//6}.png')
(out/'registration-report.json').write_text(json.dumps(report,indent=2));print(json.dumps({'clips':len(report),'frames':sum(r['frames'] for r in report),'largestDrift':sorted([{k:r[k] for k in ['clip','beforeCenterRange','maxCorrection']} for r in report],key=lambda r:-r['beforeCenterRange'])[:12]},indent=2))
