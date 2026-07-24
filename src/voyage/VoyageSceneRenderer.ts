import * as pc from "playcanvas";
import type { QualityTier, VoyageNode, VoyageNodeId } from "../content/site";
import type { TransitionAwareSceneRenderer } from "../scenes/SceneRenderer";

export type VoyageIntroPhase = "dissolve" | "route-survey" | "harbor-reveal" | "interactive";
export type VoyageDayPhase = "morning" | "noon" | "sunset" | "night" | "dawn";
export type VoyageLandmarkAssetState = "v3-lod" | "v2" | "v1-fallback" | "poster";
export type VoyageReflectionMode = "planar" | "analytic";
export type VoyageEvidencePlacement = "right-rail" | "bottom-drawer";

type FloatingBodyId = VoyageNodeId | "boat";
type LandmarkKind = VoyageNode["landmark"];
type VoyageBoatAssetState = "v3-lod" | "v2" | "procedural";

type VoyageContainerSource = {
  label: "v3-lod" | "v2";
  url: string;
  timeoutMs?: number;
};

export interface VoyageFloatingBodyDebugState {
  height: number;
  pitch: number;
  roll: number;
  contactStrength: number;
  reflectionStrength: number;
  modelWaterlineOffset: number;
  submergedFraction: number;
}

export interface VoyageDebugState {
  ready: boolean;
  assetsReady: boolean;
  fallbackActive: boolean;
  introPhase: VoyageIntroPhase;
  introElapsed: number;
  selectedNode: VoyageNodeId;
  currentStage: "eva01";
  evidenceOpen: boolean;
  internalResolution: [number, number];
  wakeStrength: number;
  reflectionStrength: number;
  boatHeading: number;
  transitionProgress: number;
  boatAsset: VoyageBoatAssetState;
  landmarkAssets: Record<string, VoyageLandmarkAssetState>;
  running: boolean;
  cameraPitch: number;
  cameraProjection: "perspective";
  waterMode: "xz-gerstner";
  reflectionMode: VoyageReflectionMode;
  reflectionUpdateInterval: number;
  shadowUpdateInterval: number;
  reflectionUpdates: number;
  shadowUpdates: number;
  floatingBodies: Record<FloatingBodyId, VoyageFloatingBodyDebugState>;
  projectedNodePositions: Record<VoyageNodeId, [number, number]>;
  evidenceIndex: number;
  evidenceCount: number;
  evidencePlacement: VoyageEvidencePlacement;
  environmentCycleElapsed: number;
  environmentPhase: VoyageDayPhase;
  sunStrength: number;
  moonStrength: number;
  sunDirection: [number, number, number];
  moonDirection: [number, number, number];
  shadowDirection: [number, number, number];
  sunReflectionStrength: number;
  moonReflectionStrength: number;
  lighthouseBeamStrength: number;
  lighthouseBeamDirection: [number, number];
  oasisGhostStrength: number;
  routeSpectrumStrength: number;
  waterMeanLevel: number;
  waterLuminance: number;
}

interface VoyageSceneOptions {
  nodes: VoyageNode[];
  reducedMotion: boolean;
  qualityTier: QualityTier;
  onSelectNode?: (node: VoyageNodeId) => void;
  onEvidenceOpenChange?: (open: boolean) => void;
}

interface WaveComponent {
  direction: readonly [number, number];
  wavelength: number;
  amplitude: number;
  speed: number;
  steepness: number;
}

interface WaveSample {
  height: number;
  normal: pc.Vec3;
  horizontalVelocity: pc.Vec2;
  crestStrength: number;
}

interface FloatingBodyProfile {
  foundationDraft: number;
  modelWaterlineOffset: number;
  maxSubmergedFraction: number;
  heaveResponse: number;
  pitchResponse: number;
  rollResponse: number;
  damping: number;
  responseLag: number;
  foamRadius: number;
  reflectionScale: number;
  buoyancyPoints: pc.Vec2[];
}

interface FloatingBodyState extends VoyageFloatingBodyDebugState {
  crestStrength: number;
  waterMeanLevel: number;
}

interface FloatingBody {
  id: FloatingBodyId;
  root: pc.Entity;
  visualRoot: pc.Entity;
  foundationRoot: pc.Entity | null;
  anchor: pc.Vec3;
  baseYaw: number;
  profile: FloatingBodyProfile;
  state: FloatingBodyState;
  labelHeight: number;
  modelHeight: number;
}

interface VoyageEnvironmentState {
  cycleElapsed: number;
  phase: VoyageDayPhase;
  sunDirection: pc.Vec3;
  sunColor: pc.Color;
  sunStrength: number;
  moonDirection: pc.Vec3;
  moonColor: pc.Color;
  moonStrength: number;
  ambientColor: pc.Color;
  ambientStrength: number;
  exposure: number;
  fogColor: pc.Color;
  waterDeep: pc.Color;
  waterMid: pc.Color;
  waterHighlight: pc.Color;
  sunReflectionStrength: number;
  moonReflectionStrength: number;
  lighthouseStrength: number;
  routeSpectrumStrength: number;
  waterLuminance: number;
  sunAzimuth: number;
  sunElevation: number;
  moonAzimuth: number;
  moonElevation: number;
}

interface EnvironmentKeyframe {
  time: number;
  phase: VoyageDayPhase;
  sunAzimuth: number;
  sunElevation: number;
  sunColor: readonly [number, number, number];
  sunStrength: number;
  moonAzimuth: number;
  moonElevation: number;
  moonColor: readonly [number, number, number];
  moonStrength: number;
  ambientColor: readonly [number, number, number];
  ambientStrength: number;
  exposure: number;
  fogColor: readonly [number, number, number];
  waterDeep: readonly [number, number, number];
  waterMid: readonly [number, number, number];
  waterHighlight: readonly [number, number, number];
  sunReflectionStrength: number;
  moonReflectionStrength: number;
  lighthouseStrength: number;
  routeSpectrumStrength: number;
  waterLuminance: number;
}

interface LandmarkConfig {
  v1Url: string;
  posterUrl: string;
  worldHeight: number;
  v2WorldHeight: number;
  yaw: number;
}

interface InstalledModel {
  body: FloatingBody;
  node: VoyageNode | null;
  materials: pc.StandardMaterial[];
  baseScale: number;
}

const INTRO_DURATION = 5.2;
const HARBOR_NODE: VoyageNodeId = "eva01";
const OPTIONAL_LOD_TIMEOUT_MS = 8_000;
const BOAT_MODEL_SOURCES: ReadonlyArray<VoyageContainerSource> = [
  {
    label: "v3-lod",
    url: "/assets/voyage/models/research-boat-v3-lod.glb?v=20260722-webgl-lod-v3",
    timeoutMs: OPTIONAL_LOD_TIMEOUT_MS
  },
  {
    label: "v2",
    url: "/assets/voyage/models/research-boat-v2.glb?v=20260714-simplified-quantized-v2"
  }
];
const STUDIO_HDR_URL = "/assets/gallery/materials/studio_small_08_1k.hdr";
const V3_MANIFEST_URL = "/assets/voyage/models/landmarks/v3/manifest.json?v=20260722-webgl-lod-v3";
const V2_MANIFEST_URL = "/assets/voyage/models/landmarks/v2/manifest.json?v=20260714-luminous-wake-v2";
const V1_VERSION = "20260713-trellis2-512-v1";
const STATIC_REDUCED_TIME = 6;
const ENVIRONMENT_CYCLE_DURATION = 60;
const WATER_HALF_WIDTH = 14;
const WATER_HALF_LENGTH = 10;
const RAD_TO_DEG = 180 / Math.PI;

const BODY_ORDER: FloatingBodyId[] = ["docdiff", "neural", "directl", "eva01", "world", "boat"];

const WAVE_COMPONENTS: readonly WaveComponent[] = [
  { direction: [1, .18], wavelength: 7.8, amplitude: .110, speed: .48, steepness: .22 },
  { direction: [.36, .93], wavelength: 4.2, amplitude: .052, speed: .72, steepness: .18 },
  { direction: [-.74, .67], wavelength: 2.1, amplitude: .024, speed: 1.05, steepness: .14 },
  { direction: [.58, -.82], wavelength: .7, amplitude: .008, speed: 1.6, steepness: .08 }
] as const;

const ENVIRONMENT_KEYFRAMES: readonly EnvironmentKeyframe[] = [
  {
    time: 0, phase: "morning", sunAzimuth: 118, sunElevation: 28,
    sunColor: [1.0, .78, .50], sunStrength: 1.62,
    moonAzimuth: 300, moonElevation: 8, moonColor: [.46, .63, .92], moonStrength: .04,
    ambientColor: [.34, .50, .58], ambientStrength: 1,
    exposure: 1.42, fogColor: [.32, .52, .59],
    waterDeep: [.012, .185, .300], waterMid: [.035, .395, .585], waterHighlight: [.78, .95, .96],
    sunReflectionStrength: 1.08, moonReflectionStrength: .03,
    lighthouseStrength: .38, routeSpectrumStrength: .78, waterLuminance: .34
  },
  {
    time: 12, phase: "noon", sunAzimuth: 166, sunElevation: 72,
    sunColor: [1.0, .95, .82], sunStrength: 1.90,
    moonAzimuth: 330, moonElevation: -8, moonColor: [.42, .58, .88], moonStrength: 0,
    ambientColor: [.42, .62, .70], ambientStrength: 1,
    exposure: 1.37, fogColor: [.48, .70, .76],
    waterDeep: [.016, .235, .380], waterMid: [.052, .490, .690], waterHighlight: [.91, 1.0, .99],
    sunReflectionStrength: .96, moonReflectionStrength: 0,
    lighthouseStrength: .11, routeSpectrumStrength: .65, waterLuminance: .43
  },
  {
    time: 22, phase: "noon", sunAzimuth: 196, sunElevation: 59,
    sunColor: [1.0, .92, .76], sunStrength: 1.75,
    moonAzimuth: 16, moonElevation: -4, moonColor: [.40, .57, .88], moonStrength: .02,
    ambientColor: [.37, .56, .64], ambientStrength: 1,
    exposure: 1.35, fogColor: [.41, .61, .67],
    waterDeep: [.014, .215, .350], waterMid: [.047, .445, .640], waterHighlight: [.87, .98, .96],
    sunReflectionStrength: 1.0, moonReflectionStrength: 0,
    lighthouseStrength: .14, routeSpectrumStrength: .69, waterLuminance: .39
  },
  {
    time: 27, phase: "sunset", sunAzimuth: 238, sunElevation: 17,
    sunColor: [1.0, .48, .20], sunStrength: 1.27,
    moonAzimuth: 58, moonElevation: 6, moonColor: [.38, .55, .88], moonStrength: .12,
    ambientColor: [.23, .34, .39], ambientStrength: 1,
    exposure: 1.29, fogColor: [.29, .33, .35],
    waterDeep: [.014, .135, .220], waterMid: [.035, .270, .360], waterHighlight: [1.0, .62, .34],
    sunReflectionStrength: 1, moonReflectionStrength: .06,
    lighthouseStrength: .75, routeSpectrumStrength: .86, waterLuminance: .24
  },
  {
    time: 34, phase: "sunset", sunAzimuth: 258, sunElevation: 7,
    sunColor: [1.0, .39, .14], sunStrength: 1.02,
    moonAzimuth: 66, moonElevation: 18, moonColor: [.40, .58, .92], moonStrength: .28,
    ambientColor: [.21, .255, .27], ambientStrength: 1,
    exposure: 1.31, fogColor: [.29, .22, .17],
    waterDeep: [.015, .083, .103], waterMid: [.038, .18, .194], waterHighlight: [1.0, .46, .18],
    sunReflectionStrength: 1.08, moonReflectionStrength: .15,
    lighthouseStrength: 1.05, routeSpectrumStrength: .92, waterLuminance: .17
  },
  {
    time: 40, phase: "night", sunAzimuth: 270, sunElevation: -10,
    sunColor: [.62, .24, .10], sunStrength: .03,
    moonAzimuth: 76, moonElevation: 43, moonColor: [.38, .58, .92], moonStrength: .84,
    ambientColor: [.052, .085, .145], ambientStrength: 1,
    exposure: 1.12, fogColor: [.030, .065, .110],
    waterDeep: [.005, .024, .056], waterMid: [.012, .074, .130], waterHighlight: [.40, .64, .86],
    sunReflectionStrength: .02, moonReflectionStrength: .88,
    lighthouseStrength: 1.35, routeSpectrumStrength: .94, waterLuminance: .075
  },
  {
    time: 45, phase: "night", sunAzimuth: 282, sunElevation: -16,
    sunColor: [.52, .20, .08], sunStrength: .01,
    moonAzimuth: 104, moonElevation: 54, moonColor: [.42, .63, .98], moonStrength: .92,
    ambientColor: [.046, .078, .142], ambientStrength: 1,
    exposure: 1.13, fogColor: [.026, .057, .106],
    waterDeep: [.004, .021, .052], waterMid: [.010, .066, .124], waterHighlight: [.43, .69, .94],
    sunReflectionStrength: 0, moonReflectionStrength: .96,
    lighthouseStrength: 1.45, routeSpectrumStrength: .96, waterLuminance: .07
  },
  {
    time: 50, phase: "dawn", sunAzimuth: 92, sunElevation: -3,
    sunColor: [1.0, .43, .25], sunStrength: .15,
    moonAzimuth: 278, moonElevation: 29, moonColor: [.42, .60, .92], moonStrength: .48,
    ambientColor: [.085, .125, .185], ambientStrength: 1,
    exposure: 1.18, fogColor: [.095, .125, .165],
    waterDeep: [.010, .058, .105], waterMid: [.020, .115, .180], waterHighlight: [.58, .59, .72],
    sunReflectionStrength: .18, moonReflectionStrength: .56,
    lighthouseStrength: .72, routeSpectrumStrength: .88, waterLuminance: .11
  },
  {
    time: 60, phase: "morning", sunAzimuth: 118, sunElevation: 28,
    sunColor: [1.0, .78, .50], sunStrength: 1.62,
    moonAzimuth: 300, moonElevation: 8, moonColor: [.46, .63, .92], moonStrength: .04,
    ambientColor: [.34, .50, .58], ambientStrength: 1,
    exposure: 1.42, fogColor: [.32, .52, .59],
    waterDeep: [.012, .185, .300], waterMid: [.035, .395, .585], waterHighlight: [.78, .95, .96],
    sunReflectionStrength: 1.08, moonReflectionStrength: .03,
    lighthouseStrength: .38, routeSpectrumStrength: .78, waterLuminance: .34
  }
] as const;

const DESKTOP_LAYOUT: Record<FloatingBodyId, readonly [number, number, number]> = {
  docdiff: [-8, 0, 4.2],
  neural: [-5, 0, 1.5],
  directl: [-2.3, 0, -1.2],
  eva01: [.8, 0, 1.15],
  world: [.15, 0, -3.7],
  boat: [-.1, 0, 2.1]
};

const PORTRAIT_LAYOUT: Record<FloatingBodyId, readonly [number, number, number]> = {
  docdiff: [-1.7, 0, 2.35],
  neural: [1.4, 0, 1.15],
  directl: [-1.4, 0, 0],
  eva01: [1.2, 0, -1.15],
  world: [-1.65, 0, -2.35],
  boat: [.15, 0, -.72]
};

const LANDMARK_CONFIG: Record<LandmarkKind, LandmarkConfig> = {
  dock: {
    v1Url: `/assets/voyage/models/landmarks/docdiff.glb?v=${V1_VERSION}`,
    posterUrl: "/assets/voyage/landmarks/posters/v2/dock-cutout.webp",
    worldHeight: .82,
    v2WorldHeight: .82,
    yaw: -8
  },
  reef: {
    v1Url: `/assets/voyage/models/landmarks/neural.glb?v=${V1_VERSION}`,
    posterUrl: "/assets/voyage/landmarks/posters/v2/prism-cutout.webp",
    worldHeight: .95,
    v2WorldHeight: .95,
    yaw: 10
  },
  lighthouse: {
    v1Url: `/assets/voyage/models/landmarks/directl.glb?v=${V1_VERSION}`,
    posterUrl: "/assets/voyage/landmarks/posters/v2/lighthouse-cutout.webp",
    worldHeight: 2.30,
    v2WorldHeight: 2.30,
    yaw: -7
  },
  harbor: {
    v1Url: `/assets/voyage/models/landmarks/eva01.glb?v=${V1_VERSION}`,
    posterUrl: "/assets/voyage/landmarks/posters/v2/harbor-cutout.webp",
    worldHeight: 1.36,
    v2WorldHeight: 1.36,
    yaw: 8
  },
  gate: {
    v1Url: `/assets/voyage/models/landmarks/world.glb?v=${V1_VERSION}`,
    posterUrl: "/assets/voyage/landmarks/posters/v2/gate-cutout.webp",
    worldHeight: 1.80,
    v2WorldHeight: 1.80,
    yaw: 2
  }
};

