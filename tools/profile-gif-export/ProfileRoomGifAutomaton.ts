import { PROFILE_ACTOR_IDS, type ProfileActorId } from "../../src/profile/profileAdventureAssets";
import type {
  ProfileActorRuntime,
  ProfileActorState,
  ProfileRoomSimulationState
} from "../../src/profile/ProfileRoomSimulation";
import {
  PROFILE_ROOM_COLLISION_BOUNDS,
  PROFILE_ROOM_LAYOUT_VERSION,
  PROFILE_ROOM_NAV_GRID,
  PROFILE_ROOM_STATION_FACING,
  PROFILE_ROOM_STATION_POSITIONS,
  PROFILE_ROOM_WALK_BOUNDS,
  type ProfileActorFacing,
  type ProfileRoomPoint,
  type ProfileRoomStationId
} from "../../src/profile/profileRoomLayout";

type Point = ProfileRoomPoint;

type Move = {
  actor: ProfileActorId;
  from: ProfileRoomStationId;
  to: ProfileRoomStationId;
  start: number;
  end: number;
  path: Point[];
};

type ActorSample = {
  position: Point;
  station: ProfileRoomStationId;
  state: ProfileActorState;
  stateElapsed: number;
  facing: ProfileActorFacing;
  frame: string;
  moving: boolean;
};

export type ProfileRoomGifValidation = {
  frameCount: number;
  minimumSeparation: number;
  minimumObservedSeparation: number;
  actors: Record<ProfileActorId, {
    movementFrames: number;
    walkCycles: number;
    activities: string[];
    stations: ProfileRoomStationId[];
  }>;
  portalActors: ProfileActorId[];
  startTableau: Record<ProfileActorId, ProfileRoomStationId>;
  endTableau: Record<ProfileActorId, ProfileRoomStationId>;
};

const TOTAL_FRAMES = 1_440;
const FPS = 24;
const MIN_SEPARATION = 0.064;
const COLLISION_PADDING = 0.009;

const START_TABLEAU: Record<ProfileActorId, ProfileRoomStationId> = {
  nobita: "blackboard",
  doraemon: "water-cooler",
  shizuka: "sofa-left",
  gian: "secondary-desk",
  suneo: "tv-console"
};

const ROUND_ONE: Record<ProfileActorId, ProfileRoomStationId> = {
  nobita: "primary-desk",
  doraemon: "sofa-right",
  shizuka: "poster-left",
  gian: "tv-console",
  suneo: "poster-right"
};

const ROUND_TWO: Record<ProfileActorId, ProfileRoomStationId> = {
  nobita: "sofa-left",
  doraemon: "anywhere-door",
  shizuka: "water-cooler",
  gian: "blackboard",
  suneo: "secondary-desk"
};

