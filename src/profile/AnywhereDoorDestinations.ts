import destinations from '../../public/assets/profile/anywhere-door-v2/manifest.json';

/** A destination belongs to one opening, never to a wall-clock slideshow. */
export class AnywhereDoorDestinations {
  private images = new Map<number, HTMLImageElement>();
  private failed = new Set<number>();
  private pending = new Map<number, Promise<void>>();
  private index = -1;
  private open = false;
  private disposed = false;
  private lastImage: HTMLImageElement | null = null;

  constructor(private onChange: () => void) {}

  async init() {
    await this.load(0);
    // Small local textures; optional destinations cannot delay room initialization.
    void Promise.all(destinations.map((_, i) => this.load(i)));
  }

  private load(index: number): Promise<void> {
    const existing = this.pending.get(index);
    if (existing) return existing;
    const job = new Promise<void>(resolve => {
      const image = new Image();
      image.onload = () => {
        if (!this.disposed) { this.images.set(index, image); this.onChange(); }
        resolve();
      };
      image.onerror = () => { this.failed.add(index); resolve(); };
      image.src = destinations[index].url;
    });
    this.pending.set(index, job);
    return job;
  }

  setOpen(open: boolean) {
    if (open && !this.open) this.index = (this.index + 1) % destinations.length;
    this.open = open;
  }

  getState() {
    return { index: Math.max(0, this.index), destination: destinations[Math.max(0, this.index)],
      count: destinations.length, loaded: this.images.size, failed: this.failed.size, open: this.open };
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
    const image = this.images.get(Math.max(0, this.index)) ?? this.lastImage ?? this.images.get(0);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
    ctx.fillStyle = '#13201f'; ctx.fillRect(x, y, width, height);
    if (image) {
      this.lastImage = image;
      // Cover preserves pixel proportions even when the door sprite is narrower.
      const scale = Math.max(width / image.width, height / image.height);
      const sw = width / scale, sh = height / scale;
      ctx.imageSmoothingEnabled = false;
      const focusX = destinations[Math.max(0, this.index)].focusX;
      ctx.drawImage(image, (image.width - sw) * focusX, (image.height - sh) / 2, sw, sh, x, y, width, height);
    }
    // A recessed jamb and sill place the landscape behind the physical door.
    const shade = ctx.createLinearGradient(x, y, x + width, y);
    shade.addColorStop(0, 'rgba(12,9,15,.45)');
    shade.addColorStop(.16, 'rgba(12,9,15,0)');
    shade.addColorStop(.87, 'rgba(12,9,15,0)');
    shade.addColorStop(1, 'rgba(12,9,15,.3)');
    ctx.fillStyle = shade; ctx.fillRect(x, y, width, height);
    ctx.fillStyle = 'rgba(28,17,22,.65)'; ctx.fillRect(x, y, width, 1);
    ctx.fillStyle = '#a89072'; ctx.fillRect(x, y + height - 1, width, 1);
    ctx.restore();
  }

  destroy() { this.disposed = true; this.images.clear(); this.lastImage = null; }
}
