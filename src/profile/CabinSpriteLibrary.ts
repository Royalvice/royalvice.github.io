export type SpriteClip={image:string;fps:number;count:number;loop:boolean;frames:Array<{rect:number[];pivot:number[];durationMs?:number}>};
export class CabinSpriteLibrary {
 private clips=new Map<string,{clip:SpriteClip;image:HTMLImageElement}>();
 failures:string[]=[];
 async init(){
  const base='/assets/profile/dungeon-v5/sprites/';
  const manifest=await fetch(base+'manifest.json').then(r=>r.json());
  await Promise.all(Object.entries(manifest).flatMap(([id,clips])=>Object.entries(clips as Record<string,SpriteClip>).map(([key,clip])=>this.load(`${id}/${key}`,base,clip))));
  const special=await fetch('/assets/profile/dungeon-v5/actions/manifest.json').then(r=>r.ok?r.json():{}).catch(()=>({}));
  await Promise.all(Object.entries(special).map(([key,clip])=>this.load(key,'/assets/profile/dungeon-v5/actions/',clip as SpriteClip)));
 }
 private async load(key:string,base:string,clip:SpriteClip){const image=new Image();try{image.src=base+clip.image;await image.decode();this.clips.set(key,{clip,image});}catch{this.failures.push(key);}}
 has(key:string){return this.clips.has(key);}
 get count(){return this.clips.size;}
 draw(ctx:CanvasRenderingContext2D,key:string,time:number,x:number,y:number,size:number,flip=false){
  const actor=key.split('/')[0];const item=this.clips.get(key)||this.clips.get(`${actor}/down-idle`)||this.clips.get(`${actor}/left-idle`);if(!item){ctx.save();ctx.fillStyle='#d7c28e';ctx.font='7px monospace';ctx.fillText(actor,x-14,y-12);ctx.fillRect(x-2,y-2,4,2);ctx.restore();return false;}const {clip,image}=item;
  const i=clip.loop?Math.floor(time*clip.fps)%clip.count:Math.min(clip.count-1,Math.floor(time*clip.fps));const f=clip.frames[Math.max(0,i)];if(!f)return false;
  const [sx,sy,w,h]=f.rect,k=size/256;ctx.save();ctx.translate(Math.round(x),Math.round(y));if(flip)ctx.scale(-1,1);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,sx,sy,w,h,Math.round(-f.pivot[0]*k),Math.round(-f.pivot[1]*k),Math.round(w*k),Math.round(h*k));ctx.restore();return true;
 }
}
