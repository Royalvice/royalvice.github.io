import * as pc from "playcanvas";
import type { QualityTier } from "../content/site";

export type VoyageWildlifeScenario =
  | "none"
  | "gulls"
  | "dolphins-underwater"
  | "dolphins-breach"
  | "whale-underwater"
  | "whale-breach"
  | "shark-patrol";

export type VoyageWildlifeMotion =
  | "hidden"
  | "flying"
  | "submerged"
  | "breaching"
  | "splashdown"
  | "patrolling";

export type VoyageWildlifeBreachPhase = "none" | "takeoff" | "apex" | "landing";

export interface VoyageWildlifeActorDebugState {
  id: string;
  visible: boolean;
  position: [number, number, number];
  heading: number;
  depth: number;
  height: number;
  motion: VoyageWildlifeMotion;
  breachPhase: VoyageWildlifeBreachPhase;
  finVisible: boolean;
  wakeStrength: number;
  modelReady: boolean;
  animationTime: number;
  animationDuration: number;
}

export interface VoyageWildlifeDebugState {
  seed: number;
  currentCycle: number;
  nextWhaleCycle: number;
  whaleIntervalCycles: 2 | 3;
  activeScenario: VoyageWildlifeScenario | "natural-day" | "natural-whale" | "natural-night";
  overrideScenario: VoyageWildlifeScenario | null;
  daylightVisibility: number;
  nightVisibility: number;
  reducedMotion: boolean;
  portrait: boolean;
  gulls: VoyageWildlifeActorDebugState[];
  dolphins: VoyageWildlifeActorDebugState[];
  whales: VoyageWildlifeActorDebugState[];
  sharks: VoyageWildlifeActorDebugState[];
}

export interface VoyageWildlifeUpdateOptions {
  sceneTime: number;
  introTime: number;
  environmentPhase: "morning" | "noon" | "sunset" | "night" | "dawn";
  transitionProgress: number;
  portrait: boolean;
}

type CreatureRig = {
  root: pc.Entity;
  debug: VoyageWildlifeActorDebugState;
  animation?: { evaluator: pc.AnimEvaluator; clip: pc.AnimClip; speed: number; offset: number };
};

type GullRig = CreatureRig & {
  leftWing: pc.Entity;
  rightWing: pc.Entity;
};

type MarineUniform = {
  body: Float32Array;
  state: Float32Array;
};

type WildlifeControllerOptions = {
  app: pc.Application;
  parent: pc.Entity;
  reducedMotion: boolean;
  qualityTier: QualityTier;
  worldLayers: number[];
  marineLayers: number[];
  onAssetsChanged: () => void;
  sampleWaterHeight: (x: number, z: number, time: number) => number;
};

const MAX_GULLS = 5;
const MAX_DOLPHINS = 3;
const MAX_WHALES = 1;
const MAX_SHARKS = 2;
export const VOYAGE_MARINE_UNIFORM_COUNT = MAX_DOLPHINS + MAX_WHALES + MAX_SHARKS;
export const VOYAGE_SPLASH_UNIFORM_COUNT = 4;
const CYCLE_DURATION = 60;
const RAD_TO_DEG = 180 / Math.PI;
const WILDLIFE_SEED = 0x4c574b45;
// Original authors and per-asset licenses: /assets/voyage/wildlife-credits.html.
// Centers are measured from the skinned pose at t = 0.1s, after world transforms update.
const WILDLIFE_MODELS = {
  gull: { file: "seagull", center: [.00609, .32484, .20352], extent: 2.92724, size: .64, yaw: 0, speed: 1.15 },
  dolphin: { file: "bottlenose-dolphin", center: [-.01008, .09199, -.50513], extent: 2.50187, size: 1.65, yaw: 0, speed: .85 },
  whale: { file: "blue-whale", center: [.39536, 10.88946, -91.32325], extent: 1470.24954, size: 5.8, yaw: 0, speed: .68 },
  shark: { file: "shark", center: [-.16350, -19.93091, .08036], extent: 8.13381, size: 2.55, yaw: 90, speed: .85 }
} as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const lerp = (start: number, end: number, amount: number): number => start + (end - start) * amount;
const smoothstep = (minimum: number, maximum: number, value: number): number => {
  const amount = clamp01((value - minimum) / Math.max(.0001, maximum - minimum));
  return amount * amount * (3 - 2 * amount);
};
const fadeWindow = (progress: number, edge = .08): number => smoothstep(0, edge, progress) * (1 - smoothstep(1 - edge, 1, progress));
const modulo = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;

function makeDebugActor(id: string): VoyageWildlifeActorDebugState {
  return {
    id,
    visible: false,
    position: [0, -20, 0],
    heading: 0,
    depth: 0,
    height: 0,
    motion: "hidden",
    breachPhase: "none",
    finVisible: false,
    wakeStrength: 0,
    modelReady: false,
    animationTime: 0,
    animationDuration: 0
  };
}

function makeMaterial(name: string, diffuse: pc.Color, emissive = new pc.Color(0, 0, 0), emissiveIntensity = 0): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.name = name;
  material.diffuse = diffuse;
  material.emissive = emissive;
  material.emissiveIntensity = emissiveIntensity;
  material.useMetalness = true;
  material.metalness = .025;
  material.gloss = .28;
  material.cull = pc.CULLFACE_NONE;
  material.update();
  return material;
}

