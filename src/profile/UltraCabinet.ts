import footPivots from '../../public/assets/profile/ultra-poses-v2/pivots.json';
// A shallower display view keeps the small figures legible behind the glass.
const COLLECTION_PITCH = 28;
import * as pc from 'playcanvas';
const names=[['original','初代'],['zoffy','佐菲'],['seven','赛文'],['jack','杰克'],['ace','艾斯'],['taro','泰罗'],['leo','雷欧'],['80','艾迪']];
const poseNames:Record<string,string>={jack:'斯派修姆光线',ace:'经典格斗起手式',taro:'斯特利姆光线','80':'沙库修姆光线 · 蓄势'};
const available=new Set(['jack','ace','taro','80']);
/** One scene/context moves between the room and the inspection dialog. */
export class UltraCabinet {
 private app:pc.Application;private camera:pc.Entity;private cabinet:pc.Entity;
 private canvas=document.createElement('canvas');private frame=document.createElement('canvas');private dock=document.createElement('div');
 private dialog=document.createElement('dialog');private view!:HTMLElement;private label!:HTMLElement;
 private figures=new Map<string,{root:pc.Entity;position:pc.Vec3}>();private assets:pc.Asset[]=[];private materials:pc.Material[]=[];
 private observer:IntersectionObserver;private resizeObserver:ResizeObserver;private visible=true;private dirty=true;private selected:string|null=null;private yaw=0;private zoom=1;private disposed=false;
 private drag:{x:number;y:number;startX:number;startY:number;moved:boolean}|null=null;
 private cleanups:Array<()=>void>=[];
 constructor(private trigger:HTMLButtonElement,private onFrame:(c:HTMLCanvasElement)=>void,private onOpen:(open:boolean)=>void){
  this.dock.className='ultra-render-dock';trigger.parentElement!.append(this.dock);this.dock.append(this.canvas);
  this.canvas.setAttribute('aria-label','Showa Ultraman collection; drag to rotate, scroll to zoom');this.canvas.tabIndex=0;
  this.app=new pc.Application(this.canvas,{graphicsDeviceOptions:{alpha:true,antialias:false,powerPreference:'low-power'}});
  this.camera=new pc.Entity('collection camera');this.cabinet=new pc.Entity('walnut and brass cabinet');
  this.dialog.className='ultra-dialog';this.dialog.setAttribute('aria-label','昭和奥特曼收藏');
  this.dialog.innerHTML=`<header><div><small>THE CAPTAIN'S COLLECTION</small><h2>昭和 · 光之记忆</h2></div><button data-ultra-close aria-label="关闭展柜">×</button></header><div class="ultra-view"></div><div class="ultra-inspection"><button data-ultra-back hidden>← 返回展柜</button><span data-ultra-label>两层收藏 · 点选一位鉴赏</span></div><nav aria-label="奥特曼角色">${names.map(([id,n])=>`<button data-ultra-id="${id}" disabled>${n}<small>${available.has(id)?'载入中':'待收藏'}</small></button>`).join('')}</nav><p class="ultra-availability">已找到 4 / 8 位模型，其余四位仍在核实；空位保留原定角色。</p>`;
  document.body.append(this.dialog);this.view=this.dialog.querySelector('.ultra-view')!;this.label=this.dialog.querySelector('[data-ultra-label]')!;
  this.bind(trigger,'click',()=>this.open());this.bind(this.dialog.querySelector('[data-ultra-close]')!,'click',()=>this.dialog.close());this.bind(this.dialog,'close',()=>this.close());
  this.bind(this.dialog,'click',(e:MouseEvent)=>{if(e.target===this.dialog){const r=this.dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.dialog.close();}});
  this.bind(this.dialog.querySelector('[data-ultra-back]')!,'click',()=>this.select(null));
  this.dialog.querySelectorAll<HTMLButtonElement>('[data-ultra-id]').forEach(b=>this.bind(b,'click',()=>this.select(b.dataset.ultraId!)));
  this.bind(this.canvas,'pointerdown',(e:PointerEvent)=>{this.drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};this.canvas.setPointerCapture(e.pointerId);});
  this.bind(this.canvas,'pointermove',(e:PointerEvent)=>{if(!this.drag)return;this.drag.moved ||=Math.hypot(e.clientX-this.drag.startX,e.clientY-this.drag.startY)>5;this.yaw+=(e.clientX-this.drag.x)*.008;this.drag.x=e.clientX;this.drag.y=e.clientY;this.updateCamera();});
  this.bind(this.canvas,'pointerup',(e:PointerEvent)=>{if(this.drag&&!this.drag.moved&&!this.selected)this.pick(e);this.drag=null;});this.bind(this.canvas,'pointercancel',()=>{this.drag=null;});
  this.bind(this.canvas,'wheel',(e:WheelEvent)=>{e.preventDefault();this.zoom=Math.max(.7,Math.min(1.7,this.zoom*Math.exp(-e.deltaY*.001)));this.updateCamera();},{passive:false});
  this.bind(this.canvas,'keydown',(e:KeyboardEvent)=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();this.yaw+=e.key==='ArrowLeft'?-.15:.15;this.updateCamera();}});
  this.bind(document,'visibilitychange',()=>{this.dirty=true;});
  this.observer=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;this.dirty=true;});this.observer.observe(trigger);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.view);
  (window as any).__ultraCabinet={getState:()=>({ready:!trigger.disabled,loaded:[...this.figures.keys()],missing:names.filter(([id])=>!this.figures.has(id)).map(([id])=>id),open:this.dialog.open,roomCameraPitch:COLLECTION_PITCH,selected:this.selected,contexts:1})};
 }
 async init(){
  this.app.autoRender=false;this.app.scene.ambientLight=new pc.Color(.45,.46,.40);
  this.camera.addComponent('camera',{projection:pc.PROJECTION_ORTHOGRAPHIC,nearClip:.1,farClip:50,clearColor:new pc.Color(0,0,0,0),gammaCorrection:pc.GAMMA_SRGB,toneMapping:pc.TONEMAP_ACES});this.app.root.addChild(this.camera);this.app.root.addChild(this.cabinet);this.build();
  const light=new pc.Entity('warm collection lighting');light.addComponent('light',{type:'directional',color:new pc.Color(1,.86,.66),intensity:1.8,castShadows:true,shadowResolution:1024,shadowDistance:20,normalOffsetBias:.04});light.setEulerAngles(35,-20,0);this.app.root.addChild(light);
  const fill=new pc.Entity('window bounce');fill.addComponent('light',{type:'directional',color:new pc.Color(.6,.76,1),intensity:.75});fill.setEulerAngles(15,135,0);this.app.root.addChild(fill);
  this.app.on('update',()=>{if(!this.disposed&&!document.hidden&&(this.dialog.open||this.visible)&&this.dirty){this.app.renderNextFrame=true;this.dirty=false;}});
  this.app.on('postrender',()=>{if(this.dialog.open||!this.canvas.width||!this.canvas.height)return;const copy=document.createElement('canvas');copy.width=this.canvas.width;copy.height=this.canvas.height;const c=copy.getContext('2d')!;c.drawImage(this.canvas,0,0);const pixels=c.getImageData(0,0,copy.width,copy.height).data;let l=copy.width,t=copy.height,r=0,b=0;for(let y=0;y<copy.height;y++)for(let x=0;x<copy.width;x++)if(pixels[(y*copy.width+x)*4+3]>24){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}if(r<l||b<t)return;this.frame.width=r-l+1;this.frame.height=b-t+1;this.frame.getContext('2d')!.drawImage(copy,l,t,this.frame.width,this.frame.height,0,0,this.frame.width,this.frame.height);this.onFrame(this.frame);});
  this.app.start();this.resize();this.trigger.disabled=false;
  await Promise.all([...available].map(id=>this.load(id).catch(error=>{console.warn('Collection asset unavailable',id,error);const b=this.dialog.querySelector(`[data-ultra-id="${id}"] small`);if(b)b.textContent='暂不可用';})));
 }
 private bind(el:EventTarget,type:string,fn:any,options?:AddEventListenerOptions){el.addEventListener(type,fn,options);this.cleanups.push(()=>el.removeEventListener(type,fn,options));}
 private material(hex:string,metal=.1,opacity=1){const m=new pc.StandardMaterial();m.diffuse=new pc.Color().fromString(hex);m.useMetalness=true;m.metalness=metal;m.gloss=.45;if(opacity<1){m.opacity=opacity;m.blendType=pc.BLEND_NORMAL;m.depthWrite=false;}m.update();this.materials.push(m);return m;}
 private box(name:string,pos:number[],scale:number[],mat:pc.Material){const e=new pc.Entity(name);e.addComponent('render',{type:'box',material:mat});e.setPosition(...pos as [number,number,number]);e.setLocalScale(...scale as [number,number,number]);this.cabinet.addChild(e);return e;}
 private build(){const wood=this.material('#453025'),brass=this.material('#a8874d',.7),back=this.material('#172c28'),glass=this.material('#adc9c0',.05,.07),shelfGlass=this.material('#c4d9ce',.1,.13),ivory=this.material('#d5bf87');
  this.box('wood back',[0,3,-.85],[8.3,6.2,.2],wood);this.box('velvet interior',[0,3,-.72],[7.9,5.85,.07],back);
  for(const x of [-4.05,4.05]){this.box('walnut upright',[x,3,0],[.25,6.2,1.85],wood);this.box('brass edge',[x,3,1],[.035,6.2,.04],brass);}
  // Glass above each row replaces the opaque boards that hid the heads.
  for(const y of [0,3,6]){
   this.box(y?'glass shelf':'wood plinth',[0,y,0],[8.3,y?.045:.2,1.9],y?shelfGlass:wood);
   this.box('slender front edge',[0,y,1.01],[8.15,.045,.035],brass);
   if(y){
    this.box('rear shelf support',[0,y,-.8],[8.15,.09,.14],wood);
    this.box('warm rear diffuser',[0,y-.07,-.56],[7.6,.025,.09],ivory);
   }
  }
  for(const x of [-3.7,3.7])for(const z of [-.65,.65])this.box('solid cabinet foot',[x,-.28,z],[.32,.4,.32],wood);
  this.box('glass left',[0,3,1.015],[.025,5.8,.04],brass);this.box('front glazing',[0,3,1.03],[7.85,5.77,.012],glass);
  for(let i=0;i<8;i++){const x=-3+i%4*2,y=i<4?3.13:.13;this.box('collectible base '+i,[x,y+.055,.3],[1.35,.11,1.05],brass);this.box('dark base top '+i,[x,y+.12,.3],[1.28,.025,.98],wood);}
 }
 private async load(id:string){const asset=new pc.Asset(id,'container',{url:`/assets/profile/ultra-poses-v2/${id}.glb`});this.assets.push(asset);this.app.assets.add(asset);await new Promise<void>((resolve,reject)=>{asset.ready(()=>resolve());asset.once('error',reject);this.app.assets.load(asset);});if(this.disposed)return;
  const model=asset.resource.instantiateRenderEntity(),root=new pc.Entity(id+' display');root.addChild(model);this.app.root.addChild(root);
  const renders=model.findComponents('render') as pc.RenderComponent[];let bounds:pc.BoundingBox|null=null;for(const r of renders)for(const mesh of r.meshInstances){if(bounds)bounds.add(mesh.aabb);else bounds=mesh.aabb.clone();}if(!bounds)throw Error('Empty model');
  // Raised hands need extra headroom without making 80's body smaller than his brothers.
  const targetHeight=id==='80'?2.5:2.35;
  const scale=Math.min(targetHeight/(bounds.halfExtents.y*2),1.78/(bounds.halfExtents.x*2));model.setLocalScale(scale,scale,scale);
  const pivot=footPivots[id as keyof typeof footPivots];
  model.setLocalPosition(-pivot.x*scale,-(bounds.center.y-bounds.halfExtents.y)*scale,-pivot.z*scale);
  const index=names.findIndex(([key])=>key===id),position=new pc.Vec3(-3+index%4*2,index<4?3.27:.27,id==='80'?.62:.3);root.setPosition(position);this.figures.set(id,{root,position});
  const b=this.dialog.querySelector<HTMLButtonElement>(`[data-ultra-id="${id}"]`)!;b.disabled=false;b.querySelector('small')!.textContent='鉴赏';this.dirty=true;
 }
 private updateCamera(){
  this.cabinet.enabled=!this.selected;for(const [id,f] of this.figures){f.root.enabled=!this.selected||id===this.selected;f.root.setPosition(this.selected?new pc.Vec3(0,1.1,0):f.position);f.root.setEulerAngles(0,this.selected?this.yaw*180/Math.PI:0,0);}
  const aspect=this.canvas.width/this.canvas.height;this.camera.camera!.aspectRatioMode=pc.ASPECT_MANUAL;this.camera.camera!.aspectRatio=aspect;
  this.camera.camera!.orthoHeight=(this.selected?Math.max(1.65,1.15/aspect):Math.max(3.65,4.8/aspect))/this.zoom;
  if(!this.dialog.open){
   const targetY=2.8,pitch=COLLECTION_PITCH*Math.PI/180;
   this.camera.setPosition(0,targetY+14*Math.tan(pitch),14);this.camera.lookAt(0,targetY,0);
  }else{this.camera.setPosition(this.selected?0:Math.sin(this.yaw)*14,this.selected?3.1:6.5,this.selected?12:Math.cos(this.yaw)*14);this.camera.lookAt(0,this.selected?2.25:3,0);}this.dirty=true;
 }
 private resize(){const r=this.dialog.open?this.view.getBoundingClientRect():{width:240,height:188.8};const width=Math.max(1,Math.round(Math.min(1000,r.width))),height=Math.max(1,Math.round(width*r.height/r.width));this.app.graphicsDevice.resizeCanvas(width,height);this.updateCamera();}
 private pick(e:PointerEvent){const r=this.canvas.getBoundingClientRect(),x=(e.clientX-r.left)*this.canvas.width/r.width,y=(e.clientY-r.top)*this.canvas.height/r.height;const near=this.camera.camera!.screenToWorld(x,y,1),far=this.camera.camera!.screenToWorld(x,y,30),ray=new pc.Ray(near,far.sub(near).normalize());for(const [id,f]of this.figures)for(const render of f.root.findComponents('render') as pc.RenderComponent[])if(render.meshInstances.some(m=>m.aabb.intersectsRay(ray))){this.select(id);return;}}
 private select(id:string|null){if(id&&!this.figures.has(id))return;this.selected=id;this.yaw=0;this.zoom=1;this.dialog.querySelector<HTMLElement>('[data-ultra-back]')!.hidden=!id;this.label.textContent=id?`${names.find(([key])=>key===id)![1]} · ${poseNames[id]} · 拖动旋转 / 滚动缩放`:'两层收藏 · 点选一位鉴赏';this.updateCamera();}
 open(){if(this.dialog.open)return;this.dialog.showModal();this.view.append(this.canvas);this.trigger.setAttribute('aria-expanded','true');this.onOpen(true);this.select(null);this.resize();this.canvas.focus();}
 private close(){this.dock.append(this.canvas);this.trigger.setAttribute('aria-expanded','false');this.selected=null;this.yaw=0;this.zoom=1;this.resize();this.onOpen(false);this.trigger.focus();}
 destroy(){this.disposed=true;this.observer.disconnect();this.resizeObserver.disconnect();this.cleanups.forEach(f=>f());this.app.destroy();this.dialog.remove();this.dock.remove();delete (window as any).__ultraCabinet;}
}