function buoyancyPoints(count: number, width: number, length: number): pc.Vec2[] {
  if (count <= 4) {
    return [
      new pc.Vec2(-width, -length), new pc.Vec2(width, -length),
      new pc.Vec2(-width, length), new pc.Vec2(width, length)
    ];
  }
  const points = [
    new pc.Vec2(-width, -length), new pc.Vec2(width, -length),
    new pc.Vec2(-width, length), new pc.Vec2(width, length)
  ];
  if (count >= 6) points.push(new pc.Vec2(0, -length * 1.05), new pc.Vec2(0, length * 1.05));
  if (count >= 8) points.push(new pc.Vec2(-width * 1.05, 0), new pc.Vec2(width * 1.05, 0));
  return points;
}

const BODY_PROFILES: Record<FloatingBodyId, FloatingBodyProfile> = {
  docdiff: { foundationDraft: .18, modelWaterlineOffset: .08, maxSubmergedFraction: .08, heaveResponse: .85, pitchResponse: .38, rollResponse: .55, damping: .45, responseLag: .06, foamRadius: 1.02, reflectionScale: .82, buoyancyPoints: buoyancyPoints(4, .72, .42) },
  neural: { foundationDraft: .28, modelWaterlineOffset: .10, maxSubmergedFraction: .08, heaveResponse: .22, pitchResponse: .08, rollResponse: .12, damping: .82, responseLag: .22, foamRadius: 1.18, reflectionScale: .68, buoyancyPoints: buoyancyPoints(6, .88, .62) },
  directl: { foundationDraft: .34, modelWaterlineOffset: .10, maxSubmergedFraction: .08, heaveResponse: .30, pitchResponse: .12, rollResponse: .16, damping: .78, responseLag: .18, foamRadius: .74, reflectionScale: .76, buoyancyPoints: buoyancyPoints(4, .5, .48) },
  eva01: { foundationDraft: .42, modelWaterlineOffset: .09, maxSubmergedFraction: .08, heaveResponse: .18, pitchResponse: .06, rollResponse: .08, damping: .88, responseLag: .32, foamRadius: 1.28, reflectionScale: .86, buoyancyPoints: buoyancyPoints(8, 1.05, .72) },
  world: { foundationDraft: .52, modelWaterlineOffset: .12, maxSubmergedFraction: .08, heaveResponse: .10, pitchResponse: .03, rollResponse: .04, damping: .92, responseLag: .45, foamRadius: .88, reflectionScale: .92, buoyancyPoints: buoyancyPoints(4, .62, .46) },
  boat: { foundationDraft: .10, modelWaterlineOffset: -.08, maxSubmergedFraction: .22, heaveResponse: 1, pitchResponse: .75, rollResponse: 1, damping: .32, responseLag: .04, foamRadius: .5, reflectionScale: .72, buoyancyPoints: buoyancyPoints(4, .44, .2) }
};

const BODY_ROTATION_LIMITS: Record<FloatingBodyId, readonly [pitch: number, roll: number]> = {
  docdiff: [2.5, 2.5],
  neural: [1.2, 1.2],
  directl: [1.2, 1.2],
  eva01: [1.2, 1.2],
  world: [.5, .5],
  boat: [4, 6]
};

const waveHeightTerms = WAVE_COMPONENTS.map((wave) => {
  const [dx, dz] = wave.direction;
  return `sin(dot(normalize(vec2(${dx.toFixed(5)}, ${dz.toFixed(5)})), p) * ${(Math.PI * 2 / wave.wavelength).toFixed(7)} + t * ${wave.speed.toFixed(5)}) * ${wave.amplitude.toFixed(6)}`;
}).join(" + ");

const waveSlopeTermsX = WAVE_COMPONENTS.map((wave) => {
  const [dx, dz] = wave.direction;
  const k = Math.PI * 2 / wave.wavelength;
  return `normalize(vec2(${dx.toFixed(5)}, ${dz.toFixed(5)})).x * ${(k * wave.amplitude).toFixed(7)} * cos(dot(normalize(vec2(${dx.toFixed(5)}, ${dz.toFixed(5)})), p) * ${k.toFixed(7)} + t * ${wave.speed.toFixed(5)})`;
}).join(" + ");

const waveSlopeTermsZ = WAVE_COMPONENTS.map((wave) => {
  const [dx, dz] = wave.direction;
  const k = Math.PI * 2 / wave.wavelength;
  return `normalize(vec2(${dx.toFixed(5)}, ${dz.toFixed(5)})).y * ${(k * wave.amplitude).toFixed(7)} * cos(dot(normalize(vec2(${dx.toFixed(5)}, ${dz.toFixed(5)})), p) * ${k.toFixed(7)} + t * ${wave.speed.toFixed(5)})`;
}).join(" + ");

const waveHorizontalTermsX = WAVE_COMPONENTS.map((wave) => {
  const [dx, dz] = wave.direction;
  const length = Math.hypot(dx, dz) || 1;
  return `${(dx / length * wave.steepness * wave.amplitude).toFixed(7)} * cos(dot(normalize(vec2(${dx.toFixed(5)}, ${dz.toFixed(5)})), p) * ${(Math.PI * 2 / wave.wavelength).toFixed(7)} + t * ${wave.speed.toFixed(5)})`;
}).join(" + ");

const waveHorizontalTermsZ = WAVE_COMPONENTS.map((wave) => {
  const [dx, dz] = wave.direction;
  const length = Math.hypot(dx, dz) || 1;
  return `${(dz / length * wave.steepness * wave.amplitude).toFixed(7)} * cos(dot(normalize(vec2(${dx.toFixed(5)}, ${dz.toFixed(5)})), p) * ${(Math.PI * 2 / wave.wavelength).toFixed(7)} + t * ${wave.speed.toFixed(5)})`;
}).join(" + ");

const sharedWaveGLSL = `
float sharedWaveHeight(vec2 p, float t) {
  return ${waveHeightTerms};
}
vec2 sharedWaveSlope(vec2 p, float t) {
  return vec2(${waveSlopeTermsX}, ${waveSlopeTermsZ});
}
vec2 sharedWaveHorizontal(vec2 p, float t) {
  return vec2(${waveHorizontalTermsX}, ${waveHorizontalTermsZ});
}`;

const vertexGLSL = `
attribute vec3 aPosition;
attribute vec2 aUv0;
uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform mat4 uReflectionMatrix;
uniform float uTime;
uniform float uReducedMotion;
varying vec2 vUv0;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec4 vReflectionClip;
${sharedWaveGLSL}
void main(void) {
  float time = mix(uTime, ${STATIC_REDUCED_TIME.toFixed(1)}, uReducedMotion);
  vec3 displaced = aPosition;
  displaced.xz += sharedWaveHorizontal(aPosition.xz, time);
  displaced.y += sharedWaveHeight(aPosition.xz, time);
  vec2 slope = sharedWaveSlope(aPosition.xz, time);
  vec3 localNormal = normalize(vec3(-slope.x, 1.0, -slope.y));
  vec4 world = matrix_model * vec4(displaced, 1.0);
  vUv0 = aUv0;
  vWorldPosition = world.xyz;
  vWorldNormal = normalize(mat3(matrix_model) * localNormal);
  vReflectionClip = uReflectionMatrix * world;
  gl_Position = matrix_viewProjection * world;
}`;

