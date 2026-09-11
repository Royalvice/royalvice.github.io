import { cabinProjectionGLSL } from "./Projection";
import { cvSkyGLSL } from "./CvSky";
import { cloudMusicUniforms, cloudMusicMaterial } from '../music/CloudMusicShader';
import { sharedWaveGLSL, oceanBrdfGLSL } from "./Ocean";
export const horizonFragmentSource = `#version 300 es
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
uniform sampler2D u_lighthouse;
uniform float u_cabin;
uniform float u_landmarks_3d;
uniform vec2 u_look;
uniform vec2 u_ship_motion;
${cabinProjectionGLSL}
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

${cloudMusicUniforms}
${cvSkyGLSL}
${cloudMusicMaterial}
${sharedWaveGLSL}
${oceanBrdfGLSL}
vec4 lighthouseLayer(vec2 uv,float aspect) {
 vec2 local=(uv-vec2(.90,.5236))*vec2(aspect,1.)/vec2(.0348,.0872)+.5;
 if(any(lessThan(local,vec2(0.)))||any(greaterThan(local,vec2(1.))))return vec4(0.);
 vec4 c=texture(u_lighthouse,local);c.rgb*=vec3(.89,.91,.92);return c;
}
vec3 lighthouseGlow(vec2 uv,float aspect,float time) {
 vec2 p=(uv-vec2(.90,.560))*vec2(aspect,1.);
 float angle=-2.98+sin(time*.16)*.13;vec2 axis=vec2(cos(angle),sin(angle));
 float along=dot(p,axis),across=abs(p.x*axis.y-p.y*axis.x);
 float beam=exp(-pow(across/max(.0009,.007*along+.0012),2.))*smoothstep(0.,.02,along)*(1.-smoothstep(.38,.70,along));
 return vec3(.91,.80,.54)*(exp(-length(p)*900.)*.90+exp(-length(p)*150.)*.032+beam*.034);
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
  return vec3(.045, .075, .122) * structure * reveal * (1.-u_landmarks_3d) + vec3(.635, 1.0, .690) * signal * reveal + vec3(.184, .749, .471) * exp(-pow(gate.x * 31.0, 2.0) - pow((gate.y - .004) * 72.0, 2.0)) * .19 * reveal;
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
  float depth=saturate((horizon-uv.y)/horizon);
  float distanceToSea=2.2/max(.025,horizon-uv.y);
  vec2 world=vec2((uv.x-.5)*aspect*distanceToSea,distanceToSea);
  vec2 slope=sharedWaveSlope(world,time);
  float farWave=sharedWaveHeight(world,time)*5.0;
  float midWave=sharedWaveHeight(world*1.6,time)*5.0;
  float nearWave=sharedWaveHeight(world*2.3,time)*5.0;
  vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
  vec3 viewDir=normalize(vec3(-world.x,2.2,-world.y));
  float fresnel=.02+.98*pow(1.-max(0.,dot(normal,viewDir)),5.);
  vec3 sea=mix(vec3(.012,.043,.061),vec3(.025,.085,.108),fresnel*.68+.22);
  sea=mix(sea,vec3(.009,.027,.044),smoothstep(.5,1.,depth)*.48);
  sea+=vec3(.14,.20,.21)*pow(max(0.,dot(normal,normalize(vec3(.18,.82,-.55)))),24.)*.028;
  vec3 moonDir=normalize(vec3((.84-.5)*aspect,.35,1.));
  float spec=min(4.,ggxSpecular(normal,viewDir,moonDir,oceanMoonRoughness));
  sea+=vec3(.957,.910,.729)*spec*.026*(.45+.55*fresnel);
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
  sea += vec3(.84, .83, .68) * moonCore * max(moonBreak, moonFine * .55) * moonShape * moonVisibility;
  sea += vec3(.47, .55, .56) * moonSkirt * moonBreak * (.055 + crestMid * .18) * moonVisibility * smoothstep(.38, .78, entry);
  float oasisRoad = exp(-abs(uv.x - (.74 + farWave * .0025)) * mix(138.0, 56.0, depth));
  sea += vec3(.20, .75, .47) * oasisRoad * (1.0 - smoothstep(.08, .55, depth)) * step(.62, fract(uv.y * 280.0 + farWave * 2.4)) * (.05 + oasisSignal * .08) * smoothstep(.42, .82, entry);
  sea += fireworkReflection(uv, aspect, time, farWave, midWave, nearWave);
  vec2 beam = (uv - vec2(u_boat_position.x, u_boat_position.y - .020)) * vec2(aspect, 1.0);
  float beamPool = exp(-pow(beam.x / (.028 + u_beam_strength * .048), 2.0) - pow(beam.y / .025, 2.0)) * u_beam_strength * step(.48, fract(uv.y * 190.0 + midWave));
  sea += vec3(.35, .82, .92) * beamPool * .26;
  if(u_cabin<.5){
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
  }
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

vec3 quantize(vec3 color,vec2 cell,float time) {
 return floor(max(color,vec3(0.))*160.+.5)/160.;
}

#ifdef HORIZON_CLOUD_MUSIC
uniform sampler2D u_wish_glyphs;
uniform float u_wish_age;
vec3 wishFireworks(vec2 uv){
  float age=u_wish_age;
  if(age<0.||age>8.||u_cabin>.5)return vec3(0.);
  // Tiny gold embers converge into type, hold, then fall into the night.
  vec2 p=(uv-vec2(.10,.68))/vec2(.66,.13);
  float fall=max(0.,age-5.);
  p.y+=fall*fall*.027;
  p.x+=sin(p.y*35.+age*2.)*max(0.,age-5.)*.003;
  if(p.x<0.||p.x>1.||p.y<0.||p.y>1.)return vec3(0.);
  vec2 q=vec2(p.x,1.-p.y);
  float mask=texture(u_wish_glyphs,q).a;
  float ember=fract(sin(dot(floor(q*vec2(256.,48.)),vec2(12.9898,78.233)))*43758.5453);
  float reveal=smoothstep(0.,1.2,age);
  float fade=1.-smoothstep(5.5,8.,age);
  float spark=.80+.20*sin(age*5.+ember*6.28);
  float halo=0.;
  for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)halo+=texture(u_wish_glyphs,q+vec2(float(i),float(j))/vec2(256.,48.)).a/9.;
  return (vec3(1.,.85,.46)*mask*spark*1.65+vec3(1.,.51,.17)*halo*.3)*smoothstep(ember*.8,ember*.8+.22,reveal)*fade;
}
#endif

void main() {
  vec2 cell = floor(v_uv * u_resolution); vec2 uv = (cell + .5) / u_resolution;
 if(u_cabin>.5){vec2 p=(uv-.5)*vec2(2.4,1.);float r=u_ship_motion.x;p=mat2(cos(r),-sin(r),sin(r),cos(r))*p;uv=cabinProjection(p/vec2(2.4,1.)+.5)+u_look*vec2(.12,.08)+vec2(0.,u_ship_motion.y);} float aspect = u_resolution.x / max(u_resolution.y, 1.0); if(u_cabin>.5)aspect=1.6; float horizon = .48; float cloud = 0.0; vec3 color;
  if (uv.y >= horizon) {
    color = skyLayer(uv, u_time, u_entry, cloud); color += moonLayer(uv, aspect, cloud, u_entry); float oasisSignal = 0.0; color += oasisLayer(uv, horizon, u_time, u_entry, oasisSignal); color += meteorLayer(uv, aspect, u_time, cloud) * smoothstep(.72, 1.0, u_entry); color += fireworkSky(uv, aspect, u_time);
  } else {
    color = seaLayer(uv, aspect, horizon, u_time, u_entry, .92 + .08 * sin(u_time * .72));
  }
  vec4 tower=lighthouseLayer(uv,aspect);color=mix(color,tower.rgb,tower.a*(1.-u_landmarks_3d));
  color+=lighthouseGlow(uv,aspect,u_time);
  if(u_cabin<.5){
  color += beamLayer(uv, aspect, u_time);
  vec4 boat = boatLayer(uv, aspect, u_time); color = mix(color, boat.rgb, boat.a); color += boatLampLayer(uv, aspect, u_time);
  color += ufoLayer(uv, aspect, u_time);
  }
  color = mix(color, vec3(.034, .068, .086), exp(-abs(uv.y - horizon) * 78.0) * .12 * smoothstep(.28, .9, u_entry));
  color *= 1.0 - smoothstep(.42, .94, length((uv - .5) * vec2(aspect, 1.0))) * .075;
#ifdef HORIZON_CLOUD_MUSIC
  color+=wishFireworks(uv);
#endif
  outColor = vec4(quantize(max(color, 0.0), cell, u_time), 1.0);
}`;
export const horizonMusicFragmentSource = horizonFragmentSource.replace('#version 300 es', '#version 300 es\n#define HORIZON_CLOUD_MUSIC');
