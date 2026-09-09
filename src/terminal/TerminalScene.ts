import { ROOM_PROJECTION } from "../profile/roomProjection";
import * as pc from "playcanvas";
import type { NewsItem } from "../content/site";
import { TERMINAL_KEYS, type TerminalKey } from "./keyboard";
import { pixelText } from "./pixelFont";
import { TerminalProgram, type TerminalActions } from "./TerminalProgram";

type Cap = { spec: TerminalKey; root: pc.Entity; mesh: pc.MeshInstance; material: pc.StandardMaterial; y: number; travel: number; held: boolean; pulse: number };
const color = (hex: string): pc.Color => new pc.Color().fromString(hex);

/** A self-contained WebGL scene. No hardware images or HTML screen overlays. */
export class TerminalScene {
  private app: pc.Application;
  private camera: pc.Entity;
  private world: pc.Entity;
  private environment:pc.Entity;
  private docked=true;
  private atmosphere="day";
  private keyLight!:pc.Entity;
  private screenGlow!:pc.Entity;
  private caps: Cap[]=[];
  private screen!: pc.Entity;
  private screenMaterial!: pc.StandardMaterial;
  private displayTexture!: pc.Texture;
  private cabinTexture:pc.Texture|null=null;
  private latestCabinCanvas:HTMLCanvasElement|null=null;
  private cabinFrame=(event:Event)=>{const canvas=(event as CustomEvent<HTMLCanvasElement>).detail;if(canvas?.width&&canvas.height){this.latestCabinCanvas=canvas;if(this.cabinTexture&&!this.docked){this.cabinTexture.setSource(canvas);this.dirty=true;}}};
  private materials: pc.Material[]=[];
  private textures: pc.Texture[]=[];
  private meshes: pc.Mesh[]=[];
  private resizeObserver!: ResizeObserver;
  private visibilityObserver!: IntersectionObserver;
  private visible=true; private lost=false; private destroyed=false; private dirty=true;
  private elapsed=0; private screenClock=0; private yaw=.08;
  private readingView=false;
  private captureActive=false;
  private hovered: Cap|null=null; private pointerCap: Cap|null=null;
  private drag: {x:number;y:number;yaw:number; moved:boolean}|null=null;
  private pressed = new Set<string>();
  private dockFrame=document.createElement('canvas');
  private highlight!: pc.StandardMaterial;
  private cursor = new pc.Vec3();
  readonly program: TerminalProgram;