const fragmentGLSL = `
precision highp float;
varying vec2 vUv0;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec4 vReflectionClip;
uniform sampler2D uReflectionTexture;
uniform vec2 uResolution;
uniform vec3 uCameraWorld;
uniform float uTime;
uniform float uIntro;
uniform float uTransition;
uniform float uSelected;
uniform float uReducedMotion;
uniform float uReflectionEnabled;
uniform float uEnvironmentCycle;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform float uSunStrength;
uniform vec3 uMoonDirection;
uniform vec3 uMoonColor;
uniform float uMoonStrength;
uniform vec3 uAmbientColor;
uniform vec3 uFogColor;
uniform vec3 uWaterDeep;
uniform vec3 uWaterMid;
uniform vec3 uWaterHighlight;
uniform float uSunReflectionStrength;
uniform float uMoonReflectionStrength;
uniform float uRouteSpectrumStrength;
uniform vec2 uLighthouseOrigin;
uniform vec2 uLighthouseDirection;
uniform vec3 uLighthouseColor;
uniform float uLighthouseBeamStrength;
uniform float uOasisGhostStrength;
uniform vec2 uRoute0;
uniform vec2 uRoute1;
uniform vec2 uRoute2;
uniform vec2 uRoute3;
uniform vec2 uRoute4;
uniform vec4 uBody0; uniform vec4 uBodyState0;
uniform vec4 uBody1; uniform vec4 uBodyState1;
uniform vec4 uBody2; uniform vec4 uBodyState2;
uniform vec4 uBody3; uniform vec4 uBodyState3;
uniform vec4 uBody4; uniform vec4 uBodyState4;
uniform vec4 uBody5; uniform vec4 uBodyState5;
${sharedWaveGLSL}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x),
    f.y
  );
}

float temporalCellNoise(vec2 cell, float t) {
  float stagger = hash21(cell + vec2(17.31, 43.79)) * 1.73;
  float phase = t + stagger;
  float frame = floor(phase);
  float blend = fract(phase);
  blend = blend * blend * (3.0 - 2.0 * blend);
  vec2 seedA = cell + vec2(frame * 19.19, frame * 7.73);
  vec2 seedB = cell + vec2((frame + 1.0) * 19.19, (frame + 1.0) * 7.73);
  return mix(hash21(seedA), hash21(seedB), blend);
}

float signedSegmentDistance(vec2 p, vec2 a, vec2 b, out float along) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  along = clamp(dot(pa, ba) / max(dot(ba, ba), .0001), 0.0, 1.0);
  vec2 offset = pa - ba * along;
  float side = sign(ba.x * offset.y - ba.y * offset.x);
  return length(offset) * mix(1.0, side, step(.00001, length(offset)));
}

float ellipse(vec2 p, vec2 center, vec2 radius) {
  return 1.0 - smoothstep(.78, 1.08, length((p - center) / max(radius, vec2(.001))));
}

float distributionGGX(float noH, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float d = noH * noH * (a2 - 1.0) + 1.0;
  return a2 / max(.0001, 3.14159265 * d * d);
}

float geometrySchlick(float noV, float roughness) {
  float r = roughness + 1.0;
  float k = r * r * .125;
  return noV / max(.0001, noV * (1.0 - k) + k);
}

float ggxSpecular(vec3 normal, vec3 viewDir, vec3 lightDir, float roughness) {
  vec3 halfDir = normalize(viewDir + lightDir);
  float noV = max(.001, dot(normal, viewDir));
  float noL = max(0.0, dot(normal, lightDir));
  float noH = max(0.0, dot(normal, halfDir));
  return distributionGGX(noH, roughness) * geometrySchlick(noV, roughness) * geometrySchlick(noL, roughness) * noL;
}

float reflectionRoad(vec2 p, vec2 axis, float elevation, float seed) {
  vec2 direction = normalize(axis + vec2(.0001));
  vec2 normal = vec2(-direction.y, direction.x);
  vec2 local = p - vec2(-1.25, .15);
  float across = dot(local, normal);
  float along = dot(local, direction);
  float width = mix(.34, 1.82, clamp(elevation, 0.0, 1.0));
  float taper = mix(.62, 1.34, smoothstep(-8.0, 7.5, along));
  float road = exp(-abs(across) / max(.08, width * taper));
  road *= smoothstep(-11.0, -7.0, along) * (1.0 - smoothstep(6.5, 11.5, along));
  float broken = smoothstep(.31, .77, valueNoise(p * vec2(2.8, 8.4) + seed) + hash21(floor(p * 18.0)) * .28);
  return road * (.16 + broken * .84);
}

vec3 spectrumWake(float signedDistance, float along, float phase, float oasisMix) {
  float center = exp(-abs(signedDistance) * 17.0);
  float cyan = exp(-abs(signedDistance + .095) * 28.0);
  float gold = exp(-abs(signedDistance - .095) * 27.0);
  float magenta = exp(-abs(signedDistance - .175) * 34.0);
  float flow = .72 + .28 * sin(phase + along * 15.0);
  vec3 spectrum = vec3(.90, .94, .83) * center * .88;
  spectrum += vec3(.13, .82, .94) * cyan * .78;
  spectrum += vec3(1.0, .55, .16) * gold * .82;
  spectrum += vec3(.88, .20, .48) * magenta * .30;
  spectrum = mix(spectrum, spectrum + vec3(.08, .92, .34) * center * .78, oasisMix);
  return spectrum * flow;
}

vec3 bodyContribution(vec2 p, vec4 body, vec4 state, vec3 lamp, float waveBreak) {
  vec2 delta = p - body.xy;
  float radial = length(delta / max(body.z, .05));
  float contact = 1.0 - smoothstep(.52, 1.04, radial);
  float foamRing = smoothstep(.64, .91, radial) * (1.0 - smoothstep(.91, 1.18, radial));
  float reflected = ellipse(p, body.xy + vec2(.04, 1.12 * body.z), vec2(body.z * .44, body.z * 1.72));
  float broken = smoothstep(.36, .86, waveBreak + hash21(floor(p * 36.0)) * .44);
  vec3 result = -mix(vec3(.018, .025, .029), uWaterDeep * .26, .55) * contact * state.x;
  result += mix(vec3(.22, .40, .41), uWaterHighlight, .38) * foamRing * state.z * broken * .13;
  result += lamp * reflected * broken * body.w * (.075 + state.y * .06);
  result += lamp * (1.0 - smoothstep(.0, body.z * 1.75, length(delta))) * state.y * .025;
  return result;
}

void main(void) {
  vec2 p = vWorldPosition.xz;
  float time = mix(uTime, ${STATIC_REDUCED_TIME.toFixed(1)}, uReducedMotion);
  float height = sharedWaveHeight(p, time);
  vec2 slope = sharedWaveSlope(p, time);
  vec3 viewDir = normalize(uCameraWorld - vWorldPosition);
  vec2 capillary = vec2(
    cos(p.x * 12.8 + p.y * 4.1 + time * 1.43) + cos(p.x * 23.0 - p.y * 8.2 - time * 2.16) * .42,
    cos(p.y * 14.4 - p.x * 3.8 + time * 1.71) + cos(p.y * 26.0 + p.x * 7.1 + time * 2.42) * .38
  );
  vec3 waterNormal = normalize(vWorldNormal + vec3(-capillary.x, 0.0, -capillary.y) * .021);
  float slopeEnergy = clamp(length(slope) * 2.25 + length(capillary) * .035, 0.0, 1.0);
  float noV = max(0.0, dot(waterNormal, viewDir));
  float fresnel = .025 + .975 * pow(1.0 - noV, 5.0);
  float depthBand = smoothstep(-8.5, 6.0, p.y);
  float daylightClarity = smoothstep(.28, 1.45, uSunStrength) * (1.0 - uTransition);
  float illumination = clamp(uSunStrength * .42 + uMoonStrength * .28 + .34, .38, 1.18);
  vec3 sea = mix(uWaterDeep, uWaterMid, clamp(.34 + depthBand * .16 + height * 1.24 + slopeEnergy * .12, 0.0, 1.0));
  float cloudShadow = .91 + valueNoise(p * .085 + vec2(time * .009, -time * .006)) * .09;
  sea *= cloudShadow * illumination;
  sea *= mix(vec3(1.0), vec3(.88, 1.025, 1.13), daylightClarity * .48);
  float clearDepth = valueNoise(p * .19 + vec2(time * .012, -time * .009));
  sea += mix(vec3(.002, .035, .078), vec3(.012, .105, .190), clearDepth)
    * daylightClarity * (.40 + noV * .42);
  sea += uAmbientColor * fresnel * (.075 + illumination * .045);
  sea += uWaterHighlight * max(0.0, height) * (.20 + slopeEnergy * .22);

  float sunSpec = ggxSpecular(waterNormal, viewDir, normalize(uSunDirection), .16) * uSunStrength;
  float moonSpec = ggxSpecular(waterNormal, viewDir, normalize(uMoonDirection), .22) * uMoonStrength;
  float glintPattern = temporalCellNoise(floor(p * 10.0), time * .48);
  float glintBreak = smoothstep(.22, .78, slopeEnergy * .58 + glintPattern * .62);
  sunSpec = min(sunSpec, 2.6) * (.22 + glintBreak * .78);
  moonSpec = min(moonSpec, 2.2) * (.20 + glintBreak * .80);
  float sunRoad = reflectionRoad(p, uSunDirection.xz, clamp(uSunDirection.y, 0.0, 1.0), 3.7);
  float moonRoad = reflectionRoad(p, uMoonDirection.xz, clamp(uMoonDirection.y, 0.0, 1.0) * .48, 9.4);
  sea += uSunColor * uSunReflectionStrength * (sunSpec * .022 + sunRoad * glintBreak * (.052 + slopeEnergy * .125));
  sea += uMoonColor * uMoonReflectionStrength * (moonSpec * .026 + moonRoad * glintBreak * (.072 + slopeEnergy * .168));

  float crest = smoothstep(.065, .145, height + slopeEnergy * .052);
  float crestNoise = valueNoise(p * vec2(5.4, 17.0) + vec2(time * .021, -time * .046)) * .72;
  crestNoise += temporalCellNoise(floor(p * 20.0), time * .34) * .28;
  crestNoise = smoothstep(.70, .92, crestNoise);
  sea += mix(vec3(.76, .88, .82), uWaterHighlight, .44) * crest * crestNoise * (.075 + fresnel * .11);

  float t0; float t1; float t2; float t3;
  float sd0 = signedSegmentDistance(p, uRoute0, uRoute1, t0);
  float sd1 = signedSegmentDistance(p, uRoute1, uRoute2, t1);
  float sd2 = signedSegmentDistance(p, uRoute2, uRoute3, t2);
  float sd3 = signedSegmentDistance(p, uRoute3, uRoute4, t3);
  float d0 = abs(sd0);
  float d1 = abs(sd1);
  float d2 = abs(sd2);
  float d3 = abs(sd3);
  float routeProgress = smoothstep(1.16, 3.42, uIntro);
  float reveal0 = 1.0 - smoothstep(routeProgress * 4.0 - .02, routeProgress * 4.0 + .08, t0);
  float reveal1 = step(.245, routeProgress) * (1.0 - smoothstep((routeProgress - .25) * 4.0 - .02, (routeProgress - .25) * 4.0 + .08, t1));
  float reveal2 = step(.495, routeProgress) * (1.0 - smoothstep((routeProgress - .50) * 4.0 - .02, (routeProgress - .50) * 4.0 + .08, t2));
  float routeBreak = smoothstep(.20, .73, slopeEnergy * .57 + height * 1.85 + valueNoise(floor(p * 15.0) * .17) * .64);
  float routeVisibility = .30 + routeBreak * .70;
  float routeBase = exp(-min(min(d0, d1), min(d2, d3)) * 4.6) * (.020 + routeVisibility * .052);
  sea += mix(vec3(.025, .22, .24), uWaterHighlight * .22, .32) * routeBase * uRouteSpectrumStrength;
  vec3 spectrum = spectrumWake(sd0, t0, time * .39, 0.0) * reveal0;
  spectrum += spectrumWake(sd1, t1, time * .37 + 1.7, 0.0) * reveal1;
  spectrum += spectrumWake(sd2, t2, time * .35 + 3.1, 0.0) * reveal2;
  float gateReveal = smoothstep(4.55, 5.20, uIntro);
  float futureReveal = mix(gateReveal, 1.0, step(3.5, uSelected));
  spectrum += spectrumWake(sd3, t3, time * .33 + 4.6, 1.0) * futureReveal;
  sea += spectrum * routeVisibility * uRouteSpectrumStrength * .240;
  float currentWake = exp(-d2 * 12.0) * reveal2 * pow(max(0.0, sin(time * 3.0 - t2 * 26.0)), 9.0);
  sea += vec3(.94, .92, .79) * currentWake * routeVisibility * uRouteSpectrumStrength * .28;

  sea += bodyContribution(p, uBody0, uBodyState0, vec3(.88, .48, .20), height * 3.0 + slopeEnergy);
  sea += bodyContribution(p, uBody1, uBodyState1, vec3(.28, .72, .80), height * 3.0 + slopeEnergy);
  sea += bodyContribution(p, uBody2, uBodyState2, vec3(.75, .82, .72), height * 3.0 + slopeEnergy);
  sea += bodyContribution(p, uBody3, uBodyState3, vec3(1.0, .64, .26), height * 3.0 + slopeEnergy);
  sea += bodyContribution(p, uBody4, uBodyState4, vec3(.12, 1.0, .40), height * 3.0 + slopeEnergy);
  sea += bodyContribution(p, uBody5, uBodyState5, vec3(1.0, .62, .24), height * 3.0 + slopeEnergy);

  vec2 gateDelta = p - uBody4.xy;
  float gateHalo = 1.0 - smoothstep(uBody4.z * .18, uBody4.z * 1.85, length(gateDelta));
  float gateReflection = ellipse(
    p,
    uBody4.xy + vec2(.02, uBody4.z * 1.68),
    vec2(uBody4.z * .38, uBody4.z * 2.72)
  );
  float gateShred = smoothstep(
    .24,
    .80,
    slopeEnergy * .58 + temporalCellNoise(floor(p * 18.0), time * .26) * .60
  );
  float gatePulse = .93 + sin(time * .71) * .045 + sin(time * 1.93 + .8) * .025;
  sea += vec3(.028, 1.0, .285) * uOasisGhostStrength * gatePulse
    * (gateHalo * (.018 + fresnel * .028) + gateReflection * gateShred * (.12 + fresnel * .11));

  vec2 reflectionUv = vReflectionClip.xy / max(.001, vReflectionClip.w) * .5 + .5;
  reflectionUv += slope * vec2(.013, -.010);
  vec4 reflectedScene = texture2D(uReflectionTexture, reflectionUv);
  float reflectionMask = step(0.0, reflectionUv.x) * step(reflectionUv.x, 1.0) * step(0.0, reflectionUv.y) * step(reflectionUv.y, 1.0);
  sea += reflectedScene.rgb * reflectedScene.a * reflectionMask * uReflectionEnabled * (.035 + fresnel * .11) * (.30 + glintBreak * .70);

  float warmDissolve = 1.0 - smoothstep(.04, 1.20, uIntro);
  float cabinetBars = pow(max(0.0, sin((p.x + p.y * .17) * 7.2 + height * 8.0)), 32.0);
  sea += vec3(1.0, .43, .13) * warmDissolve * cabinetBars * smoothstep(-6.0, 5.0, p.y) * .12;

  float lighthouseReveal = smoothstep(1.6, 3.9, uIntro) * (1.0 - uReducedMotion);
  vec2 lightDelta = p - uLighthouseOrigin;
  vec2 beamDirection = normalize(uLighthouseDirection + vec2(.0001));
  float beamAcross = abs(lightDelta.x * beamDirection.y - lightDelta.y * beamDirection.x);
  float beamAlong = dot(lightDelta, beamDirection);
  float beamWidth = mix(.035, .64, smoothstep(.0, 6.25, beamAlong));
  float beamEdge = 1.0 - smoothstep(beamWidth * .46, beamWidth, beamAcross);
  float beamLength = smoothstep(.06, .34, beamAlong) * (1.0 - smoothstep(5.55, 6.45, beamAlong));
  float beamTexture = .62 + valueNoise(vec2(beamAlong * 3.1, beamAcross * 19.0) + time * .05) * .38;
  float beam = beamEdge * beamLength * beamTexture;
  float beamEndpoint = ellipse(p, uLighthouseOrigin + beamDirection * 5.9, vec2(.42, .28));
  float beamStrength = mix(uLighthouseBeamStrength, .23, uReducedMotion);
  sea += uLighthouseColor * beam * beamStrength * mix(.13, .31, glintBreak) * max(.34, lighthouseReveal);
  sea += uLighthouseColor * beamEndpoint * beamStrength * routeVisibility * .17;

  float farMist = smoothstep(1.0, -8.2, p.y);
  sea = mix(sea, uFogColor, farMist * (.055 + uTransition * .06));
  vec3 horizonNight = mix(vec3(.007, .032, .070), vec3(.012, .078, .128), farMist);
  sea = mix(sea, horizonNight, uTransition * .76);
  sea = max(sea * 1.04 + vec3(.002, .004, .004), vec3(0.0));
  gl_FragColor = vec4(sea, 1.0);
}`;

const postFragmentGLSL = `
precision highp float;
varying vec2 vUv0;
uniform sampler2D uColorBuffer;
uniform vec2 uPostResolution;
uniform float uColorLevels;

float bayer4(vec2 pixel) {
  float x = mod(pixel.x, 4.0);
  float y = mod(pixel.y, 4.0);
  float index = x + y * 4.0;
  if (index < .5) return 0.0;
  if (index < 1.5) return 8.0;
  if (index < 2.5) return 2.0;
  if (index < 3.5) return 10.0;
  if (index < 4.5) return 12.0;
  if (index < 5.5) return 4.0;
  if (index < 6.5) return 14.0;
  if (index < 7.5) return 6.0;
  if (index < 8.5) return 3.0;
  if (index < 9.5) return 11.0;
  if (index < 10.5) return 1.0;
  if (index < 11.5) return 9.0;
  if (index < 12.5) return 15.0;
  if (index < 13.5) return 7.0;
  if (index < 14.5) return 13.0;
  return 5.0;
}

void main(void) {
  vec3 color = texture2D(uColorBuffer, vUv0).rgb;
  float ordered = (bayer4(floor(gl_FragCoord.xy)) / 16.0 - .5) / max(16.0, uColorLevels);
  color = floor(max(color + ordered, vec3(0.0)) * uColorLevels) / uColorLevels;
  vec2 centered = (vUv0 - .5) * vec2(uPostResolution.x / max(1.0, uPostResolution.y), 1.0);
  float vignette = 1.0 - smoothstep(.52, 1.03, length(centered)) * .13;
  float scan = .992 + .008 * step(.5, fract(gl_FragCoord.y * .2));
  gl_FragColor = vec4(color * vignette * scan, 1.0);
}`;

const lighthouseBeamVertexGLSL = `
attribute vec3 aPosition;
attribute vec2 aUv0;
uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
varying vec2 vUv0;
varying vec3 vWorldPosition;
void main(void) {
  vec4 world = matrix_model * vec4(aPosition, 1.0);
  vUv0 = aUv0;
  vWorldPosition = world.xyz;
  gl_Position = matrix_viewProjection * world;
}`;

const lighthouseBeamFragmentGLSL = `
precision highp float;
varying vec2 vUv0;
varying vec3 vWorldPosition;
uniform vec3 uBeamColor;
uniform float uBeamStrength;
uniform float uBeamTime;

float beamHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float beamTemporalNoise(vec2 cell, float t) {
  float stagger = beamHash(cell + vec2(9.7, 27.1)) * 1.61;
  float phase = t + stagger;
  float frame = floor(phase);
  float blend = fract(phase);
  blend = blend * blend * (3.0 - 2.0 * blend);
  float first = beamHash(cell + vec2(frame * 11.3, frame * 5.9));
  float second = beamHash(cell + vec2((frame + 1.0) * 11.3, (frame + 1.0) * 5.9));
  return mix(first, second, blend);
}

void main(void) {
  float edge = 1.0 - smoothstep(.30, .50, abs(vUv0.x - .5));
  float longitudinal = smoothstep(.02, .12, vUv0.y) * (1.0 - smoothstep(.82, 1.0, vUv0.y));
  float grain = .58 + beamTemporalNoise(floor(vWorldPosition.xz * 18.0), uBeamTime * .46) * .42;
  float alpha = edge * longitudinal * grain * uBeamStrength * .070;
  gl_FragColor = vec4(uBeamColor * alpha * 1.85, alpha);
}`;

class VoyagePixelPostEffect extends pc.PostEffect {
  private readonly shader: pc.Shader;
  private readonly resolution = new Float32Array([960, 540]);
  private levels = 36;

  constructor(device: pc.GraphicsDevice) {
    super(device);
    this.shader = pc.createShaderFromCode(
      device,
      pc.PostEffect.quadVertexShader,
      postFragmentGLSL,
      "VoyagePixelColorGradeV2",
      { aPosition: pc.SEMANTIC_POSITION }
    );
  }

  setQuality(tier: QualityTier): void {
    this.levels = tier === "high" ? 36 : tier === "balanced" ? 32 : 28;
  }

