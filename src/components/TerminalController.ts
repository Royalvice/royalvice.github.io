import type { AppState } from "../app/state";
import type { NewsItem } from "../content/site";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const KEYWORD_CLASSES = new Map<string, string>([
  ["siggraph asia", "keyword-venue"],
  ["siggraph", "keyword-venue"],
  ["eccv", "keyword-venue"],
  ["iccv", "keyword-venue"],
  ["acm mm", "keyword-venue"],
  ["tog", "keyword-venue"],
  ["eva01", "keyword-project"],
  ["docdiff", "keyword-project"],
  ["thoth", "keyword-project"],
  ["3d mllm", "keyword-research"],
  ["neural graphics", "keyword-research"],
  ["agent harness", "keyword-research"],
  ["accepted", "keyword-action"],
  ["shipped", "keyword-action"],
  ["online", "keyword-action"],
  ["unlocked", "keyword-action"]
]);

const KEYWORD_PATTERN = new RegExp(
  `(${[...KEYWORD_CLASSES.keys()]
    .sort((a, b) => b.length - a.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})`,
  "gi"
);

function highlightedMessage(value: string): string {
  return value.split(KEYWORD_PATTERN).map((part) => {
    const className = KEYWORD_CLASSES.get(part.toLowerCase());
    return className
      ? `<mark class="terminal-keyword ${className}">${escapeHtml(part)}</mark>`
      : escapeHtml(part);
  }).join("");
}

function lineMarkup(item: NewsItem): string {
  const year = item.date.slice(0, 4);
  const content = `
    <time class="terminal-date terminal-year-${escapeHtml(year)}" datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>
    <b class="terminal-type terminal-type-${item.type.toLowerCase()}">${escapeHtml(item.type.toLowerCase())}</b>
    <span class="terminal-message">${highlightedMessage(item.text)}</span>
  `;
  return item.url
    ? `<a class="terminal-line has-link" data-news-id="${escapeHtml(item.id)}" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${content}<span class="terminal-open" aria-hidden="true"><b>OPEN</b><i>↗</i></span></a>`
    : `<p class="terminal-line" data-news-id="${escapeHtml(item.id)}">${content}</p>`;
}

function lineElement(item: NewsItem): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = lineMarkup(item).trim();
  return template.content.firstElementChild as HTMLElement;
}

export class TerminalController {
  private visible: NewsItem[];
  private nextIndex = 0;
  private timer: number | undefined;
  private statusTimer: number | undefined;
  private manualPaused = false;
  private hoverPaused = false;
  private focusPaused = false;
  private readonly lineCount: number;
  private readonly capacity: number;

  constructor(
    private readonly root: HTMLElement,
    private readonly news: NewsItem[],
    private readonly state: AppState
  ) {
    this.capacity = window.matchMedia("(max-width: 760px)").matches ? 6 : 9;
    this.lineCount = Math.min(this.capacity, news.length);
    this.visible = news.slice(-this.lineCount);
    this.nextIndex = news.length % Math.max(1, news.length);
  }

  start(): void {
    this.render();
    this.root.addEventListener("mouseenter", this.pauseFromHover);
    this.root.addEventListener("mouseleave", this.resumeFromHover);
    this.root.addEventListener("focusin", this.pauseFromFocus);
    this.root.addEventListener("focusout", this.resumeFromFocus);
    this.root.addEventListener("click", this.onTouchToggle);
    this.root.querySelector<HTMLElement>("[data-terminal-toggle]")?.addEventListener("click", this.onManualToggle);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.updateInterface();
    if (!this.state.reducedMotion) this.schedule();
  }

  destroy(): void {
    window.clearTimeout(this.timer);
    window.clearTimeout(this.statusTimer);
    this.root.removeEventListener("mouseenter", this.pauseFromHover);
    this.root.removeEventListener("mouseleave", this.resumeFromHover);
    this.root.removeEventListener("focusin", this.pauseFromFocus);
    this.root.removeEventListener("focusout", this.resumeFromFocus);
    this.root.removeEventListener("click", this.onTouchToggle);
    this.root.querySelector<HTMLElement>("[data-terminal-toggle]")?.removeEventListener("click", this.onManualToggle);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }

  private pauseFromHover = (): void => {
    this.hoverPaused = true;
    this.updatePauseState();
  };

  private resumeFromHover = (): void => {
    this.hoverPaused = false;
    this.updatePauseState();
  };

  private pauseFromFocus = (event: FocusEvent): void => {
    if ((event.target as HTMLElement).closest("[data-terminal-toggle]")) return;
    this.focusPaused = true;
    this.updatePauseState();
  };

  private resumeFromFocus = (event: FocusEvent): void => {
    if (event.relatedTarget instanceof Node && this.root.contains(event.relatedTarget)) return;
    this.focusPaused = false;
    this.updatePauseState();
  };

