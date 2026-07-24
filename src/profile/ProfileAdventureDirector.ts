import { PROFILE_ACTOR_IDS, type ProfileActorId } from "./profileAdventureAssets";
import {
  ProfileRoomSimulation,
  type ProfileActorState,
  type ProfileRoomStationId
} from "./ProfileRoomSimulation";
import { ProfileSpriteStage, type ProfileRoomAssetState, type ProfileSpriteStageState } from "./ProfileSpriteStage";
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
  tvPelletsRemaining: number;
  navigation: {
    deadlockRecoveries: number;
    reservedCells: Array<{ cell: string; actor: ProfileActorId }>;
  };
  layout: ReturnType<typeof profileRoomLayoutSnapshot>;
  assets: ProfileRoomAssetState;
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
    };
  }
}

type DirectorOptions = {
  reducedMotion: boolean;
};

const emptyAssets = (): ProfileRoomAssetState => ({
  actors: { nobita: "failed", doraemon: "failed", shizuka: "failed", gian: "failed", suneo: "failed" },
  furniture: "fallback",
  door: "fallback",
  lamps: "fallback",
  posters: "fallback"
});

export class ProfileAdventureDirector {
  private simulation: ProfileRoomSimulation;
  private tv: ProfileRoomTv;
  private stage: ProfileSpriteStage;
  private running = false;
  private paused = true;
  private ready = false;
  private raf = 0;
  private lastFrame = 0;
  private accumulator = 0;
  private lastRenderAt = Number.NEGATIVE_INFINITY;
  private stageState: ProfileSpriteStageState = {
    depthOrder: [],
    renderInstanceCount: { nobita: 0, doraemon: 0, shizuka: 0, gian: 0, suneo: 0 },
    focusedActor: null,
    assets: emptyAssets()
  };
  private listeners: Array<() => void> = [];

  constructor(private root: HTMLElement, private options: DirectorOptions) {
    this.simulation = new ProfileRoomSimulation(options.reducedMotion);
    this.tv = new ProfileRoomTv(options.reducedMotion);
    this.stage = new ProfileSpriteStage(root, {
      reducedMotion: options.reducedMotion,
      onReset: () => this.reset(),
      onDoorInteraction: () => this.toggleDoor(),
      onActorInteraction: (actor, action) => this.triggerActor(actor, action)
    });
    this.bind(document, "keydown", ((event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      this.cancelManualActions();
    }) as EventListener);
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
    this.stage.destroy();
    this.listeners.splice(0).forEach((dispose) => dispose());
    delete window.__profileAdventureDebug;
  }

  pause(): void {
    this.paused = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.accumulator = 0;
  }

  resume(): void {
    if (this.options.reducedMotion || !this.ready || this.running) return;
    this.paused = false;
    this.running = true;
    this.lastFrame = performance.now();
    this.lastRenderAt = Number.NEGATIVE_INFINITY;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame((now) => this.tick(now));
  }

  reset(): void {
    this.simulation.reset();
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

  setDoorOpen(open: boolean): void {
    this.simulation.setDoorOpen(open);
    this.render();
    if (!this.options.reducedMotion) this.resume();
  }

  cancelManualActions(): void {
    this.simulation.cancelManualActions();
    this.render();
  }

  private toggleDoor(): void {
    if (this.options.reducedMotion) return;
    this.simulation.toggleDoor();
    this.render();
    this.resume();
  }

  private tick(now: number): void {
    if (!this.running || this.paused) return;
    const dt = Math.min(0.25, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.accumulator += dt;
    while (this.accumulator >= this.simulation.fixedStep) {
      this.simulation.step(this.simulation.fixedStep);
      this.accumulator -= this.simulation.fixedStep;
    }
    const elapsed = this.simulation.getState().simulationElapsed;
    this.tv.setTime(elapsed);
    if (now - this.lastRenderAt >= 1000 / 15) {
      this.lastRenderAt = now;
      this.render();
    }
    this.raf = requestAnimationFrame((next) => this.tick(next));
  }

  private render(): void {
    this.stageState = this.stage.render(this.simulation.getState(), this.tv);
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
      tvPelletsRemaining: tv.pelletsRemaining,
      navigation: {
        deadlockRecoveries: simulation.navigation.deadlockRecoveries,
        reservedCells: simulation.navigation.reservedCells.map((entry) => ({ ...entry }))
      },
      layout: profileRoomLayoutSnapshot(),
      assets: this.stageState.assets
    };
  }

  private installDebugHook(): void {
    window.__profileAdventureDebug = {
      getState: () => this.getState(),
      setTime: (seconds) => this.setTime(seconds),
      advanceTime: (seconds) => this.advanceTime(seconds),
      getLayout: () => profileRoomLayoutSnapshot(),
      setSeed: (seed) => this.setSeed(seed),
      play: () => this.resume(),
      pause: () => this.pause(),
      reset: () => this.reset(),
      replay: () => this.reset(),
      triggerActor: (actor, action) => this.triggerActor(actor, action),
      sendActorTo: (actor, station) => this.sendActorTo(actor, station),
      setDoorOpen: (open) => this.setDoorOpen(open)
    };
  }

  private bind(target: EventTarget, event: string, callback: EventListener): void {
    target.addEventListener(event, callback);
    this.listeners.push(() => target.removeEventListener(event, callback));
  }
}