function addPart(
  parent: pc.Entity,
  name: string,
  type: "box" | "sphere" | "cone" | "cylinder",
  material: pc.Material,
  layers: number[],
  scale: [number, number, number],
  position: [number, number, number],
  rotation?: [number, number, number]
): pc.Entity {
  const part = new pc.Entity(name);
  part.addComponent("render", {
    type,
    material,
    castShadows: false,
    receiveShadows: false,
    layers
  });
  part.setLocalScale(...scale);
  part.setLocalPosition(...position);
  if (rotation) part.setLocalEulerAngles(...rotation);
  parent.addChild(part);
  return part;
}

type MeshPoint = [number, number, number];

function createFlatMesh(device: pc.GraphicsDevice, name: string, points: MeshPoint[], faces: number[][]): pc.Mesh {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const face of faces) {
    const offset = positions.length / 3;
    for (const index of face) positions.push(...points[index]);
    for (let triangle = 1; triangle < face.length - 1; triangle++) {
      indices.push(offset, offset + triangle, offset + triangle + 1);
    }
  }
  const mesh = new pc.Mesh(device);
  mesh.name = name;
  mesh.setPositions(positions);
  mesh.setNormals(pc.calculateNormals(positions, indices));
  mesh.setIndices(indices);
  mesh.update();
  return mesh;
}

function createSpindleMesh(
  device: pc.GraphicsDevice,
  name: string,
  profile: Array<[number, number, number]>,
  segments = 8
): pc.Mesh {
  const points: MeshPoint[] = [];
  const faces: number[][] = [];
  for (const [z, radiusX, radiusY] of profile) {
    for (let segment = 0; segment < segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      points.push([Math.cos(angle) * radiusX, Math.sin(angle) * radiusY, z]);
    }
  }
  for (let ring = 0; ring < profile.length - 1; ring++) {
    const nextRing = ring + 1;
    for (let segment = 0; segment < segments; segment++) {
      const next = (segment + 1) % segments;
      faces.push([
        ring * segments + segment,
        ring * segments + next,
        nextRing * segments + next,
        nextRing * segments + segment
      ]);
    }
  }
  faces.push(Array.from({ length: segments }, (_, index) => segments - index - 1));
  const lastRing = (profile.length - 1) * segments;
  faces.push(Array.from({ length: segments }, (_, index) => lastRing + index));
  return createFlatMesh(device, name, points, faces);
}

function appendHorizontalTriPrism(
  points: MeshPoint[],
  faces: number[][],
  triangle: Array<[number, number]>,
  centerY: number,
  thickness: number
): void {
  const signedArea = triangle.reduce((area, point, index) => {
    const next = triangle[(index + 1) % triangle.length];
    return area + point[0] * next[1] - next[0] * point[1];
  }, 0);
  const ordered = signedArea > 0 ? [...triangle].reverse() : triangle;
  const offset = points.length;
  for (const [x, z] of ordered) points.push([x, centerY + thickness * .5, z]);
  for (const [x, z] of ordered) points.push([x, centerY - thickness * .5, z]);
  faces.push([offset, offset + 1, offset + 2]);
  faces.push([offset + 5, offset + 4, offset + 3]);
  for (let edge = 0; edge < 3; edge++) {
    const next = (edge + 1) % 3;
    faces.push([offset + edge, offset + 3 + edge, offset + 3 + next, offset + next]);
  }
}

function createHorizontalFinMesh(
  device: pc.GraphicsDevice,
  name: string,
  triangles: Array<Array<[number, number]>>,
  centerY: number,
  thickness: number
): pc.Mesh {
  const points: MeshPoint[] = [];
  const faces: number[][] = [];
  for (const triangle of triangles) appendHorizontalTriPrism(points, faces, triangle, centerY, thickness);
  return createFlatMesh(device, name, points, faces);
}

function createVerticalFinMesh(
  device: pc.GraphicsDevice,
  name: string,
  triangle: Array<[number, number]>,
  thickness: number,
  lean = 0
): pc.Mesh {
  const signedArea = triangle.reduce((area, point, index) => {
    const next = triangle[(index + 1) % triangle.length];
    return area + point[0] * next[1] - next[0] * point[1];
  }, 0);
  const ordered = signedArea < 0 ? [...triangle].reverse() : triangle;
  const points: MeshPoint[] = [];
  const faces: number[][] = [];
  for (const [y, z] of ordered) points.push([thickness * .5 + y * lean, y, z]);
  for (const [y, z] of ordered) points.push([-thickness * .5 + y * lean, y, z]);
  faces.push([0, 1, 2], [5, 4, 3]);
  for (let edge = 0; edge < 3; edge++) {
    const next = (edge + 1) % 3;
    faces.push([edge, 3 + edge, 3 + next, next]);
  }
  return createFlatMesh(device, name, points, faces);
}

