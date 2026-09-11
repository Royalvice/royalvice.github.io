import { AnywhereDoorDestinations } from "./AnywhereDoorDestinations";
import { ROOM_FURNITURE } from "./roomFurniture";
import { ROOM_PROJECTION } from "./roomProjection";
import { CabinSpriteLibrary } from "./CabinSpriteLibrary";
import {
  PROFILE_ACTORS,
  PROFILE_ACTOR_IDS,
  PROFILE_ROOM_V4_ASSETS,
  type ProfileActorId
} from "./profileAdventureAssets";
import type { ProfileRoomSimulationState, ProfileActorRuntime } from "./ProfileRoomSimulation";
import type { ProfileRoomTv } from "./ProfileRoomTv";
import {
  PROFILE_ROOM_LAMP_ANCHORS,
  PROFILE_ROOM_PROPS,
  PROFILE_ROOM_SPRITE_META,
  type ProfileRoomPoint,
  type ProfileRoomSpriteKey
} from "./profileRoomLayout";

type LoadedImage = {
  image: HTMLImageElement | null;
  ready: boolean;
  failed: boolean;
};

export type ProfileRoomAssetState = {
  actors: Record<ProfileActorId, "ready" | "partial-fallback" | "failed">;
  furniture: "ready" | "fallback";
  door: "ready" | "fallback";
  lamps: "ready" | "fallback";
  posters: "ready" | "fallback";
};

export type ProfileSpriteStageState = {
  depthOrder: ProfileActorId[];
  renderInstanceCount: Record<ProfileActorId, 0 | 1>;
  focusedActor: ProfileActorId | null;
  tvPowerPhase: ProfileTvPowerPhase;
  assets: ProfileRoomAssetState;
};

export type ProfileTvPowerPhase = "idle" | "glow" | "white" | "arcade";

type StageOptions = {
  reducedMotion: boolean;
  onReset: () => void;
  onDoorInteraction: () => void;
  onTvInteraction: () => void;
  onActorInteraction: (actor: ProfileActorId, action: string) => void;
};

type Point = ProfileRoomPoint;
type DrawRect = { left: number; top: number; width: number; height: number; anchorX: number; anchorY: number };