  private onManualToggle = (event: MouseEvent): void => {
    event.stopPropagation();
    this.manualPaused = !this.manualPaused;
    this.updatePauseState();
  };

  private onTouchToggle = (event: MouseEvent): void => {
    if (!window.matchMedia("(hover: none)").matches) return;
    if ((event.target as HTMLElement).closest("a,button")) return;
    this.manualPaused = !this.manualPaused;
    this.updatePauseState();
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      window.clearTimeout(this.timer);
      return;
    }
    if (!this.state.terminalPaused && !this.state.reducedMotion) this.schedule();
  };

  private updatePauseState(): void {
    const paused = this.manualPaused || this.hoverPaused || this.focusPaused;
    const wasPaused = this.state.terminalPaused;
    this.state.terminalPaused = paused;
    this.root.dataset.paused = String(paused);
    this.root.dataset.pauseSource = this.manualPaused ? "manual" : this.focusPaused ? "focus" : this.hoverPaused ? "hover" : "";
    if (paused) window.clearTimeout(this.timer);
    this.updateInterface();
    if (wasPaused && !paused && !this.state.reducedMotion) this.schedule();
  }

  private updateInterface(): void {
    const paused = this.state.terminalPaused;
    const ingesting = this.root.classList.contains("is-ingesting");
    const source = this.root.dataset.pauseSource;
    const stateLabel = paused ? `HOLD / ${source?.toUpperCase() || "MANUAL"}` : ingesting ? "INGEST" : "FOLLOW";
    const stateNode = this.root.querySelector<HTMLElement>("[data-terminal-state]");
    const footerNode = this.root.querySelector<HTMLElement>("[data-terminal-footer]");
    const bufferNode = this.root.querySelector<HTMLElement>("[data-terminal-buffer]");
    const toggle = this.root.querySelector<HTMLButtonElement>("[data-terminal-toggle]");
    if (stateNode) stateNode.textContent = stateLabel;
    if (footerNode) footerNode.textContent = paused
      ? `follow mode · held by ${source || "manual"}`
      : ingesting ? "+1 record ingested" : "follow mode · waiting for append";
    if (bufferNode) bufferNode.textContent = `BUFFER ${String(this.visible.length).padStart(2, "0")}/${String(this.capacity).padStart(2, "0")}`;
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(this.manualPaused));
      toggle.setAttribute("aria-label", paused ? "Resume live research log" : "Pause live research log");
    }
  }

  private schedule(): void {
    window.clearTimeout(this.timer);
    if (this.state.terminalPaused || document.hidden || !this.news.length) return;
    const wait = 4000 + Math.random() * 2000;
    this.timer = window.setTimeout(() => {
      const next = this.news[this.nextIndex % this.news.length];
      this.nextIndex = (this.nextIndex + 1) % this.news.length;
      const retained = Math.max(0, this.lineCount - 1);
      this.visible = [...(retained ? this.visible.slice(-retained) : []), next];
      this.render(true);
      this.schedule();
    }, wait);
  }

  private render(appending = false): void {
    const viewport = this.root.querySelector<HTMLElement>("[data-terminal-lines]");
    if (!viewport) return;
    if (!appending || viewport.childElementCount !== this.visible.length) {
      viewport.innerHTML = this.visible.map(lineMarkup).join("");
      this.updateInterface();
      return;
    }
    this.appendLine(viewport, this.visible[this.visible.length - 1]);
  }

  private appendLine(viewport: HTMLElement, item: NewsItem): void {
    const rows = Array.from(viewport.children) as HTMLElement[];
    const outgoing = rows[0];
    if (!outgoing) {
      viewport.append(lineElement(item));
      return;
    }

    this.root.classList.add("is-ingesting");
    this.updateInterface();
    const previousTops = new Map(rows.slice(1).map((row) => [row, row.getBoundingClientRect().top]));
    outgoing.remove();
    const incoming = lineElement(item);
    incoming.classList.add("is-ingesting");
    viewport.append(incoming);
    window.clearTimeout(this.statusTimer);
    this.statusTimer = window.setTimeout(() => {
      incoming.classList.remove("is-ingesting");
      this.root.classList.remove("is-ingesting");
      this.updateInterface();
    }, 900);

    if (!this.state.reducedMotion) {
      rows.slice(1).forEach((row) => {
        const previousTop = previousTops.get(row) ?? row.getBoundingClientRect().top;
        const delta = previousTop - row.getBoundingClientRect().top;
        row.animate([
          { transform: `translateY(${delta}px)` },
          { transform: "translateY(0)" }
        ], { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" });
      });
      incoming.animate([
        { opacity: 0, transform: "translateY(5px)", clipPath: "inset(100% 0 0 0)" },
        { opacity: 1, transform: "translateY(0)", clipPath: "inset(0 0 0 0)" }
      ], { duration: 230, easing: "cubic-bezier(.16,.84,.24,1)" });
    }
  }
}