function addMeshPart(
  parent: pc.Entity,
  name: string,
  mesh: pc.Mesh,
  material: pc.Material,
  layers: number[],
  position: [number, number, number] = [0, 0, 0]
): pc.Entity {
  const part = new pc.Entity(name);
  const meshInstance = new pc.MeshInstance(mesh, material);
  meshInstance.castShadow = false;
  meshInstance.receiveShadow = false;
  part.addComponent("render", {
    type: "asset",
    meshInstances: [meshInstance],
    castShadows: false,
    receiveShadows: false,
    layers
  });
  part.setLocalPosition(...position);
  parent.addChild(part);
  return part;
}

function setDebugPose(
  actor: VoyageWildlifeActorDebugState,
  visible: boolean,
  x: number,
  y: number,
  z: number,
  heading: number,
  motion: VoyageWildlifeMotion,
  breachPhase: VoyageWildlifeBreachPhase,
  wakeStrength: number,
  depth = 0,
  finVisible = false
): void {
  actor.visible = visible;
  actor.position[0] = x;
  actor.position[1] = y;
  actor.position[2] = z;
  actor.heading = heading;
  actor.depth = depth;
  actor.height = Math.max(0, y);
  actor.motion = visible ? motion : "hidden";
  actor.breachPhase = visible ? breachPhase : "none";
  actor.finVisible = visible && finVisible;
  actor.wakeStrength = visible ? wakeStrength : 0;
}

export class VoyageWildlifeController {
  readonly marineUniforms: MarineUniform[] = Array.from({ length: VOYAGE_MARINE_UNIFORM_COUNT }, () => ({
    body: new Float32Array(4),
    state: new Float32Array(4)
  }));
  readonly splashUniforms: Float32Array[] = Array.from({ length: VOYAGE_SPLASH_UNIFORM_COUNT }, () => new Float32Array(4));

  private readonly root = new pc.Entity("luminous-wake-wildlife");
  private readonly gulls: GullRig[] = [];
  private readonly dolphins: CreatureRig[] = [];
  private readonly whales: CreatureRig[] = [];
  private readonly sharks: CreatureRig[] = [];
  private readonly materials: pc.StandardMaterial[] = [];
  private readonly meshes: pc.Mesh[] = [];
  private qualityTier: QualityTier;
  private overrideScenario: VoyageWildlifeScenario | null = null;
  private overrideProgress = .5;
  private activeScenario: VoyageWildlifeDebugState["activeScenario"] = "none";
  private portrait = false;
  private currentCycle = 0;
  private nextWhaleCycle = 1;
  private whaleIntervalCycles: 2 | 3 = 2;
  private daylightVisibility = 0;
  private nightVisibility = 0;
  private marineCursor = 0;
  private splashCursor = 0;
  private destroyed = false;

  constructor(private readonly options: WildlifeControllerOptions) {
    this.qualityTier = options.qualityTier === "fallback" ? "low" : options.qualityTier;
    options.parent.addChild(this.root);
    this.createRigs();
    if (!options.reducedMotion) void this.loadRealisticVisuals();
    this.hideAll();
  }

  setQuality(tier: QualityTier): void {
    this.qualityTier = tier === "fallback" ? "low" : tier;
  }

  setScenario(scenario: VoyageWildlifeScenario, progress = .5): void {
    this.overrideScenario = scenario;
    this.overrideProgress = clamp01(progress);
  }

  clearScenario(): void {
    this.overrideScenario = null;
  }

  update(options: VoyageWildlifeUpdateOptions): void {
    this.updateSchedule(options);
    for (const rig of [...this.gulls, ...this.dolphins, ...this.whales, ...this.sharks]) {
      if (!rig.root.enabled || !rig.animation) continue;
      const { evaluator, clip, speed, offset } = rig.animation;
      // One clock owns positions and bones, including debug seeking and inactive-page pauses.
      clip.time = modulo(options.sceneTime * speed + offset, clip.track.duration);
      evaluator.update(0);
      rig.debug.animationTime = clip.time;
    }
  }

  get marineVisible(): boolean {
    return [...this.dolphins, ...this.whales, ...this.sharks].some(rig => rig.root.enabled);
  }

  private updateSchedule({ sceneTime, introTime, environmentPhase, transitionProgress, portrait }: VoyageWildlifeUpdateOptions): void {
    this.portrait = portrait;
    this.currentCycle = Math.max(0, Math.floor(sceneTime / CYCLE_DURATION));
    const localTime = modulo(sceneTime, CYCLE_DURATION);
    const schedule = this.whaleSchedule(this.currentCycle);
    this.nextWhaleCycle = schedule.next;
    this.whaleIntervalCycles = schedule.interval;
    this.clearUniforms();
    this.hideAll();

    const introVisibility = smoothstep(4.25, 5.2, introTime);
    const transitionVisibility = 1 - smoothstep(.08, .92, transitionProgress);
    const motionGate = this.options.reducedMotion ? 0 : introVisibility * transitionVisibility;
    this.daylightVisibility = motionGate * (environmentPhase === "morning" || environmentPhase === "noon" ? 1 : 0);
    this.nightVisibility = motionGate * smoothstep(39, 40.25, localTime) * (1 - smoothstep(49.25, 50.5, localTime));
    if (motionGate <= .0001) {
      this.activeScenario = this.overrideScenario ?? "none";
      return;
    }

    if (this.overrideScenario) {
      this.activeScenario = this.overrideScenario;
      this.updateOverride(sceneTime, motionGate);
      return;
    }

    const whaleActive = schedule.active && localTime >= 10.5 && localTime <= 28;
    if (whaleActive) {
      this.activeScenario = "natural-whale";
      this.updateGulls((localTime - 2) / 12, motionGate, sceneTime);
      this.updateDolphins((localTime - 12) / 14, motionGate * .72, sceneTime, false);
      this.updateWhale((localTime - 10.5) / 17.5, motionGate, sceneTime, true);
      return;
    }
    if (localTime >= 39 && localTime <= 50.5) {
      this.activeScenario = "natural-night";
      this.updateSharks((localTime - 39) / 11.5, this.nightVisibility, sceneTime);
      return;
    }
    this.activeScenario = "natural-day";
    this.updateGulls((localTime - 2) / 12, this.daylightVisibility, sceneTime);
    this.updateDolphins((localTime - 12) / 14, this.daylightVisibility, sceneTime, true);
  }

