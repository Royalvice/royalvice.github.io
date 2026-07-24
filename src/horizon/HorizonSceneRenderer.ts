import type { QualityTier } from "../content/site";
import type { TransitionAwareSceneRenderer } from "../scenes/SceneRenderer";

const MAX_METEORS = 10;
const MAX_FIREWORKS = 33;
const MAX_FIREWORK_GROUPS = 3;
const SAILING_SECONDS = 38;
const RESPAWN_START_SECONDS = 43.85;
const SPLASHDOWN_START_SECONDS = 44.15;
const RESTART_PAUSE_START_SECONDS = 45.75;
const CYCLE_SECONDS = 47.75;

export type BoatCyclePhase =
  | "sailing"
  | "ufo-emerging"
  | "ufo-approaching"
  | "beam-opening"
  | "abducting"
  | "returning-to-moon"
  | "moon-transfer"
  | "boat-respawning"
  | "boat-splashdown"
  | "restart-pause";

export interface FireworkEvent {
  start: number;
  originX: number;
  burstX: number;
  burstY: number;
  seed: number;
  palette: "gold-pearl" | "silver-blue" | "oasis-emerald";
  scale: number;
  role: "principal" | "companion" | "comet";
  style: "chrysanthemum" | "willow" | "comet";
  tail: number;
}

export interface HorizonSceneOptions {
  reducedMotion: boolean;
  qualityTier: QualityTier;
  boatAtlasUrl: string;
  noiseTextureUrl: string;
  /** Loaded with the Horizon chunk. The sea remains live if this atlas cannot load. */
  ufoAtlasUrl?: string;
  onReady?: () => void;
}

type MeteorEvent = {
  start: number;
  duration: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  tail: number;
  brightness: number;
};

type FireworkGroup = { start: number; events: FireworkEvent[]; fadeOutStart: number | null };

type BoatCycleState = {
  phase: BoatCyclePhase;
  elapsed: number;
  progress: number;
  position: [number, number];
  visible: number;
  lift: number;
  wake: number;
  reflection: number;
  verticalVelocity: number;
  pitch: number;
  splash: number;
  ufo: [number, number];
  ufoVisible: number;
  beam: number;
  moonRipple: number;
};

export interface HorizonDebugState {
  ready: boolean;
  fallbackActive: boolean;
  atlasReady: boolean;
  ufoAtlasReady: boolean;
  qualityTier: QualityTier;
  internalResolution: [number, number];
  targetFps: number;
  effectiveFps: number;
  frameDeltaMs: number;
  transitionProgress: number;
  boatProgress: number;
  boatScreenPosition: [number, number];
  horizonScreenY: number;
  meteorCount: number;
  meteorOrigins: Array<[number, number]>;
  meteorVelocities: Array<[number, number]>;
  meteorTailRange: [number, number];
  fireworkCount: number;
  fireworkEventCount: number;
  boatCyclePhase: BoatCyclePhase;
  ufoVisible: boolean;
  beamStrength: number;
  boatLift: number;
  boatVisible: number;
  boatVerticalVelocity: number;
  boatPitch: number;
  boatLampStrength: number;
  splashStrength: number;
  moonReflectionStrength: number;
  seaLuminance: number;
  cycleElapsed: number;
  fireworkPrincipalCount: number;
  fireworkCompanionCount: number;
  nextMeteorIn: number;
  lastMeteorBatchSize: number;
  running: boolean;
}

