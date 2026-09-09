/** Glyph coverage only. Colour, relief, light and passing mist are computed in
 * Horizon's cloud shader, using the existing scene/context and moon light. */
export class CloudMusicSurface {
  readonly mask = document.createElement('canvas');
  readonly rect = new Float32Array(4);
  revision = 0;
  playing = false;
  hover = false;
  onInvalidate: (() => void) | null = null;
  private signature = '';
  private destroyed = false;
  private observer: ResizeObserver;
  private heading: HTMLElement;
  private scene: HTMLElement;

  constructor(private cloud: HTMLElement) {
    this.heading = cloud.querySelector('.music-cloud-title')!;
    this.scene = cloud.closest('.horizon-scene')!;
    this.observer = new ResizeObserver(() => this.measure());
    this.observer.observe(this.heading);
    this.observer.observe(this.scene);
    cloud.addEventListener('pointerenter', this.enter);
    cloud.addEventListener('pointerleave', this.leave);
    cloud.addEventListener('focusin', this.enter);
    cloud.addEventListener('focusout', this.leave);
    void document.fonts.ready.then(() => { if (!this.destroyed) { this.signature = ''; this.measure(); } });
    this.measure();
  }

  private enter = () => { this.hover = true; };
  private leave = () => { this.hover = false; };
  setReady(ready: boolean) { this.cloud.dataset.cloudMaterial = String(ready); }

  measure() {
    if (this.destroyed) return;
    const scene = this.scene.getBoundingClientRect(), title = this.heading.getBoundingClientRect();
    if (!scene.width || !scene.height || !title.width || !title.height) return;
    const padding = 6;
    const oldRect = this.rect.join(',');
    this.rect.set([(title.left - scene.left - padding) / scene.width, (title.top - scene.top - padding) / scene.height,
      (title.width + padding * 2) / scene.width, (title.height + padding * 2) / scene.height]);
    const main = this.heading.querySelector('strong')!, artist = this.heading.querySelector('span')!;
    const mainStyle = getComputedStyle(main), artistStyle = getComputedStyle(artist);
    const signature = [title.width, title.height, mainStyle.font, artistStyle.font, mainStyle.letterSpacing].join('|');
    if (signature === this.signature) { if (oldRect !== this.rect.join(',')) this.onInvalidate?.(); return; }
    this.signature = signature;
    const scale = 2, width = Math.ceil((title.width + padding * 2) * scale), height = Math.ceil((title.height + padding * 2) * scale);
    const glyphs = document.createElement('canvas'); glyphs.width = width; glyphs.height = height;
    const ctx = glyphs.getContext('2d')!; ctx.scale(scale, scale); ctx.textBaseline = 'top';
    for (const [element, style, text, tone] of [[main, mainStyle, 'Returning Home', '#ffffff'], [artist, artistStyle, 'Parijat', '#8c8c8c']] as const) {
      const box = element.getBoundingClientRect();
      ctx.font = style.font; ctx.fillStyle = tone;
      ctx.letterSpacing = style.letterSpacing;
      ctx.fillText(text, padding + box.left - title.left, padding + box.top - title.top);
    }
    const sharp = ctx.getImageData(0, 0, width, height);
    const mist = document.createElement('canvas'); mist.width = width; mist.height = height;
    const blur = mist.getContext('2d')!; blur.filter = 'blur(4px)'; blur.drawImage(glyphs, 0, 0);
    const soft = blur.getImageData(0, 0, width, height);
    // R = glyph density, G = soft vapour envelope, B = title/artist emphasis.
    for (let i = 0; i < sharp.data.length; i += 4) {
      const emphasis = sharp.data[i];
      sharp.data[i] = sharp.data[i + 3]; sharp.data[i + 1] = soft.data[i + 3];
      sharp.data[i + 2] = emphasis; sharp.data[i + 3] = 255;
    }
    this.mask.width = width; this.mask.height = height; this.mask.getContext('2d')!.putImageData(sharp, 0, 0);
    this.revision++;
    this.onInvalidate?.();
  }

  destroy() {
    this.destroyed = true; this.observer.disconnect(); this.setReady(false); this.onInvalidate = null;
    this.cloud.removeEventListener('pointerenter', this.enter); this.cloud.removeEventListener('pointerleave', this.leave);
    this.cloud.removeEventListener('focusin', this.enter); this.cloud.removeEventListener('focusout', this.leave);
  }
}