  getDebugState(): VoyageWildlifeDebugState {
    const copyActors = (rigs: CreatureRig[]): VoyageWildlifeActorDebugState[] => rigs.map(({ debug }) => ({
      ...debug,
      position: [...debug.position] as [number, number, number]
    }));
    return {
      seed: WILDLIFE_SEED,
      currentCycle: this.currentCycle,
      nextWhaleCycle: this.nextWhaleCycle,
      whaleIntervalCycles: this.whaleIntervalCycles,
      activeScenario: this.activeScenario,
      overrideScenario: this.overrideScenario,
      daylightVisibility: this.daylightVisibility,
      nightVisibility: this.nightVisibility,
      reducedMotion: this.options.reducedMotion,
      portrait: this.portrait,
      gulls: copyActors(this.gulls),
      dolphins: copyActors(this.dolphins),
      whales: copyActors(this.whales),
      sharks: copyActors(this.sharks)
    };
  }

  destroy(): void {
    this.destroyed = true;
    for (const rig of [...this.gulls, ...this.dolphins, ...this.whales, ...this.sharks]) rig.animation?.evaluator.removeClips();
    this.root.destroy();
    this.materials.forEach((material) => material.destroy());
    this.meshes.forEach((mesh) => mesh.destroy());
  }

  private createRigs(): void {
    const device = this.options.app.graphicsDevice;
    const white = this.material("wildlife-gull-white", new pc.Color(.48, .55, .54), new pc.Color(.012, .018, .017), .12);
    const wing = this.material("wildlife-gull-wing", new pc.Color(.27, .34, .37), new pc.Color(.006, .012, .015), .10);
    const beak = this.material("wildlife-gull-beak", new pc.Color(.72, .38, .09), new pc.Color(.025, .008, .001), .10);
    const dolphin = this.material("wildlife-dolphin", new pc.Color(.045, .14, .20), new pc.Color(.007, .035, .052), .24);
    const dolphinFin = this.material("wildlife-dolphin-fin", new pc.Color(.035, .105, .16), new pc.Color(.005, .027, .044), .22);
    const whale = this.material("wildlife-blue-whale", new pc.Color(.025, .075, .14), new pc.Color(.006, .030, .055), .30);
    const whaleFin = this.material("wildlife-blue-whale-fin", new pc.Color(.025, .075, .135), new pc.Color(.005, .025, .048), .26);
    const whaleBlowhole = this.material("wildlife-blue-whale-blowhole", new pc.Color(.006, .014, .021), new pc.Color(.001, .004, .007), .05);
    const shark = this.material("wildlife-shark-fin", new pc.Color(.045, .115, .18), new pc.Color(.025, .115, .185), 1.16);

    const gullLeftWingMesh = this.trackMesh(createHorizontalFinMesh(device, "gull-left-wing-mesh", [
      [[0, .055], [-.27, -.015], [-.085, -.13]]
    ], 0, .018));
    const gullRightWingMesh = this.trackMesh(createHorizontalFinMesh(device, "gull-right-wing-mesh", [
      [[0, .055], [.27, -.015], [.085, -.13]]
    ], 0, .018));
    const dolphinBodyMesh = this.trackMesh(createSpindleMesh(device, "dolphin-faceted-body", [
      [-.56, .035, .025], [-.38, .11, .075], [-.08, .18, .105], [.22, .16, .10], [.46, .095, .07], [.62, .025, .02]
    ], 8));
    const dolphinFinMesh = this.trackMesh(createHorizontalFinMesh(device, "dolphin-connected-fins", [
      [[-.11, .08], [-.39, -.12], [-.12, -.25]],
      [[.11, .08], [.39, -.12], [.12, -.25]],
      [[-.035, -.50], [-.31, -.63], [-.08, -.76]],
      [[.035, -.50], [.31, -.63], [.08, -.76]]
    ], -.025, .026));
    const dolphinDorsalMesh = this.trackMesh(createVerticalFinMesh(device, "dolphin-dorsal-fin", [
      [.07, .10], [.25, -.12], [.055, -.28]
    ], .035));
    const whaleBodyMesh = this.trackMesh(createSpindleMesh(device, "blue-whale-faceted-body", [
      [-1.34, .07, .05], [-1.08, .23, .14], [-.62, .38, .23], [-.05, .48, .27], [.55, .51, .29], [.98, .46, .27], [1.24, .36, .21], [1.40, .22, .14], [1.48, .07, .05]
    ], 10));
    const whaleFinMesh = this.trackMesh(createHorizontalFinMesh(device, "blue-whale-connected-fins", [
      [[-.32, .12], [-.68, -.62], [-.40, -.78]],
      [[.32, .12], [.68, -.62], [.40, -.78]],
      [[-.055, -1.25], [-.58, -1.45], [-.13, -1.62]],
      [[.055, -1.25], [.58, -1.45], [.13, -1.62]]
    ], -.10, .045));
    const sharkFinMesh = this.trackMesh(createVerticalFinMesh(device, "shark-dorsal-fin", [
      [.015, .26], [.49, -.06], [.02, -.34]
    ], .085, .34));

    for (let index = 0; index < MAX_GULLS; index++) {
      const root = new pc.Entity(`voyage-gull-${index}`);
      addPart(root, "body", "sphere", white, this.options.worldLayers, [.11, .06, .20], [0, 0, 0]);
      const leftWing = addMeshPart(root, "left-wing", gullLeftWingMesh, wing, this.options.worldLayers, [-.045, .01, .015]);
      const rightWing = addMeshPart(root, "right-wing", gullRightWingMesh, wing, this.options.worldLayers, [.045, .01, .015]);
      addPart(root, "beak", "cone", beak, this.options.worldLayers, [.035, .075, .035], [0, -.005, .19], [90, 0, 0]);
      this.root.addChild(root);
      this.gulls.push({ root, leftWing, rightWing, debug: makeDebugActor(`gull-${index}`) });
    }

    for (let index = 0; index < MAX_DOLPHINS; index++) {
      const root = new pc.Entity(`voyage-dolphin-${index}`);
      addMeshPart(root, "body", dolphinBodyMesh, dolphin, this.options.marineLayers);
      addMeshPart(root, "connected-flippers-and-flukes", dolphinFinMesh, dolphinFin, this.options.marineLayers);
      addMeshPart(root, "dorsal-fin", dolphinDorsalMesh, dolphinFin, this.options.marineLayers);
      this.root.addChild(root);
      this.dolphins.push({ root, debug: makeDebugActor(`dolphin-${index}`) });
    }

    for (let index = 0; index < MAX_WHALES; index++) {
      const root = new pc.Entity(`voyage-blue-whale-${index}`);
      addMeshPart(root, "body", whaleBodyMesh, whale, this.options.marineLayers);
      addMeshPart(root, "connected-pectoral-fins-and-flukes", whaleFinMesh, whaleFin, this.options.marineLayers);
      addPart(root, "blowhole", "sphere", whaleBlowhole, this.options.marineLayers, [.065, .018, .042], [0, .30, .72]);
      this.root.addChild(root);
      this.whales.push({ root, debug: makeDebugActor(`blue-whale-${index}`) });
    }

    for (let index = 0; index < MAX_SHARKS; index++) {
      const root = new pc.Entity(`voyage-shark-fin-${index}`);
      addMeshPart(root, "dorsal-fin", sharkFinMesh, shark, this.options.marineLayers);
      this.root.addChild(root);
      this.sharks.push({ root, debug: makeDebugActor(`shark-${index}`) });
    }
  }

