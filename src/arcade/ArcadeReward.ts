export const ARCADE_REWARD_KEY = 'yzy.arcade.wish-coin.v1';
type Reward = { clicks: number; earned: boolean; inserted: boolean };
/** A keepsake, shared by all cabinets and persisted independently of game sessions. */
export class ArcadeReward extends EventTarget {
  private value: Reward = { clicks: 0, earned: false, inserted: false };
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | null) {
    super(); this.read();
  }
  private read() {
    try {
      const saved = JSON.parse(this.storage?.getItem(ARCADE_REWARD_KEY) ?? 'null');
      if (saved) this.value = { clicks: Math.min(6, Math.max(0, Math.floor(Number(saved.clicks) || 0))), earned: saved.earned === true || saved.inserted === true, inserted: saved.inserted === true };
    } catch { /* Storage disabled: keep the reward for this visit. */ }
  }
  sync() { this.read(); this.dispatchEvent(new Event('change')); }
  get state(): Readonly<Reward> { return { ...this.value }; }
  private save() {
    try { this.storage?.setItem(ARCADE_REWARD_KEY, JSON.stringify(this.value)); } catch { /* In-memory persistence remains usable. */ }
    this.dispatchEvent(new Event('change'));
  }
  firework(): boolean {
    this.read();
    if (this.value.earned) return false;
    this.value.clicks = Math.min(6, this.value.clicks + 1);
    this.value.earned = this.value.clicks === 6;
    this.save(); return this.value.earned;
  }
  insert(): 'empty' | 'already' | 'inserted' {
    this.read();
    if (this.value.inserted) return 'already';
    if (!this.value.earned) return 'empty';
    this.value.inserted = true; this.save(); return 'inserted';
  }
}
let storage: Storage | null = null;
try { storage = window.localStorage; } catch { /* Private storage may be unavailable. */ }
export const arcadeReward = new ArcadeReward(storage);
window.addEventListener('storage', event => { if (event.key === ARCADE_REWARD_KEY || event.key === null) arcadeReward.sync(); });
