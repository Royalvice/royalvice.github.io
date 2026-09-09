import { horizonMusicFragmentSource as fragmentSource } from "../seascape/HorizonShader";
import type { CloudMusicSurface } from '../music/CloudMusicSurface';
import type { QualityTier } from "../content/site";
import type { TransitionAwareSceneRenderer } from "../scenes/SceneRenderer";

import { SeascapeState, MAX_METEORS, MAX_FIREWORKS, SAILING_SECONDS, RESPAWN_START_SECONDS,
  type BoatCyclePhase, type FireworkEvent, type BoatCycleState } from "../seascape/SeascapeState";
export type { BoatCyclePhase, FireworkEvent } from "../seascape/SeascapeState";
export interface HorizonSceneOptions {
  reducedMotion: boolean;
  qualityTier: QualityTier;
  boatAtlasUrl: string;
  noiseTextureUrl: string;
  /** Loaded with the Horizon chunk. The sea remains live if this atlas cannot load. */
  ufoAtlasUrl?: string;
  onReady?: () => void;
  state?: SeascapeState;
  view?: "horizon" | "cabin";
  music?: CloudMusicSurface;
}

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
  cloudMusic: { enabled: boolean; textureRevision: number; rect: number[]; detailResolution: [number, number] };
}

const vertexSource = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() { v_uv = a_position * .5 + .5; gl_Position = vec4(a_position, 0.0, 1.0); }`;


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
  private musicTexture: WebGLTexture | null = null;
  private musicRevision = 0;
  private sceneFramebuffer: WebGLFramebuffer;
  private sceneColor: WebGLRenderbuffer;
  private sceneWidth = 0;
  private sceneHeight = 0;
  private readonly host: HTMLElement | null;
  private readonly options: HorizonSceneOptions;
  private qualityTier: QualityTier;
  private targetFps = 60; private effectiveFps = 60; private raf = 0; private running = false; private ready = false; private atlasReady = false; private ufoAtlasReady = false; private ufoAtlasLoadSettled = false;
  private renderAccumulator = 0; private frameDeltaEwma = 16.7; private slowFrameDebt = 0; private fastFrameStreak = 0; private lastPacingChangeAt = 0;
  readonly state: SeascapeState;
  private lastTimestamp = 0; private transitionProgress = 0;
  private get elapsed() { return this.state.elapsed; }
  private set elapsed(v:number) { this.state.elapsed=v; }
  private get meteorEvents() { return this.state.meteorEvents; }
  private get fireworkGroups() { return this.state.fireworkGroups; }
  private get nextMeteorBatch() { return this.state.nextMeteorBatch; }
  private get lastMeteorBatchSize() { return this.state.lastMeteorBatchSize; }
  private get debugTimeLocked() { return this.state.debugTimeLocked; }
  private set debugTimeLocked(v:boolean) { this.state.debugTimeLocked=v; }
  private get boatProgressOverride() { return this.state.boatProgressOverride; }
  private set boatProgressOverride(v:number|null) { this.state.boatProgressOverride=v; }
  private get cyclePhaseOverride() { return this.state.cyclePhaseOverride; }
  private set cyclePhaseOverride(v:BoatCyclePhase|null) { this.state.cyclePhaseOverride=v; }
  private readonly meteorA = new Float32Array(MAX_METEORS * 4); private readonly meteorB = new Float32Array(MAX_METEORS * 4);
  private readonly fireworkA = new Float32Array(MAX_FIREWORKS * 4); private readonly fireworkB = new Float32Array(MAX_FIREWORKS * 4); private readonly fireworkC = new Float32Array(MAX_FIREWORKS * 4);
  private resizeObserver: ResizeObserver | null = null;
  private pointerDown: { id: number; x: number; y: number; time: number } | null = null;
  private readonly debugHook: (() => HorizonDebugState) & {
    triggerMeteor: (kind?: "single" | "triple" | "shower") => void; setTime: (seconds: number) => void; triggerFirework: (kind?: "single" | "cinematic") => void;
    triggerUfoCycle: () => void; setBoatProgress: (progress: number) => void; setCyclePhase: (phase: BoatCyclePhase) => void;
  };

  constructor(private readonly canvas: HTMLCanvasElement, options: HorizonSceneOptions) {
    this.options = options; this.state = options.state ?? new SeascapeState(options); this.qualityTier = options.qualityTier; this.host = canvas.closest<HTMLElement>(".horizon-scene");
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("WebGL2 is unavailable for the Horizon scene."); this.gl = gl;
    this.canvas.addEventListener('webglcontextlost', this.contextLost);
    if (options.music) options.music.onInvalidate = () => { if (this.ready && !this.running) this.renderFrame(); };
    const program = gl.createProgram(); if (!program) throw new Error("Unable to allocate Horizon program.");
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource)); gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource)); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Horizon program linking failed."); this.program = program;
    ["u_lighthouse", "u_cabin", "u_look", "u_resolution", "u_time", "u_entry", "u_boat_position", "u_boat_visible", "u_boat_lift", "u_boat_wake", "u_boat_reflection", "u_boat_pitch", "u_splash_strength", "u_reduced_motion", "u_ufo_position", "u_ufo_visible", "u_beam_strength", "u_moon_ripple", "u_meteor_count", "u_meteor_a[0]", "u_meteor_b[0]", "u_firework_count", "u_firework_a[0]", "u_firework_b[0]", "u_firework_c[0]"].forEach((name) => this.locations.set(name, gl.getUniformLocation(program, name)));
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); gl.useProgram(program);
    ['u_music_glyphs', 'u_music_rect', 'u_music_activity', 'u_music_resolution', 'u_music_detail'].forEach(name => this.locations.set(name, gl.getUniformLocation(program, name)));
    gl.uniform1i(this.location('u_music_glyphs'), 4);
    this.musicTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, this.musicTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const position = gl.getAttribLocation(program, "a_position"); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(gl.getUniformLocation(program, "u_noise"), 0); gl.uniform1i(gl.getUniformLocation(program, "u_boat"), 1); gl.uniform1i(gl.getUniformLocation(program, "u_ufo"), 2); gl.uniform1i(gl.getUniformLocation(program,"u_lighthouse"),3);
    const sceneFramebuffer = gl.createFramebuffer(), sceneColor = gl.createRenderbuffer();
    if (!sceneFramebuffer || !sceneColor) throw new Error('Unable to allocate Horizon pixel surface.');
    this.sceneFramebuffer = sceneFramebuffer; this.sceneColor = sceneColor;
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
    this.createTransparentTexture(2); await this.loadTexture("/assets/horizon/directl-moonlit.png",3,false).catch(()=>this.createTransparentTexture(3)); this.resize(); this.resizeObserver = new ResizeObserver(() => this.resize()); if (this.host) this.resizeObserver.observe(this.host);
    this.ready = true; this.transitionProgress = this.options.reducedMotion ? 1 : this.transitionProgress;  this.renderFrame();
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    this.canvas.dataset.sceneReady = "true"; this.host?.classList.add("is-scene-ready"); this.options.onReady?.(); if (this.options.view !== "cabin") window.__horizonDebug = this.debugHook;
    if (!this.options.reducedMotion) { this.bindCanvasInteraction(); void this.loadUfoAtlas(); }
  }

  start(): void { this.resume(); }
  pause(): void { this.running = false; this.lastTimestamp = 0; this.renderAccumulator = 0; cancelAnimationFrame(this.raf); }
  resume(): void { if (!this.ready || this.running || this.options.reducedMotion || this.debugTimeLocked) return; this.running = true; this.lastTimestamp = 0; this.renderAccumulator = 0; this.raf = requestAnimationFrame(this.draw); }
  resize(): void {
    if (this.gl.isContextLost()) return;
    const rect = this.host?.getBoundingClientRect() ?? this.canvas.getBoundingClientRect(); const aspect = rect.width / Math.max(rect.height, 1);
    const targetWidth = this.qualityTier === "high" && rect.width > 760 ? 640 : this.qualityTier === "balanced" ? 480 : 320; const maxPixels = this.qualityTier === "low" ? 230_000 : 270_000;
    let width = targetWidth; let height = Math.max(180, Math.round(width / Math.max(aspect, .38)));
    if (width * height > maxPixels) { const scale = Math.sqrt(maxPixels / (width * height)); width = Math.max(280, Math.floor(width * scale)); height = Math.max(180, Math.floor(height * scale)); }
    width = Math.max(4, Math.round(width / 4) * 4); height = Math.max(4, Math.round(height / 4) * 4);
    // Keep the sea's original pixel budget. Only the small lettering aperture
    // is shaded again at display resolution in the same context and canvas.
    const displayScale = this.options.music ? Math.min(1, 2560 / Math.max(rect.width, rect.height)) : 0;
    const displayWidth = Math.max(width, Math.round(rect.width * displayScale));
    const displayHeight = Math.max(height, Math.round(rect.height * displayScale));
    if (this.sceneWidth === width && this.sceneHeight === height && this.canvas.width === displayWidth && this.canvas.height === displayHeight) return;
    this.sceneWidth = width; this.sceneHeight = height;
    this.canvas.width = displayWidth; this.canvas.height = displayHeight;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFramebuffer);
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.sceneColor);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, width, height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.sceneColor);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!complete) throw new Error('Horizon pixel surface is incomplete.');
    if (this.ready) this.renderFrame();
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
  destroy(): void { this.pause(); this.resizeObserver?.disconnect(); this.unbindCanvasInteraction(); this.canvas.removeEventListener('webglcontextlost', this.contextLost); if (window.__horizonDebug === this.debugHook) delete window.__horizonDebug; this.host?.classList.remove("is-scene-ready"); if (this.options.music) { this.options.music.setReady(false); this.options.music.onInvalidate = null; } this.gl.deleteTexture(this.musicTexture); this.gl.deleteFramebuffer(this.sceneFramebuffer); this.gl.deleteRenderbuffer(this.sceneColor); this.gl.deleteProgram(this.program); }
  private contextLost = () => {
    this.pause(); this.ready = false; this.atlasReady = false;
    this.options.music?.setReady(false);
    this.host?.classList.remove('is-scene-ready'); this.host?.classList.add('horizon-fallback-active');
  };

  private draw = (timestamp: number): void => {
    if (!this.running) return;
    const deltaMs = this.lastTimestamp > 0 ? timestamp - this.lastTimestamp : 0;
    if (deltaMs > 0) {
      const deltaSeconds = Math.min(.1, deltaMs / 1000);
      this.state.advance(timestamp);
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
  renderFrame(): void {
    if (!this.atlasReady) return; const gl = this.gl; const cycle = this.getCycleState(); gl.useProgram(this.program);
    gl.uniform1f(this.location("u_cabin"),this.options.view==="cabin"?1:0);gl.uniform2f(this.location("u_look"),0,0);
    gl.uniform2f(this.location("u_resolution"), this.sceneWidth, this.sceneHeight); gl.uniform1f(this.location("u_time"), this.elapsed); gl.uniform1f(this.location("u_entry"), this.options.reducedMotion ? 1 : this.transitionProgress);
    gl.uniform2f(this.location("u_boat_position"), cycle.position[0], cycle.position[1]); gl.uniform1f(this.location("u_boat_visible"), cycle.visible); gl.uniform1f(this.location("u_boat_lift"), cycle.lift); gl.uniform1f(this.location("u_boat_wake"), cycle.wake); gl.uniform1f(this.location("u_boat_reflection"), cycle.reflection); gl.uniform1f(this.location("u_boat_pitch"), cycle.pitch); gl.uniform1f(this.location("u_splash_strength"), cycle.splash); gl.uniform1f(this.location("u_reduced_motion"), this.options.reducedMotion ? 1 : 0);
    gl.uniform2f(this.location("u_ufo_position"), cycle.ufo[0], cycle.ufo[1]); gl.uniform1f(this.location("u_ufo_visible"), this.ufoAtlasReady ? cycle.ufoVisible : 0); gl.uniform1f(this.location("u_beam_strength"), this.ufoAtlasReady ? cycle.beam : 0); gl.uniform1f(this.location("u_moon_ripple"), cycle.moonRipple);
    this.uploadMusic(); this.uploadMeteors(); this.uploadFireworks();
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFramebuffer);
    gl.viewport(0, 0, this.sceneWidth, this.sceneHeight);
    gl.uniform1f(this.location('u_music_detail'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, this.sceneWidth, this.sceneHeight, 0, 0, this.canvas.width, this.canvas.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    if (this.options.music?.revision) {
      const [x, y, w, h] = this.options.music.rect;
      const left = Math.max(0, Math.floor(x * this.canvas.width));
      const bottom = Math.max(0, Math.floor((1 - y - h) * this.canvas.height));
      const right = Math.min(this.canvas.width, Math.ceil((x + w) * this.canvas.width));
      const top = Math.min(this.canvas.height, Math.ceil((1 - y) * this.canvas.height));
      gl.enable(gl.SCISSOR_TEST); gl.scissor(left, bottom, Math.max(0, right - left), Math.max(0, top - bottom));
      gl.uniform1f(this.location('u_music_detail'), 1);
      gl.uniform2f(this.location('u_music_resolution'), this.canvas.width, this.canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disable(gl.SCISSOR_TEST);
    }
    if (this.options.music?.revision) this.options.music.setReady(true);
  }
  private uploadMusic(): void {
    const music = this.options.music, gl = this.gl;
    if (!music?.revision) return;
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, this.musicTexture);
    if (this.musicRevision !== music.revision) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, music.mask);
      this.musicRevision = music.revision;
    }
    gl.uniform4fv(this.location('u_music_rect'), music.rect);
    gl.uniform2f(this.location('u_music_activity'), music.playing ? 1 : 0, music.hover ? 1 : 0);
  }
  private getCycleState(): BoatCycleState { return this.state.getCycleState(); }
  private async loadUfoAtlas(): Promise<void> { if (!this.options.ufoAtlasUrl) { this.ufoAtlasLoadSettled = true; return; } try { await this.loadTexture(this.options.ufoAtlasUrl, 2, false); this.ufoAtlasReady = true; } catch (error) { this.ufoAtlasReady = false; console.warn("Horizon UFO atlas fallback active; keeping the moonlit sea live", error); } finally { this.ufoAtlasLoadSettled = true; this.state.ufoAtlasReady=this.ufoAtlasReady; this.state.ufoAtlasLoadSettled=true; if (this.ready) this.renderFrame(); } }
  private async loadTexture(url: string, unit: number, repeat: boolean): Promise<WebGLTexture> { const response = await fetch(url); if (!response.ok) throw new Error(`Unable to load Horizon texture: ${url}`); const bitmap = await createImageBitmap(await response.blob()); const gl = this.gl; const texture = gl.createTexture(); if (!texture) throw new Error(`Unable to allocate Horizon texture: ${url}`); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE); bitmap.close(); return texture; }
  private createTransparentTexture(unit: number): void { const gl = this.gl; const texture = gl.createTexture(); if (!texture) return; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0])); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); }
  private updateEvents():void { this.state.updateEvents(); }
  private triggerMeteor(kind:"single"|"triple"|"shower"):void {this.state.triggerMeteor(kind);this.resume();}
  private triggerDebugFirework(kind:"single"|"cinematic"):void {this.state.triggerDebugFirework(kind);this.resume();this.renderFrame();}
  private launchCinematicFirework(x:number,y:number):void {this.state.launchCinematicFirework(x,y);this.resume();this.renderFrame();}
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
      cloudMusic: { enabled: this.musicRevision > 0, textureRevision: this.musicRevision, rect: Array.from(this.options.music?.rect ?? []), detailResolution: [this.canvas.width, this.canvas.height] },
      internalResolution: [this.sceneWidth, this.sceneHeight], targetFps: this.targetFps, effectiveFps: this.effectiveFps, frameDeltaMs: Number(this.frameDeltaEwma.toFixed(2)), transitionProgress: this.transitionProgress, boatProgress: cycle.progress,
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