  private async loadRealisticVisuals(): Promise<void> {
    const species = [
      [WILDLIFE_MODELS.gull, this.gulls, false],
      [WILDLIFE_MODELS.dolphin, this.dolphins, true],
      [WILDLIFE_MODELS.shark, this.sharks, true],
      [WILDLIFE_MODELS.whale, this.whales, true]
    ] as const;
    for (const [model, rigs, marine] of species) {
      if (this.destroyed) return;
      // Load a species once, then instance its geometry and textures for the group.
      await new Promise<void>((resolve) => {
        this.options.app.assets.loadFromUrl(`/assets/voyage/models/wildlife/realistic/${model.file}.glb`, "container", (error, asset) => {
          if (this.destroyed) { resolve(); return; }
          if (error || !asset?.resource) {
            console.warn(`Voyage wildlife asset unavailable: ${model.file}`, error);
            resolve(); return;
          }
          const layers = marine ? this.options.marineLayers : this.options.worldLayers;
          const materialCopies = new Map<pc.Material, pc.StandardMaterial>();
          rigs.forEach((rig, index) => {
            const visual = asset.resource.instantiateRenderEntity({ castShadows: false, receiveShadows: false });
            const normalized = new pc.Entity(`${model.file}-normalized`);
            const centered = new pc.Entity(`${model.file}-centered`);
            centered.setLocalPosition(-model.center[0], -model.center[1], -model.center[2]);
            const scale = model.size / model.extent;
            normalized.setLocalScale(scale, scale, scale);
            normalized.setLocalEulerAngles(0, model.yaw, 0);
            normalized.addChild(centered);
            centered.addChild(visual);
            for (const component of visual.findComponents("render") as pc.RenderComponent[]) {
              component.layers = layers;
              for (const instance of component.meshInstances) {
                const source = instance.material as pc.StandardMaterial;
                let material = materialCopies.get(source);
                if (!material) {
                  material = source.clone();
                  material.useMetalness = true;
                  material.metalness = 0;
                  material.gloss = marine ? .42 : .20;
                  material.emissive.set(0, 0, 0);
                  material.emissiveIntensity = 0;
                  material.update();
                  materialCopies.set(source, material);
                  this.materials.push(material);
                }
                instance.material = material;
              }
            }
            const track = asset.resource.animations[0]?.resource as pc.AnimTrack | undefined;
            if (track) {
              const evaluator = new pc.AnimEvaluator(new pc.DefaultAnimBinder(visual));
              const clip = new pc.AnimClip(track, .1, 1, true, true);
              evaluator.addClip(clip);
              evaluator.update(0);
              rig.animation = { evaluator, clip, speed: model.speed, offset: index * .37 };
              rig.debug.animationDuration = track.duration;
            }
            for (const child of rig.root.children) child.enabled = false;
            rig.root.addChild(normalized);
            rig.debug.modelReady = true;
          });
          this.options.onAssetsChanged();
          resolve();
        });
      });
    }
  }