const ROUND_THREE: Record<ProfileActorId, ProfileRoomStationId> = {
  nobita: "poster-right",
  doraemon: "primary-desk",
  shizuka: "blackboard",
  gian: "sofa-right",
  suneo: "anywhere-door"
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

const clonePoint = (point: Point): Point => [point[0], point[1]];
const distance = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

const activityForStation = (station: ProfileRoomStationId): ProfileActorState => {
  if (station === "blackboard" || station.startsWith("poster-")) return "thinking";
  if (station === "water-cooler") return "drinking";
  if (station === "primary-desk" || station === "secondary-desk") return "working";
  if (station.startsWith("sofa-") || station === "tv-console") return "watching-tv";
  return "portal-entering";
};

const frameForActivity = (state: ProfileActorState, elapsed: number): string => {
  if (state === "thinking") return `life:think-${Math.floor(elapsed * 1.55) % 2 ? "b" : "a"}`;
  if (state === "drinking") return `life:drink-${Math.floor(elapsed * 1.8) % 2 ? "b" : "a"}`;
  if (state === "watching-tv") return `life:sit-game-${Math.floor(elapsed * 1.45) % 2 ? "b" : "a"}`;
  if (state === "portal-entering") return "life:portal-enter";
  if (state === "portal-returning") return "life:portal-return";
  if (state === "working") return Math.floor(elapsed * 1.35) % 2 ? "base:interaction-b" : "base:interaction-a";
  return "base:idle";
};

const worldToCell = (point: Point): [number, number] => {
  const [left, top, right, bottom] = PROFILE_ROOM_WALK_BOUNDS;
  return [
    Math.round((point[0] - left) / (right - left) * (PROFILE_ROOM_NAV_GRID.columns - 1)),
    Math.round((point[1] - top) / (bottom - top) * (PROFILE_ROOM_NAV_GRID.rows - 1))
  ];
};

const cellToWorld = (column: number, row: number): Point => {
  const [left, top, right, bottom] = PROFILE_ROOM_WALK_BOUNDS;
  return [
    left + column / (PROFILE_ROOM_NAV_GRID.columns - 1) * (right - left),
    top + row / (PROFILE_ROOM_NAV_GRID.rows - 1) * (bottom - top)
  ];
};

const cellKey = (column: number, row: number): string => `${column}:${row}`;

const pointInsideStaticCollision = (point: Point, destination: Point): boolean => {
  if (distance(point, destination) < 0.035) return false;
  return PROFILE_ROOM_COLLISION_BOUNDS.some(({ bounds }) =>
    point[0] >= bounds[0] - COLLISION_PADDING
      && point[0] <= bounds[2] + COLLISION_PADDING
      && point[1] >= bounds[1] - COLLISION_PADDING
      && point[1] <= bounds[3] + COLLISION_PADDING
  );
};

const pointTouchesStaticCollision = (point: Point): boolean => PROFILE_ROOM_COLLISION_BOUNDS.some(({ bounds }) =>
  point[0] >= bounds[0] - COLLISION_PADDING
    && point[0] <= bounds[2] + COLLISION_PADDING
    && point[1] >= bounds[1] - COLLISION_PADDING
    && point[1] <= bounds[3] + COLLISION_PADDING
);

const pathLength = (path: Point[]): number => path.slice(1).reduce((sum, point, index) => sum + distance(path[index], point), 0);

const positionAlongPath = (path: Point[], progress: number): Point => {
  if (path.length <= 1) return clonePoint(path[0]);
  const total = pathLength(path);
  let remaining = total * clamp01(progress);
  for (let index = 1; index < path.length; index += 1) {
    const length = distance(path[index - 1], path[index]);
    if (remaining <= length || index === path.length - 1) {
      const local = length > 0 ? remaining / length : 0;
      return [
        path[index - 1][0] + (path[index][0] - path[index - 1][0]) * local,
        path[index - 1][1] + (path[index][1] - path[index - 1][1]) * local
      ];
    }
    remaining -= length;
  }
  return clonePoint(path[path.length - 1]);
};

const compressPath = (path: Point[]): Point[] => {
  if (path.length < 3) return path;
  const result: Point[] = [path[0]];
  for (let index = 1; index < path.length - 1; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    const next = path[index + 1];
    const dx1 = Math.sign(current[0] - previous[0]);
    const dy1 = Math.sign(current[1] - previous[1]);
    const dx2 = Math.sign(next[0] - current[0]);
    const dy2 = Math.sign(next[1] - current[1]);
    if (dx1 !== dx2 || dy1 !== dy2) result.push(current);
  }
  result.push(path[path.length - 1]);
  return result;
};

function findPath(start: Point, destination: Point, occupied: Point[]): Point[] {
  const startCell = worldToCell(start);
  const targetCell = worldToCell(destination);
  const targetKey = cellKey(...targetCell);
  const startKey = cellKey(...startCell);
  const open = new Set<string>([startKey]);
  const cameFrom = new Map<string, string>();
  const g = new Map<string, number>([[startKey, 0]]);
  const f = new Map<string, number>([[startKey, Math.hypot(targetCell[0] - startCell[0], targetCell[1] - startCell[1])]]);
  const parse = (key: string): [number, number] => key.split(":").map(Number) as [number, number];
  // Orthogonal grid edges keep the whole interpolated segment outside padded
  // furniture bounds. A diagonal can have two legal endpoints while still
  // cutting across a desk corner between them.
  const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (open.size) {
    const currentKey = [...open].sort((a, b) => (f.get(a) || Infinity) - (f.get(b) || Infinity) || a.localeCompare(b))[0];
    if (currentKey === targetKey) {
      const cells: string[] = [currentKey];
      while (cameFrom.has(cells[0])) cells.unshift(cameFrom.get(cells[0]) as string);
      const route = cells.map((key) => cellToWorld(...parse(key)));
      route[0] = clonePoint(start);
      route[route.length - 1] = clonePoint(destination);
      return compressPath(route);
    }
    open.delete(currentKey);
    const [column, row] = parse(currentKey);
    for (const [dx, dy] of neighbours) {
      const nextColumn = column + dx;
      const nextRow = row + dy;
      if (nextColumn < 0 || nextRow < 0 || nextColumn >= PROFILE_ROOM_NAV_GRID.columns || nextRow >= PROFILE_ROOM_NAV_GRID.rows) continue;
      const next = cellToWorld(nextColumn, nextRow);
      const nextKey = cellKey(nextColumn, nextRow);
      if (nextKey !== targetKey && pointInsideStaticCollision(next, destination)) continue;
      if (nextKey !== targetKey && occupied.some((point) => distance(point, next) < MIN_SEPARATION * 1.22)) continue;
      const tentative = (g.get(currentKey) || 0) + 1;
      if (tentative >= (g.get(nextKey) ?? Infinity)) continue;
      cameFrom.set(nextKey, currentKey);
      g.set(nextKey, tentative);
      f.set(nextKey, tentative + Math.hypot(targetCell[0] - nextColumn, targetCell[1] - nextRow));
      open.add(nextKey);
    }
  }
  throw new Error(`No GIF automaton path from ${start.join(",")} to ${destination.join(",")}.`);
}

export class ProfileRoomGifAutomaton {
  readonly totalFrames = TOTAL_FRAMES;
  readonly fps = FPS;
  private readonly moves: Move[] = [];
  private readonly stationByActor = { ...START_TABLEAU };
  private validation: ProfileRoomGifValidation | null = null;

  constructor() {
    this.addRound(4, 16, ["shizuka", "suneo", "nobita", "doraemon", "gian"], ROUND_ONE);
    this.addRound(16, 28, ["doraemon", "shizuka", "gian", "suneo", "nobita"], ROUND_TWO);
    this.addRound(28, 40, ["doraemon", "gian", "shizuka", "suneo", "nobita"], ROUND_THREE);
    this.addRound(40, 55, ["shizuka", "nobita", "doraemon", "gian", "suneo"], START_TABLEAU);
  }

  private addRound(start: number, end: number, order: ProfileActorId[], targets: Record<ProfileActorId, ProfileRoomStationId>): void {
    const slot = (end - start) / order.length;
    order.forEach((actor, index) => {
      const from = this.stationByActor[actor];
      const to = targets[actor];
      const occupied = PROFILE_ACTOR_IDS.filter((id) => id !== actor)
        .map((id) => PROFILE_ROOM_STATION_POSITIONS[this.stationByActor[id]]);
      const moveStart = start + index * slot + slot * 0.08;
      const moveEnd = start + (index + 1) * slot - slot * 0.13;
      const path = findPath(PROFILE_ROOM_STATION_POSITIONS[from], PROFILE_ROOM_STATION_POSITIONS[to], occupied);
      this.moves.push({ actor, from, to, start: moveStart, end: moveEnd, path });
      this.stationByActor[actor] = to;
    });
  }

  sampleFrame(frame: number): ProfileRoomSimulationState {
    if (!Number.isInteger(frame) || frame < 0 || frame >= TOTAL_FRAMES) throw new Error(`Invalid room GIF frame ${frame}.`);
    const seconds = frame === TOTAL_FRAMES - 1 ? 0 : frame / FPS;
    const actors = {} as Record<ProfileActorId, ProfileActorRuntime>;
    const occupancy = emptyOccupancy();
    let doorUser: ProfileActorId | null = null;

    for (const [actorIndex, id] of PROFILE_ACTOR_IDS.entries()) {
      const sample = this.sampleActor(id, seconds);
      if (!sample.moving) occupancy[sample.station].push(id);
      if ((sample.state === "portal-entering" || sample.state === "portal-returning") && sample.station === "anywhere-door") doorUser = id;
      actors[id] = {
        id,
        state: sample.state,
        visible: true,
        position: clonePoint(sample.position),
        facing: sample.facing,
        route: [],
        routeIndex: 0,
        station: sample.moving ? null : sample.station,
        stateElapsed: sample.stateElapsed,
        nextDecisionAt: Number.POSITIVE_INFINITY,
        frame: sample.frame,
        seedState: (0x51f15e ^ ((actorIndex + 1) * 0x9e3779b9)) >>> 0,
        activityDuration: 4,
        walkDistance: sample.moving ? sample.stateElapsed * 0.066 : 0,
        lastProgressPosition: clonePoint(sample.position),
        blockedElapsed: 0,
        blockedBy: null,
        replanCount: 0,
        recentStations: [],
        awayDuration: 0,
        manualAction: null,
        visitedStations: this.visitedStations(id, seconds),
        speed: 0.066,
        lastReplanAt: 0
      };
    }

    return {
      layoutVersion: PROFILE_ROOM_LAYOUT_VERSION,
      simulationElapsed: seconds,
      actors,
      stationOccupancy: occupancy,
      doorFrame: doorUser ? "open" : "closed",
      doorUser,
      doorStrength: doorUser ? 0.92 : 0,
      navigation: { deadlockRecoveries: 0, reservedCells: [] }
    };
  }

  private sampleActor(actor: ProfileActorId, seconds: number): ActorSample {
    const actorMoves = this.moves.filter((move) => move.actor === actor);
    let station = START_TABLEAU[actor];
    let lastArrival = 0;
    for (const move of actorMoves) {
      if (seconds < move.start) break;
      if (seconds <= move.end) {
        const raw = (seconds - move.start) / (move.end - move.start);
        const progress = smooth(raw);
        const position = positionAlongPath(move.path, progress);
        const ahead = positionAlongPath(move.path, Math.min(1, progress + 0.01));
        const dx = ahead[0] - position[0];
        const dy = ahead[1] - position[1];
        const facing: ProfileActorFacing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
        const direction = facing === "left" || facing === "right" ? "side" : facing;
        return {
          position,
          station: move.to,
          state: "walking",
          stateElapsed: Math.max(0, seconds - move.start),
          facing,
          frame: `movement:${direction}:${Math.floor((seconds - move.start) * 8) % 3}`,
          moving: true
        };
      }
      station = move.to;
      lastArrival = move.end;
    }

    let state = activityForStation(station);
    const elapsed = Math.max(0, seconds - lastArrival);
    if (station === "anywhere-door") state = elapsed % 2.4 < 1.2 ? "portal-entering" : "portal-returning";
    return {
      position: clonePoint(PROFILE_ROOM_STATION_POSITIONS[station]),
      station,
      state,
      stateElapsed: elapsed,
      facing: station === "anywhere-door" && state === "portal-returning" ? "left" : PROFILE_ROOM_STATION_FACING[station],
      frame: frameForActivity(state, elapsed),
      moving: false
    };
  }

  private visitedStations(actor: ProfileActorId, seconds: number): ProfileRoomStationId[] {
    const visited: ProfileRoomStationId[] = [START_TABLEAU[actor]];
    for (const move of this.moves.filter((candidate) => candidate.actor === actor)) {
      if (move.end > seconds) break;
      if (!visited.includes(move.to)) visited.push(move.to);
    }
    return visited;
  }

  validate(): ProfileRoomGifValidation {
    if (this.validation) return this.validation;
    const actorStats = Object.fromEntries(PROFILE_ACTOR_IDS.map((id) => [id, {
      movementFrames: 0,
      walkCycles: 0,
      activities: new Set<string>(),
      stations: new Set<ProfileRoomStationId>()
    }])) as Record<ProfileActorId, {
      movementFrames: number;
      walkCycles: number;
      activities: Set<string>;
      stations: Set<ProfileRoomStationId>;
    }>;
    let minimumObservedSeparation = Number.POSITIVE_INFINITY;
    const [left, top, right, bottom] = PROFILE_ROOM_WALK_BOUNDS;

    for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
      const snapshot = this.sampleFrame(frame);
      for (const id of PROFILE_ACTOR_IDS) {
        const actor = snapshot.actors[id];
        if (!actor.visible) throw new Error(`${id} disappears at room GIF frame ${frame}.`);
        if (actor.position[0] < left || actor.position[0] > right || actor.position[1] < top || actor.position[1] > bottom) {
          throw new Error(`${id} leaves room bounds at frame ${frame}: ${actor.position.join(",")}.`);
        }
        if (pointTouchesStaticCollision(actor.position)) {
          throw new Error(`${id} intersects a furniture collision bound at frame ${frame}: ${actor.position.join(",")}.`);
        }
        if (actor.state === "walking") {
          actorStats[id].movementFrames += 1;
          actorStats[id].walkCycles = Math.max(actorStats[id].walkCycles, Number(actor.frame.split(":")[2]) + 1);
        } else {
          actorStats[id].activities.add(actor.state);
          if (actor.station) actorStats[id].stations.add(actor.station);
        }
      }
      for (let first = 0; first < PROFILE_ACTOR_IDS.length; first += 1) {
        for (let second = first + 1; second < PROFILE_ACTOR_IDS.length; second += 1) {
          const a = snapshot.actors[PROFILE_ACTOR_IDS[first]];
          const b = snapshot.actors[PROFILE_ACTOR_IDS[second]];
          const separation = distance(a.position, b.position);
          minimumObservedSeparation = Math.min(minimumObservedSeparation, separation);
          if (separation < MIN_SEPARATION) throw new Error(`${a.id} and ${b.id} collide at frame ${frame} (${separation.toFixed(4)}).`);
        }
      }
    }

    const first = this.sampleFrame(0);
    const last = this.sampleFrame(TOTAL_FRAMES - 1);
    for (const id of PROFILE_ACTOR_IDS) {
      if (JSON.stringify(first.actors[id]) !== JSON.stringify(last.actors[id])) throw new Error(`${id} does not close the room automaton loop.`);
      if (actorStats[id].movementFrames < 80) throw new Error(`${id} has insufficient visible movement.`);
      if (actorStats[id].walkCycles < 3) throw new Error(`${id} does not cover A/B/C walk frames.`);
      if (actorStats[id].activities.size < 2) throw new Error(`${id} has fewer than two station activities.`);
    }

    this.validation = {
      frameCount: TOTAL_FRAMES,
      minimumSeparation: MIN_SEPARATION,
      minimumObservedSeparation,
      actors: Object.fromEntries(PROFILE_ACTOR_IDS.map((id) => [id, {
        movementFrames: actorStats[id].movementFrames,
        walkCycles: actorStats[id].walkCycles,
        activities: [...actorStats[id].activities],
        stations: [...actorStats[id].stations]
      }])) as ProfileRoomGifValidation["actors"],
      portalActors: ["doraemon", "suneo"],
      startTableau: { ...START_TABLEAU },
      endTableau: { ...START_TABLEAU }
    };
    return this.validation;
  }
}
