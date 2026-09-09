import '../styles/home-music.css';
import { CloudMusicSurface } from './CloudMusicSurface';

const TITLE = 'Returning Home';
const ARTIST = 'Parijat';
type Playback = 'idle' | 'loading' | 'playing' | 'paused' | 'blocked' | 'error';
export type MusicState = { playing: boolean; time: number; duration: number; status: Playback };
const clock = (time: number) => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;

export function renderMusicCloud(): string {
  return `<aside class="horizon-music" data-music-cloud aria-label="Returning Home by Parijat music player" data-playing="false">
    <div class="music-cloud-heading">
      <button type="button" class="music-cloud-toggle" data-music-toggle aria-label="Play Returning Home by Parijat" aria-pressed="false">
        <svg data-music-play viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h2v2h3v2h3v4H9v2H6v2H4z"/></svg>
        <svg data-music-pause viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h4v12H3zm6 0h4v12H9z"/></svg>
      </button>
      <div class="music-cloud-title"><strong>Returning Home</strong><span>Parijat <i class="music-cloud-notes" aria-hidden="true"><b></b><b></b><b></b></i></span></div>
    </div>
    <label class="music-cloud-progress"><input type="range" data-music-seek min="0" max="1" value="0" step="0.1" disabled aria-label="Playback position for Returning Home" /></label>
    <div class="music-cloud-footer"><time data-music-elapsed>0:00</time><span data-music-cue role="status"></span><time data-music-duration>—:—</time></div>
  </aside>`;
}

/** One audio element for the entire voyage; visual renderers never own playback. */
export class HomeMusic {
  readonly audio = new Audio('/assets/audio/returning-home-parijat.mp3');
  readonly cloudSurface: CloudMusicSurface;
  private status: Playback = 'idle';
  private section = '';
  private request = 0;
  private pending: Promise<void> | null = null;
  private destroyed = false;
  private frame = 0;
  private lastPositionAt = 0;
  private room: ((state: MusicState) => void) | null = null;
  private seek: HTMLInputElement;
  private cleanups: Array<() => void> = [];

