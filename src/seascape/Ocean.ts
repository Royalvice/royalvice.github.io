/** Shared world-space swell and moonlit optical palette. */
export const NIGHT = { moon:[.957,.910,.729], deep:[.012,.043,.061], mid:[.025,.085,.108], highlight:[.64,.71,.68], fog:[.024,.050,.072] } as const;
export const OCEAN_ROUGHNESS = { sun: .25, moon: .28 } as const;
export const WAVE_COMPONENTS = [
  { direction: [1, .18], wavelength: 7.8, amplitude: .110, speed: .48, steepness: .22 },
  { direction: [.36, .93], wavelength: 4.2, amplitude: .052, speed: .72, steepness: .18 },
  { direction: [-.74, .67], wavelength: 2.1, amplitude: .024, speed: 1.05, steepness: .14 },
  { direction: [.58, -.82], wavelength: .7, amplitude: .008, speed: 1.6, steepness: .08 }
] as const;

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

export const sharedWaveGLSL = `
float sharedWaveHeight(vec2 p, float t) {
  return ${waveHeightTerms};
}
vec2 sharedWaveSlope(vec2 p, float t) {
  return vec2(${waveSlopeTermsX}, ${waveSlopeTermsZ});
}
vec2 sharedWaveHorizontal(vec2 p, float t) {
  return vec2(${waveHorizontalTermsX}, ${waveHorizontalTermsZ});
}`;


export function sampleOcean(x:number,z:number,t:number){
 let height=0,dx=0,dz=0;
 for(const w of WAVE_COMPONENTS){const length=Math.hypot(...w.direction),nx=w.direction[0]/length,nz=w.direction[1]/length,k=2*Math.PI/w.wavelength;
 const phase=k*(nx*x+nz*z)+w.speed*t;height+=w.amplitude*Math.sin(phase);dx+=w.amplitude*k*nx*Math.cos(phase);dz+=w.amplitude*k*nz*Math.cos(phase);}
 return {height,dx,dz};
}

export const oceanBrdfGLSL = `
const float oceanSunRoughness = ${OCEAN_ROUGHNESS.sun};
const float oceanMoonRoughness = ${OCEAN_ROUGHNESS.moon};
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

`;