  render(inputTarget: pc.RenderTarget, outputTarget: pc.RenderTarget | null, rect: pc.Vec4): void {
    this.resolution[0] = inputTarget.width;
    this.resolution[1] = inputTarget.height;
    this.device.scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
    this.device.scope.resolve("uPostResolution").setValue(this.resolution);
    this.device.scope.resolve("uColorLevels").setValue(this.levels);
    this.drawQuad(outputTarget, this.shader, rect);
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampRange(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const t = clamp01((value - minimum) / Math.max(.0001, maximum - minimum));
  return t * t * (3 - 2 * t);
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function setInterpolatedColor(color: pc.Color, from: readonly [number, number, number], to: readonly [number, number, number], amount: number): void {
  color.set(
    lerp(from[0], to[0], amount),
    lerp(from[1], to[1], amount),
    lerp(from[2], to[2], amount)
  );
}

function setLightDirection(target: pc.Vec3, azimuth: number, elevation: number): void {
  const azimuthRadians = azimuth / RAD_TO_DEG;
  const elevationRadians = elevation / RAD_TO_DEG;
  const horizontal = Math.cos(elevationRadians);
  target.set(
    Math.cos(azimuthRadians) * horizontal,
    Math.sin(elevationRadians),
    Math.sin(azimuthRadians) * horizontal
  ).normalize();
}

function writeVec3Uniform(target: Float32Array, source: pc.Vec3): void {
  target[0] = source.x;
  target[1] = source.y;
  target[2] = source.z;
}

function writeColorUniform(target: Float32Array, source: pc.Color): void {
  target[0] = source.r;
  target[1] = source.g;
  target[2] = source.b;
}

function environmentPhaseForTime(time: number): VoyageDayPhase {
  if (time < 12) return "morning";
  if (time < 27) return "noon";
  if (time < 40) return "sunset";
  if (time < 50) return "night";
  return "dawn";
}

function createEnvironmentState(): VoyageEnvironmentState {
  return {
    cycleElapsed: 0,
    phase: "morning",
    sunDirection: new pc.Vec3(),
    sunColor: new pc.Color(),
    sunStrength: 0,
    moonDirection: new pc.Vec3(),
    moonColor: new pc.Color(),
    moonStrength: 0,
    ambientColor: new pc.Color(),
    ambientStrength: 1,
    exposure: 1,
    fogColor: new pc.Color(),
    waterDeep: new pc.Color(),
    waterMid: new pc.Color(),
    waterHighlight: new pc.Color(),
    sunReflectionStrength: 0,
    moonReflectionStrength: 0,
    lighthouseStrength: 0,
    routeSpectrumStrength: 0,
    waterLuminance: 0,
    sunAzimuth: 0,
    sunElevation: 0,
    moonAzimuth: 0,
    moonElevation: 0
  };
}

function sampleEnvironment(time: number, state: VoyageEnvironmentState): VoyageEnvironmentState {
  const cycleElapsed = ((time % ENVIRONMENT_CYCLE_DURATION) + ENVIRONMENT_CYCLE_DURATION) % ENVIRONMENT_CYCLE_DURATION;
  let keyframeIndex = 0;
  for (let index = 0; index < ENVIRONMENT_KEYFRAMES.length - 1; index++) {
    if (cycleElapsed >= ENVIRONMENT_KEYFRAMES[index].time && cycleElapsed < ENVIRONMENT_KEYFRAMES[index + 1].time) {
      keyframeIndex = index;
      break;
    }
  }
  const from = ENVIRONMENT_KEYFRAMES[keyframeIndex];
  const to = ENVIRONMENT_KEYFRAMES[keyframeIndex + 1];
  const amount = smoothstep(0, 1, (cycleElapsed - from.time) / Math.max(.001, to.time - from.time));
  state.cycleElapsed = cycleElapsed;
  state.phase = environmentPhaseForTime(cycleElapsed);
  state.sunAzimuth = lerp(from.sunAzimuth, to.sunAzimuth, amount);
  state.sunElevation = lerp(from.sunElevation, to.sunElevation, amount);
  state.sunStrength = lerp(from.sunStrength, to.sunStrength, amount);
  state.moonAzimuth = lerp(from.moonAzimuth, to.moonAzimuth, amount);
  state.moonElevation = lerp(from.moonElevation, to.moonElevation, amount);
  state.moonStrength = lerp(from.moonStrength, to.moonStrength, amount);
  state.ambientStrength = lerp(from.ambientStrength, to.ambientStrength, amount);
  state.exposure = lerp(from.exposure, to.exposure, amount);
  state.sunReflectionStrength = lerp(from.sunReflectionStrength, to.sunReflectionStrength, amount);
  state.moonReflectionStrength = lerp(from.moonReflectionStrength, to.moonReflectionStrength, amount);
  state.lighthouseStrength = lerp(from.lighthouseStrength, to.lighthouseStrength, amount);
  state.routeSpectrumStrength = lerp(from.routeSpectrumStrength, to.routeSpectrumStrength, amount);
  state.waterLuminance = lerp(from.waterLuminance, to.waterLuminance, amount);
  setInterpolatedColor(state.sunColor, from.sunColor, to.sunColor, amount);
  setInterpolatedColor(state.moonColor, from.moonColor, to.moonColor, amount);
  setInterpolatedColor(state.ambientColor, from.ambientColor, to.ambientColor, amount);
  setInterpolatedColor(state.fogColor, from.fogColor, to.fogColor, amount);
  setInterpolatedColor(state.waterDeep, from.waterDeep, to.waterDeep, amount);
  setInterpolatedColor(state.waterMid, from.waterMid, to.waterMid, amount);
  setInterpolatedColor(state.waterHighlight, from.waterHighlight, to.waterHighlight, amount);
  setLightDirection(state.sunDirection, state.sunAzimuth, state.sunElevation);
  setLightDirection(state.moonDirection, state.moonAzimuth, state.moonElevation);
  return state;
}

function phaseForTime(time: number): VoyageIntroPhase {
  if (time < 1.2) return "dissolve";
  if (time < 3.4) return "route-survey";
  if (time < INTRO_DURATION) return "harbor-reveal";
  return "interactive";
}

function isLandmarkKind(value: string): value is LandmarkKind {
  return value === "dock" || value === "reef" || value === "lighthouse" || value === "harbor" || value === "gate";
}

function emptyFloatingState(): FloatingBodyState {
  return {
    height: 0,
    pitch: 0,
    roll: 0,
    contactStrength: 0,
    reflectionStrength: 0,
    modelWaterlineOffset: 0,
    submergedFraction: 0,
    crestStrength: 0,
    waterMeanLevel: 0
  };
}

export class VoyageSceneRenderer implements TransitionAwareSceneRenderer {
  private readonly app: pc.Application;
  private readonly host: HTMLElement | null;
  private readonly sceneRoot = new pc.Entity("luminous-wake-floating-archipelago");
  private readonly models = new Map<VoyageNodeId, InstalledModel>();
  private readonly floatingBodies = new Map<FloatingBodyId, FloatingBody>();
  private readonly landmarkAssets: Record<string, VoyageLandmarkAssetState> = {
    dock: "poster",
    reef: "poster",
    lighthouse: "poster",
    harbor: "poster",
    gate: "poster"
  };
  private readonly floatingStates: Record<FloatingBodyId, FloatingBodyState> = {
    docdiff: emptyFloatingState(),
    neural: emptyFloatingState(),
    directl: emptyFloatingState(),
    eva01: emptyFloatingState(),
    world: emptyFloatingState(),
    boat: emptyFloatingState()
  };
  private readonly projectedNodePositions: Record<VoyageNodeId, [number, number]> = {
    docdiff: [0, 0], neural: [0, 0], directl: [0, 0], eva01: [0, 0], world: [0, 0]
  };
  private readonly bodyUniforms = BODY_ORDER.map(() => ({ body: new Float32Array(4), state: new Float32Array(4) }));
  private readonly routeUniforms = Array.from({ length: 5 }, () => new Float32Array(2));
  private readonly cameraWorldUniform = new Float32Array(3);
  private readonly sunDirectionUniform = new Float32Array(3);
  private readonly moonDirectionUniform = new Float32Array(3);
  private readonly sunColorUniform = new Float32Array(3);
  private readonly moonColorUniform = new Float32Array(3);
  private readonly ambientColorUniform = new Float32Array(3);
  private readonly fogColorUniform = new Float32Array(3);
  private readonly waterDeepUniform = new Float32Array(3);
  private readonly waterMidUniform = new Float32Array(3);
  private readonly waterHighlightUniform = new Float32Array(3);
  private readonly lighthouseOriginUniform = new Float32Array(2);
  private readonly lighthouseDirectionUniform = new Float32Array([1, 0]);
  private readonly lighthouseColorUniform = new Float32Array([1, .88, .64]);
  private readonly environmentState = createEnvironmentState();
  private readonly reflectionMatrix = new pc.Mat4();
  private readonly cameraTarget = new pc.Vec3();
  private readonly mainCameraPosition = new pc.Vec3();
  private readonly reflectionCameraPosition = new pc.Vec3();
  private readonly projectionWorldScratch = new pc.Vec3();
  private readonly projectionScreenScratch = new pc.Vec3();
  private readonly lighthouseTargetScratch = new pc.Vec3();
  private readonly lighthouseWorldScratch = new pc.Vec3();
  private readonly waveSampleNormal = new pc.Vec3();
  private readonly waveSampleVelocity = new pc.Vec2();
  private readonly waveSampleScratch: WaveSample = {
    height: 0,
    normal: this.waveSampleNormal,
    horizontalVelocity: this.waveSampleVelocity,
    crestStrength: 0
  };
  private readonly debugHook: (() => VoyageDebugState) & {
    skipIntro: () => void;
    setIntroTime: (seconds: number) => void;
    setSceneTime: (seconds: number) => void;
    selectNode: (node: VoyageNodeId) => void;
    setEvidenceOpen: (open: boolean) => void;
    setEvidenceIndex: (index: number) => void;
    setTransitionProgress: (progress: number) => void;
  };

  private camera: pc.Entity | null = null;
  private reflectionCamera: pc.Entity | null = null;
  private reflectionLayer: pc.Layer | null = null;
  private reflectionTarget: pc.RenderTarget | null = null;
  private reflectionTexture: pc.Texture | null = null;
  private blankReflectionTexture: pc.Texture | null = null;
  private reflectionMode: VoyageReflectionMode = "analytic";
  private oceanPlane: pc.Entity | null = null;
  private oceanMaterial: pc.ShaderMaterial | null = null;
  private pixelEffect: VoyagePixelPostEffect | null = null;
  private boat: pc.Entity | null = null;
  private boatAsset: VoyageBoatAssetState = "procedural";
  private boatMaterials: pc.StandardMaterial[] = [];
  private harborLight: pc.Entity | null = null;
  private gateLight: pc.Entity | null = null;
  private sunLight: pc.Entity | null = null;
  private moonLight: pc.Entity | null = null;
  private lighthouseLight: pc.Entity | null = null;
  private lighthouseRig: pc.Entity | null = null;
  private lighthouseBeamVolume: pc.Entity | null = null;
  private lighthouseBeamMaterial: pc.ShaderMaterial | null = null;
  private oasisGhostStrength = 0;
  private resizeObserver: ResizeObserver | null = null;
  private qualityTier: QualityTier;
  private running = false;
  private ready = false;
  private assetsReady = false;
  private assetsLoadPromise: Promise<void> = Promise.resolve();
  private portrait = false;
  private introElapsed = 0;
  private sceneElapsed = 0;
  private selectedNode: VoyageNodeId = HARBOR_NODE;
  private evidenceOpen = false;
  private evidenceIndex = 0;
  private evidenceCount = 1;
  private transitionProgress = 0;
  private boatHeading = 0;
  private cameraPitch = 74;
  private lastPhase: VoyageIntroPhase = "dissolve";
  private waterMeanLevel = 0;
  private renderPassFrame = 0;
  private reflectionNeedsUpdate = true;
  private shadowNeedsUpdate = true;
  private reflectionUpdates = 0;
  private shadowUpdates = 0;
  private reflectionUpdateInterval = 1;
  private shadowUpdateInterval = 1;
  private renderAccumulator = 0;
  private forceRenderRequested = true;
  private lastGateMaterialGlow = Number.NaN;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: VoyageSceneOptions) {
    this.qualityTier = options.qualityTier;
    this.host = canvas.closest<HTMLElement>(".voyage-scene");
    this.app = new pc.Application(canvas, {
      graphicsDeviceOptions: {
        alpha: false,
        antialias: false,
        powerPreference: "high-performance",
        deviceTypes: [pc.DEVICETYPE_WEBGL2]
      }
    });
    this.debugHook = Object.assign(() => this.debugState(), {
      skipIntro: () => this.skipIntro(),
      setIntroTime: (seconds: number) => {
        this.pause();
        this.introElapsed = Math.max(0, seconds);
        this.updateFrame(0);
      },
      setSceneTime: (seconds: number) => {
        this.pause();
        this.sceneElapsed = Math.max(0, seconds);
        this.updateFrame(0);
      },
      selectNode: (node: VoyageNodeId) => {
        if (!this.options.nodes.some((candidate) => candidate.id === node)) return;
        this.selectNode(node);
        this.options.onSelectNode?.(node);
      },
      setEvidenceOpen: (open: boolean) => {
        this.setEvidenceOpen(open);
        this.options.onEvidenceOpenChange?.(open);
      },
      setEvidenceIndex: (index: number) => this.setEvidenceIndex(index),
      setTransitionProgress: (progress: number) => this.setTransitionProgress(progress)
    });
  }

  async init(): Promise<void> {
    this.configureScene();
    this.createOceanPlane();
    this.app.root.addChild(this.sceneRoot);
    this.app.on("update", this.updateFrame, this);
    this.app.start();
    this.app.autoRender = false;
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    if (this.host) this.resizeObserver.observe(this.host);
    this.introElapsed = this.options.reducedMotion ? INTRO_DURATION : 0;
    this.sceneElapsed = this.options.reducedMotion ? STATIC_REDUCED_TIME : 0;
    this.ready = true;
    this.updateFrame(0);
    this.canvas.dataset.sceneReady = "true";
    this.host?.classList.add("is-voyage-ready");
    this.host?.classList.remove("voyage-fallback-active");
    window.__voyageDebug = this.debugHook;
    // GLB decoding, shader compilation, and environment-atlas generation all
    // execute on the main thread/GPU queue. Keep the authored poster fallback
    // visible and stream these real assets one at a time instead of allowing
    // six large models to contend with the active scene in the same frame.
    this.assetsLoadPromise = this.loadSceneAssets().catch((error) => {
      console.warn("Voyage streamed asset load did not complete", error);
    });
  }

  /** Resolves only after every authored landmark and the vessel are installed. */
  whenAssetsReady(): Promise<void> {
    return this.assetsLoadPromise;
  }

  start(): void {
    this.resume();
  }

  pause(): void {
    this.running = false;
    this.renderAccumulator = 0;
    if (this.reflectionCamera?.camera) this.reflectionCamera.camera.enabled = false;
    const sunLight = this.sunLight?.light;
    if (sunLight?.castShadows) sunLight.shadowUpdateMode = pc.SHADOWUPDATE_NONE;
    this.reflectionNeedsUpdate = true;
    this.shadowNeedsUpdate = true;
  }

  resume(): void {
    if (!this.ready || this.options.reducedMotion) return;
    this.running = true;
    this.renderAccumulator = 0;
    this.forceRenderRequested = true;
    this.reflectionNeedsUpdate = true;
    this.shadowNeedsUpdate = true;
    this.app.renderNextFrame = true;
  }

  resize(): void {
    const rect = this.host?.getBoundingClientRect() ?? this.canvas.getBoundingClientRect();
    const aspect = rect.width / Math.max(rect.height, 1);
    this.portrait = aspect < .8;
    const longEdge = this.qualityTier === "high" ? 960 : this.qualityTier === "balanced" ? 720 : 480;
    const width = aspect >= 1 ? longEdge : Math.max(160, Math.round(longEdge * aspect));
    const height = aspect >= 1 ? Math.max(240, Math.round(longEdge / aspect)) : longEdge;
    this.app.setCanvasResolution(pc.RESOLUTION_FIXED, Math.max(4, Math.round(width / 4) * 4), Math.max(4, Math.round(height / 4) * 4));
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    if (this.camera?.camera) {
      this.camera.camera.aspectRatioMode = pc.ASPECT_MANUAL;
      this.camera.camera.aspectRatio = aspect;
      this.camera.camera.fov = this.portrait ? 42 : rect.width <= 1450 ? 35 : 31;
    }
    if (this.reflectionCamera?.camera) {
      this.reflectionCamera.camera.aspectRatioMode = pc.ASPECT_MANUAL;
      this.reflectionCamera.camera.aspectRatio = aspect;
      this.reflectionCamera.camera.fov = this.portrait ? 42 : rect.width <= 1450 ? 35 : 31;
    }
    this.positionSceneElements();
    this.oceanMaterial?.setParameter("uResolution", new Float32Array([this.canvas.width, this.canvas.height]));
    this.setupReflectionTarget();
    this.reflectionNeedsUpdate = true;
    this.shadowNeedsUpdate = true;
    if (this.ready) {
      this.updateFrame(0);
      this.app.renderNextFrame = true;
    }
  }

  setQuality(tier: QualityTier): void {
    this.qualityTier = tier === "fallback" ? "low" : tier;
    this.pixelEffect?.setQuality(this.qualityTier);
    this.reflectionNeedsUpdate = true;
    this.shadowNeedsUpdate = true;
    this.resize();
  }

  selectNode(node: VoyageNodeId): void {
    this.selectedNode = node;
    this.boatHeading = node === "world" ? -.34 : 0;
    const selectedIndex = this.options.nodes.findIndex((candidate) => candidate.id === node);
    this.oceanMaterial?.setParameter("uSelected", Math.max(0, selectedIndex));
    this.models.forEach((model, id) => {
      const selected = id === node;
      const selectionScale = model.baseScale * (selected ? 1.045 : 1);
      model.body.visualRoot.setLocalScale(selectionScale, selectionScale, selectionScale);
      model.materials.forEach((material) => {
        const kind = model.node?.landmark;
        if (kind === "gate") return;
        if (kind === "reef" || kind === "lighthouse") {
          material.emissive = selected ? new pc.Color(.045, .105, .115) : new pc.Color(.018, .052, .058);
          material.emissiveIntensity = selected ? .54 : .32;
        } else {
          material.emissive = selected ? new pc.Color(.115, .07, .025) : new pc.Color(.052, .026, .008);
          material.emissiveIntensity = selected ? .52 : .28;
        }
        material.update();
      });
    });
    if (this.gateLight?.light) this.gateLight.light.intensity = node === "world" ? 1.55 : .92;
    this.reflectionNeedsUpdate = true;
    this.shadowNeedsUpdate = true;
    this.updateFrame(0);
  }

  skipIntro(): void {
    if (this.options.reducedMotion || this.introElapsed >= INTRO_DURATION) return;
    this.introElapsed = INTRO_DURATION;
    this.sceneElapsed = Math.max(this.sceneElapsed, INTRO_DURATION);
    this.updateFrame(0);
  }

  setTransitionProgress(progress: number): void {
    this.transitionProgress = clamp01(progress);
    this.forceRenderRequested = true;
    this.oceanMaterial?.setParameter("uTransition", this.transitionProgress);
    this.reflectionNeedsUpdate = true;
    this.shadowNeedsUpdate = true;
    this.app.renderNextFrame = true;
  }

  setEvidenceOpen(open: boolean): void {
    this.evidenceOpen = open;
    this.forceRenderRequested = true;
    this.host?.classList.toggle("is-evidence-open", open);
  }

  setEvidenceIndex(index: number): void {
    const eligibleCount = this.host?.querySelectorAll<HTMLElement>('[data-evidence-eligible="true"]').length ?? 1;
    this.evidenceCount = Math.max(1, eligibleCount);
    this.evidenceIndex = Math.max(0, Math.min(Math.max(0, this.evidenceCount - 1), Math.floor(index)));
    this.host?.dispatchEvent(new CustomEvent("voyage:evidence-index", { detail: { index: this.evidenceIndex } }));
  }

  destroy(): void {
    this.pause();
    this.resizeObserver?.disconnect();
    this.app.off("update", this.updateFrame, this);
    if (window.__voyageDebug === this.debugHook) delete window.__voyageDebug;
    this.host?.classList.remove("is-voyage-ready");
    if (this.pixelEffect && this.camera?.camera) this.camera.camera.postEffects.removeEffect(this.pixelEffect);
    this.destroyReflectionTarget();
    this.blankReflectionTexture?.destroy();
    if (this.reflectionLayer) this.app.scene.layers.remove(this.reflectionLayer);
    this.app.destroy();
  }

  private configureScene(): void {
    const lowResolutionLighting = this.qualityTier === "low";
    sampleEnvironment(this.options.reducedMotion ? STATIC_REDUCED_TIME : 0, this.environmentState);
    this.app.setCanvasFillMode(pc.FILLMODE_NONE);
    this.app.setCanvasResolution(pc.RESOLUTION_FIXED);
    this.app.scene.ambientLight = this.environmentState.ambientColor.clone();
    this.app.scene.exposure = this.environmentState.exposure + (lowResolutionLighting ? .06 : 0);
    this.app.scene.skybox = null;

    const reflectionLayer = new pc.Layer({ name: "Voyage planar silhouettes" });
    this.app.scene.layers.pushOpaque(reflectionLayer);
    this.reflectionLayer = reflectionLayer;

    const camera = new pc.Entity("luminous-wake-overhead-camera");
    camera.addComponent("camera", {
      projection: pc.PROJECTION_PERSPECTIVE,
      fov: 31,
      nearClip: .1,
      farClip: 60,
      clearColor: new pc.Color(.035, .11, .13),
      toneMapping: pc.TONEMAP_ACES2,
      gammaCorrection: pc.GAMMA_SRGB,
      layers: [pc.LAYERID_WORLD]
    });
    camera.setPosition(0, 17, 4.8);
    camera.lookAt(-1.4, 0, 0);
    this.app.root.addChild(camera);
    this.camera = camera;
    this.pixelEffect = new VoyagePixelPostEffect(this.app.graphicsDevice);
    this.pixelEffect.setQuality(this.qualityTier);
    camera.camera!.postEffects.addEffect(this.pixelEffect);

    const reflectionCamera = new pc.Entity("luminous-wake-reflection-camera");
    reflectionCamera.addComponent("camera", {
      projection: pc.PROJECTION_PERSPECTIVE,
      fov: 31,
      nearClip: .1,
      farClip: 60,
      clearColor: new pc.Color(0, 0, 0, 0),
      clearColorBuffer: true,
      clearDepthBuffer: true,
      priority: -1,
      layers: [reflectionLayer.id]
    });
    reflectionCamera.camera!.flipFaces = true;
    reflectionCamera.camera!.enabled = false;
    this.app.root.addChild(reflectionCamera);
    this.reflectionCamera = reflectionCamera;

    const shadowEnabled = this.qualityTier !== "low";
    const key = new pc.Entity("luminous-wake-sun");
    key.addComponent("light", {
      type: "directional",
      color: this.environmentState.sunColor.clone(),
      intensity: this.environmentState.sunStrength,
      castShadows: shadowEnabled,
      shadowResolution: this.qualityTier === "high" ? 1024 : 512,
      shadowType: pc.SHADOW_PCF3,
      layers: [pc.LAYERID_WORLD, reflectionLayer.id]
    });
    key.setLocalEulerAngles(90 - this.environmentState.sunElevation, this.environmentState.sunAzimuth + 90, -8);
    this.app.root.addChild(key);
    this.sunLight = key;

    const moonFill = new pc.Entity("luminous-wake-moon");
    moonFill.addComponent("light", {
      type: "directional",
      color: this.environmentState.moonColor.clone(),
      intensity: this.environmentState.moonStrength,
      castShadows: false,
      layers: [pc.LAYERID_WORLD, reflectionLayer.id]
    });
    moonFill.setLocalEulerAngles(90 - this.environmentState.moonElevation, this.environmentState.moonAzimuth + 90, 0);
    this.app.root.addChild(moonFill);
    this.moonLight = moonFill;

    const harborLight = new pc.Entity("luminous-wake-harbor-light");
    harborLight.addComponent("light", {
      type: "point",
      color: new pc.Color(1.0, .60, .22),
      intensity: 0,
      range: 5.4,
      castShadows: false,
      layers: [pc.LAYERID_WORLD, reflectionLayer.id]
    });
    this.app.root.addChild(harborLight);
    this.harborLight = harborLight;

    const gateLight = new pc.Entity("luminous-wake-oasis-light");
    gateLight.addComponent("light", {
      type: "point",
      color: new pc.Color(.16, 1.0, .42),
      intensity: .92,
      range: 4.6,
      castShadows: false,
      layers: [pc.LAYERID_WORLD, reflectionLayer.id]
    });
    this.app.root.addChild(gateLight);
    this.gateLight = gateLight;

    const lighthouseLight = new pc.Entity("luminous-wake-lighthouse-lantern");
    lighthouseLight.addComponent("light", {
      type: "spot",
      color: new pc.Color(.70, .82, .78),
      intensity: 1.05,
      range: 7.5,
      innerConeAngle: 9,
      outerConeAngle: 20,
      castShadows: false,
      layers: [pc.LAYERID_WORLD, reflectionLayer.id]
    });
    this.app.root.addChild(lighthouseLight);
    this.lighthouseLight = lighthouseLight;
  }

  private createOceanPlane(): void {
    const material = new pc.ShaderMaterial({
      uniqueName: "LuminousWakePhysicalOceanV2",
      attributes: { aPosition: pc.SEMANTIC_POSITION, aUv0: pc.SEMANTIC_TEXCOORD0 },
      vertexGLSL,
      fragmentGLSL
    });
    material.cull = pc.CULLFACE_NONE;
    material.setParameter("uResolution", new Float32Array([960, 540]));
    material.setParameter("uCameraWorld", this.cameraWorldUniform);
    material.setParameter("uTime", 0);
    material.setParameter("uIntro", 0);
    material.setParameter("uTransition", 0);
    material.setParameter("uSelected", 3);
    material.setParameter("uReducedMotion", this.options.reducedMotion ? 1 : 0);
    material.setParameter("uReflectionEnabled", 0);
    material.setParameter("uReflectionMatrix", this.reflectionMatrix.data);
    material.setParameter("uEnvironmentCycle", 0);
    material.setParameter("uSunDirection", this.sunDirectionUniform);
    material.setParameter("uSunColor", this.sunColorUniform);
    material.setParameter("uSunStrength", this.environmentState.sunStrength);
    material.setParameter("uMoonDirection", this.moonDirectionUniform);
    material.setParameter("uMoonColor", this.moonColorUniform);
    material.setParameter("uMoonStrength", this.environmentState.moonStrength);
    material.setParameter("uAmbientColor", this.ambientColorUniform);
    material.setParameter("uFogColor", this.fogColorUniform);
    material.setParameter("uWaterDeep", this.waterDeepUniform);
    material.setParameter("uWaterMid", this.waterMidUniform);
    material.setParameter("uWaterHighlight", this.waterHighlightUniform);
    material.setParameter("uSunReflectionStrength", this.environmentState.sunReflectionStrength);
    material.setParameter("uMoonReflectionStrength", this.environmentState.moonReflectionStrength);
    material.setParameter("uRouteSpectrumStrength", this.environmentState.routeSpectrumStrength);
    material.setParameter("uLighthouseOrigin", this.lighthouseOriginUniform);
    material.setParameter("uLighthouseDirection", this.lighthouseDirectionUniform);
    material.setParameter("uLighthouseColor", this.lighthouseColorUniform);
    material.setParameter("uLighthouseBeamStrength", this.environmentState.lighthouseStrength);
    material.setParameter("uOasisGhostStrength", 0);

    const blank = new pc.Texture(this.app.graphicsDevice, {
      name: "Voyage blank reflection",
      width: 1,
      height: 1,
      format: pc.PIXELFORMAT_RGBA8,
      mipmaps: false,
      minFilter: pc.FILTER_NEAREST,
      magFilter: pc.FILTER_NEAREST
    });
    const blankPixels = blank.lock() as Uint8Array;
    blankPixels.set([0, 0, 0, 0]);
    blank.unlock();
    this.blankReflectionTexture = blank;
    material.setParameter("uReflectionTexture", blank);
    for (let index = 0; index < 5; index++) material.setParameter(`uRoute${index}`, this.routeUniforms[index]);
    for (let index = 0; index < BODY_ORDER.length; index++) {
      material.setParameter(`uBody${index}`, this.bodyUniforms[index].body);
      material.setParameter(`uBodyState${index}`, this.bodyUniforms[index].state);
    }
    material.update();
    this.oceanMaterial = material;

    const segments = this.qualityTier === "high" ? [128, 96] : this.qualityTier === "balanced" ? [96, 64] : [64, 48];
    const geometry = new pc.PlaneGeometry({
      halfExtents: new pc.Vec2(WATER_HALF_WIDTH, WATER_HALF_LENGTH),
      widthSegments: segments[0],
      lengthSegments: segments[1]
    });
    const mesh = pc.Mesh.fromGeometry(this.app.graphicsDevice, geometry);
    const meshInstance = new pc.MeshInstance(mesh, material);
    meshInstance.castShadow = false;
    meshInstance.receiveShadow = false;
    const plane = new pc.Entity("luminous-wake-xz-ocean");
    plane.addComponent("render", {
      type: "asset",
      meshInstances: [meshInstance],
      castShadows: false,
      receiveShadows: false,
      layers: [pc.LAYERID_WORLD]
    });
    this.app.root.addChild(plane);
    this.oceanPlane = plane;
  }

  private updateFrame(dt: number): void {
    if (!this.ready && !this.oceanMaterial) return;
    if (this.running && !this.options.reducedMotion) {
      const frameDelta = Math.min(dt, .1);
      this.introElapsed = Math.min(INTRO_DURATION, this.introElapsed + frameDelta);
      this.sceneElapsed += frameDelta;
    }
    const renderTime = this.options.reducedMotion ? STATIC_REDUCED_TIME : this.sceneElapsed;
    const introTime = this.options.reducedMotion ? INTRO_DURATION : this.introElapsed;
    const shouldRender = this.shouldRenderFrame(dt, introTime);
    const phase = phaseForTime(introTime);
    this.updateEnvironment(renderTime);
    this.updateCamera(introTime);
    this.updateFloatingBodies(renderTime);
    this.updateLocalLights(introTime, renderTime);
    this.scheduleRenderPassUpdates(dt, introTime, shouldRender);
    this.updateOceanUniforms(renderTime, introTime);
    this.projectNodeControls();
    if (phase !== this.lastPhase) this.lastPhase = phase;
    if (this.host) {
      this.host.dataset.introPhase = phase;
      this.host.classList.toggle("is-journal-ready", this.options.reducedMotion || introTime >= 4.6);
      this.host.style.setProperty("--voyage-intro", (introTime / INTRO_DURATION).toFixed(4));
      this.host.style.setProperty("--oasis-ghost", clamp01(this.oasisGhostStrength).toFixed(4));
      this.host.dataset.environmentPhase = this.environmentState.phase;
      this.host.dataset.evidencePlacement = this.portrait ? "bottom-drawer" : "right-rail";
    }
    if (shouldRender) this.app.renderNextFrame = true;
  }

  /**
   * The water and bodies still advance with the engine update, but an
   * interaction scene made of a slow ocean cycle does not need to submit the
   * full PBR + post stack at the browser's maximum refresh rate. Keeping the
   * cinematic hand-off at its native cadence while pacing the settled scene
   * leaves every authored effect in place and releases substantial GPU time.
   */
  private shouldRenderFrame(dt: number, introTime: number): boolean {
    if (dt === 0 || this.forceRenderRequested) {
      this.forceRenderRequested = false;
      this.renderAccumulator = 0;
      return true;
    }
    if (!this.running || this.options.reducedMotion) return false;
    const transitionActive = this.transitionProgress > .01 && this.transitionProgress < .99;
    const cinematic = introTime < INTRO_DURATION || transitionActive;
    const targetFps = cinematic
      ? this.qualityTier === "high" ? 60 : this.qualityTier === "balanced" ? 45 : 30
      : this.evidenceOpen
        ? this.qualityTier === "high" ? 30 : 24
        : this.qualityTier === "high" ? 45 : this.qualityTier === "balanced" ? 36 : 30;
    const interval = 1 / targetFps;
    this.renderAccumulator += Math.min(.25, Math.max(0, dt));
    if (this.renderAccumulator + .00001 < interval) return false;
    this.renderAccumulator %= interval;
    return true;
  }

  private scheduleRenderPassUpdates(dt: number, introTime: number, willRender: boolean): void {
    if (!willRender) {
      if (this.reflectionCamera?.camera) this.reflectionCamera.camera.enabled = false;
      const sunLight = this.sunLight?.light;
      if (sunLight?.castShadows) sunLight.shadowUpdateMode = pc.SHADOWUPDATE_NONE;
      return;
    }
    const transitionActive = this.transitionProgress > .01 && this.transitionProgress < .99;
    const cinematic = introTime < INTRO_DURATION || transitionActive;
    this.reflectionUpdateInterval = cinematic
      ? this.qualityTier === "high" ? 2 : this.qualityTier === "balanced" ? 3 : 1
      : this.qualityTier === "high" ? 4 : this.qualityTier === "balanced" ? 5 : 1;
    this.shadowUpdateInterval = cinematic
      ? this.qualityTier === "high" ? 2 : this.qualityTier === "balanced" ? 3 : 1
      : this.qualityTier === "high" ? 4 : this.qualityTier === "balanced" ? 5 : 1;

    const canAnimate = this.running && !this.options.reducedMotion;
    const forceFrame = dt === 0;
    const shouldUpdateReflection = forceFrame || this.reflectionNeedsUpdate
      || (canAnimate && this.renderPassFrame % this.reflectionUpdateInterval === 0);
    const reflectionCamera = this.reflectionCamera?.camera;
    if (reflectionCamera && this.reflectionMode === "planar" && this.reflectionTarget) {
      reflectionCamera.enabled = shouldUpdateReflection;
      if (shouldUpdateReflection) {
        this.reflectionNeedsUpdate = false;
        this.reflectionUpdates += 1;
      }
    } else if (reflectionCamera) {
      reflectionCamera.enabled = false;
    }

    const shouldUpdateShadow = forceFrame || this.shadowNeedsUpdate
      || (canAnimate && this.renderPassFrame % this.shadowUpdateInterval === 0);
    const sunLight = this.sunLight?.light;
    if (sunLight?.castShadows) {
      sunLight.shadowUpdateMode = shouldUpdateShadow ? pc.SHADOWUPDATE_THISFRAME : pc.SHADOWUPDATE_NONE;
      if (shouldUpdateShadow) {
        this.shadowNeedsUpdate = false;
        this.shadowUpdates += 1;
      }
    }

    this.renderPassFrame += 1;
  }

  private updateEnvironment(sceneTime: number): void {
    const state = sampleEnvironment(sceneTime, this.environmentState);
    const transition = this.transitionProgress;
    const sunStrength = state.sunStrength * (1 - transition * .94);
    const moonStrength = lerp(state.moonStrength, .82, transition);
    const nightBalance = clamp01(moonStrength / Math.max(.25, sunStrength + moonStrength));

    this.app.scene.ambientLight.set(
      lerp(state.ambientColor.r, .045, transition) * state.ambientStrength,
      lerp(state.ambientColor.g, .095, transition) * state.ambientStrength,
      lerp(state.ambientColor.b, .165, transition) * state.ambientStrength
    );
    this.app.scene.exposure = lerp(state.exposure, 1.12, transition) + (this.qualityTier === "low" ? .06 : 0);
    this.app.scene.skyboxIntensity = lerp(.38, .20, nightBalance);

    if (this.sunLight?.light) {
      this.sunLight.light.color = state.sunColor;
      this.sunLight.light.intensity = sunStrength;
      this.sunLight.setLocalEulerAngles(90 - state.sunElevation, state.sunAzimuth + 90, -8);
    }
    if (this.moonLight?.light) {
      this.moonLight.light.color = state.moonColor;
      this.moonLight.light.intensity = moonStrength;
      this.moonLight.setLocalEulerAngles(90 - state.moonElevation, state.moonAzimuth + 90, 0);
    }
    if (this.camera?.camera) {
      this.camera.camera.clearColor.set(
        lerp(state.fogColor.r * .20, .006, transition),
        lerp(state.fogColor.g * .30, .028, transition),
        lerp(state.fogColor.b * .34, .058, transition),
        1
      );
    }

    writeVec3Uniform(this.sunDirectionUniform, state.sunDirection);
    writeVec3Uniform(this.moonDirectionUniform, state.moonDirection);
    writeColorUniform(this.sunColorUniform, state.sunColor);
    writeColorUniform(this.moonColorUniform, state.moonColor);
    writeColorUniform(this.ambientColorUniform, state.ambientColor);
    writeColorUniform(this.fogColorUniform, state.fogColor);
    writeColorUniform(this.waterDeepUniform, state.waterDeep);
    writeColorUniform(this.waterMidUniform, state.waterMid);
    writeColorUniform(this.waterHighlightUniform, state.waterHighlight);
    this.lighthouseColorUniform[0] = lerp(1.0, .68, nightBalance);
    this.lighthouseColorUniform[1] = lerp(.86, .82, nightBalance);
    this.lighthouseColorUniform[2] = lerp(.62, 1.0, nightBalance);

    if (this.oceanMaterial) {
      this.oceanMaterial.setParameter("uEnvironmentCycle", state.cycleElapsed);
      this.oceanMaterial.setParameter("uSunDirection", this.sunDirectionUniform);
      this.oceanMaterial.setParameter("uSunColor", this.sunColorUniform);
      this.oceanMaterial.setParameter("uSunStrength", sunStrength);
      this.oceanMaterial.setParameter("uMoonDirection", this.moonDirectionUniform);
      this.oceanMaterial.setParameter("uMoonColor", this.moonColorUniform);
      this.oceanMaterial.setParameter("uMoonStrength", moonStrength);
      this.oceanMaterial.setParameter("uAmbientColor", this.ambientColorUniform);
      this.oceanMaterial.setParameter("uFogColor", this.fogColorUniform);
      this.oceanMaterial.setParameter("uWaterDeep", this.waterDeepUniform);
      this.oceanMaterial.setParameter("uWaterMid", this.waterMidUniform);
      this.oceanMaterial.setParameter("uWaterHighlight", this.waterHighlightUniform);
      this.oceanMaterial.setParameter("uSunReflectionStrength", state.sunReflectionStrength * (1 - transition));
      this.oceanMaterial.setParameter("uMoonReflectionStrength", lerp(state.moonReflectionStrength, .82, transition));
      this.oceanMaterial.setParameter("uRouteSpectrumStrength", lerp(state.routeSpectrumStrength, .92, transition));
      this.oceanMaterial.setParameter("uLighthouseColor", this.lighthouseColorUniform);
      this.oceanMaterial.setParameter("uLighthouseBeamStrength", state.lighthouseStrength);
    }
  }

  private updateCamera(introTime: number): void {
    if (!this.camera || !this.reflectionCamera) return;
    const layout = this.portrait ? PORTRAIT_LAYOUT : DESKTOP_LAYOUT;
    const baseTargetX = this.portrait ? 0 : -1.4;
    const baseTargetZ = this.portrait ? 1.62 : 0;
    const survey = smoothstep(1.2, 2.3, introTime) * (1 - smoothstep(2.7, 4.1, introTime));
    const selectedAnchor = layout[this.selectedNode];
    const focusStrength = introTime >= INTRO_DURATION ? .065 : 0;
    this.cameraTarget.set(
      baseTargetX + survey * .55 + selectedAnchor[0] * focusStrength,
      0,
      baseTargetZ - survey * .38 + selectedAnchor[2] * focusStrength
    );
    const cameraHeight = this.portrait ? 18 : 17;
    const cameraForward = this.portrait ? 5.1 : 4.8;
    const lateralOffset = this.portrait ? 0 : 1.4;
    this.mainCameraPosition.set(this.cameraTarget.x + lateralOffset, cameraHeight, this.cameraTarget.z + cameraForward);
    this.camera.setPosition(this.mainCameraPosition);
    this.camera.lookAt(this.cameraTarget);
    const horizontalDistance = Math.hypot(lateralOffset, cameraForward);
    this.cameraPitch = Math.atan2(cameraHeight, horizontalDistance) * RAD_TO_DEG;

    this.reflectionCameraPosition.set(this.mainCameraPosition.x, -this.mainCameraPosition.y, this.mainCameraPosition.z);
    this.reflectionCamera.setPosition(this.reflectionCameraPosition);
    this.reflectionCamera.lookAt(this.cameraTarget);
    this.cameraWorldUniform[0] = this.mainCameraPosition.x;
    this.cameraWorldUniform[1] = this.mainCameraPosition.y;
    this.cameraWorldUniform[2] = this.mainCameraPosition.z;
  }

  private updateFloatingBodies(time: number): void {
    this.floatingBodies.forEach((body) => {
      const profile = body.profile;
      let height = 0;
      let normalX = 0;
      let normalY = 0;
      let normalZ = 0;
      let crest = 0;
      let maximumWaterHeight = -Infinity;
      const radians = body.baseYaw / RAD_TO_DEG;
      const cosYaw = Math.cos(radians);
      const sinYaw = Math.sin(radians);
      for (const point of profile.buoyancyPoints) {
        const rotatedX = point.x * cosYaw - point.y * sinYaw;
        const rotatedZ = point.x * sinYaw + point.y * cosYaw;
        const sample = this.sampleWave(body.anchor.x + rotatedX, body.anchor.z + rotatedZ, time - profile.responseLag);
        height += sample.height;
        normalX += sample.normal.x;
        normalY += sample.normal.y;
        normalZ += sample.normal.z;
        crest += sample.crestStrength;
        maximumWaterHeight = Math.max(maximumWaterHeight, sample.height);
      }
      const count = Math.max(1, profile.buoyancyPoints.length);
      height /= count;
      normalX /= count;
      normalY /= count;
      normalZ /= count;
      crest /= count;
      const dampingResponse = 1 - profile.damping * .18;
      const state = body.state;
      state.height = height * profile.heaveResponse * dampingResponse;
      state.pitch = Math.atan2(normalZ, Math.max(.001, normalY)) * RAD_TO_DEG * profile.pitchResponse * dampingResponse;
      state.roll = -Math.atan2(normalX, Math.max(.001, normalY)) * RAD_TO_DEG * profile.rollResponse * dampingResponse;
      const [pitchLimit, rollLimit] = BODY_ROTATION_LIMITS[body.id];
      state.pitch = clampRange(state.pitch, -pitchLimit, pitchLimit);
      state.roll = clampRange(state.roll, -rollLimit, rollLimit);
      state.contactStrength = clamp01(.78 + (1 - Math.abs(height) * 1.6) * .2);
      state.reflectionStrength = profile.reflectionScale * (.72 + crest * .28);
      state.modelWaterlineOffset = profile.modelWaterlineOffset;
      state.waterMeanLevel = height;
      const referenceHeight = body.id === "boat" ? body.modelHeight * .435 : body.modelHeight;
      state.submergedFraction = clamp01(
        Math.max(0, maximumWaterHeight - (state.height + profile.modelWaterlineOffset)) / Math.max(.08, referenceHeight)
      );
      state.crestStrength = crest;
      const heading = body.id === "boat" ? this.boatHeading * RAD_TO_DEG : 0;
      body.root.setLocalPosition(body.anchor.x, state.height, body.anchor.z);
      body.root.setLocalEulerAngles(state.pitch, body.baseYaw + heading, state.roll);
      Object.assign(this.floatingStates[body.id], state);
    });

    for (const id of BODY_ORDER) {
      if (this.floatingBodies.has(id)) continue;
      const anchor = (this.portrait ? PORTRAIT_LAYOUT : DESKTOP_LAYOUT)[id];
      const sample = this.sampleWave(anchor[0], anchor[2], time - BODY_PROFILES[id].responseLag);
      const profile = BODY_PROFILES[id];
      const state = this.floatingStates[id];
      state.height = sample.height * profile.heaveResponse;
      state.pitch = Math.atan2(sample.normal.z, sample.normal.y) * RAD_TO_DEG * profile.pitchResponse;
      state.roll = -Math.atan2(sample.normal.x, sample.normal.y) * RAD_TO_DEG * profile.rollResponse;
      const [pitchLimit, rollLimit] = BODY_ROTATION_LIMITS[id];
      state.pitch = clampRange(state.pitch, -pitchLimit, pitchLimit);
      state.roll = clampRange(state.roll, -rollLimit, rollLimit);
      state.contactStrength = .82;
      state.reflectionStrength = profile.reflectionScale * (.72 + sample.crestStrength * .28);
      state.modelWaterlineOffset = profile.modelWaterlineOffset;
      state.waterMeanLevel = sample.height;
      state.submergedFraction = id === "boat" ? .18 : 0;
      state.crestStrength = sample.crestStrength;
    }
    let meanWater = 0;
    for (const id of BODY_ORDER) meanWater += this.floatingStates[id].waterMeanLevel;
    this.waterMeanLevel = meanWater / BODY_ORDER.length;
  }

  private updateLocalLights(introTime: number, sceneTime: number): void {
    const state = this.environmentState;
    const daylight = clamp01(state.sunStrength / 1.55);
    const transitionedSun = state.sunStrength * (1 - this.transitionProgress * .94);
    const transitionedMoon = lerp(state.moonStrength, .82, this.transitionProgress);
    const nightBalance = clamp01(transitionedMoon / Math.max(.25, transitionedSun + transitionedMoon));
    const ghostEnvelope = smoothstep(.34, .78, nightBalance);
    const ghostPulse = this.options.reducedMotion
      ? 1
      : .93 + Math.sin(sceneTime * .71) * .045 + Math.sin(sceneTime * 1.93 + .8) * .025;
    this.oasisGhostStrength = ghostEnvelope * ghostPulse;
    const localLightBalance = .28 + (1 - daylight) * .92;
    if (this.harborLight?.light) {
      this.harborLight.light.intensity = localLightBalance * 1.22 * clamp01((introTime - 3.35) / 1.15);
    }
    const harborBody = this.floatingBodies.get("eva01");
    if (harborBody && this.harborLight) {
      const position = harborBody.root.getPosition();
      this.harborLight.setPosition(position.x, position.y + 1.2, position.z);
    }
    const gateBody = this.floatingBodies.get("world");
    if (gateBody && this.gateLight) {
      const position = gateBody.root.getPosition();
      this.gateLight.setPosition(position.x, position.y + 1.5, position.z);
      if (this.gateLight.light) {
        const selectedBoost = this.selectedNode === "world" ? 1.24 : 1;
        this.gateLight.light.intensity = (.20 + this.oasisGhostStrength * 4.25) * selectedBoost;
        this.gateLight.light.range = 3.8 + this.oasisGhostStrength * 3.2;
      }
    }
    const gateModel = this.models.get("world");
    if (gateModel) {
      const selectedBoost = this.selectedNode === "world" ? 1.16 : 1;
      const materialGlow = clamp01(this.oasisGhostStrength * selectedBoost);
      // `material.update()` invalidates a material program. The gate's glow
      // changes slowly, so keep its continuous pulse while only committing
      // the expensive material refresh when the visible value changed.
      if (!Number.isFinite(this.lastGateMaterialGlow) || Math.abs(materialGlow - this.lastGateMaterialGlow) >= .008) {
        gateModel.materials.forEach((material) => {
          material.emissive.set(
            lerp(.018, .055, materialGlow),
            lerp(.085, 1.0, materialGlow),
            lerp(.035, .28, materialGlow)
          );
          material.emissiveIntensity = lerp(.24, 3.65, materialGlow);
          material.update();
        });
        this.lastGateMaterialGlow = materialGlow;
      }
    }
    const lighthouseBody = this.floatingBodies.get("directl");
    const lighthouseLayout = (this.portrait ? PORTRAIT_LAYOUT : DESKTOP_LAYOUT).directl;
    const lighthouseX = lighthouseBody?.anchor.x ?? lighthouseLayout[0];
    const lighthouseZ = lighthouseBody?.anchor.z ?? lighthouseLayout[2];
    const scanTime = this.options.reducedMotion ? STATIC_REDUCED_TIME : sceneTime;
    const scanAngle = scanTime / 18 * Math.PI * 2 + .42;
    const directionX = Math.cos(scanAngle);
    const directionZ = Math.sin(scanAngle);
    this.lighthouseOriginUniform[0] = lighthouseX;
    this.lighthouseOriginUniform[1] = lighthouseZ;
    this.lighthouseDirectionUniform[0] = directionX;
    this.lighthouseDirectionUniform[1] = directionZ;
    const introReveal = .28 + smoothstep(1.6, 3.9, introTime) * .72;
    const beamStrength = state.lighthouseStrength * introReveal;

    if (lighthouseBody && this.lighthouseRig) {
      const worldYaw = Math.atan2(directionX, directionZ) * RAD_TO_DEG;
      this.lighthouseRig.setLocalEulerAngles(0, worldYaw - lighthouseBody.baseYaw, 0);
    }
    if (this.lighthouseLight) {
      if (this.lighthouseRig) {
        const rigPosition = this.lighthouseRig.getPosition();
        this.lighthouseWorldScratch.copy(rigPosition);
      } else {
        this.lighthouseWorldScratch.set(lighthouseX, (lighthouseBody?.state.height ?? 0) + 2.35, lighthouseZ);
      }
      this.lighthouseTargetScratch.set(
        lighthouseX + directionX * 5.9,
        this.sampleWave(lighthouseX + directionX * 5.9, lighthouseZ + directionZ * 5.9, sceneTime).height + .035,
        lighthouseZ + directionZ * 5.9
      );
      this.lighthouseLight.setPosition(this.lighthouseWorldScratch);
      this.lighthouseLight.lookAt(this.lighthouseTargetScratch);
      this.lighthouseLight.rotateLocal(90, 0, 0);
      if (this.lighthouseLight.light) {
        this.lighthouseLight.light.color.set(this.lighthouseColorUniform[0], this.lighthouseColorUniform[1], this.lighthouseColorUniform[2]);
        this.lighthouseLight.light.intensity = beamStrength * 2.60;
      }
    }
    if (this.lighthouseBeamMaterial) {
      this.lighthouseBeamMaterial.setParameter("uBeamColor", this.lighthouseColorUniform);
      this.lighthouseBeamMaterial.setParameter("uBeamStrength", beamStrength);
      this.lighthouseBeamMaterial.setParameter("uBeamTime", sceneTime);
    }
    if (this.lighthouseBeamVolume) {
      this.lighthouseBeamVolume.enabled = beamStrength > .025;
    }
    this.oceanMaterial?.setParameter("uLighthouseOrigin", this.lighthouseOriginUniform);
    this.oceanMaterial?.setParameter("uLighthouseDirection", this.lighthouseDirectionUniform);
    this.oceanMaterial?.setParameter("uLighthouseBeamStrength", beamStrength);
    this.oceanMaterial?.setParameter("uOasisGhostStrength", this.oasisGhostStrength);
  }

  private updateOceanUniforms(time: number, introTime: number): void {
    if (!this.oceanMaterial) return;
    this.oceanMaterial.setParameter("uTime", time);
    this.oceanMaterial.setParameter("uIntro", introTime);
    this.oceanMaterial.setParameter("uTransition", this.transitionProgress);
    this.oceanMaterial.setParameter("uSelected", Math.max(0, this.options.nodes.findIndex((node) => node.id === this.selectedNode)));
    this.oceanMaterial.setParameter("uCameraWorld", this.cameraWorldUniform);
    this.oceanMaterial.setParameter("uReflectionEnabled", this.reflectionMode === "planar" ? 1 : 0);

    const layout = this.portrait ? PORTRAIT_LAYOUT : DESKTOP_LAYOUT;
    const routeIds: VoyageNodeId[] = ["docdiff", "neural", "directl", "eva01", "world"];
    routeIds.forEach((id, index) => {
      this.routeUniforms[index][0] = layout[id][0];
      this.routeUniforms[index][1] = layout[id][2];
      this.oceanMaterial!.setParameter(`uRoute${index}`, this.routeUniforms[index]);
    });

    BODY_ORDER.forEach((id, index) => {
      const body = this.floatingBodies.get(id);
      const fallbackAnchor = layout[id];
      const profile = BODY_PROFILES[id];
      const state = this.floatingStates[id];
      const bodyUniform = this.bodyUniforms[index].body;
      const stateUniform = this.bodyUniforms[index].state;
      bodyUniform[0] = body?.anchor.x ?? fallbackAnchor[0];
      bodyUniform[1] = body?.anchor.z ?? fallbackAnchor[2];
      bodyUniform[2] = profile.foamRadius;
      bodyUniform[3] = state.reflectionStrength;
      stateUniform[0] = state.contactStrength;
      stateUniform[1] = id === this.selectedNode || id === "boat" ? 1 : 0;
      stateUniform[2] = .55 + state.crestStrength * .45;
      stateUniform[3] = 1;
      this.oceanMaterial!.setParameter(`uBody${index}`, bodyUniform);
      this.oceanMaterial!.setParameter(`uBodyState${index}`, stateUniform);
    });

    if (this.reflectionCamera?.camera) {
      this.reflectionMatrix.mul2(this.reflectionCamera.camera.projectionMatrix, this.reflectionCamera.camera.viewMatrix);
      this.oceanMaterial.setParameter("uReflectionMatrix", this.reflectionMatrix.data);
    }
  }

  private sampleWave(worldX: number, worldZ: number, time: number): WaveSample {
    let height = 0;
    let slopeX = 0;
    let slopeZ = 0;
    let velocityX = 0;
    let velocityZ = 0;
    let crest = 0;
    let totalAmplitude = 0;
    for (const wave of WAVE_COMPONENTS) {
      const length = Math.hypot(wave.direction[0], wave.direction[1]) || 1;
      const dx = wave.direction[0] / length;
      const dz = wave.direction[1] / length;
      const k = Math.PI * 2 / wave.wavelength;
      const phase = (worldX * dx + worldZ * dz) * k + time * wave.speed;
      const sine = Math.sin(phase);
      const cosine = Math.cos(phase);
      height += sine * wave.amplitude;
      slopeX += dx * k * wave.amplitude * cosine;
      slopeZ += dz * k * wave.amplitude * cosine;
      velocityX += -dx * sine * wave.amplitude * wave.speed * wave.steepness;
      velocityZ += -dz * sine * wave.amplitude * wave.speed * wave.steepness;
      crest += Math.max(0, sine) * wave.amplitude;
      totalAmplitude += wave.amplitude;
    }
    this.waveSampleNormal.set(-slopeX, 1, -slopeZ).normalize();
    this.waveSampleVelocity.set(velocityX, velocityZ);
    this.waveSampleScratch.height = height;
    this.waveSampleScratch.crestStrength = clamp01(crest / Math.max(.001, totalAmplitude));
    return this.waveSampleScratch;
  }

  private async loadSceneAssets(): Promise<void> {
    const [v3Manifest, v2Manifest] = await Promise.all([
      this.loadLandmarkManifest(V3_MANIFEST_URL),
      this.loadLandmarkManifest(V2_MANIFEST_URL)
    ]);
    const priorityNodes = [
      this.options.nodes.find((node) => node.id === this.selectedNode),
      ...this.options.nodes
    ].filter((node, index, nodes): node is VoyageNode => Boolean(node) && nodes.indexOf(node) === index);

    // The boat and active berth are the first assets users can meaningfully
    // inspect. They are installed first, then the remaining islands arrive
    // through the already-authored poster placeholders over later idle slices.
    await this.loadBoat();
    await this.yieldForAssetSlice();
    for (const node of priorityNodes) {
      await this.loadLandmark(node, v3Manifest, v2Manifest);
      await this.yieldForAssetSlice();
    }

    // Environment convolution is another heavy GPU allocation. Put it after
    // model streaming so it cannot overlap a GLB parse or scene interaction.
    try {
      this.applyEnvironment(await this.loadTexture(STUDIO_HDR_URL));
    } catch (error) {
      console.warn("Voyage environment texture fallback active", error);
    }
    this.positionSceneElements();
    this.selectNode(this.selectedNode);
    this.updateFrame(0);
    this.assetsReady = true;
    this.app.renderNextFrame = true;
  }

  private yieldForAssetSlice(): Promise<void> {
    return new Promise((resolve) => {
      const idleWindow = window as Window & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      };
      if (idleWindow.requestIdleCallback) {
        idleWindow.requestIdleCallback(resolve, { timeout: 180 });
        return;
      }
      requestAnimationFrame(() => window.setTimeout(resolve, 0));
    });
  }

  private async loadLandmarkManifest(url: string): Promise<Record<string, string>> {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return {};
      const manifest = await response.json() as { assets?: Record<string, string> };
      return manifest.assets ?? {};
    } catch {
      return {};
    }
  }

