import { PROFILE_ACTOR_IDS, type ProfileActorId } from "./profileAdventureAssets";
import {
  PROFILE_ROOM_COLLISION_BOUNDS,
  PROFILE_ROOM_DESK_ACCESS,
  PROFILE_ROOM_LAYOUT_VERSION,
  PROFILE_ROOM_NAV_GRID,
  PROFILE_ROOM_PROPS,
  PROFILE_ROOM_STATION_FACING,
  PROFILE_ROOM_STATION_POSITIONS,
  PROFILE_ROOM_WALK_BOUNDS,
  type ProfileActorFacing,
  type ProfileRoomDeskStation,
  type ProfileRoomPoint,
  type ProfileRoomStationId
} from "./profileRoomLayout";

export type { ProfileActorFacing, ProfileRoomStationId } from "./profileRoomLayout";

export type ProfileActorState =
  | "choosing"
  | "walking"
  | "waiting"
  | "thinking"
  | "drinking"
  | "working"
  | "watching-tv"
  | "manual-action"
  | "portal-entering"
  | "portal-away"
  | "portal-returning";

type Vec2 = ProfileRoomPoint;

export interface ProfileActorRuntime {
  id: ProfileActorId;
  state: ProfileActorState;
  visible: boolean;
  position: Vec2;
  facing: ProfileActorFacing;
  route: string[];
  routeIndex: number;
  station: ProfileRoomStationId | null;
  stateElapsed: number;
  nextDecisionAt: number;
  frame: string;
  seedState: number;
  activityDuration: number;
  walkDistance: number;
  lastProgressPosition: Vec2;
  blockedElapsed: number;
  blockedBy: ProfileActorId | null;
  replanCount: number;
  recentStations: Array<{ station: ProfileRoomStationId; leftAt: number }>;
  awayDuration: number;
  manualAction: string | null;
  visitedStations: ProfileRoomStationId[];
  speed: number;
  lastReplanAt: number;
}

export interface ProfileRoomSimulationState {
  layoutVersion: typeof PROFILE_ROOM_LAYOUT_VERSION;
  simulationElapsed: number;
  actors: Record<ProfileActorId, ProfileActorRuntime>;
  stationOccupancy: Record<ProfileRoomStationId, ProfileActorId[]>;
  doorFrame: "closed" | "open";
  doorUser: ProfileActorId | null;
  doorStrength: number;
  navigation: {
    deadlockRecoveries: number;
    reservedCells: Array<{ cell: string; actor: ProfileActorId }>;
  };
}

const STEP = 1 / 30;
export const PROFILE_ROOM_ACTOR_SPEED: Record<ProfileActorId, number> = {
  nobita: 0.068,
  doraemon: 0.06,
  shizuka: 0.062,
  gian: 0.053,
  suneo: 0.073
};

const PERSONAL_SPACE: Record<ProfileActorId, Vec2> = {
  nobita: [0.041, 0.029],
  doraemon: [0.045, 0.032],
  shizuka: [0.039, 0.028],
  gian: [0.05, 0.034],
  suneo: [0.038, 0.028]
};
// Keep a readable pixel-character gap even when two actors are moving on
// different depth rows.  The ellipse below still protects the larger body
// silhouettes; this Euclidean floor prevents a late-run pair from visually
// merging at a diagonal corner.
const MIN_VISIBLE_SEPARATION = 0.068;
// The layout collision boxes already describe the actor-foot walkable
// boundary.  A small margin catches edge grazing without swallowing the
// interaction anchors that intentionally sit just outside water-cooler,
// TV-console, and door footprints.
const STATIC_COLLISION_PADDING_FACTOR = 0.2;
const MAX_COLLISION_SAMPLE_DISTANCE = 0.0025;

const STARTS: Record<ProfileActorId, Vec2> = {
  // Keep the initial tableau outside the desk render-safety zones.  Their
  // feet used to be legal while Doraemon's tall sprite still overlapped the
  // primary desk on the very first frame.
  nobita: [0.36, 0.9],
  doraemon: [0.55, 0.89],
  shizuka: [0.65, 0.79],
  gian: [0.08, 0.9],
  suneo: [0.9, 0.79]
};

const STATIC_TABLEAU: Record<ProfileActorId, Vec2> = {
  nobita: PROFILE_ROOM_STATION_POSITIONS.blackboard,
  doraemon: PROFILE_ROOM_STATION_POSITIONS["water-cooler"],
  shizuka: PROFILE_ROOM_STATION_POSITIONS["sofa-left"],
  gian: PROFILE_ROOM_STATION_POSITIONS["secondary-desk"],
  suneo: PROFILE_ROOM_STATION_POSITIONS["tv-console"]
};

export { PROFILE_ROOM_STATION_POSITIONS };

const PREFERENCES: Record<ProfileActorId, ProfileRoomStationId[]> = {
  nobita: ["blackboard", "sofa-left", "poster-left", "anywhere-door", "primary-desk", "water-cooler", "poster-right", "tv-console"],
  doraemon: ["water-cooler", "tv-console", "anywhere-door", "sofa-right", "primary-desk", "poster-right", "blackboard", "poster-left"],
  shizuka: ["sofa-left", "blackboard", "poster-left", "water-cooler", "sofa-right", "primary-desk", "poster-right", "tv-console"],
  gian: ["secondary-desk", "sofa-right", "tv-console", "primary-desk", "poster-right", "anywhere-door", "blackboard", "water-cooler"],
  suneo: ["tv-console", "poster-right", "blackboard", "secondary-desk", "anywhere-door", "poster-left", "sofa-left", "water-cooler"]
};

