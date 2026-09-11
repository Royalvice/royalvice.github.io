import { CabinControls } from "./CabinControls";
import { PROFILE_ACTOR_IDS, type ProfileActorId } from "./profileAdventureAssets";
import {
  ProfileRoomSimulation,
  type ProfileActorState,
  type ProfileRoomStationId
} from "./ProfileRoomSimulation";
import { ProfileSpriteStage, type ProfileRoomAssetState, type ProfileSpriteStageState, type ProfileTvPowerPhase } from "./ProfileSpriteStage";
import { ProfileRoomTv } from "./ProfileRoomTv";
import { PROFILE_ROOM_LAYOUT_VERSION, profileRoomLayoutSnapshot } from "./profileRoomLayout";

export type ProfileRoomDebugState = {
  layoutVersion: typeof PROFILE_ROOM_LAYOUT_VERSION;
  ready: boolean;
  simulationElapsed: number;
  elapsed: number;
  running: boolean;
  paused: boolean;
  reducedMotion: boolean;
  actors: Record<ProfileActorId, {
    state: ProfileActorState;
    stateElapsed: number;
    visible: boolean;
    position: [number, number];
    facing: string;
    station: ProfileRoomStationId | null;
    frame: string;
    renderInstanceCount: 0 | 1;
    visitedStations: ProfileRoomStationId[];
    activityDuration: number;
    blockedElapsed: number;
    blockedBy: ProfileActorId | null;
    replanCount: number;
    speed: number;
    walkDistance: number;
  }>;
  actorFrames: Record<ProfileActorId, string>;
  actorPositions: Record<ProfileActorId, [number, number]>;
  depthOrder: ProfileActorId[];
  focusedActor: ProfileActorId | null;
  stationOccupancy: Record<ProfileRoomStationId, ProfileActorId[]>;
  doorFrame: "closed" | "open";
  doorUser: ProfileActorId | null;
  portalStrength: number;
  tvFrame: number;
  tvProgram: string;
  tvPowerPhase: ProfileTvPowerPhase;
  tvPowerHistory: ProfileTvPowerPhase[];
  navigation: {
    deadlockRecoveries: number;
    reservedCells: Array<{ cell: string; actor: ProfileActorId }>;
  };
  layout: ReturnType<typeof profileRoomLayoutSnapshot>;
  viewport: ReturnType<ProfileSpriteStage["getViewportState"]>;
  assets: ProfileRoomAssetState;
  controlledActor:ProfileActorId|null;
  event:unknown;
  ruru:unknown;
};

declare global {
  interface Window {
    __profileAdventureDebug?: {
      getState: () => ProfileRoomDebugState;
      setTime: (seconds: number) => void;
      advanceTime: (seconds: number) => void;
      getLayout: () => ReturnType<typeof profileRoomLayoutSnapshot>;
      setSeed: (seed: number) => void;
      play: () => void;
      pause: () => void;
      reset: () => void;
      replay: () => void;
      triggerActor: (actor: ProfileActorId, action?: string) => void;
      sendActorTo: (actor: ProfileActorId, station: ProfileRoomStationId) => boolean;
      setDoorOpen: (open: boolean) => void;
      control: (id:ProfileActorId|null)=>void;
      setInput:(x:number,y:number,run?:boolean)=>void;
      setDebug:(enabled:boolean)=>void;
      setTvPowerPhase: (phase: ProfileTvPowerPhase) => void;
    };
  }
}

type DirectorOptions = {
  reducedMotion: boolean;
  onTvInteraction?: () => void | Promise<void>;
};

const emptyAssets = (): ProfileRoomAssetState => ({
  actors: { nobita: "failed", doraemon: "failed", shizuka: "failed", gian: "failed", suneo: "failed" },
  furniture: "fallback",
  door: "fallback",
  lamps: "fallback",
  posters: "fallback"
});