  private landmarkAssetUrl(version: "v2" | "v3", path: string): string {
    return path.startsWith("/") ? path : `/assets/voyage/models/landmarks/${version}/${path}`;
  }

  private async loadLandmark(
    node: VoyageNode,
    v3Manifest: Record<string, string>,
    v2Manifest: Record<string, string>
  ): Promise<void> {
    const kind = node.landmark;
    const config = LANDMARK_CONFIG[kind];
    const v3Path = v3Manifest[kind];
    const v2Path = v2Manifest[kind];
    let resource: pc.ContainerResource | null = null;
    let state: VoyageLandmarkAssetState = "poster";
    if (v3Path) {
      try {
        resource = await this.loadContainer(this.landmarkAssetUrl("v3", v3Path), OPTIONAL_LOD_TIMEOUT_MS);
        state = "v3-lod";
      } catch (error) {
        console.warn(`Voyage ${kind} v3 LOD fallback active`, error);
      }
    }
    if (v2Path) {
      if (!resource) {
        try {
          resource = await this.loadContainer(this.landmarkAssetUrl("v2", v2Path));
          state = "v2";
        } catch (error) {
          console.warn(`Voyage ${kind} v2 asset fallback active`, error);
        }
      }
    }
    if (!resource) {
      try {
        resource = await this.loadContainer(config.v1Url);
        state = "v1-fallback";
      } catch (error) {
        console.warn(`Voyage ${kind} poster fallback active`, error);
      }
    }
    this.landmarkAssets[kind] = state;
    const button = this.host?.querySelector<HTMLElement>(`[data-voyage-node="${node.id}"]`);
    button?.classList.toggle("is-model-ready", Boolean(resource));
    button?.classList.toggle("is-poster-fallback", !resource);
    button?.setAttribute("data-asset-state", state);
    if (!resource) return;
    const installed = this.installNormalizedModel(
      resource,
      node.id,
      node,
      state === "v3-lod" || state === "v2" ? config.v2WorldHeight : config.worldHeight,
      config.yaw,
      `${kind}-floating-landmark`,
      kind,
      state === "v3-lod" || state === "v2"
    );
    this.models.set(node.id, installed);
  }

