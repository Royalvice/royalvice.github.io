import {
  PROFILE_ACTORS,
  PROFILE_ACTOR_IDS,
  PROFILE_BASE_FRAME_ORDER,
  PROFILE_LIFE_FRAME_ORDER,
  PROFILE_MOVEMENT_FRAME_ORDER,
  PROFILE_ROOM_V4_ASSETS,
  type ProfileActorId,
  type ProfileSpriteFrameId
} from "./profileAdventureAssets";
import type { ProfileRoomSimulationState, ProfileActorRuntime } from "./ProfileRoomSimulation";
import type { ProfileRoomTv } from "./ProfileRoomTv";
import {
  PROFILE_ROOM_DESK_ACCESS,
  PROFILE_ROOM_LAMP_ANCHORS,
  PROFILE_ROOM_PROPS,
  PROFILE_ROOM_SPRITE_META,
  type ProfileRoomDeskStation,
  type ProfileRoomPoint,
  type ProfileRoomSpriteKey
} from "./profileRoomLayout";

type LoadedImage = {
  image: HTMLImageElement | null;
  ready: boolean;
  failed: boolean;
};

type ActorImageSet = {
  base: LoadedImage;
  movement: LoadedImage;
  life: LoadedImage;
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
  assets: ProfileRoomAssetState;
};

type StageOptions = {
  reducedMotion: boolean;
  onReset: () => void;
  onDoorInteraction: () => void;
  onActorInteraction: (actor: ProfileActorId, action: string) => void;
};

type Point = ProfileRoomPoint;
type DrawRect = { left: number; top: number; width: number; height: number; anchorX: number; anchorY: number };

const emptyImage = (): LoadedImage => ({ image: null, ready: false, failed: false });
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// `secondaryDesk` is a 128x128 cell in the reviewed furniture atlas.  Its
// central aperture begins just after source row 96; stop the actor before that
// row so no lower-body pixels can leak between the desk legs.  Keep a small
// safety margin for browser resampling and the 1px atlas edge.
const DESK_ACTOR_CLIP_BOTTOM_RATIO = 0.74;

