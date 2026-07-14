import type { QualityTier } from "../content/site";
import type { TransitionAwareSceneRenderer } from "../scenes/SceneRenderer";

const vertexSource = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * .5 + .5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const fragmentSource = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_transition;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float wave(vec2 p, float t) {
  float a = sin(p.x * 18.0 + p.y * 8.0 + t * 1.15);
  float b = sin(p.x * 31.0 - p.y * 17.0 - t * .82);
  float c = sin((p.x + p.y) * 55.0 + t * 1.72);
  return a * .48 + b * .34 + c * .18;
}

vec3 quantize(vec3 color, float steps, vec2 cell) {
  float dither = (hash(cell) - .5) / steps;
  return floor((color + dither) * steps) / steps;
}

void main() {
  vec2 grid = u_resolution;
  vec2 cell = floor(v_uv * grid);
  vec2 uv = cell / grid;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = vec2((uv.x - .5) * aspect, uv.y);
  float depth = pow(1.0 - uv.y, 1.15);
  float timeScale = mix(1.0, .62, u_transition);
  float w = wave(vec2(p.x * (1.5 + depth), p.y * 2.7), u_time * .62 * timeScale);
  float fine = wave(vec2(p.x * 2.8, p.y * 5.0), -u_time * .34 * timeScale);

  vec3 sunsetDeep = vec3(.025, .12, .18);
  vec3 sunsetNear = vec3(.035, .30, .34);
  vec3 twilightDeep = vec3(.018, .047, .105);
  vec3 twilightNear = vec3(.022, .12, .19);
  vec3 deep = mix(sunsetDeep, twilightDeep, u_transition);
  vec3 nearSea = mix(sunsetNear, twilightNear, u_transition);
  vec3 sea = mix(nearSea, deep, depth);
  sea += mix(vec3(.025, .10, .11), vec3(.025, .045, .09), u_transition) * w;

  float lightRoad = exp(-abs(uv.x - (.73 + w * .018)) * (10.0 + depth * 34.0));
  float crest = smoothstep(.52, .95, w * .55 + fine * .35 + .34);
  float sparkle = pow(max(0.0, sin((uv.x * 1.4 + uv.y) * 210.0 + fine * 9.0 - u_time * 2.2)), 22.0);
  vec3 gold = vec3(.92, .57, .18);
  vec3 moon = vec3(.46, .62, .82);
  float warmWeight = 1.0 - smoothstep(.12, .96, u_transition);
  sea += mix(moon, gold, warmWeight) * lightRoad * (crest * .34 + sparkle * .78) * (1.0 - depth * .48) * mix(.22, 1.0, warmWeight);
  sea += mix(vec3(.20, .45, .40), vec3(.12, .23, .34), u_transition) * crest * .08;

  float nightVeil = smoothstep(.18, 1.0, u_transition) * (1.0 - uv.y) * .035;
  sea -= vec3(nightVeil * .35, nightVeil * .12, 0.0);
  outColor = vec4(quantize(max(sea, 0.0), mix(32.0, 38.0, u_transition), cell), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const result = gl.createShader(type);
  if (!result) throw new Error("Unable to allocate ocean shader.");
  gl.shaderSource(result, source);
  gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(result) || "Ocean shader compilation failed.");
  }
  return result;
}

export class PixelOceanRenderer implements TransitionAwareSceneRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly resolutionLocation: WebGLUniformLocation | null;
  private readonly timeLocation: WebGLUniformLocation | null;
  private readonly transitionLocation: WebGLUniformLocation | null;
  private raf = 0;
  private running = false;
  private lastFrame = 0;
  private fps = 60;
  private transitionProgress = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "low-power" });
    if (!gl) throw new Error("WebGL2 is unavailable for the pixel ocean.");
    this.gl = gl;
    const program = gl.createProgram();
    if (!program) throw new Error("Unable to allocate ocean program.");
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Ocean program linking failed.");
    }
    this.program = program;
    this.resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    this.timeLocation = gl.getUniformLocation(program, "u_time");
    this.transitionLocation = gl.getUniformLocation(program, "u_transition");
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    this.resize();
  }

  start(): void { this.resume(); }

  pause(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  resume(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = 0;
    this.raf = requestAnimationFrame(this.draw);
  }

  resize(): void {
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    const width = mobile ? 320 : this.fps >= 60 ? 640 : 480;
    const rect = this.canvas.getBoundingClientRect();
    const aspect = rect.width / Math.max(rect.height, 1);
    const height = Math.max(180, Math.round(width / Math.max(aspect, .8)));
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  setQuality(tier: QualityTier): void {
    this.fps = tier === "high" ? 60 : tier === "balanced" ? 45 : 30;
    this.resize();
  }

  setTransitionProgress(progress: number): void {
    this.transitionProgress = Math.min(1, Math.max(0, progress));
  }

  destroy(): void {
    this.pause();
    this.gl.deleteProgram(this.program);
  }

  private draw = (timestamp: number): void => {
    if (!this.running) return;
    const interval = 1000 / this.fps;
    if (timestamp - this.lastFrame >= interval - 1) {
      this.lastFrame = timestamp;
      const gl = this.gl;
      gl.useProgram(this.program);
      gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.timeLocation, timestamp / 1000);
      gl.uniform1f(this.transitionLocation, this.transitionProgress);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    this.raf = requestAnimationFrame(this.draw);
  };
}