const INITIAL_TARGETS: Record<ProfileActorId, ProfileRoomStationId> = {
  nobita: "blackboard",
  doraemon: "water-cooler",
  shizuka: "sofa-left",
  gian: "secondary-desk",
  suneo: "tv-console"
};

const ACTOR_ORDER = new Map(PROFILE_ACTOR_IDS.map((id, index) => [id, index]));
const clonePosition = (position: Vec2): Vec2 => [position[0], position[1]];
const distance = (a: Vec2, b: Vec2): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
const isDeskStation = (station: ProfileRoomStationId | null): station is ProfileRoomDeskStation =>
  station === "primary-desk" || station === "secondary-desk";
const DESK_STATIONS: ProfileRoomDeskStation[] = ["primary-desk", "secondary-desk"];
const MAX_DESK_EGRESS_LATERAL_DRIFT = 0.014;
// Collision bounds only track character feet. On mobile, the narrower desk
// aisle lets a large opaque sprite reach a desk side after its feet leave that
// box, so navigation needs a conservative visible-body clearance as well.
const DESK_VISUAL_SIDE_CLEARANCE = 0.04;
const clamp = (value: number, minimum: number, maximum: number): number => Math.max(minimum, Math.min(maximum, value));
const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const emptyOccupancy = (): Record<ProfileRoomStationId, ProfileActorId[]> => ({
  blackboard: [],
  "water-cooler": [],
  "primary-desk": [],
  "secondary-desk": [],
  "sofa-left": [],
  "sofa-right": [],
  "tv-console": [],
  "poster-left": [],
  "poster-right": [],
  "anywhere-door": []
});

const activityForStation = (station: ProfileRoomStationId): ProfileActorState => {
  if (station === "blackboard" || station.startsWith("poster-")) return "thinking";
  if (station === "water-cooler") return "drinking";
  if (station.startsWith("sofa-") || station === "tv-console") return "watching-tv";
  if (station === "anywhere-door") return "portal-entering";
  return "working";
};

const zoneForStation = (station: ProfileRoomStationId): "wall" | "work" | "rest" | "portal" => {
  if (station === "anywhere-door") return "portal";
  if (station.startsWith("poster-") || station === "blackboard" || station === "water-cooler") return "wall";
  if (station.startsWith("sofa-") || station === "tv-console") return "rest";
  return "work";
};

const cellKey = (column: number, row: number): string => `${column}:${row}`;
const parseCell = (key: string): [number, number] | null => {
  if (!/^\d+:\d+$/.test(key)) return null;
  const [column, row] = key.split(":").map(Number);
  return [column, row];
};

const worldToCell = (position: Vec2): [number, number] => {
  const [left, top, right, bottom] = PROFILE_ROOM_WALK_BOUNDS;
  const column = Math.round((clamp(position[0], left, right) - left) / (right - left) * (PROFILE_ROOM_NAV_GRID.columns - 1));
  const row = Math.round((clamp(position[1], top, bottom) - top) / (bottom - top) * (PROFILE_ROOM_NAV_GRID.rows - 1));
  return [column, row];
};

const cellToWorld = (column: number, row: number): Vec2 => {
  const [left, top, right, bottom] = PROFILE_ROOM_WALK_BOUNDS;
  return [
    left + column / (PROFILE_ROOM_NAV_GRID.columns - 1) * (right - left),
    top + row / (PROFILE_ROOM_NAV_GRID.rows - 1) * (bottom - top)
  ];
};

export class ProfileRoomSimulation {
  readonly fixedStep = STEP;
  private elapsed = 0;
  private actors = {} as Record<ProfileActorId, ProfileActorRuntime>;
  private occupancy = emptyOccupancy();
  private doorUser: ProfileActorId | null = null;
  private manualDoorForced = false;
  private manualDoorOpenUntil = 0;
  private queuedDoorToggle = false;
  private reservations = new Map<string, ProfileActorId>();
  private deadlockRecoveries = 0;

  constructor(private reducedMotion: boolean, private seed = 0x51f15e) {
    this.reset();
  }

  setSeed(seed: number): void {
    this.seed = (Number.isFinite(seed) ? Math.floor(seed) : 0x51f15e) >>> 0;
    this.reset();
  }