export class ProfileAdventureDirector {
  setWindowFrame(canvas:HTMLCanvasElement):void {this.stage.setWindowFrame(canvas);}
  setCabinetFrame(canvas:HTMLCanvasElement):void {this.stage.setCabinetFrame(canvas);}
  setMusicState(playing:boolean,time:number):void {this.stage.setMusicState(playing,time);this.simulation.setMusicState(playing);}
  private simulation: ProfileRoomSimulation;
  private controls:CabinControls;
  private tv: ProfileRoomTv;
  private stage: ProfileSpriteStage;
  private running = false;
  private paused = true;
  private ready = false;
  private roomVisible=true;
  private visibilityObserver:IntersectionObserver;
  private raf = 0;
  private lastFrame = 0;
  private accumulator = 0;
  private lastRenderAt = Number.NEGATIVE_INFINITY;
  private stageState: ProfileSpriteStageState = {
    depthOrder: [],
    renderInstanceCount: { nobita: 0, doraemon: 0, shizuka: 0, gian: 0, suneo: 0 },
    focusedActor: null,
    tvPowerPhase: "idle",
    assets: emptyAssets()
  };
  private listeners: Array<() => void> = [];
  private tvPowerPhase: ProfileTvPowerPhase = "idle";
  private tvPowerHistory: ProfileTvPowerPhase[] = ["idle"];
  private tvBootTimers: number[] = [];

