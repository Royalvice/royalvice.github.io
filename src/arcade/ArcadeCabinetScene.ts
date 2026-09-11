import * as pc from 'playcanvas';
import { pixelText, wrapPixelText } from '../terminal/pixelFont';

type Control = { index: number; entity: pc.Entity; home: pc.Vec3 };
export type DisplayState = { name: string; system: string; year: number; coins: number; message: string; playing: boolean; paused: boolean; vertical?: boolean };
const color = (hex: string) => new pc.Color().fromString(hex);

/** The monitor, controls and room are geometry. Only phosphor content is a texture. */
export class ArcadeCabinetScene {
  private app: pc.Application;
  private camera: pc.Entity;
  private screen = document.createElement('canvas');
  private texture: pc.Texture;
  private materials: pc.StandardMaterial[] = [];
  private controls: Control[] = [];
  private joystick!: pc.Entity;
  private pointers = new Map<number, { index: number; x: number; y: number }>();
  private held = new Set<number>();
  private source: HTMLCanvasElement | null = null;
  private enabled = false;
  private resizeObserver: ResizeObserver;
  private state: DisplayState = { name: 'AFTER HOURS', system: 'YZY ARCADE', year: 1996, coins: 0, message: 'SELECT A GAME', playing: false, paused: false };
  private clock = 0;
  private lastPaint = -1;
  private mesh!: pc.Mesh;
  private lost = false;
  private environment!: pc.Entity;
  private coin!: pc.Entity;
  private coinStart=-10;
  private notice!: pc.Entity;
  private noticeMesh!: pc.Mesh;