  reset(): void {
    this.elapsed = 0;
    this.occupancy = emptyOccupancy();
    this.doorUser = null;
    this.manualDoorForced = false;
    this.manualDoorOpenUntil = 0;
    this.queuedDoorToggle = false;
    this.reservations.clear();
    this.deadlockRecoveries = 0;
    this.actors = {} as Record<ProfileActorId, ProfileActorRuntime>;
    PROFILE_ACTOR_IDS.forEach((id, index) => {
      const position = this.reducedMotion ? STATIC_TABLEAU[id] : STARTS[id];
      this.actors[id] = {
        id,
        state: this.reducedMotion ? "waiting" : "choosing",
        visible: true,
        position: clonePosition(position),
        facing: this.reducedMotion ? PROFILE_ROOM_STATION_FACING[INITIAL_TARGETS[id]] : "down",
        route: [],
        routeIndex: 0,
        station: null,
        stateElapsed: 0,
        nextDecisionAt: 0,
        frame: "base:idle",
        seedState: (this.seed ^ ((index + 1) * 0x9e3779b9)) >>> 0,
        activityDuration: 0,
        walkDistance: 0,
        lastProgressPosition: clonePosition(position),
        blockedElapsed: 0,
        blockedBy: null,
        replanCount: 0,
        recentStations: [],
        awayDuration: 6,
        manualAction: null,
        visitedStations: [],
        speed: PROFILE_ROOM_ACTOR_SPEED[id],
        lastReplanAt: Number.NEGATIVE_INFINITY
      };
    });
    if (!this.reducedMotion) {
      for (const id of PROFILE_ACTOR_IDS) this.assignStation(this.actors[id], INITIAL_TARGETS[id]);
    }
    this.rebuildReservations();
    this.refreshFrames();
  }

  step(dt = STEP): void {
    if (this.reducedMotion) return;
    const safeDt = Math.min(STEP, Math.max(0, dt));
    this.elapsed += safeDt;
    this.rebuildReservations();
    const order = [...PROFILE_ACTOR_IDS].sort((a, b) => {
      const blocked = this.actors[b].blockedElapsed - this.actors[a].blockedElapsed;
      return Math.abs(blocked) > 1e-6 ? blocked : (ACTOR_ORDER.get(a) || 0) - (ACTOR_ORDER.get(b) || 0);
    });
    for (const id of order) this.stepActor(this.actors[id], safeDt);
    if (!this.doorUser && this.queuedDoorToggle) {
      this.queuedDoorToggle = false;
      this.manualDoorOpenUntil = this.elapsed + 2.4;
    }
    this.rebuildReservations();
    this.refreshFrames();
  }

  setTime(seconds: number): void {
    const target = Math.max(0, seconds);
    this.reset();
    if (this.reducedMotion) return;
    const steps = Math.floor(target / STEP + 1e-7);
    for (let index = 0; index < steps; index += 1) this.step(STEP);
  }

  advanceTime(seconds: number): void {
    if (this.reducedMotion) return;
    const steps = Math.max(0, Math.floor(seconds / STEP + 1e-7));
    for (let index = 0; index < steps; index += 1) this.step(STEP);
  }

  triggerActor(id: ProfileActorId, action = "room-reaction"): void {
    const actor = this.actors[id];
    if (!actor || ["portal-entering", "portal-away", "portal-returning"].includes(actor.state)) return;
    this.releaseStation(actor);
    actor.route = [];
    actor.routeIndex = 0;
    actor.state = "manual-action";
    actor.stateElapsed = 0;
    actor.activityDuration = 2.4;
    actor.manualAction = action;
    actor.blockedElapsed = 0;
    actor.blockedBy = null;
    this.refreshFrame(actor);
  }

  cancelManualActions(): void {
    for (const actor of Object.values(this.actors)) {
      if (actor.state !== "manual-action") continue;
      actor.manualAction = null;
      actor.state = "choosing";
      actor.stateElapsed = 0;
      this.chooseDestination(actor);
    }
    if (!this.doorUser) {
      this.manualDoorForced = false;
      this.manualDoorOpenUntil = 0;
    }
  }

  sendActorTo(id: ProfileActorId, station: ProfileRoomStationId): boolean {
    const actor = this.actors[id];
    if (!actor || ["portal-entering", "portal-away", "portal-returning"].includes(actor.state)) return false;
    const previous = actor.station;
    this.releaseStation(actor);
    if (this.assignStation(actor, station)) return true;
    if (previous && this.assignStation(actor, previous)) return false;
    actor.state = "choosing";
    this.chooseDestination(actor);
    return false;
  }

  toggleDoor(): void {
    if (this.doorUser) {
      this.queuedDoorToggle = true;
      return;
    }
    const open = this.doorFrame === "open";
    this.manualDoorForced = false;
    this.manualDoorOpenUntil = open ? 0 : this.elapsed + 2.4;
  }

  setDoorOpen(open: boolean): void {
    if (this.doorUser) {
      if (open) this.queuedDoorToggle = true;
      return;
    }
    this.manualDoorForced = open;
    this.manualDoorOpenUntil = open ? Number.POSITIVE_INFINITY : 0;
  }

  get doorFrame(): "closed" | "open" {
    return this.doorUser || this.manualDoorForced || this.elapsed < this.manualDoorOpenUntil ? "open" : "closed";
  }

  getState(): ProfileRoomSimulationState {
    return {
      layoutVersion: PROFILE_ROOM_LAYOUT_VERSION,
      simulationElapsed: this.elapsed,
      actors: this.actors,
      stationOccupancy: this.occupancy,
      doorFrame: this.doorFrame,
      doorUser: this.doorUser,
      doorStrength: this.doorFrame === "open" ? 1 : 0,
      navigation: {
        deadlockRecoveries: this.deadlockRecoveries,
        reservedCells: [...this.reservations.entries()].map(([cell, actor]) => ({ cell, actor }))
      }
    };
  }