const vertexSource = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() { v_uv = a_position * .5 + .5; gl_Position = vec4(a_position, 0.0, 1.0); }`;

const fragmentSource = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_entry;
uniform vec2 u_boat_position;
uniform float u_boat_visible;
uniform float u_boat_lift;
uniform float u_boat_wake;
uniform float u_boat_reflection;
uniform float u_boat_pitch;
uniform float u_splash_strength;
uniform float u_reduced_motion;
uniform vec2 u_ufo_position;
uniform float u_ufo_visible;
uniform float u_beam_strength;
uniform float u_moon_ripple;
uniform sampler2D u_noise;
uniform sampler2D u_boat;
uniform sampler2D u_ufo;
uniform int u_meteor_count;
uniform vec4 u_meteor_a[10];
uniform vec4 u_meteor_b[10];
uniform int u_firework_count;
uniform vec4 u_firework_a[33];
uniform vec4 u_firework_b[33];
uniform vec4 u_firework_c[33];

float saturate(float value) { return clamp(value, 0.0, 1.0); }
float noiseAt(vec2 uv) { return texture(u_noise, fract(uv)).r; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

float valueNoise(vec2 point) {
  vec2 integer = floor(point); vec2 fraction = fract(point);
  fraction = fraction * fraction * (3.0 - 2.0 * fraction);
  float a = noiseAt((integer + vec2(.5, .5)) / 128.0);
  float b = noiseAt((integer + vec2(1.5, .5)) / 128.0);
  float c = noiseAt((integer + vec2(.5, 1.5)) / 128.0);
  float d = noiseAt((integer + vec2(1.5, 1.5)) / 128.0);
  return mix(mix(a, b, fraction.x), mix(c, d, fraction.x), fraction.y);
}

float waveField(vec2 p, float time) {
  float a = sin(p.x * 19.0 + p.y * 8.0 + time * .88);
  float b = sin(p.x * 37.0 - p.y * 14.0 - time * .57);
  float c = sin((p.x + p.y) * 71.0 + time * 1.24);
  return a * .48 + b * .33 + c * .19;
}

float cloudField(vec2 uv, float time) {
  float high = valueNoise(uv * vec2(5.2, 2.8) + vec2(time * .006, 17.0));
  float middle = valueNoise(uv * vec2(9.4, 4.8) + vec2(-time * .010, 43.0));
  float detail = valueNoise(uv * vec2(19.0, 8.0) + vec2(time * .016, 79.0));
  float envelope = smoothstep(.53, .78, high * .50 + middle * .36 + detail * .14);
  float lowBand = exp(-pow((uv.y - .55) * 4.8, 2.0));
  float low = smoothstep(.48, .72, valueNoise(uv * vec2(13.0, 4.2) + vec2(-time * .007, 29.0))) * lowBand;
  return saturate(envelope * .72 + low * .68);
}

vec3 skyLayer(vec2 uv, float time, float entry, out float cloud) {
  float screenY = 1.0 - uv.y;
  vec3 sky = mix(vec3(.0196, .0392, .1137), vec3(.0431, .0706, .1882), smoothstep(.0, .34, screenY));
  sky = mix(sky, vec3(.0902, .1216, .2627), smoothstep(.24, .66, screenY));
  sky = mix(sky, vec3(.2039, .2627, .3569), smoothstep(.58, .94, screenY));
  vec3 dusk = mix(vec3(.028, .055, .14), vec3(.27, .20, .24), smoothstep(.45, .96, screenY));
  sky = mix(dusk, sky, smoothstep(.08, .86, entry));
  cloud = cloudField(uv, time);
  float cloudLightMix = smoothstep(.34, .9, noiseAt(uv * vec2(2.0, 1.2) + vec2(.21, time * .001)));
  sky = mix(sky, mix(vec3(.0667, .102, .2196), vec3(.1647, .2078, .3294), cloudLightMix), cloud * .62);
  vec2 grid = vec2(240.0, 132.0); vec2 starCell = floor(uv * grid);
  float seed = noiseAt((starCell + vec2(17.0, 43.0)) / 128.0);
  float stars = step(.982, seed) * (1.0 - smoothstep(.10, .45, length(fract(uv * grid) - .5)));
  float twinkle = mix(.78, .68 + .32 * sin(time * 1.12 + seed * 30.0), step(.968, noiseAt((starCell + vec2(61.0, 7.0)) / 128.0)));
  sky += mix(vec3(.53, .66, .86), vec3(.92, .91, .80), seed) * stars * twinkle * smoothstep(.08, .32, uv.y) * smoothstep(.54, .70, uv.y) * (1.0 - cloud * .92) * smoothstep(.2, .82, entry);
  return mix(sky, vec3(.18, .25, .34), exp(-abs(screenY - .52) * 34.0) * .32);
}

vec3 moonLayer(vec2 uv, float aspect, float cloud, float entry) {
  vec2 q = (uv - vec2(.84, .83)) * vec2(aspect, 1.0);
  float outerDistance = length(q); float outer = 1.0 - smoothstep(.052, .055, outerDistance);
  float cut = 1.0 - smoothstep(.044, .047, length(q - vec2(.028, .006)));
  float crescent = outer * (1.0 - cut); float earthshine = outer * cut;
  float atmosphere = 1.0 - cloud * .78; float reveal = smoothstep(.30, .74, entry);
  vec3 core = mix(vec3(.8627, .8353, .7373), vec3(.949, .9176, .8039), smoothstep(.2, .85, noiseAt(q * 6.8 + vec2(.31, .67))));
  vec3 result = core * crescent * atmosphere * reveal + vec3(.149, .188, .294) * earthshine * .11 * atmosphere * reveal;
  result += vec3(.58, .71, .82) * exp(-outerDistance * 52.0) * (1.0 - outer) * atmosphere * .20 * reveal;
  float ripple = exp(-abs(outerDistance - (.063 + u_moon_ripple * .028)) * 380.0) * u_moon_ripple * atmosphere;
  return result + vec3(.46, .68, .86) * ripple * .35;
}

float islandMask(vec2 uv, float horizon) {
  float ridge = valueNoise(vec2(uv.x * 18.0 + 7.0, 11.0));
  float detail = valueNoise(vec2(uv.x * 41.0 + 29.0, 23.0));
  return step(horizon, uv.y) * step(uv.y, horizon + (.0025 + ridge * .006 + detail * .002) * smoothstep(.16, .02, abs(uv.x - .74)));
}

vec3 oasisLayer(vec2 uv, float horizon, float time, float entry, out float signal) {
  vec2 gate = vec2(uv.x - .74, uv.y - horizon); float y = saturate(gate.y / .057);
  float body = step(0.0, gate.y) * step(gate.y, .054) * step(abs(gate.x), mix(.026, .012, y)) * step(mix(.013, .0058, y), abs(gate.x));
  float crown = step(.046, gate.y) * step(gate.y, .057) * step(abs(gate.x), mix(.015, .009, saturate((gate.y - .046) / .011)));
  float structure = saturate(body + crown + step(0.0, gate.y) * step(gate.y, .007) * step(abs(gate.x), .032) + islandMask(uv, horizon));
  signal = exp(-abs(gate.x) * 620.0) * step(.010, gate.y) * step(gate.y, .031) * (.92 + .08 * sin(time * .72));
  float reveal = smoothstep(.38, .78, entry);
  return vec3(.045, .075, .122) * structure * reveal + vec3(.635, 1.0, .690) * signal * reveal + vec3(.184, .749, .471) * exp(-pow(gate.x * 31.0, 2.0) - pow((gate.y - .004) * 72.0, 2.0)) * .19 * reveal;
}

vec3 meteorLayer(vec2 uv, float aspect, float time, float cloud) {
  vec3 light = vec3(0.0); vec2 ratio = vec2(aspect, 1.0);
  for (int i = 0; i < 10; i++) {
    if (i >= u_meteor_count) continue;
    vec4 a = u_meteor_a[i]; vec4 b = u_meteor_b[i]; float age = (time - b.x) / max(b.y, .001);
    if (age < 0.0 || age > 1.0) continue;
    vec2 head = a.xy + a.zw * smoothstep(.035, .94, age); vec2 direction = normalize(a.zw * ratio); vec2 point = uv * ratio; vec2 hp = head * ratio;
    float lengthNow = b.z * smoothstep(.035, .19, age) * (1.0 - smoothstep(.88, .985, age)); vec2 tail = hp - direction * lengthNow; vec2 segment = hp - tail;
    float along = clamp(dot(point - tail, segment) / max(dot(segment, segment), .000001), 0.0, 1.0); float dist = length(point - (tail + segment * along));
    float visibility = smoothstep(.0, .065, age) * (1.0 - smoothstep(.945, 1.0, age)) * (1.0 - cloud * .72) * b.w;
    float trailEnvelope = smoothstep(.02, .16, along) * mix(.38, 1.0, pow(along, .72));
    float brokenTail = mix(.30, 1.0, step(.43, fract(along * 17.0 + float(i) * .31 + age * 1.7)));
    float silverTrail = smoothstep(.00155, .00024, dist) * trailEnvelope;
    float pearlSpine = smoothstep(.00078, .00012, dist) * smoothstep(.28, .96, along);
    float tailFlame = smoothstep(.68, .80, along) * (1.0 - smoothstep(.955, .995, along));
    light += vec3(.38, .58, .86) * silverTrail * mix(.52, 1.0, brokenTail) * .48 * visibility;
    light += vec3(.78, .88, 1.0) * pearlSpine * (.62 + .38 * brokenTail) * .92 * visibility;
    light += vec3(1.0, .69, .28) * smoothstep(.00102, .00016, dist) * tailFlame * 1.08 * visibility;
    float headCore = exp(-length(point - hp) * 1180.0);
    light += vec3(1.0, .97, .82) * headCore * 1.42 * visibility;
    float terminalFlash = smoothstep(.845, .895, age) * (1.0 - smoothstep(.948, .988, age));
    float flashCore = exp(-length(point - hp) * 760.0);
    light += vec3(.92, .97, 1.0) * flashCore * terminalFlash * 2.05 * (1.0 - cloud * .64) * b.w;
  }
  return light;
}

vec3 fireworkColor(float palette, float spark) {
  vec3 gold = mix(vec3(1.0, .60, .16), vec3(1.0, .93, .72), spark);
  vec3 silver = mix(vec3(.42, .66, 1.0), vec3(.98, .97, .86), spark);
  vec3 oasis = mix(vec3(.22, .72, .56), vec3(.79, 1.0, .82), spark);
  return palette < .5 ? gold : palette < 1.5 ? silver : oasis;
}

float fireworkEnergy(float age) {
  float launch = smoothstep(.02, .13, age) * (1.0 - smoothstep(.48, .66, age));
  float burst = smoothstep(.52, .68, age) * (1.0 - smoothstep(1.18, 1.52, age));
  float secondary = smoothstep(1.04, 1.32, age) * (1.0 - smoothstep(2.0, 2.55, age));
  float ember = smoothstep(1.28, 1.7, age) * (1.0 - smoothstep(4.15, 4.85, age));
  return max(max(launch, burst), max(secondary, ember));
}

vec3 fireworkSky(vec2 uv, float aspect, float time) {
  vec3 light = vec3(0.0); vec2 point = uv * vec2(aspect, 1.0);
  for (int i = 0; i < 33; i++) {
    if (i >= u_firework_count) continue;
    vec4 a = u_firework_a[i]; vec4 b = u_firework_b[i]; vec4 c = u_firework_c[i]; float age = time - a.w;
    if (age < 0.0 || age > 4.9) continue;
    vec2 origin = vec2(a.x, .105); vec2 burst = a.yz; float palette = b.y; float scale = b.z; float seed = b.x; float groupFade = b.w;
    float role = c.x; float style = c.y; float tailFactor = c.z;
    vec2 launchHead = mix(origin, burst, smoothstep(.0, role > 1.5 ? .72 : .55, age)); vec2 launchPoint = launchHead * vec2(aspect, 1.0); vec2 launchStart = origin * vec2(aspect, 1.0);
    vec2 line = launchPoint - launchStart; float launchT = clamp(dot(point - launchStart, line) / max(dot(line, line), .000001), 0.0, 1.0); float launchDist = length(point - (launchStart + line * launchT));
    float launchEnd = role > 1.5 ? .84 : .66; float launch = smoothstep(.0028, .00052, launchDist) * smoothstep(.01, .08, age) * (1.0 - smoothstep(launchEnd - .12, launchEnd, age));
    float launchSpark = step(.30, fract(launchT * 41.0 + seed * 11.0));
    light += fireworkColor(palette, .22) * launch * (.72 + launchT * .62) * mix(.72, 1.0, launchSpark) * groupFade;
    float burstDelay = role > 1.5 ? .78 : .56; float rayLimit = role < .5 ? 24.0 : role < 1.5 ? 14.0 : 7.0;
    for (int ray = 0; ray < 24; ray++) {
      float id = float(ray); if (id >= rayLimit) continue;
      float angle = id * (6.283185 / rayLimit) + seed * 6.283 + hash(vec2(seed, id)) * .16;
      vec2 direction = vec2(cos(angle), sin(angle));
      float baseSpread = role < .5 ? .064 : role < 1.5 ? .038 : .019;
      float spread = (baseSpread + hash(vec2(id, seed)) * baseSpread * .62) * scale;
      float mainAge = saturate((age - burstDelay) / (style > .5 && style < 1.5 ? 1.48 : 1.16));
      float gravity = style > .5 && style < 1.5 ? (.040 + tailFactor * .045) : (.022 + tailFactor * .020);
      vec2 end = burst + direction * spread * mainAge + vec2(0.0, -gravity * mainAge * mainAge);
      vec2 bp = burst * vec2(aspect, 1.0); vec2 ep = end * vec2(aspect, 1.0); vec2 segment = ep - bp; float along = clamp(dot(point - bp, segment) / max(dot(segment, segment), .000001), 0.0, 1.0); float d = length(point - (bp + segment * along));
      float burstIn = smoothstep(burstDelay - .03, burstDelay + .15, age); float burstOut = 1.0 - smoothstep(style > .5 && style < 1.5 ? 2.25 : 1.55, style > .5 && style < 1.5 ? 3.85 : 2.05, age);
      float segmented = mix(1.0, step(.25, fract(along * (17.0 + tailFactor * 13.0) + seed * 5.0)), smoothstep(1.15, 2.35, age) * .72);
      float main = smoothstep(.0035, .00048, d) * burstIn * burstOut * smoothstep(.02, .98, along) * segmented;
      float head = exp(-length(point - ep) * 500.0) * burstIn * (1.0 - smoothstep(1.28, 2.25, age));
      light += fireworkColor(palette, fract(id * .37 + seed)) * (main * (.52 + along * .82) + head * 1.38) * groupFade;
      if (ray < 12 && role < 1.5) {
        float subAge = saturate((age - 1.20) / .98); vec2 subStart = burst + direction * spread * .66; float subAngle = angle + (hash(vec2(seed + 4.0, id)) - .5) * 1.34; vec2 subEnd = subStart + vec2(cos(subAngle), sin(subAngle)) * (.018 + hash(vec2(id, seed + 2.0)) * .026) * subAge + vec2(0.0, -.024 * subAge * subAge);
        vec2 sp = subStart * vec2(aspect, 1.0); vec2 se = subEnd * vec2(aspect, 1.0); vec2 ss = se - sp; float sa = clamp(dot(point - sp, ss) / max(dot(ss, ss), .000001), 0.0, 1.0); float sd = length(point - (sp + ss * sa));
        light += fireworkColor(palette, .82) * smoothstep(.0024, .00038, sd) * smoothstep(1.16, 1.36, age) * (1.0 - smoothstep(2.35, 3.15, age)) * .78 * groupFade;
      }
      if (ray < 20 && role < 1.5) {
        float emberAge = saturate((age - 1.35) / 3.25); vec2 ember = burst + direction * spread * (.58 + hash(vec2(id, seed + 9.0)) * .52) + vec2(0.0, -.018 - emberAge * emberAge * (.075 + tailFactor * .075 + hash(vec2(seed, id + 3.0)) * .038));
        float ed = length(point - ember * vec2(aspect, 1.0));
        float emberTwinkle = .58 + .42 * step(.46, fract(age * (7.0 + hash(vec2(id, seed)) * 9.0) + seed));
        light += fireworkColor(palette, .65) * exp(-ed * 460.0) * smoothstep(1.28, 1.68, age) * (1.0 - smoothstep(4.18, 4.88, age)) * (.68 + tailFactor * .34) * emberTwinkle * groupFade;
      }
    }
    float smoke = exp(-length((uv - burst - vec2((seed - .5) * .018, age * .004)) * vec2(aspect, 1.0)) * 27.0) * smoothstep(1.18, 1.9, age) * (1.0 - smoothstep(3.55, 4.85, age));
    light += vec3(.22, .28, .37) * smoke * .105 * groupFade;
  }
  return light;
}

vec3 fireworkReflection(vec2 uv, float aspect, float time, float farWave, float midWave, float nearWave) {
  vec3 light = vec3(0.0);
  for (int i = 0; i < 33; i++) {
    if (i >= u_firework_count) continue;
    vec4 a = u_firework_a[i]; vec4 b = u_firework_b[i]; float age = time - a.w;
    if (age < .18 || age > 4.9) continue;
    float phase = fireworkEnergy(age); float depth = saturate((.48 - uv.y) / .48); float width = mix(.006, .038, smoothstep(.10, .68, depth));
    float center = a.y + midWave * (.005 + depth * .012) + nearWave * depth * .004;
    float strips = step(.50 + (nearWave + midWave) * .08, fract(uv.y * 230.0 + farWave * 2.1 + float(i) * .17));
    float trail = exp(-abs(uv.x - center) * aspect / width) * strips * exp(-depth * 1.7);
    light += fireworkColor(b.y, .62) * trail * phase * (.14 + .24 * (1.0 - depth)) * b.w;
  }
  return light;
}

vec4 sampleBoat(vec2 local, float frame) {
  if (any(lessThan(local, vec2(0.0))) || any(greaterThan(local, vec2(1.0)))) return vec4(0.0);
  vec2 oriented = vec2(local.x, 1.0 - local.y);
  return texture(u_boat, (vec2(mod(frame, 4.0), 2.0 - floor(frame / 4.0)) + oriented) / vec2(4.0, 3.0));
}

vec4 sampleUfo(vec2 local, float frame) {
  if (any(lessThan(local, vec2(0.0))) || any(greaterThan(local, vec2(1.0)))) return vec4(0.0);
  vec2 oriented = vec2(local.x, 1.0 - local.y);
  return texture(u_ufo, (vec2(mod(frame, 4.0), 1.0 - floor(frame / 4.0)) + oriented) / vec2(4.0, 2.0));
}

vec3 seaLayer(vec2 uv, float aspect, float horizon, float time, float entry, float oasisSignal) {
  float depth = saturate((horizon - uv.y) / horizon); vec2 p = vec2((uv.x - .5) * aspect, uv.y);
  float farWave = waveField(vec2(p.x * 1.3, p.y * 4.2), time * .31); float midWave = waveField(vec2(p.x * 2.1, p.y * 7.0), -time * .43); float nearWave = waveField(vec2(p.x * 3.6, p.y * 11.0), time * .56);
  vec3 sea = mix(vec3(.028, .103, .160), vec3(.023, .083, .145), smoothstep(.12, .52, depth));
  sea = mix(sea, vec3(.013, .038, .085), smoothstep(.52, 1.0, depth));
  sea = mix(mix(vec3(.061, .194, .244), vec3(.020, .070, .128), depth), sea, smoothstep(.08, .88, entry));
  float crestFar = smoothstep(.54, .92, farWave * .5 + .48) * (1.0 - smoothstep(.18, .34, depth));
  float crestMid = smoothstep(.62, .96, midWave * .5 + .45) * smoothstep(.08, .25, depth) * (1.0 - smoothstep(.66, .86, depth));
  float crestNear = smoothstep(.72, .98, nearWave * .5 + .42) * smoothstep(.48, .82, depth);
  float ordinaryGlint = step(.73, noiseAt(floor(vec2(uv.x * 260.0, uv.y * 176.0)) / 128.0 + vec2(time * .006, 7.0))) * (crestFar * .42 + crestMid * .55 + crestNear * .24);
  sea += vec3(.10, .24, .33) * ordinaryGlint * (.16 + .22 * (1.0 - depth));
  float moonCenter = .84 + farWave * .0035 + midWave * .0065 * depth;
  float middleBand = exp(-pow((depth - .43) / .31, 2.0));
  float moonCoreWidth = mix(154.0, 92.0, smoothstep(.0, .48, depth)) + smoothstep(.72, 1.0, depth) * 36.0;
  float moonSkirtWidth = mix(92.0, 43.0, smoothstep(.05, .62, depth)) + smoothstep(.76, 1.0, depth) * 38.0;
  float moonCore = exp(-abs(uv.x - moonCenter) * moonCoreWidth);
  float moonSkirt = exp(-abs(uv.x - moonCenter) * moonSkirtWidth) * middleBand;
  float moonBreak = step(.29 + nearWave * .07 + depth * .08, fract(uv.y * 318.0 + farWave * 1.9 + midWave * .82));
  float moonFine = step(.43 + farWave * .05, fract(uv.y * 477.0 - midWave * 1.4));
  float moonShape = mix(1.0, .34, depth) * (crestFar * .72 + crestMid * .51 + crestNear * .12 + .145) * smoothstep(.34, .76, entry);
  float moonVisibility = .96 - cloudField(vec2(.84, .83), time) * .50;
  sea += vec3(.68, .79, .94) * moonCore * max(moonBreak, moonFine * .55) * moonShape * moonVisibility;
  sea += vec3(.40, .56, .76) * moonSkirt * moonBreak * (.055 + crestMid * .18) * moonVisibility * smoothstep(.38, .78, entry);
  float oasisRoad = exp(-abs(uv.x - (.74 + farWave * .0025)) * mix(138.0, 56.0, depth));
  sea += vec3(.20, .75, .47) * oasisRoad * (1.0 - smoothstep(.08, .55, depth)) * step(.62, fract(uv.y * 280.0 + farWave * 2.4)) * (.05 + oasisSignal * .08) * smoothstep(.42, .82, entry);
  sea += fireworkReflection(uv, aspect, time, farWave, midWave, nearWave);
  vec2 beam = (uv - vec2(u_boat_position.x, u_boat_position.y - .020)) * vec2(aspect, 1.0);
  float beamPool = exp(-pow(beam.x / (.028 + u_beam_strength * .048), 2.0) - pow(beam.y / .025, 2.0)) * u_beam_strength * step(.48, fract(uv.y * 190.0 + midWave));
  sea += vec3(.35, .82, .92) * beamPool * .26;
  vec2 boatPosition = u_boat_position;
  vec2 localScale = vec2(.138, .104); float frame = floor(mod(time * 2.5, 12.0));
  float shadow = exp(-pow((uv.x - boatPosition.x) * aspect / .054, 2.0) - pow((uv.y - (boatPosition.y - .034 - u_boat_lift * .13)) / .010, 2.0));
  sea *= 1.0 - shadow * .25 * u_boat_visible * (1.0 - u_boat_lift);
  vec2 wakeDelta = (uv - (boatPosition - vec2(.045, .030))) * vec2(aspect, 1.0); float wakeDistance = max(0.0, -wakeDelta.x);
  float wake = (exp(-abs(wakeDelta.y - wakeDistance * .27) * 260.0) + exp(-abs(wakeDelta.y + wakeDistance * .20) * 260.0)) * step(wakeDelta.x, 0.0) * exp(-wakeDistance * 11.0) * step(.44, fract((wakeDistance + uv.y) * 170.0 + nearWave));
  sea += vec3(.33, .48, .59) * wake * .23 * u_boat_visible * u_boat_wake;
  vec2 reflectionCenter = vec2(boatPosition.x + midWave * .002, boatPosition.y - (.078 - u_boat_lift * .045));
  vec2 reflectionDelta = (vec2(uv.x, reflectionCenter.y + (reflectionCenter.y - uv.y)) - boatPosition) * vec2(aspect, 1.0);
  float reflectionCos = cos(-u_boat_pitch); float reflectionSin = sin(-u_boat_pitch);
  reflectionDelta = mat2(reflectionCos, -reflectionSin, reflectionSin, reflectionCos) * reflectionDelta;
  vec2 reflectionLocal = reflectionDelta / localScale + .5; reflectionLocal.x += midWave * .028;
  vec4 reflection = sampleBoat(reflectionLocal, frame); sea = mix(sea, reflection.rgb * vec3(.18, .27, .38), reflection.a * step(.52, fract(uv.y * 240.0 + midWave * 2.2)) * .23 * u_boat_visible * u_boat_reflection);
  float lampWater = exp(-abs((uv.x - (boatPosition.x + .012)) * aspect) * 150.0) * exp(-abs(uv.y - (boatPosition.y - .052)) * 42.0);
  lampWater *= step(.55, fract(uv.y * 265.0 + midWave * 2.6)) * u_boat_reflection * (1.0 - u_boat_lift);
  sea += vec3(1.0, .54, .16) * lampWater * .075 * u_boat_visible;
  vec2 splashCenter = vec2(.61, .34); vec2 splashDelta = (uv - splashCenter) * vec2(aspect, 1.0);
  float splashRadius = .012 + (1.0 - u_splash_strength) * .052;
  float splashRing = exp(-abs(length(splashDelta * vec2(1.0, 2.8)) - splashRadius) * 330.0) * step(.39, fract(uv.x * 420.0 + nearWave * 2.0));
  float splashCrown = 0.0;
  for (int drop = 0; drop < 7; drop++) {
    float dropId = float(drop); float side = (dropId - 3.0) / 3.0; vec2 dropPoint = splashCenter + vec2(side * (.012 + dropId * .0018) / aspect, .008 + (1.0 - abs(side)) * .030);
    float dropDistance = length((uv - dropPoint) * vec2(aspect, 1.0)); splashCrown += exp(-dropDistance * 590.0) * step(.18, u_splash_strength);
  }
  float impactFlash = exp(-pow(splashDelta.x / .040, 2.0) - pow(splashDelta.y / .010, 2.0));
  sea += vec3(.62, .82, .94) * (splashRing * .72 + splashCrown * .92 + impactFlash * .32) * u_splash_strength;
  return sea;
}

vec3 beamLayer(vec2 uv, float aspect, float time) {
  if (u_ufo_visible <= .001 || u_beam_strength <= .001) return vec3(0.0);
  float top = u_ufo_position.y - .032; float requestedBottom = u_boat_position.y + .018; float bottom = min(requestedBottom, top - .012);
  float distance = max(.012, top - bottom); float t = saturate((uv.y - bottom) / distance);
  float vertical = smoothstep(bottom - .004, bottom + .007, uv.y) * (1.0 - smoothstep(top - .006, top + .001, uv.y));
  float center = mix(u_boat_position.x, u_ufo_position.x, t); float width = mix(.060, .010, t) * mix(.55, 1.0, u_beam_strength);
  float body = vertical * smoothstep(width, width * .70, abs((uv.x - center) * aspect));
  float grain = mix(.56, 1.0, step(.40, noiseAt(uv * vec2(137.0, 93.0) + vec2(time * .014, -time * .009))));
  float dust = step(.90, noiseAt(floor(uv * vec2(250.0, 150.0)) / 128.0 + vec2(0.0, time * .018))) * body;
  return vec3(.28, .76, .91) * (body * grain * .30 + dust * .34) * u_beam_strength;
}

vec4 boatLayer(vec2 uv, float aspect, float time) {
  vec2 delta = (uv - u_boat_position) * vec2(aspect, 1.0); float rotationCos = cos(-u_boat_pitch); float rotationSin = sin(-u_boat_pitch);
  delta = mat2(rotationCos, -rotationSin, rotationSin, rotationCos) * delta;
  vec2 local = delta / vec2(.138, .104) + .5; vec4 boat = sampleBoat(local, floor(mod(time * 2.5, 12.0)));
  float beamTint = u_beam_strength * smoothstep(.04, .56, u_boat_lift); boat.rgb = mix(boat.rgb, boat.rgb * vec3(.72, 1.08, 1.18) + vec3(.035, .10, .14), beamTint * .28);
  boat.a *= u_boat_visible; return boat;
}

vec3 boatLampLayer(vec2 uv, float aspect, float time) {
  vec2 lampOffset = vec2(.010 / aspect, -.002); float offsetCos = cos(u_boat_pitch); float offsetSin = sin(u_boat_pitch); lampOffset = mat2(offsetCos, -offsetSin, offsetSin, offsetCos) * lampOffset;
  vec2 lamp = (uv - (u_boat_position + lampOffset)) * vec2(aspect, 1.0);
  float flicker = u_reduced_motion > .5 ? .82 : clamp(.81 + sin(time * 7.31) * .10 + sin(time * 12.77 + 1.2) * .055 + (noiseAt(vec2(time * .017, .73)) - .5) * .18, .62, 1.0);
  float core = smoothstep(.0052, .00045, length(lamp * vec2(1.0, 1.15))); float halo = exp(-length(lamp) * 165.0);
  return (vec3(1.0, .94, .70) * core * 1.72 + vec3(1.0, .38, .055) * halo * .34) * flicker * u_boat_visible;
}

vec3 ufoLayer(vec2 uv, float aspect, float time) {
  if (u_ufo_visible <= .001) return vec3(0.0);
  vec2 local = ((uv - u_ufo_position) * vec2(aspect, 1.0)) / vec2(.112, .070) + .5;
  vec4 ufo = sampleUfo(local, floor(mod(time * 7.0, 8.0))); vec3 light = ufo.rgb * ufo.a * u_ufo_visible;
  float halo = exp(-length((uv - u_ufo_position) * vec2(aspect, 1.0)) * 48.0) * u_ufo_visible;
  return light + vec3(.33, .55, .86) * halo * .10;
}

vec3 quantize(vec3 color, vec2 cell, float time) {
  float ordered = noiseAt((cell + vec2(floor(mod(time * 4.0, 4.0)) * 17.0, 31.0)) / 128.0) - .5;
  return floor((color + ordered * .020) * 38.0) / 38.0;
}

void main() {
  vec2 cell = floor(v_uv * u_resolution); vec2 uv = (cell + .5) / u_resolution; float aspect = u_resolution.x / max(u_resolution.y, 1.0); float horizon = .48; float cloud = 0.0; vec3 color;
  if (uv.y >= horizon) {
    color = skyLayer(uv, u_time, u_entry, cloud); color += moonLayer(uv, aspect, cloud, u_entry); float oasisSignal = 0.0; color += oasisLayer(uv, horizon, u_time, u_entry, oasisSignal); color += meteorLayer(uv, aspect, u_time, cloud) * smoothstep(.72, 1.0, u_entry); color += fireworkSky(uv, aspect, u_time);
  } else {
    color = seaLayer(uv, aspect, horizon, u_time, u_entry, .92 + .08 * sin(u_time * .72));
  }
  color += beamLayer(uv, aspect, u_time);
  vec4 boat = boatLayer(uv, aspect, u_time); color = mix(color, boat.rgb, boat.a); color += boatLampLayer(uv, aspect, u_time);
  color += ufoLayer(uv, aspect, u_time);
  color = mix(color, vec3(.145, .205, .285), exp(-abs(uv.y - horizon) * 78.0) * .24 * smoothstep(.28, .9, u_entry));
  color *= 1.0 - smoothstep(.42, .94, length((uv - .5) * vec2(aspect, 1.0))) * .075;
  outColor = vec4(quantize(max(color, 0.0), cell, u_time), 1.0);
}`;

