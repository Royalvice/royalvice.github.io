export const cvSkyGLSL = `
            float cvHash(vec2 p) {
                p = fract(p * vec2(123.34, 345.45));
                p += dot(p, p + 34.345 + 260902.0 * 0.00017);
                return fract(p.x * p.y);
            }

            float cvNoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                float a = cvHash(i);
                float b = cvHash(i + vec2(1.0, 0.0));
                float c = cvHash(i + vec2(0.0, 1.0));
                float d = cvHash(i + vec2(1.0, 1.0));
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }

            float cvFbm(vec2 p) {
                float value = 0.0;
                float amplitude = 0.52;
                mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);
                for (int i = 0; i < 5; i++) {
                    value += amplitude * cvNoise(p);
                    p = rotation * p * 2.03 + vec2(7.1, 3.7);
                    amplitude *= 0.49;
                }
                return value;
            }

            float cvMass(vec2 uv, vec2 center, vec2 scale) {
                vec2 q = (uv - center) / scale;
                return exp(-dot(q, q));
            }

            float cvCloudField(vec2 uv) {
 uv.x += sin(u_time * .012) * .006 + u_time * .000035;
                float seedShift = 260902.0 * 0.000013;
                float n1 = cvFbm(vec2(uv.x * 5.1 + seedShift, uv.y * 21.0 - seedShift));
                float n2 = cvFbm(vec2(uv.x * 13.5 - seedShift, uv.y * 51.0 + seedShift));
                float n3 = cvFbm(vec2(uv.x * 29.0 + seedShift * 2.0, uv.y * 112.0 - seedShift));
                float ceiling = smoothstep(0.024, 0.052, uv.y);
                float floorMask = 1.0 - smoothstep((0.151 + sin(uv.x*19.5)*.00072) - 0.007, (0.151 + sin(uv.x*19.5)*.00072) + 0.003, uv.y);
                vec2 cloudUv = uv + vec2((n1 - 0.5) * 0.026, (n2 - 0.5) * 0.011);

                // Two isolated left-side clouds float well above the sea.
                // Each is one continuous anisotropic volume whose contour is
                // displaced by low-frequency density noise. There are no
                // stacked circles and no horizontal pedestal under the cloud.
                // Pixel snapping belongs only to the contour; the lighting
                // model remains continuous and shared with the moon-side bank.
                vec2 cloudPixel = vec2(7.0) / vec2(2480.0,3508.0);
                vec2 leftUv = (floor(cloudUv / cloudPixel) + 0.5) * cloudPixel;

                // Build each cloud from a continuous wind-shaped profile,
                // rather than circles or metaballs.  A low-frequency crest
                // controls the upper contour; a quieter, curved underside
                // keeps the silhouette airborne and removes the "pedestal".
                float cloudOneQ = (leftUv.x - 0.112) / 0.098;
                float cloudOneSpan = sqrt(max(0.0, 1.0 - cloudOneQ * cloudOneQ));
                float cloudOneEdge = 1.0 - smoothstep(0.82, 1.0, abs(cloudOneQ));
                float cloudOneCrest = cvFbm(vec2(
                    cloudOneQ * 1.32 + seedShift * 5.0, 2.71 - seedShift
                ));
                float cloudOneUnder = cvNoise(vec2(
                    cloudOneQ * 2.4 - seedShift * 3.0, 8.13
                ));
                float cloudOneShoulder = exp(-pow((cloudOneQ + 0.42) / 0.38, 2.0));
                float cloudOneCrown = exp(-pow((cloudOneQ - 0.18) / 0.43, 2.0));
                float cloudOneCleft = exp(-pow((cloudOneQ + 0.08) / 0.18, 2.0));
                float cloudOneTop = 0.103
                    - cloudOneSpan * (0.012 + cloudOneCrest * 0.007)
                    - cloudOneShoulder * 0.0070
                    - cloudOneCrown * 0.0120
                    + cloudOneCleft * 0.0042
                    + cloudOneQ * 0.0045;
                float cloudOneUnderCutA = exp(-pow((cloudOneQ + 0.30) / 0.20, 2.0));
                float cloudOneUnderCutB = exp(-pow((cloudOneQ - 0.33) / 0.24, 2.0));
                float cloudOneBottom = 0.106
                    + cloudOneSpan * (0.0065 + cloudOneUnder * 0.0030)
                    - cloudOneUnderCutA * 0.0040
                    - cloudOneUnderCutB * 0.0028
                    + cloudOneQ * 0.0045;
                float cloudOne = smoothstep(
                    cloudOneTop - 0.0035, cloudOneTop + 0.0025, leftUv.y
                ) * (1.0 - smoothstep(
                    cloudOneBottom - 0.0025, cloudOneBottom + 0.0035, leftUv.y
                )) * cloudOneEdge;
                float cloudOneInterior = cvFbm(vec2(
                    leftUv.x * 9.0 + seedShift * 4.0,
                    leftUv.y * 37.0 - seedShift * 2.0
                ));
                cloudOne *= 0.84 + cloudOneInterior * 0.20;

                float cloudTwoQ = (leftUv.x - 0.287) / 0.058;
                float cloudTwoSpan = sqrt(max(0.0, 1.0 - cloudTwoQ * cloudTwoQ));
                float cloudTwoEdge = 1.0 - smoothstep(0.78, 1.0, abs(cloudTwoQ));
                float cloudTwoCrest = cvFbm(vec2(
                    cloudTwoQ * 1.58 - seedShift * 4.0, 5.63 + seedShift
                ));
                float cloudTwoUnder = cvNoise(vec2(
                    cloudTwoQ * 2.8 + seedShift * 2.0, 11.37
                ));
                float cloudTwoShoulder = exp(-pow((cloudTwoQ + 0.43) / 0.34, 2.0));
                float cloudTwoCrown = exp(-pow((cloudTwoQ - 0.14) / 0.40, 2.0));
                float cloudTwoCleft = exp(-pow((cloudTwoQ + 0.09) / 0.17, 2.0));
                float cloudTwoTop = 0.108
                    - cloudTwoSpan * (0.009 + cloudTwoCrest * 0.005)
                    - cloudTwoShoulder * 0.0044
                    - cloudTwoCrown * 0.0080
                    + cloudTwoCleft * 0.0028
                    - cloudTwoQ * 0.0030;
                float cloudTwoUnderCut = exp(-pow((cloudTwoQ - 0.12) / 0.24, 2.0));
                float cloudTwoBottom = 0.111
                    + cloudTwoSpan * (0.0045 + cloudTwoUnder * 0.0022)
                    - cloudTwoUnderCut * 0.0032
                    - cloudTwoQ * 0.0030;
                float cloudTwo = smoothstep(
                    cloudTwoTop - 0.0030, cloudTwoTop + 0.0020, leftUv.y
                ) * (1.0 - smoothstep(
                    cloudTwoBottom - 0.0020, cloudTwoBottom + 0.0030, leftUv.y
                )) * cloudTwoEdge;
                float cloudTwoInterior = cvFbm(vec2(
                    leftUv.x * 11.2 - seedShift * 3.0,
                    leftUv.y * 43.0 + seedShift * 2.0
                ));
                cloudTwo *= 0.86 + cloudTwoInterior * 0.18;

                float leftDensity = max(cloudOne, cloudTwo)
                    * (1.0 - smoothstep(0.350, 0.405, leftUv.x));

                float rightMass = 0.88 * cvMass(cloudUv, vec2(0.895, 0.136), vec2(0.245, 0.024));
                rightMass = max(rightMass, 0.98 * cvMass(cloudUv, vec2(0.738, 0.123), vec2(0.078, 0.031)));
                rightMass = max(rightMass, 1.06 * cvMass(cloudUv, vec2(0.800, 0.111), vec2(0.071, 0.040)));
                rightMass = max(rightMass, 1.14 * cvMass(cloudUv, vec2(0.861, 0.096), vec2(0.074, 0.049)));
                rightMass = max(rightMass, 1.18 * cvMass(cloudUv, vec2(0.920, 0.091), vec2(0.071, 0.051)));
                rightMass = max(rightMass, 1.08 * cvMass(cloudUv, vec2(0.972, 0.108), vec2(0.064, 0.042)));
                rightMass = max(rightMass, 0.98 * cvMass(cloudUv, vec2(1.015, 0.125), vec2(0.052, 0.032)));
                float rightDensity = smoothstep(0.51, 0.97,
                    rightMass + (n1 - 0.5) * 0.32 + (n2 - 0.5) * 0.14)
                    * smoothstep(0.68, 0.76, uv.x);

                float middleMass = cvMass(cloudUv, vec2(0.535, 0.137), vec2(0.23, 0.019));
                float middleDensity = 0.32 * smoothstep(0.58, 0.96,
                    middleMass * (0.62 + n1 * 0.44) + (n2 - 0.5) * 0.12);
                float density = max(max(leftDensity, rightDensity), middleDensity);
                return clamp(density * ceiling * floorMask * 1.20, 0.0, 1.0);
            }


// CV Nocturne, seed 260902. Source: resume/tools/horizon-shader/viewer.html.
// Density profiles and their moon-facing relief are preserved in print coordinates.
vec2 cvCoordinates(vec2 uv) {
  return vec2(uv.x + .104 * smoothstep(.40,.84,uv.x), .108+((1.0-uv.y)-.35)*(.707/(u_cabin>.5?1.6:u_resolution.x/u_resolution.y)));
}
float cloudField(vec2 uv,float time) { return cvCloudField(cvCoordinates(uv)); }
vec3 skyLayer(vec2 screenUv,float time,float entry,out float cloud) {
 vec2 uv=cvCoordinates(screenUv); float aspect=.707;vec2 moonUv=cvCoordinates(vec2(.84,.83));
 vec3 color=mix(vec3(.014,.027,.060),vec3(.018,.058,.086),smoothstep(0.,.151,uv.y));
 float density=cvCloudField(uv);cloud=density;
                 vec2 towardMoon = normalize(moonUv - uv + vec2(0.0001));
                float occlusion = 0.0;
                for (int i = 1; i <= 3; i++) {
                    occlusion += cvCloudField(uv + towardMoon * (0.0042 * float(i)));
                }
                float transmittance = exp(-occlusion * 0.62);
                float towardDensity = cvCloudField(uv + towardMoon * 0.0044);
                float awayDensity = cvCloudField(uv - towardMoon * 0.0034);
                float edgeFacing = clamp((density - towardDensity) * 7.8, 0.0, 1.0);
                float rimBreakup = smoothstep(0.32, 0.82,
                    cvNoise(vec2(uv.x * 103.0, uv.y * 231.0) + 260902.0 * 0.0009));
                edgeFacing *= 0.18 + rimBreakup * 0.82;
                float reliefFacing = clamp(0.42 + (awayDensity - towardDensity) * 2.8, 0.0, 1.0);
                float moonDistance = length(vec2((moonUv.x - uv.x) * aspect, moonUv.y - uv.y));
                float irradiance = exp(-moonDistance * 3.75) * transmittance;
                float rim = irradiance * 0.92 * edgeFacing;
                float underside = smoothstep(0.096, 0.151 - 0.003, uv.y);
                float topLift = 1.0 - smoothstep(0.065, 0.132, uv.y);
                float upperDensity = cvCloudField(uv - vec2(0.0, 0.0085));
                float topFacing = clamp((density - upperDensity) * 2.2, 0.0, 1.0);
                vec2 cloudTextureUv = vec2(uv.x * 7.2 + 3.0, uv.y * 31.0 - 1.0);
                float cloudTexture = cvFbm(cloudTextureUv);
                float cloudTextureX = cvFbm(cloudTextureUv + vec2(0.018, 0.0));
                float cloudTextureY = cvFbm(cloudTextureUv + vec2(0.0, 0.030));
                vec2 textureGradient = vec2(cloudTextureX - cloudTexture, cloudTextureY - cloudTexture);
                vec2 planarLight = normalize(vec2((moonUv.x - uv.x) * aspect, moonUv.y - uv.y) + vec2(0.0001));
                float microRelief = clamp(0.50 + dot(textureGradient, planarLight) * 7.8, 0.0, 1.0);
                vec3 cloudShadow = vec3(0.032, 0.058, 0.099);
                vec3 cloudAmbient = vec3(0.300, 0.368, 0.458);
                vec3 cloudBody = mix(cloudShadow, cloudAmbient,
                    clamp(0.36 + topLift * 0.24 + topFacing * 0.18 + (cloudTexture - 0.5) * 0.36
                        + (microRelief - 0.5) * 0.46 + reliefFacing * 0.19 - underside * 0.24, 0.0, 1.0));
                vec3 cloudLit = mix(cloudBody, vec3(.957,.910,.729) * 0.90, clamp(rim, 0.0, 0.92));
                cloudLit += vec3(.957,.910,.729) * edgeFacing * irradiance * 0.42;


 #ifdef HORIZON_CLOUD_MUSIC
 cloudLit=cloudMusicRelief(cloudLit,screenUv,uv,density,irradiance);
 #endif
 color=mix(color,cloudLit,density*.97);
 vec2 cell=floor(screenUv*vec2(340.,190.));float h=cvHash(cell);
 float star=step(.997,h)*(1.-density)*smoothstep(.51,.80,screenUv.y);
 color+=vec3(.40,.53,.64)*star*(.48+.12*sin(time*.5+h*40.));
 return mix(color*vec3(1.16,.94,.89),color,smoothstep(.08,.86,entry));
}
vec3 moonLayer(vec2 uv,float aspect,float cloud,float entry) {
 vec2 p=(uv-vec2(.84,.83))*vec2(aspect,1.);float radius=.054;
 float pixel=1.0/u_resolution.y;vec2 q=(floor(p/pixel)+.5)*pixel;
 float outer=1.-step(radius,length(q));
 float inner=1.-step(radius*.89,length(q-vec2(-radius*.48,radius*.20)));
 float mask=outer*(1.-inner);float sdf=max(length(p)-radius,-(length(p-vec2(-radius*.48,radius*.20))-radius*.89));
 // The cabin projection already samples a pixel grid. Quantizing again in
 // moon-local coordinates collapses its inner arc at thumbnail resolution.
 // Integrate the original crescent edge over the projected pixel footprint.
 if(u_cabin>.5){
   float footprint=max(length(dFdx(p)),length(dFdy(p)));
   mask=1.-smoothstep(-footprint*.55,footprint*.55,sdf);
 }
 float veil=1.-cloud*.44;vec3 ivory=vec3(.957,.910,.729);
 vec3 glow=ivory*(exp(-max(sdf,0.)*85.)*.22+exp(-max(sdf,0.)*26.)*.075)*veil;
 float grain=.94+.06*cvNoise(q*690.+260902.*.003);
 float ripple=exp(-abs(length(p)-(.063+u_moon_ripple*.028))*380.)*u_moon_ripple;
 return (glow+ivory*mask*grain*.98+ivory*ripple*.24)*smoothstep(.30,.74,entry);
}
`;