  private stepActor(actor: ProfileActorRuntime, dt: number): void {
    actor.stateElapsed += dt;
    if (actor.state === "walking") {
      this.walkActor(actor, dt);
      return;
    }
    if (actor.state === "choosing") {
      this.chooseDestination(actor);
      return;
    }
    if (actor.state === "waiting") {
      if (this.elapsed >= actor.nextDecisionAt) {
        actor.state = "choosing";
        actor.stateElapsed = 0;
        this.chooseDestination(actor);
      }
      return;
    }
    if (actor.state === "portal-entering") {
      if (actor.stateElapsed >= actor.activityDuration) {
        actor.state = "portal-away";
        actor.stateElapsed = 0;
        actor.visible = false;
        actor.awayDuration = this.sampleDuration(actor, 5, 8);
        actor.activityDuration = actor.awayDuration;
      }
      return;
    }
    if (actor.state === "portal-away") {
      if (actor.stateElapsed >= actor.activityDuration) {
        actor.state = "portal-returning";
        actor.stateElapsed = 0;
        actor.activityDuration = 1.4;
        actor.visible = true;
        actor.facing = "left";
      }
      return;
    }
    if (actor.state === "portal-returning") {
      if (actor.stateElapsed >= actor.activityDuration) {
        this.doorUser = null;
        this.releaseStation(actor);
        actor.state = "choosing";
        actor.stateElapsed = 0;
        this.chooseDestination(actor);
      }
      return;
    }
    if (actor.state === "manual-action") {
      if (actor.stateElapsed >= actor.activityDuration) {
        actor.manualAction = null;
        actor.state = "choosing";
        actor.stateElapsed = 0;
        this.chooseDestination(actor);
      }
      return;
    }
    if (actor.stateElapsed >= actor.activityDuration) {
      this.releaseStation(actor);
      actor.state = "choosing";
      actor.stateElapsed = 0;
      this.chooseDestination(actor);
    }
  }

  private walkActor(actor: ProfileActorRuntime, dt: number): void {
    const routeKey = actor.route[actor.routeIndex];
    if (!routeKey) {
      this.beginStationActivity(actor);
      return;
    }
    const target = this.routePoint(routeKey, actor);
    const dx = target[0] - actor.position[0];
    const dy = target[1] - actor.position[1];
    const remaining = Math.hypot(dx, dy);
    if (remaining <= 0.003) {
      actor.position = clonePosition(target);
      actor.routeIndex += 1;
      actor.blockedElapsed = 0;
      actor.blockedBy = null;
      if (actor.routeIndex >= actor.route.length) this.beginStationActivity(actor);
      return;
    }

    actor.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
    const slow = 0.55 + 0.45 * smoothstep(0, 0.05, remaining);
    const step = Math.min(remaining, actor.speed * slow * dt);
    const proposed: Vec2 = [actor.position[0] + dx / remaining * step, actor.position[1] + dy / remaining * step];
    const routeCell = parseCell(routeKey);
    const owner = routeCell ? this.reservations.get(routeKey) : undefined;
    const blockedByReservation = owner && owner !== actor.id ? owner : null;
    const blockedByActor = this.blockingActor(actor, proposed);
    const dynamicBlocker = blockedByReservation || blockedByActor;
    const movingAwayFromDynamicBlocker = dynamicBlocker
      ? this.isMovingAwayFromActor(actor, proposed, dynamicBlocker)
      : false;
    // The last leg into a desk is the only intentional entry through the
    // desk's visual safety zone.  Every ordinary grid segment still observes
    // that zone, so characters cannot cut across a desk side-on.
    const deskTargetRoute = routeKey === `target@${actor.station}` && isDeskStation(actor.station);
    if ((dynamicBlocker && !movingAwayFromDynamicBlocker) || this.segmentHitsStaticObstacle(actor.position, proposed, actor.id, deskTargetRoute)) {
      this.registerBlocked(actor, dt, dynamicBlocker);
      return;
    }

    const moved = distance(actor.position, proposed);
    actor.position = proposed;
    actor.walkDistance += moved;
    actor.lastProgressPosition = clonePosition(proposed);
    actor.blockedElapsed = 0;
    actor.blockedBy = null;
  }

  private registerBlocked(actor: ProfileActorRuntime, dt: number, blocker: ProfileActorId | null): void {
    actor.blockedElapsed += dt;
    actor.blockedBy = blocker;
    // If two actors meet head-on, the lower deterministic priority yields
    // before the general timeout.  Waiting for both 1.8s timers made them
    // repeatedly select the same central cells and look like a frozen group.
    if (
      actor.blockedElapsed >= 0.8
      && blocker
      && (ACTOR_ORDER.get(actor.id) || 0) > (ACTOR_ORDER.get(blocker) || 0)
      && this.elapsed - actor.lastReplanAt >= 0.8
    ) {
      actor.replanCount += 1;
      actor.lastReplanAt = this.elapsed;
      this.deadlockRecoveries += 1;
      this.forceEscape(actor);
      actor.blockedElapsed = 0;
      actor.blockedBy = null;
      return;
    }
    if (actor.blockedElapsed >= 1.8) {
      actor.replanCount += 1;
      actor.lastReplanAt = this.elapsed;
      this.deadlockRecoveries += 1;
      // Do not immediately send a blocked actor back into the same choke
      // point.  Release the reservation, walk one deterministic escape cell
      // into the least occupied part of the room, and only then choose a new
      // station.  This is a real movement step (not a teleport) and breaks
      // the long-running five-actor knot that used to form in the central
      // aisle.
      this.forceEscape(actor);
      actor.blockedElapsed = 0;
      actor.blockedBy = null;
      return;
    }
    if (actor.blockedElapsed >= 0.8 && this.elapsed - actor.lastReplanAt >= 0.8) {
      actor.lastReplanAt = this.elapsed;
      actor.replanCount += 1;
      if (!this.replan(actor, true)) this.escape(actor);
    }
  }