  private trackMesh(mesh: pc.Mesh): pc.Mesh {
    this.meshes.push(mesh);
    return mesh;
  }

  private material(name: string, diffuse: pc.Color, emissive: pc.Color, emissiveIntensity: number): pc.StandardMaterial {
    const material = makeMaterial(name, diffuse, emissive, emissiveIntensity);
    this.materials.push(material);
    return material;
  }

  private hideAll(): void {
    this.hideRigs(this.gulls);
    this.hideRigs(this.dolphins);
    this.hideRigs(this.whales);
    this.hideRigs(this.sharks);
  }

  private hideRigs(rigs: CreatureRig[]): void {
    for (const rig of rigs) {
      rig.root.enabled = false;
      setDebugPose(rig.debug, false, 0, -20, 0, 0, "hidden", "none", 0);
    }
  }

  private clearUniforms(): void {
    this.marineCursor = 0;
    this.splashCursor = 0;
    for (const uniform of this.marineUniforms) {
      uniform.body.fill(0);
      uniform.state.fill(0);
    }
    for (const uniform of this.splashUniforms) uniform.fill(0);
  }

  private capacity(): { gulls: number; dolphins: number; sharks: number } {
    if (this.portrait || this.qualityTier === "low") return { gulls: 2, dolphins: 2, sharks: 1 };
    if (this.qualityTier === "balanced") return { gulls: 3, dolphins: 3, sharks: 2 };
    return { gulls: 3, dolphins: 3, sharks: 2 };
  }

  private updateOverride(sceneTime: number, gate: number): void {
    const progress = this.overrideProgress;
    switch (this.overrideScenario) {
      case "none": return;
      case "gulls": this.updateGulls(progress, gate, sceneTime, true); return;
      case "dolphins-underwater": this.updateDolphins(progress, gate, sceneTime, false, true); return;
      case "dolphins-breach": this.updateDolphins(progress, gate, sceneTime, true, true); return;
      case "whale-underwater": this.updateWhale(progress, gate, sceneTime, false, true); return;
      case "whale-breach": this.updateWhale(progress, gate, sceneTime, true, true); return;
      case "shark-patrol": this.updateSharks(progress, gate, sceneTime, true); return;
    }
  }

  private updateGulls(progress: number, gate: number, sceneTime: number, forced = false): void {
    if ((!forced && (progress < 0 || progress > 1)) || gate <= .0001) return;
    const count = this.capacity().gulls;
    const baseProgress = clamp01(progress);
    const startX = this.portrait ? -3.7 : -10.2;
    const endX = this.portrait ? 3.7 : 5.2;
    const startZ = this.portrait ? -.8 : -.9;
    const endZ = this.portrait ? 2.2 : 4.1;
    const distance = Math.hypot(endX - startX, endZ - startZ) || 1;
    const directionX = (endX - startX) / distance;
    const directionZ = (endZ - startZ) / distance;
    const acrossX = -directionZ;
    const acrossZ = directionX;
    const heading = Math.atan2(endX - startX, endZ - startZ) * RAD_TO_DEG;
    for (let index = 0; index < this.gulls.length; index++) {
      const rig = this.gulls[index];
      if (index >= count) continue;
      const row = index === 0 ? 0 : Math.ceil(index / 2);
      const side = index === 0 ? 0 : index % 2 === 0 ? 1 : -1;
      const actorProgress = clamp01(baseProgress - row * .02);
      const visibility = fadeWindow(actorProgress, .085) * gate;
      if (visibility <= .001) continue;
      const formationScale = this.portrait ? .62 : 1;
      const trail = row * .42 * formationScale;
      const spread = side * row * .48 * formationScale;
      const x = lerp(startX, endX, actorProgress) - directionX * trail + acrossX * spread;
      const z = lerp(startZ, endZ, actorProgress) - directionZ * trail + acrossZ * spread
        + Math.sin(actorProgress * Math.PI * 2 + index) * .07;
      const y = (this.portrait ? 1.75 : 2.15) + row * .11 + Math.sin(sceneTime * .55 + index * 1.7) * .10;
      rig.root.enabled = true;
      rig.root.setPosition(x, y, z);
      const soaringPitch = Math.sin(sceneTime * 2.05 + index * 1.31) * 2.6;
      const bank = Math.sin(sceneTime * .7 + index) * 3 + Math.sin(sceneTime * 1.45 + index * .83) * 1.4;
      rig.root.setEulerAngles(soaringPitch, heading, bank);
      const flap = Math.sin(sceneTime * 7.2 + index * 1.35) * 30;
      rig.leftWing.setLocalEulerAngles(0, 0, -5 - flap);
      rig.rightWing.setLocalEulerAngles(0, 0, 5 + flap);
      setDebugPose(rig.debug, true, x, y, z, heading, "flying", "none", 0);
    }
  }