  constructor(private canvas: HTMLCanvasElement, news: NewsItem[], private reducedMotion: boolean, private actions: TerminalActions, private onChange: (text: string)=>void) {
    this.app=new pc.Application(canvas,{graphicsDeviceOptions:{alpha:true,antialias:false,powerPreference:"low-power"}});
    this.camera=new pc.Entity("terminal-camera",this.app);
    this.world=new pc.Entity("terminal-workstation",this.app);
    this.environment=new pc.Entity("the port-side research desk",this.app);
    this.program=new TerminalProgram(news,{...actions,view:delta=>this.setView(delta),room:signal=>{this.setAtmosphere(signal);actions.room(signal);}});
  }
  async init(): Promise<void> {
    this.app.setCanvasFillMode(pc.FILLMODE_NONE);
    this.app.setCanvasResolution(pc.RESOLUTION_FIXED);
    this.app.scene.ambientSource=pc.AMBIENTSRC_CONSTANT;
    this.app.scene.ambientLight=new pc.Color(.25,.28,.24);
    this.app.scene.exposure=1;
    this.app.root.addChild(this.world);
    this.world.addChild(this.environment);
    this.camera.addComponent("camera",{projection:pc.PROJECTION_ORTHOGRAPHIC,nearClip:.1,farClip:40,clearColor:color("#0c1914"),gammaCorrection:pc.GAMMA_SRGB,toneMapping:pc.TONEMAP_ACES});
    this.app.root.addChild(this.camera);
    this.build();
    window.addEventListener("cabin:window-frame",this.cabinFrame);
    this.setDocked(this.docked);
    this.app.autoRender=false;
    this.app.on("update",this.update);
    this.app.on('postrender',()=>{
      if(!this.docked||!this.canvas.width||!this.canvas.height)return;
      this.dockFrame.width=this.canvas.width;this.dockFrame.height=this.canvas.height;
      this.dockFrame.getContext('2d')!.drawImage(this.canvas,0,0);
      this.canvas.dispatchEvent(new CustomEvent('terminal:dock-frame',{bubbles:true,detail:this.dockFrame}));
    });
    this.app.start();
    this.app.renderNextFrame=true;
    this.resizeObserver=new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(this.canvas.parentElement!);
    this.visibilityObserver=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;this.dirty=true;},{rootMargin:"120px"});
    this.visibilityObserver.observe(this.canvas);
    this.canvas.addEventListener("pointerdown",this.pointerDown);
    this.canvas.addEventListener("pointermove",this.pointerMove);
    this.canvas.addEventListener("pointerup",this.pointerUp);
    this.canvas.addEventListener("pointercancel",this.pointerCancel);
    this.canvas.addEventListener("pointerleave",this.pointerLeave);
    this.canvas.addEventListener("lostpointercapture",this.pointerCancel);
    this.canvas.addEventListener("keydown",this.keyDown);
    this.canvas.addEventListener("keyup",this.keyUp);
    this.canvas.addEventListener("blur",this.releaseAll);
    this.canvas.addEventListener("paste",this.paste);
    this.canvas.addEventListener("wheel",this.wheel,{passive:false});
    this.canvas.addEventListener("webglcontextlost",this.contextLost);
    this.canvas.addEventListener("webglcontextrestored",this.contextRestored);
    document.addEventListener("visibilitychange",this.visibilityChange);
    (window as any).__terminal3D={getState:()=>this.snapshot()};
    if(new URLSearchParams(location.search).get('profile-gif-export')==='1') {
      (window as any).__terminal3D.capture={
        newsIds:this.program.news.map(item=>item.id),
        begin:()=>{
          this.captureActive=true;
          this.app.off('update',this.update);
          window.removeEventListener('cabin:window-frame',this.cabinFrame);
          this.resizeObserver.disconnect();
          this.setDocked(false);this.resize();
          this.app.graphicsDevice.resizeCanvas(1920,1080);
          this.camera.camera!.orthoHeight=3.15;
          this.resetCapture();
        },
        reset:()=>this.resetCapture(),
        press:(code:string)=>{const cap=this.caps.find(c=>c.spec.code===code);if(!cap)throw new Error('Unknown capture key '+code);this.program.press(cap.spec,true);cap.pulse=.10;this.dirty=true;},
        render:(time:number)=>{
          this.visible=true;
          this.update(1/24);
          this.program.draw(time,false,false);this.displayTexture.upload();
          this.app.render();
          this.app.renderNextFrame=false;
          return this.snapshot();
        }
      };
    }
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    this.canvas.closest<HTMLElement>(".terminal-shell")!.dataset.renderer="web3d";
  }
  private resetCapture():void {
    this.releaseAll();
    Object.assign(this.program,{input:'',cursor:0,selected:0,scroll:0,mode:'news',caps:false,shift:false,ctrl:false,alt:false,meta:false,fn:false,brightness:1,lastKey:'',status:'FOLLOW',message:'',history:[],historyIndex:0,selectAll:false,output:[],outputScroll:0});
    this.program.filesystem.run('cd ~');
    for(const cap of this.caps){cap.travel=cap.pulse=0;cap.held=false;cap.root.setLocalPosition(cap.root.getLocalPosition().x,cap.y,cap.root.getLocalPosition().z);cap.mesh.material=cap.material;}
    this.hovered=null;this.yaw=.08;this.positionCamera();this.elapsed=0;this.screenClock=0;this.dirty=true;
  }
  setDocked(docked:boolean):void {
    this.docked=docked;this.environment.enabled=!docked;
    if(!docked&&this.cabinTexture&&this.latestCabinCanvas)this.cabinTexture.setSource(this.latestCabinCanvas);
    this.camera.camera!.clearColor=docked?new pc.Color(0,0,0,0):color("#171d17");
    this.canvas.tabIndex=docked?-1:0;
    this.releaseAll();this.resize();
  }
  private setAtmosphere(signal:string):void {
    if(signal==="door"){this.program.message="ANYWHERE DOOR / UNLOCKED";return;}
    this.atmosphere=signal;
    this.keyLight.light!.color=color(signal==="night"?"#91b9ea":"#ffead0");
    this.keyLight.light!.intensity=signal==="night"?.85:1.55;
    this.dirty=true;
  }
  setStatus(status:string): void {this.program.status=status;this.dirty=true;}
  refresh(index:number): void {if(!this.program.input && document.activeElement!==this.canvas)this.program.selected=index;this.dirty=true;}
  resize(): void {
    if(this.captureActive){
      this.app.graphicsDevice.resizeCanvas(1920,1080);
      this.camera.camera!.aspectRatioMode=pc.ASPECT_MANUAL;
      this.camera.camera!.aspectRatio=1920/1080;
      this.camera.camera!.orthoHeight=3.15;
      this.readingView=false;this.positionCamera();this.dirty=true;return;
    }
    const {width,height}=this.canvas.getBoundingClientRect(); if(!width || !height)return;
    // Square pixels, capped resolution; the camera fits the world to CSS aspect.
    const scale=Math.min(1.35,1000/width);
    this.app.graphicsDevice.resizeCanvas(Math.round(width*scale),Math.round(height*scale));
    this.camera.camera!.aspectRatioMode=pc.ASPECT_MANUAL;
    this.camera.camera!.aspectRatio=width/height;
    this.readingView=width<=600 && !!this.canvas.closest("dialog");
    this.camera.camera!.orthoHeight=this.docked?Math.max(2.65,3.0/(width/height)):this.readingView?2.98/(width/height):Math.max(2.85,3.5/(width/height));
    this.positionCamera();this.dirty=true;
  }
  private positionCamera():void {
    const yaw=this.docked?0:this.yaw;
    this.camera.setPosition(Math.sin(yaw)*10,this.docked?2+9.55*Math.tan(ROOM_PROJECTION.pitchDegrees*Math.PI/180):6.5,Math.cos(yaw)*10);
    this.camera.lookAt(0,2.00,.45);
  }
  private setView(delta:number):void {this.yaw=delta===0?.08:Math.max(-.3,Math.min(.3,this.yaw+delta*.12));this.positionCamera();this.dirty=true;}
  private material(name:string,hex:string,metalness=0,gloss=30): pc.StandardMaterial {
    const m=new pc.StandardMaterial();m.name=name;m.diffuse=color(hex);m.useMetalness=true;m.metalness=metalness;m.gloss=gloss/100;m.update();this.materials.push(m);return m;
  }
  private meshEntity(name:string,positions:number[],indices:number[],mat:pc.Material,parent=this.world,uvs?:number[]):pc.Entity {
    const mesh=new pc.Mesh(this.app.graphicsDevice);mesh.setPositions(positions);mesh.setNormals(pc.calculateNormals(positions,indices));if(uvs)mesh.setUvs(0,uvs);mesh.setIndices(indices);mesh.update();this.meshes.push(mesh);
    const entity=new pc.Entity(name,this.app);entity.addComponent("render",{type:"asset",meshInstances:[new pc.MeshInstance(mesh,mat)]});parent.addChild(entity);return entity;
  }
  private box(name:string,mat:pc.Material,pos:number[],size:number[],parent=this.world):pc.Entity {
    const e=new pc.Entity(name,this.app);e.addComponent("render",{type:"box",material:mat});e.setLocalPosition(...pos as [number,number,number]);e.setLocalScale(...size as [number,number,number]);parent.addChild(e);return e;
  }
  private bevel(name:string,mat:pc.Material,w:number,h:number,d:number,b:number,parent=this.world):pc.Entity {
    const positions:number[]=[],indices:number[]=[];
    const levels=[[-h/2,w/2-b,d/2-b],[-h/2+b,w/2,d/2],[h/2-b,w/2,d/2],[h/2,w/2-b,d/2-b]];
    const ring=(level:number[])=>{const [y,x,z]=level;return [[-x,y,-z],[x,y,-z],[x,y,z],[-x,y,z]];};
    const face=(vs:number[][])=>{const start=positions.length/3;vs.forEach(v=>positions.push(...v));indices.push(start,start+1,start+2,start,start+2,start+3);};
    for(let j=0;j<3;j++){const a=ring(levels[j]),b=ring(levels[j+1]);for(let i=0;i<4;i++){const k=(i+1)%4;face([a[i],b[i],b[k],a[k]]);}}
    face(ring(levels[3]).reverse());face(ring(levels[0]));
    return this.meshEntity(name,positions,indices,mat,parent);
  }
  private texture(canvas:HTMLCanvasElement,name:string):pc.Texture {
    const t=new pc.Texture(this.app.graphicsDevice,{name,width:canvas.width,height:canvas.height,format:pc.PIXELFORMAT_RGBA8,mipmaps:false,minFilter:pc.FILTER_NEAREST,magFilter:pc.FILTER_NEAREST,addressU:pc.ADDRESS_CLAMP_TO_EDGE,addressV:pc.ADDRESS_CLAMP_TO_EDGE});
    t.setSource(canvas);this.textures.push(t);return t;
  }
  private panel(name:string,w:number,h:number,mat:pc.Material,parent=this.world,uv=[0,0,1,1]):pc.Entity {
    const [u,v,r,b]=uv;const e=this.meshEntity(name,[-w/2,-h/2,0,w/2,-h/2,0,w/2,h/2,0,-w/2,h/2,0],[0,1,2,0,2,3],mat,parent,[u,b,r,b,r,v,u,v]);
    e.render!.castShadows=false;return e;
  }
  private plaque(text:string,w:number,h:number,ink:string,background:string):pc.StandardMaterial {
    const c=document.createElement("canvas");c.width=Math.max(64,text.length*6+12);c.height=20;const ctx=c.getContext("2d")!;
    ctx.fillStyle=background;ctx.fillRect(0,0,c.width,c.height);pixelText(ctx,text,6,6,ink);
    const mat=this.material(text,"#ffffff",0,18);mat.diffuseMap=this.texture(c,text);mat.update();return mat;
  }
  private build(): void {
    const ivory=this.material("warm mineral enamel","#a5aa97",.08,38), trim=this.material("edge highlights","#c4c6aa",.08,44);
    const dark=this.material("deep verdigris casing","#223a32",.14,32), black=this.material("rubber and key wells","#0b1612",0,8);
    const brass=this.material("old brass","#ac803b",.65,52), wood=this.material("dark walnut","#6e4726",.03,24);
    const grain=this.material("walnut grain","#2b211a",0,12), wall=this.material("room wall","#281a11",0,12);
    this.highlight=this.material("key hover amber","#cc9c50",.28,40);
    const env=this.environment;
    const table=this.bevel("port-side desk / walnut",wood,7.9,.34,4.4,.08,env);table.setLocalPosition(0,-.19,.7);
    this.box("desktop raised edge",wood,[0,-.035,2.90],[8.04,.09,.12],env);
    this.box("desk front trim",brass,[0,-.11,2.915],[7.5,.024,.028],env);
    this.box("back wall",wall,[0,2.6,-1.75],[11,7,.18],env);
    const brick=this.material("dungeon warm brick","#49301a",0,12),brickDark=this.material("dungeon alternate brick","#3d2818",0,10);
    for(let row=0;row<10;row++)for(let col=0;col<17;col++)this.box("wall brick",(row+col)%3?brick:brickDark,[-5.6+col*.72+(row%2)*.36,1.3+row*.37,-1.63],[.67,.30,.06],env);
    const teal=this.material("dungeon teal tiles","#1d4137",0,20);
    for(let row=0;row<3;row++)for(let col=0;col<14;col++)this.box("teal lower wall tile",teal,[-5.2+col*.81,.12+row*.38,-1.58],[.77,.35,.06],env);
    this.box("wood dado rail",wood,[0,1.14,-1.5],[11,.11,.17],env);
    for(let i=0;i<26;i++)this.box("wood grain "+i,grain,[Math.sin(i*7)*.3,-.012,-1.05+i*.15],[7.45-(i%5)*.2,.008,.012],env);
    for(const x of [-3.55,3.55]){
      this.box("desk leg",wood,[x,-.72,1.9],[.24,1.15,.26],env);
      if(x>0){
        this.box("central desk drawer",wood,[0,-.44,2.52],[2.3,.39,.5],env);
        this.box("drawer brass pull",brass,[0,-.44,2.785],[.23,.055,.05],env);
      }
    }
    // The blackboard hangs above the research station; the ship window is to its right.
    this.box("blackboard timber frame",wood,[-1.0,3.30,-1.48],[2.6,1.25,.19],env);
    this.box("blackboard",this.material("blackboard enamel","#12453c"),[-1.0,3.3,-1.36],[2.38,1.04,.055],env);
    const chalk=this.material("chalk","#a9c7b0");
    for(let i=0;i<3;i++)this.box("chalk research notes",chalk,[-1.45+i*.22,3.5-i*.24,-1.322],[.75-i*.17,.024,.01],env);
    this.box("blackboard ledge",wood,[-1.0,2.66,-1.25],[2.7,.085,.33],env);
    const lampGlass=this.material("warm lamp glass","#e1b656",.05,55);lampGlass.emissive=color("#f4b94d");lampGlass.emissiveIntensity=.65;lampGlass.update();
    for(const x of [-3.3,3.3]){
      this.box("fuel lamp bracket",brass,[x,4.35,-1.37],[.09,.44,.11],env);
      this.box("fuel lamp",lampGlass,[x,3.93,-1.19],[.19,.34,.16],env);
      for(const offset of [-.13,.13])this.box("lamp cage",dark,[x+offset,3.93,-1.08],[.038,.44,.04],env);
      for(const y of [3.69,4.16])this.box("lamp cap",brass,[x,y,-1.16],[.33,.09,.3],env);
    }
    // Same ship window, rendered once by the cabin and projected onto this 3D opening.
    this.cabinTexture=new pc.Texture(this.app.graphicsDevice,{name:'shared cabin window',width:288,height:120,mipmaps:false,minFilter:pc.FILTER_NEAREST,magFilter:pc.FILTER_NEAREST});this.textures.push(this.cabinTexture);
    const moonView=this.material('moonlit ship window','#ffffff');moonView.diffuse.set(0,0,0);moonView.emissive.set(1,1,1);moonView.emissiveMap=this.cabinTexture;moonView.emissiveIntensity=.7;moonView.update();
    this.box('deep window reveal',grain,[4.1,3.4,-1.31],[4.65,2.05,.24],env);
    const shipWindow=this.panel('OASIS ship window',4.32,1.80,moonView,env);shipWindow.setLocalPosition(4.1,3.4,-1.16);
    for(const y of [2.42,4.38])this.box('window timber sill',wood,[4.1,y,-1.04],[4.75,.13,.38],env);
    for(const x of [1.80,6.40])this.box('window jamb',wood,[x,3.4,-1.10],[.14,2.03,.25],env);
    for(const x of [-5.1,1.38,6.65])this.box('cabin oak beam',wood,[x,2.5,-1.40],[.18,6,.3],env);
    this.box('task lamp foot',brass,[-3.05,.08,.25],[.64,.12,.43],env);this.box('task lamp stem',brass,[-3.05,.62,.25],[.07,1.04,.07],env);this.box('task lamp shade',brass,[-3.05,1.16,.27],[1,.14,.50],env);this.box('task lamp light',lampGlass,[-3.05,1.07,.29],[.85,.035,.4],env);
    const paper=this.material("research notebook paper","#d4c59a",0,5);
    this.box("notebook leather cover",grain,[-3.19,.025,1.9],[.75,.06,.7],env);
    this.box("open notebook",paper,[-3.19,.065,1.9],[.69,.025,.65],env);
    this.box("notebook spine",wood,[-3.19,.08,1.9],[.02,.01,.65],env);
    for(let i=0;i<4;i++)this.box("notebook writing",grain,[-3.0,.083,1.67+i*.11],[.22,.006,.012],env);
    // The chassis is built in stepped solids; side vents remain actual geometry.
    const housing=this.bevel("CRT rear shell",dark,4.75,3.40,1.26,.13);housing.setLocalPosition(0,2.65,-.11);
    const top=this.bevel("CRT crown",ivory,4.81,.31,1.23,.08);top.setLocalPosition(0,4.27,-.11);
    this.box("CRT chin",ivory,[0,1.12,.55],[4.74,.46,.38]);
    this.box("bezel left",ivory,[-2.19,2.73,.57],[.4,2.97,.38]);
    this.box("bezel right",ivory,[2.19,2.73,.57],[.4,2.97,.38]);
    this.box("bezel upper",ivory,[0,4.14,.57],[4.6,.34,.38]);
    this.box("upper bevel glint",trim,[0,4.28,.75],[4.55,.042,.033]);
    this.box("lower edge brass",brass,[0,.905,.76],[4.55,.028,.05]);
    // Recessed gasket and lip around the curved screen.
    this.box("screen recess",black,[0,2.73,.60],[4.22,2.74,.18]);
    for(const [x,y,w,h] of [[-2.05,2.73,.08,2.67],[2.05,2.73,.08,2.67],[0,4.04,4.1,.08],[0,1.42,4.1,.08]])this.box("glass rim",brass,[x,y,.752],[w,h,.035]);
    for(let i=0;i<18;i++)this.box("top ventilation "+i,black,[-1.86+i*.218,4.432,-.2],[.105,.01,.51]);
    for(let i=0;i<9;i++)this.box("side ventilation "+i,black,[2.382,1.55+i*.21,-.21],[.012,.065,.69]);
    const label=this.panel("YZY badge",1.12,.16,this.plaque("YZY / 01",1.12,.16,"#292f20","#b9a269"));label.setLocalPosition(-1.38,1.105,.753);
    for(let i=0;i<3;i++)this.box("front adjustment button "+i,dark,[1.4+i*.18,1.1,.77],[.115,.11,.06]);
    const led=this.material("amber power light","#b89c44",0,30);led.emissive=color("#f2bc55");led.emissiveIntensity=1.3;led.update();this.box("power LED",led,[1.1,1.1,.77],[.045,.045,.045]);
    const neck=this.bevel("pedestal",dark,1.28,.62,.83,.07);neck.setLocalPosition(0,.67,-.02);
    const foot=this.bevel("pedestal foot",black,2.4,.15,1.1,.055);foot.setLocalPosition(0,.2,.06);
    // A convex tessellated glass surface with a live nearest-filtered texture.
    this.program.draw(0,this.reducedMotion);
    this.displayTexture=this.texture(this.program.canvas,"live CRT framebuffer");
    // Average minified phosphor strokes instead of dropping whole pixel rows.
    // Magnification still preserves the authored five-by-seven pixel glyphs.
    this.displayTexture.minFilter=pc.FILTER_LINEAR;
    this.screenMaterial=this.material("phosphor glass","#000000",0,72);
    this.screenMaterial.emissiveMap=this.displayTexture;this.screenMaterial.emissive=color("#ffffff");this.screenMaterial.emissiveIntensity=.9;this.screenMaterial.useLighting=false;this.screenMaterial.update();
    const positions:number[]=[],indices:number[]=[],uvs:number[]=[];const nx=24,ny=16;
    for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const u=x/nx,v=y/ny;positions.push((u-.5)*4.02,(v-.5)*2.52,.072*(1-(2*u-1)**2)*(1-(2*v-1)**2));uvs.push(u,1-v);}
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const i=y*(nx+1)+x;indices.push(i,i+1,i+nx+2,i,i+nx+2,i+nx+1);}
    this.screen=this.meshEntity("curved CRT screen",positions,indices,this.screenMaterial,this.world,uvs);this.screen.setLocalPosition(0,2.73,.755);this.screen.render!.castShadows=false;
    // Mechanical keyboard: every cap has its own transform and ray-tested mesh.
    const keyboard=new pc.Entity("keyboard",this.app);keyboard.setLocalPosition(0,.29,1.66);keyboard.setLocalEulerAngles(9,0,0);this.world.addChild(keyboard);
    const board=this.bevel("keyboard case",dark,5.66,.28,2.14,.07,keyboard);
    this.box("keyboard plate",brass,[0,.153,0],[5.45,.055,1.95],keyboard);
    this.box("switch bed",black,[0,.187,0],[5.36,.025,1.85],keyboard);
    const keyIvory=this.material("ivory keycaps","#bcb99e",.03,25),keyDark=this.material("teal function keys","#344e43",.05,25);
    const atlas=document.createElement("canvas");atlas.width=1024;atlas.height=512;const ctx=atlas.getContext("2d")!;
    TERMINAL_KEYS.forEach((key,i)=>{const x=(i%16)*64,y=Math.floor(i/16)*64,scale=key.label.length<=2?3:2;pixelText(ctx,key.label,x+Math.round((64-key.label.length*6*scale)/2),y+Math.round((64-7*scale)/2),key.accent?"#282d1b":key.value?"#394033":"#c9b992",scale);});
    const legend=this.material("pixel key legends","#ffffff");legend.diffuseMap=this.texture(atlas,"procedural key legends");legend.opacityMap=legend.diffuseMap;legend.opacityMapChannel="a";legend.alphaTest=.5;legend.update();
    const unit=.325;
    for(const [i,spec] of TERMINAL_KEYS.entries()){
      const root=new pc.Entity("key-"+spec.code,this.app);const rowX=spec.row===0?.3:0;
      root.setLocalPosition((spec.x+spec.width/2-8)*unit+rowX,.252,-.786+spec.row*.315);keyboard.addChild(root);
      const mat=spec.accent?brass:spec.value?keyIvory:keyDark;
      const cap=this.bevel("keycap-"+spec.code,mat,spec.width*unit-.043,.145,.272,.027,root);
      const x=i%16/16,y=Math.floor(i/16)/8;
      const glyph=this.panel("legend-"+spec.code,Math.min(spec.width*unit-.045,.44),.24,legend,root,[x,y,x+1/16,y+1/8]);
      glyph.setLocalEulerAngles(-90,0,0);glyph.setLocalPosition(0,.076,0);
      this.caps.push({spec,root,mesh:cap.render!.meshInstances[0],material:mat,y:.252,travel:0,held:false,pulse:0});
    }
    // A segmented, deliberately pixel-shaped cable runs along the left edge.
    for(let i=0;i<14;i++)this.box("coiled cable "+i,black,[-2.95-Math.sin(i*.9)*.12,.095,.75-i*.12],[.10,.11,.17]);
    const deskLabel=this.panel("desk nameplate",2.1,.19,this.plaque("YZY / RESEARCH DESK",2.1,.19,"#ba995a","#20372d"),env);deskLabel.setLocalPosition(-2.18,-.16,2.916);
    const keyLight=this.keyLight=new pc.Entity("warm desk light",this.app);keyLight.addComponent("light",{type:"directional",color:color("#ffead0"),intensity:1.55,castShadows:true,shadowResolution:2048,shadowDistance:18,shadowType:pc.SHADOW_PCF3,shadowBias:.2,normalOffsetBias:.025});keyLight.setLocalEulerAngles(48,-25,0);this.app.root.addChild(keyLight);
    const fill=new pc.Entity("cool room bounce",this.app);fill.addComponent("light",{type:"directional",color:color("#8cb3a1"),intensity:.6,castShadows:false});fill.setLocalEulerAngles(25,145,0);this.app.root.addChild(fill);
    const glow=this.screenGlow=new pc.Entity("screen light spill",this.app);glow.addComponent("light",{type:"omni",color:color("#a3bfd3"),intensity:.8,range:3,castShadows:false});glow.setPosition(0,1.75,1.45);this.app.root.addChild(glow);
  }
  private update=(dt:number):void=>{
    if(this.destroyed || this.lost || !this.visible || document.hidden)return;
    const step=Math.min(dt,.05);this.elapsed+=step;this.screenClock+=step;
    let moving=false;
    for(const cap of this.caps){
      cap.pulse=Math.max(0,cap.pulse-step);
      const target=cap.held || cap.pulse>0?.085:0;
      const previous=cap.travel;
      cap.travel=this.reducedMotion?target:pc.math.lerp(cap.travel,target,1-Math.exp(-step*24));
      if(Math.abs(cap.travel-target)>.0005)moving=true;else cap.travel=target;
      if(previous!==cap.travel){cap.root.setLocalPosition(cap.root.getLocalPosition().x,cap.y-cap.travel,cap.root.getLocalPosition().z);moving=true;}
      const modifier=(cap.spec.code==="CapsLock" && this.program.caps) || (cap.spec.code.startsWith("Shift") && this.program.shift) || (cap.spec.code.startsWith("Control") && this.program.ctrl) || (cap.spec.code.startsWith("Alt") && this.program.alt) || (cap.spec.code.startsWith("Meta") && this.program.meta) || (cap.spec.code==="Fn" && this.program.fn);
      cap.mesh.material=cap===this.hovered || modifier || cap.held?this.highlight:cap.material;
    }
    if(this.dirty || (this.screenClock>.28 && !this.reducedMotion && (this.program.status==="FOLLOW" || this.program.input.length>0))){
      this.program.draw(this.elapsed,this.reducedMotion,this.readingView);this.displayTexture.upload();
      if(this.screenMaterial.emissiveIntensity!==this.program.brightness*.9){this.screenMaterial.emissiveIntensity=this.program.brightness*.9;this.screenMaterial.update();}
      this.screenClock=0;this.dirty=true;
    }
    if(this.dirty || moving){this.app.renderNextFrame=true;this.dirty=false;}
  };
  private ray(x:number,y:number):pc.Ray {
    const rect=this.canvas.getBoundingClientRect();
    const origin=this.camera.camera!.screenToWorld(x-rect.left,y-rect.top,.1),end=this.camera.camera!.screenToWorld(x-rect.left,y-rect.top,30);
    return new pc.Ray(origin,end.sub(origin).normalize());
  }
  private pick(x:number,y:number):Cap|null {
    const ray=this.ray(x,y);let best:Cap|null=null,distance=Infinity;const point=new pc.Vec3();
    for(const cap of this.caps)if(cap.mesh.aabb.intersectsRay(ray,point)){const d=point.distance(ray.origin);if(d<distance){distance=d;best=cap;}}
    return best;
  }
  private screenUV(x:number,y:number):{x:number;y:number}|null {
    const ray=this.ray(x,y),t=(.79-ray.origin.z)/ray.direction.z;
    if(t<0)return null;const p=ray.origin.clone().add(ray.direction.clone().mulScalar(t));
    const u=p.x/4.02+.5,v=.5-(p.y-2.73)/2.52;return u>=0&&u<=1&&v>=0&&v<=1?{x:u*640,y:v*400}:null;
  }
  private notify():void {this.dirty=true;this.onChange(this.program.input || this.program.lastKey);}
  private press(cap:Cap,physical=false,character?:string):void {cap.held=physical;cap.pulse=.14;this.program.press(character?{...cap.spec,value:character,shift:character}:cap.spec,physical);this.notify();}
  private pointerDown=(e:PointerEvent):void=>{
    if(this.docked || e.button!==0 || !e.isPrimary)return;this.canvas.focus({preventScroll:true});
    const cap=this.pick(e.clientX,e.clientY);
    if(cap){e.preventDefault();this.pointerCap=cap;this.press(cap);cap.held=true;this.canvas.setPointerCapture(e.pointerId);return;}
    const uv=this.screenUV(e.clientX,e.clientY);
    if(uv){const row=this.program.rows.find(r=>uv.y>=r.top&&uv.y<=r.bottom);if(row){this.program.selected=row.index;const item=this.program.news[row.index];if(item.url)window.open(item.url,"_blank","noopener,noreferrer");this.notify();}return;}
    this.drag={x:e.clientX,y:e.clientY,yaw:this.yaw,moved:false};this.canvas.setPointerCapture(e.pointerId);
  };
  private pointerMove=(e:PointerEvent):void=>{
    if(this.drag){const dx=e.clientX-this.drag.x;if(Math.abs(dx)>4)this.drag.moved=true;if(this.drag.moved){this.yaw=pc.math.clamp(this.drag.yaw+dx*.003,-.3,.3);this.positionCamera();this.dirty=true;}return;}
    const cap=this.pick(e.clientX,e.clientY);if(cap!==this.hovered){this.hovered=cap;this.canvas.style.cursor=cap?"pointer":this.screenUV(e.clientX,e.clientY)?"text":"grab";this.dirty=true;}
  };
  private pointerUp=(e:PointerEvent):void=>{if(this.pointerCap){this.pointerCap.held=false;this.pointerCap=null;}this.drag=null;this.dirty=true;if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);};
  private pointerCancel=():void=>{if(this.pointerCap)this.pointerCap.held=false;this.pointerCap=null;this.drag=null;this.dirty=true;};
  private pointerLeave=():void=>{this.hovered=null;this.dirty=true;};
  private keyDown=(e:KeyboardEvent):void=>{
    if(e.code==="Tab" && (e.shiftKey || !this.program.input))return;
    if(e.code==="Escape" && !this.program.input && this.canvas.closest("dialog")){e.stopPropagation();return;}
    const cap=this.caps.find(c=>c.spec.code===e.code);if(!cap)return;
    if(((e.ctrlKey || e.metaKey) && e.code==="KeyV") || (e.metaKey && e.code==="KeyC"))return;
    e.preventDefault();e.stopPropagation();
    this.program.shift=e.shiftKey;this.program.ctrl=e.ctrlKey;this.program.alt=e.altKey;this.program.meta=e.metaKey;
    if(!e.repeat || cap.spec.value!==undefined || ["Backspace","ArrowLeft","ArrowRight"].includes(e.code))this.press(cap,true,cap.spec.value!==undefined && e.key.length===1?e.key:undefined);
    this.pressed.add(e.code);
  };
  private keyUp=(e:KeyboardEvent):void=>{const cap=this.caps.find(c=>c.spec.code===e.code);if(cap)cap.held=false;this.program.release(e.code);this.pressed.delete(e.code);this.notify();};
  private releaseAll=():void=>{this.caps.forEach(c=>c.held=false);this.pressed.clear();this.program.shift=this.program.ctrl=this.program.alt=this.program.meta=false;this.pointerCancel();};
  private paste=(e:ClipboardEvent):void=>{const text=e.clipboardData?.getData("text/plain");if(text){e.preventDefault();this.program.insert(text.replace(/[\r\n]/g," "));this.notify();}};
  private wheel=(e:WheelEvent):void=>{if(!this.screenUV(e.clientX,e.clientY))return;e.preventDefault();this.program.navigate(Math.sign(e.deltaY));this.notify();};
  private visibilityChange=():void=>{if(document.hidden)this.releaseAll();this.dirty=true;};
  private contextLost=(e:Event):void=>{e.preventDefault();this.lost=true;this.releaseAll();this.canvas.closest<HTMLElement>(".terminal-shell")!.dataset.renderer="unavailable";};
  private contextRestored=():void=>{this.lost=false;this.dirty=true;this.canvas.closest<HTMLElement>(".terminal-shell")!.dataset.renderer="web3d";};
  snapshot():unknown {
    const rect=this.canvas.getBoundingClientRect();
    return {ready:!this.lost,docked:this.docked,atmosphere:this.atmosphere,cwd:this.program.filesystem.cwd,hint:this.program.hint,output:this.program.output.map(line=>line.text),keyCount:this.caps.length,input:this.program.input,cursor:this.program.cursor,selected:this.program.selected,mode:this.program.mode,caps:this.program.caps,shift:this.program.shift,lastKey:this.program.lastKey,yaw:this.yaw,
      buffer:[this.canvas.width,this.canvas.height],cabinFrameReady:!!this.latestCabinCanvas,css:[rect.width,rect.height],aspect:this.camera.camera!.aspectRatio,screenMeshVertices:this.screen.render!.meshInstances[0].mesh.vertexBuffer.numVertices,
      keys:this.caps.map(c=>{const point=this.camera.camera!.worldToScreen(c.root.getPosition().clone().add(new pc.Vec3(0,.08,0)),this.cursor);return {code:c.spec.code,label:c.spec.label,x:point.x,y:point.y,travel:c.travel,held:c.held,scale:c.root.getLocalScale().toArray()};})};
  }
  destroy():void {
    window.removeEventListener("cabin:window-frame",this.cabinFrame);
    this.destroyed=true;this.releaseAll();this.resizeObserver?.disconnect();this.visibilityObserver?.disconnect();
    for(const [type,handler] of [["pointerdown",this.pointerDown],["pointermove",this.pointerMove],["pointerup",this.pointerUp],["pointercancel",this.pointerCancel],["lostpointercapture",this.pointerCancel],["pointerleave",this.pointerLeave],["keydown",this.keyDown],["keyup",this.keyUp],["blur",this.releaseAll],["paste",this.paste],["wheel",this.wheel],["webglcontextlost",this.contextLost],["webglcontextrestored",this.contextRestored]] as const)this.canvas.removeEventListener(type,handler as EventListener);
    document.removeEventListener("visibilitychange",this.visibilityChange);
    this.app.off("update",this.update);this.app.destroy();this.textures.forEach(t=>t.destroy());this.materials.forEach(m=>m.destroy());this.meshes.forEach(m=>m.destroy());
    delete (window as any).__terminal3D;
  }
}