  private beginStationActivity(actor: ProfileActorRuntime): void {
    if (!actor.station) {
      actor.state = "choosing";
      this.chooseDestination(actor);
      return;
    }
    actor.position = clonePosition(PROFILE_ROOM_STATION_POSITIONS[actor.station]);
    actor.state = activityForStation(actor.station);
    actor.stateElapsed = 0;
    actor.blockedElapsed = 0;
    actor.blockedBy = null;
    actor.activityDuration = this.durationForStation(actor, actor.station);
    if (!actor.visitedStations.includes(actor.station)) actor.visitedStations.push(actor.station);
    if (actor.state === "portal-entering") {
      if (this.doorUser && this.doorUser !== actor.id) {
        this.releaseStation(actor, false);
        this.beginWaiting(actor);
      } else {
        this.doorUser = actor.id;
        actor.facing = "right";
      }
    } else {
      actor.facing = PROFILE_ROOM_STATION_FACING[actor.station];
    }
  }

  private chooseDestination(actor: ProfileActorRuntime, excluded?: ProfileRoomStationId, forceOtherZone = false): void {
    actor.recentStations = actor.recentStations.filter((entry) => this.elapsed - entry.leftAt <= 90);
    const currentZone = excluded ? zoneForStation(excluded) : null;
    const candidates = PREFERENCES[actor.id]
      .map((station, index) => {
        if (station === excluded || !this.canReserve(station, actor.id)) return null;
        const last = [...actor.recentStations].reverse().find((entry) => entry.station === station);
        const recentPenalty = last && this.elapsed - last.leftAt < 25 ? 0.1 : 1;
        const occupiedInZone = Object.entries(this.occupancy)
          .filter(([id]) => zoneForStation(id as ProfileRoomStationId) === zoneForStation(station))
          .reduce((sum, [, ids]) => sum + ids.length, 0);
        const zonePenalty = occupiedInZone >= 2 ? 0.24 : occupiedInZone === 1 ? 0.62 : 1;
        const differentZoneBoost = forceOtherZone && currentZone && zoneForStation(station) !== currentZone ? 2.4 : 1;
        return { station, weight: Math.max(0.02, (PREFERENCES[actor.id].length - index) * recentPenalty * zonePenalty * differentZoneBoost) };
      })
      .filter((value): value is { station: ProfileRoomStationId; weight: number } => Boolean(value));

    if (!candidates.length) {
      this.beginWaiting(actor);
      return;
    }
    const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    let sample = this.random(actor) * total;
    for (const candidate of candidates) {
      sample -= candidate.weight;
      if (sample <= 0 && this.assignStation(actor, candidate.station)) return;
    }
    for (const candidate of candidates) if (this.assignStation(actor, candidate.station)) return;
    this.beginWaiting(actor);
  }

  private beginWaiting(actor: ProfileActorRuntime): void {
    actor.state = "waiting";
    actor.stateElapsed = 0;
    actor.activityDuration = this.sampleDuration(actor, 0.8, 1.4);
    actor.nextDecisionAt = this.elapsed + actor.activityDuration;
    actor.route = [];
    actor.routeIndex = 0;
  }

  private assignStation(actor: ProfileActorRuntime, station: ProfileRoomStationId): boolean {
    if (!this.canReserve(station, actor.id)) return false;
    // Clear the prior station before routing.  When an actor is leaving a
    // desk, retaining its old desk reservation made the pathfinder treat the
    // desk centre lane as an all-direction exemption and choose a side exit.
    const previousStation = actor.station;
    this.releaseStation(actor, false);
    const route = this.findPath(actor, station, true);
    if (!route.length && distance(actor.position, this.navigationGoalForStation(station)) > 0.004) {
      if (previousStation) {
        this.occupancy[previousStation].push(actor.id);
        actor.station = previousStation;
      }
      return false;
    }
    this.occupancy[station].push(actor.id);
    actor.station = station;
    actor.route = [...route, `target@${station}`];
    actor.routeIndex = 0;
    actor.state = "walking";
    actor.stateElapsed = 0;
    actor.activityDuration = 0;
    actor.blockedElapsed = 0;
    actor.blockedBy = null;
    return true;
  }

  private releaseStation(actor: ProfileActorRuntime, remember = true): void {
    if (!actor.station) return;
    const station = actor.station;
    this.occupancy[station] = this.occupancy[station].filter((id) => id !== actor.id);
    if (remember && actor.state !== "walking") {
      actor.recentStations.push({ station, leftAt: this.elapsed });
      if (actor.recentStations.length > 12) actor.recentStations.shift();
    }
    actor.station = null;
  }