  private updateDolphins(progress: number, gate: number, sceneTime: number, allowBreach: boolean, forced = false): void {
    if ((!forced && (progress < 0 || progress > 1)) || gate <= .0001) return;
    const count = this.capacity().dolphins;
    const startX = this.portrait ? -3.25 : -8.8;
    const endX = this.portrait ? 3.4 : 5.7;
    const startZ = this.portrait ? 1.55 : 3.5;
    const endZ = this.portrait ? -1.9 : -2.3;
    const heading = Math.atan2(endX - startX, endZ - startZ) * RAD_TO_DEG;
    for (let index = 0; index < this.dolphins.length; index++) {
      const rig = this.dolphins[index];
      if (index >= count) continue;
      const actorProgress = clamp01(progress - index * .045);
      const visibility = fadeWindow(actorProgress, .07) * gate;
      if (visibility <= .001) continue;
      const lane = index - (count - 1) * .5;
      const x = lerp(startX, endX, actorProgress) + lane * .26;
      const z = lerp(startZ, endZ, actorProgress) + lane * .48;
      const water = this.options.sampleWaterHeight(x, z, sceneTime);
      const center = index === 0 ? .47 : .70;
      const breachProgress = allowBreach && index < 2 ? clamp01((actorProgress - (center - .11)) / .22) : 0;
      const inBreachWindow = allowBreach && index < 2 && actorProgress >= center - .11 && actorProgress <= center + .11;
      const breachHeight = inBreachWindow ? Math.sin(breachProgress * Math.PI) * (.82 + index * .12) : 0;
      const aboveWater = breachHeight > .035;
      const phase: VoyageWildlifeBreachPhase = !aboveWater
        ? "none"
        : breachProgress < .38 ? "takeoff" : breachProgress < .63 ? "apex" : "landing";
      rig.root.enabled = true;
      const depth = .34 + Math.sin(sceneTime * .6 + index) * .055;
      rig.root.setPosition(x, water + (aboveWater ? breachHeight + .08 : -depth), z);
      rig.root.setEulerAngles(aboveWater ? lerp(-27, 31, breachProgress) : Math.sin(sceneTime + index) * 2, heading,
        aboveWater ? Math.sin(breachProgress * Math.PI) * 8 * (index % 2 ? -1 : 1) : 0);
      const scale = this.portrait ? .80 : 1;
      rig.root.setLocalScale(scale, scale, scale);
      const underwaterVisibility = visibility * (1 - smoothstep(.02, .24, breachHeight));
      this.writeMarine(x, z, heading, 1, underwaterVisibility, .78, .56 + visibility * .24);
      if (inBreachWindow) this.writeSplash(x, z, breachProgress, .52, visibility);
      setDebugPose(
        rig.debug,
        true,
        x,
        aboveWater ? water + breachHeight : water - depth,
        z,
        heading,
        aboveWater ? (phase === "landing" ? "splashdown" : "breaching") : "submerged",
        phase,
        .56 + visibility * .24,
        aboveWater ? 0 : depth
      );
    }
  }

  private updateWhale(progress: number, gate: number, sceneTime: number, allowBreach: boolean, forced = false): void {
    if ((!forced && (progress < 0 || progress > 1)) || gate <= .0001) return;
    const actorProgress = clamp01(progress);
    const visibility = fadeWindow(actorProgress, .075) * gate;
    if (visibility <= .001) return;
    const rig = this.whales[0];
    const startX = this.portrait ? 3.6 : 5.8;
    const endX = this.portrait ? -3.6 : -9.4;
    const startZ = this.portrait ? 1.8 : 2.2;
    const endZ = this.portrait ? -.8 : -1.6;
    const x = lerp(startX, endX, actorProgress);
    const z = lerp(startZ, endZ, actorProgress) + Math.sin(actorProgress * Math.PI) * (this.portrait ? -.35 : -.7);
    const heading = Math.atan2(endX - startX, endZ - startZ) * RAD_TO_DEG;
    const water = this.options.sampleWaterHeight(x, z, sceneTime);
    const breachProgress = allowBreach ? clamp01((actorProgress - .31) / .38) : 0;
    const inBreachWindow = allowBreach && actorProgress >= .31 && actorProgress <= .69;
    const breachHeight = inBreachWindow ? Math.sin(breachProgress * Math.PI) * (this.portrait ? .38 : .45) : 0;
    const aboveWater = breachHeight > .04;
    const phase: VoyageWildlifeBreachPhase = !aboveWater
      ? "none"
      : breachProgress < .38 ? "takeoff" : breachProgress < .63 ? "apex" : "landing";
    rig.root.enabled = true;
    const depth = .68 + Math.sin(sceneTime * .35) * .08;
    rig.root.setPosition(x, water + (aboveWater ? breachHeight - .45 : -depth), z);
    rig.root.setEulerAngles(aboveWater ? lerp(-58, 12, breachProgress) : 0, heading, aboveWater ? Math.sin(breachProgress * Math.PI) * 5 : 0);
    const scale = this.portrait ? .53 : .78;
    rig.root.setLocalScale(scale, scale, scale);
    const underwaterVisibility = visibility * (1 - smoothstep(.02, .28, breachHeight));
    this.writeMarine(x, z, heading, 2, underwaterVisibility, this.portrait ? .96 : 1.08, .72 + visibility * .25);
    if (inBreachWindow) this.writeSplash(x, z, breachProgress, 1.22, visibility);
    setDebugPose(
      rig.debug,
      true,
      x,
      rig.root.getPosition().y,
      z,
      heading,
      aboveWater ? (phase === "landing" ? "splashdown" : "breaching") : "submerged",
      phase,
      .72 + visibility * .25,
      aboveWater ? 0 : depth
    );
  }