  constructor(private cloud: HTMLElement, private seaTime: () => number) {
    this.cloudSurface = new CloudMusicSurface(cloud);
    this.audio.dataset.homeMusic = '';
    this.audio.hidden = true;
    this.audio.preload = 'metadata';
    this.audio.loop = true;
    this.audio.volume = .55;
    document.body.append(this.audio);
    this.seek = cloud.querySelector('[data-music-seek]')!;
    this.listen(document, 'click', this.click);
    this.listen(this.seek, 'input', () => this.seekTo(Number(this.seek.value)));
    this.listen(this.audio, 'loadedmetadata', this.render);
    this.listen(this.audio, 'durationchange', this.render);
    this.listen(this.audio, 'timeupdate', this.render);
    this.listen(this.audio, 'seeked', this.render);
    this.listen(this.audio, 'playing', () => { this.status = 'playing'; this.render(); });
    this.listen(this.audio, 'pause', () => { if (this.status !== 'blocked' && this.status !== 'error') this.status = 'paused'; this.render(); });
    this.listen(this.audio, 'waiting', () => { if (!this.audio.paused) { this.status = 'loading'; this.render(); } });
    this.listen(this.audio, 'error', () => { this.status = 'error'; this.render(); });
    if ('mediaSession' in navigator) {
      if ('MediaMetadata' in window) navigator.mediaSession.metadata = new MediaMetadata({ title: TITLE, artist: ARTIST });
      const actions: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
        play: () => { void this.play(); }, pause: () => this.pause(),
        seekto: details => this.seekTo(details.seekTime ?? this.audio.currentTime),
        seekbackward: details => this.seekTo(this.audio.currentTime - (details.seekOffset ?? 10)),
        seekforward: details => this.seekTo(this.audio.currentTime + (details.seekOffset ?? 10))
      };
      for (const [action, handler] of Object.entries(actions)) {
        try { navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler!); this.cleanups.push(() => navigator.mediaSession.setActionHandler(action as MediaSessionAction, null)); } catch { /* Optional OS media controls. */ }
      }
    }
    (window as any).__homeMusicDebug = { getState: () => ({ ...this.snapshot(), section: this.section, source: this.audio.currentSrc, audioElements: document.querySelectorAll('audio[data-home-music]').length }) };
    this.render();
  }

  private listen(target: EventTarget, event: string, listener: EventListener) {
    target.addEventListener(event, listener);
    this.cleanups.push(() => target.removeEventListener(event, listener));
  }
  attachRoom(listener: (state: MusicState) => void) { this.room = listener; this.render(); }
  setSection(section: string, scrollDirection = 0) {
    if (section === this.section) return;
    const initialEntry = !this.section;
    this.section = section;
    cancelAnimationFrame(this.frame);
    if (section === 'horizon') {
      // Returning upwards through a partially visible Horizon must never
      // override a manual pause. Only a new descent (or direct load) starts it.
      if (initialEntry || scrollDirection > 0) void this.play();
      this.frame = requestAnimationFrame(this.positionCloud);
    }
  }
  private click = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-music-toggle]')) {
      if (!this.audio.paused || this.pending) this.pause(); else void this.play();
    } else if (this.section !== 'horizon' && target.closest('[data-nav-section="horizon"], a[href="#horizon"]')) {
      // Use the navigation gesture when available; a scroll-only entry is also
      // attempted by setSection and gracefully falls back to the play button.
      void this.play();
    }
  };
  private play(): Promise<void> {
    if (this.destroyed || !this.audio.paused) return Promise.resolve();
    if (this.pending) return this.pending;
    if (this.status === 'error') this.audio.load();
    const request = ++this.request;
    this.status = 'loading'; this.render();
    this.pending = this.audio.play().catch(error => {
      if (request !== this.request || this.destroyed) return;
      this.status = error.name === 'NotAllowedError' ? 'blocked' : error.name === 'AbortError' ? 'paused' : 'error';
      this.render();
    }).finally(() => { if (request === this.request) this.pending = null; });
    return this.pending;
  }
  private pause() { this.request++; this.pending = null; this.audio.pause(); this.status = 'paused'; this.render(); }
  private seekTo(time: number) {
    if (!Number.isFinite(this.audio.duration) || this.audio.duration <= 0) return;
    this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, time)); this.render();
  }
  private snapshot(): MusicState { return { playing: !this.audio.paused, time: this.audio.currentTime || 0, duration: Number.isFinite(this.audio.duration) ? this.audio.duration : 0, status: this.status }; }
  private render = () => {
    if (this.destroyed) return;
    const state = this.snapshot();
    this.cloudSurface.playing = state.playing;
    this.cloud.dataset.playing = String(state.playing);
    this.cloud.dataset.state = state.status;
    document.querySelectorAll<HTMLButtonElement>('[data-music-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(state.playing));
      button.setAttribute('aria-label', `${state.playing ? 'Pause' : 'Play'} ${TITLE} by ${ARTIST}`);
      button.dataset.playing = String(state.playing);
    });
    document.querySelectorAll('[data-music-room-action]').forEach(el => { el.textContent = state.playing ? 'Playing' : state.status === 'loading' ? 'Loading' : 'Play'; });
    this.seek.disabled = !state.duration;
    this.seek.max = String(state.duration || 1); this.seek.value = String(state.time);
    this.seek.setAttribute('aria-valuetext', `${clock(state.time)} of ${clock(state.duration)}`);
    this.cloud.style.setProperty('--music-progress', `${state.duration ? state.time / state.duration * 100 : 0}%`);
    this.cloud.querySelector('[data-music-elapsed]')!.textContent = clock(state.time);
    this.cloud.querySelector('[data-music-duration]')!.textContent = state.duration ? clock(state.duration) : '—:—';
    this.cloud.querySelector('[data-music-cue]')!.textContent = state.status === 'blocked' ? 'Tap to play' : state.status === 'error' ? 'Tap to retry' : state.status === 'loading' ? 'Loading…' : '';
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused';
      if (state.duration && navigator.mediaSession.setPositionState) navigator.mediaSession.setPositionState({ duration: state.duration, position: Math.min(state.time, state.duration), playbackRate: this.audio.playbackRate });
    }
    this.room?.(state);
  };
  private positionCloud = (now: number) => {
    if (this.destroyed || this.section !== 'horizon') return;
    if (now - this.lastPositionAt > 100) {
      this.lastPositionAt = now;
      const time = this.seaTime(), drift = Math.sin(time * .012) * .006 + time * .000035;
      this.cloud.style.setProperty('--music-cloud-x', `${(Math.max(.68, .82 - drift / 1.3)) * 100}%`);
      this.cloudSurface.measure();
    }
    this.frame = requestAnimationFrame(this.positionCloud);
  };
  destroy() {
    this.cloudSurface.destroy();
    this.destroyed = true; this.request++; cancelAnimationFrame(this.frame);
    this.cleanups.forEach(cleanup => cleanup()); this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); this.audio.remove(); this.room = null;
    delete (window as any).__homeMusicDebug;
  }
}