  private canReserve(station: ProfileRoomStationId, actor?: ProfileActorId): boolean {
    const occupants = this.occupancy[station];
    return occupants.length === 0 || (actor !== undefined && occupants.length === 1 && occupants[0] === actor);
  }

  private replan(actor: ProfileActorRuntime, dynamic: boolean): boolean {
    if (!actor.station) return false;
    const route = this.findPath(actor, actor.station, dynamic);
    if (!route.length && distance(actor.position, this.navigationGoalForStation(actor.station)) > 0.004) return false;
    actor.route = [...route, `target@${actor.station}`];
    actor.routeIndex = 0;
    return true;
  }

  private findPath(actor: ProfileActorRuntime, station: ProfileRoomStationId, dynamic: boolean): string[] {
    const startCell = worldToCell(actor.position);
    const goalCell = worldToCell(this.navigationGoalForStation(station));
    const start = cellKey(startCell[0], startCell[1]);
    const goal = cellKey(goalCell[0], goalCell[1]);
    if (start === goal) return [];
    const frontier: Array<{ key: string; score: number }> = [{ key: start, score: 0 }];
    const cameFrom = new Map<string, string>();
    const cost = new Map<string, number>([[start, 0]]);
    const occupied = dynamic
      ? PROFILE_ACTOR_IDS.filter((id) => id !== actor.id && this.actors[id]?.visible).map((id) => worldToCell(this.actors[id].position))
      : [];

    while (frontier.length) {
      frontier.sort((a, b) => a.score - b.score || a.key.localeCompare(b.key));
      const current = frontier.shift()?.key as string;
      if (current === goal) break;
      const parsed = parseCell(current);
      if (!parsed) continue;
      const currentPoint = cellToWorld(parsed[0], parsed[1]);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const column = parsed[0] + dx;
          const row = parsed[1] + dy;
          if (column < 0 || row < 0 || column >= PROFILE_ROOM_NAV_GRID.columns || row >= PROFILE_ROOM_NAV_GRID.rows) continue;
          const next = cellKey(column, row);
          if (next !== goal && this.cellBlocked(column, row, actor.id, currentPoint)) continue;
          if (dx && dy && (
            this.cellBlocked(parsed[0] + dx, parsed[1], actor.id, currentPoint)
            || this.cellBlocked(parsed[0], parsed[1] + dy, actor.id, currentPoint)
          )) continue;
          let extra = dx && dy ? Math.SQRT2 : 1;
          if (dynamic) {
            for (const [otherColumn, otherRow] of occupied) {
              const cellDistance = Math.max(Math.abs(column - otherColumn), Math.abs(row - otherRow));
              if (cellDistance === 0) extra += 20;
              else if (cellDistance === 1) extra += 6;
              else if (cellDistance === 2) extra += 1.5;
            }
          }
          const nextCost = (cost.get(current) || 0) + extra;
          if (nextCost >= (cost.get(next) ?? Number.POSITIVE_INFINITY)) continue;
          cost.set(next, nextCost);
          cameFrom.set(next, current);
          const diagonal = Math.min(Math.abs(goalCell[0] - column), Math.abs(goalCell[1] - row));
          const straight = Math.abs(goalCell[0] - column) + Math.abs(goalCell[1] - row) - diagonal * 2;
          frontier.push({ key: next, score: nextCost + diagonal * Math.SQRT2 + straight });
        }
      }
    }
    if (!cameFrom.has(goal)) return [];
    const path: string[] = [];
    let cursor = goal;
    while (cursor !== start) {
      path.unshift(cursor);
      const previous = cameFrom.get(cursor);
      if (!previous) return [];
      cursor = previous;
    }
    // Keep every cell. Future-cell reservations are only useful when actors do not
    // skip the intermediate grid cells on a long straight segment.
    return path;
  }

  private routePoint(routeKey: string, actor: ProfileActorRuntime): Vec2 {
    if (routeKey.startsWith("target@") && actor.station) return PROFILE_ROOM_STATION_POSITIONS[actor.station];
    const cell = parseCell(routeKey);
    return cell ? cellToWorld(cell[0], cell[1]) : clonePosition(actor.position);
  }

  private cellBlocked(column: number, row: number, actorId: ProfileActorId, from?: Vec2): boolean {
    const position = cellToWorld(column, row);
    if (this.staticObstacleHit(position, actorId)) return true;
    return this.visualDeskIngressHit(position, actorId) && !(from && this.isExitingVisualDeskIngress(from, position, actorId));
  }

  private staticObstacleHit(position: Vec2, actorId: ProfileActorId): boolean {
    const radius = PERSONAL_SPACE[actorId];
    return PROFILE_ROOM_COLLISION_BOUNDS.some(({ bounds }) =>
      position[0] >= bounds[0] - radius[0] * STATIC_COLLISION_PADDING_FACTOR
      && position[0] <= bounds[2] + radius[0] * STATIC_COLLISION_PADDING_FACTOR
      && position[1] >= bounds[1] - radius[1] * STATIC_COLLISION_PADDING_FACTOR
      && position[1] <= bounds[3] + radius[1] * STATIC_COLLISION_PADDING_FACTOR
    );
  }

  private segmentHitsStaticObstacle(start: Vec2, end: Vec2, actorId: ProfileActorId, allowDeskIngress = false): boolean {
    const travel = distance(start, end);
    const samples = Math.max(1, Math.ceil(travel / MAX_COLLISION_SAMPLE_DISTANCE));
    for (let index = 1; index <= samples; index += 1) {
      const progress = index / samples;
      const point: Vec2 = [
        start[0] + (end[0] - start[0]) * progress,
        start[1] + (end[1] - start[1]) * progress
      ];
      const visualIngressBlocked = !allowDeskIngress
        && this.visualDeskIngressHit(point, actorId)
        && !this.isExitingVisualDeskIngress(start, point, actorId);
      if (this.staticObstacleHit(point, actorId) || visualIngressBlocked) return true;
    }
    return false;
  }

  private navigationGoalForStation(station: ProfileRoomStationId): Vec2 {
    return isDeskStation(station)
      ? clonePosition(PROFILE_ROOM_DESK_ACCESS[station].frontLane)
      : clonePosition(PROFILE_ROOM_STATION_POSITIONS[station]);
  }

  private visualDeskIngressHit(position: Vec2, actorId: ProfileActorId): boolean {
    return this.visualDeskIngressDepth(position, actorId) !== null;
  }

  private isExitingVisualDeskIngress(start: Vec2, end: Vec2, actorId: ProfileActorId): boolean {
    if (this.visualDeskIngressDepth(start, actorId) === null) return false;
    // World Y grows toward the viewer. A desk occupant must first come
    // straight down through the front lane; a sideways move still leaves a
    // tall sprite visibly inside the tabletop even if its foot point is
    // moving toward a collision-box edge.
    return end[1] > start[1] + 1e-6
      && Math.abs(end[0] - start[0]) <= MAX_DESK_EGRESS_LATERAL_DRIFT;
  }

  private visualDeskIngressDepth(position: Vec2, actorId: ProfileActorId): number | null {
    for (const station of DESK_STATIONS) {
      const access = PROFILE_ROOM_DESK_ACCESS[station];
      const bounds = PROFILE_ROOM_PROPS[access.propKey].collisionBounds;
      if (!bounds) continue;
      const insideDeskIngress = position[0] >= bounds[0] - DESK_VISUAL_SIDE_CLEARANCE
        && position[0] <= bounds[2] + DESK_VISUAL_SIDE_CLEARANCE
        && position[1] >= bounds[1]
        && position[1] <= access.ingressGuardBottom;
      if (!insideDeskIngress) continue;
      if (this.actorUsesDeskCentreLane(actorId, station, position)) continue;
      return Math.min(
        position[0] - (bounds[0] - DESK_VISUAL_SIDE_CLEARANCE),
        bounds[2] + DESK_VISUAL_SIDE_CLEARANCE - position[0],
        access.ingressGuardBottom - position[1]
      );
    }
    return null;
  }

  private actorUsesDeskCentreLane(actorId: ProfileActorId, station: ProfileRoomDeskStation, position: Vec2): boolean {
    const actor = this.actors[actorId];
    if (!actor || actor.station !== station) return false;
    const access = PROFILE_ROOM_DESK_ACCESS[station];
    return Math.abs(position[0] - access.frontLane[0]) <= access.alignmentHalfWidth;
  }

  private blockingActor(actor: ProfileActorRuntime, position: Vec2): ProfileActorId | null {
    for (const id of PROFILE_ACTOR_IDS) {
      if (id === actor.id) continue;
      const other = this.actors[id];
      if (!other.visible) continue;
      const rx = PERSONAL_SPACE[actor.id][0] + PERSONAL_SPACE[id][0];
      const ry = PERSONAL_SPACE[actor.id][1] + PERSONAL_SPACE[id][1];
      const dx = (position[0] - other.position[0]) / rx;
      const dy = (position[1] - other.position[1]) / ry;
      if (dx * dx + dy * dy < 1 || distance(position, other.position) < MIN_VISIBLE_SEPARATION) return id;
    }
    return null;
  }

  private isMovingAwayFromActor(actor: ProfileActorRuntime, position: Vec2, otherId: ProfileActorId): boolean {
    const other = this.actors[otherId];
    if (!other?.visible) return false;
    return distance(position, other.position) > distance(actor.position, other.position) + 1e-5;
  }

  private rebuildReservations(): void {
    this.reservations.clear();
    for (const id of PROFILE_ACTOR_IDS) {
      const actor = this.actors[id];
      if (!actor?.visible) continue;
      const [column, row] = worldToCell(actor.position);
      this.reservations.set(cellKey(column, row), id);
    }
    const order = PROFILE_ACTOR_IDS.filter((id) => this.actors[id].state === "walking")
      .sort((a, b) => this.actors[b].blockedElapsed - this.actors[a].blockedElapsed || (ACTOR_ORDER.get(a) || 0) - (ACTOR_ORDER.get(b) || 0));
    for (const id of order) {
      const actor = this.actors[id];
      for (let offset = 0; offset < 3; offset += 1) {
        const key = actor.route[actor.routeIndex + offset];
        if (!parseCell(key || "") || this.reservations.has(key)) continue;
        this.reservations.set(key, id);
      }
    }
  }

  private escape(actor: ProfileActorRuntime): void {
    const key = this.findEscapeCell(actor);
    if (key) {
      actor.route = [key, ...actor.route.slice(actor.routeIndex)];
      actor.routeIndex = 0;
      this.deadlockRecoveries += 1;
    }
  }

  private forceEscape(actor: ProfileActorRuntime): void {
    const previousStation = actor.station;
    const escapeCell = this.findEscapeCell(actor);
    this.releaseStation(actor, false);
    actor.route = escapeCell ? [escapeCell] : [];
    actor.routeIndex = 0;
    actor.state = escapeCell ? "walking" : "choosing";
    actor.stateElapsed = 0;
    actor.activityDuration = 0;
    if (!escapeCell) this.chooseDestination(actor, previousStation || undefined, true);
  }

  private findEscapeCell(actor: ProfileActorRuntime): string | null {
    const current = worldToCell(actor.position);
    const blocker = actor.blockedBy ? this.actors[actor.blockedBy] : null;
    const options: Array<{ key: string; score: number }> = [];
    const visibleOthers = PROFILE_ACTOR_IDS
      .filter((id) => id !== actor.id && this.actors[id]?.visible)
      .map((id) => this.actors[id]);
    // Search a small deterministic ring rather than only the eight adjacent
    // cells.  Adjacent cells are often all reserved when a group is stalled;
    // a two/three-cell sidestep gives the actor a genuine way out.
    for (let radius = 1; radius <= 3; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const column = current[0] + dx;
          const row = current[1] + dy;
          if (column < 0 || row < 0 || column >= PROFILE_ROOM_NAV_GRID.columns || row >= PROFILE_ROOM_NAV_GRID.rows) continue;
          const key = cellKey(column, row);
          const point = cellToWorld(column, row);
          if (
            this.cellBlocked(column, row, actor.id, actor.position)
            || this.blockingActor(actor, point)
            || this.segmentHitsStaticObstacle(actor.position, point, actor.id)
          ) continue;
          const reservation = this.reservations.get(key);
          if (reservation && reservation !== actor.id) continue;
          const nearestOther = visibleOthers.reduce((minimum, other) => Math.min(minimum, distance(point, other.position)), 1);
          const blockerDistance = blocker ? distance(point, blocker.position) : 0;
          const edgePenalty = point[0] < PROFILE_ROOM_WALK_BOUNDS[0] + 0.025 || point[0] > PROFILE_ROOM_WALK_BOUNDS[2] - 0.025 ? 0.25 : 0;
          const score = nearestOther * 7 + blockerDistance * 2 + radius * 0.05 - edgePenalty;
          options.push({ key, score });
        }
      }
      if (options.length >= 4) break;
    }
    options.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
    return options[0]?.key || null;
  }

  private durationForStation(actor: ProfileActorRuntime, station: ProfileRoomStationId): number {
    if (station === "blackboard") return this.sampleDuration(actor, 8, 12);
    if (station.startsWith("poster-")) return this.sampleDuration(actor, 10, 14);
    if (station === "primary-desk" || station === "secondary-desk") return this.sampleDuration(actor, 7, 10);
    if (station.startsWith("sofa-")) return this.sampleDuration(actor, 10, 15);
    if (station === "tv-console") return this.sampleDuration(actor, 7, 10);
    if (station === "water-cooler") return this.sampleDuration(actor, 4, 6);
    if (station === "anywhere-door") return 1.4;
    return this.sampleDuration(actor, 0.8, 1.4);
  }

  private sampleDuration(actor: ProfileActorRuntime, minimum: number, maximum: number): number {
    return minimum + this.random(actor) * (maximum - minimum);
  }

  private random(actor: ProfileActorRuntime): number {
    let value = actor.seedState || 0x6d2b79f5;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    actor.seedState = value >>> 0;
    return actor.seedState / 0x100000000;
  }

  private refreshFrames(): void {
    for (const actor of Object.values(this.actors)) this.refreshFrame(actor);
  }

  private refreshFrame(actor: ProfileActorRuntime): void {
    if (actor.state === "walking") {
      const direction = actor.facing === "left" || actor.facing === "right" ? "side" : actor.facing;
      // Every direction uses A -> neutral B -> C.  Nobita's B cells are the
      // approved directional references; the other actors keep their existing
      // three-frame atlases and all actors share the established cadence.
      actor.frame = `movement:${direction}:${Math.floor(actor.walkDistance / 0.014) % 3}`;
      return;
    }
    if (actor.state === "thinking") actor.frame = `life:think-${Math.floor(actor.stateElapsed * 1.55) % 2 ? "b" : "a"}`;
    else if (actor.state === "drinking") actor.frame = `life:drink-${Math.floor(actor.stateElapsed * 1.8) % 2 ? "b" : "a"}`;
    else if (actor.state === "watching-tv") actor.frame = `life:sit-game-${Math.floor(actor.stateElapsed * 1.45) % 2 ? "b" : "a"}`;
    else if (actor.state === "portal-entering") actor.frame = "life:portal-enter";
    else if (actor.state === "portal-returning") actor.frame = "life:portal-return";
    else if (actor.state === "manual-action") actor.frame = actor.manualAction === "signature" ? "base:character-signature" : "life:room-reaction";
    else if (actor.state === "working") actor.frame = Math.floor(actor.stateElapsed * 1.35) % 2 ? "base:interaction-b" : "base:interaction-a";
    else actor.frame = "base:idle";
  }
}
