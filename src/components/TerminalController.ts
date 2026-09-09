import type { AppState } from "../app/state";
import type { NewsItem } from "../content/site";
import type { RoomSignal } from "../terminal/TerminalFilesystem";
import type { TerminalScene } from "../terminal/TerminalScene";

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
  ["directl", "keyword-project"],
  ["ssat", "keyword-project"],
  ["eye3", "keyword-project"],
  ["docdiff", "keyword-project"],
  ["thoth", "keyword-project"],
  ["3d mllm", "keyword-research"],
  ["neural graphics", "keyword-research"],
  ["agent harness", "keyword-research"],
  ["accepted", "keyword-action"],
  ["presented", "keyword-action"],
  ["released", "keyword-action"]
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

function eventMessageMarkup(value: string): string {
  const separator = " — ";
  const separatorIndex = value.indexOf(separator);
  if (separatorIndex < 0) return `<span class="terminal-event">${highlightedMessage(value)}</span>`;
  const subject = value.slice(0, separatorIndex);
  const event = value.slice(separatorIndex + separator.length);
  return `<span class="terminal-subject">${highlightedMessage(subject)}</span><span class="terminal-separator" aria-hidden="true">&nbsp;—&nbsp;</span><span class="terminal-event">${highlightedMessage(event)}</span>`;
}

