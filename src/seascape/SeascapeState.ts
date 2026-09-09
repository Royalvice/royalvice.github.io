import { NIGHT, WAVE_COMPONENTS } from "./Ocean";
export const MAX_METEORS = 10;
export const MAX_FIREWORKS = 33;
export const MAX_FIREWORK_GROUPS = 3;
export const SAILING_SECONDS = 38;
export const RESPAWN_START_SECONDS = 43.85;
export const SPLASHDOWN_START_SECONDS = 44.15;
export const RESTART_PAUSE_START_SECONDS = 45.75;
export const CYCLE_SECONDS = 47.75;

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

export type MeteorEvent = {
  start: number;
  duration: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  tail: number;
  brightness: number;
};

export type FireworkGroup = { start: number; events: FireworkEvent[]; fadeOutStart: number | null };

export type BoatCycleState = {
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


/** Shared simulation, never owned by a camera or a modal. */
export class SeascapeState {
  elapsed = RESPAWN_START_SECONDS;
  meteorEvents: MeteorEvent[] = [];
  fireworkGroups: FireworkGroup[] = [];
  nextMeteorBatch = RESPAWN_START_SECONDS + 2.5;
  lastMeteorBatchSize = 0;
  private meteorSeed = 0x4f415349;
  private fireworkSeed = 0x1d0a515;
  debugTimeLocked = false;
  boatProgressOverride: number | null = null;
  cyclePhaseOverride: BoatCyclePhase | null = null;
  ufoAtlasReady = true;
  ufoAtlasLoadSettled = false;
  private timestamp = 0;
  readonly landmarks = { lighthouse: [.90, .48] as const, oasis: [.74, .48] as const };
  constructor(private options: { reducedMotion: boolean }) {
    if (options.reducedMotion) this.elapsed = SAILING_SECONDS;
  }
  advance(timestamp: number): void {
    const dt = this.timestamp ? Math.min(.1, Math.max(0,(timestamp-this.timestamp)/1000)) : 0;
    this.timestamp = timestamp;
    if (!this.debugTimeLocked && !this.options.reducedMotion && !document.hidden) {
      this.elapsed += dt;
      this.updateEvents();
    }
  }
  resetTimestamp(): void { this.timestamp = 0; }
  setTime(seconds:number): void { this.elapsed=Math.max(0,seconds);this.debugTimeLocked=true; }
  snapshot() { return { time:this.elapsed, cycle:this.getCycleState(), landmarks:this.landmarks, light:NIGHT,waves:WAVE_COMPONENTS,
    meteors:this.meteorEvents, fireworks:this.fireworkGroups, locked:this.debugTimeLocked }; }
  getCycleState(): BoatCycleState {
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
  private random(): number { this.meteorSeed = (Math.imul(this.meteorSeed, 1664525) + 1013904223) >>> 0; return this.meteorSeed / 0x100000000; }
  private nextFireworkRandom(): number { this.fireworkSeed = (Math.imul(this.fireworkSeed, 1103515245) + 12345) >>> 0; return this.fireworkSeed / 0x100000000; }
  updateEvents(): void {
    if (this.options.reducedMotion) { this.meteorEvents = []; return; }
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
  triggerMeteor(kind: "single" | "triple" | "shower"): void {
    this.debugTimeLocked = false; this.meteorEvents = []; const start = this.elapsed + .08; const count = kind === "shower" ? 8 : kind === "triple" ? 3 : 1;
    if (kind === "single") {
      this.lastMeteorBatchSize = 1;
      this.meteorEvents.push({ start, duration: 1.08, x: .91, y: .88, dx: -.235, dy: -.145, tail: .092, brightness: 1 });
    } else this.scheduleMeteorBatch(count, start);

  }
  triggerDebugFirework(kind: "single" | "cinematic"): void { this.debugTimeLocked = false; const base = kind === "single" ? .52 : .58; this.launchCinematicFirework(base, .73, kind); }
  launchCinematicFirework(x: number, clickedY: number, mode: "single" | "cinematic" = "cinematic"): void {
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

  }
}

function clamp01(x:number){return Math.min(1,Math.max(0,x));}
function smoothstep(a:number,b:number,x:number){const t=clamp01((x-a)/(b-a));return t*t*(3-2*t);}