function clamp01(value: number): number { return Math.min(1, Math.max(0, value)); }
function smoothstep(minimum: number, maximum: number, value: number): number { const t = clamp01((value - minimum) / (maximum - minimum)); return t * t * (3 - 2 * t); }
function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type); if (!shader) throw new Error("Unable to allocate Horizon shader.");
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Horizon shader compilation failed.");
  return shader;
}

export class HorizonSceneRenderer implements TransitionAwareSceneRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly locations = new Map<string, WebGLUniformLocation | null>();
  private readonly host: HTMLElement | null;
  private readonly options: HorizonSceneOptions;
  private qualityTier: QualityTier;
  private targetFps = 60; private effectiveFps = 60; private raf = 0; private running = false; private ready = false; private atlasReady = false; private ufoAtlasReady = false; private ufoAtlasLoadSettled = false;
  private renderAccumulator = 0; private frameDeltaEwma = 16.7; private slowFrameDebt = 0; private fastFrameStreak = 0; private lastPacingChangeAt = 0;
  private elapsed = RESPAWN_START_SECONDS; private lastTimestamp = 0; private transitionProgress = 0;
  private meteorEvents: MeteorEvent[] = []; private readonly meteorA = new Float32Array(MAX_METEORS * 4); private readonly meteorB = new Float32Array(MAX_METEORS * 4);
  private readonly fireworkA = new Float32Array(MAX_FIREWORKS * 4); private readonly fireworkB = new Float32Array(MAX_FIREWORKS * 4); private readonly fireworkC = new Float32Array(MAX_FIREWORKS * 4);
  private fireworkGroups: FireworkGroup[] = []; private nextMeteorBatch = RESPAWN_START_SECONDS + 2.5; private lastMeteorBatchSize = 0; private meteorSeed = 0x4f415349; private fireworkSeed = 0x1d0a515;
  private debugTimeLocked = false; private boatProgressOverride: number | null = null; private cyclePhaseOverride: BoatCyclePhase | null = null; private resizeObserver: ResizeObserver | null = null;
  private pointerDown: { id: number; x: number; y: number; time: number } | null = null;
  private readonly debugHook: (() => HorizonDebugState) & {
    triggerMeteor: (kind?: "single" | "triple" | "shower") => void; setTime: (seconds: number) => void; triggerFirework: (kind?: "single" | "cinematic") => void;
    triggerUfoCycle: () => void; setBoatProgress: (progress: number) => void; setCyclePhase: (phase: BoatCyclePhase) => void;
  };

  constructor(private readonly canvas: HTMLCanvasElement, options: HorizonSceneOptions) {
    this.options = options; this.qualityTier = options.qualityTier; this.host = canvas.closest<HTMLElement>(".horizon-scene");
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("WebGL2 is unavailable for the Horizon scene."); this.gl = gl;
    const program = gl.createProgram(); if (!program) throw new Error("Unable to allocate Horizon program.");
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource)); gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource)); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Horizon program linking failed."); this.program = program;
    ["u_resolution", "u_time", "u_entry", "u_boat_position", "u_boat_visible", "u_boat_lift", "u_boat_wake", "u_boat_reflection", "u_boat_pitch", "u_splash_strength", "u_reduced_motion", "u_ufo_position", "u_ufo_visible", "u_beam_strength", "u_moon_ripple", "u_meteor_count", "u_meteor_a[0]", "u_meteor_b[0]", "u_firework_count", "u_firework_a[0]", "u_firework_b[0]", "u_firework_c[0]"].forEach((name) => this.locations.set(name, gl.getUniformLocation(program, name)));
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); gl.useProgram(program);
    const position = gl.getAttribLocation(program, "a_position"); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(gl.getUniformLocation(program, "u_noise"), 0); gl.uniform1i(gl.getUniformLocation(program, "u_boat"), 1); gl.uniform1i(gl.getUniformLocation(program, "u_ufo"), 2);
    this.setQuality(options.qualityTier);
    this.debugHook = Object.assign(() => this.debugState(), {
      triggerMeteor: (kind: "single" | "triple" | "shower" = "single") => this.triggerMeteor(kind),
      setTime: (seconds: number) => { this.debugTimeLocked = true; this.pause(); this.elapsed = Math.max(0, seconds); this.renderFrame(); },
      triggerFirework: (kind: "single" | "cinematic" = "cinematic") => this.triggerDebugFirework(kind),
      triggerUfoCycle: () => { this.debugTimeLocked = true; this.pause(); this.elapsed = SAILING_SECONDS; this.boatProgressOverride = null; this.cyclePhaseOverride = null; this.renderFrame(); },
      setBoatProgress: (progress: number) => { this.debugTimeLocked = true; this.pause(); this.boatProgressOverride = clamp01(progress); this.renderFrame(); },
      setCyclePhase: (phase: BoatCyclePhase) => { this.debugTimeLocked = true; this.pause(); this.cyclePhaseOverride = phase; this.renderFrame(); }
    });
  }

  async init(): Promise<void> {
    const [noise, boat] = await Promise.all([this.loadTexture(this.options.noiseTextureUrl, 0, true), this.loadTexture(this.options.boatAtlasUrl, 1, false)]);
    if (!noise || !boat) throw new Error("Horizon textures failed to initialize."); this.atlasReady = true;
    this.createTransparentTexture(2); this.resize(); this.resizeObserver = new ResizeObserver(() => this.resize()); if (this.host) this.resizeObserver.observe(this.host);
    this.ready = true; this.transitionProgress = this.options.reducedMotion ? 1 : this.transitionProgress; this.elapsed = this.options.reducedMotion ? SAILING_SECONDS : RESPAWN_START_SECONDS; this.renderFrame();
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    this.canvas.dataset.sceneReady = "true"; this.host?.classList.add("is-scene-ready"); this.options.onReady?.(); window.__horizonDebug = this.debugHook;
    if (!this.options.reducedMotion) { this.bindCanvasInteraction(); void this.loadUfoAtlas(); }
  }

  start(): void { this.resume(); }
  pause(): void { this.running = false; this.lastTimestamp = 0; this.renderAccumulator = 0; cancelAnimationFrame(this.raf); }
  resume(): void { if (!this.ready || this.running || this.options.reducedMotion || this.debugTimeLocked) return; this.running = true; this.lastTimestamp = 0; this.renderAccumulator = 0; this.raf = requestAnimationFrame(this.draw); }
  resize(): void {
    const rect = this.host?.getBoundingClientRect() ?? this.canvas.getBoundingClientRect(); const aspect = rect.width / Math.max(rect.height, 1);
    const targetWidth = this.qualityTier === "high" && rect.width > 760 ? 640 : this.qualityTier === "balanced" ? 480 : 320; const maxPixels = this.qualityTier === "low" ? 230_000 : 270_000;
    let width = targetWidth; let height = Math.max(180, Math.round(width / Math.max(aspect, .38)));
    if (width * height > maxPixels) { const scale = Math.sqrt(maxPixels / (width * height)); width = Math.max(280, Math.floor(width * scale)); height = Math.max(180, Math.floor(height * scale)); }
    width = Math.max(4, Math.round(width / 4) * 4); height = Math.max(4, Math.round(height / 4) * 4);
    if (this.canvas.width === width && this.canvas.height === height) return; this.canvas.width = width; this.canvas.height = height; this.gl.viewport(0, 0, width, height); if (this.ready) this.renderFrame();
  }
  setQuality(tier: QualityTier): void {
    this.qualityTier = tier;
    this.targetFps = tier === "high" ? 60 : tier === "balanced" ? 45 : 30;
    this.effectiveFps = this.targetFps;
    this.renderAccumulator = 0;
    this.frameDeltaEwma = 16.7;
    this.slowFrameDebt = 0;
    this.fastFrameStreak = 0;
    this.lastPacingChangeAt = 0;
    this.resize();
  }
  setTransitionProgress(progress: number): void { this.transitionProgress = clamp01(progress); if (this.ready && (!this.running || this.options.reducedMotion)) this.renderFrame(); }
  launchFirework(viewportX: number, viewportY: number): void { if (!this.ready || this.options.reducedMotion) return; const rect = this.canvas.getBoundingClientRect(); const x = clamp01((viewportX - rect.left) / Math.max(rect.width, 1)); const y = clamp01(1 - (viewportY - rect.top) / Math.max(rect.height, 1)); this.launchCinematicFirework(x, y); }
  triggerUfoCycle(): void { if (this.options.reducedMotion || !this.ufoAtlasReady) return; this.elapsed = SAILING_SECONDS; this.boatProgressOverride = null; this.cyclePhaseOverride = null; this.renderFrame(); }
  setBoatProgress(progress: number): void { this.boatProgressOverride = clamp01(progress); this.renderFrame(); }
  destroy(): void { this.pause(); this.resizeObserver?.disconnect(); this.unbindCanvasInteraction(); if (window.__horizonDebug === this.debugHook) delete window.__horizonDebug; this.host?.classList.remove("is-scene-ready"); this.gl.deleteProgram(this.program); }

  private draw = (timestamp: number): void => {
    if (!this.running) return;
    const deltaMs = this.lastTimestamp > 0 ? timestamp - this.lastTimestamp : 0;
    if (deltaMs > 0) {
      const deltaSeconds = Math.min(.1, deltaMs / 1000);
      this.elapsed += deltaSeconds;
      this.renderAccumulator = Math.min(this.renderAccumulator + deltaSeconds, 2 / Math.max(this.effectiveFps, 1));
      this.observeFramePacing(deltaMs, timestamp);
    }
    this.lastTimestamp = timestamp;
    const interval = 1 / Math.max(this.effectiveFps, 1);
    if (this.renderAccumulator >= interval - .00075) {
      this.renderAccumulator = Math.max(0, this.renderAccumulator - interval);
      this.updateEvents();
      this.renderFrame();
    }
    this.raf = requestAnimationFrame(this.draw);
  };

  /**
   * Keep the shader and its resolution intact, but stop asking a slow device
   * to submit frames it cannot present. This uses rAF cadence rather than
   * reducing procedural layers, so the sea, UFO, meteors and fireworks keep
   * the exact same simulation and visual program at every quality tier.
   */
  private observeFramePacing(deltaMs: number, timestamp: number): void {
    if (this.options.reducedMotion || this.debugTimeLocked || this.targetFps <= 30 || deltaMs > 100) return;
    const sample = Math.max(1, Math.min(60, deltaMs));
    this.frameDeltaEwma += (sample - this.frameDeltaEwma) * .12;
    const slowThreshold = this.effectiveFps >= 60 ? 22.5 : 29.5;
    if (sample >= slowThreshold) {
      this.slowFrameDebt = Math.min(40, this.slowFrameDebt + 1);
      this.fastFrameStreak = 0;
    } else {
      this.slowFrameDebt = Math.max(0, this.slowFrameDebt - .5);
      this.fastFrameStreak += 1;
    }

    if (this.effectiveFps === 60 && this.slowFrameDebt >= 12) {
      this.setEffectiveFps(45, timestamp);
      return;
    }
    if (this.effectiveFps === 45 && this.slowFrameDebt >= 12 && this.frameDeltaEwma >= 25) {
      this.setEffectiveFps(30, timestamp);
      return;
    }
    if (
      this.effectiveFps < this.targetFps
      && timestamp - this.lastPacingChangeAt >= 8_000
      && this.fastFrameStreak >= 360
      && this.frameDeltaEwma < 18.5
    ) {
      this.setEffectiveFps(this.effectiveFps === 30 ? Math.min(45, this.targetFps) : this.targetFps, timestamp);
    }
  }

  private setEffectiveFps(fps: number, timestamp: number): void {
    if (fps === this.effectiveFps) return;
    this.effectiveFps = fps;
    this.renderAccumulator = 0;
    this.slowFrameDebt = 0;
    this.fastFrameStreak = 0;
    this.lastPacingChangeAt = timestamp;
  }
  private location(name: string): WebGLUniformLocation | null { return this.locations.get(name) ?? null; }
  private renderFrame(): void {
    if (!this.atlasReady) return; const gl = this.gl; const cycle = this.getCycleState(); gl.useProgram(this.program);
    gl.uniform2f(this.location("u_resolution"), this.canvas.width, this.canvas.height); gl.uniform1f(this.location("u_time"), this.elapsed); gl.uniform1f(this.location("u_entry"), this.options.reducedMotion ? 1 : this.transitionProgress);
    gl.uniform2f(this.location("u_boat_position"), cycle.position[0], cycle.position[1]); gl.uniform1f(this.location("u_boat_visible"), cycle.visible); gl.uniform1f(this.location("u_boat_lift"), cycle.lift); gl.uniform1f(this.location("u_boat_wake"), cycle.wake); gl.uniform1f(this.location("u_boat_reflection"), cycle.reflection); gl.uniform1f(this.location("u_boat_pitch"), cycle.pitch); gl.uniform1f(this.location("u_splash_strength"), cycle.splash); gl.uniform1f(this.location("u_reduced_motion"), this.options.reducedMotion ? 1 : 0);
    gl.uniform2f(this.location("u_ufo_position"), cycle.ufo[0], cycle.ufo[1]); gl.uniform1f(this.location("u_ufo_visible"), this.ufoAtlasReady ? cycle.ufoVisible : 0); gl.uniform1f(this.location("u_beam_strength"), this.ufoAtlasReady ? cycle.beam : 0); gl.uniform1f(this.location("u_moon_ripple"), cycle.moonRipple);
    this.uploadMeteors(); this.uploadFireworks(); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  private getCycleState(): BoatCycleState {
    const phaseStarts: Record<Exclude<BoatCyclePhase, "sailing">, number> = { "ufo-emerging": 38, "ufo-approaching": 38.9, "beam-opening": 40.1, abducting: 40.65, "returning-to-moon": 41.75, "moon-transfer": 43.2, "boat-respawning": RESPAWN_START_SECONDS, "boat-splashdown": SPLASHDOWN_START_SECONDS, "restart-pause": RESTART_PAUSE_START_SECONDS };
    let local = this.options.reducedMotion ? 37.999 : this.elapsed % CYCLE_SECONDS; let phase: BoatCyclePhase = "sailing";
    if (local >= phaseStarts["restart-pause"]) phase = "restart-pause"; else if (local >= phaseStarts["boat-splashdown"]) phase = "boat-splashdown"; else if (local >= phaseStarts["boat-respawning"]) phase = "boat-respawning"; else if (local >= phaseStarts["moon-transfer"]) phase = "moon-transfer"; else if (local >= phaseStarts["returning-to-moon"]) phase = "returning-to-moon"; else if (local >= phaseStarts.abducting) phase = "abducting"; else if (local >= phaseStarts["beam-opening"]) phase = "beam-opening"; else if (local >= phaseStarts["ufo-approaching"]) phase = "ufo-approaching"; else if (local >= phaseStarts["ufo-emerging"]) phase = "ufo-emerging";
    if (this.cyclePhaseOverride) { phase = this.cyclePhaseOverride; local = phase === "sailing" ? 18 : phaseStarts[phase] + .18; }
    let progress = phase === "sailing" ? smoothstep(0, SAILING_SECONDS, local) * .94 : .94; if (this.boatProgressOverride !== null) progress = this.boatProgressOverride;
    let position: [number, number] = [.61 + (.70 - .61) * progress, .34 + (.41 - .34) * progress + Math.sin(this.elapsed * 1.34) * .0026]; let visible = 1; let lift = 0; let wake = phase === "sailing" ? 1 : .18; let reflection = 1; let verticalVelocity = 0; let pitch = 0; let splash = 0; let ufo: [number, number] = [.846, .817]; let ufoVisible = 0; let beam = 0; let moonRipple = 0;
    if (phase === "ufo-emerging") { const t = smoothstep(38, 38.9, local); ufo = [.846 - t * .075, .817 - t * .11]; ufoVisible = t; }
    if (phase === "ufo-approaching") { const t = smoothstep(38.9, 40.1, local); ufo = [.771 - t * .072, .707 - t * .105 + Math.sin(t * 3.14) * .025]; ufoVisible = 1; }
    if (phase === "beam-opening") { const t = smoothstep(40.1, 40.65, local); ufo = [.699, .627]; ufoVisible = 1; beam = t; wake = 1 - t * .5; }
    if (phase === "abducting") { const t = smoothstep(40.65, 41.75, local); ufo = [.699, .627]; ufoVisible = 1; beam = 1; lift = t; position = [.695 + t * .004, .406 + t * .20]; wake = 1 - t; reflection = 1 - t; }
    if (phase === "returning-to-moon") { const t = smoothstep(41.75, 43.2, local); const arc = Math.sin(t * 3.14159) * .10; ufo = [.699 + t * .147, .627 + t * .190 + arc]; ufoVisible = 1 - smoothstep(.72, 1, t); beam = 1 - t; lift = 1; position = [ufo[0], ufo[1] - .075]; visible = 1 - smoothstep(.82, 1, t); wake = 0; reflection = 0; }
    if (phase === "moon-transfer") { ufo = [.846, .817]; visible = 0; wake = 0; reflection = 0; moonRipple = 1 - smoothstep(43.5, 43.85, local); }
    if (phase === "boat-respawning") { const t = smoothstep(RESPAWN_START_SECONDS, SPLASHDOWN_START_SECONDS, local); position = [.61, .395]; visible = t; lift = 1; wake = 0; reflection = 0; }
    if (phase === "boat-splashdown") {
      const t = Math.max(0, local - SPLASHDOWN_START_SECONDS); const impactTime = .48; const gravity = .48;
      if (t < impactTime) { position = [.61, .395 - .5 * gravity * t * t]; verticalVelocity = -gravity * t; lift = 1; reflection = 0; splash = 0; }
      else {
        const tau = t - impactTime; const damping = .33 * 12.5; const dampedFrequency = 12.5 * Math.sqrt(1 - .33 * .33); const impactVelocity = -gravity * impactTime; const amplitude = impactVelocity / dampedFrequency; const decay = Math.exp(-damping * tau); const sine = Math.sin(dampedFrequency * tau); const cosine = Math.cos(dampedFrequency * tau);
        const displacement = decay * amplitude * sine; verticalVelocity = decay * amplitude * (dampedFrequency * cosine - damping * sine); position = [.61, .34 + displacement]; lift = 1 - smoothstep(0, .56, tau); reflection = smoothstep(.03, .58, tau); splash = smoothstep(0, .035, tau) * Math.exp(-2.35 * tau);
      }
      pitch = Math.max(-.065, Math.min(.065, -verticalVelocity * .24)); visible = 1; wake = 0; progress = 0;
    }
    if (phase === "restart-pause") { position = [.61, .34 + Math.sin(this.elapsed * 1.34) * .0015]; progress = 0; wake = .10; }
    if (this.options.reducedMotion) { phase = "sailing"; progress = 1; position = [.70, .41]; visible = 1; wake = 0; reflection = 1; verticalVelocity = 0; pitch = 0; splash = 0; ufoVisible = 0; beam = 0; }
    if (!this.options.reducedMotion && this.ufoAtlasLoadSettled && !this.ufoAtlasReady) { phase = "sailing"; progress = 1; position = [.70, .41 + Math.sin(this.elapsed * 1.34) * .0015]; visible = 1; lift = 0; wake = .08; reflection = 1; verticalVelocity = 0; pitch = 0; splash = 0; ufoVisible = 0; beam = 0; moonRipple = 0; }
    return { phase, elapsed: local, progress, position, visible, lift, wake, reflection, verticalVelocity, pitch, splash, ufo, ufoVisible, beam, moonRipple };
  }
  private async loadUfoAtlas(): Promise<void> { if (!this.options.ufoAtlasUrl) { this.ufoAtlasLoadSettled = true; return; } try { await this.loadTexture(this.options.ufoAtlasUrl, 2, false); this.ufoAtlasReady = true; } catch (error) { this.ufoAtlasReady = false; console.warn("Horizon UFO atlas fallback active; keeping the moonlit sea live", error); } finally { this.ufoAtlasLoadSettled = true; if (this.ready) this.renderFrame(); } }
  private async loadTexture(url: string, unit: number, repeat: boolean): Promise<WebGLTexture> { const response = await fetch(url); if (!response.ok) throw new Error(`Unable to load Horizon texture: ${url}`); const bitmap = await createImageBitmap(await response.blob()); const gl = this.gl; const texture = gl.createTexture(); if (!texture) throw new Error(`Unable to allocate Horizon texture: ${url}`); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE); bitmap.close(); return texture; }
  private createTransparentTexture(unit: number): void { const gl = this.gl; const texture = gl.createTexture(); if (!texture) return; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0])); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); }
  private random(): number { this.meteorSeed = (Math.imul(this.meteorSeed, 1664525) + 1013904223) >>> 0; return this.meteorSeed / 0x100000000; }
  private nextFireworkRandom(): number { this.fireworkSeed = (Math.imul(this.fireworkSeed, 1103515245) + 12345) >>> 0; return this.fireworkSeed / 0x100000000; }
  private updateEvents(): void {
    if (this.options.reducedMotion || this.transitionProgress < .98) { this.meteorEvents = []; return; }
    this.meteorEvents = this.meteorEvents.filter((event) => this.elapsed < event.start + event.duration + .16);
    this.fireworkGroups = this.fireworkGroups.filter((group) => group.fadeOutStart === null ? this.elapsed < group.start + 5.15 : this.elapsed < group.fadeOutStart + .26);
    if (this.elapsed < this.nextMeteorBatch || this.meteorEvents.length) return;
    const roll = this.random(); const count = roll < .12 ? 7 + Math.floor(this.random() * 2) : 2 + Math.floor(this.random() * 5);
    this.scheduleMeteorBatch(count, this.elapsed + .04); this.nextMeteorBatch = this.elapsed + 6 + this.random() * 6;
  }
  private scheduleMeteorBatch(count: number, start: number): void {
    this.lastMeteorBatchSize = count; const primaryIndex = Math.floor(this.random() * count);
    for (let index = 0; index < count; index += 1) {
      const delay = index * (.068 + this.random() * .065); const primary = index === primaryIndex;
      this.meteorEvents.push({ start: start + delay, duration: 1.04 + this.random() * .28, x: .70 + this.random() * .27, y: .70 + this.random() * .24, dx: -(.16 + this.random() * .13), dy: -(.10 + this.random() * .10), tail: .065 + this.random() * .043, brightness: primary ? 1 : .54 + this.random() * .34 });
    }
  }
  private triggerMeteor(kind: "single" | "triple" | "shower"): void {
    this.debugTimeLocked = false; this.meteorEvents = []; const start = this.elapsed + .08; const count = kind === "shower" ? 8 : kind === "triple" ? 3 : 1;
    if (kind === "single") {
      this.lastMeteorBatchSize = 1;
      this.meteorEvents.push({ start, duration: 1.08, x: .91, y: .88, dx: -.235, dy: -.145, tail: .092, brightness: 1 });
    } else this.scheduleMeteorBatch(count, start);
    if (!this.running && !this.options.reducedMotion) this.resume();
  }
  private triggerDebugFirework(kind: "single" | "cinematic"): void { this.debugTimeLocked = false; const base = kind === "single" ? .52 : .58; this.launchCinematicFirework(base, .73, kind); }
  private launchCinematicFirework(x: number, clickedY: number, mode: "single" | "cinematic" = "cinematic"): void {
    const safeY = clickedY >= .48 ? Math.min(.89, Math.max(.59, clickedY)) : .60 + clamp01(clickedY / .48) * .20;
    const activeGroups = this.fireworkGroups.filter((group) => group.fadeOutStart === null); let delayForRetirement = 0;
    if (activeGroups.length >= MAX_FIREWORK_GROUPS) { activeGroups[0].fadeOutStart = this.elapsed; delayForRetirement = .26; }
    const start = this.elapsed + .03 + delayForRetirement; const events: FireworkEvent[] = [];
    if (mode === "single") {
      events.push({ start, originX: x, burstX: x, burstY: safeY, seed: this.nextFireworkRandom(), palette: "gold-pearl", scale: 1.02, role: "principal", style: "chrysanthemum", tail: .62 });
    } else {
      const principalCount = 3 + (this.nextFireworkRandom() > .55 ? 1 : 0); const companionCount = 3 + Math.floor(this.nextFireworkRandom() * 2); const cometCount = 2 + Math.floor(this.nextFireworkRandom() * 2);
      const principalPalettes: FireworkEvent["palette"][] = ["silver-blue", "gold-pearl", "silver-blue", "gold-pearl"];
      const principalOffsets = [0, -.25, .24, -.39]; const principalHeights = [.08, -.08, .16, -.17];
      for (let index = 0; index < principalCount; index += 1) {
        let burstX = Math.min(.94, Math.max(.08, x + (principalOffsets[index] ?? 0) + (this.nextFireworkRandom() - .5) * .055)); if (Math.abs(burstX - .84) < .065) burstX -= .075;
        const burstY = Math.min(.84, Math.max(.62, safeY + (principalHeights[index] ?? 0) + (this.nextFireworkRandom() - .5) * .045));
        events.push({ start: start + index * .075 + this.nextFireworkRandom() * .045, originX: Math.min(.96, Math.max(.04, burstX + (this.nextFireworkRandom() - .5) * .13)), burstX, burstY, seed: this.nextFireworkRandom(), palette: principalPalettes[index] ?? "gold-pearl", scale: 1.08 + this.nextFireworkRandom() * .27, role: "principal", style: index % 2 === 0 ? "chrysanthemum" : "willow", tail: index % 2 === 0 ? .62 + this.nextFireworkRandom() * .18 : .86 + this.nextFireworkRandom() * .14 });
      }
      for (let index = 0; index < companionCount; index += 1) {
        let burstX = Math.min(.94, Math.max(.08, x + (this.nextFireworkRandom() - .5) * .62)); if (Math.abs(burstX - .74) < .055) burstX += burstX < .74 ? -.065 : .065;
        events.push({ start: start + .22 + this.nextFireworkRandom() * .67, originX: Math.min(.96, Math.max(.04, burstX + (this.nextFireworkRandom() - .5) * .08)), burstX, burstY: Math.min(.86, Math.max(.58, safeY + (this.nextFireworkRandom() - .5) * .30)), seed: this.nextFireworkRandom(), palette: this.nextFireworkRandom() > .48 ? "silver-blue" : "gold-pearl", scale: .68 + this.nextFireworkRandom() * .25, role: "companion", style: this.nextFireworkRandom() > .68 ? "willow" : "chrysanthemum", tail: .48 + this.nextFireworkRandom() * .38 });
      }
      for (let index = 0; index < cometCount; index += 1) {
        const burstX = Math.min(.91, Math.max(.10, x + (index - (cometCount - 1) * .5) * (.075 + this.nextFireworkRandom() * .035)));
        events.push({ start: start + this.nextFireworkRandom() * .56, originX: burstX, burstX, burstY: .61 + this.nextFireworkRandom() * .16, seed: this.nextFireworkRandom(), palette: index % 2 === 0 ? "gold-pearl" : "silver-blue", scale: .62 + this.nextFireworkRandom() * .20, role: "comet", style: "comet", tail: .45 + this.nextFireworkRandom() * .25 });
      }
    }
    this.fireworkGroups.push({ start, events, fadeOutStart: null });
    if (!this.running && !this.options.reducedMotion && !this.debugTimeLocked) this.resume(); this.renderFrame();
  }
  private uploadMeteors(): void { const gl = this.gl; const visible = this.options.reducedMotion ? [] : this.meteorEvents.slice(0, MAX_METEORS); this.meteorA.fill(0); this.meteorB.fill(0); visible.forEach((event, index) => { this.meteorA.set([event.x, event.y, event.dx, event.dy], index * 4); this.meteorB.set([event.start, event.duration, event.tail, event.brightness], index * 4); }); gl.uniform1i(this.location("u_meteor_count"), visible.length); if (visible.length) { gl.uniform4fv(this.location("u_meteor_a[0]"), this.meteorA); gl.uniform4fv(this.location("u_meteor_b[0]"), this.meteorB); } }
  private uploadFireworks(): void {
    const gl = this.gl; const qualityLimit = this.qualityTier === "high" ? MAX_FIREWORKS : this.qualityTier === "balanced" ? 24 : 18;
    const rolePriority: Record<FireworkEvent["role"], number> = { principal: 0, comet: 1, companion: 2 };
    const candidates = this.options.reducedMotion ? [] : this.fireworkGroups
      .filter((group) => group.start <= this.elapsed + .05)
      .sort((a, b) => b.start - a.start)
      .flatMap((group) => group.events.slice().sort((a, b) => rolePriority[a.role] - rolePriority[b.role]).map((event) => ({ event, fade: group.fadeOutStart === null ? 1 : 1 - smoothstep(group.fadeOutStart, group.fadeOutStart + .25, this.elapsed) })))
      .slice(0, qualityLimit);
    this.fireworkA.fill(0); this.fireworkB.fill(0); this.fireworkC.fill(0);
    candidates.forEach(({ event, fade }, index) => {
      this.fireworkA.set([event.originX, event.burstX, event.burstY, event.start], index * 4);
      this.fireworkB.set([event.seed, event.palette === "gold-pearl" ? 0 : event.palette === "silver-blue" ? 1 : 2, event.scale, fade], index * 4);
      this.fireworkC.set([event.role === "principal" ? 0 : event.role === "companion" ? 1 : 2, event.style === "chrysanthemum" ? 0 : event.style === "willow" ? 1 : 2, event.tail, 0], index * 4);
    });
    gl.uniform1i(this.location("u_firework_count"), candidates.length); if (candidates.length) { gl.uniform4fv(this.location("u_firework_a[0]"), this.fireworkA); gl.uniform4fv(this.location("u_firework_b[0]"), this.fireworkB); gl.uniform4fv(this.location("u_firework_c[0]"), this.fireworkC); }
  }
  private bindCanvasInteraction(): void { this.canvas.addEventListener("pointerdown", this.onPointerDown, { passive: true }); this.canvas.addEventListener("pointerup", this.onPointerUp, { passive: true }); this.canvas.addEventListener("pointercancel", this.onPointerCancel, { passive: true }); }
  private unbindCanvasInteraction(): void { this.canvas.removeEventListener("pointerdown", this.onPointerDown); this.canvas.removeEventListener("pointerup", this.onPointerUp); this.canvas.removeEventListener("pointercancel", this.onPointerCancel); }
  private onPointerDown = (event: PointerEvent): void => { if (!event.isPrimary || event.button !== 0) return; this.pointerDown = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp }; };
  private onPointerUp = (event: PointerEvent): void => { const down = this.pointerDown; this.pointerDown = null; if (!down || !event.isPrimary || event.button !== 0 || event.pointerId !== down.id || event.timeStamp - down.time > 650 || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 9) return; this.launchFirework(event.clientX, event.clientY); };
  private onPointerCancel = (): void => { this.pointerDown = null; };
  private debugState(): HorizonDebugState {
    const cycle = this.getCycleState(); const activeFireworkGroups = this.fireworkGroups.filter((group) => group.fadeOutStart === null); const activeEvents = activeFireworkGroups.flatMap((group) => group.events);
    const moonReflectionStrength = (1.02 + .18 * Math.sin(this.elapsed * .019 + 1.1)) * (.96 - cloudFieldApprox(this.elapsed) * .50);
    const boatLampStrength = this.options.reducedMotion ? .82 : Math.max(.62, Math.min(1, .81 + Math.sin(this.elapsed * 7.31) * .10 + Math.sin(this.elapsed * 12.77 + 1.2) * .055 + Math.sin(this.elapsed * 3.17 + .7) * .07));
    const meteorOrigins = this.options.reducedMotion ? [] : this.meteorEvents.map((event): [number, number] => [event.x, event.y]);
    const meteorVelocities = this.options.reducedMotion ? [] : this.meteorEvents.map((event): [number, number] => [event.dx, event.dy]);
    const meteorTails = this.options.reducedMotion ? [] : this.meteorEvents.map((event) => event.tail);
    return {
      ready: this.ready, fallbackActive: !this.ready, atlasReady: this.atlasReady, ufoAtlasReady: this.ufoAtlasReady, qualityTier: this.qualityTier,
      internalResolution: [this.canvas.width, this.canvas.height], targetFps: this.targetFps, effectiveFps: this.effectiveFps, frameDeltaMs: Number(this.frameDeltaEwma.toFixed(2)), transitionProgress: this.transitionProgress, boatProgress: cycle.progress,
      boatScreenPosition: [cycle.position[0], 1 - cycle.position[1]], horizonScreenY: .52, meteorCount: meteorOrigins.length, meteorOrigins, meteorVelocities,
      meteorTailRange: meteorTails.length ? [Math.min(...meteorTails), Math.max(...meteorTails)] : [0, 0], fireworkCount: this.options.reducedMotion ? 0 : activeFireworkGroups.length,
      fireworkEventCount: this.options.reducedMotion ? 0 : activeEvents.length, boatCyclePhase: cycle.phase, ufoVisible: Boolean(this.ufoAtlasReady && cycle.ufoVisible > .01),
      beamStrength: this.ufoAtlasReady ? cycle.beam : 0, boatLift: cycle.lift, boatVisible: cycle.visible, boatVerticalVelocity: cycle.verticalVelocity,
      boatPitch: cycle.pitch, boatLampStrength, splashStrength: cycle.splash, moonReflectionStrength, seaLuminance: .118, cycleElapsed: cycle.elapsed,
      fireworkPrincipalCount: activeEvents.filter((event) => event.role === "principal").length,
      fireworkCompanionCount: activeEvents.filter((event) => event.role !== "principal").length,
      nextMeteorIn: Math.max(0, this.nextMeteorBatch - this.elapsed), lastMeteorBatchSize: this.lastMeteorBatchSize, running: this.running
    };
  }
}

function cloudFieldApprox(time: number): number { return clamp01(.42 + Math.sin(time * .013 + 2.1) * .35 + Math.sin(time * .031) * .16); }

declare global {
  interface Window {
    __horizonDebug?: (() => HorizonDebugState) & {
      triggerMeteor(kind?: "single" | "triple" | "shower"): void; setTime(seconds: number): void; triggerFirework(kind?: "single" | "cinematic"): void;
      triggerUfoCycle(): void; setBoatProgress(progress: number): void; setCyclePhase(phase: BoatCyclePhase): void;
    };
  }
}