  private updateSharks(progress: number, gate: number, sceneTime: number, forced = false): void {
    if ((!forced && (progress < 0 || progress > 1)) || gate <= .0001) return;
    const count = this.capacity().sharks;
    const base = clamp01(progress);
    for (let index = 0; index < this.sharks.length; index++) {
      const rig = this.sharks[index];
      if (index >= count) continue;
      const angle = base * Math.PI * 2 + index * Math.PI + sceneTime * .035;
      const radiusX = this.portrait ? 2.1 - index * .18 : 4.7 - index * .55;
      const radiusZ = this.portrait ? 1.45 - index * .12 : 2.45 - index * .28;
      const centerX = this.portrait ? 0 : -1.65;
      const centerZ = this.portrait ? -.15 : -.10;
      const x = centerX + Math.cos(angle) * radiusX;
      const z = centerZ + Math.sin(angle) * radiusZ;
      const dx = -Math.sin(angle) * radiusX;
      const dz = Math.cos(angle) * radiusZ;
      const heading = Math.atan2(dx, dz) * RAD_TO_DEG;
      const water = this.options.sampleWaterHeight(x, z, sceneTime);
      const moonBand = Math.sin(angle * 2.25 + index * 1.9) * .5 + .5;
      const finVisibility = smoothstep(.78, .91, moonBand) * gate;
      rig.root.enabled = true;
      const depth = lerp(.66, .28, finVisibility);
      rig.root.setPosition(x, water - depth, z);
      rig.root.setEulerAngles(Math.sin(sceneTime * 1.4 + index) * 1.8, heading, index % 2 === 0 ? 6 : -6);
      const scale = (this.portrait ? .78 : 1) * (.94 + index * .08);
      rig.root.setLocalScale(scale, scale, scale);
      const underwaterScale = (this.portrait ? 1.28 : 1.14) + index * .10;
      const wakeStrength = .38 + finVisibility * .52;
      this.writeMarine(x, z, heading, 3, gate, underwaterScale, wakeStrength);
      setDebugPose(rig.debug, true, x, water - depth, z, heading, "patrolling", "none", wakeStrength, depth, finVisibility > .02);
    }
  }

  private writeMarine(x: number, z: number, headingDegrees: number, species: 1 | 2 | 3, visibility: number, scale: number, wake: number): void {
    if (this.marineCursor >= this.marineUniforms.length) return;
    const uniform = this.marineUniforms[this.marineCursor++];
    const radians = headingDegrees / RAD_TO_DEG;
    uniform.body[0] = x;
    uniform.body[1] = z;
    uniform.body[2] = Math.sin(radians);
    uniform.body[3] = Math.cos(radians);
    uniform.state[0] = species;
    uniform.state[1] = clamp01(visibility);
    uniform.state[2] = scale;
    uniform.state[3] = clamp01(wake);
  }

  private writeSplash(x: number, z: number, breachProgress: number, scale: number, visibility: number): void {
    if (this.splashCursor >= this.splashUniforms.length) return;
    const takeoff = (1 - smoothstep(0, .22, breachProgress)) * smoothstep(0, .04, breachProgress);
    const landingProgress = clamp01((breachProgress - .78) / .22);
    const landing = Math.sin(landingProgress * Math.PI) * smoothstep(.78, .82, breachProgress);
    const strength = Math.max(takeoff, landing) * visibility;
    if (strength <= .002) return;
    const uniform = this.splashUniforms[this.splashCursor++];
    uniform[0] = x;
    uniform[1] = z;
    uniform[2] = scale * (.22 + (takeoff > landing ? breachProgress : landingProgress) * .95);
    uniform[3] = strength;
  }

  private whaleSchedule(cycle: number): { active: boolean; next: number; interval: 2 | 3 } {
    let scheduled = 1;
    let guard = 0;
    while (scheduled < cycle && guard++ < 10_000) scheduled += this.intervalAfter(scheduled);
    const active = scheduled === cycle;
    const interval = this.intervalAfter(scheduled);
    return { active, next: active ? scheduled + interval : scheduled, interval };
  }

  private intervalAfter(cycle: number): 2 | 3 {
    let value = (cycle ^ WILDLIFE_SEED) >>> 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) % 2 === 0 ? 2 : 3;
  }
}