  private async loadBoat(): Promise<void> {
    let resource: pc.ContainerResource | null = null;
    let state: VoyageBoatAssetState = "procedural";
    for (const source of BOAT_MODEL_SOURCES) {
      try {
        resource = await this.loadContainer(source.url, source.timeoutMs);
        state = source.label;
        break;
      } catch (error) {
        console.warn(`Voyage research vessel ${source.label} fallback active`, error);
      }
    }
    if (!resource) {
      this.createProceduralBoatFallback();
      return;
    }
    try {
      const installed = this.installNormalizedModel(resource, "boat", null, 1.55, 90, "eva01-current-research-vessel", null, false);
      this.boat = installed.body.root;
      this.boatAsset = state;
      this.boatMaterials = installed.materials;
      this.boatMaterials.forEach((material) => {
        material.diffuse = new pc.Color(.86, .76, .55);
        material.emissive = new pc.Color(.018, .011, .004);
        material.emissiveIntensity = .32;
        material.update();
      });
      this.boat.name = "luminous-wake-research-vessel";
      this.host?.classList.add("is-voyage-boat-ready");
    } catch (error) {
      console.warn("Voyage research vessel model fallback active", error);
      this.createProceduralBoatFallback();
    }
  }

  private installNormalizedModel(
    resource: pc.ContainerResource,
    bodyId: FloatingBodyId,
    node: VoyageNode | null,
    worldHeight: number,
    yaw: number,
    name: string,
    kind: LandmarkKind | null,
    brightenTexture: boolean
  ): InstalledModel {
    const wrapper = new pc.Entity(name);
    const normalized = new pc.Entity(`${name}-normalized`);
    const shadowEnabled = this.qualityTier !== "low";
    const model = resource.instantiateRenderEntity({ castShadows: shadowEnabled, receiveShadows: shadowEnabled });
    normalized.addChild(model);
    wrapper.addChild(normalized);
    this.sceneRoot.addChild(wrapper);
    model.syncHierarchy();
    const bounds = this.collectBounds(model);
    const height = Math.max(bounds.halfExtents.y * 2, .0001);
    model.setLocalPosition(-bounds.center.x, -(bounds.center.y - bounds.halfExtents.y), -bounds.center.z);
    const fit = worldHeight / height;
    const profile = BODY_PROFILES[bodyId];
    normalized.setLocalScale(fit, fit, fit);
    normalized.setLocalPosition(0, profile.modelWaterlineOffset, 0);
    const worldWidth = Math.max(.28, bounds.halfExtents.x * 2 * fit);
    const worldDepth = Math.max(.22, bounds.halfExtents.z * 2 * fit);
    const foundationRoot = kind ? this.createFoundation(wrapper, kind, worldWidth, worldDepth, profile.foundationDraft) : null;
    const materials: pc.StandardMaterial[] = [];
    model.findComponents("render").forEach((component) => {
      const render = component as pc.RenderComponent;
      render.castShadows = shadowEnabled;
      render.receiveShadows = shadowEnabled;
      render.layers = this.modelLayerIds();
      render.meshInstances.forEach((meshInstance) => {
        const source = meshInstance.material as pc.StandardMaterial;
        const material = source.clone();
        material.name = `${source.name || name}.floating-archipelago`;
        if (brightenTexture) material.diffuse = new pc.Color(1.14, 1.11, 1.04);
        if (brightenTexture && node?.id === "world") material.emissiveMap = material.diffuseMap;
        material.emissive = new pc.Color(0, 0, 0);
        material.emissiveIntensity = 0;
        material.useMetalness = true;
        material.metalness = Math.max(material.metalness, kind === "harbor" || kind === "gate" ? .28 : .08);
        material.gloss = Math.max(material.gloss, kind === "reef" ? .24 : .38);
        material.update();
        meshInstance.material = material;
        meshInstance.castShadow = shadowEnabled;
        meshInstance.receiveShadow = shadowEnabled;
        materials.push(material);
      });
    });
    const anchorTuple = (this.portrait ? PORTRAIT_LAYOUT : DESKTOP_LAYOUT)[bodyId];
    const state = this.floatingStates[bodyId];
    const body: FloatingBody = {
      id: bodyId,
      root: wrapper,
      visualRoot: normalized,
      foundationRoot,
      anchor: new pc.Vec3(...anchorTuple),
      baseYaw: yaw,
      profile,
      state,
      labelHeight: worldHeight * .45,
      modelHeight: worldHeight
    };
    this.floatingBodies.set(bodyId, body);
    if (kind === "lighthouse") this.attachLighthouseRig(body);
    return { body, node, materials, baseScale: fit };
  }