const emptyImage = (): LoadedImage => ({ image: null, ready: false, failed: false });
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export class ProfileSpriteStage {
  private sprites=new CabinSpriteLibrary();
  private destinations = new AnywhereDoorDestinations(() => this.redraw());
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private resizeObserver: ResizeObserver;
  private width = 576;
  private height = 288;
  private mobile = false;
  private referenceWidth = 640;
  private referenceHeight = 320;
  private listeners: Array<() => void> = [];
  private furniture = emptyImage();
  private cabinFurniture:Record<string,LoadedImage>={tv:emptyImage(),primaryDesk:emptyImage(),secondaryDesk:emptyImage(),sofa:emptyImage(),waterCooler:emptyImage(),flowers:emptyImage(),coffeeTable:emptyImage()};
  private door = emptyImage();
  private doorLabelKey = "";
  private lamps = emptyImage();
  private kimetsu = emptyImage();
  private posterLeft = emptyImage();
  private posterRight = emptyImage();
  private snapshot: ProfileRoomSimulationState | null = null;
  private tv: ProfileRoomTv | null = null;
  private windowCanvas: HTMLCanvasElement | null = null;
  private musicPlaying = false;
  private musicTime = 0;
  private terminalFrame:HTMLCanvasElement|null=null;
  setMusicState(playing:boolean,time:number):void {
    const changed=this.musicPlaying!==playing;
    this.musicPlaying=playing;this.musicTime=time;
    if(changed)this.redraw();
  }
  setWindowFrame(canvas:HTMLCanvasElement):void {
    if(!canvas.width||!canvas.height)return;
    this.windowCanvas??=document.createElement('canvas');
    if(this.windowCanvas.width!==288){this.windowCanvas.width=288;this.windowCanvas.height=120;}
    this.windowCanvas.getContext('2d')!.drawImage(canvas,0,0,288,120);
    window.dispatchEvent(new CustomEvent('cabin:window-frame',{detail:this.windowCanvas}));
  }
  private get wallExtension(){return 0;}
  private windowRect(){return {left:222,top:60,width:216,height:90};}
  private tvPowerPhase: ProfileTvPowerPhase = "idle";
  private actionCounters = new Map<ProfileActorId, number>();
  private lastState: ProfileSpriteStageState = {
    depthOrder: [],
    renderInstanceCount: { nobita: 0, doraemon: 0, shizuka: 0, gian: 0, suneo: 0 },
    focusedActor: null,
    tvPowerPhase: "idle",
    assets: {
      actors: { nobita: "failed", doraemon: "failed", shizuka: "failed", gian: "failed", suneo: "failed" },
      furniture: "fallback",
      door: "fallback",
      lamps: "fallback",
      posters: "fallback"
    }
  };

  constructor(private root: HTMLElement, private options: StageOptions) {
    this.root.innerHTML = `
      <section class="profile-adventure-stage" aria-label="Living top-down pixel research dungeon with five autonomous friends">
        <div class="profile-adventure-heading">
          <span>ACT I · OASIS CABIN</span>
          <h3>THE LIVING RESEARCH DUNGEON</h3>
          <small>FIVE FRIENDS · ONE WAY HOME</small>
        </div>
        <canvas class="profile-sprite-canvas" width="576" height="288" aria-hidden="true"></canvas>
        <div class="profile-actor-controls" aria-label="Character interactions">
          ${PROFILE_ACTOR_IDS.map((id) => `<button type="button" data-profile-actor="${id}" aria-label="Control ${PROFILE_ACTORS[id].label}"><span>${PROFILE_ACTORS[id].label}</span></button>`).join("")}
        </div>
        <button class="profile-door-control" type="button" data-profile-door aria-label="Toggle the Anywhere Door inside the sprite room"><span>DOOR</span></button>
        <button class="profile-tv-control" type="button" data-profile-tv aria-label="Open the YZY arcade cabinet and its 15 classic games" aria-controls="arcade-cabinet-dialog" aria-expanded="false"><span class="terminal-glove" aria-hidden="true"><svg viewBox="0 0 24 28" shape-rendering="crispEdges"><path fill="#161b17" d="M8 0h6v9h6v3h4v11h-3v5H7v-5H4v-4H1v-7h5v2h2z"/><path fill="#f4ead0" d="M10 2h2v13h2v-4h4v3h4v7h-3v5H9v-5H6v-4H3v-3h2v2h5z"/><path fill="#b7b399" d="M14 15h2v6h-2zm4 0h2v6h-2zM9 23h10v3H9z"/></svg></span><span class="arcade-dock-hint">play for fun</span></button>
        <div class="profile-terminal-dock" data-terminal-dock>
          <div class="profile-terminal-visual" data-terminal-visual></div>
          <button type="button" class="profile-terminal-trigger" data-profile-terminal disabled aria-label="Use the YZY computer on the research desk" aria-haspopup="dialog" aria-controls="yzy-terminal-dialog" aria-expanded="false">
            <span class="terminal-glove" aria-hidden="true"><svg viewBox="0 0 24 28" shape-rendering="crispEdges"><path fill="#161b17" d="M8 0h6v9h6v3h4v11h-3v5H7v-5H4v-4H1v-7h5v2h2z"/><path fill="#f4ead0" d="M10 2h2v13h2v-4h4v3h4v7h-3v5H9v-5H6v-4H3v-3h2v2h5z"/><path fill="#b7b399" d="M14 15h2v6h-2zm4 0h2v6h-2zM9 23h10v3H9z"/></svg></span>
            <span class="terminal-dock-hint">what's new</span>
          </button>
        </div>
        <button class="profile-adventure-replay" type="button" data-profile-reset data-profile-replay><i aria-hidden="true">↻</i> RESET ROOM</button>
        <p class="profile-adventure-caption"><span data-room-status>ROOM ONLINE</span><b>YZY ARCADE / 15</b></p>
        <ul class="profile-room-inventory sr-only" aria-label="Objects in the living research dungeon">
          <li>Hanging chandelier</li><li>Blackboard and blackboard eraser</li><li>Research workstation and music cabinet</li>
          <li>Teal sofa</li><li>Water cooler</li><li>Television showing the YZY arcade attract screen</li><li>Game console</li>
          <li>Six fuel lamps</li><li>Two framed pixel posters</li><li>Anywhere Door</li>
          <li>Wooden music box playing Returning Home by Parijat</li>
        </ul>
      </section>
    `;
    this.root.querySelector('.profile-adventure-stage')!.insertAdjacentHTML('beforeend','<button type="button" class="profile-window-trigger" data-profile-window disabled aria-label="Look through the ship cabin window" aria-haspopup="dialog" aria-expanded="false"><span>LOOK OUTSIDE ↗</span></button>');
    this.root.querySelector('.profile-adventure-stage')!.insertAdjacentHTML('beforeend','<button type="button" class="profile-music-box" data-music-box data-music-toggle aria-label="Play Returning Home by Parijat" aria-pressed="false"><span class="music-box-hint"><b>Returning Home</b><small>Parijat · <i data-music-room-action>Play</i></small></span></button>');
    this.root.querySelector('.profile-adventure-stage')!.insertAdjacentHTML('beforeend','<button type="button" class="profile-ultra-trigger" data-profile-ultra disabled aria-label="Open the Showa Ultraman collection" aria-haspopup="dialog"><span>光之记忆 ↗</span></button><button type="button" class="profile-ruru-trigger" data-profile-ruru aria-label="Say hello to Ruru"><span>HELLO, RURU</span></button>');
    const canvas = this.root.querySelector<HTMLCanvasElement>(".profile-sprite-canvas");
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) throw new Error("Profile sprite Canvas2D is unavailable.");
    this.canvas = canvas;
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;

    this.bind(this.root.querySelector("[data-profile-reset]"), "click", () => this.options.onReset());
    this.bind(this.root.querySelector("[data-profile-door]"), "click", () => this.options.onDoorInteraction());
    this.bind(this.root.querySelector("[data-profile-tv]"), "click", () => this.options.onTvInteraction());
    this.root.querySelectorAll<HTMLButtonElement>("[data-profile-actor]").forEach((button) => {
      const actor = button.dataset.profileActor as ProfileActorId;
      this.bind(button, "click", () => {
        const count = (this.actionCounters.get(actor) || 0) + 1;
        this.actionCounters.set(actor, count);
        this.options.onActorInteraction(actor, "control");
      });
    });
    this.bind(this.root, "focusin", () => this.redraw());
    this.bind(this.root,'terminal:dock-frame',((event:CustomEvent)=>{this.terminalFrame=event.detail;this.root.classList.add('has-terminal-frame');}) as EventListener);
    this.bind(this.root, "focusout", () => requestAnimationFrame(() => this.redraw()));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.root);
    this.resize();
  }

  async init(): Promise<void> {
    await Promise.all([
      this.sprites.init(),
      this.destinations.init(),
      this.loadImage(PROFILE_ROOM_V4_ASSETS.furniture, this.furniture, [384, 384]),
      this.loadImage(PROFILE_ROOM_V4_ASSETS.door, this.door, [256, 128]),
      this.loadImage(PROFILE_ROOM_V4_ASSETS.lamps, this.lamps, [256, 96]),
      this.loadImage(PROFILE_ROOM_V4_ASSETS.spiritedAwayPoster, this.posterLeft),
      this.loadImage(PROFILE_ROOM_V4_ASSETS.onePiecePoster, this.posterRight),
      this.loadImage("/assets/profile/dungeon-v5/props/kimetsu.webp",this.kimetsu),
      ...Object.entries(ROOM_FURNITURE).map(([id,asset])=>this.loadImage(asset.url,this.cabinFurniture[id]))
    ]);
    this.redraw();
  }

  destroy(): void {
    this.destinations.destroy();
    this.resizeObserver.disconnect();
    this.listeners.splice(0).forEach((dispose) => dispose());
    this.actorImages.clear();
    this.root.replaceChildren();
  }

  render(snapshot: ProfileRoomSimulationState, tv: ProfileRoomTv): ProfileSpriteStageState {
    this.snapshot = snapshot;
    this.tv = tv;
    return this.redraw();
  }

  setTvPowerPhase(phase: ProfileTvPowerPhase): void {
    this.tvPowerPhase = phase;
    this.root.dataset.tvPower = phase;
    const button = this.root.querySelector<HTMLButtonElement>("[data-profile-tv]");
    if (button) {
      button.disabled = phase !== "idle";
      button.setAttribute("aria-expanded", String(phase === "arcade"));
    }
    this.redraw();
  }

  getState(): ProfileSpriteStageState {
    return this.lastState;
  }

  private async loadImage(url: string, runtime: LoadedImage, expected?: [number, number]): Promise<void> {
    try {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      await image.decode();
      if (expected && (image.naturalWidth !== expected[0] || image.naturalHeight !== expected[1])) {
        throw new Error(`${url} must be ${expected[0]}x${expected[1]}.`);
      }
      runtime.image = image;
      runtime.ready = true;
    } catch {
      runtime.failed = true;
    }
  }

  private bind(target: EventTarget | null, event: string, callback: EventListener): void {
    if (!target) return;
    target.addEventListener(event, callback);
    this.listeners.push(() => target.removeEventListener(event, callback));
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.mobile = rect.width < 560 || window.matchMedia("(max-width: 760px)").matches;
    this.referenceWidth=640;this.referenceHeight=480;this.width=640;this.height=480;
    this.canvas.width=640;this.canvas.height=480;
    this.redraw();
  }

  private redraw(): ProfileSpriteStageState {
    const ctx = this.ctx;
    const snapshot = this.snapshot;
    ctx.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);
    ctx.imageSmoothingEnabled = false;
    this.drawRoomBase(ctx, snapshot);
    this.drawWindow(ctx);
    this.drawWallLayer(ctx, snapshot);
    const actors=snapshot?PROFILE_ACTOR_IDS.map(id=>snapshot.actors[id]).filter(a=>a.visible):[];
    const ordered=actors.sort((a,b)=>a.position[1]-b.position[1]);
    const focusedActor=snapshot?.controlledActor||this.focusedActor();
    this.drawFloorInlays(ctx);
    // Every shadow belongs to the floor, before actors and furniture are sorted.
    for(const id of ['primaryDesk','secondaryDesk','sofa','tv','waterCooler','door','ultraCabinet','flowers','modelBench','coffeeTable'])this.drawFurnitureGrounding(ctx,id);
    this.drawPropShadow(ctx,155,317,12,4);
    const drawables:Array<{y:number;draw:()=>void}>=[];
    for(const id of ['primaryDesk','secondaryDesk','sofa','tv','waterCooler','door','ultraCabinet','flowers','modelBench','coffeeTable']){
      drawables.push({y:PROFILE_ROOM_PROPS[id].worldAnchor[1],draw:()=>this.drawCabinProp(ctx,id,snapshot)});
    }
    drawables.push({y:317/480,draw:()=>this.drawFurniture(ctx,'chair',155,317,36,48)});
    for(const actor of actors)drawables.push({y:actor.position[1],draw:()=>{this.drawActorShadow(ctx,actor);if(focusedActor===actor.id)this.drawGroundFocus(ctx,actor.position);this.drawActor(ctx,actor);}});
    if(snapshot)drawables.push({y:snapshot.ruru.position[1],draw:()=>this.drawRuru(ctx,snapshot)});
    drawables.sort((a,b)=>a.y-b.y).forEach(d=>d.draw());
    this.drawForegroundProps(ctx,snapshot);
    this.drawCabinEvent(ctx,snapshot);
    if(this.root.dataset.cabinDebug==='true'&&snapshot)this.drawDebug(ctx,snapshot);
    this.drawLightingAndAtmosphere(ctx, snapshot);
    this.syncControls(snapshot);

    const count = { nobita: 0, doraemon: 0, shizuka: 0, gian: 0, suneo: 0 } as Record<ProfileActorId, 0 | 1>;
    for (const actor of ordered) count[actor.id] = 1;
    const assets = this.assetState();
    this.lastState = {
      depthOrder: ordered.map((actor) => actor.id),
      renderInstanceCount: count,
      focusedActor,
      tvPowerPhase: this.tvPowerPhase,
      assets
    };
    this.root.dataset.roomRunning = this.options.reducedMotion ? "false" : "true";
    this.root.dataset.doorFrame = snapshot?.doorFrame || "closed";
    this.root.style.setProperty("--portal-strength", (snapshot?.doorStrength || 0).toFixed(3));
    const status = this.root.querySelector<HTMLElement>("[data-room-status]");
    if (status) status.textContent = snapshot?.doorUser ? `${PROFILE_ACTORS[snapshot.doorUser].label.toUpperCase()} IN TRANSIT` : "ROOM ONLINE";
    return this.lastState;
  }

  private drawRoomBase(ctx: CanvasRenderingContext2D, snapshot: ProfileRoomSimulationState | null): void {
    const { width, height } = this;
    const wallTop = Math.round(this.roomY(.105));
    const floorTop = Math.round(this.roomY(.335));
    const floorBottom = Math.round(this.roomY(.94));
    ctx.fillStyle = "#030807";
    ctx.fillRect(0, 0, width, height);

    const ambient = ctx.createLinearGradient(0, wallTop, width, floorBottom);
    ambient.addColorStop(0, "#1d2c24");
    ambient.addColorStop(0.46, "#1c3d34");
    ambient.addColorStop(1, "#2b1b10");
    ctx.fillStyle = ambient;
    ctx.fillRect(8, wallTop, width - 16, floorBottom - wallTop);

    ctx.fillStyle = "#281a11";
    ctx.fillRect(10, wallTop, width - 20, floorTop - wallTop);
    for (let y = wallTop + 3; y < floorTop - 3; y += 8) {
      const odd = Math.floor((y - wallTop) / 8) % 2;
      for (let x = 12 - odd * 7; x < width - 12; x += 15) {
        ctx.fillStyle = odd ? "#49301a" : "#3d2818";
        ctx.fillRect(x, y, 12, 5);
        ctx.fillStyle = "#17110c";
        ctx.fillRect(x, y + 5, 12, 1);
      }
    }
    for(const x of [12,121,451,616]){ctx.fillStyle='#332318';ctx.fillRect(x,wallTop,8,floorTop-wallTop);ctx.fillStyle='#866137';ctx.fillRect(x,wallTop,2,floorTop-wallTop);}
    ctx.fillStyle='#5c4029';ctx.fillRect(13,wallTop,615,7);ctx.fillStyle='#9b7747';ctx.fillRect(13,wallTop,615,1);
    ctx.fillStyle = "#0b1512";
    ctx.fillRect(8, floorTop - 5, width - 16, 6);
    ctx.fillStyle = "#7a5930";
    ctx.fillRect(11, floorTop - 5, width - 22, 1);

    ctx.fillStyle = "#17372f";
    ctx.fillRect(16, floorTop, width - 32, floorBottom - floorTop);
    const tile = ROOM_PROJECTION.tileWidth, tileDepth = ROOM_PROJECTION.tileDepth;
    for (let row = 0; floorTop + row * tileDepth < floorBottom; row++) {
      const y = Math.round(floorTop + row * tileDepth);
      const cellHeight = Math.min(Math.round(floorTop + (row + 1) * tileDepth), floorBottom) - y;
      for (let x = 16; x < width - 16; x += tile) {
        const column = Math.floor((x - 16) / tile);
        ctx.fillStyle = (column + row) % 2 ? "#183a31" : "#1d4137";
        ctx.fillRect(x + 1, y + 1, Math.min(tile - 2, width - 17 - x), cellHeight - 2);
        ctx.fillStyle = "rgba(135,190,151,.11)";
        ctx.fillRect(x + 2, y + 2, tile - 4, 1);
        ctx.fillStyle = "rgba(2,9,8,.28)";
        ctx.fillRect(x + tile - 2, y + 3, 1, Math.max(0, cellHeight - 5));
        if ((column * 11 + row * 7) % 8 === 0) {
          ctx.fillStyle = "rgba(181,116,55,.25)";
          ctx.fillRect(x + 5, y + cellHeight - 5, 5, 1);
          ctx.fillRect(x + 9, y + cellHeight - 6, 1, 3);
        }
      }
    }

    ctx.fillStyle = "#07100e";
    ctx.fillRect(7, floorTop, 10, floorBottom - floorTop + 8);
    ctx.fillRect(width - 17, floorTop, 10, floorBottom - floorTop + 8);
    ctx.fillRect(7, floorBottom, width - 14, 9);
    ctx.fillStyle = "#654423";
    ctx.fillRect(11, floorTop, 3, floorBottom - floorTop);
    ctx.fillRect(width - 14, floorTop, 3, floorBottom - floorTop);

    // Small floor inlays and research marks enrich the room without a dark overlay.
    ctx.strokeStyle = "rgba(116,206,179,.16)";
    ctx.lineWidth = 1;
    const center = this.mapPoint(PROFILE_ROOM_PROPS.primaryDesk.worldAnchor);
    ctx.strokeRect(Math.round(center[0] - 29), Math.round(center[1] - 17), 58, 34);
    ctx.fillStyle = "rgba(225,179,91,.13)";
    for (let index = 0; index < 8; index += 1) {
      const angle = index / 8 * Math.PI * 2;
      ctx.fillRect(Math.round(center[0] + Math.cos(angle) * 37), Math.round(center[1] + Math.sin(angle) * 21), 2, 2);
    }

    const chandelier = this.propRect("chandelier");
    const poolY = chandelier.anchorY + height * 0.12;
    const warmPool = ctx.createRadialGradient(chandelier.anchorX, poolY, 2, chandelier.anchorX, poolY, height * 0.34);
    warmPool.addColorStop(0, "rgba(255,203,116,.22)");
    warmPool.addColorStop(0.55, "rgba(240,151,59,.075)");
    warmPool.addColorStop(1, "rgba(240,151,59,0)");
    ctx.fillStyle = warmPool;
    ctx.fillRect(width * 0.18, floorTop, width * 0.62, floorBottom - floorTop);

    const tv = this.mapPoint(PROFILE_ROOM_PROPS.tv.worldAnchor);
    const tvGlow = ctx.createRadialGradient(tv[0], tv[1] + 16, 1, tv[0], tv[1] + 16, height * 0.2);
    tvGlow.addColorStop(0, "rgba(78,180,213,.13)");
    tvGlow.addColorStop(1, "rgba(78,180,213,0)");
    ctx.fillStyle = tvGlow;
    ctx.fillRect(tv[0] - height * 0.22, tv[1] - height * 0.12, height * 0.44, height * 0.36);

    if (snapshot?.doorFrame === "open") {
      const door = this.mapPoint(PROFILE_ROOM_PROPS.door.worldAnchor);
      const portal = ctx.createRadialGradient(door[0], door[1], 2, door[0], door[1], height * 0.29);
      portal.addColorStop(0, "rgba(147,255,239,.31)");
      portal.addColorStop(0.45, "rgba(239,83,174,.11)");
      portal.addColorStop(1, "rgba(80,255,220,0)");
      ctx.fillStyle = portal;
      ctx.fillRect(door[0] - height * 0.32, door[1] - height * 0.32, height * 0.52, height * 0.52);
    }
  }

  private drawWindow(ctx:CanvasRenderingContext2D):void {
    const r=this.windowRect();
    ctx.fillStyle='#07121b';ctx.fillRect(r.left,r.top,r.width,r.height);
    if(this.windowCanvas?.width && this.windowCanvas?.height)ctx.drawImage(this.windowCanvas,r.left,r.top,r.width,r.height);
    else {ctx.strokeStyle='#765537';ctx.lineWidth=4;ctx.strokeRect(r.left,r.top,r.width,r.height);}
    const glow=ctx.createLinearGradient(0,r.top+r.height,0,r.top+r.height+35);
    glow.addColorStop(0,'rgba(133,166,174,.12)');glow.addColorStop(1,'rgba(133,166,174,0)');
    ctx.fillStyle=glow;ctx.fillRect(r.left+4,r.top+r.height,r.width-8,35);
  }

  private drawWallLayer(ctx: CanvasRenderingContext2D, snapshot: ProfileRoomSimulationState | null): void {
    const left = this.propRect("posterLeft");
    const board = this.propRect("blackboard");
    const right = this.propRect("posterRight");
    this.drawPoster(ctx, this.posterLeft, left, "spirited");
    this.drawFurniture(ctx, "blackboard", board.anchorX, board.anchorY, board.width, board.height);
    this.drawPoster(ctx, this.posterRight, right, "pirates");

    // Chalk writing appears only while a character is actually thinking here.
    const thinker = snapshot?.stationOccupancy.blackboard[0];
    if (thinker && snapshot?.actors[thinker].state === "thinking") {
      ctx.fillStyle = "rgba(221,236,210,.72)";
      const pulse = Math.floor(snapshot.simulationElapsed * 3) % 5;
      ctx.fillRect(Math.round(board.left + board.width * 0.27), Math.round(board.top + board.height * 0.47), 15 + pulse, 1);
      ctx.fillRect(Math.round(board.left + board.width * 0.33), Math.round(board.top + board.height * 0.57), 22, 1);
      ctx.fillRect(Math.round(board.left + board.width * 0.65), Math.round(board.top + board.height * 0.42), 1, 8);
    }
    const eraserX = board.left + board.width * 0.72 + (thinker && !this.options.reducedMotion ? Math.sin((snapshot?.simulationElapsed || 0) * 2) * 2 : 0);
    const eraserY = board.top + board.height * 0.84;
    this.drawFurniture(ctx, "eraser", eraserX, eraserY, this.mobile ? 14 : 18, this.mobile ? 7 : 9);

    // Copper pipes, archive shelf and small research clutter remain true pixel layers.
    ctx.fillStyle = "#6a4222";
    ctx.fillRect(Math.round(this.width * 0.73), Math.round(this.referenceHeight * 0.12), Math.round(this.width * 0.21), 3);
    ctx.fillRect(Math.round(this.width * 0.88), Math.round(this.referenceHeight * 0.12), 3, Math.round(this.referenceHeight * 0.12));
    ctx.fillStyle = "#aa7240";
    ctx.fillRect(Math.round(this.width * 0.73), Math.round(this.referenceHeight * 0.12), Math.round(this.width * 0.21), 1);
    const shelfX = Math.round(this.width * 0.75);
    const shelfY = Math.round(this.roomY(.285));
    ctx.fillStyle = "#160f0a";
    ctx.fillRect(shelfX - 25, shelfY - 8, 50, 21);
    ctx.fillStyle = "#6c4724";
    ctx.fillRect(shelfX - 23, shelfY - 6, 46, 3);
    ctx.fillRect(shelfX - 23, shelfY + 4, 46, 2);
    for (let index = 0; index < 7; index += 1) {
      ctx.fillStyle = index % 2 ? "#b98b51" : "#7b9d7c";
      ctx.fillRect(shelfX - 20 + index * 6, shelfY - 2 + index % 2, 4, 6);
    }

    PROFILE_ROOM_LAMP_ANCHORS.forEach((point,index)=>{this.drawLamp(ctx,point,index,snapshot?.simulationElapsed||0);});
  }

  private drawFloorInlays(ctx:CanvasRenderingContext2D){
    // Small flax-and-walnut weave anchors the lounge, leaving the walkway bare.
    const x=90,y=312,w=202,h=134;
    ctx.fillStyle='rgba(1,9,7,.20)';ctx.fillRect(x+1,y+2,w,h);
    ctx.fillStyle='#514838';ctx.fillRect(x,y,w,h);
    for(let row=0;row<h;row+=2)for(let col=0;col<w;col+=3){
      ctx.fillStyle=(Math.floor(row/2)+Math.floor(col/3))%2?'#615442':'#4b4436';
      ctx.fillRect(x+col,y+row,2,1);
    }
    ctx.fillStyle='#756347';ctx.fillRect(x+5,y+4,w-10,2);ctx.fillRect(x+5,y+h-6,w-10,2);
    ctx.fillStyle='#423d30';ctx.fillRect(x+5,y+8,w-10,1);ctx.fillRect(x+5,y+h-10,w-10,1);
    for(let col=3;col<w-3;col+=5){ctx.fillStyle='#8b7654';ctx.fillRect(x+col,y-2,1,2);ctx.fillRect(x+col,y+h,1,2);}
    // Ruru's nap station remains in the simulation, without a visible floor ring.

  }
  private drawCabinProp(ctx:CanvasRenderingContext2D,id:string,snapshot:ProfileRoomSimulationState|null){
    const r=this.propRect(id),prop=PROFILE_ROOM_PROPS[id];
    if(id==='door'){this.drawDoor(ctx,r.anchorX,r.anchorY,r.width,r.height,snapshot);return;}
    if(id==='tv')this.drawTvScreen(ctx,r);
    const generated=this.cabinFurniture[id];
    if(generated?.image)ctx.drawImage(generated.image,r.left,r.top,r.width,r.height);
    else if(id==='tv')this.drawFurnitureFallback(ctx,'tvCabinet',r);
    else if(prop.sprite)this.drawFurniture(ctx,prop.sprite,r.anchorX,r.anchorY,r.width,r.height);
    if(id==='primaryDesk'){

      // Brass task lamp, warm paper, rolled chart, and four-dimensional drawer.
      const x=r.left+22,y=r.top+r.height*.24;ctx.fillStyle='#ad8747';ctx.fillRect(x,y-30,3,27);ctx.fillRect(x-8,y-32,21,4);ctx.fillStyle='#e4c67e';ctx.fillRect(x-6,y-28,17,3);ctx.fillStyle='#56442b';ctx.fillRect(x-8,y-3,23,4);
      ctx.fillStyle='#cec09a';ctx.fillRect(x+14,y-4,23,11);ctx.fillStyle='#698578';ctx.fillRect(x+18,y-1,12,1);ctx.fillRect(x+20,y+2,9,1);
      const e=snapshot?.event;if(e?.kind==='drawer'){ctx.fillStyle='#061328';ctx.fillRect(r.left+15,r.anchorY-21,42,14);for(let i=0;i<12;i++){ctx.fillStyle=i%3?'#829fb7':'#eee4b8';ctx.fillRect(r.left+18+(i*13)%35,r.anchorY-19+(i*7)%10,1,1);}}
      if(this.terminalFrame?.width&&this.terminalFrame.height){const w=r.width*.40,h=w*.88;ctx.drawImage(this.terminalFrame,r.anchorX+r.width*.12-w/2,r.top+r.height*.24-h,w,h);}
    }
    if(id==='secondaryDesk'){this.drawMusicBox(ctx);if(this.kimetsu.image)ctx.drawImage(this.kimetsu.image,r.left+r.width*.60,r.top+r.height*.24-22,31,22);}
    if(id==='tv'&&!generated?.image){const a=PROFILE_ROOM_SPRITE_META.tvCabinet.childAnchors!.ps5;this.drawFurniture(ctx,'ps5',r.left+r.width*a[0],r.top+r.height*a[1],14,21);}
    if(id==='sofa'&&!this.cabinFurniture.sofa.ready){
      const x=r.left+r.width*.15,y=r.top+r.height*.56;
      // Tanjiro's woven cushion, next to Nezuko's travel-box collectible.
      for(let iy=0;iy<4;iy++)for(let ix=0;ix<4;ix++){ctx.fillStyle=(ix+iy)%2?'#152521':'#3b795b';ctx.fillRect(x+ix*4,y+iy*4,4,4);}
      ctx.fillStyle='#745035';ctx.fillRect(r.left+r.width*.69,y-2,15,20);ctx.strokeStyle='#ad875c';ctx.strokeRect(r.left+r.width*.69+2,y,11,16);ctx.fillStyle='#271d1b';ctx.fillRect(r.left+r.width*.69+6,y+7,3,4);
    }
    if(id==='coffeeTable'&&!this.cabinFurniture.coffeeTable.ready){
      ctx.save();ctx.translate(r.anchorX,r.anchorY);ctx.scale(1,1);const x=0,y=0;ctx.fillStyle='#302318';ctx.fillRect(x-36,y-10,72,18);ctx.fillStyle='#94683f';ctx.fillRect(x-39,y-15,78,17);ctx.fillStyle='#bc9159';ctx.fillRect(x-38,y-15,76,2);ctx.fillStyle='#211c16';ctx.fillRect(x-32,y+5,5,9);ctx.fillRect(x+27,y+5,5,9);
      ctx.fillStyle='#42594a';ctx.fillRect(x-24,y-13,48,11);ctx.fillStyle='#e1d1a7';ctx.fillRect(x-8,y-18,12,9);ctx.fillRect(x-5,y-21,6,3);ctx.fillRect(x+4,y-16,6,3);ctx.fillRect(x-22,y-13,6,5);ctx.fillRect(x+17,y-11,6,5);ctx.fillStyle='#77533c';ctx.fillRect(x-21,y-13,4,2);ctx.fillRect(x+18,y-11,4,2);ctx.restore();
    }
    if(id==='flowers'&&!this.cabinFurniture.flowers.ready){
      ctx.fillStyle='#63472c';ctx.fillRect(r.anchorX-9,r.anchorY-7,18,15);ctx.fillStyle='#9a7448';ctx.fillRect(r.anchorX-11,r.anchorY-9,22,4);
      for(let i=0;i<8;i++){const x=r.anchorX+Math.sin(i*2)*10,y=r.anchorY-12-i*3;ctx.fillStyle=i%2?'#6c8c67':'#3b6451';ctx.fillRect(x-4,y-4,8,5);ctx.fillStyle='#bcadd0';if(i%2===0)ctx.fillRect(x,y,3,5);}
    }
    if(id==='modelBench'){
      const top=r.anchorY-26,depth=15;
      ctx.fillStyle='#2b2119';ctx.fillRect(r.left+5,top+4,4,22);ctx.fillRect(r.left+r.width-9,top+4,4,22);
      ctx.fillStyle='#715033';ctx.fillRect(r.left+3,top+depth,5,26-depth);ctx.fillRect(r.left+r.width-8,top+depth,5,26-depth);
      ctx.fillStyle='#a2743e';ctx.fillRect(r.left-2,top,r.width+4,depth);
      ctx.fillStyle='#483122';ctx.fillRect(r.left-2,top+depth,r.width+4,4);
      ctx.fillStyle='#c29758';ctx.fillRect(r.left-2,top,r.width+4,1);
      ctx.fillStyle='#25473c';ctx.fillRect(r.left+5,top+3,r.width-10,depth-6);
      for(let i=0;i<4;i++){ctx.fillStyle='#b0ad94';ctx.fillRect(r.left+7+i*6,top-4-(i%2)*4,2,7);}
    }
    if(id==='ultraCabinet')this.drawCabinet(ctx,r);
  }
  private drawCabinet(ctx:CanvasRenderingContext2D,r:DrawRect){
    if(this.cabinetCanvas?.width&&this.cabinetCanvas.height){ctx.drawImage(this.cabinetCanvas,r.left,r.top,r.width,r.height);return;}
    // The physical cabinet can exist before models load; no substitute figures.
    ctx.fillStyle='#211b14';ctx.fillRect(r.left,r.top,r.width,r.height);ctx.strokeStyle='#ae8d51';ctx.lineWidth=2;ctx.strokeRect(r.left+2,r.top+2,r.width-4,r.height-4);
    ctx.fillStyle='#102522';ctx.fillRect(r.left+8,r.top+8,r.width-16,r.height-18);for(let row=1;row<3;row++){const y=r.top+row*(r.height-12)/2;ctx.fillStyle='#967544';ctx.fillRect(r.left+6,y,r.width-12,3);}ctx.fillStyle='#e7d095';ctx.fillRect(r.left+12,r.top+8,r.width-24,2);
    ctx.fillStyle='#d4e6dd0b';ctx.beginPath();ctx.moveTo(r.left+9,r.top+12);ctx.lineTo(r.left+r.width*.40,r.top+12);ctx.lineTo(r.left+r.width*.75,r.top+r.height-10);ctx.lineTo(r.left+r.width*.48,r.top+r.height-10);ctx.fill();
  }
  private cabinetCanvas:HTMLCanvasElement|null=null;
  setCabinetFrame(canvas:HTMLCanvasElement){this.cabinetCanvas=canvas;}
  private drawRuru(ctx:CanvasRenderingContext2D,s:ProfileRoomSimulationState){
    const r=s.ruru,[x,y]=this.mapPoint(r.position),dir=r.facing==='right'?'left':r.facing;
    const clip=r.state==='walk'?`ruru/walk-${dir}`:`ruru/${r.state}`;
    if(this.sprites.has(clip)){this.drawPropShadow(ctx,x,y+1,10,3);this.sprites.draw(ctx,clip,r.elapsed,x,y,62,r.state==='walk'&&r.facing==='right');}
  }
  private drawDebug(ctx:CanvasRenderingContext2D,s:ProfileRoomSimulationState){ctx.save();ctx.lineWidth=1;ctx.font='7px monospace';
    for(const p of Object.values(PROFILE_ROOM_PROPS)){if(!p.collisionBounds)continue;const [l,t,r,b]=p.collisionBounds;ctx.strokeStyle='#ffb773';ctx.strokeRect(l*640,t*480,(r-l)*640,(b-t)*480);}
    for(const a of Object.values(s.actors)){const [x,y]=this.mapPoint(a.position);ctx.strokeStyle='#a9e0e0';ctx.beginPath();ctx.ellipse(x,y,13.4,13.4,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x,y);for(const p of a.route.slice(a.routeIndex)){const [px,py]=p.split(',').map(Number);ctx.lineTo(px*640,py*480);}ctx.stroke();ctx.fillStyle='#e8d7a5';ctx.fillText(`${a.id} ${a.speed.toFixed(3)}`,x-20,y+12);}ctx.restore();
  }
  private drawCabinEvent(ctx:CanvasRenderingContext2D,s:ProfileRoomSimulationState|null){
    if(!s?.event)return;const e=s.event,t=s.simulationElapsed-e.startedAt;
    if(e.kind==='string'){const r=this.propRect('primaryDesk');ctx.fillStyle=`rgba(219,201,125,${.45+.25*Math.sin(t*2)})`;ctx.fillRect(r.left+41,r.anchorY-63,3,3);}
    if(e.kind==='concert'){const [x,y]=this.mapPoint(s.actors.gian.position);ctx.fillStyle='#e4cc8f';ctx.font='12px monospace';for(let i=0;i<3;i++)ctx.fillText('♪',x+20+i*7,y-52-((t*7+i*9)%28));}
  }
  private drawForegroundProps(ctx:CanvasRenderingContext2D,_snapshot:ProfileRoomSimulationState|null){
    const r=this.propRect('chandelier');
    const chainX=Math.round(r.anchorX),chainEnd=Math.round(r.top+r.height*.2);
    ctx.fillStyle='#694a2b';ctx.fillRect(chainX-5,42,11,4);
    ctx.fillStyle='#513b23';ctx.fillRect(chainX,46,2,Math.max(0,chainEnd-46));
    for(let y=47;y<chainEnd;y+=5){
      ctx.fillStyle='#a37e3f';ctx.fillRect(chainX,y,1,3);
      ctx.fillStyle='#cfaa62';ctx.fillRect(chainX+1,y+1,1,1);
    }
    const glowX=r.anchorX,glowY=r.top+r.height*.6;
    const pulse=this.options.reducedMotion?1:1+Math.sin((_snapshot?.simulationElapsed||0)*2.1)*.035;
    ctx.save();ctx.globalCompositeOperation='screen';
    const halo=ctx.createRadialGradient(glowX,glowY,3,glowX,glowY,r.width*1.05);
    halo.addColorStop(0,`rgba(255,201,99,${.28*pulse})`);
    halo.addColorStop(.4,'rgba(255,180,65,.10)');halo.addColorStop(1,'rgba(255,167,54,0)');
    ctx.fillStyle=halo;ctx.fillRect(glowX-r.width*1.1,glowY-r.width*1.1,r.width*2.2,r.width*2.2);ctx.restore();
    this.drawFurniture(ctx,'chandelier',r.anchorX,r.anchorY,r.width,r.height);
    // Tiny bright cores preserve the pixel silhouette instead of blurring it.
    ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle='rgba(255,237,175,.65)';
    for(const offset of [-.25,-.12,.12,.25])ctx.fillRect(Math.round(glowX+r.width*offset),Math.round(glowY-r.height*.10),1,2);
    ctx.restore();
    ctx.fillStyle='#1a100b';ctx.fillRect(9,453,622,14);ctx.fillStyle='#815c32';ctx.fillRect(12,453,616,3);ctx.fillStyle='#b48a52';ctx.fillRect(12,453,616,1);
  }

  private drawLightingAndAtmosphere(ctx: CanvasRenderingContext2D, snapshot: ProfileRoomSimulationState | null): void {
    const elapsed = snapshot?.simulationElapsed || 0;
    if (!this.options.reducedMotion) {
      for (let index = 0; index < 14; index += 1) {
        const random = Math.sin(index * 81.17) * 41758.31;
        const x = 14 + (((random - Math.floor(random)) * this.width + elapsed * (0.8 + index % 2)) % (this.width - 28));
        const y = this.height * 0.34 + ((index * 31 + elapsed * (1.4 + index % 3)) % (this.height * 0.5));
        ctx.fillStyle = index % 4 ? "rgba(167,205,183,.10)" : "rgba(250,197,99,.14)";
        ctx.fillRect(Math.round(x), Math.round(y), index % 3 ? 1 : 2, 1);
      }
    }
    if (snapshot?.doorFrame === "open") {
      const door = this.mapPoint(PROFILE_ROOM_PROPS.door.worldAnchor);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let index = 0; index < 12; index += 1) {
        const angle = index * 2.2 + elapsed * 0.42;
        const radius = 13 + index % 4 * 5;
        ctx.fillStyle = index % 3 ? "rgba(129,255,231,.47)" : "rgba(255,111,193,.45)";
        ctx.fillRect(Math.round(door[0] + Math.cos(angle) * radius), Math.round(door[1] - 28 + Math.sin(angle) * radius * 0.6), 2, 2);
      }
      ctx.restore();
    }
    if(this.root.dataset.terminalLight==="night") {
      ctx.save();ctx.globalCompositeOperation="multiply";ctx.fillStyle="#8d9fbd";
      ctx.fillRect(0,0,this.width,this.height);ctx.restore();
    }
    ctx.save();ctx.globalCompositeOperation='screen';for(const [x,y,rad,strength]of [[165,235,90,.095],[175,365,100,.065],[478,214,76,.06]]){const glow=ctx.createRadialGradient(x,y,3,x,y,rad);glow.addColorStop(0,`rgba(225,159,66,${strength})`);glow.addColorStop(1,'rgba(225,159,66,0)');ctx.fillStyle=glow;ctx.fillRect(x-rad,y-rad,rad*2,rad*2);}ctx.restore();
    const vignette = ctx.createRadialGradient(this.width * 0.5, this.height * 0.59, this.height * 0.27, this.width * 0.5, this.height * 0.59, this.width * 0.62);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,.32)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawActorShadow(ctx: CanvasRenderingContext2D, actor: ProfileActorRuntime): void {
    const [x, y] = this.mapPoint(actor.position);
    const size = this.actorSize(actor.id);
    const transitionDuration = Math.max(0.01, actor.activityDuration || 1.4);
    const alpha = actor.state === "portal-entering" ? 0.42 * (1 - clamp01(actor.stateElapsed / transitionDuration)) : actor.state === "portal-returning" ? 0.42 * clamp01(actor.stateElapsed / transitionDuration) : 0.42;
    ctx.fillStyle = `rgba(1,6,5,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(Math.round(x), Math.round(y + 2), size * 0.27, size * 0.072, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawGroundFocus(ctx: CanvasRenderingContext2D, position: Point): void {
    const [x, y] = this.mapPoint(position);
    const w = this.mobile ? 24 : 30;
    const h = 9;
    ctx.fillStyle = "rgba(255,208,104,.92)";
    ctx.fillRect(Math.round(x - w / 2), Math.round(y - h / 2), 6, 1);
    ctx.fillRect(Math.round(x - w / 2), Math.round(y - h / 2), 1, 4);
    ctx.fillRect(Math.round(x + w / 2 - 6), Math.round(y - h / 2), 6, 1);
    ctx.fillRect(Math.round(x + w / 2 - 1), Math.round(y - h / 2), 1, 4);
    ctx.fillRect(Math.round(x - w / 2), Math.round(y + h / 2), 6, 1);
    ctx.fillRect(Math.round(x - w / 2), Math.round(y + h / 2 - 3), 1, 4);
    ctx.fillRect(Math.round(x + w / 2 - 6), Math.round(y + h / 2), 6, 1);
    ctx.fillRect(Math.round(x + w / 2 - 1), Math.round(y + h / 2 - 3), 1, 4);
  }

  private drawActor(ctx:CanvasRenderingContext2D,actor:ProfileActorRuntime):void {
    const [x,y]=this.mapPoint(actor.position),size=this.actorSize(actor.id),direction=actor.facing==='right'?'left':actor.facing;
    const time=this.options.reducedMotion&&this.snapshot?.controlledActor!==actor.id?0:actor.animationElapsed;
    ctx.save();
    if(actor.state==='portal-entering')ctx.globalAlpha=Math.max(0,1-actor.stateElapsed);
    if(actor.state==='portal-returning')ctx.globalAlpha=Math.min(1,actor.stateElapsed);
    const special=actor.manualAction&&this.sprites.has(`${actor.id}/${actor.manualAction}`);
    const clip=special?`${actor.id}/${actor.manualAction}`:`${actor.id}/${direction}-${actor.locomotion}`;
    // Visual seating is a short settling motion from a collision-safe approach.
    let seatLift=0;
    if(special&&actor.manualAction==='computer')seatLift=32;
    if(special&&actor.manualAction==='nap'&&actor.station?.startsWith('sofa'))seatLift=32;
    const settle=Math.min(1,actor.stateElapsed/.35);
    this.sprites.draw(ctx,clip,time,x,y-seatLift*settle,size,!special&&actor.facing==='right');
    ctx.restore();
  }

  private drawFurniture(ctx: CanvasRenderingContext2D, key: ProfileRoomSpriteKey, x: number, y: number, width: number, height: number): DrawRect {
    const rect = this.furnitureRect(key, x, y, width, height);
    if (this.furniture.ready && this.furniture.image) {
      const source = PROFILE_ROOM_SPRITE_META[key].sourceRect;
      ctx.drawImage(this.furniture.image, source[0], source[1], source[2], source[3], rect.left, rect.top, rect.width, rect.height);
    } else {
      this.drawFurnitureFallback(ctx, key, rect);
    }
    return rect;
  }

  private furnitureRect(key: ProfileRoomSpriteKey, x: number, y: number, width: number, height: number): DrawRect {
    const pivot = PROFILE_ROOM_SPRITE_META[key].pivot;
    const adjustedY=y;
    return {
      left: Math.round(x - width * pivot[0]),
      top: Math.round(adjustedY - height * pivot[1]),
      width,
      height,
      anchorX: x,
      anchorY: adjustedY
    };
  }

  private drawFurnitureFallback(ctx: CanvasRenderingContext2D, key: ProfileRoomSpriteKey, rect: DrawRect): void {
    const { left: x, top: y, width, height } = rect;
    if (key === "blackboard") {
      ctx.fillStyle = "#21150d";
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = "#8b5b2d";
      ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
      ctx.fillStyle = "#0d2925";
      ctx.fillRect(x + 6, y + 6, width - 12, height - 14);
      ctx.fillStyle = "#5d3a20";
      ctx.fillRect(x + 4, y + height - 7, width - 8, 5);
    } else if (key === "eraser") {
      ctx.fillStyle = "#d1c6a1";
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = "#41524c";
      ctx.fillRect(x + 2, y + 2, Math.max(1, width - 4), Math.max(1, height - 4));
    } else if (key === "sofa") {
      ctx.fillStyle = "#0b2422";
      ctx.fillRect(x, y + 2, width, height - 4);
      ctx.fillStyle = "#17615b";
      ctx.fillRect(x + 5, y + 5, width - 10, Math.round(height * 0.52));
      ctx.fillStyle = "#248078";
      ctx.fillRect(x + 8, y + 7, Math.round(width / 2) - 10, Math.round(height * 0.42));
      ctx.fillRect(x + Math.round(width / 2) + 2, y + 7, Math.round(width / 2) - 10, Math.round(height * 0.42));
      ctx.fillStyle = "#0d3431";
      ctx.fillRect(x + 5, y + Math.round(height * 0.68), width - 10, Math.round(height * 0.22));
    } else if (key === "waterCooler") {
      ctx.fillStyle = "#d8ddce";
      ctx.fillRect(x + Math.round(width * 0.22), y + Math.round(height * 0.4), Math.round(width * 0.56), Math.round(height * 0.55));
      ctx.fillStyle = "rgba(112,207,244,.84)";
      ctx.beginPath();
      ctx.ellipse(x + width / 2, y + height * 0.26, width * 0.28, height * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d9703d";
      ctx.fillRect(x + Math.round(width * 0.58), y + Math.round(height * 0.55), 3, 3);
      ctx.fillStyle = "#488cb0";
      ctx.fillRect(x + Math.round(width * 0.36), y + Math.round(height * 0.55), 3, 3);
    } else if (key === "tvCabinet") {
      const screen = PROFILE_ROOM_SPRITE_META.tvCabinet.screenRect as [number, number, number, number];
      const sx = x + Math.round(width * screen[0]);
      const sy = y + Math.round(height * screen[1]);
      const sw = Math.round(width * screen[2]);
      const sh = Math.round(height * screen[3]);
      ctx.fillStyle = "#10171a";
      ctx.fillRect(sx - 5, sy - 5, sw + 10, 5);
      ctx.fillRect(sx - 5, sy + sh, sw + 10, 5);
      ctx.fillRect(sx - 5, sy, 5, sh);
      ctx.fillRect(sx + sw, sy, 5, sh);
      ctx.fillStyle = "#6f4727";
      ctx.fillRect(x + 2, y + Math.round(height * 0.58), width - 4, Math.round(height * 0.36));
      ctx.fillStyle = "#9a6738";
      ctx.fillRect(x + 4, y + Math.round(height * 0.58), width - 8, 3);
      ctx.fillStyle = "#2c1b11";
      ctx.fillRect(x + 8, y + Math.round(height * 0.69), Math.round(width * 0.28), Math.round(height * 0.17));
      ctx.fillRect(x + Math.round(width * 0.41), y + Math.round(height * 0.69), Math.round(width * 0.28), Math.round(height * 0.17));
    } else if (key === "chandelier") {
      ctx.strokeStyle = "#91602d";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(x + width / 2, y + height * 0.55, width * 0.38, height * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#ffd071";
      for (const offset of [0.22, 0.4, 0.6, 0.78]) ctx.fillRect(x + Math.round(width * offset) - 2, y + Math.round(height * 0.34), 4, 8);
    } else if (key === "ps5") {
      ctx.fillStyle = "#edf0eb";
      ctx.fillRect(x + Math.round(width * 0.12), y, Math.round(width * 0.76), height);
      ctx.fillStyle = "#111924";
      ctx.fillRect(x + Math.round(width / 2) - 2, y + 3, 4, height - 4);
      ctx.fillStyle = "#4d83ff";
      ctx.fillRect(x + Math.round(width / 2) + 2, y + 4, 1, height - 7);
    } else if (key === "chair") {
      ctx.fillStyle = "#2b1a10";
      ctx.fillRect(x + 2, y + 1, width - 4, Math.round(height * 0.35));
      ctx.fillStyle = "#865a34";
      ctx.fillRect(x + 5, y + 4, width - 10, Math.round(height * 0.25));
      ctx.fillStyle = "#6e4726";
      ctx.fillRect(x + 4, y + Math.round(height * 0.42), width - 8, Math.round(height * 0.31));
      ctx.fillStyle = "#25170e";
      ctx.fillRect(x + 5, y + Math.round(height * 0.72), 4, Math.round(height * 0.24));
      ctx.fillRect(x + width - 9, y + Math.round(height * 0.72), 4, Math.round(height * 0.24));
    } else {
      ctx.fillStyle = "#6e4726";
      ctx.beginPath();
      ctx.moveTo(x + 3, y + Math.round(height * 0.23));
      ctx.lineTo(x + width - 3, y + Math.round(height * 0.23));
      ctx.lineTo(x + width, y + Math.round(height * 0.58));
      ctx.lineTo(x, y + Math.round(height * 0.58));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#9a6738";
      ctx.fillRect(x + 4, y + Math.round(height * 0.24), width - 8, 3);
      ctx.fillStyle = "#25170e";
      ctx.fillRect(x + Math.round(width * 0.12), y + Math.round(height * 0.58), 5, Math.round(height * 0.37));
      ctx.fillRect(x + Math.round(width * 0.82), y + Math.round(height * 0.58), 5, Math.round(height * 0.37));
    }
  }

  private drawPoster(ctx: CanvasRenderingContext2D, asset: LoadedImage, rect: DrawRect, variant: "spirited" | "pirates"): void {
    const { anchorX: x, anchorY: y, width, height } = rect;
    // Two copper hooks and a one-pixel wall-contact edge make the frame visibly mounted.
    ctx.fillStyle = "#24150d";
    ctx.fillRect(Math.round(x - width * 0.24), Math.round(y - height / 2 - 7), 2, 6);
    ctx.fillRect(Math.round(x + width * 0.24 - 1), Math.round(y - height / 2 - 7), 2, 6);
    ctx.fillStyle = "#a86d37";
    ctx.fillRect(Math.round(x - width * 0.24), Math.round(y - height / 2 - 7), 1, 4);
    ctx.fillRect(Math.round(x + width * 0.24 - 1), Math.round(y - height / 2 - 7), 1, 4);
    ctx.fillStyle = "rgba(3,7,6,.48)";
    ctx.fillRect(Math.round(x - width / 2), Math.round(y - height / 2 + 2), width + 5, height + 5);
    ctx.fillStyle = "#17100b";
    ctx.fillRect(Math.round(x - width / 2 - 3), Math.round(y - height / 2 - 3), width + 6, height + 6);
    ctx.fillStyle = "#916039";
    ctx.fillRect(Math.round(x - width / 2 - 2), Math.round(y - height / 2 - 2), width + 4, height + 4);
    if (asset.ready && asset.image) {
      ctx.drawImage(asset.image, Math.round(x - width / 2), Math.round(y - height / 2), width, height);
      return;
    }
    if (variant === "spirited") {
      ctx.fillStyle = "#d89b77";
      ctx.fillRect(Math.round(x - width / 2), Math.round(y - height / 2), width, height);
      ctx.fillStyle = "#5f3946";
      ctx.fillRect(Math.round(x - width * 0.42), Math.round(y + height * 0.12), Math.round(width * 0.84), Math.round(height * 0.33));
      ctx.fillStyle = "#f0d7ae";
      ctx.fillRect(Math.round(x - 4), Math.round(y - 9), 8, 12);
      ctx.fillStyle = "#243d3a";
      ctx.fillRect(Math.round(x - 7), Math.round(y - 13), 14, 5);
    } else {
      ctx.fillStyle = "#e6c47a";
      ctx.fillRect(Math.round(x - width / 2), Math.round(y - height / 2), width, height);
      const colors = ["#d84e38", "#224f83", "#f1dc73", "#2e8b74", "#795b9b"];
      colors.forEach((color, index) => {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x - width * 0.38 + index * width * 0.16), Math.round(y - 3 + index % 2 * 3), Math.round(width * 0.13), Math.round(height * 0.34));
      });
      ctx.fillStyle = "#392718";
      ctx.fillRect(Math.round(x - width * 0.35), Math.round(y - height * 0.33), Math.round(width * 0.7), 3);
    }
  }

  private drawDoor(ctx: CanvasRenderingContext2D, x: number, baseline: number, width: number, height: number, snapshot: ProfileRoomSimulationState | null): void {
    const open = snapshot?.doorFrame === "open";
    this.destinations.setOpen(open);
    const doorControl = this.root.querySelector<HTMLButtonElement>("[data-profile-door]");
    const destination = this.destinations.getState();
    const labelKey = `${open}:${destination.index}:${destination.loaded}`;
    if (doorControl && labelKey !== this.doorLabelKey) {
      this.doorLabelKey = labelKey;
      doorControl.dataset.destination = destination.destination.id;
      doorControl.dataset.destinationsLoaded = String(destination.loaded);
      doorControl.setAttribute("aria-expanded", String(open));
      doorControl.title = open ? `${destination.destination.name} · 关门再开，探索下一站` : "任意门 · 15 个世界";
      doorControl.setAttribute("aria-label", open ? `关闭任意门：${destination.destination.name}` : "打开任意门，探索另一个世界");
    }
    this.drawPropShadow(ctx, x, baseline + 1, width * 0.43, Math.max(2, height * 0.035));
    if (this.door.ready && this.door.image) {
      ctx.drawImage(this.door.image, open ? 128 : 0, 0, 128, 128, Math.round(x - width / 2), Math.round(baseline - height), width, height);
    } else {
      ctx.save();
      ctx.translate(Math.round(x), Math.round(baseline));
      ctx.fillStyle = "#a82669";
      ctx.fillRect(-width / 2, -height, width, height);
      ctx.fillStyle = "#e75ba6";
      ctx.fillRect(-width / 2 + 3, -height + 3, width - 6, height - 5);
      if (open) {
        ctx.fillStyle = "#bffdf3";
        ctx.fillRect(-width / 2 + 6, -height + 7, width - 12, height - 13);
        ctx.fillStyle = "#c73b83";
        ctx.beginPath();
        ctx.moveTo(-width / 2 + 5, -height + 5);
        ctx.lineTo(-width * 0.77, -height + 11);
        ctx.lineTo(-width * 0.77, -5);
        ctx.lineTo(-width / 2 + 5, -2);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = "#c73b83";
        ctx.fillRect(-width / 2 + 6, -height + 7, width - 12, height - 13);
      }
      ctx.fillStyle = "#f4d08b";
      ctx.fillRect(width * 0.2, -height * 0.48, 3, 3);
      ctx.restore();
    }
    if(open&&snapshot)this.drawDoorDestination(ctx,x,baseline,width,height,snapshot);
  }

  private drawDoorDestination(ctx:CanvasRenderingContext2D,x:number,baseline:number,width:number,height:number,snapshot:ProfileRoomSimulationState){
    const left=x-width*.30,top=baseline-height*.87,w=width*.58,h=height*.80;
    this.destinations.draw(ctx,left,top,w,h);
  }

  private drawLamp(ctx: CanvasRenderingContext2D, point: Point, index: number, elapsed: number): void {
    const [x, y] = this.mapPoint(point);
    const frame = this.options.reducedMotion ? 0 : Math.floor(elapsed * 7 + index) % 4;
    const flicker = this.options.reducedMotion ? 0.72 : 0.7 + Math.sin(elapsed * 6 + index) * 0.08;
    const glow = ctx.createRadialGradient(x, y + 3, 1, x, y + 3, this.mobile ? 22 : 29);
    glow.addColorStop(0, `rgba(255,190,79,${0.20 * flicker})`);
    glow.addColorStop(1, "rgba(255,151,43,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 34, y - 34, 68, 68);
    ctx.fillStyle = "#2a190f";
    ctx.fillRect(Math.round(x - 1), Math.round(y - (this.mobile ? 18 : 22)), 3, this.mobile ? 5 : 6);
    ctx.fillStyle = "#9a6533";
    ctx.fillRect(Math.round(x), Math.round(y - (this.mobile ? 18 : 22)), 1, this.mobile ? 4 : 5);
    if (this.lamps.ready && this.lamps.image) {
      const lampWidth = this.mobile ? 17 : 21;
      const lampHeight = lampWidth * 33 / 21;
      ctx.drawImage(this.lamps.image, frame * 64, 0, 64, 96, Math.round(x - lampWidth / 2), Math.round(y - lampHeight / 2), lampWidth, lampHeight);
      return;
    }
    ctx.fillStyle = "#2c1a0d";
    ctx.fillRect(Math.round(x - 5), Math.round(y - 6), 10, 9);
    ctx.fillStyle = `rgba(255,188,72,${flicker})`;
    ctx.fillRect(Math.round(x - 2 + (frame === 1 ? -1 : frame === 3 ? 1 : 0)), Math.round(y - 11 - (frame === 2 ? 2 : 0)), 4, 7);
    ctx.fillStyle = "#e0a34d";
    ctx.fillRect(Math.round(x - 4), Math.round(y + 1), 8, 2);
  }

  private drawTvScreen(ctx: CanvasRenderingContext2D, tv: DrawRect): void {
    if (!this.tv) return;
    const screen = PROFILE_ROOM_SPRITE_META.tvCabinet.screenRect as [number, number, number, number];
    const x = Math.round(tv.left + tv.width * screen[0]);
    const y = Math.round(tv.top + tv.height * screen[1]);
    const width = Math.max(1, Math.round(tv.width * screen[2]));
    const height = Math.max(1, Math.round(tv.height * screen[3]));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.fillStyle = "#050809";
    ctx.fillRect(x, y, width, height);
    ctx.drawImage(this.tv.canvas, 0, 0, 96, 72, x, y, width, height);
    ctx.fillStyle = "rgba(195,241,255,.15)";
    ctx.fillRect(x + 2, y + 2, 2, Math.max(1, height - 5));
    ctx.fillStyle = "rgba(4,10,12,.14)";
    for (let scanline = y + 2; scanline < y + height; scanline += 3) ctx.fillRect(x, scanline, width, 1);
    if (this.tvPowerPhase === "glow") {
      ctx.fillStyle = "rgba(238,250,233,.38)";
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = "rgba(255,255,255,.64)";
      ctx.fillRect(x + 1, y + 1, Math.max(1, width - 2), 1);
    } else if (this.tvPowerPhase === "white" || this.tvPowerPhase === "arcade") {
      ctx.fillStyle = "#fffef5";
      ctx.fillRect(x, y, width, height);
    }
    ctx.restore();
  }

  private drawDeskClutter(ctx: CanvasRenderingContext2D, x: number, y: number, elapsed: number): void {
    ctx.fillStyle = "#d4c59a";
    ctx.fillRect(Math.round(x - 19), Math.round(y - 33), 13, 8);
    ctx.fillStyle = "#b98750";
    ctx.fillRect(Math.round(x - 17), Math.round(y - 31), 9, 1);

    ctx.fillStyle = "#c9894a";
    ctx.fillRect(Math.round(x - 3), Math.round(y - 29), 3, 5);
  }

  private drawCrate(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.fillStyle = "#24170f";
    ctx.fillRect(Math.round(x - size / 2 - 2), Math.round(y - size + 2), size + 4, size);
    ctx.fillStyle = "#76502c";
    ctx.fillRect(Math.round(x - size / 2), Math.round(y - size), size, size);
    ctx.fillStyle = "#9c6a38";
    ctx.fillRect(Math.round(x - size / 2 + 2), Math.round(y - size + 2), size - 4, 2);
    ctx.fillStyle = "#4d301d";
    ctx.fillRect(Math.round(x - 1), Math.round(y - size), 3, size);
  }

  private drawPropShadow(ctx: CanvasRenderingContext2D, x: number, y: number, radiusX: number, radiusY: number): void {
    ctx.fillStyle = "rgba(1,6,5,.34)";
    ctx.beginPath();
    ctx.ellipse(Math.round(x), Math.round(y), radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private groundingMasks=new Map<string,{image:HTMLImageElement;canvas:HTMLCanvasElement}>();
  private drawFurnitureGrounding(ctx:CanvasRenderingContext2D,id:string){
    const r=this.propRect(id),bounds=PROFILE_ROOM_PROPS[id].collisionBounds;
    if(!bounds)return;
    const [l,t,rr,b]=bounds,back=t*480,front=r.anchorY;
    const left=l*640,right=rr*640,depth=Math.max(4,front-back);
    // Occlusion under the physical footprint: broad and soft, not a floating oval.
    ctx.fillStyle='rgba(2,12,10,.17)';ctx.fillRect(left,back,right-left,depth+1);
    ctx.fillStyle='rgba(2,10,8,.14)';ctx.fillRect(left+2,back+2,right-left-4,Math.max(2,depth-3));
    const image=this.cabinFurniture[id]?.image;
    if(image){
      let entry=this.groundingMasks.get(id);
      if(!entry||entry.image!==image){
        const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
        const mask=canvas.getContext('2d')!;mask.drawImage(image,0,0);mask.globalCompositeOperation='source-in';mask.fillStyle='#010c09';mask.fillRect(0,0,canvas.width,canvas.height);
        entry={image,canvas};this.groundingMasks.set(id,entry);
      }
      ctx.save();ctx.globalAlpha=.20;
      // Project the silhouette away from the shared upper-left room light.
      const baseline=front-r.top;
      ctx.translate(r.left+baseline*ROOM_PROJECTION.shadowX,front+baseline*ROOM_PROJECTION.shadowY);
      ctx.transform(1,0,-ROOM_PROJECTION.shadowX,-ROOM_PROJECTION.shadowY,0,0);
      ctx.drawImage(entry.canvas,0,0,r.width,r.height);ctx.restore();
    }
    // Tight occlusion at the individual feet / solid plinth, never detached.
    const solid=['ultraCabinet','door'].includes(id);
    ctx.fillStyle='rgba(1,7,5,.55)';
    if(solid){
      const w=id==='flowers'?r.width*.40:id==='waterCooler'?r.width*.72:right-left;
      ctx.beginPath();ctx.ellipse(r.anchorX,front,Math.max(3,w*.5),2.5,0,0,Math.PI*2);ctx.fill();
    }else{
      const feet=ROOM_FURNITURE[id]?.feet;
      if(feet)for(const [x,y] of feet){ctx.beginPath();ctx.ellipse(r.left+x*r.width,r.top+y*r.height,id==='flowers'?3:3.5,1.5,0,0,Math.PI*2);ctx.fill();}
      else for(const x of [left+3,right-3]){ctx.beginPath();ctx.ellipse(x,front,4,2,0,0,Math.PI*2);ctx.fill();}
    }
  }

  private musicBoxRect() {
    const desk=this.propRect('secondaryDesk'),width=desk.width*.42,height=width*.8;
    return {left:desk.anchorX-desk.width*.16-width/2,top:desk.top+desk.height*.18-height,width,height};
  }

  private drawMusicBox(ctx:CanvasRenderingContext2D):void {
    const r=this.musicBoxRect(),scale=r.width/40;
    ctx.save();ctx.translate(Math.round(r.left),Math.round(r.top));ctx.scale(scale,scale);
    const box=(x:number,y:number,w:number,h:number,color:string)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
    // Open walnut lid, moon inlay, brass pinned cylinder, comb and winding key.
    box(3,30,34,2,'#08100bd0');box(4,2,30,16,'#1c130f');box(6,0,26,2,'#bc9051');
    box(4,2,2,15,'#76502e');box(32,2,2,15,'#684328');box(6,2,26,13,'#815930');
    box(8,4,22,9,'#122d2a');box(8,13,22,2,'#b28b48');
    box(22,5,3,6,'#e4d2a2');box(20,6,5,4,'#e4d2a2');box(19,5,4,4,'#122d2a');
    box(12,7,1,1,'#b7b6a0');box(16,10,1,1,'#b7b6a0');
    box(6,16,27,2,'#a2773b');box(3,18,33,10,'#3e281c');box(5,18,29,7,'#bd8e47');
    box(7,19,25,5,'#292721');box(8,21,22,2,'#766039');
    box(9,18,12,7,'#735627');box(10,18,10,1,'#f1d99b');box(10,19,10,2,'#cba557');box(10,21,10,2,'#a17a35');box(10,23,10,1,'#e1bc67');
    const phase=this.musicPlaying&&!this.options.reducedMotion?Math.floor(this.musicTime*6)%4:0;
    for(let i=0;i<5;i++)box(10+i*2,19+(i+phase)%4,1,1,'#fff0b8');
    for(let i=0;i<5;i++)box(23+i*2,18,1,6-i%2,'#d3c79b');
    box(5,25,29,6,'#603d25');box(5,25,29,1,'#d2a15b');box(7,27,24,1,'#825830');
    box(17,27,5,3,'#b38e4d');box(19,28,1,1,'#332a20');
    box(3,25,2,6,'#8e6537');box(34,24,2,6,'#312217');box(8,31,5,1,'#b08348');box(28,31,5,1,'#b08348');
    box(35,22,4,1,'#c5a56c');box(38,20,1,3,'#e9d49c');box(37,19,3,2,'#855f33');
    box(29,27,2,1,this.musicPlaying?'#e4d795':'#89724b');
    if(this.musicPlaying&&!this.options.reducedMotion){
      for(let i=0;i<2;i++){const y=-3-((Math.floor(this.musicTime*3)+i*5)%9),x=13+i*14;box(x,y,1,5,'#e1c38b');box(x-2,y+4,2,2,'#e1c38b');box(x+1,y,2,1,'#e1c38b');}
    }
    ctx.restore();
  }

  private propRect(id: keyof typeof PROFILE_ROOM_PROPS): DrawRect {
    const prop=PROFILE_ROOM_PROPS[id];const [anchorX,anchorY]=this.mapPoint(prop.worldAnchor);
    const width=prop.desktopSize[0]*640,height=id==='ultraCabinet'&&this.cabinetCanvas?.width?width*this.cabinetCanvas.height/this.cabinetCanvas.width:prop.desktopSize[1]*480;
    const pivot=ROOM_FURNITURE[id]?.pivot??(this.cabinFurniture[id]?[.5,1]:prop.sprite?PROFILE_ROOM_SPRITE_META[prop.sprite].pivot:(id==='door'?[.5,1]:id==='ultraCabinet'?[.5,1]:[.5,.5]));
    return {left:Math.round(anchorX-width*pivot[0]),top:Math.round(anchorY-height*pivot[1]),width,height,anchorX,anchorY};
  }
  private roomY(value:number){return value*480;}
  private mapPoint(p:Point):Point{return [p[0]*640,p[1]*480];}

  getViewportState() {
    return {
      mode: this.mobile ? "mobile" : "desktop",
      worldSize: [this.width, this.height],
      referenceSize: [this.referenceWidth, this.referenceHeight],
      projection:ROOM_PROJECTION,
      doorDestination:this.destinations.getState(),
      groundContacts:Object.fromEntries(Object.entries(ROOM_FURNITURE).map(([id,a])=>{const r=this.propRect(id);return[id,a.feet.map(([x,y])=>[r.left+x*r.width,r.top+y*r.height])]})),
      window:this.windowRect(),
      musicBox:this.musicBoxRect(),
      furnitureAssets:Object.fromEntries(Object.entries(this.cabinFurniture).map(([id,a])=>[id,a.ready?"ready":a.failed?"failed":"loading"])),
      props: Object.fromEntries(Object.keys(PROFILE_ROOM_PROPS).map(id => [id, this.propRect(id)])),
      actorSize: Object.fromEntries(PROFILE_ACTOR_IDS.map(id => [id, this.actorSize(id)]))
    };
  }

  private actorSize(id: ProfileActorId): number {
    const base = 94;
    return Math.round(base * PROFILE_ACTORS[id].scale);
  }

  private focusedActor(): ProfileActorId | null {
    const active = document.activeElement as HTMLElement | null;
    return active?.dataset.profileActor as ProfileActorId || null;
  }

  private syncControls(snapshot: ProfileRoomSimulationState | null): void {
    const cabinet=this.root.querySelector<HTMLElement>('[data-profile-ultra]'),cr=this.propRect('ultraCabinet');
    if(cabinet){cabinet.style.left=`${cr.left/640*100}%`;cabinet.style.top=`${cr.top/480*100}%`;cabinet.style.width=`${cr.width/640*100}%`;cabinet.style.height=`${cr.height/480*100}%`;cabinet.style.zIndex='76';}
    const ruru=this.root.querySelector<HTMLElement>('[data-profile-ruru]');
    if(ruru&&snapshot){ruru.style.left=`${snapshot.ruru.position[0]*100-3}%`;ruru.style.top=`${snapshot.ruru.position[1]*100-9}%`;ruru.style.width='6%';ruru.style.height='10%';ruru.style.zIndex=String(20+Math.round(snapshot.ruru.position[1]*100));}
    const win=this.root.querySelector<HTMLElement>('[data-profile-window]');const wr=this.windowRect();
    if(win){win.style.left=`${wr.left/this.width*100}%`;win.style.top=`${wr.top/this.height*100}%`;win.style.width=`${wr.width/this.width*100}%`;win.style.height=`${wr.height/this.height*100}%`;}
    const music=this.root.querySelector<HTMLElement>('[data-music-box]'),mr=this.musicBoxRect();
    if(music){music.style.left=`${(mr.left+mr.width/2)/this.width*100}%`;music.style.top=`${(mr.top+mr.height/2)/this.height*100}%`;music.style.width=`${mr.width/this.width*100}%`;music.style.height=`${mr.height/this.height*100}%`;}

    for (const id of PROFILE_ACTOR_IDS) {
      const button = this.root.querySelector<HTMLButtonElement>(`[data-profile-actor="${id}"]`);
      const actor = snapshot?.actors[id];
      if (!button || !actor) continue;
      if (!actor.visible) {
        button.disabled = true;
        button.tabIndex = -1;
        button.setAttribute("aria-hidden", "true");
        continue;
      }
      button.disabled = false;
      button.tabIndex = 0;
      button.removeAttribute("aria-hidden");
      const [x, y] = this.mapPoint(actor.position);
      const size = this.actorSize(id);
      button.style.left = `${x / this.width * 100}%`;
      button.style.top = `${(y - size*.85) / this.height * 100}%`;
      button.style.zIndex=String(20+Math.round(actor.position[1]*100));
      button.style.width = `${size / this.width * 100}%`;
      button.style.height = `${size / this.height * 100}%`;
      button.dataset.actorState = actor.state;
    }
    const dock = this.root.querySelector<HTMLElement>("[data-terminal-dock]");
    if (dock) {
      const desk = this.propRect("primaryDesk");
      const w = desk.width * .40, h = w * .88;
      dock.style.left = `${(desk.anchorX + desk.width * .12 - w / 2) / this.width * 100}%`;
      dock.style.top = `${(desk.top + desk.height * .24 - h) / this.height * 100}%`;
      dock.style.width = `${w / this.width * 100}%`;
      dock.style.height = `${h / this.height * 100}%`;
      dock.style.zIndex=String(20+Math.round(PROFILE_ROOM_PROPS.primaryDesk.worldAnchor[1]*100));
    }
    const doorButton = this.root.querySelector<HTMLElement>("[data-profile-door]");
    if (doorButton) {
      const door = this.propRect("door");
      doorButton.style.left = `${door.anchorX / this.width * 100}%`;
      doorButton.style.top = `${door.top / this.height * 100}%`;
      doorButton.style.width = `${door.width / this.width * 100}%`;
      doorButton.style.height = `${door.height / this.height * 100}%`;
    }
    const tvButton = this.root.querySelector<HTMLElement>("[data-profile-tv]");
    if (tvButton) {
      const tv = this.propRect("tv");
      const screen = PROFILE_ROOM_SPRITE_META.tvCabinet.screenRect as [number, number, number, number];
      // The button covers the cabinet; its pseudo-element marks the aperture.
      // Applying the aperture twice shifted the hover frame into the CRT corner.
      tvButton.style.left = `${tv.left / this.width * 100}%`;
      tvButton.style.top = `${tv.top / this.height * 100}%`;
      tvButton.style.width = `${tv.width / this.width * 100}%`;
      tvButton.style.height = `${tv.height / this.height * 100}%`;
      tvButton.style.setProperty("--profile-tv-screen-left", `${screen[0] * 100}%`);
      tvButton.style.setProperty("--profile-tv-screen-top", `${screen[1] * 100}%`);
      tvButton.style.setProperty("--profile-tv-screen-width", `${screen[2] * 100}%`);
      tvButton.style.setProperty("--profile-tv-screen-height", `${screen[3] * 100}%`);
      tvButton.style.setProperty("--profile-tv-screen-center-x", `${(screen[0] + screen[2] * .5) * 100}%`);
    }
  }

  private assetState():ProfileRoomAssetState {
    return {actors:Object.fromEntries(PROFILE_ACTOR_IDS.map(id=>[id,this.sprites.has(`${id}/down-idle`)?'ready':'failed'])) as ProfileRoomAssetState['actors'],furniture:this.furniture.ready?'ready':'fallback',door:this.door.ready?'ready':'fallback',lamps:this.lamps.ready?'ready':'fallback',posters:this.posterLeft.ready&&this.posterRight.ready?'ready':'fallback'};
  }
}
