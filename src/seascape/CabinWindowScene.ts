import { CABIN_VIEW, projectToCabin } from "./Projection";
import * as pc from 'playcanvas';
import { horizonFragmentSource } from './HorizonShader';
import { SeascapeState, MAX_METEORS, MAX_FIREWORKS } from './SeascapeState';
import { sampleOcean } from './Ocean';

const hex=(v:string)=>new pc.Color().fromString(v);
/** A real window and deck. Sky/water are rendered directly by the shared GPU shader. */
export class CabinWindowScene {
  readonly canvas=document.createElement('canvas');
  private app:pc.Application;
  private camera:pc.Entity;
  private material!:pc.ShaderMaterial;
  private fill!:pc.Entity;
  private materials:pc.Material[]=[];
  private textures:pc.Texture[]=[];
  private active=true; private expanded=false; private lastFrame=0; private ready=false;
  private look=[0,0];private target=[0,0];
  private meteorA=new Float32Array(MAX_METEORS*4);private meteorB=new Float32Array(MAX_METEORS*4);
  private fireworkA=new Float32Array(MAX_FIREWORKS*4);private fireworkB=new Float32Array(MAX_FIREWORKS*4);private fireworkC=new Float32Array(MAX_FIREWORKS*4);
  private renders=0;
  private qualityScale=1;
  private qualitySampleAt=0;
  private qualitySampleFrames=0;
  private landmarks: Array<{root:pc.Entity,base:pc.Vec3}>=[];
  private landmarksReady=false;
  constructor(readonly state:SeascapeState,private reduced:boolean,private onFrame:(canvas:HTMLCanvasElement)=>void){
    this.canvas.className='cabin-window-canvas';this.canvas.setAttribute('aria-label','View through the ship cabin window');
    this.canvas.width=288;this.canvas.height=120;
    this.app=new pc.Application(this.canvas,{graphicsDeviceOptions:{alpha:false,antialias:false,powerPreference:'low-power'}});
    this.camera=new pc.Entity('cabin-eye',this.app);
  }
  async init(){
    this.app.setCanvasFillMode(pc.FILLMODE_NONE);this.app.setCanvasResolution(pc.RESOLUTION_FIXED,288,120);
    this.app.scene.ambientSource=pc.AMBIENTSRC_CONSTANT;this.app.scene.ambientLight=new pc.Color(.19,.22,.24);
    this.camera.addComponent('camera',{fov:43,aspectRatioMode:pc.ASPECT_MANUAL,aspectRatio:2.4,nearClip:.05,farClip:160,clearColor:hex('#061621'),gammaCorrection:pc.GAMMA_SRGB,toneMapping:pc.TONEMAP_ACES});
    this.camera.setPosition(0,1.5,3.7);this.camera.lookAt(0,1.5,-10);this.app.root.addChild(this.camera);
    this.buildBackground();this.buildCabin();
    const moon=new pc.Entity('shared ivory moon',this.app);moon.addComponent('light',{type:'directional',color:hex('#f4e8ba'),intensity:1.35,castShadows:true,shadowResolution:512,shadowDistance:24,normalOffsetBias:.06});moon.setEulerAngles(42,-32,0);this.app.root.addChild(moon);
    this.fill=new pc.Entity('warm cabin lamplight',this.app);this.fill.addComponent('light',{type:'omni',color:hex('#e6b475'),intensity:1.5,range:12});this.fill.setPosition(-2.4,2.3,2);this.app.root.addChild(this.fill);
    const urls=[['u_noise','/assets/horizon/blue-noise-128.webp'],['u_boat','/assets/horizon/research-boat-night-atlas.webp'],['u_ufo','/assets/horizon/ufo-atlas.png'],['u_lighthouse','/assets/horizon/directl-moonlit.png']];
    await Promise.all(urls.map(async([name,url])=>{
      try{const asset=await new Promise<pc.Asset>((resolve,reject)=>this.app.assets.loadFromUrl(url,'texture',(error,asset)=>error?reject(error):resolve(asset!)));
        const texture=asset.resource as pc.Texture;texture.minFilter=pc.FILTER_NEAREST;texture.magFilter=pc.FILTER_NEAREST;texture.flipY=true;
        texture.addressU=name==='u_noise'?pc.ADDRESS_REPEAT:pc.ADDRESS_CLAMP_TO_EDGE;texture.addressV=texture.addressU;texture.upload();this.textures.push(texture);this.material.setParameter(name,texture);
      }catch(error){const blank=new pc.Texture(this.app.graphicsDevice,{width:1,height:1,format:pc.PIXELFORMAT_RGBA8});const pixels=blank.lock() as Uint8Array;pixels.set([0,0,0,0]);blank.unlock();this.textures.push(blank);this.material.setParameter(name,blank);console.warn('Cabin optional texture unavailable',name);}
    }));
    await this.loadLandmarks();
    this.app.autoRender=false;this.app.on('update',this.update);this.app.on('postrender',()=>{this.renders++;this.onFrame(this.canvas);});
    this.ready=true;this.updateUniforms();this.app.start();this.app.renderNextFrame=true;
  }
  private buildBackground(){
    const mesh=new pc.Mesh(this.app.graphicsDevice);mesh.setPositions([-1,-1,0,3,-1,0,-1,3,0]);mesh.setIndices([0,1,2]);mesh.update(pc.PRIMITIVE_TRIANGLES);
    this.material=new pc.ShaderMaterial({uniqueName:'CabinSharedNocturne',attributes:{aPosition:pc.SEMANTIC_POSITION},vertexGLSL:'attribute vec3 aPosition; varying vec2 v_uv; void main(){v_uv=aPosition.xy*.5+.5;gl_Position=vec4(aPosition.xy,.9999,1.);}',fragmentGLSL:horizonFragmentSource.replace('#version 300 es','').replace('in vec2 v_uv;','varying vec2 v_uv;').replace('out vec4 outColor;','').replaceAll('outColor','gl_FragColor').replaceAll('texture(', 'texture2D(')});
    this.material.cull=pc.CULLFACE_NONE;this.material.depthWrite=false;this.material.depthTest=true;
    const entity=new pc.Entity('continuous sea and sky',this.app);entity.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,this.material)]});entity.render!.meshInstances[0].cull=false;this.app.root.addChild(entity);this.materials.push(this.material);
  }
  private surface(name:string,color:string,gloss:number,metal=0){const m=new pc.StandardMaterial();m.name=name;m.diffuse=hex(color);m.gloss=gloss;m.useMetalness=true;m.metalness=metal;
    if(metal===0 && !name.includes('rope')){
      const texture=new pc.Texture(this.app.graphicsDevice,{name:name+' grain',width:128,height:64,format:pc.PIXELFORMAT_RGBA8,mipmaps:true,minFilter:pc.FILTER_LINEAR_MIPMAP_LINEAR,magFilter:pc.FILTER_NEAREST,addressU:pc.ADDRESS_REPEAT,addressV:pc.ADDRESS_REPEAT});
      const pixels=texture.lock() as Uint8Array;
      for(let y=0;y<64;y++)for(let x=0;x<128;x++){
        const wave=Math.sin(y*.85+Math.sin(x*.035)*1.6)+.35*Math.sin(y*2.8+x*.011);
        const fleck=(Math.sin(x*73.1+y*91.7)*431.3)%1;
        const value=Math.max(0,Math.min(255,218+wave*16+fleck*6));const at=(y*128+x)*4;pixels.set([value,value,value,255],at);
      }
      texture.unlock();this.textures.push(texture);m.diffuseMap=texture;
    }
    m.update();this.materials.push(m);return m;}
  private box(name:string,pos:number[],size:number[],mat:pc.Material){const e=new pc.Entity(name,this.app);e.addComponent('render',{type:'box',material:mat,castShadows:true,receiveShadows:true});e.setPosition(pos[0],pos[1],pos[2]);e.setLocalScale(size[0],size[1],size[2]);this.app.root.addChild(e);return e;}
  private buildCabin(){
    const oak=this.surface('smoked oak','#493526',.27),edge=this.surface('worn edge','#816048',.31),shadow=this.surface('recessed dark wood','#1c1816',.18),brass=this.surface('aged brass','#a48951',.44,.72),deck=this.surface('salt worn teak','#62533d',.22),line=this.surface('tarred rope','#272c29',.12);
    // Deep jambs and stepped reveals make the aperture open into space.
    for(const side of [-1,1]){
      this.box('oak jamb',[side*3.35,1.5,.13],[.40,3.15,.66],oak);
      this.box('inset brass strip',[side*3.13,1.5,-.04],[.032,2.72,.055],brass);
      this.box('inner reveal',[side*3.19,1.5,-.18],[.11,2.85,.50],shadow);
      this.box('worn front arris',[side*3.11,1.5,.44],[.038,2.82,.035],edge);
      for(const y of [.23,2.77])this.box('square headed fastener',[side*3.30,y,.475],[.085,.085,.022],brass);
    }
    this.box('head beam',[0,3.02,.12],[7.12,.30,.72],oak);this.box('head arris',[0,2.84,.45],[6.30,.036,.04],edge);
    this.box('deep sill',[0,-.03,.18],[7.18,.30,1.04],oak);this.box('sill lip',[0,.14,.69],[6.85,.045,.10],edge);
    this.box('lower brass seam',[0,.15,.10],[6.30,.026,.045],brass);
    for(let i=-8;i<=8;i++){const end=-13+Math.abs(i*.32)/2.72*5.5;this.box('deck plank',[i*.32,-1.00,(end+.5)/2],[.306,.11,.5-end],i%5===0?oak:deck);}
    for(const side of [-1,1]){
      this.box('gunwale',[side*2.58,-.36,-3.65],[.15,.17,7.8],oak);
      this.box('rail polished top',[side*2.58,-.255,-3.65],[.19,.045,7.8],edge);
      for(let z=-1;z>=-7;z-=1.5)this.box('rail stanchion',[side*2.58,-.57,z],[.075,.77,.085],oak);
      const rope=this.box('standing rigging',[side*2.2,3.1,-4],[.029,7.8,.029],line);rope.setEulerAngles(0,0,side*11);
    }
    for(const side of [-1,1]){const rail=this.box('tapered bow rail',[side*1.29,-.36,-10.25],[.15,.17,6.08],oak);rail.setEulerAngles(0,side*25.13,0);}
  }
  private async loadLandmarks(){
    const specifications=[{id:'directl',url:'/assets/voyage/models/landmarks/v3/lighthouse.glb',x:.90,height:.0872,yaw:12},{id:'oasis',url:'/assets/voyage/models/landmarks/v3/gate.glb',x:.74,height:.065,yaw:0}];
    const results=await Promise.allSettled(specifications.map(async spec=>{
      const asset=await new Promise<pc.Asset>((resolve,reject)=>this.app.assets.loadFromUrl(spec.url,'container',(error,asset)=>error?reject(error):resolve(asset!)));
      const visual=(asset.resource as pc.ContainerResource).instantiateRenderEntity();
      const root=new pc.Entity('distant '+spec.id,this.app);root.addChild(visual);this.app.root.addChild(root);
      const instances=(visual.findComponents('render') as pc.RenderComponent[]).flatMap(c=>c.meshInstances);
      const bounds=instances[0].aabb.clone();instances.slice(1).forEach(m=>bounds.add(m.aabb));
      const height=bounds.halfExtents.y*2;visual.setLocalPosition(-bounds.center.x,-bounds.center.y+bounds.halfExtents.y,-bounds.center.z);
      const distance=80;const frustumHeight=2*Math.tan(43*Math.PI/360)*distance;
      root.setLocalScale(frustumHeight*(spec.height/CABIN_VIEW.span[1])/height,frustumHeight*(spec.height/CABIN_VIEW.span[1])/height,frustumHeight*(spec.height/CABIN_VIEW.span[1])/height);
      const [x,y]=projectToCabin(spec.x,.48);
      const base=new pc.Vec3((x-.5)*frustumHeight*2.4,1.5+(y-.5)*frustumHeight,3.7-distance);
      root.setPosition(base);root.setEulerAngles(0,spec.yaw,0);root.enabled=false;
      for(const mesh of instances){mesh.castShadow=false;mesh.receiveShadow=false;const material=mesh.material.clone() as pc.StandardMaterial;material.diffuse.mulScalar(.78);if(spec.id==='oasis'){material.emissive=hex('#19372e');material.emissiveIntensity=.3;}material.gloss=Math.min(.45,material.gloss);material.update();mesh.material=material;this.materials.push(material);}
      return {root,base};
    }));
    this.landmarks=results.filter((r):r is PromiseFulfilledResult<{root:pc.Entity,base:pc.Vec3}>=>r.status==='fulfilled').map(r=>r.value);
    this.landmarksReady=this.landmarks.length===2;this.landmarks.forEach(l=>l.root.enabled=this.landmarksReady);
  }
  private updateUniforms(){
    const m=this.material,s=this.state,c=s.getCycleState();
    // The shared clock still carries Horizon's events; UFO presentation belongs
    // only to that exterior camera. The cabin keeps its ordinary wave motion.
    const values:Record<string,number|number[]|Float32Array>={u_resolution:[this.canvas.width,this.canvas.height],u_time:s.elapsed,u_entry:1,u_cabin:1,u_landmarks_3d:this.landmarksReady?1:0,u_look:this.look,u_ship_motion:this.reduced?[0,0]:[sampleOcean(0,0,s.elapsed).dx*.06,sampleOcean(0,0,s.elapsed).height*.018],u_boat_position:c.position,u_boat_visible:c.visible,u_boat_lift:0,u_boat_wake:0,u_boat_reflection:0,u_boat_pitch:0,u_splash_strength:0,u_reduced_motion:this.reduced?1:0,u_ufo_position:c.ufo,u_ufo_visible:0,u_beam_strength:0,u_moon_ripple:0};
    const meteors=this.reduced?[]:s.meteorEvents.slice(0,MAX_METEORS);this.meteorA.fill(0);this.meteorB.fill(0);
    meteors.forEach((e,i)=>{this.meteorA.set([e.x,e.y,e.dx,e.dy],i*4);this.meteorB.set([e.start,e.duration,e.tail,e.brightness],i*4);});
    values.u_meteor_count=meteors.length;values['u_meteor_a[0]']=this.meteorA;values['u_meteor_b[0]']=this.meteorB;
    const events=this.reduced?[]:s.fireworkGroups.filter(g=>g.start<=s.elapsed+.05).flatMap(g=>g.events.map(e=>({e,fade:g.fadeOutStart===null?1:Math.max(0,1-(s.elapsed-g.fadeOutStart)/.25)}))).slice(0,MAX_FIREWORKS);
    this.fireworkA.fill(0);this.fireworkB.fill(0);this.fireworkC.fill(0);
    events.forEach(({e,fade},i)=>{this.fireworkA.set([e.originX,e.burstX,e.burstY,e.start],i*4);this.fireworkB.set([e.seed,e.palette==='gold-pearl'?0:e.palette==='silver-blue'?1:2,e.scale,fade],i*4);this.fireworkC.set([e.role==='principal'?0:e.role==='companion'?1:2,e.style==='chrysanthemum'?0:e.style==='willow'?1:2,e.tail,0],i*4);});
    values.u_firework_count=events.length;values['u_firework_a[0]']=this.fireworkA;values['u_firework_b[0]']=this.fireworkB;values['u_firework_c[0]']=this.fireworkC;
    for(const[k,v]of Object.entries(values))m.setParameter(k,v);
    for(const landmark of this.landmarks){landmark.root.setPosition(landmark.base.x-c.progress*1.5,landmark.base.y,landmark.base.z+c.progress*8);}
    const sea=sampleOcean(0,0,s.elapsed);
    const roll=this.reduced?0:sea.dx*.018;
    this.camera.setPosition(this.look[0]*3.7,1.5+this.look[1]*1.5,3.7);this.camera.lookAt(0,1.5,-10);this.camera.rotateLocal(0,0,roll);
    const flash=events.reduce((sum,{e})=>sum+Math.max(0,1-Math.abs((s.elapsed-e.start)-.7)*4),0);
    this.fill.light!.color.set(1,.76,.46);this.fill.light!.intensity=1.5+Math.min(2,flash)*.45;
  }
  private update=()=>{
    if(!this.active||document.hidden||!this.ready||(this.reduced&&this.renders>0))return;const now=performance.now();
    if(now-this.lastFrame<(this.expanded?1000/60:1000/24)-1)return;this.lastFrame=now;
    // Only reduce the pixel budget after sustained slow rendering. Resizing the
    // same drawing buffer preserves the camera, timeline, and WebGL context.
    if(!this.qualitySampleAt){this.qualitySampleAt=now;this.qualitySampleFrames=this.renders;}
    if(now-this.qualitySampleAt>2400){
      const fps=(this.renders-this.qualitySampleFrames)*1000/(now-this.qualitySampleAt);
      if(fps<(this.expanded?36:17)&&this.qualityScale>.56){this.qualityScale=Math.max(.56,this.qualityScale*.75);this.resizeBuffer();}
      this.qualitySampleAt=now;this.qualitySampleFrames=this.renders;
    }
    this.state.advance(now);this.look=this.look.map((v,i)=>v+(this.target[i]-v)*.10);
    this.updateUniforms();this.app.renderNextFrame=true;
  };
  private resizeBuffer(){const width=(this.expanded?Math.min(960,Math.round(innerWidth*.9)):288)*this.qualityScale;const w=Math.round(width/12)*12;this.app.graphicsDevice.resizeCanvas(w,w/2.4);}
  setActive(active:boolean){this.active=active;this.lastFrame=0;this.qualitySampleAt=0;if(active)this.state.resetTimestamp();}
  setExpanded(expanded:boolean){this.expanded=expanded;this.target=[0,0];this.qualitySampleAt=0;this.resizeBuffer();this.updateUniforms();this.app.renderNextFrame=true;}
  setLook(x:number,y:number){if(!this.reduced)this.target=[Math.max(-1,Math.min(1,x))*.02618,Math.max(-1,Math.min(1,y))*.02618];}
  snapshot(){return{ready:this.ready,expanded:this.expanded,active:this.active,time:this.state.elapsed,cycle:this.state.getCycleState().phase,look:this.look,internalResolution:[this.canvas.width,this.canvas.height],qualityScale:this.qualityScale,renders:this.renders,contextCount:1,landmarks:this.state.landmarks,landmarks3D:this.landmarksReady,ufoVisible:this.material?.getParameter('u_ufo_visible')?.data??0,beamStrength:this.material?.getParameter('u_beam_strength')?.data??0,moonRipple:this.material?.getParameter('u_moon_ripple')?.data??0};}
  destroy(){this.active=false;this.app.off('update',this.update);this.app.destroy();}
}