  constructor(private canvas: HTMLCanvasElement, private reducedMotion: boolean, private onInput: (index: number, down: boolean, source: string) => void, private onInsert:()=>void=()=>{}) {
    this.app = new pc.Application(canvas, { graphicsDeviceOptions: { alpha: true, antialias: false, powerPreference: 'low-power' } });
    this.app.setCanvasFillMode(pc.FILLMODE_NONE);
    this.app.setCanvasResolution(pc.RESOLUTION_FIXED, 1, 1);
    this.app.scene.ambientLight = color('#666d65');
    this.app.scene.ambientSource = pc.AMBIENTSRC_CONSTANT;
    this.camera = new pc.Entity('arcade-camera');
    this.camera.addComponent('camera', { projection: pc.PROJECTION_ORTHOGRAPHIC, nearClip: .1, farClip: 50, clearColor: color('#0b1614'), gammaCorrection: pc.GAMMA_SRGB, toneMapping: pc.TONEMAP_ACES });
    this.app.root.addChild(this.camera);
    this.camera.setPosition(.15, 4.3, 14);
    this.camera.lookAt(0, 2.53, 0);
    this.screen.width = 640; this.screen.height = 480;
    this.texture = new pc.Texture(this.app.graphicsDevice, { name: 'live-arcade-phosphor', width: 640, height: 480, mipmaps: false, minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE });
    this.build();
    this.app.autoRender = false;
    this.app.on('update', this.update);
    this.app.start();
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas.parentElement!);
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('pointercancel', this.pointerUp);
    canvas.addEventListener('lostpointercapture', this.pointerUp);
    canvas.addEventListener('webglcontextlost', this.contextLost);
    canvas.addEventListener('webglcontextrestored', this.contextRestored);
  }
  private material(name: string, tint: string, metalness = 0, gloss = .35) {
    const material = new pc.StandardMaterial();
    material.name = name; material.diffuse = color(tint); material.useMetalness = true;
    material.metalness = metalness; material.gloss = gloss; material.update();
    this.materials.push(material); return material;
  }
  private box(name: string, position: number[], size: number[], material: pc.StandardMaterial, parent = this.app.root, type = 'box') {
    const entity = new pc.Entity(name);
    entity.addComponent('render', { type, material, castShadows: true, receiveShadows: true });
    parent.addChild(entity); entity.setLocalPosition(...position as [number,number,number]); entity.setLocalScale(...size as [number,number,number]);
    return entity;
  }
  private light(name: string, tint: string, intensity: number, position: number[], target: number[], type = 'spot') {
    const lamp = new pc.Entity(name);
    lamp.addComponent('light', { type, color: color(tint), intensity, range: 18, innerConeAngle: 34, outerConeAngle: 65, castShadows: true, shadowResolution: 1024, shadowBias: .15, normalOffsetBias: .06 });
    this.app.root.addChild(lamp); lamp.setPosition(...position as [number,number,number]); lamp.lookAt(new pc.Vec3(...target as [number,number,number]));
    lamp.rotateLocal(90,0,0);
  }
  private build() {
    const wood = this.material('honey walnut cabinet', '#34261e', .03);
    const grain=document.createElement('canvas');grain.width=128;grain.height=256;
    const grainCtx=grain.getContext('2d')!,pixels=grainCtx.createImageData(128,256);
    for(let y=0;y<256;y++)for(let x=0;x<128;x++){
      const line=Math.sin(x*.7+Math.sin(y*.031)*1.8)+Math.sin(x*2.8+y*.014)*.3;
      const v=.84+line*.075;const i=(y*128+x)*4;pixels.data.set([Math.round(95*v),Math.round(67*v),Math.round(45*v),255],i);
    }
    grainCtx.putImageData(pixels,0,0);const woodMap=new pc.Texture(this.app.graphicsDevice,{mipmaps:true});woodMap.setSource(grain);
    wood.diffuse=new pc.Color(.7,.7,.7);wood.diffuseMap=woodMap;wood.gloss=.28;wood.update();
    const edge = this.material('worn walnut edges', '#604630', .04);
    const brass = this.material('old brass handles', '#a58a51', .72, .48);
    const teal = this.material('dungeon teal CRT housing', '#244b45', .2, .4);
    const dark = this.material('rubber gasket', '#07120f', .04, .2);
    const ivory = this.material('white game console', '#dddcc9', .05, .4);
    const tile = this.material('dungeon green floor', '#234a40', .05, .25);
    const mortar = this.material('shadowed cabin mortar', '#211c15');
    const bricks = [this.material('dark walnut brick', '#403121'),this.material('warm walnut brick', '#51402b')];
    this.environment=new pc.Entity('dungeon environment');this.app.root.addChild(this.environment);
    this.box('floor',[0,-.13,0],[18,.22,18],tile,this.environment);
    // Match the room's square, dark-teal tiles, with narrow recessed joints.
    for(let n=-9;n<=9;n++){
      this.box('tile joint',[n*.8,-.01,0],[.025,.015,18],dark,this.environment);
      this.box('tile joint',[0,-.01,n*.8],[18,.015,.025],dark,this.environment);
    }
    this.box('distant cabin wall',[0,3,-6],[18,6,.16],mortar,this.environment);
    this.box('wall wainscot',[0,.65,-5.85],[18,1.3,.12],teal,this.environment);
    this.box('wall rail',[0,1.32,-5.7],[18,.1,.16],edge,this.environment);
    for(let y=1.5;y<5.7;y+=.32)for(let x=-8;x<8;x+=.8){this.box('brick',[x+(Math.round(y/.32)%2)*.4,y,-5.84],[.76,.27,.14],bricks[Math.abs(Math.floor(x+y))%2],this.environment);}
    this.buildNotice(wood, brass);
    this.light('room chandelier','#ffdda6',1.65,[-3,7,4],[0,1.5,0]);
    this.light('window moonlight','#9fc6d0',.8,[4,6,-2],[0,1.5,0]);
    this.light('soft front fill','#e1d5b8',.7,[1,5,7],[0,2,0]);
    this.light('screen bounce','#8bc4b0',.35,[0,3,2],[0,.8,0]);
    // Compact sit-down arcade: enamel shell, walnut cheeks, recessed CRT,
    // machined controls and a lockable service door. The room uses this same model.
    const steel=this.material('satin graphite steel','#252c2c',.7,.42);
    const enamel=this.material('ivory enamel trim','#c5be9d',.22,.5);
    const rubber=this.material('cast rubber plinth','#111919',.05,.22);
    this.box('rubber plinth',[0,.12,0],[3.95,.24,1.94],rubber);
    this.box('service pedestal',[0,.64,-.08],[3.8,1.08,1.68],teal);
    for(const x of [-1.97,1.97]){
      this.box('solid walnut cheek',[x,2.42,-.25],[.20,4.55,1.8],wood);
      this.box('brass edge piping',[x,2.46,.66],[.024,4.35,.035],brass);
      this.box('enamel shoulder',[x,4.72,-.12],[.19,.1,1.42],enamel);
    }
    this.box('CRT rear shell',[0,3.15,-.44],[3.78,3.04,1.31],teal);
    this.box('rear service cap',[0,3.1,-1.15],[3.36,2.69,.16],steel);
    for(const x of [-1.85,1.85])this.box('screen surround vertical',[x,3.12,.37],[.16,2.95,.38],rubber);
    for(const y of [1.66,4.58])this.box('screen surround horizontal',[0,y,.37],[3.85,.18,.38],rubber);
    for(const x of [-1.785,1.785])this.box('inset glass side',[x,3.12,.575],[.035,2.73,.028],steel);
    for(const y of [1.755,4.485])this.box('inset glass edge',[0,y,.575],[3.6,.035,.028],steel);
    this.box('marquee housing',[0,4.78,.02],[3.82,.28,1.4],teal);
    this.label('AFTER HOURS',[0,4.79,.744],[2.10,.17],'#dfd1a1','#182c27',252,28);
    for(const x of [-1.52,1.52])for(let n=0;n<7;n++)this.box('marquee speaker grille',[x+(n-3)*.055,4.79,.735],[.019,.13,.021],dark);
    this.box('sloping control deck',[0,1.20,1.03],[4.0,.20,1.04],steel).setLocalEulerAngles(8,0,0);
    this.box('control enamel inlay',[0,1.315,1.05],[3.83,.023,.84],teal).setLocalEulerAngles(8,0,0);
    this.box('rounded front rail',[0,1.13,1.56],[3.96,.12,.10],enamel);
    this.label('PLAYER 01',[-1.06,1.0,1.60],[.9,.11],'#c6ba8c','#1a2622',144,24);
    this.box('coin service recess',[.91,.74,.775],[.94,.99,.03],dark);
    this.box('coin service door',[.91,.74,.798],[.86,.91,.045],steel);
    this.box('brass token slot',[.91,.99,.86],[.46,.24,.08],brass);
    this.box('token slit',[.91,.99,.907],[.27,.024,.014],dark);
    this.label('ONE WISH',[.91,.72,.839],[.63,.10],'#c6ba8c','#182320',132,24);
    this.box('coin return',[.91,.45,.85],[.35,.15,.06],rubber);
    this.box('service lock',[1.23,.73,.85],[.05,.05,.04],brass,this.app.root,'cylinder').setEulerAngles(90,0,0);
    for(let n=0;n<12;n++)this.box('base cooling vent',[-1.15+n*.12,.62,.785],[.045,.38,.025],dark);
    for(const x of [-1.7,1.7])for(const z of [.74,1.37])this.box('recessed deck screw',[x,1.33,z],[.035,.012,.035],brass,this.app.root,'cylinder');
    this.box('joystick dust washer',[-1.15,1.39,1.08],[.34,.025,.34],dark,this.app.root,'cylinder');
    this.joystick=new pc.Entity('eight-way joystick');this.app.root.addChild(this.joystick);this.joystick.setPosition(-1.15,1.38,1.08);
    this.box('joystick shaft',[0,.13,0],[.045,.26,.045],steel,this.joystick,'cylinder');
    this.box('joystick ball',[0,.27,0],[.22,.22,.22],this.material('oxblood lacquer ball','#693a33',.12,.72),this.joystick,'sphere');
    [1,9,10,0,8,11].forEach((index,n)=>{
      const x=.25+(n%3)*.39,z=n<3?.85:1.23,y=n<3?1.40:1.35;
      this.box('button collar',[x,y,z],[.29,.024,.29],steel,this.app.root,'cylinder');
      const button=this.box(`action ${n+1}`,[x,y+.04,z],[.245,.065,.245],n<3?enamel:brass,this.app.root,'cylinder');
      this.controls.push({index,entity:button,home:button.getLocalPosition().clone()});
    });
    const start=this.box('start key',[-.34,1.43,.76],[.14,.035,.14],enamel,this.app.root,'cylinder');this.controls.push({index:3,entity:start,home:start.getLocalPosition().clone()});
    const credit=this.box('credit key',[-.59,1.43,.76],[.14,.035,.14],brass,this.app.root,'cylinder');this.controls.push({index:2,entity:credit,home:credit.getLocalPosition().clone()});
    this.coin=this.box('wish keepsake',[.91,.99,1.8],[.21,.035,.21],brass,this.app.root,'cylinder');this.coin.enabled=false;
    // 4:3 convex glass, shared by gameplay and the room's tiny attract screen.
    const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[];
    for(let y=0;y<=24;y++)for(let x=0;x<=32;x++){
      const u=x/32,v=y/24;positions.push((u-.5)*3.52,(v-.5)*2.64,.075*(1-(2*u-1)**2)*(1-(2*v-1)**2));normals.push(0,0,1);uvs.push(u,1-v);
      if(x<32&&y<24){const a=y*33+x;indices.push(a,a+1,a+33,a+1,a+34,a+33);}
    }
    this.mesh=new pc.Mesh(this.app.graphicsDevice);this.mesh.setPositions(positions);this.mesh.setNormals(normals);this.mesh.setUvs(0,uvs);this.mesh.setIndices(indices);this.mesh.update();
    this.texture.minFilter=pc.FILTER_LINEAR;
    const phosphor=this.material('live phosphor','#000000');phosphor.useLighting=false;phosphor.emissive=new pc.Color(1,1,1);phosphor.emissiveMap=this.texture;phosphor.update();
    const crt=new pc.Entity('curved CRT');crt.addComponent('render',{meshInstances:[new pc.MeshInstance(this.mesh,phosphor)]});this.app.root.addChild(crt);crt.setPosition(0,3.12,.585);
  }
  private buildNotice(wood: pc.StandardMaterial, brass: pc.StandardMaterial) {
    this.notice = new pc.Entity('freestanding wooden disclaimer');
    this.environment.addChild(this.notice);
    this.notice.setLocalPosition(-3.00, 0, -.48);
    this.notice.setLocalEulerAngles(0, 9, 0);
    for (const x of [-.49, .49]) {
      this.box('notice foot', [x,.075,.06], [.25,.15,.95], wood, this.notice);
      this.box('notice upright', [x,1.77,-.06], [.095,3.48,.11], wood, this.notice);
    }
    this.box('notice lower brace',[0,.39,-.06],[1.12,.095,.095],wood,this.notice);
    const board = new pc.Entity('clipped corner notice board');
    this.notice.addChild(board); board.setLocalPosition(0,3.12,0); board.setLocalEulerAngles(-5,0,0);
    const outline=[[-.70,-.88],[.70,-.88],[.78,-.80],[.78,.80],[.70,.88],[-.70,.88],[-.78,.80],[-.78,-.80]];
    const positions:number[]=[], normals:number[]=[],uvs:number[]=[],indices:number[]=[];
    for (const z of [.085,-.085]) for (const [x,y] of outline) {positions.push(x,y,z);normals.push(0,0,z>0?1:-1);uvs.push((x+.78)/1.56,(.88-y)/1.76);}
    for(let i=1;i<7;i++){indices.push(0,i,i+1,8,8+i+1,8+i);}
    for(let i=0;i<8;i++){const n=(i+1)%8;indices.push(i,8+i,n,n,8+i,8+n);}
    const mesh=this.noticeMesh=new pc.Mesh(this.app.graphicsDevice);
    mesh.setPositions(positions);mesh.setNormals(normals);mesh.setUvs(0,uvs);mesh.setIndices(indices);mesh.update();
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=864;
    const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#493422';ctx.fillRect(0,0,768,864);
    for(let y=0;y<864;y+=3){ctx.fillStyle=`rgba(16,9,3,${.035+.035*Math.sin(y*.73)})`;ctx.fillRect(0,y,768,1);}
    ctx.strokeStyle='#9a7847';ctx.lineWidth=3;ctx.strokeRect(35,35,698,794);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f4ddb0';
    ctx.font='600 65px Georgia, serif';ctx.fillText('DISCLAIMER',384,142);
    ctx.fillStyle='#bc9d68';ctx.fillRect(114,210,540,3);
    ctx.fillStyle='#ebd4ab';ctx.font='35px Georgia, serif';
    ['A non-commercial arcade.','Games & music belong to','their respective rights holders.','No affiliation or endorsement.','Rights inquiries:','Contact: Royalvice'].forEach((line,i)=>ctx.fillText(line,384,280+i*72));
    ctx.fillStyle='#c5a771';ctx.font='24px monospace';ctx.fillText('YZY  /  AFTER HOURS',384,771);
    const texture=new pc.Texture(this.app.graphicsDevice,{mipmaps:true,minFilter:pc.FILTER_LINEAR_MIPMAP_LINEAR,magFilter:pc.FILTER_LINEAR});texture.setSource(canvas);
    const ink=this.material('printed walnut disclaimer','#ffffff',.02,.2);ink.diffuseMap=texture;ink.emissive=color('#302a20');ink.emissiveMap=texture;ink.update();
    board.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,ink)],castShadows:true,receiveShadows:true});
    for(const x of [-.67,.67])for(const y of [-.76,.76])this.box('notice brass pin',[x,y,.098],[.026,.026,.014],brass,board,'sphere');
  }
  private label(text:string, position:number[], size:number[], fg:string,bg:string,width:number,height:number) {
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
    const scale=Math.max(1,Math.floor(Math.min((width-12)/(text.length*6),(height-8)/7)));
    pixelText(ctx,text,(width-text.length*6*scale)/2,(height-7*scale)/2,fg,scale);
    const texture=new pc.Texture(this.app.graphicsDevice,{mipmaps:false,minFilter:pc.FILTER_NEAREST,magFilter:pc.FILTER_NEAREST});texture.setSource(canvas);
    const material=this.material(text,'#000000');material.emissive=color('#ffffff');material.emissiveMap=texture;material.update();
    this.box(text,position,[size[0],size[1],.015],material);
  }
  insertCoin(){this.coinStart=this.clock;this.coin.enabled=!this.reducedMotion;this.app.renderNextFrame=true;}
  setDisplay(state: DisplayState, source: HTMLCanvasElement|null) { const changed=this.state.playing!==state.playing;this.state=state;this.source=source;this.lastPaint=-1;if(changed&&this.enabled)this.resize(); }
  setHeld(indices:number[]) {this.held=new Set(indices);}
  setActive(active:boolean) {this.enabled=active;if(!active)this.release();else{this.resize();this.lastPaint=-1;}}
  private resize=()=>{
    const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const ratio=Math.min(devicePixelRatio,1.5,1280/rect.width);
    this.app.graphicsDevice.resizeCanvas(Math.round(rect.width*ratio),Math.round(rect.height*ratio));
    this.canvas.style.width='100%';this.canvas.style.height='100%';
    this.camera.lookAt(-.67,this.state.playing?2.78:2.53,0);
    this.camera.camera!.orthoHeight=Math.max(this.state.playing?2.30:2.60,3.26/(rect.width/rect.height));
    this.app.renderNextFrame=true;
  };
  private paint() {
    const ctx=this.screen.getContext('2d')!;ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='#071310';ctx.fillRect(0,0,640,480);
    if(this.source&&this.state.playing) {
      const w=this.state.vertical?360:640, h=480;
      if(this.source.width&&this.source.height)ctx.drawImage(this.source,(640-w)/2,0,w,h);
      // Keep gameplay sharp: the CRT curvature is geometry, not a blur pass.
    } else {
      ctx.strokeStyle='#476a56';ctx.lineWidth=2;ctx.strokeRect(24,24,592,432);
      pixelText(ctx,'YZY  /  AFTER HOURS',48,49,'#87b59c',2);
      pixelText(ctx,`${this.state.system}  ${this.state.year}`,48,85,'#6f8c80',2);
      const lines=wrapPixelText(this.state.name,22);
      lines.forEach((line,i)=>pixelText(ctx,line,48,156+i*43,'#eddda9',4));
      ctx.fillStyle='#a0874c';ctx.fillRect(48,284,96,3);
      wrapPixelText(this.state.message,40).forEach((line,i)=>pixelText(ctx,line,48,320+i*22,'#9bb6a5',2));
      pixelText(ctx,Number.isFinite(this.state.coins)?`WISH COIN  ${this.state.coins}`:'FREE PLAY  /  MAKE YOURSELF AT HOME',48,420,'#ccb57a',2);
    }
    if(this.state.paused&&this.state.playing) {ctx.fillStyle='rgba(3,11,8,.8)';ctx.fillRect(160,203,320,66);pixelText(ctx,'PAUSED',247,224,'#eddeac',4);}
    this.texture.setSource(this.screen);
  }
  private update=(dt:number)=>{
    if(!this.enabled||document.hidden||this.lost)return;
    this.clock+=Math.min(dt,.05);
    const age=this.clock-this.coinStart;this.coin.enabled=age>=0&&age<1.15;
    if(this.coin.enabled){const t=Math.min(1,age/1.15);this.coin.setPosition(.91,.99+Math.sin(t*Math.PI)*.22,1.85-t*.96);this.coin.setEulerAngles(0,t*720,0);this.coin.setLocalScale(.21*(1-t*.65),.035,.21*(1-t*.65));}

    for(const control of this.controls){const pressed=this.held.has(control.index);const p=control.home.clone();if(pressed){if(control.index===2)p.z-=.03;else p.y-=.05;}control.entity.setLocalPosition(p);}
    this.joystick.setLocalEulerAngles((this.held.has(5)?1:0)*15-(this.held.has(4)?1:0)*15,0,(this.held.has(6)?1:0)*15-(this.held.has(7)?1:0)*15);
    if(this.source||this.lastPaint<0){this.paint();this.lastPaint=this.clock;}
    this.app.renderNextFrame=true;
  };
  private project(entity:pc.Entity) {const p=this.camera.camera!.worldToScreen(entity.getPosition());return {x:p.x,y:p.y};}
  private pointerDown=(event:PointerEvent)=>{
    const rect=this.canvas.getBoundingClientRect(), x=event.clientX-rect.left,y=event.clientY-rect.top;
    const slot=this.camera.camera!.worldToScreen(new pc.Vec3(.91,.99,.91));
    if(Math.hypot(x-slot.x,y-slot.y)<Math.max(18,rect.width*.035)){event.preventDefault();this.onInsert();return;}
    const joystick=this.project(this.joystick);
    let index=-1;
    if(Math.hypot(x-joystick.x,y-joystick.y)<Math.max(27,rect.width*.06))index=-2;
    else {let distance=Infinity;for(const control of this.controls){const p=this.project(control.entity),d=Math.hypot(x-p.x,y-p.y);if(d<Math.max(18,rect.width*.025)&&d<distance){distance=d;index=control.index;}}}
    if(index===-1)return;
    event.preventDefault();this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId,{index,x:event.clientX,y:event.clientY});
    if(index>=0)this.onInput(index,true,`mesh:${event.pointerId}`);
  };
  private pointerMove=(event:PointerEvent)=>{
    const pointer=this.pointers.get(event.pointerId);if(pointer?.index!==-2)return;
    const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
    for(const [index,held] of [[4,dy< -9],[5,dy>9],[6,dx< -9],[7,dx>9]] as const)this.onInput(index,held,`mesh:${event.pointerId}`);
  };
  private pointerUp=(event:PointerEvent)=>{const pointer=this.pointers.get(event.pointerId);if(!pointer)return;for(const index of pointer.index===-2?[4,5,6,7]:[pointer.index])this.onInput(index,false,`mesh:${event.pointerId}`);this.pointers.delete(event.pointerId);};
  release(){for(const [id,p] of this.pointers)for(const index of p.index===-2?[4,5,6,7]:[p.index])this.onInput(index,false,`mesh:${id}`);this.pointers.clear();this.held.clear();}
  private contextLost=(event:Event)=>{event.preventDefault();this.lost=true;this.release();};
  private contextRestored=()=>{this.lost=false;this.lastPaint=-1;};
  async captureRoomView():Promise<{image:string;screenRect:number[];pivot:number[]}> {
    this.resizeObserver.disconnect();
    const position=this.camera.getPosition().clone(),rotation=this.camera.getRotation().clone(),height=this.camera.camera!.orthoHeight;
    this.environment.enabled=false;this.camera.camera!.clearColor=new pc.Color(0,0,0,0);
    this.canvas.style.width='512px';this.canvas.style.height='512px';this.app.graphicsDevice.resizeCanvas(512,512);
    this.camera.setPosition(0,10.4,8);this.camera.lookAt(0,2.4,0);this.camera.camera!.orthoHeight=3.2;
    this.enabled=true;this.paint();
    const frame=await new Promise<HTMLCanvasElement>(resolve=>{this.app.once('postrender',()=>{const out=document.createElement('canvas');out.width=512;out.height=512;out.getContext('2d')!.drawImage(this.canvas,0,0);resolve(out);});this.app.renderNextFrame=true;});
    const camera=this.camera.camera!;
    const top=camera.worldToScreen(new pc.Vec3(-1.76,4.44,.585));const bottom=camera.worldToScreen(new pc.Vec3(1.76,1.80,.585));
    const context=frame.getContext('2d')!;context.clearRect(top.x,top.y,bottom.x-top.x,bottom.y-top.y);
    const foot=camera.worldToScreen(new pc.Vec3(0,0,.97));
    const result={image:frame.toDataURL('image/png'),screenRect:[top.x/512,top.y/512,(bottom.x-top.x)/512,(bottom.y-top.y)/512],pivot:[.5,foot.y/512]};
    this.environment.enabled=true;this.camera.camera!.clearColor=color('#0b1614');this.camera.setPosition(position);this.camera.setRotation(rotation);this.camera.camera!.orthoHeight=height;this.resizeObserver.observe(this.canvas.parentElement!);this.resize();
    return result;
  }
  snapshot(){return {renderer:'PlayCanvas',screen:'curved-live-texture',screenVertices:825,controls:this.controls.length,contexts:1,active:this.enabled,lost:this.lost,buffer:[this.canvas.width,this.canvas.height],targets:this.controls.map(control=>({index:control.index,...this.project(control.entity)})),joystick:this.project(this.joystick),screenBounds:[this.camera.camera!.worldToScreen(new pc.Vec3(-1.76,4.44,.585)),this.camera.camera!.worldToScreen(new pc.Vec3(1.76,1.80,.585))].map(p=>({x:p.x,y:p.y})),notice:{type:'freestanding-chamfered-wood',feetY:0,center:this.project(this.notice)},coinAnimating:this.coin.enabled};}
  destroy(){this.release();this.resizeObserver.disconnect();this.app.off('update',this.update);for(const [name,fn] of [['pointerdown',this.pointerDown],['pointermove',this.pointerMove],['pointerup',this.pointerUp],['pointercancel',this.pointerUp],['lostpointercapture',this.pointerUp],['webglcontextlost',this.contextLost],['webglcontextrestored',this.contextRestored]] as const)this.canvas.removeEventListener(name,fn as EventListener);this.texture.destroy();for(const m of this.materials){if(m.emissiveMap&&m.emissiveMap!==this.texture)m.emissiveMap.destroy();if(m.diffuseMap && m.diffuseMap!==m.emissiveMap)m.diffuseMap.destroy();m.destroy();}this.noticeMesh.destroy();this.mesh.destroy();this.app.destroy();}
}