  constructor(private root: HTMLElement, private options: DirectorOptions) {
    this.simulation = new ProfileRoomSimulation(options.reducedMotion);
    this.tv = new ProfileRoomTv(options.reducedMotion);
    this.stage = new ProfileSpriteStage(root, {
      reducedMotion: options.reducedMotion,
      onReset: () => this.reset(),
      onDoorInteraction: () => this.toggleDoor(),
      onTvInteraction: () => this.activateTvArcade(),
      onActorInteraction: (actor, action) => action==="control"?this.controls.select(actor):this.triggerActor(actor, action)
    });
    this.controls=new CabinControls(root,this.simulation,()=>{this.render();this.resume();});
    this.bind(root.querySelector('[data-profile-ruru]')!,'click',()=>{this.simulation.greetRuru();this.render();});
    this.bind(document, "keydown", ((event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector('dialog[open]')) return;
      this.cancelManualActions();
    }) as EventListener);
    this.visibilityObserver=new IntersectionObserver(entries=>{this.roomVisible=entries[0].isIntersecting;if(!this.roomVisible)this.pause();else if(!document.hidden&&!document.querySelector('dialog[open]'))this.resume();});this.visibilityObserver.observe(root);
    this.installDebugHook();
  }

  async init(): Promise<void> {
    await this.stage.init();
    this.ready = true;
    this.render();
    if (!this.options.reducedMotion) this.resume();
  }

  destroy(): void {
    this.pause();
    this.clearTvBootTimers();
    this.controls.destroy();
    this.visibilityObserver.disconnect();
    this.stage.destroy();
    this.listeners.splice(0).forEach((dispose) => dispose());
    delete window.__profileAdventureDebug;
  }

  pause(): void {
    this.controls?.clear();
    this.paused = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.accumulator = 0;
  }

  resume(): void {
    if (!this.roomVisible || document.hidden || (this.options.reducedMotion&&!this.simulation.getState().controlledActor) || !this.ready || this.running) return;
    this.paused = false;
    this.running = true;
    this.lastFrame = performance.now();
    this.lastRenderAt = Number.NEGATIVE_INFINITY;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame((now) => this.tick(now));
  }

  reset(): void {
    this.simulation.reset();
    this.controls.sync();
    this.tv.reset();
    this.accumulator = 0;
    this.render();
    if (!this.options.reducedMotion) this.resume();
  }

  replay(): void {
    this.reset();
  }

  setTime(seconds: number): void {
    this.pause();
    this.simulation.setTime(seconds);
    this.tv.setTime(this.simulation.getState().simulationElapsed);
    this.render();
  }

  advanceTime(seconds: number): void {
    this.pause();
    this.simulation.advanceTime(seconds);
    this.tv.setTime(this.simulation.getState().simulationElapsed);
    this.render();
  }

  setSeed(seed: number): void {
    this.pause();
    this.simulation.setSeed(seed);
    this.tv.setTime(0);
    this.render();
    if (!this.options.reducedMotion) this.resume();
  }

  triggerActor(actor: ProfileActorId, action = "room-reaction"): void {
    if (this.options.reducedMotion) return;
    this.simulation.triggerActor(actor, action);
    this.render();
    this.resume();
  }

  sendActorTo(actor: ProfileActorId, station: ProfileRoomStationId): boolean {
    if (this.options.reducedMotion) return false;
    const assigned = this.simulation.sendActorTo(actor, station);
    this.render();
    this.resume();
    return assigned;
  }

  setTerminalLighting(mode:"day"|"night"):void {
    this.root.dataset.terminalLight=mode;
    this.render();
  }

  setDoorOpen(open: boolean): void {
    this.simulation.setDoorOpen(open);
    this.render();
    if (!this.options.reducedMotion) this.resume();
  }

  cancelManualActions(): void {
    this.simulation.cancelManualActions();
    this.controls.sync();
    this.render();
  }

  resetTvPower(): void {
    this.clearTvBootTimers();
    this.tvPowerPhase = "idle";
    this.tvPowerHistory.push("idle");
    this.stage.setTvPowerPhase("idle");
  }

  setTvPowerPhase(phase: ProfileTvPowerPhase): void {
    this.clearTvBootTimers();
    this.tvPowerPhase = phase;
    this.tvPowerHistory.push(phase);
    this.stage.setTvPowerPhase(phase);
  }

  private activateTvArcade(): void {
    if (this.tvPowerPhase !== "idle") return;
    this.pause();
    if (this.options.reducedMotion) {
      this.tvPowerPhase = "arcade";
      this.tvPowerHistory.push("arcade");
      this.stage.setTvPowerPhase("arcade");
      void this.options.onTvInteraction?.();
      return;
    }
    this.tvPowerPhase = "glow";
    this.tvPowerHistory.push("glow");
    this.stage.setTvPowerPhase("glow");
    this.tvBootTimers.push(window.setTimeout(() => {
      this.tvPowerPhase = "white";
      this.tvPowerHistory.push("white");
      this.stage.setTvPowerPhase("white");
    }, 220));
    this.tvBootTimers.push(window.setTimeout(() => {
      this.tvPowerPhase = "arcade";
      this.tvPowerHistory.push("arcade");
      this.stage.setTvPowerPhase("arcade");
      void this.options.onTvInteraction?.();
    }, 420));
  }

  private clearTvBootTimers(): void {
    this.tvBootTimers.splice(0).forEach((timer) => window.clearTimeout(timer));
  }

  private toggleDoor(): void {
    if (this.options.reducedMotion) return;
    this.simulation.toggleDoor();
    this.render();
    this.resume();
  }

  private tick(now: number): void {
    if (!this.running || this.paused) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.accumulator += dt;
    let steps=0;
    while (this.accumulator >= this.simulation.fixedStep && steps++<3) {
      this.simulation.step(this.simulation.fixedStep);
      this.accumulator -= this.simulation.fixedStep;
    }
    const elapsed = this.simulation.getState().simulationElapsed;
    this.tv.setTime(elapsed);
    if (now - this.lastRenderAt >= 1000 / (innerWidth<760?30:60)-1) {
      this.lastRenderAt = now;
      this.render();
    }
    this.raf = requestAnimationFrame((next) => this.tick(next));
  }

  private render(): void {
    this.stageState = this.stage.render(this.running?this.simulation.getRenderState(Math.min(1,this.accumulator/this.simulation.fixedStep)):this.simulation.getState(), this.tv);
  }

  private getState(): ProfileRoomDebugState {
    const simulation = this.simulation.getState();
    const tv = this.tv.getState();
    this.stageState = this.stage.getState();
    const actors = {} as ProfileRoomDebugState["actors"];
    const actorFrames = {} as Record<ProfileActorId, string>;
    const actorPositions = {} as Record<ProfileActorId, [number, number]>;
    for (const id of PROFILE_ACTOR_IDS) {
      const actor = simulation.actors[id];
      actors[id] = {
        state: actor.state,
        stateElapsed: actor.stateElapsed,
        visible: actor.visible,
        position: [...actor.position],
        facing: actor.facing,
        station: actor.station,
        frame: actor.frame,
        renderInstanceCount: this.stageState.renderInstanceCount[id],
        visitedStations: [...actor.visitedStations],
        activityDuration: actor.activityDuration,
        blockedElapsed: actor.blockedElapsed,
        blockedBy: actor.blockedBy,
        replanCount: actor.replanCount,
        speed: actor.speed,
        walkDistance: actor.walkDistance
      };
      actorFrames[id] = actor.frame;
      actorPositions[id] = [...actor.position];
    }
    return {
      layoutVersion: simulation.layoutVersion,
      ready: this.ready,
      simulationElapsed: simulation.simulationElapsed,
      elapsed: simulation.simulationElapsed,
      running: this.running,
      paused: this.paused,
      reducedMotion: this.options.reducedMotion,
      actors,
      actorFrames,
      actorPositions,
      depthOrder: [...this.stageState.depthOrder],
      focusedActor: this.stageState.focusedActor,
      stationOccupancy: Object.fromEntries(Object.entries(simulation.stationOccupancy).map(([station, ids]) => [station, [...ids]])) as ProfileRoomDebugState["stationOccupancy"],
      doorFrame: simulation.doorFrame,
      doorUser: simulation.doorUser,
      portalStrength: simulation.doorStrength,
      tvFrame: tv.frame,
      tvProgram: "YZY ARCADE / 15",
      tvPowerPhase: this.tvPowerPhase,
      tvPowerHistory: [...this.tvPowerHistory],
      navigation: {
        deadlockRecoveries: simulation.navigation.deadlockRecoveries,
        reservedCells: simulation.navigation.reservedCells.map((entry) => ({ ...entry }))
      },
      layout: profileRoomLayoutSnapshot(),
      viewport: this.stage.getViewportState(),
      controlledActor:simulation.controlledActor,
      event:simulation.event,
      ruru:simulation.ruru,
      assets: this.stageState.assets
    };
  }

  private installDebugHook(): void {
    window.__profileAdventureDebug = {
      control:(id:ProfileActorId|null)=>this.controls.select(id),
      setInput:(x:number,y:number,run=false)=>this.simulation.setInput(x,y,run),
      getState: () => this.getState(),
      setTime: (seconds) => this.setTime(seconds),
      advanceTime: (seconds) => this.advanceTime(seconds),
      getLayout: () => profileRoomLayoutSnapshot(),
      setDebug:(enabled:boolean)=>{this.root.dataset.cabinDebug=String(enabled);this.render();},
      setSeed: (seed) => this.setSeed(seed),
      play: () => this.resume(),
      pause: () => this.pause(),
      reset: () => this.reset(),
      replay: () => this.reset(),
      triggerActor: (actor, action) => this.triggerActor(actor, action),
      sendActorTo: (actor, station) => this.sendActorTo(actor, station),
      setDoorOpen: (open) => this.setDoorOpen(open),
      setTvPowerPhase: (phase) => this.setTvPowerPhase(phase)
    };
  }

  private bind(target: EventTarget, event: string, callback: EventListener): void {
    target.addEventListener(event, callback);
    this.listeners.push(() => target.removeEventListener(event, callback));
  }
}