function lineMarkup(item: NewsItem): string {
  const year = item.date.slice(0, 4);
  const domain = item.domain ?? "unclassified";
  const domainMeta = {
    "neural-graphics": { icon: "◇", label: "Neural Graphics" },
    "agent-harness": { icon: "⌘", label: "Agent Harness" },
    mllm: { icon: "◫", label: "MLLM" },
    "game-world-model": { icon: "▦", label: "Game World Model" },
    unclassified: { icon: "·", label: "Research signal" }
  }[domain];
  const content = `
    <time class="terminal-date terminal-year-${escapeHtml(year)}" datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>
    <span class="terminal-line-domain domain-${domain}" data-news-domain="${domain}" title="${escapeHtml(domainMeta.label)}"><i aria-hidden="true">${domainMeta.icon}</i><b>${escapeHtml(domainMeta.label)}</b></span>
    <span class="terminal-message">${eventMessageMarkup(item.text)}</span>
  `;
  return item.url
    ? `<a class="terminal-line has-link" data-news-id="${escapeHtml(item.id)}" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${content}<span class="terminal-open" aria-hidden="true"><b>OPEN</b><i>↗</i></span></a>`
    : `<p class="terminal-line" data-news-id="${escapeHtml(item.id)}">${content}</p>`;
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
  private focusDialog: HTMLDialogElement | undefined;
  private placeholder: HTMLDivElement | undefined;
  private expandTrigger: HTMLElement | undefined;
  private previousOverflow = "";
  private scene?: TerminalScene;
  private destroyed = false;
  private dock?:HTMLElement;
  private dockTrigger?:HTMLElement;
  private roomSignal:(signal:RoomSignal)=>void = ()=>undefined;
  private visibility:(open:boolean)=>void = ()=>undefined;

  attachDock(dock:HTMLElement, roomSignal:(signal:RoomSignal)=>void, visibility:(open:boolean)=>void):void {
    this.dock=dock;this.roomSignal=roomSignal;this.visibility=visibility;
    this.dockTrigger=dock.querySelector<HTMLElement>("[data-profile-terminal]")!;
    dock.querySelector("[data-terminal-visual]")!.append(this.root);
    this.root.hidden=false;
    this.root.querySelector<HTMLCanvasElement>("canvas")!.tabIndex=-1;
    this.dockTrigger.addEventListener("click",this.onDockClick);
    this.dockTrigger.removeAttribute("disabled");
    this.scene?.setDocked(true);
  }
  private onDockClick=():void=>{if(this.dockTrigger)this.toggleExpanded(this.dockTrigger);};

  async mount3D(): Promise<void> {
    try {
      const { TerminalScene } = await import("../terminal/TerminalScene");
      if (this.destroyed) return;
      const canvas=this.root.querySelector<HTMLCanvasElement>("[data-terminal-canvas]")!;
      this.scene=new TerminalScene(canvas,this.news,this.state.reducedMotion,{
        hold:()=>{this.manualPaused=!this.manualPaused;this.updatePauseState();},
        expand:()=>this.toggleExpanded(this.root.querySelector<HTMLElement>("[data-terminal-expand]")!),
        view:()=>undefined,
        room:signal=>this.roomSignal(signal)
      },text=>{const feedback=this.root.querySelector("[data-terminal-feedback]");if(feedback)feedback.textContent=text?"> "+text:"CLICK KEYS · F1 GUIDE";});
      await this.scene.init();
      this.scene.setDocked(!this.focusDialog?.open);
      this.updateInterface();
    } catch(error) {
      console.error("Terminal WebGL unavailable; text archive remains readable",error);
      this.scene?.destroy();this.scene=undefined;
      this.root.dataset.renderer="unavailable";
      const archive=this.root.querySelector<HTMLDetailsElement>(".terminal-readable");if(archive)archive.open=true;
    }
  }

  constructor(
    private readonly root: HTMLElement,
    private readonly news: NewsItem[],
    private readonly state: AppState
  ) {
    this.news = news
      .map((item, sourceIndex) => ({ item, sourceIndex }))
      .sort((a, b) => b.item.date.localeCompare(a.item.date) || a.sourceIndex - b.sourceIndex)
      .map(({ item }) => item);
    this.capacity = 9;
    this.lineCount = Math.min(this.capacity, this.news.length);
    this.visible = this.news.slice(0, this.lineCount);
    this.nextIndex = 0;
  }

  start(): void {
    this.render();
    this.root.addEventListener("mouseenter", this.pauseFromHover);
    this.root.addEventListener("mouseleave", this.resumeFromHover);
    this.root.addEventListener("focusin", this.pauseFromFocus);
    this.root.addEventListener("focusout", this.resumeFromFocus);
    this.root.querySelector<HTMLElement>("[data-terminal-toggle]")?.addEventListener("click", this.onManualToggle);
    this.root.querySelectorAll<HTMLElement>("[data-terminal-expand]").forEach((button) => button.addEventListener("click", this.onExpand));
    this.focusDialog = document.createElement("dialog");
    this.focusDialog.className = "terminal-focus";
    this.focusDialog.id = "yzy-terminal-dialog";
    this.focusDialog.setAttribute("aria-label", "YZY computer at the middle research desk");
    this.focusDialog.addEventListener("close", this.onCloseFocus);
    this.focusDialog.addEventListener("cancel", this.onCancelFocus);
    this.focusDialog.addEventListener("click", this.onBackdropClick);
    document.body.append(this.focusDialog);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.updateInterface();
    if (!this.state.reducedMotion) this.schedule();
  }

  destroy(): void {
    this.destroyed = true;
    this.dockTrigger?.removeEventListener("click",this.onDockClick);
    if (this.focusDialog?.open) this.closeFocus();
    this.scene?.destroy();
    this.onCloseFocus();
    this.focusDialog?.removeEventListener("close", this.onCloseFocus);
    this.focusDialog?.removeEventListener("cancel", this.onCancelFocus);
    this.focusDialog?.removeEventListener("click", this.onBackdropClick);
    this.focusDialog?.remove();
    window.clearTimeout(this.timer);
    window.clearTimeout(this.statusTimer);
    this.root.removeEventListener("mouseenter", this.pauseFromHover);
    this.root.removeEventListener("mouseleave", this.resumeFromHover);
    this.root.removeEventListener("focusin", this.pauseFromFocus);
    this.root.removeEventListener("focusout", this.resumeFromFocus);
    this.root.querySelector<HTMLElement>("[data-terminal-toggle]")?.removeEventListener("click", this.onManualToggle);
    this.root.querySelectorAll<HTMLElement>("[data-terminal-expand]").forEach((button) => button.removeEventListener("click", this.onExpand));
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
    if ((event.target as HTMLElement).closest("button")) return;
    this.focusPaused = true;
    this.updatePauseState();
  };

  private resumeFromFocus = (event: FocusEvent): void => {
    if (event.relatedTarget instanceof HTMLElement && this.root.contains(event.relatedTarget) && !event.relatedTarget.closest("button")) return;
    this.focusPaused = false;
    this.updatePauseState();
  };

  private onManualToggle = (event: MouseEvent): void => {
    event.stopPropagation();
    this.manualPaused = !this.manualPaused;
    this.updatePauseState();
  };

  private onExpand = (event: MouseEvent): void => {
    event.stopPropagation();
    this.toggleExpanded(event.currentTarget as HTMLElement);
  };

  private toggleExpanded(trigger: HTMLElement): void {
    if (!this.focusDialog) return;
    if (this.focusDialog.open) {
      this.closeFocus();
      return;
    }
    this.expandTrigger = trigger;
    // A DOM move must not replay the page's delayed entrance animation.
    this.root.classList.remove("profile-reveal");
    this.placeholder = document.createElement("div");
    this.placeholder.className = "terminal-focus-placeholder";
    this.placeholder.style.height = `${this.root.getBoundingClientRect().height}px`;
    this.root.before(this.placeholder);
    this.focusDialog.append(this.root);
    this.root.dataset.expanded = "true";
    this.root.dataset.view="expanded";
    this.root.querySelector<HTMLCanvasElement>("canvas")!.tabIndex=0;
    this.dockTrigger?.setAttribute("aria-expanded","true");
    this.dock?.setAttribute("data-visited","true");
    this.visibility(true);
    this.previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    this.root.querySelectorAll("[data-terminal-expand]").forEach((button) => button.setAttribute("aria-label", "Close terminal reading view"));
    const label = this.root.querySelector("[data-terminal-expand-label]");
    if (label) label.textContent = "CLOSE ×";
    this.focusDialog.showModal();
    this.scene?.setDocked(false);
    this.root.querySelector<HTMLElement>("[data-terminal-canvas]")?.focus({ preventScroll: true });
  }

  private onCloseFocus = (): void => {
    if (!this.placeholder || this.focusDialog?.open) return;
    this.placeholder.replaceWith(this.root);
    this.root.dataset.view="docked";
    this.root.querySelector<HTMLCanvasElement>("canvas")!.tabIndex=-1;
    this.scene?.setDocked(true);
    this.dockTrigger?.setAttribute("aria-expanded","false");
    this.visibility(false);
    this.placeholder = undefined;
    delete this.root.dataset.expanded;
    document.documentElement.style.overflow = this.previousOverflow;
    this.root.querySelectorAll("[data-terminal-expand]").forEach((button) => button.setAttribute("aria-label", "Enlarge research terminal"));
    const label = this.root.querySelector("[data-terminal-expand-label]");
    if (label) label.textContent = "READ ↗";
    this.focusPaused = false;
    this.hoverPaused = false;
    this.updatePauseState();
    this.expandTrigger?.focus({ preventScroll: true });
  };

  private closeFocus = (): void => {
    this.focusDialog?.close();
    this.onCloseFocus();
  };

  private onCancelFocus = (event: Event): void => {
    event.preventDefault();
    this.closeFocus();
  };

  private onBackdropClick = (event: MouseEvent): void => {
    if (event.target !== this.focusDialog) return;
    const bounds = this.focusDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.closeFocus();
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
    if (paused) {
      window.clearTimeout(this.timer);
      window.clearTimeout(this.statusTimer);
      this.root.querySelectorAll(".terminal-line.is-ingesting").forEach((line) => line.classList.remove("is-ingesting"));
      this.root.classList.remove("is-ingesting");
      this.root.classList.remove("is-loop-boundary");
    }
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
    this.scene?.setStatus(stateLabel);
    if (footerNode) footerNode.textContent = paused
      ? `follow mode · held by ${source || "manual"}`
      : ingesting ? "record signal refreshed" : "follow mode · watching timeline";
    if (bufferNode) bufferNode.textContent = `BUFFER ${String(this.visible.length).padStart(2, "0")}/${String(this.capacity).padStart(2, "0")}`;
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(this.manualPaused));
      toggle.setAttribute("aria-label", this.manualPaused ? "Resume live research log" : "Pause live research log");
    }
    const controlLabel = this.root.querySelector("[data-terminal-control-label]");
    if (controlLabel) controlLabel.textContent = this.manualPaused ? "FOLLOW" : "HOLD";

  }

  private schedule(): void {
    window.clearTimeout(this.timer);
    if (this.state.terminalPaused || document.hidden || !this.visible.length) return;
    const wait = 4000 + Math.random() * 2000;
    this.timer = window.setTimeout(() => {
      const next = this.visible[this.nextIndex % this.visible.length];
      this.nextIndex = (this.nextIndex + 1) % this.visible.length;
      this.refreshLine(next);
      this.schedule();
    }, wait);
  }

  private render(): void {
    const viewport = this.root.querySelector<HTMLElement>("[data-terminal-lines]");
    if (!viewport) return;
    viewport.innerHTML = this.visible.map(lineMarkup).join("");
    this.updateInterface();
  }

  private refreshLine(item: NewsItem): void {
    const viewport = this.root.querySelector<HTMLElement>("[data-terminal-lines]");
    const incoming = viewport
      ? Array.from(viewport.children).find((row) => (row as HTMLElement).dataset.newsId === item.id) as HTMLElement | undefined
      : undefined;
    if (!incoming) return;
    this.root.dataset.refreshSequence = String(Number(this.root.dataset.refreshSequence || "0") + 1);
    this.scene?.refresh(this.visible.indexOf(item));
    this.root.classList.add("is-ingesting");
    this.root.classList.toggle("is-loop-boundary", this.nextIndex === 0);
    incoming.classList.add("is-ingesting");
    this.updateInterface();
    window.clearTimeout(this.statusTimer);
    this.statusTimer = window.setTimeout(() => {
      incoming.classList.remove("is-ingesting");
      this.root.classList.remove("is-ingesting");
      this.root.classList.remove("is-loop-boundary");
      this.updateInterface();
    }, 900);

    if (!this.state.reducedMotion) {
      incoming.animate([
        { filter: "brightness(.72)", clipPath: "inset(0 100% 0 0)" },
        { filter: "brightness(1.12)", clipPath: "inset(0 0 0 0)" },
        { filter: "brightness(1)", clipPath: "inset(0 0 0 0)" }
      ], { duration: 420, easing: "cubic-bezier(.16,.84,.24,1)" });
    }
  }
}
