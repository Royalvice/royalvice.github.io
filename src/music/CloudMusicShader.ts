// Only Horizon compiles this material. The cabin shares CvSky without music.
export const cloudMusicUniforms = `
#ifdef HORIZON_CLOUD_MUSIC
uniform sampler2D u_music_glyphs;
uniform vec4 u_music_rect;
uniform vec2 u_music_activity;
uniform vec2 u_music_resolution;
uniform float u_music_detail;
vec3 cloudMusicRelief(vec3 body, vec2 screenUv, vec2 cloudUv, inout float density, float irradiance);
#endif
`;

export const cloudMusicMaterial = `
#ifdef HORIZON_CLOUD_MUSIC
vec3 cloudMusicRelief(vec3 body, vec2 screenUv, vec2 cloudUv, inout float density, float irradiance) {
  if (u_music_detail < .5 || u_music_rect.z <= .0 || u_cabin > .5) return body;
  // Sky/water retain their coarse grid; letter coverage uses the display grid.
  screenUv = v_uv;
  cloudUv = cvCoordinates(screenUv);
  vec2 p = (vec2(screenUv.x, 1.0-screenUv.y)-u_music_rect.xy)/u_music_rect.zw;
  if (any(lessThan(p,vec2(.0))) || any(greaterThan(p,vec2(1.0)))) return body;
  float time = u_time * (1.0-u_reduced_motion);
  vec2 field = cloudUv*vec2(47.0,191.0)+vec2(time*.026,-time*.013);
  float vapour = cvFbm(field);
  vec2 pixel = 1.0/(u_music_resolution*u_music_rect.zw);
  // Advect only the surrounding vapour. Stable glyphs keep their counters open.
  vec2 flow = vec2(cvNoise(field+9.1),cvNoise(field-7.3))-.5;
  vec3 glyph = texture(u_music_glyphs,p).rgb;
  glyph.g = texture(u_music_glyphs,p+flow*pixel*(1.0-u_reduced_motion)).g;
  float core = smoothstep(.40,.60,glyph.r);
  vec2 relief = vec2(.35,.65);
  float above = dot(texture(u_music_glyphs,p-vec2(.0,pixel.y*.65)).rg,relief);
  float below = dot(texture(u_music_glyphs,p+vec2(.0,pixel.y*.65)).rg,relief);
  float left = dot(texture(u_music_glyphs,p-vec2(pixel.x*.65,.0)).rg,relief);
  float right = dot(texture(u_music_glyphs,p+vec2(pixel.x*.65,.0)).rg,relief);
  // Raised cloud filaments: the moon-facing ridge is warm, the underside blue.
  vec3 normal = normalize(vec3((left-right)*.95,(below-above)*.95,1.0));
  vec2 towardMoon = normalize((vec2(.84,.83)-screenUv)*vec2(u_resolution.x/u_resolution.y,1.0));
  vec3 light = normalize(vec3(towardMoon*.86,.68));
  float facing = max(.0,dot(normal,light));
  float veil = smoothstep(.43,.78,cvFbm(field*.56+vec2(-time*.055,2.7)));
  float breath = sin(time*.65)*.5+.5;
  float illumination = .92 + .16*facing + .04*breath*u_music_activity.x;
  vec3 silver = mix(vec3(.48,.60,.70),vec3(.957,.910,.729),facing*.88);
  vec3 raised = silver*illumination*(.96+vapour*.08+irradiance*.14);
  raised = mix(body*1.6,raised,mix(.85,1.0,glyph.b));
  float presence = (.98-veil*.04+u_music_activity.y*.02)*mix(.94,1.0,glyph.b);
  float shadow = max(.0,above-core)*.16;
  body *= 1.0-shadow;
  body += vec3(.28,.36,.43)*glyph.g*(1.0-core)*(.30+vapour*.28);
  body = mix(body,raised,core*presence);
  // Condensation is part of the cloud density, not a separate emissive decal.
  density = max(density,max(core*.94,glyph.g*.82));
  return body;
}
#endif
`;
