import type { QualityTier } from "../content/site";
import type { TransitionAwareSceneRenderer } from "../scenes/SceneRenderer";

const MAX_METEORS = 4;
const MAX_FIREWORKS = 15;
const MAX_FIREWORK_GROUPS = 3;
const SAILING_SECONDS = 38;
const CYCLE_SECONDS = 46.75;

export type BoatCyclePhase =
  | "sailing"
  | "ufo-emerging"
  | "ufo-approaching"
  | "beam-opening"
  | "abducting"
  | "returning-to-moon"
  | "moon-transfer"
  | "boat-respawning"
  | "restart-pause";

export interface FireworkEvent {
  start: number;
  originX: number;
  burstX: number;
  burstY: number;
  seed: number;
  palette: "gold-pearl" | "silver-blue" | "oasis-emerald";
  scale: number;
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

type FireworkGroup = { start: number; events: FireworkEvent[] };

type BoatCycleState = {
  phase: BoatCyclePhase;
  elapsed: number;
  progress: number;
  position: [number, number];
  visible: number;
  lift: number;
  wake: number;
  reflection: number;
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
  transitionProgress: number;
  boatProgress: number;
  boatScreenPosition: [number, number];
  horizonScreenY: number;
  meteorCount: number;
  fireworkCount: number;
  fireworkEventCount: number;
  boatCyclePhase: BoatCyclePhase;
  ufoVisible: boolean;
  beamStrength: number;
  boatLift: number;
  moonReflectionStrength: number;
  seaLuminance: number;
  cycleElapsed: number;
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
uniform vec2 u_ufo_position;
uniform float u_ufo_visible;
uniform float u_beam_strength;
uniform float u_moon_ripple;
uniform sampler2D u_noise;
uniform sampler2D u_boat;
uniform sampler2D u_ufo;
uniform int u_meteor_count;
uniform vec4 u_meteor_a[4];
uniform vec4 u_meteor_b[4];
uniform int u_firework_count;
uniform vec4 u_firework_a[15];
uniform vec4 u_firework_b[15];
uniform vec4 u_firework_c[15];

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
  for (int i = 0; i < 4; i++) {
    if (i >= u_meteor_count) continue;
    vec4 a = u_meteor_a[i]; vec4 b = u_meteor_b[i]; float age = (time - b.x) / max(b.y, .001);
    if (age < 0.0 || age > 1.0) continue;
    vec2 head = a.xy + a.zw * smoothstep(.04, .92, age); vec2 direction = normalize(a.zw * ratio); vec2 point = uv * ratio; vec2 hp = head * ratio;
    float lengthNow = b.z * smoothstep(.04, .22, age) * (1.0 - smoothstep(.72, 1.0, age)); vec2 tail = hp - direction * lengthNow; vec2 segment = hp - tail;
    float along = clamp(dot(point - tail, segment) / max(dot(segment, segment), .000001), 0.0, 1.0); float dist = length(point - (tail + segment * along));
    float fade = smoothstep(.0, .08, age) * (1.0 - smoothstep(.74, 1.0, age)) * (1.0 - cloud * .72) * b.w;
    light += vec3(.58, .72, .92) * smoothstep(.0042, .0006, dist) * step(.56, fract(along * 13.0 + float(i) * .27)) * .40 * fade;
    light += vec3(.82, .90, 1.0) * smoothstep(.0028, .0004, dist) * smoothstep(.58, .92, along) * .80 * fade;
    light += vec3(1.0, .96, .78) * exp(-length(abs(point - hp)) * 720.0) * 1.5 * fade;
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
  float launch = smoothstep(.02, .13, age) * (1.0 - smoothstep(.30, .42, age));
  float burst = smoothstep(.34, .47, age) * (1.0 - smoothstep(.98, 1.28, age));
  float secondary = smoothstep(.82, 1.06, age) * (1.0 - smoothstep(1.65, 2.15, age));
  float ember = smoothstep(1.16, 1.5, age) * (1.0 - smoothstep(3.35, 3.95, age));
  return max(max(launch, burst), max(secondary, ember));
}

vec3 fireworkSky(vec2 uv, float aspect, float time) {
  vec3 light = vec3(0.0); vec2 point = uv * vec2(aspect, 1.0);
  for (int i = 0; i < 15; i++) {
    if (i >= u_firework_count) continue;
    vec4 a = u_firework_a[i]; vec4 b = u_firework_b[i]; vec4 c = u_firework_c[i]; float age = time - a.w;
    if (age < 0.0 || age > 4.05) continue;
    vec2 origin = vec2(a.x, .105); vec2 burst = a.yz; float palette = b.y; float scale = b.z; float seed = b.x;
    vec2 launchHead = mix(origin, burst, smoothstep(.0, .36, age)); vec2 launchPoint = launchHead * vec2(aspect, 1.0); vec2 launchStart = origin * vec2(aspect, 1.0);
    vec2 line = launchPoint - launchStart; float launchT = clamp(dot(point - launchStart, line) / max(dot(line, line), .000001), 0.0, 1.0); float launchDist = length(point - (launchStart + line * launchT));
    float launch = smoothstep(.0032, .00065, launchDist) * smoothstep(.01, .07, age) * (1.0 - smoothstep(.33, .42, age));
    light += fireworkColor(palette, .22) * launch * (.62 + launchT * .5);
    for (int ray = 0; ray < 18; ray++) {
      float id = float(ray); float angle = id * .349066 + seed * 6.283 + hash(vec2(seed, id)) * .19;
      vec2 direction = vec2(cos(angle), sin(angle)); float spread = (.026 + hash(vec2(id, seed)) * .035) * scale;
      float mainAge = saturate((age - .37) / .92); vec2 end = burst + direction * spread * mainAge + vec2(0.0, -.022 * mainAge * mainAge);
      vec2 bp = burst * vec2(aspect, 1.0); vec2 ep = end * vec2(aspect, 1.0); vec2 segment = ep - bp; float along = clamp(dot(point - bp, segment) / max(dot(segment, segment), .000001), 0.0, 1.0); float d = length(point - (bp + segment * along));
      float main = smoothstep(.0031, .00055, d) * smoothstep(.34, .48, age) * (1.0 - smoothstep(1.12, 1.42, age)) * smoothstep(.03, .98, along);
      float head = exp(-length(point - ep) * 440.0) * smoothstep(.36, .48, age) * (1.0 - smoothstep(.95, 1.30, age));
      light += fireworkColor(palette, fract(id * .37 + seed)) * (main * (.48 + along) + head * 1.22);
      if (ray < 10) {
        float subAge = saturate((age - .91) / .85); vec2 subStart = burst + direction * spread * .63; float subAngle = angle + (hash(vec2(seed + 4.0, id)) - .5) * 1.4; vec2 subEnd = subStart + vec2(cos(subAngle), sin(subAngle)) * (.014 + hash(vec2(id, seed + 2.0)) * .018) * subAge + vec2(0.0, -.018 * subAge * subAge);
        vec2 sp = subStart * vec2(aspect, 1.0); vec2 se = subEnd * vec2(aspect, 1.0); vec2 ss = se - sp; float sa = clamp(dot(point - sp, ss) / max(dot(ss, ss), .000001), 0.0, 1.0); float sd = length(point - (sp + ss * sa));
        light += fireworkColor(palette, .82) * smoothstep(.0021, .00042, sd) * smoothstep(.91, 1.06, age) * (1.0 - smoothstep(1.62, 2.10, age)) * .72;
      }
      if (ray < 13) {
        float emberAge = saturate((age - 1.16) / 2.55); vec2 ember = burst + direction * spread * (.55 + hash(vec2(id, seed + 9.0)) * .5) + vec2(0.0, -.018 - emberAge * emberAge * (.055 + hash(vec2(seed, id + 3.0)) * .035));
        float ed = length(point - ember * vec2(aspect, 1.0));
        light += fireworkColor(palette, .65) * exp(-ed * 420.0) * smoothstep(1.12, 1.48, age) * (1.0 - smoothstep(3.35, 3.95, age)) * .75;
      }
    }
    float smoke = exp(-length((uv - burst) * vec2(aspect, 1.0)) * 34.0) * smoothstep(1.05, 1.7, age) * (1.0 - smoothstep(3.15, 4.05, age));
    light += vec3(.26, .31, .40) * smoke * .14;
  }
  return light;
}

vec3 fireworkReflection(vec2 uv, float aspect, float time, float farWave, float midWave, float nearWave) {
  vec3 light = vec3(0.0);
  for (int i = 0; i < 15; i++) {
    if (i >= u_firework_count) continue;
    vec4 a = u_firework_a[i]; vec4 b = u_firework_b[i]; float age = time - a.w;
    if (age < .18 || age > 4.05) continue;
    float phase = fireworkEnergy(age); float depth = saturate((.48 - uv.y) / .48); float width = mix(.006, .038, smoothstep(.10, .68, depth));
    float center = a.y + midWave * (.005 + depth * .012) + nearWave * depth * .004;
    float strips = step(.50 + (nearWave + midWave) * .08, fract(uv.y * 230.0 + farWave * 2.1 + float(i) * .17));
    float trail = exp(-abs(uv.x - center) * aspect / width) * strips * exp(-depth * 1.7);
    light += fireworkColor(b.y, .62) * trail * phase * (.12 + .19 * (1.0 - depth));
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
  float moonCenter = .84 + farWave * .004 + midWave * .006 * depth; float moonWidth = mix(122.0, 31.0, depth);
  float moonRoad = exp(-abs(uv.x - moonCenter) * moonWidth); float moonBreak = step(.42 + nearWave * .08, fract(uv.y * 330.0 + farWave * 1.8 + midWave * .7));
  float moonShape = mix(.92, .20, depth) * (crestFar * .65 + crestMid * .42 + .045) * smoothstep(.36, .78, entry);
  sea += vec3(.60, .72, .87) * moonRoad * moonBreak * moonShape * (1.0 - cloudField(vec2(.84, .83), time) * .64);
  float oasisRoad = exp(-abs(uv.x - (.74 + farWave * .0025)) * mix(138.0, 56.0, depth));
  sea += vec3(.20, .75, .47) * oasisRoad * (1.0 - smoothstep(.08, .55, depth)) * step(.62, fract(uv.y * 280.0 + farWave * 2.4)) * (.05 + oasisSignal * .08) * smoothstep(.42, .82, entry);
  sea += fireworkReflection(uv, aspect, time, farWave, midWave, nearWave);
  vec2 beam = (uv - vec2(u_boat_position.x, u_boat_position.y - .020)) * vec2(aspect, 1.0);
  float beamPool = exp(-pow(beam.x / (.028 + u_beam_strength * .048), 2.0) - pow(beam.y / .025, 2.0)) * u_beam_strength * step(.48, fract(uv.y * 190.0 + midWave));
  sea += vec3(.35, .82, .92) * beamPool * .26;
  vec2 boatPosition = u_boat_position;
  vec2 localScale = vec2(.138, .104); vec2 local = ((uv - boatPosition) * vec2(aspect, 1.0)) / localScale + .5; float frame = floor(mod(time * 2.5, 12.0));
  float shadow = exp(-pow((uv.x - boatPosition.x) * aspect / .054, 2.0) - pow((uv.y - (boatPosition.y - .034 - u_boat_lift * .13)) / .010, 2.0));
  sea *= 1.0 - shadow * .25 * u_boat_visible * (1.0 - u_boat_lift);
  vec2 wakeDelta = (uv - (boatPosition - vec2(.045, .030))) * vec2(aspect, 1.0); float wakeDistance = max(0.0, -wakeDelta.x);
  float wake = (exp(-abs(wakeDelta.y - wakeDistance * .27) * 260.0) + exp(-abs(wakeDelta.y + wakeDistance * .20) * 260.0)) * step(wakeDelta.x, 0.0) * exp(-wakeDistance * 11.0) * step(.44, fract((wakeDistance + uv.y) * 170.0 + nearWave));
  sea += vec3(.33, .48, .59) * wake * .23 * u_boat_visible * u_boat_wake;
  vec2 reflectionCenter = vec2(boatPosition.x + midWave * .002, boatPosition.y - (.078 - u_boat_lift * .045));
  vec2 reflectionLocal = ((vec2(uv.x, reflectionCenter.y + (reflectionCenter.y - uv.y)) - boatPosition) * vec2(aspect, 1.0)) / localScale + .5; reflectionLocal.x += midWave * .028;
  vec4 reflection = sampleBoat(reflectionLocal, frame); sea = mix(sea, reflection.rgb * vec3(.18, .27, .38), reflection.a * step(.52, fract(uv.y * 240.0 + midWave * 2.2)) * .23 * u_boat_visible * u_boat_reflection);
  vec4 boat = sampleBoat(local, frame); sea = mix(sea, boat.rgb, boat.a * u_boat_visible);
  return sea;
}

vec3 ufoLayer(vec2 uv, float aspect, float time) {
  if (u_ufo_visible <= .001) return vec3(0.0);
  vec2 local = ((uv - u_ufo_position) * vec2(aspect, 1.0)) / vec2(.112, .070) + .5;
  vec4 ufo = sampleUfo(local, floor(mod(time * 7.0, 8.0))); vec3 light = ufo.rgb * ufo.a * u_ufo_visible;
  float halo = exp(-length((uv - u_ufo_position) * vec2(aspect, 1.0)) * 48.0) * u_ufo_visible;
  light += vec3(.33, .55, .86) * halo * .10;
  if (u_beam_strength > .001) {
    float vertical = smoothstep(u_boat_position.y - .014, u_ufo_position.y - .018, uv.y);
    float width = mix(.012, .069, saturate((u_ufo_position.y - uv.y) / max(.01, u_ufo_position.y - u_boat_position.y))) * u_beam_strength;
    float beam = vertical * smoothstep(width, width * .70, abs((uv.x - u_ufo_position.x) * aspect)) * u_beam_strength;
    beam *= step(.44, noiseAt(uv * vec2(130.0, 90.0) + time * .016));
    light += vec3(.31, .78, .90) * beam * .26;
  }
  return light;
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
  private fps = 60; private raf = 0; private running = false; private ready = false; private atlasReady = false; private ufoAtlasReady = false; private ufoAtlasLoadSettled = false;
  private lastFrame = 0; private elapsed = 0; private lastTimestamp = 0; private transitionProgress = 0; private bridgeActive = false;
  private meteorEvents: MeteorEvent[] = []; private readonly meteorA = new Float32Array(MAX_METEORS * 4); private readonly meteorB = new Float32Array(MAX_METEORS * 4);
  private readonly fireworkA = new Float32Array(MAX_FIREWORKS * 4); private readonly fireworkB = new Float32Array(MAX_FIREWORKS * 4); private readonly fireworkC = new Float32Array(MAX_FIREWORKS * 4);
  private fireworkGroups: FireworkGroup[] = []; private nextMeteorBatch = 3.5; private meteorSeed = 0x4f415349; private fireworkSeed = 0x1d0a515;
  private debugTimeLocked = false; private boatProgressOverride: number | null = null; private cyclePhaseOverride: BoatCyclePhase | null = null; private resizeObserver: ResizeObserver | null = null;
  private pointerDown: { id: number; x: number; y: number; time: number } | null = null;
  private readonly debugHook: (() => HorizonDebugState) & {
    triggerMeteor: (kind?: "single" | "triple") => void; setTime: (seconds: number) => void; triggerFirework: (kind?: "single" | "cinematic") => void;
    triggerUfoCycle: () => void; setBoatProgress: (progress: number) => void; setCyclePhase: (phase: BoatCyclePhase) => void;
  };

  constructor(private readonly canvas: HTMLCanvasElement, options: HorizonSceneOptions) {
    this.options = options; this.qualityTier = options.qualityTier; this.host = canvas.closest<HTMLElement>(".horizon-scene");
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "low-power", preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 is unavailable for the Horizon scene."); this.gl = gl;
    const program = gl.createProgram(); if (!program) throw new Error("Unable to allocate Horizon program.");
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource)); gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource)); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Horizon program linking failed."); this.program = program;
    ["u_resolution", "u_time", "u_entry", "u_boat_position", "u_boat_visible", "u_boat_lift", "u_boat_wake", "u_boat_reflection", "u_ufo_position", "u_ufo_visible", "u_beam_strength", "u_moon_ripple", "u_meteor_count", "u_meteor_a[0]", "u_meteor_b[0]", "u_firework_count", "u_firework_a[0]", "u_firework_b[0]", "u_firework_c[0]"].forEach((name) => this.locations.set(name, gl.getUniformLocation(program, name)));
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); gl.useProgram(program);
    const position = gl.getAttribLocation(program, "a_position"); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(gl.getUniformLocation(program, "u_noise"), 0); gl.uniform1i(gl.getUniformLocation(program, "u_boat"), 1); gl.uniform1i(gl.getUniformLocation(program, "u_ufo"), 2);
    this.setQuality(options.qualityTier);
    this.debugHook = Object.assign(() => this.debugState(), {
      triggerMeteor: (kind: "single" | "triple" = "single") => this.triggerMeteor(kind),
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
    this.ready = true; this.transitionProgress = this.options.reducedMotion ? 1 : this.transitionProgress; this.elapsed = this.options.reducedMotion ? SAILING_SECONDS : 0; this.renderFrame();
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    this.canvas.dataset.sceneReady = "true"; this.host?.classList.add("is-scene-ready"); this.options.onReady?.(); window.__horizonDebug = this.debugHook;
    if (!this.options.reducedMotion) { this.bindCanvasInteraction(); this.loadUfoAtlas(); this.start(); }
  }

  start(): void { this.resume(); }
  pause(): void { this.running = false; this.lastTimestamp = 0; cancelAnimationFrame(this.raf); }
  resume(): void { if (!this.ready || this.running || this.options.reducedMotion || this.debugTimeLocked) return; this.running = true; this.lastFrame = 0; this.lastTimestamp = 0; this.raf = requestAnimationFrame(this.draw); }
  resize(): void {
    const rect = this.host?.getBoundingClientRect() ?? this.canvas.getBoundingClientRect(); const aspect = rect.width / Math.max(rect.height, 1);
    const targetWidth = this.qualityTier === "high" && rect.width > 760 ? 640 : this.qualityTier === "balanced" ? 480 : 320; const maxPixels = this.qualityTier === "low" ? 230_000 : 270_000;
    let width = targetWidth; let height = Math.max(180, Math.round(width / Math.max(aspect, .38)));
    if (width * height > maxPixels) { const scale = Math.sqrt(maxPixels / (width * height)); width = Math.max(280, Math.floor(width * scale)); height = Math.max(180, Math.floor(height * scale)); }
    width = Math.max(4, Math.round(width / 4) * 4); height = Math.max(4, Math.round(height / 4) * 4);
    if (this.canvas.width === width && this.canvas.height === height) return; this.canvas.width = width; this.canvas.height = height; this.gl.viewport(0, 0, width, height); if (this.ready) this.renderFrame();
  }
  setQuality(tier: QualityTier): void { this.qualityTier = tier; this.fps = tier === "high" ? 60 : tier === "balanced" ? 45 : 30; this.resize(); }
  setTransitionProgress(progress: number): void { this.transitionProgress = clamp01(progress); if (this.ready && (!this.running || this.options.reducedMotion)) this.renderFrame(); }
  setBridgeActive(active: boolean): void { this.bridgeActive = active; if (this.ready && !this.running) this.renderFrame(); }
  launchFirework(viewportX: number, viewportY: number): void { if (!this.ready || this.options.reducedMotion) return; const rect = this.canvas.getBoundingClientRect(); const x = clamp01((viewportX - rect.left) / Math.max(rect.width, 1)); const y = clamp01(1 - (viewportY - rect.top) / Math.max(rect.height, 1)); this.launchCinematicFirework(x, y); }
  triggerUfoCycle(): void { if (this.options.reducedMotion || !this.ufoAtlasReady) return; this.elapsed = SAILING_SECONDS; this.boatProgressOverride = null; this.cyclePhaseOverride = null; this.renderFrame(); }
  setBoatProgress(progress: number): void { this.boatProgressOverride = clamp01(progress); this.renderFrame(); }
  destroy(): void { this.pause(); this.resizeObserver?.disconnect(); this.unbindCanvasInteraction(); if (window.__horizonDebug === this.debugHook) delete window.__horizonDebug; this.host?.classList.remove("is-scene-ready"); this.gl.deleteProgram(this.program); }

  private draw = (timestamp: number): void => { if (!this.running) return; if (this.lastTimestamp > 0) this.elapsed += Math.min(.1, (timestamp - this.lastTimestamp) / 1000); this.lastTimestamp = timestamp; const interval = 1000 / this.fps; if (timestamp - this.lastFrame >= interval - 1) { this.lastFrame = timestamp; this.updateEvents(); this.renderFrame(); } this.raf = requestAnimationFrame(this.draw); };
  private location(name: string): WebGLUniformLocation | null { return this.locations.get(name) ?? null; }
  private renderFrame(): void {
    if (!this.atlasReady) return; const gl = this.gl; const cycle = this.getCycleState(); gl.useProgram(this.program);
    gl.uniform2f(this.location("u_resolution"), this.canvas.width, this.canvas.height); gl.uniform1f(this.location("u_time"), this.elapsed); gl.uniform1f(this.location("u_entry"), this.options.reducedMotion ? 1 : this.transitionProgress);
    gl.uniform2f(this.location("u_boat_position"), cycle.position[0], cycle.position[1]); gl.uniform1f(this.location("u_boat_visible"), this.bridgeActive ? 0 : cycle.visible); gl.uniform1f(this.location("u_boat_lift"), cycle.lift); gl.uniform1f(this.location("u_boat_wake"), cycle.wake); gl.uniform1f(this.location("u_boat_reflection"), cycle.reflection);
    gl.uniform2f(this.location("u_ufo_position"), cycle.ufo[0], cycle.ufo[1]); gl.uniform1f(this.location("u_ufo_visible"), this.ufoAtlasReady ? cycle.ufoVisible : 0); gl.uniform1f(this.location("u_beam_strength"), this.ufoAtlasReady ? cycle.beam : 0); gl.uniform1f(this.location("u_moon_ripple"), cycle.moonRipple);
    this.uploadMeteors(); this.uploadFireworks(); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  private getCycleState(): BoatCycleState {
    const phaseStarts: Record<Exclude<BoatCyclePhase, "sailing">, number> = { "ufo-emerging": 38, "ufo-approaching": 38.9, "beam-opening": 40.1, abducting: 40.65, "returning-to-moon": 41.75, "moon-transfer": 43.2, "boat-respawning": 43.85, "restart-pause": 44.75 };
    let local = this.options.reducedMotion ? 37.999 : this.elapsed % CYCLE_SECONDS; let phase: BoatCyclePhase = "sailing";
    if (local >= phaseStarts["restart-pause"]) phase = "restart-pause"; else if (local >= phaseStarts["boat-respawning"]) phase = "boat-respawning"; else if (local >= phaseStarts["moon-transfer"]) phase = "moon-transfer"; else if (local >= phaseStarts["returning-to-moon"]) phase = "returning-to-moon"; else if (local >= phaseStarts.abducting) phase = "abducting"; else if (local >= phaseStarts["beam-opening"]) phase = "beam-opening"; else if (local >= phaseStarts["ufo-approaching"]) phase = "ufo-approaching"; else if (local >= phaseStarts["ufo-emerging"]) phase = "ufo-emerging";
    if (this.cyclePhaseOverride) { phase = this.cyclePhaseOverride; local = phase === "sailing" ? 18 : phaseStarts[phase] + .18; }
    let progress = phase === "sailing" ? smoothstep(0, SAILING_SECONDS, local) * .94 : .94; if (this.boatProgressOverride !== null) progress = this.boatProgressOverride;
    let position: [number, number] = [.61 + (.70 - .61) * progress, .34 + (.41 - .34) * progress + Math.sin(this.elapsed * 1.34) * .0026]; let visible = 1; let lift = 0; let wake = phase === "sailing" ? 1 : .18; let reflection = 1; let ufo: [number, number] = [.846, .817]; let ufoVisible = 0; let beam = 0; let moonRipple = 0;
    if (phase === "ufo-emerging") { const t = smoothstep(38, 38.9, local); ufo = [.846 - t * .075, .817 - t * .11]; ufoVisible = t; }
    if (phase === "ufo-approaching") { const t = smoothstep(38.9, 40.1, local); ufo = [.771 - t * .072, .707 - t * .105 + Math.sin(t * 3.14) * .025]; ufoVisible = 1; }
    if (phase === "beam-opening") { const t = smoothstep(40.1, 40.65, local); ufo = [.699, .627]; ufoVisible = 1; beam = t; wake = 1 - t * .5; }
    if (phase === "abducting") { const t = smoothstep(40.65, 41.75, local); ufo = [.699, .627]; ufoVisible = 1; beam = 1; lift = t; position = [.695 + t * .004, .406 + t * .20]; wake = 1 - t; reflection = 1 - t; }
    if (phase === "returning-to-moon") { const t = smoothstep(41.75, 43.2, local); const arc = Math.sin(t * 3.14159) * .10; ufo = [.699 + t * .147, .627 + t * .190 + arc]; ufoVisible = 1 - smoothstep(.72, 1, t); beam = 1 - t; lift = 1; position = [ufo[0], ufo[1] - .075]; visible = 1 - smoothstep(.82, 1, t); wake = 0; reflection = 0; }
    if (phase === "moon-transfer") { ufo = [.846, .817]; visible = 0; wake = 0; reflection = 0; moonRipple = 1 - smoothstep(43.5, 43.85, local); }
    if (phase === "boat-respawning") { const t = smoothstep(43.85, 44.75, local); position = [.61, .34 + Math.sin(this.elapsed * 1.34) * .0015]; visible = t; wake = t * .23; reflection = t; }
    if (phase === "restart-pause") { position = [.61, .34 + Math.sin(this.elapsed * 1.34) * .0015]; progress = 0; wake = .10; }
    if (this.options.reducedMotion) { phase = "sailing"; progress = 1; position = [.70, .41]; visible = 1; wake = 0; reflection = 1; ufoVisible = 0; beam = 0; }
    if (!this.options.reducedMotion && this.ufoAtlasLoadSettled && !this.ufoAtlasReady) { phase = "sailing"; progress = 1; position = [.70, .41 + Math.sin(this.elapsed * 1.34) * .0015]; visible = 1; lift = 0; wake = .08; reflection = 1; ufoVisible = 0; beam = 0; moonRipple = 0; }
    return { phase, elapsed: local, progress, position, visible, lift, wake, reflection, ufo, ufoVisible, beam, moonRipple };
  }
  private async loadUfoAtlas(): Promise<void> { if (!this.options.ufoAtlasUrl) { this.ufoAtlasLoadSettled = true; return; } try { await this.loadTexture(this.options.ufoAtlasUrl, 2, false); this.ufoAtlasReady = true; } catch (error) { this.ufoAtlasReady = false; console.warn("Horizon UFO atlas fallback active; keeping the moonlit sea live", error); } finally { this.ufoAtlasLoadSettled = true; if (this.ready) this.renderFrame(); } }
  private async loadTexture(url: string, unit: number, repeat: boolean): Promise<WebGLTexture> { const response = await fetch(url); if (!response.ok) throw new Error(`Unable to load Horizon texture: ${url}`); const bitmap = await createImageBitmap(await response.blob()); const gl = this.gl; const texture = gl.createTexture(); if (!texture) throw new Error(`Unable to allocate Horizon texture: ${url}`); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE); bitmap.close(); return texture; }
  private createTransparentTexture(unit: number): void { const gl = this.gl; const texture = gl.createTexture(); if (!texture) return; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0])); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); }
  private random(): number { this.meteorSeed = (Math.imul(this.meteorSeed, 1664525) + 1013904223) >>> 0; return this.meteorSeed / 0x100000000; }
  private nextFireworkRandom(): number { this.fireworkSeed = (Math.imul(this.fireworkSeed, 1103515245) + 12345) >>> 0; return this.fireworkSeed / 0x100000000; }
  private updateEvents(): void { if (this.options.reducedMotion || this.transitionProgress < .98) { this.meteorEvents = []; return; } this.meteorEvents = this.meteorEvents.filter((event) => this.elapsed < event.start + event.duration + .16); this.fireworkGroups = this.fireworkGroups.filter((group) => this.elapsed < group.start + 4.1); if (this.elapsed < this.nextMeteorBatch || this.meteorEvents.length) return; const roll = this.random(); this.scheduleMeteorBatch(roll > .91 ? 3 : roll > .72 ? 2 : 1, this.elapsed + .04); this.nextMeteorBatch = this.elapsed + 12 + this.random() * 14; }
  private scheduleMeteorBatch(count: number, start: number): void { const brightness = [1, .72, .52]; for (let index = 0; index < count; index += 1) { const delay = index * (.24 + this.random() * .22); this.meteorEvents.push({ start: start + delay, duration: .95 + this.random() * .25, x: .72 + this.random() * .23, y: .75 + this.random() * .18, dx: -(.16 + this.random() * .09), dy: -(.11 + this.random() * .07), tail: .045 + this.random() * .024, brightness: brightness[index] ?? .5 }); } }
  private triggerMeteor(kind: "single" | "triple"): void { this.debugTimeLocked = false; const start = this.elapsed + .08; this.meteorEvents = kind === "triple" ? [{ start, duration: 1.08, x: .92, y: .89, dx: -.22, dy: -.15, tail: .061, brightness: 1 }, { start: start + .10, duration: 1.12, x: .84, y: .80, dx: -.19, dy: -.13, tail: .054, brightness: .72 }, { start: start + .21, duration: 1.02, x: .75, y: .91, dx: -.17, dy: -.12, tail: .048, brightness: .52 }] : [{ start, duration: 1.08, x: .88, y: .88, dx: -.21, dy: -.145, tail: .060, brightness: 1 }]; if (!this.running && !this.options.reducedMotion) this.resume(); }
  private triggerDebugFirework(kind: "single" | "cinematic"): void { this.debugTimeLocked = false; const base = kind === "single" ? .52 : .58; this.launchCinematicFirework(base, .73, kind === "single" ? 1 : 4); }
  private launchCinematicFirework(x: number, clickedY: number, count = 4): void { const safeY = clickedY >= .48 ? clamp01(clickedY) : .60 + clamp01(clickedY / .48) * .17; const start = this.elapsed + .03; const events: FireworkEvent[] = []; const major = Math.min(2, count); for (let index = 0; index < count; index += 1) { const primary = index < major; const offset = primary ? (index === 0 ? 0 : .18 + this.nextFireworkRandom() * .14) : .16 + this.nextFireworkRandom() * .55; const spread = primary ? (index === 0 ? 0 : (this.nextFireworkRandom() - .5) * .18) : (this.nextFireworkRandom() - .5) * .28; const y = clamp01(safeY + (primary ? (this.nextFireworkRandom() - .5) * .08 : (this.nextFireworkRandom() - .5) * .16)); const palettes: FireworkEvent["palette"][] = ["gold-pearl", "silver-blue", "gold-pearl", this.nextFireworkRandom() > .88 ? "oasis-emerald" : "silver-blue"]; events.push({ start: start + offset, originX: x, burstX: clamp01(x + spread), burstY: Math.max(.56, y), seed: this.nextFireworkRandom(), palette: palettes[index] ?? "gold-pearl", scale: primary ? .95 + this.nextFireworkRandom() * .2 : .55 + this.nextFireworkRandom() * .18 }); }
    this.fireworkGroups.push({ start, events }); while (this.fireworkGroups.length > MAX_FIREWORK_GROUPS) this.fireworkGroups.shift(); if (!this.running && !this.options.reducedMotion && !this.debugTimeLocked) this.resume(); this.renderFrame(); }
  private uploadMeteors(): void { const gl = this.gl; const visible = this.options.reducedMotion ? [] : this.meteorEvents.slice(0, MAX_METEORS); this.meteorA.fill(0); this.meteorB.fill(0); visible.forEach((event, index) => { this.meteorA.set([event.x, event.y, event.dx, event.dy], index * 4); this.meteorB.set([event.start, event.duration, event.tail, event.brightness], index * 4); }); gl.uniform1i(this.location("u_meteor_count"), visible.length); if (visible.length) { gl.uniform4fv(this.location("u_meteor_a[0]"), this.meteorA); gl.uniform4fv(this.location("u_meteor_b[0]"), this.meteorB); } }
  private uploadFireworks(): void { const gl = this.gl; const visible = this.options.reducedMotion ? [] : this.fireworkGroups.flatMap((group) => group.events).slice(0, MAX_FIREWORKS); this.fireworkA.fill(0); this.fireworkB.fill(0); this.fireworkC.fill(0); visible.forEach((event, index) => { this.fireworkA.set([event.originX, event.burstX, event.burstY, event.start], index * 4); this.fireworkB.set([event.seed, event.palette === "gold-pearl" ? 0 : event.palette === "silver-blue" ? 1 : 2, event.scale, 0], index * 4); }); gl.uniform1i(this.location("u_firework_count"), visible.length); if (visible.length) { gl.uniform4fv(this.location("u_firework_a[0]"), this.fireworkA); gl.uniform4fv(this.location("u_firework_b[0]"), this.fireworkB); gl.uniform4fv(this.location("u_firework_c[0]"), this.fireworkC); } }
  private bindCanvasInteraction(): void { this.canvas.addEventListener("pointerdown", this.onPointerDown, { passive: true }); this.canvas.addEventListener("pointerup", this.onPointerUp, { passive: true }); this.canvas.addEventListener("pointercancel", this.onPointerCancel, { passive: true }); }
  private unbindCanvasInteraction(): void { this.canvas.removeEventListener("pointerdown", this.onPointerDown); this.canvas.removeEventListener("pointerup", this.onPointerUp); this.canvas.removeEventListener("pointercancel", this.onPointerCancel); }
  private onPointerDown = (event: PointerEvent): void => { if (!event.isPrimary || event.button !== 0) return; this.pointerDown = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp }; };
  private onPointerUp = (event: PointerEvent): void => { const down = this.pointerDown; this.pointerDown = null; if (!down || !event.isPrimary || event.button !== 0 || event.pointerId !== down.id || event.timeStamp - down.time > 650 || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 9) return; this.launchFirework(event.clientX, event.clientY); };
  private onPointerCancel = (): void => { this.pointerDown = null; };
  private debugState(): HorizonDebugState { const cycle = this.getCycleState(); const moonReflectionStrength = (.68 + .18 * Math.sin(this.elapsed * .019 + 1.1)) * (1 - cloudFieldApprox(this.elapsed) * .64); return { ready: this.ready, fallbackActive: !this.ready, atlasReady: this.atlasReady, ufoAtlasReady: this.ufoAtlasReady, qualityTier: this.qualityTier, internalResolution: [this.canvas.width, this.canvas.height], transitionProgress: this.transitionProgress, boatProgress: cycle.progress, boatScreenPosition: [cycle.position[0], 1 - cycle.position[1]], horizonScreenY: .52, meteorCount: this.options.reducedMotion ? 0 : this.meteorEvents.length, fireworkCount: this.options.reducedMotion ? 0 : this.fireworkGroups.length, fireworkEventCount: this.options.reducedMotion ? 0 : this.fireworkGroups.reduce((total, group) => total + group.events.length, 0), boatCyclePhase: cycle.phase, ufoVisible: Boolean(this.ufoAtlasReady && cycle.ufoVisible > .01), beamStrength: this.ufoAtlasReady ? cycle.beam : 0, boatLift: cycle.lift, moonReflectionStrength, seaLuminance: .112, cycleElapsed: cycle.elapsed, running: this.running }; }
}

function cloudFieldApprox(time: number): number { return clamp01(.42 + Math.sin(time * .013 + 2.1) * .35 + Math.sin(time * .031) * .16); }

declare global {
  interface Window {
    __horizonDebug?: (() => HorizonDebugState) & {
      triggerMeteor(kind?: "single" | "triple"): void; setTime(seconds: number): void; triggerFirework(kind?: "single" | "cinematic"): void;
      triggerUfoCycle(): void; setBoatProgress(progress: number): void; setCyclePhase(phase: BoatCyclePhase): void;
    };
  }
}
