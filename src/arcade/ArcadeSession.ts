/** Native coin pulses remain debounced; the keepsake unlock has no finite balance. */
export class ArcadeSession {
  unlocked = false;
  get coins() { return this.unlocked ? Infinity : 0; }
  ready = false;
  paused = true;
  private held = new Map<number, Set<string>>();
  private coinTimer: ReturnType<typeof setTimeout> | undefined;
  constructor(private send: (button: number, down: boolean) => void) {}
  input(button: number, down: boolean, source: string): boolean {
    if (button < 0 || button > 11 || !Number.isInteger(button)) return false;
    const sources = this.held.get(button) ?? new Set<string>();
    if (!down) {
      sources.delete(source);
      if (!sources.size) { this.held.delete(button); if (button !== 2) this.send(button, false); }
      return false;
    }
    if (!this.ready || this.paused || sources.has(source)) return false;
    const wasHeld = sources.size > 0;
    sources.add(source); this.held.set(button, sources);
    if (wasHeld) return false;
    if (button === 2) {
      if (this.coins <= 0 || this.coinTimer) return false;
      this.send(2, true);
      this.coinTimer = setTimeout(() => { this.send(2, false); this.coinTimer = undefined; }, 100);
      return true;
    }
    this.send(button, true); return true;
  }
  release() {
    clearTimeout(this.coinTimer); this.coinTimer = undefined;
    for (let index = 0; index <= 11; index++) this.send(index, false);
    this.held.clear();
  }
  get pressed() { return [...this.held.keys()]; }
}