  private attachLighthouseRig(body: FloatingBody): void {
    if (this.lighthouseRig) return;
    const lanternHeight = body.modelHeight + body.profile.modelWaterlineOffset - .08;
    const rig = new pc.Entity("light-field-lighthouse-searchlight-rig");
    rig.setLocalPosition(0, lanternHeight, 0);
    body.root.addChild(rig);

    const geometry = new pc.Geometry();
    geometry.positions = [
      0, 0, 0,
      -.38, -lanternHeight + .045, 5.9,
      .38, -lanternHeight + .045, 5.9
    ];
    geometry.uvs = [.5, 0, 0, 1, 1, 1];
    geometry.indices = [0, 1, 2];
    const mesh = pc.Mesh.fromGeometry(this.app.graphicsDevice, geometry);
    const material = new pc.ShaderMaterial({
      uniqueName: "LuminousWakeLighthouseVolumeV1",
      attributes: { aPosition: pc.SEMANTIC_POSITION, aUv0: pc.SEMANTIC_TEXCOORD0 },
      vertexGLSL: lighthouseBeamVertexGLSL,
      fragmentGLSL: lighthouseBeamFragmentGLSL
    });
    material.blendType = pc.BLEND_ADDITIVE;
    material.depthWrite = false;
    material.cull = pc.CULLFACE_NONE;
    material.setParameter("uBeamColor", this.lighthouseColorUniform);
    material.setParameter("uBeamStrength", this.environmentState.lighthouseStrength);
    material.setParameter("uBeamTime", this.sceneElapsed);
    material.update();
    const meshInstance = new pc.MeshInstance(mesh, material);
    const volume = new pc.Entity("light-field-lighthouse-pixel-volume");
    volume.addComponent("render", {
      type: "asset",
      meshInstances: [meshInstance],
      castShadows: false,
      receiveShadows: false,
      layers: [pc.LAYERID_WORLD]
    });
    rig.addChild(volume);
    this.lighthouseLight?.reparent(rig);
    this.lighthouseLight?.setLocalPosition(0, 0, 0);
    this.lighthouseRig = rig;
    this.lighthouseBeamVolume = volume;
    this.lighthouseBeamMaterial = material;
  }