export class ProfileSpriteStage {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private resizeObserver: ResizeObserver;
  private width = 576;
  private height = 288;
  private mobile = false;
  private listeners: Array<() => void> = [];
  private actorImages = new Map<ProfileActorId, ActorImageSet>();
  private furniture = emptyImage();
  private door = emptyImage();
  private lamps = emptyImage();
  private posterLeft = emptyImage();
  private posterRight = emptyImage();
  private snapshot: ProfileRoomSimulationState | null = null;
  private tv: ProfileRoomTv | null = null;
  private actionCounters = new Map<ProfileActorId, number>();
  private lastState: ProfileSpriteStageState = {
    depthOrder: [],
    renderInstanceCount: { nobita: 0, doraemon: 0, shizuka: 0, gian: 0, suneo: 0 },
    focusedActor: null,
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
          <span>ACT I · LIVING SIDE ROOM</span>
          <h3>THE LIVING RESEARCH DUNGEON</h3>
          <small>AUTONOMOUS SPRITE HABITAT / 05 ACTORS</small>
        </div>
        <canvas class="profile-sprite-canvas" width="576" height="288" aria-hidden="true"></canvas>
        <div class="profile-actor-controls" aria-label="Character interactions">
          ${PROFILE_ACTOR_IDS.map((id) => `<button type="button" data-profile-actor="${id}" aria-label="Trigger ${PROFILE_ACTORS[id].label} room action"><span>${PROFILE_ACTORS[id].label}</span></button>`).join("")}
        </div>
        <button class="profile-door-control" type="button" data-profile-door aria-label="Toggle the Anywhere Door inside the sprite room"><span>DOOR</span></button>
        <button class="profile-adventure-replay" type="button" data-profile-reset data-profile-replay><i aria-hidden="true">↻</i> RESET ROOM</button>
        <p class="profile-adventure-caption"><span data-room-status>ROOM ONLINE</span><b>PAC-LAB TV / 05</b></p>
        <ul class="profile-room-inventory sr-only" aria-label="Objects in the living research dungeon">
          <li>Hanging chandelier</li><li>Blackboard and blackboard eraser</li><li>Two research desks and chairs</li>
          <li>Teal sofa</li><li>Water cooler</li><li>Television playing a silent maze chase</li><li>Game console</li>
          <li>Six fuel lamps</li><li>Two framed pixel posters</li><li>Anywhere Door</li>
        </ul>
      </section>
    `;
    const canvas = this.root.querySelector<HTMLCanvasElement>(".profile-sprite-canvas");
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) throw new Error("Profile sprite Canvas2D is unavailable.");
    this.canvas = canvas;
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;

    this.bind(this.root.querySelector("[data-profile-reset]"), "click", () => this.options.onReset());
    this.bind(this.root.querySelector("[data-profile-door]"), "click", () => this.options.onDoorInteraction());
    this.root.querySelectorAll<HTMLButtonElement>("[data-profile-actor]").forEach((button) => {
      const actor = button.dataset.profileActor as ProfileActorId;
      this.bind(button, "click", () => {
        const count = (this.actionCounters.get(actor) || 0) + 1;
        this.actionCounters.set(actor, count);
        this.options.onActorInteraction(actor, count % 2 ? "room-reaction" : "signature");
      });
    });
    this.bind(this.root, "focusin", () => this.redraw());
    this.bind(this.root, "focusout", () => requestAnimationFrame(() => this.redraw()));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.root);
    this.resize();
  }

  async init(): Promise<void> {
    await Promise.all([
      ...PROFILE_ACTOR_IDS.map(async (id) => {
        const definition = PROFILE_ACTORS[id];
        const images: ActorImageSet = { base: emptyImage(), movement: emptyImage(), life: emptyImage() };
        this.actorImages.set(id, images);
        await Promise.all([
          this.loadImage(definition.baseAssetUrl, images.base, [384, 384]),
          this.loadImage(definition.movementAssetUrl, images.movement, [384, 384]),
          this.loadImage(definition.lifeAssetUrl, images.life, [384, 384])
        ]);
      }),
      this.loadImage(PROFILE_ROOM_V4_ASSETS.furniture, this.furniture, [384, 384]),
      this.loadImage(PROFILE_ROOM_V4_ASSETS.door, this.door, [256, 128]),
      this.loadImage(PROFILE_ROOM_V4_ASSETS.lamps, this.lamps, [256, 96]),
      this.loadImage(PROFILE_ROOM_V4_ASSETS.spiritedAwayPoster, this.posterLeft),
      this.loadImage(PROFILE_ROOM_V4_ASSETS.onePiecePoster, this.posterRight)
    ]);
    this.redraw();
  }

  destroy(): void {
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
    const rect = this.root.getBoundingClientRect();
    this.mobile = rect.width < 560 || window.matchMedia("(max-width: 760px)").matches;
    const nextWidth = this.mobile ? 320 : rect.width >= 650 ? 640 : 576;
    const nextHeight = this.mobile ? 352 : nextWidth === 640 ? 320 : 288;
    if (this.canvas.width !== nextWidth || this.canvas.height !== nextHeight) {
      this.width = nextWidth;
      this.height = nextHeight;
      this.canvas.width = nextWidth;
      this.canvas.height = nextHeight;
      this.ctx.imageSmoothingEnabled = false;
    }
    this.redraw();
  }

  private redraw(): ProfileSpriteStageState {
    const ctx = this.ctx;
    const snapshot = this.snapshot;
    ctx.imageSmoothingEnabled = false;
    this.drawRoomBase(ctx, snapshot);
    this.drawWallLayer(ctx, snapshot);
    this.drawFloorProps(ctx, snapshot);

    const actors = snapshot
      ? PROFILE_ACTOR_IDS.map((id) => snapshot.actors[id]).filter((actor) => actor.visible)
      : [];
    const ordered = actors.sort((a, b) => this.mapPoint(a.position)[1] - this.mapPoint(b.position)[1]);
    const focusedActor = this.focusedActor();
    for (const actor of ordered) {
      const deskOcclusionStation = this.deskOcclusionStation(actor);
      // A desk user is behind the furniture until it exits through the front
      // lane. Its ground shadow would otherwise survive below the chair after
      // the body was correctly hidden, reading as a detached second half.
      if (!deskOcclusionStation) this.drawActorShadow(ctx, actor);
      if (focusedActor === actor.id && !deskOcclusionStation) this.drawGroundFocus(ctx, actor.position);
      this.drawActor(ctx, actor, deskOcclusionStation);
    }
    this.drawForegroundProps(ctx, snapshot);
    this.drawLightingAndAtmosphere(ctx, snapshot);
    this.syncControls(snapshot);

    const count = { nobita: 0, doraemon: 0, shizuka: 0, gian: 0, suneo: 0 } as Record<ProfileActorId, 0 | 1>;
    for (const actor of ordered) count[actor.id] = 1;
    const assets = this.assetState();
    this.lastState = {
      depthOrder: ordered.map((actor) => actor.id),
      renderInstanceCount: count,
      focusedActor,
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
    const wallTop = Math.round(height * 0.105);
    const floorTop = Math.round(height * 0.305);
    const floorBottom = Math.round(height * 0.94);
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
    ctx.fillStyle = "#0b1512";
    ctx.fillRect(8, floorTop - 5, width - 16, 6);
    ctx.fillStyle = "#7a5930";
    ctx.fillRect(11, floorTop - 5, width - 22, 1);

    ctx.fillStyle = "#17372f";
    ctx.fillRect(16, floorTop, width - 32, floorBottom - floorTop);
    const tile = this.mobile ? 24 : 28;
    for (let y = floorTop; y < floorBottom; y += tile) {
      for (let x = 16; x < width - 16; x += tile) {
        const column = Math.floor((x - 16) / tile);
        const row = Math.floor((y - floorTop) / tile);
        ctx.fillStyle = (column + row) % 2 ? "#183a31" : "#1d4137";
        ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
        ctx.fillStyle = "rgba(135,190,151,.11)";
        ctx.fillRect(x + 2, y + 2, tile - 4, 1);
        ctx.fillStyle = "rgba(2,9,8,.28)";
        ctx.fillRect(x + tile - 2, y + 3, 1, tile - 5);
        if ((column * 11 + row * 7) % 8 === 0) {
          ctx.fillStyle = "rgba(181,116,55,.25)";
          ctx.fillRect(x + 5, y + tile - 5, 5, 1);
          ctx.fillRect(x + 9, y + tile - 6, 1, 3);
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

    const chandelier = this.mapPoint(PROFILE_ROOM_PROPS.chandelier.worldAnchor);
    const warmPool = ctx.createRadialGradient(chandelier[0], height * 0.64, 2, chandelier[0], height * 0.64, height * 0.34);
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
      ctx.fillRect(door[0] - height * 0.32, door[1] - height * 0.32, height * 0.64, height * 0.64);
    }
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
    ctx.fillRect(Math.round(this.width * 0.70), Math.round(this.height * 0.12), Math.round(this.width * 0.18), 3);
    ctx.fillRect(Math.round(this.width * 0.88), Math.round(this.height * 0.12), 3, Math.round(this.height * 0.12));
    ctx.fillStyle = "#aa7240";
    ctx.fillRect(Math.round(this.width * 0.70), Math.round(this.height * 0.12), Math.round(this.width * 0.18), 1);
    const shelfX = Math.round(this.width * 0.46);
    const shelfY = Math.round(this.height * 0.18);
    ctx.fillStyle = "#160f0a";
    ctx.fillRect(shelfX - 25, shelfY - 8, 50, 21);
    ctx.fillStyle = "#6c4724";
    ctx.fillRect(shelfX - 23, shelfY - 6, 46, 3);
    ctx.fillRect(shelfX - 23, shelfY + 4, 46, 2);
    for (let index = 0; index < 7; index += 1) {
      ctx.fillStyle = index % 2 ? "#b98b51" : "#7b9d7c";
      ctx.fillRect(shelfX - 20 + index * 6, shelfY - 2 + index % 2, 4, 6);
    }

    PROFILE_ROOM_LAMP_ANCHORS.forEach((point, index) => this.drawLamp(ctx, point, index, snapshot?.simulationElapsed || 0));
  }

  private drawFloorProps(ctx: CanvasRenderingContext2D, snapshot: ProfileRoomSimulationState | null): void {
    const water = this.propRect("waterCooler");
    const door = this.propRect("door");
    const primary = this.propRect("primaryDesk");
    const secondary = this.propRect("secondaryDesk");
    const tv = this.propRect("tv");
    const sofa = this.propRect("sofa");

    this.drawGroundedShadow(ctx, secondary, 0.34, 0.035);
    this.drawFurniture(ctx, "secondaryDesk", secondary.anchorX, secondary.anchorY, secondary.width, secondary.height);
    const secondaryChair = this.mapPoint([0.23, 0.735]);
    this.drawPropShadow(ctx, secondaryChair[0], secondaryChair[1] + 1, this.mobile ? 10 : 13, 3);
    this.drawFurniture(ctx, "chair", secondaryChair[0], secondaryChair[1], this.mobile ? 24 : 29, this.mobile ? 31 : 38);

    this.drawGroundedShadow(ctx, primary, 0.36, 0.038);
    this.drawFurniture(ctx, "secondaryDesk", primary.anchorX, primary.anchorY, primary.width, primary.height);
    const primaryChair = this.mapPoint([0.48, 0.735]);
    this.drawPropShadow(ctx, primaryChair[0], primaryChair[1] + 1, this.mobile ? 10 : 13, 3);
    this.drawFurniture(ctx, "chair", primaryChair[0], primaryChair[1], this.mobile ? 24 : 29, this.mobile ? 31 : 38);
    this.drawDeskClutter(ctx, primary.anchorX, primary.anchorY, snapshot?.simulationElapsed || 0);

    this.drawGroundedShadow(ctx, sofa, 0.41, 0.036);
    this.drawFurniture(ctx, "sofa", sofa.anchorX, sofa.anchorY, sofa.width, sofa.height);

    this.drawGroundedShadow(ctx, tv, 0.38, 0.034);
    this.drawTvScreen(ctx, tv);
    this.drawFurniture(ctx, "tvCabinet", tv.anchorX, tv.anchorY, tv.width, tv.height);
    const ps5Anchor = PROFILE_ROOM_SPRITE_META.tvCabinet.childAnchors?.ps5 || [0.73, 0.61];
    const ps5X = tv.left + tv.width * ps5Anchor[0];
    const ps5Y = tv.top + tv.height * ps5Anchor[1];
    ctx.fillStyle = "rgba(2,8,8,.38)";
    ctx.beginPath();
    ctx.ellipse(Math.round(ps5X), Math.round(ps5Y + 1), this.mobile ? 5 : 7, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // The source is a vertical console, but it is a small cabinet-top child.
    // Keep its footprint inside the TV rect so it reads as one grounded
    // furniture assembly instead of a second floor prop.
    this.drawFurniture(ctx, "ps5", ps5X, ps5Y, this.mobile ? 11 : 14, this.mobile ? 17 : 21);

    this.drawGroundedShadow(ctx, water, 0.25, 0.028);
    this.drawFurniture(ctx, "waterCooler", water.anchorX, water.anchorY, water.width, water.height);
    if (snapshot) {
      const user = snapshot.stationOccupancy["water-cooler"][0];
      if (user && snapshot.actors[user].state === "drinking") {
        ctx.fillStyle = "rgba(192,241,255,.72)";
        const bubble = Math.floor(snapshot.simulationElapsed * 5) % 8;
        ctx.fillRect(Math.round(water.anchorX - 2 + bubble % 3), Math.round(water.top + water.height * 0.25 - bubble), 2, 2);
      }
    }

    this.drawDoor(ctx, door.anchorX, door.anchorY, door.width, door.height, snapshot);

    // Floor crates and loose papers make the side room feel inhabited.  Keep
    // the central navigation lane open: a dark rectangular rug here used to
    // read as a floating shadow when the actors crossed it.
    this.drawCrate(ctx, this.width * 0.09, this.height * 0.66, 18);
    this.drawCrate(ctx, this.width * 0.92, this.height * 0.83, 15);
    ctx.strokeStyle = "rgba(214,162,81,.22)";
    ctx.strokeRect(Math.round(this.width * 0.38), Math.round(this.height * 0.78), Math.round(this.width * 0.12), Math.round(this.height * 0.055));
    ctx.fillStyle = "rgba(214,162,81,.38)";
    ctx.fillRect(Math.round(this.width * 0.38), Math.round(this.height * 0.78), 3, 1);
    ctx.fillRect(Math.round(this.width * 0.50) - 3, Math.round(this.height * 0.78), 3, 1);
    ctx.fillStyle = "#b9a477";
    ctx.fillRect(Math.round(this.width * 0.56), Math.round(this.height * 0.75), 8, 5);
    ctx.fillRect(Math.round(this.width * 0.58), Math.round(this.height * 0.77), 6, 4);
  }

  private drawForegroundProps(ctx: CanvasRenderingContext2D, snapshot: ProfileRoomSimulationState | null): void {
    const primary = this.propRect("primaryDesk");
    const secondary = this.propRect("secondaryDesk");
    const sofa = this.propRect("sofa");

    // Re-draw a desk only for its own aligned user.  Using a broad world-space
    // band here used to paint the desk over unrelated foreground walkers,
    // making a passing large sprite look as if it had been sliced into the
    // furniture.
    if (this.shouldOccludeDesk(snapshot, "primary-desk")) {
      this.drawFurniture(ctx, "secondaryDesk", primary.anchorX, primary.anchorY, primary.width, primary.height);
      this.drawDeskClutter(ctx, primary.anchorX, primary.anchorY, snapshot?.simulationElapsed || 0);
    }
    if (this.shouldOccludeDesk(snapshot, "secondary-desk")) {
      this.drawFurniture(ctx, "secondaryDesk", secondary.anchorX, secondary.anchorY, secondary.width, secondary.height);
    }

    // Redraw only the physical front rails, at the same place as the furniture surface.
    ctx.fillStyle = "#2c1b10";
    ctx.fillRect(Math.round(primary.left + primary.width * 0.08), Math.round(primary.top + primary.height * 0.55), Math.round(primary.width * 0.84), 5);
    ctx.fillRect(Math.round(secondary.left + secondary.width * 0.08), Math.round(secondary.top + secondary.height * 0.55), Math.round(secondary.width * 0.84), 5);
    ctx.fillStyle = "#95633a";
    ctx.fillRect(Math.round(primary.left + primary.width * 0.1), Math.round(primary.top + primary.height * 0.55), Math.round(primary.width * 0.8), 1);
    ctx.fillRect(Math.round(secondary.left + secondary.width * 0.1), Math.round(secondary.top + secondary.height * 0.55), Math.round(secondary.width * 0.8), 1);
    ctx.fillStyle = "#0d2c29";
    ctx.fillRect(Math.round(sofa.left + sofa.width * 0.07), Math.round(sofa.top + sofa.height * 0.73), Math.round(sofa.width * 0.86), 6);
    ctx.fillStyle = "#23605a";
    ctx.fillRect(Math.round(sofa.left + sofa.width * 0.11), Math.round(sofa.top + sofa.height * 0.72), Math.round(sofa.width * 0.78), 2);

    const chandelier = this.propRect("chandelier");
    ctx.fillStyle = "#21140c";
    ctx.fillRect(Math.round(chandelier.anchorX - 1), 0, 3, Math.max(2, Math.round(chandelier.top + chandelier.height * 0.18)));
    ctx.fillStyle = "#d6a04f";
    ctx.fillRect(Math.round(chandelier.anchorX), 0, 1, Math.max(2, Math.round(chandelier.top + chandelier.height * 0.18)));
    this.drawFurniture(ctx, "chandelier", chandelier.anchorX, chandelier.anchorY, chandelier.width, chandelier.height);

    const railY = Math.round(this.height * 0.925);
    ctx.fillStyle = "#130d09";
    ctx.fillRect(8, railY, this.width - 16, 12);
    ctx.fillStyle = "#714b28";
    ctx.fillRect(11, railY, this.width - 22, 3);
    for (let x = 18; x < this.width - 15; x += this.mobile ? 20 : 25) {
      ctx.fillStyle = "#95653a";
      ctx.fillRect(x, railY - 4, 4, 13);
      ctx.fillStyle = "#28190f";
      ctx.fillRect(x + 4, railY - 2, 2, 11);
    }
  }

  private shouldOccludeDesk(
    snapshot: ProfileRoomSimulationState | null,
    station: "primary-desk" | "secondary-desk"
  ): boolean {
    if (!snapshot) return false;
    return PROFILE_ACTOR_IDS.some((id) => this.actorNeedsDeskOcclusion(snapshot.actors[id], station));
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

  private drawActor(
    ctx: CanvasRenderingContext2D,
    actor: ProfileActorRuntime,
    deskOcclusionStation: ProfileRoomDeskStation | null
  ): void {
    const [x, y] = this.mapPoint(actor.position);
    const size = this.actorSize(actor.id);
    const deskOccludedActorClipBottom = deskOcclusionStation
      ? this.deskOccludedActorClipBottom(deskOcclusionStation)
      : null;
    let opacity = 1;
    let portalOffset = 0;
    if (actor.state === "portal-entering") {
      const progress = clamp01(actor.stateElapsed / Math.max(0.01, actor.activityDuration || 1.4));
      opacity = 1 - progress * 0.94;
      portalOffset = progress * 10;
    } else if (actor.state === "portal-returning") {
      const progress = clamp01(actor.stateElapsed / Math.max(0.01, actor.activityDuration || 1.4));
      opacity = 0.06 + progress * 0.94;
      portalOffset = (1 - progress) * 9;
    }
    const idle = this.options.reducedMotion || actor.state === "walking" ? 0 : Math.sin((this.snapshot?.simulationElapsed || 0) * 1.7 + PROFILE_ACTOR_IDS.indexOf(actor.id)) * 0.35;
    ctx.save();
    if (deskOccludedActorClipBottom !== null) {
      // The reviewed desk sprite intentionally has transparent space between
      // its legs.  A worker is seated behind the desk, so the actor atlas must
      // be clipped at the desk's lower apron edge; otherwise the lower half of
      // the sprite leaks through that transparent opening and looks embedded
      // in the furniture.
      ctx.beginPath();
      ctx.rect(0, 0, this.width, deskOccludedActorClipBottom);
      ctx.clip();
    }
    ctx.globalAlpha = opacity;
    ctx.translate(Math.round(x + portalOffset), Math.round(y + idle));
    const flip = actor.facing === "left" && actor.frame.includes("movement:side");
    if (flip) ctx.scale(-1, 1);
    const images = this.actorImages.get(actor.id);
    const [group, frameName, indexValue] = actor.frame.split(":");
    let drawn = false;
    if (group === "movement" && images?.movement.ready && images.movement.image) {
      const direction = frameName as "down" | "side" | "up";
      const index = Math.min(2, Math.max(0, Number(indexValue) || 0));
      const frameIndex = (direction === "down" ? 0 : direction === "side" ? 3 : 6) + index;
      this.drawActorCell(ctx, images.movement.image, frameIndex, size);
      drawn = true;
    } else if (group === "life" && images?.life.ready && images.life.image) {
      const frameIndex = PROFILE_LIFE_FRAME_ORDER.indexOf(frameName as (typeof PROFILE_LIFE_FRAME_ORDER)[number]);
      if (frameIndex >= 0) {
        this.drawActorCell(ctx, images.life.image, frameIndex, size);
        drawn = true;
      }
    } else if (group === "base" && images?.base.ready && images.base.image) {
      const frameIndex = PROFILE_BASE_FRAME_ORDER.indexOf(frameName as ProfileSpriteFrameId);
      if (frameIndex >= 0) {
        this.drawActorCell(ctx, images.base.image, frameIndex, size);
        drawn = true;
      }
    }
    if (!drawn && images?.base.ready && images.base.image) {
      const fallback = group === "movement" ? 1 + (Number(indexValue) || 0) % 3 : frameName === "room-reaction" ? 6 : frameName.startsWith("think") ? 4 : frameName.startsWith("drink") ? 5 : frameName.startsWith("sit") ? 8 : 0;
      this.drawActorCell(ctx, images.base.image, fallback, size);
      drawn = true;
    }
    if (!drawn) this.drawFallbackActor(ctx, actor.id, size, actor.frame);
    ctx.restore();
  }

  private deskOccludedActorClipBottom(station: ProfileRoomDeskStation): number {
    const desk = this.propRect(PROFILE_ROOM_DESK_ACCESS[station].propKey);
    // The central opening starts at roughly source row 97/128. Stop three
    // source pixels earlier so a scaled edge or antialiased actor pixel can
    // never enter the opening during the final approach to a desk either.
    return desk.top + desk.height * DESK_ACTOR_CLIP_BOTTOM_RATIO;
  }

  private deskOcclusionStation(actor: ProfileActorRuntime): ProfileRoomDeskStation | null {
    for (const station of ["primary-desk", "secondary-desk"] as const) {
      if (this.actorNeedsDeskOcclusion(actor, station)) return station;
    }
    return null;
  }

  private actorNeedsDeskOcclusion(actor: ProfileActorRuntime, station: "primary-desk" | "secondary-desk"): boolean {
    if (!actor.visible) return false;
    const access = PROFILE_ROOM_DESK_ACCESS[station];
    const bounds = PROFILE_ROOM_PROPS[access.propKey].collisionBounds;
    if (!bounds) return false;
    // This is a render-depth corridor rather than a station-state test. It
    // covers both approach and the mandatory forward exit, including the
    // first frames after an actor has reserved its next station.
    return Math.abs(actor.position[0] - access.frontLane[0]) <= access.alignmentHalfWidth + 0.004
      && actor.position[1] >= bounds[1] - 0.02
      && actor.position[1] <= access.ingressGuardBottom + 0.008;
  }

  private drawActorCell(ctx: CanvasRenderingContext2D, image: HTMLImageElement, index: number, size: number): void {
    const sx = (index % 3) * 128;
    const sy = Math.floor(index / 3) * 128;
    ctx.drawImage(image, sx, sy, 128, 128, -size / 2, -size, size, size);
  }

  private drawFallbackActor(ctx: CanvasRenderingContext2D, actor: ProfileActorId, size: number, frame: string): void {
    const unit = Math.max(2, Math.round(size / 20));
    const stocky = actor === "gian" ? 1.24 : actor === "doraemon" ? 1.17 : actor === "suneo" ? 0.8 : 1;
    ctx.fillStyle = PROFILE_ACTORS[actor].fallbackColor;
    ctx.fillRect(-unit * 4 * stocky, -unit * 8, unit * 8 * stocky, unit * 6);
    ctx.beginPath();
    ctx.arc(0, -unit * 10, unit * (actor === "doraemon" ? 5 : 4), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = actor === "doraemon" ? "#f4f2e8" : "#efc39c";
    ctx.fillRect(-unit * 2.6, -unit * 11, unit * 5.2, unit * 3.7);
    ctx.fillStyle = "#111513";
    ctx.fillRect(-unit * 1.7, -unit * 10.2, unit, unit);
    ctx.fillRect(unit * 0.7, -unit * 10.2, unit, unit);
    const raised = frame.includes("reaction") || frame.includes("signature");
    ctx.strokeStyle = PROFILE_ACTORS[actor].fallbackColor;
    ctx.lineWidth = unit * 1.7;
    ctx.beginPath();
    ctx.moveTo(-unit * 3, -unit * 7);
    ctx.lineTo(-unit * 5, raised ? -unit * 12 : -unit * 4);
    ctx.moveTo(unit * 3, -unit * 7);
    ctx.lineTo(unit * 5, raised ? -unit * 12 : -unit * 4);
    ctx.stroke();
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
    let adjustedY = y;
    if (PROFILE_ROOM_SPRITE_META[key].mount === "wall") {
      // Wall-mounted props stop just above the wall/floor seam.  This keeps a
      // tall mobile projection from making the lower frame look like it is
      // standing on the floor.
      const seam = Math.round(this.height * 0.305) - 2;
      const bottom = y + height * pivot[1];
      if (bottom > seam) adjustedY -= bottom - seam;
    }
    return {
      left: Math.round(x - width * pivot[0]),
      top: Math.round(adjustedY - height * pivot[1]),
      width: Math.round(width),
      height: Math.round(height),
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
      ctx.fillRect(x + 5, y + 5, width - 10, Math.round(height * 0.64));
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
      const lampHeight = this.mobile ? 27 : 33;
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
    ctx.restore();
  }

  private drawDeskClutter(ctx: CanvasRenderingContext2D, x: number, y: number, elapsed: number): void {
    ctx.fillStyle = "#d4c59a";
    ctx.fillRect(Math.round(x - 19), Math.round(y - 33), 13, 8);
    ctx.fillStyle = "#b98750";
    ctx.fillRect(Math.round(x - 17), Math.round(y - 31), 9, 1);
    ctx.fillStyle = "#122c29";
    ctx.fillRect(Math.round(x + 5), Math.round(y - 36), 18, 11);
    ctx.fillStyle = "#76d0c0";
    const scan = this.options.reducedMotion ? 5 : Math.floor(elapsed * 8) % 12;
    ctx.fillRect(Math.round(x + 8 + scan), Math.round(y - 33), 3, 2);
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

  private drawGroundedShadow(ctx: CanvasRenderingContext2D, rect: DrawRect, widthScale: number, heightScale: number): void {
    this.drawPropShadow(
      ctx,
      rect.anchorX,
      rect.anchorY + 1,
      Math.max(2, rect.width * widthScale),
      Math.max(2, rect.height * heightScale)
    );
  }

  private propRect(id: keyof typeof PROFILE_ROOM_PROPS): DrawRect {
    const prop = PROFILE_ROOM_PROPS[id];
    const [anchorX, anchorY] = this.mapPoint(prop.worldAnchor);
    const size = this.mobile ? prop.mobileSize : prop.desktopSize;
    const width = size[0] * this.width;
    const height = size[1] * this.height;
    const pivot = prop.sprite ? PROFILE_ROOM_SPRITE_META[prop.sprite].pivot : [0.5, 0.5];
    return {
      left: Math.round(anchorX - width * pivot[0]),
      top: Math.round(anchorY - height * pivot[1]),
      width: Math.round(width),
      height: Math.round(height),
      anchorX,
      anchorY
    };
  }

  private mapPoint(point: Point): Point {
    if (!this.mobile) return [point[0] * this.width, point[1] * this.height];
    // The tall mobile room keeps three clear vertical bands and wider edge corridors.
    const x = 0.05 + point[0] * 0.9;
    const y = point[1] < 0.34
      ? 0.04 + point[1] * 0.95
      : point[1] < 0.64
        ? 0.02 + point[1] * 1.02
        : -0.02 + point[1] * 1.06;
    return [x * this.width, y * this.height];
  }

  private actorSize(id: ProfileActorId): number {
    const base = this.mobile ? 50 : this.width >= 640 ? 60 : 58;
    return Math.round(base * PROFILE_ACTORS[id].scale);
  }

  private focusedActor(): ProfileActorId | null {
    const active = document.activeElement as HTMLElement | null;
    return active?.dataset.profileActor as ProfileActorId || null;
  }

  private syncControls(snapshot: ProfileRoomSimulationState | null): void {
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
      button.style.top = `${(y - size) / this.height * 100}%`;
      button.style.width = `${Math.max(38, size)}px`;
      button.style.height = `${Math.max(44, size)}px`;
      button.dataset.actorState = actor.state;
    }
    const doorButton = this.root.querySelector<HTMLElement>("[data-profile-door]");
    if (doorButton) {
      const door = this.propRect("door");
      doorButton.style.left = `${door.anchorX / this.width * 100}%`;
      doorButton.style.top = `${door.top / this.height * 100}%`;
      doorButton.style.width = `${door.width}px`;
      doorButton.style.height = `${door.height}px`;
    }
  }

  private assetState(): ProfileRoomAssetState {
    const actors = {} as Record<ProfileActorId, "ready" | "partial-fallback" | "failed">;
    for (const id of PROFILE_ACTOR_IDS) {
      const images = this.actorImages.get(id);
      actors[id] = images?.base.ready && images.movement.ready && images.life.ready
        ? "ready"
        : images?.base.ready || images?.movement.ready || images?.life.ready
          ? "partial-fallback"
          : "failed";
    }
    return {
      actors,
      furniture: this.furniture.ready ? "ready" : "fallback",
      door: this.door.ready ? "ready" : "fallback",
      lamps: this.lamps.ready ? "ready" : "fallback",
      posters: this.posterLeft.ready && this.posterRight.ready ? "ready" : "fallback"
    };
  }
}