  private createFoundation(parent: pc.Entity, kind: LandmarkKind, width: number, depth: number, draft: number): pc.Entity {
    const foundationRoot = new pc.Entity(kind + "-foundation-root");
    parent.addChild(foundationRoot);
    const baseMaterial = new pc.StandardMaterial();
    baseMaterial.name = `${kind}-submerged-foundation`;
    baseMaterial.diffuse = kind === "dock"
      ? new pc.Color(.13, .065, .028)
      : kind === "reef"
        ? new pc.Color(.035, .08, .09)
        : new pc.Color(.055, .075, .078);
    baseMaterial.metalness = kind === "harbor" || kind === "gate" ? .48 : .18;
    baseMaterial.gloss = .31;
    baseMaterial.update();
    const wetMaterial = baseMaterial.clone();
    wetMaterial.name = `${kind}-wet-waterline`;
    wetMaterial.diffuse = kind === "gate" ? new pc.Color(.05, .18, .10) : new pc.Color(.08, .16, .16);
    wetMaterial.emissive = kind === "gate" ? new pc.Color(.015, .13, .05) : new pc.Color(.005, .025, .025);
    wetMaterial.emissiveIntensity = kind === "gate" ? .55 : .18;
    wetMaterial.update();

    const primitive = (name: string, type: "box" | "cylinder", scale: [number, number, number], position: [number, number, number], material = baseMaterial): pc.Entity => {
      const entity = new pc.Entity(name);
      entity.addComponent("render", {
        type,
        material,
        castShadows: this.qualityTier !== "low",
        receiveShadows: this.qualityTier !== "low",
        layers: this.modelLayerIds()
      });
      entity.setLocalScale(...scale);
      entity.setLocalPosition(...position);
      foundationRoot.addChild(entity);
      return entity;
    };

    if (kind === "dock") {
      primitive("dock-main-float", "box", [width * .82, draft * 1.12, depth * .72], [0, -draft * .56, 0]);
      primitive("dock-port-float", "box", [width * .17, draft, depth * .88], [-width * .39, -draft * .58, 0]);
      primitive("dock-starboard-float", "box", [width * .17, draft, depth * .88], [width * .39, -draft * .58, 0]);
      primitive("dock-wet-band", "box", [width * .9, .035, depth * .76], [0, .005, 0], wetMaterial);
    } else if (kind === "reef") {
      primitive("reef-caisson", "cylinder", [width * .52, draft, depth * .52], [0, -draft * .64, 0]);
      primitive("reef-wet-band", "cylinder", [width * .56, .035, depth * .56], [0, .005, 0], wetMaterial);
    } else if (kind === "lighthouse") {
      primitive("lighthouse-caisson", "cylinder", [Math.max(.45, width * .55), draft, Math.max(.45, depth * .55)], [0, -draft * .65, 0]);
      primitive("lighthouse-wet-band", "cylinder", [Math.max(.48, width * .58), .035, Math.max(.48, depth * .58)], [0, .005, 0], wetMaterial);
    } else if (kind === "harbor") {
      primitive("harbor-main-pontoon", "box", [width * .82, draft * .88, depth * .7], [0, -draft * .56, 0]);
      for (const x of [-.42, .42]) for (const z of [-.35, .35]) {
        primitive(`harbor-float-${x}-${z}`, "cylinder", [width * .13, draft, depth * .16], [width * x, -draft * .62, depth * z]);
      }
      primitive("harbor-wet-band", "box", [width * .88, .035, depth * .76], [0, .005, 0], wetMaterial);
    } else {
      primitive("gate-deep-caisson", "box", [width * .7, draft, depth * .76], [0, -draft * .66, 0]);
      primitive("gate-wet-band", "box", [width * .75, .035, depth * .8], [0, .005, 0], wetMaterial);
    }
    return foundationRoot;
  }

  private createProceduralBoatFallback(): void {
    const root = new pc.Entity("luminous-wake-procedural-vessel");
    const visualRoot = new pc.Entity("luminous-wake-procedural-vessel-visual");
    root.addChild(visualRoot);
    const hullMaterial = new pc.StandardMaterial();
    hullMaterial.diffuse = new pc.Color(.21, .11, .055);
    hullMaterial.metalness = .24;
    hullMaterial.gloss = .58;
    hullMaterial.update();
    const sailMaterial = new pc.StandardMaterial();
    sailMaterial.diffuse = new pc.Color(.74, .68, .51);
    sailMaterial.gloss = .23;
    sailMaterial.update();
    const addPart = (name: string, type: "box" | "cylinder", material: pc.StandardMaterial, scale: [number, number, number], position: [number, number, number], rotation?: [number, number, number]): void => {
      const part = new pc.Entity(name);
      part.addComponent("render", { type, material, castShadows: this.qualityTier !== "low", receiveShadows: this.qualityTier !== "low", layers: this.modelLayerIds() });
      part.setLocalScale(...scale);
      part.setLocalPosition(...position);
      if (rotation) part.setLocalEulerAngles(...rotation);
      visualRoot.addChild(part);
    };
    addPart("fallback-vessel-hull", "box", hullMaterial, [1.3, .24, .38], [0, .14, 0]);
    addPart("fallback-vessel-mast", "cylinder", hullMaterial, [.04, .76, .04], [0, .73, 0]);
    addPart("fallback-vessel-sail", "box", sailMaterial, [.62, .56, .025], [.31, .85, 0], [0, 0, -17]);
    visualRoot.setLocalScale(.7, .7, .7);
    visualRoot.setLocalPosition(0, BODY_PROFILES.boat.modelWaterlineOffset, 0);
    this.sceneRoot.addChild(root);
    const anchorTuple = (this.portrait ? PORTRAIT_LAYOUT : DESKTOP_LAYOUT).boat;
    const body: FloatingBody = {
      id: "boat",
      root,
      visualRoot,
      foundationRoot: null,
      anchor: new pc.Vec3(...anchorTuple),
      baseYaw: 90,
      profile: BODY_PROFILES.boat,
      state: this.floatingStates.boat,
      labelHeight: .72,
      modelHeight: 1.1
    };
    this.floatingBodies.set("boat", body);
    this.boat = root;
  }

  private positionSceneElements(): void {
    const layout = this.portrait ? PORTRAIT_LAYOUT : DESKTOP_LAYOUT;
    this.floatingBodies.forEach((body, id) => body.anchor.set(...layout[id]));
    for (let index = 0; index < 5; index++) {
      const id = (["docdiff", "neural", "directl", "eva01", "world"] as VoyageNodeId[])[index];
      this.routeUniforms[index][0] = layout[id][0];
      this.routeUniforms[index][1] = layout[id][2];
      this.oceanMaterial?.setParameter(`uRoute${index}`, this.routeUniforms[index]);
    }
  }

  private projectNodeControls(): void {
    if (!this.camera?.camera || !this.host) return;
    const hostRect = this.host.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();
    const layout = this.portrait ? PORTRAIT_LAYOUT : DESKTOP_LAYOUT;
    this.options.nodes.forEach((node) => {
      const body = this.floatingBodies.get(node.id);
      const anchor = layout[node.id];
      this.projectionWorldScratch.set(
        anchor[0],
        (body?.state.height ?? 0) + (body?.profile.modelWaterlineOffset ?? BODY_PROFILES[node.id].modelWaterlineOffset) + (body?.labelHeight ?? .72) * .12,
        anchor[2]
      );
      const screen = this.camera!.camera!.worldToScreen(this.projectionWorldScratch, this.projectionScreenScratch);
      const cssX = screen.x + canvasRect.left - hostRect.left;
      const cssY = screen.y + canvasRect.top - hostRect.top;
      const button = this.host!.querySelector<HTMLElement>(`[data-voyage-node="${node.id}"]`);
      button?.style.setProperty("--node-x", `${cssX.toFixed(2)}px`);
      button?.style.setProperty("--node-y", `${cssY.toFixed(2)}px`);
      this.projectedNodePositions[node.id][0] = cssX;
      this.projectedNodePositions[node.id][1] = cssY;
    });
  }

  private setupReflectionTarget(): void {
    const shouldUsePlanar = !this.portrait && (this.qualityTier === "high" || this.qualityTier === "balanced");
    if (!shouldUsePlanar || !this.reflectionCamera?.camera || !this.oceanMaterial) {
      this.destroyReflectionTarget();
      this.reflectionMode = "analytic";
      this.oceanMaterial?.setParameter("uReflectionEnabled", 0);
      return;
    }
    const scale = this.qualityTier === "high" ? .5 : .375;
    const width = Math.max(64, Math.round(this.canvas.width * scale));
    const height = Math.max(64, Math.round(this.canvas.height * scale));
    if (this.reflectionTarget?.width === width && this.reflectionTarget.height === height) return;
    this.destroyReflectionTarget();
    try {
      if (window.__forceVoyageReflectionFailure) throw new Error("Forced Voyage reflection target failure");
      const texture = new pc.Texture(this.app.graphicsDevice, {
        name: "Voyage planar reflection",
        width,
        height,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
      });
      const target = new pc.RenderTarget({ name: "Voyage planar reflection target", colorBuffer: texture, depth: true, samples: 1 });
      this.reflectionTexture = texture;
      this.reflectionTarget = target;
      this.reflectionCamera.camera.renderTarget = target;
      this.reflectionCamera.camera.enabled = false;
      this.reflectionNeedsUpdate = true;
      this.oceanMaterial.setParameter("uReflectionTexture", texture);
      this.oceanMaterial.setParameter("uReflectionEnabled", 1);
      this.reflectionMode = "planar";
    } catch (error) {
      console.warn("Voyage planar reflection fallback active", error);
      this.destroyReflectionTarget();
      this.reflectionMode = "analytic";
      this.oceanMaterial.setParameter("uReflectionTexture", this.blankReflectionTexture);
      this.oceanMaterial.setParameter("uReflectionEnabled", 0);
    }
  }

  private destroyReflectionTarget(): void {
    if (this.reflectionCamera?.camera) {
      this.reflectionCamera.camera.enabled = false;
      this.reflectionCamera.camera.renderTarget = null;
    }
    if (this.reflectionTarget) {
      this.reflectionTarget.destroyTextureBuffers();
      this.reflectionTarget.destroy();
    } else this.reflectionTexture?.destroy();
    this.reflectionTarget = null;
    this.reflectionTexture = null;
    this.reflectionNeedsUpdate = true;
    this.oceanMaterial?.setParameter("uReflectionTexture", this.blankReflectionTexture);
  }

  private modelLayerIds(): number[] {
    return this.reflectionLayer ? [pc.LAYERID_WORLD, this.reflectionLayer.id] : [pc.LAYERID_WORLD];
  }

  private collectBounds(root: pc.Entity): pc.BoundingBox {
    const box = new pc.BoundingBox();
    let initialized = false;
    root.findComponents("render").forEach((component) => {
      (component as pc.RenderComponent).meshInstances.forEach((instance) => {
        if (!initialized) {
          box.copy(instance.aabb);
          initialized = true;
        } else box.add(instance.aabb);
      });
    });
    if (!initialized) throw new Error(`No render bounds found for ${root.name}`);
    return box;
  }

  private loadContainer(url: string, timeoutMs?: number): Promise<pc.ContainerResource> {
    const load = new Promise<pc.ContainerResource>((resolve, reject) => {
      this.app.assets.loadFromUrl(url, "container", (error, asset) => {
        if (error || !asset?.resource) reject(error ?? new Error(`Failed to load Voyage model: ${url}`));
        else resolve(asset.resource as pc.ContainerResource);
      });
    });
    if (!timeoutMs) return load;

    // Only v3 LODs use this deadline. PlayCanvas retries failed container
    // requests internally, so without a bound a CDN miss can postpone the
    // already-authored v2 asset and leave a model on its poster longer than
    // necessary. The late request is intentionally ignored once fallback wins.
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error(`Timed out after ${timeoutMs}ms loading optional Voyage LOD: ${url}`));
      }, timeoutMs);
      load.then(
        (resource) => {
          window.clearTimeout(timer);
          resolve(resource);
        },
        (error) => {
          window.clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  private loadTexture(url: string): Promise<pc.Texture> {
    return new Promise((resolve, reject) => {
      this.app.assets.loadFromUrl(url, "texture", (error, asset) => {
        if (error || !asset?.resource) reject(error ?? new Error(`Failed to load Voyage environment: ${url}`));
        else resolve(asset.resource as pc.Texture);
      });
    });
  }

  private applyEnvironment(source: pc.Texture): void {
    const lightingSource = pc.EnvLighting.generateLightingSource(source, { size: 64 });
    this.app.scene.envAtlas = pc.EnvLighting.generateAtlas(lightingSource, { size: 128, numReflectionSamples: 128, numAmbientSamples: 128 });
    this.app.scene.ambientSource = pc.AMBIENTSRC_ENVALATLAS;
    this.app.scene.skybox = null;
    this.app.scene.skyboxIntensity = .28;
    this.app.scene.skyboxMip = 3;
    this.app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, -22, 0);
  }

  private debugState(): VoyageDebugState {
    const intro = this.options.reducedMotion ? INTRO_DURATION : this.introElapsed;
    const floatingBodies = {} as Record<FloatingBodyId, VoyageFloatingBodyDebugState>;
    BODY_ORDER.forEach((id) => {
      const state = this.floatingStates[id];
      floatingBodies[id] = {
        height: state.height,
        pitch: state.pitch,
        roll: state.roll,
        contactStrength: state.contactStrength,
        reflectionStrength: state.reflectionStrength,
        modelWaterlineOffset: state.modelWaterlineOffset,
        submergedFraction: state.submergedFraction
      };
    });
    const projectedNodePositions = {} as Record<VoyageNodeId, [number, number]>;
    this.options.nodes.forEach((node) => {
      projectedNodePositions[node.id] = [...this.projectedNodePositions[node.id]] as [number, number];
    });
    const visibleProjectCount = this.host?.querySelectorAll<HTMLElement>('[data-evidence-eligible="true"]').length ?? 1;
    this.evidenceCount = Math.max(1, visibleProjectCount);
    return {
      ready: this.ready,
      assetsReady: this.assetsReady,
      fallbackActive: !this.ready,
      introPhase: phaseForTime(intro),
      introElapsed: intro,
      selectedNode: this.selectedNode,
      currentStage: HARBOR_NODE,
      evidenceOpen: this.evidenceOpen,
      internalResolution: [this.canvas.width, this.canvas.height],
      wakeStrength: smoothstep(1.2, 3.4, intro),
      reflectionStrength: .58 + smoothstep(3.4, 4.6, intro) * .24,
      boatHeading: this.boatHeading,
      transitionProgress: this.transitionProgress,
      boatAsset: this.boatAsset,
      landmarkAssets: { ...this.landmarkAssets },
      running: this.running,
      cameraPitch: this.cameraPitch,
      cameraProjection: "perspective",
      waterMode: "xz-gerstner",
      reflectionMode: this.reflectionMode,
      reflectionUpdateInterval: this.reflectionUpdateInterval,
      shadowUpdateInterval: this.shadowUpdateInterval,
      reflectionUpdates: this.reflectionUpdates,
      shadowUpdates: this.shadowUpdates,
      floatingBodies,
      projectedNodePositions,
      evidenceIndex: this.evidenceIndex,
      evidenceCount: this.evidenceCount,
      evidencePlacement: this.portrait ? "bottom-drawer" : "right-rail",
      environmentCycleElapsed: this.environmentState.cycleElapsed,
      environmentPhase: this.environmentState.phase,
      sunStrength: this.sunLight?.light?.intensity ?? this.environmentState.sunStrength,
      moonStrength: this.moonLight?.light?.intensity ?? this.environmentState.moonStrength,
      sunDirection: [
        this.environmentState.sunDirection.x,
        this.environmentState.sunDirection.y,
        this.environmentState.sunDirection.z
      ],
      moonDirection: [
        this.environmentState.moonDirection.x,
        this.environmentState.moonDirection.y,
        this.environmentState.moonDirection.z
      ],
      shadowDirection: [
        -this.environmentState.sunDirection.x,
        -this.environmentState.sunDirection.y,
        -this.environmentState.sunDirection.z
      ],
      sunReflectionStrength: this.environmentState.sunReflectionStrength * (1 - this.transitionProgress),
      moonReflectionStrength: lerp(this.environmentState.moonReflectionStrength, .82, this.transitionProgress),
      lighthouseBeamStrength: this.environmentState.lighthouseStrength,
      lighthouseBeamDirection: [this.lighthouseDirectionUniform[0], this.lighthouseDirectionUniform[1]],
      oasisGhostStrength: this.oasisGhostStrength,
      routeSpectrumStrength: lerp(this.environmentState.routeSpectrumStrength, .92, this.transitionProgress),
      waterMeanLevel: this.waterMeanLevel,
      waterLuminance: this.environmentState.waterLuminance
    };
  }
}

declare global {
  interface Window {
    __forceVoyageReflectionFailure?: boolean;
    __voyageDebug?: (() => VoyageDebugState) & {
      skipIntro(): void;
      setIntroTime(seconds: number): void;
      setSceneTime(seconds: number): void;
      selectNode(node: VoyageNodeId): void;
      setEvidenceOpen(open: boolean): void;
      setEvidenceIndex(index: number): void;
      setTransitionProgress(progress: number): void;
    };
  }
}
