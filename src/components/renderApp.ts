import githubSvg from "simple-icons/icons/github.svg?raw";
import scholarSvg from "simple-icons/icons/googlescholar.svg?raw";
import huggingFaceSvg from "simple-icons/icons/huggingface.svg?raw";
import type { AppState } from "../app/state";
import type { LinkItem, Project, ProjectId, SectionId, SiteContent, VoyageNode } from "../content/site";
import type { SceneRenderer, TransitionAwareSceneRenderer } from "../scenes/SceneRenderer";
import { TerminalController } from "./TerminalController";

type InitOptions = {
  content: SiteContent;
  state: AppState;
  onSectionChange: (section: SectionId) => void;
};

type CoinBurstPose = {
  startX: number;
  startY: number;
  midX: number;
  midY: number;
  fallX: number;
  fallY: number;
  endX: number;
  endY: number;
  delay: number;
  duration: number;
  midRotation: number;
  fallRotation: number;
  endRotation: number;
  midFlip: number;
  fallFlip: number;
  endFlip: number;
  peakScale: number;
  endScale: number;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function linksMarkup(links: LinkItem[]): string {
  return links.map((link) => {
    const disabled = link.state === "coming-soon" || !link.href;
    return disabled
      ? `<span class="project-link is-disabled" aria-disabled="true">${escapeHtml(link.label)}</span>`
      : `<a class="project-link" href="${escapeHtml(link.href)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`;
  }).join("");
}

function interestIcon(id: string): string {
  const common = `viewBox="0 0 24 24" aria-hidden="true" focusable="false" shape-rendering="crispEdges"`;
  const icons: Record<string, string> = {
    game: `<svg ${common}><path d="M5 8h14v9h-3l-2-2h-4l-2 2H5z"/><path class="cut" d="M8 10h2v2h2v2h-2v2H8v-2H6v-2h2zm8 1h2v2h-2zm-2 3h2v2h-2z"/></svg>`,
    fitness: `<svg ${common}><path d="M3 9h3V7h3v10H6v-2H3zm18 0h-3V7h-3v10h3v-2h3zM9 11h6v4H9z"/></svg>`,
    music: `<svg ${common}><path d="M10 5h10v3h-8v9a4 4 0 1 1-2-3.46zm8 5h2v5a4 4 0 1 1-2-3.46z"/></svg>`,
    metaphysics: `<svg ${common}><path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 5 5 0 0 1 0-10 5 5 0 0 0 0-10zm0 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/><path class="cut" d="M12 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>`
  };
  return icons[id] || "";
}

function sailboatMarkup(className = "research-boat", preset: "sunset" | "horizon" = "sunset"): string {
  return `
    <div class="${className} is-model-loading" aria-hidden="true">
      <canvas class="research-boat-canvas" data-boat-model="${preset}" aria-hidden="true"></canvas>
      <svg viewBox="0 0 132 96" shape-rendering="crispEdges">
        <path class="boat-shadow" d="M22 82h88v6H22z"/>
        <path class="boat-mast" d="M63 8h4v58h-4z"/>
        <path class="boat-sail-main" d="M60 13 25 61h35z"/>
        <path class="boat-sail-back" d="m69 14 31 47H69z"/>
        <path class="boat-sail-stitch" d="M55 25 35 54h20zm19 1 18 29H74z"/>
        <path class="boat-hull-brass" d="M15 61h103l-15 23H34z"/>
        <path class="boat-hull" d="M22 65h88l-11 14H38z"/>
        <path class="boat-window" d="M45 68h9v4h-9zm15 0h9v4h-9zm15 0h9v4h-9z"/>
        <path class="boat-signal" d="M83 57h8v4h-8z"/>
      </svg>
      <span class="boat-reflection"></span>
    </div>
  `;
}

function landmarkMarkup(kind: VoyageNode["landmark"]): string {
  const posters: Record<VoyageNode["landmark"], string> = {
    dock: "/assets/voyage/landmarks/posters/docdiff.jpg",
    lighthouse: "/assets/voyage/landmarks/posters/directl.jpg",
    reef: "/assets/voyage/landmarks/posters/neural.jpg",
    harbor: "/assets/voyage/landmarks/posters/eva01.jpg",
    gate: "/assets/voyage/landmarks/posters/world.jpg"
  };
  return `<div class="landmark-model" data-landmark-model="${kind}" aria-hidden="true"><img class="landmark-poster" src="${posters[kind]}" alt="" loading="lazy" decoding="async" /></div>`;
}

function renderGalleryPoster(projects: Project[]): string {
  return `
    <div class="gallery-poster" data-gallery-poster>
      ${projects.map((project) => `
        <article class="poster-slot poster-${project.id}">
          <img src="${escapeHtml(project.heroTexture)}" alt="${escapeHtml(project.media.alt)}" />
          <span>${escapeHtml(project.title)}</span>
        </article>
      `).join("")}
      <div class="gallery-loading-copy"><span></span> INITIALIZING PLAYCANVAS CABINET</div>
    </div>
  `;
}

function renderProfile(content: SiteContent): string {
  const p = content.profile;
  const brandIcons: Record<string, string> = { github: githubSvg, scholar: scholarSvg, huggingface: huggingFaceSvg };
  const reelDigits = Array.from({ length: 8 }, () => Array.from({ length: 10 }, (_, digit) => digit)).flat();
  const telemetryColumns = [
    "SIG<br>0x7F<br>GPU<br>0110<br>TOG",
    "MLLM<br>1011<br>EVA<br>0x2A<br>ICCV",
    "GPU<br>TOG<br>0010<br>SIG<br>0x91",
    "EVA<br>0x4C<br>MLLM<br>1101<br>ACM",
    "ICCV<br>0101<br>GPU<br>0xD3<br>SIG",
    "TOG<br>MLLM<br>0x6E<br>1001<br>EVA"
  ];
  return `
    <section class="scene profile-scene" id="profile" aria-labelledby="profile-title" data-section="profile">
      <div class="profile-console">
        <section class="profile-top" aria-label="Profile save chamber">
          <div class="profile-summary profile-reveal" style="--reveal-index:0">
            <div class="avatar-spotlight">
              <span class="avatar-curtain" aria-hidden="true"></span>
              <span class="spotlight-beam" aria-hidden="true"></span>
              <span class="spotlight-ring" aria-hidden="true"></span>
              <img class="avatar-projection" src="${escapeHtml(p.avatar)}" alt="" aria-hidden="true" />
              <img class="avatar-main" src="${escapeHtml(p.avatar)}" alt="Avatar for ${escapeHtml(p.name)}" />
            </div>
            <h1 id="profile-title">${escapeHtml(p.name)}</h1>
            <p class="profile-signature">Happy Wife! Happy Life!</p>
            <ol class="research-route" aria-label="Research route">
              <li class="is-complete"><span></span><b>Neural Graphics</b></li>
              <li class="is-current" aria-current="step"><span></span><b>3D MLLM</b></li>
              <li class="is-future"><span></span><b>Game World Model</b></li>
            </ol>
            <nav class="social-dock" aria-label="Research profiles">
              ${p.social.map((social) => `
                <a href="${escapeHtml(social.href)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(social.label)}" title="${escapeHtml(social.label)}">
                  ${brandIcons[social.id]}
                </a>
              `).join("")}
            </nav>
          </div>

          <article class="profile-dossier profile-reveal" style="--reveal-index:1">
            <p class="profile-intro">${escapeHtml(p.intro)}</p>
            <section class="dossier-research">
              <div class="dossier-label"><span>Research</span><b>Evidence / 01</b></div>
              <p class="research-summary">${escapeHtml(p.researchSummary)}</p>
              <div class="research-evidence-grid">
                <section class="contribution-group" aria-label="Research contributions">
                  <header><b>01</b><span>Research Contributions</span></header>
                  <ol class="contribution-list">
                    ${p.contributions.map((item, index) => `<li><b>0${index + 1}</b><span>${escapeHtml(item)}</span></li>`).join("")}
                  </ol>
                </section>
                <div class="research-connector" aria-hidden="true"><i></i><span>driven by</span><i></i></div>
                <section class="capability-group" aria-label="Core capabilities">
                  <header><b>02</b><span>Core Capabilities</span></header>
                  <div class="skill-stack">
                    ${p.skills.map((skill, index) => `<span class="skill-chip skill-${index}"><i></i>${escapeHtml(skill)}</span>`).join("")}
                  </div>
                </section>
              </div>
            </section>
            <div class="siggraph-machine" data-siggraph-machine data-result="rolling" aria-label="Two SIGGRAPH first-author papers holographic counter">
              <span class="siggraph-hologram" aria-hidden="true"></span>
              <div class="siggraph-counter" aria-hidden="true">
                <span class="siggraph-multiplier">×</span>
                <span class="siggraph-reel">
                  <span class="siggraph-reel-track" data-siggraph-track data-target-digit="2">
                    ${reelDigits.map((digit) => `<b>${digit}</b>`).join("")}
                  </span>
                </span>
              </div>
              <div class="siggraph-copy">
                <b>SIGGRAPH</b>
                <span>First-Author Papers</span>
              </div>
              <button class="siggraph-lever" type="button" aria-label="Pull lever to resolve the SIGGRAPH counter at two">
                <span class="lever-knob"></span><i></i><small>Pull</small>
              </button>
            </div>
            <div class="coin-burst" aria-hidden="true">
              ${Array.from({ length: 24 }, () => '<i class="slot-coin" data-slot-coin></i>').join("")}
            </div>
            <section class="interest-rail" aria-label="Interests">
              <span class="interest-label">Interests</span>
              ${p.interests.map((interest) => `
                <span class="interest-item" tabindex="0">${interestIcon(interest.id)}<b>${escapeHtml(interest.label)}</b></span>
              `).join("")}
            </section>
            <p class="godot-status" tabindex="0">
              <span class="godot-rail" aria-hidden="true"></span>
              <span class="godot-burner">
                <span class="godot-edge-flame flame-surge" aria-hidden="true">${escapeHtml(p.status)}</span>
                <span class="godot-edge-flame flame-outer" aria-hidden="true">${escapeHtml(p.status)}</span>
                <span class="godot-edge-flame flame-inner" aria-hidden="true">${escapeHtml(p.status)}</span>
                <span class="godot-copy">${escapeHtml(p.status)}</span>
                <span class="godot-sparks" aria-hidden="true">
                  ${Array.from({ length: 9 }, (_, index) => `<i style="--spark:${index}"></i>`).join("")}
                </span>
                <span class="godot-steam" aria-hidden="true">
                  ${Array.from({ length: 7 }, (_, index) => `<i style="--steam:${index}"></i>`).join("")}
                </span>
                <svg class="godot-flame-filter" aria-hidden="true" width="0" height="0">
                  <defs>
                    <filter id="godot-edge-flame-outer" x="-25%" y="-90%" width="150%" height="280%" color-interpolation-filters="sRGB">
                      <feTurbulence type="fractalNoise" baseFrequency="0.017 0.15" numOctaves="2" seed="13" result="outerNoise">
                        <animate attributeName="baseFrequency" values="0.014 0.11;0.021 0.18;0.016 0.13" dur="0.9s" repeatCount="indefinite" />
                      </feTurbulence>
                      <feDisplacementMap in="SourceGraphic" in2="outerNoise" scale="13" xChannelSelector="R" yChannelSelector="B" result="outerDistort" />
                      <feMorphology in="outerDistort" operator="dilate" radius="1.05" result="outerThick" />
                      <feGaussianBlur in="outerThick" stdDeviation="0.55" result="outerSoft" />
                      <feMerge><feMergeNode in="outerSoft"/><feMergeNode in="outerDistort"/></feMerge>
                    </filter>
                    <filter id="godot-edge-flame-inner" x="-18%" y="-65%" width="136%" height="230%" color-interpolation-filters="sRGB">
                      <feTurbulence type="turbulence" baseFrequency="0.024 0.19" numOctaves="1" seed="29" result="innerNoise">
                        <animate attributeName="baseFrequency" values="0.021 0.16;0.029 0.23;0.023 0.18" dur="0.63s" repeatCount="indefinite" />
                      </feTurbulence>
                      <feDisplacementMap in="SourceGraphic" in2="innerNoise" scale="5.5" xChannelSelector="G" yChannelSelector="R" result="innerDistort" />
                      <feGaussianBlur in="innerDistort" stdDeviation="0.18" />
                    </filter>
                    <filter id="godot-edge-flame-surge" x="-34%" y="-155%" width="168%" height="410%" color-interpolation-filters="sRGB">
                      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.1" numOctaves="3" seed="41" result="surgeNoise">
                        <animate attributeName="baseFrequency" values="0.009 0.075;0.018 0.16;0.011 0.095" dur="0.48s" repeatCount="indefinite" />
                      </feTurbulence>
                      <feDisplacementMap in="SourceGraphic" in2="surgeNoise" scale="21" xChannelSelector="B" yChannelSelector="R" result="surgeDistort" />
                      <feMorphology in="surgeDistort" operator="dilate" radius="1.15" result="surgeThick" />
                      <feGaussianBlur in="surgeThick" stdDeviation="0.7" result="surgeSoft" />
                      <feMerge><feMergeNode in="surgeSoft"/><feMergeNode in="surgeDistort"/></feMerge>
                    </filter>
                  </defs>
                </svg>
              </span>
            </p>
          </article>
        </section>

        <div class="future-slot" data-future-slot aria-hidden="true"></div>

        <section class="terminal-shell profile-reveal" style="--reveal-index:2" aria-label="Live research news terminal" data-paused="false">
          <div class="terminal-atmosphere" aria-hidden="true">
            <div class="terminal-telemetry-rain">
              ${telemetryColumns.map((tokens, index) => `<span style="--rain-x:${8 + index * 17}%;--rain-duration:${15 + index * 1.7}s;--rain-delay:-${index * 2.35}s">${tokens}</span>`).join("")}
            </div>
          </div>
          <header class="terminal-session">
            <div class="terminal-session-id">
              <span class="terminal-app-icon" aria-hidden="true">›_</span>
              <b>TTY / RESEARCH-TAIL</b>
              <small>PTS-01</small>
            </div>
            <div class="terminal-session-meta">
              <span data-terminal-buffer>BUFFER ${String(Math.min(content.news.length, 9)).padStart(2, "0")}/09</span>
              <button class="terminal-follow-toggle" type="button" aria-pressed="false" aria-label="Pause live research log" data-terminal-toggle>
                <i aria-hidden="true"></i><span data-terminal-state>FOLLOW</span>
              </button>
            </div>
          </header>
          <div class="terminal-command">
            <span class="terminal-user">zongyuan@oasis</span>
            <span class="terminal-path">~/research</span>
            <b>$</b>
            <code>tail -f news.log</code>
          </div>
          <div class="terminal-columns" aria-hidden="true"><span>DATE</span><span>STREAM</span><span>EVENT</span></div>
          <div class="terminal-viewport">
            <div class="terminal-lines" data-terminal-lines role="log" aria-live="off" tabindex="0"></div>
            <div class="terminal-output-cursor" aria-hidden="true"><i></i><span>awaiting record</span></div>
          </div>
          <footer class="terminal-status">
            <span><i aria-hidden="true"></i><b data-terminal-footer>follow mode · waiting for append</b></span>
            <code>UTF-8 / RO</code>
          </footer>
        </section>
      </div>

      <section class="gallery-stage profile-reveal" style="--reveal-index:1" aria-label="Selected research cabinet">
        <div class="gallery-stage-head"><span>Selected Works / 04</span><b>Realtime PBR Cabinet</b></div>
        <div class="gallery-mount" id="hero-exhibits">${renderGalleryPoster(content.projects)}</div>
      </section>
    </section>
  `;
}

function renderMedia(project: Project): string {
  if (project.media.type === "video") {
    return `<video data-section-video="voyage" muted loop playsinline preload="metadata" poster="${escapeHtml(project.media.poster)}" aria-label="${escapeHtml(project.media.alt)}"><source src="${escapeHtml(project.media.src)}" type="video/mp4" /></video>`;
  }
  return `<img src="${escapeHtml(project.media.src)}" alt="${escapeHtml(project.media.alt)}" loading="lazy" />`;
}

function renderEvidenceCard(project: Project): string {
  return `
    <article class="evidence-card" data-project-card="${project.id}">
      <div class="evidence-topline"><span>${escapeHtml(project.venue)}</span><b>${project.id === "ssat" || project.id === "directl" ? "Legendary" : "Rare"}</b></div>
      <figure>${renderMedia(project)}</figure>
      <div class="evidence-copy">
        <div><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.summary)}</p></div>
        <nav aria-label="${escapeHtml(project.title)} links">${linksMarkup(project.links)}</nav>
      </div>
    </article>
  `;
}

function renderVoyage(content: SiteContent): string {
  const featured = ["ssat", "directl", "eva01"].map((id) => content.projects.find((project) => project.id === id)!).filter(Boolean);
  const current = content.voyage.nodes.find((node) => node.status === "current")!;
  return `
    <section class="scene voyage-scene" id="voyage" aria-labelledby="voyage-title" data-section="voyage">
      <div class="voyage-board">
        <header class="voyage-header scene-reveal">
          <div><span>Capability Stack</span><h2 id="voyage-title">Neural Graphics <i>→</i> 3D MLLM <i>→</i> Game World Model</h2></div>
          <div class="voyage-progress"><span>PhD Voyage</span><strong>03 / 04</strong><i><b></b></i></div>
        </header>
        <div class="voyage-layout">
          <div class="voyage-main">
            <section class="ocean-map scene-reveal" aria-label="Interactive research voyage map">
              <canvas class="pixel-ocean" data-ocean="sunset" aria-hidden="true"></canvas>
              <canvas class="landmark-scene-canvas" data-landmark-scene aria-hidden="true"></canvas>
              <div class="ocean-grain" aria-hidden="true"></div>
              <svg class="voyage-route" viewBox="0 0 1000 440" preserveAspectRatio="none" aria-hidden="true">
                <path class="route-depth" d="M65 315 C210 190 340 330 510 270 C650 218 755 230 945 120" />
                <path class="route-wake" d="M65 315 C210 190 340 330 510 270 C650 218 755 230 945 120" />
                <path class="route-future" d="M755 230 C835 195 890 160 945 120" />
              </svg>
              <div class="voyage-nodes" role="listbox" aria-label="Research voyage nodes">
                ${content.voyage.nodes.map((node, index) => `
                  <button class="voyage-node node-${node.status}" style="--node-x:${node.x}%;--node-y:${node.y}%" data-voyage-node="${node.id}" data-node-index="${index}" role="option" aria-selected="${node.id === current.id}">
                    ${landmarkMarkup(node.landmark)}
                    <span><b>${escapeHtml(node.title)}</b><small>${escapeHtml(node.subtitle)}</small></span>
                  </button>
                `).join("")}
              </div>
              <div class="boat-position" style="--boat-x:${content.voyage.nodes[0].x}%;--boat-y:${content.voyage.nodes[0].y}%" data-voyage-boat>
                ${sailboatMarkup()}
                <span>Current Stage 03 / 04</span>
              </div>
            </section>
            <section class="evidence-deck scene-reveal" aria-label="Featured research evidence">
              ${featured.map(renderEvidenceCard).join("")}
            </section>
          </div>

          <aside class="voyage-side scene-reveal">
            <article class="captains-log" data-captains-log>
              <div class="panel-heading"><span>Captain’s Log</span><b>Current</b></div>
              <div class="captain-status"><i></i><span>${escapeHtml(current.status)}</span></div>
              <h3>${escapeHtml(current.title)}</h3>
              <strong>${escapeHtml(current.subtitle)}</strong>
              <p>${escapeHtml(current.log)}</p>
              <small>${escapeHtml(current.venue)}</small>
              <div class="captain-actions" data-captain-actions></div>
            </article>
            <div class="support-drawers">
              <section class="support-drawer is-open">
                <button type="button" aria-expanded="true"><span>Awards</span><b>${content.awards.length.toString().padStart(2, "0")}</b></button>
                <div class="drawer-content">
                  ${content.awards.map((award) => `<article><b>${escapeHtml(award.title)}</b><p>${escapeHtml(award.text)}</p></article>`).join("")}
                </div>
              </section>
              <section class="support-drawer">
                <button type="button" aria-expanded="false"><span>Services</span><b>${content.services.length.toString().padStart(2, "0")}</b></button>
                <div class="drawer-content">${content.services.length ? content.services.map((item) => `<article><b>${escapeHtml(item.tag)}</b><p>${escapeHtml(item.text)}</p></article>`).join("") : `<p class="drawer-empty">No verified entries yet.</p>`}</div>
              </section>
              <section class="support-drawer">
                <button type="button" aria-expanded="false"><span>Archive</span><b>${content.archive.length.toString().padStart(2, "0")}</b></button>
                <div class="drawer-content archive-list">
                  ${content.archive.map((item) => `<article><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.venue)}</p></article>`).join("")}
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </section>
  `;
}

function renderHorizon(content: SiteContent): string {
  return `
    <section class="scene horizon-scene" id="horizon" aria-labelledby="horizon-title" data-section="horizon">
      <picture class="horizon-fallback" aria-hidden="true">
        <source media="(max-width: 760px)" srcset="/assets/horizon/horizon-fallback-mobile.webp" />
        <img src="/assets/horizon/horizon-fallback-desktop.webp" alt="" decoding="async" />
      </picture>
      <canvas class="horizon-canvas" data-horizon-scene aria-hidden="true"></canvas>
      <header class="horizon-heading"><span>03 / HORIZON</span><h2 id="horizon-title">${escapeHtml(content.ending.kicker)}</h2></header>
      <ol class="horizon-chapters" aria-label="Future chapters">
        ${content.ending.chapters.map((chapter, index) => `<li><span>0${index + 1}</span><i aria-hidden="true"></i><h3>${escapeHtml(chapter.title)}</h3></li>`).join("")}
      </ol>
    </section>
  `;
}

export function renderApplication(content: SiteContent): string {
  return `
    <nav class="chapter-nav" aria-label="Research arcade chapters">
      <div class="nav-brand"><span></span><b>ROYALVICE</b><small>Research Arcade</small></div>
      <div class="nav-track" aria-hidden="true"><i></i></div>
      <div class="nav-links">
        <a class="chapter-link is-active" href="#profile" data-nav-section="profile" aria-current="page"><i></i><span>01</span><b>Profile</b></a>
        <a class="chapter-link" href="#voyage" data-nav-section="voyage"><i></i><span>02</span><b>Voyage</b></a>
        <a class="chapter-link" href="#horizon" data-nav-section="horizon"><i></i><span>03</span><b>Horizon</b></a>
      </div>
      <div class="nav-signal"><i></i><span>Signal Online</span></div>
    </nav>
    <main>${renderProfile(content)}${renderVoyage(content)}${renderHorizon(content)}</main>
    <div class="journey-bridge-boat" data-journey-bridge aria-hidden="true"><i></i></div>
  `;
}

function initializeDrawers(): void {
  const drawers = [...document.querySelectorAll<HTMLElement>(".support-drawer")];
  drawers.forEach((drawer) => {
    const button = drawer.querySelector<HTMLButtonElement>("button");
    button?.addEventListener("click", () => {
      const willOpen = !drawer.classList.contains("is-open");
      drawers.forEach((item) => {
        item.classList.remove("is-open");
        item.querySelector("button")?.setAttribute("aria-expanded", "false");
      });
      if (willOpen) {
        drawer.classList.add("is-open");
        button.setAttribute("aria-expanded", "true");
      }
    });
  });
}

function initializeSiggraphMachine(reducedMotion: boolean): () => void {
  const machine = document.querySelector<HTMLElement>("[data-siggraph-machine]");
  const reel = machine?.querySelector<HTMLElement>(".siggraph-reel");
  const track = machine?.querySelector<HTMLElement>("[data-siggraph-track]");
  const lever = machine?.querySelector<HTMLButtonElement>(".siggraph-lever");
  const coins = Array.from(document.querySelectorAll<HTMLElement>("[data-slot-coin]"));
  if (!machine || !reel || !track || !lever) return () => undefined;

  const timers = new Set<number>();
  let reelAnimation: Animation | null = null;
  let coinAnimations: Animation[] = [];
  let pullCount = 0;
  let coinBurstPoses: CoinBurstPose[] = [];

  const prepareCoinBurst = () => {
    coinBurstPoses = coins.map(() => {
      // A rain field, not a radial payout: each coin enters from the upper edge,
      // drifts slightly in the wind, then accelerates through the whole dossier.
      const startX = -3 + Math.random() * 106;
      const startY = -18 + Math.random() * 19;
      const wind = Math.random() * 22 - 11;
      const sway = Math.random() * 10 - 5;
      const midX = startX + sway;
      const midY = 13 + Math.random() * 14;
      const fallX = startX + wind * .55 - sway * .25;
      const fallY = 53 + Math.random() * 17;
      const endX = startX + wind;
      const endY = 106 + Math.random() * 18;
      const direction = Math.random() > .5 ? 1 : -1;
      const spin = direction * (520 + Math.random() * 460);
      const flip = direction * (620 + Math.random() * 680);
      const peakScale = .68 + Math.random() * .48;
      const endScale = peakScale * (.72 + Math.random() * .18);

      return {
        startX,
        startY,
        midX,
        midY,
        fallX,
        fallY,
        endX,
        endY,
        delay: Math.round(Math.random() * 390),
        duration: 720 + Math.round(Math.random() * 100),
        midRotation: spin * .2,
        fallRotation: spin * .58,
        endRotation: spin,
        midFlip: flip * .18,
        fallFlip: flip * .6,
        endFlip: flip,
        peakScale,
        endScale
      };
    });
  };

  const playCoinBurst = () => {
    coinAnimations.forEach((animation) => animation.cancel());
    coinAnimations = [];
    if (reducedMotion || !coinBurstPoses.length) return;

    const burstBounds = coins[0]?.parentElement?.getBoundingClientRect();
    if (!burstBounds) return;
    const toTransform = (x: number, y: number, rotation: number, flip: number, scale: number): string =>
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate3d(-50%, -50%, 0) rotate(${rotation.toFixed(1)}deg) rotateY(${flip.toFixed(1)}deg) scale(${scale.toFixed(2)})`;

    coinAnimations = coins.map((coin, index) => {
      const pose = coinBurstPoses[index];
      const startX = burstBounds.width * pose.startX / 100;
      const startY = burstBounds.height * pose.startY / 100;
      const midX = burstBounds.width * pose.midX / 100;
      const midY = burstBounds.height * pose.midY / 100;
      const fallX = burstBounds.width * pose.fallX / 100;
      const fallY = burstBounds.height * pose.fallY / 100;
      const endX = burstBounds.width * pose.endX / 100;
      const endY = burstBounds.height * pose.endY / 100;

      coin.style.left = "0px";
      coin.style.top = "0px";
      return coin.animate([
        { opacity: 0, filter: "brightness(.92) drop-shadow(0 0 0 rgba(255,191,34,0))", transform: toTransform(startX, startY, -8, 0, pose.peakScale * .72), offset: 0 },
        { opacity: 1, filter: "brightness(1.08) drop-shadow(0 -1px 1px rgba(255,191,34,.2))", transform: toTransform(startX, startY + 3, 6, 52, pose.peakScale * .8), offset: .08 },
        { opacity: 1, filter: "brightness(1.12) drop-shadow(0 -3px 2px rgba(255,183,28,.28))", transform: toTransform(midX, midY, pose.midRotation, pose.midFlip, pose.peakScale), offset: .32 },
        { opacity: 1, filter: "brightness(1.06) drop-shadow(0 -8px 4px rgba(255,169,18,.34))", transform: toTransform(fallX, fallY, pose.fallRotation, pose.fallFlip, pose.peakScale * .94), offset: .7 },
        { opacity: .18, filter: "brightness(.94) drop-shadow(0 -13px 6px rgba(255,155,15,.22))", transform: toTransform(endX, endY, pose.endRotation, pose.endFlip, pose.endScale), offset: 1 }
      ], {
        duration: pose.duration,
        delay: pose.delay,
        easing: "linear",
        fill: "both"
      });
    });
  };

  const later = (callback: () => void, delay: number): void => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };

  const cellHeight = (): number => reel.getBoundingClientRect().height;

  const setPosition = (index: number): void => {
    track.style.transform = `translate3d(0, ${-index * cellHeight()}px, 0)`;
  };

  const currentPosition = (): number => {
    const transform = getComputedStyle(track).transform;
    if (!transform || transform === "none") return 0;
    return new DOMMatrixReadOnly(transform).m42;
  };

  const cancelReelAtCurrentPosition = (): number => {
    const position = currentPosition();
    reelAnimation?.cancel();
    reelAnimation = null;
    track.style.transform = `translate3d(0, ${position}px, 0)`;
    return position;
  };

  const startIdle = (): void => {
    reelAnimation?.cancel();
    if (reducedMotion) {
      setPosition(2);
      machine.dataset.result = "2";
      machine.classList.add("is-settled");
      return;
    }
    setPosition(0);
    machine.dataset.result = "rolling";
    const cycle = cellHeight() * 10;
    reelAnimation = track.animate(
      [
        { transform: "translate3d(0, 0, 0)" },
        { transform: `translate3d(0, ${-cycle}px, 0)` }
      ],
      { duration: 720, iterations: Infinity, easing: "linear" }
    );
  };

  const pull = (): void => {
    if (machine.classList.contains("is-resolving")) return;
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
    const wasSettled = machine.dataset.result === "2";
    let startY = cancelReelAtCurrentPosition();
    if (wasSettled) {
      setPosition(2);
      startY = -2 * cellHeight();
    }
    pullCount += 1;
    machine.dataset.pullCount = String(pullCount);
    coinAnimations.forEach((animation) => animation.cancel());
    coinAnimations = [];
    prepareCoinBurst();
    machine.dataset.result = "resolving";
    machine.classList.remove("is-settled", "is-payout");
    machine.classList.add("is-resolving", "is-pulling");
    lever.disabled = true;

    if (reducedMotion) {
      setPosition(2);
      machine.dataset.result = "2";
      machine.classList.remove("is-resolving", "is-pulling");
      machine.classList.add("is-settled", "is-payout");
      playCoinBurst();
      lever.disabled = false;
      later(() => machine.classList.remove("is-payout"), 450);
      return;
    }

    const finalIndex = 72;
    const finalY = -finalIndex * cellHeight();
    reelAnimation = track.animate(
      [
        { transform: `translate3d(0, ${startY}px, 0)`, offset: 0 },
        { transform: `translate3d(0, ${finalY}px, 0)`, offset: 1 }
      ],
      { duration: 2050, easing: "cubic-bezier(.1,.72,.14,1)", fill: "forwards" }
    );
    reelAnimation.finished.then(() => {
      track.style.transform = `translate3d(0, ${finalY}px, 0)`;
      reelAnimation?.cancel();
      reelAnimation = track.animate(
        [
          { transform: `translate3d(0, ${finalY - 3}px, 0)` },
          { transform: `translate3d(0, ${finalY + 2}px, 0)`, offset: .55 },
          { transform: `translate3d(0, ${finalY}px, 0)` }
        ],
        { duration: 180, easing: "ease-out", fill: "forwards" }
      );
      machine.dataset.result = "2";
      machine.classList.remove("is-resolving", "is-pulling");
      machine.classList.add("is-settled", "is-payout");
      playCoinBurst();
      lever.disabled = false;
      later(() => machine.classList.remove("is-payout"), 1350);
    }).catch(() => undefined);
  };

  lever.addEventListener("click", pull);
  startIdle();
  return () => {
    reelAnimation?.cancel();
    coinAnimations.forEach((animation) => animation.cancel());
    timers.forEach((timer) => window.clearTimeout(timer));
    lever.removeEventListener("click", pull);
  };
}

function initializeVoyage(content: SiteContent, state: AppState): void {
  const nodes = [...document.querySelectorAll<HTMLButtonElement>("[data-voyage-node]")];
  const boat = document.querySelector<HTMLElement>("[data-voyage-boat]");
  const log = document.querySelector<HTMLElement>("[data-captains-log]");
  if (!boat || !log) return;
  let userHasSelectedNode = false;

  const selectNode = (node: VoyageNode, focus = false): void => {
    state.selectedVoyageNode = node.id;
    nodes.forEach((button) => {
      const selected = button.dataset.voyageNode === node.id;
      button.setAttribute("aria-selected", String(selected));
      if (selected && focus) button.focus();
    });
    boat.style.setProperty("--boat-x", `${node.id === "world" ? 84 : Math.min(90, node.x + 8)}%`);
    boat.style.setProperty("--boat-y", `${node.id === "world" ? 42 : Math.min(82, node.y + 4)}%`);
    boat.style.setProperty("--boat-duration", `${Math.max(450, Math.min(900, Math.abs(node.progress - .75) * 1500))}ms`);
    log.querySelector(".panel-heading b")!.textContent = node.status === "future" ? "Next Quest" : node.status;
    log.querySelector(".captain-status span")!.textContent = node.status;
    log.querySelector("h3")!.textContent = node.title;
    log.querySelector("strong")!.textContent = node.subtitle;
    log.querySelector("p")!.textContent = node.log;
    log.querySelector("small")!.textContent = node.venue;
    const actions = log.querySelector<HTMLElement>("[data-captain-actions]")!;
    actions.innerHTML = node.id === "world" ? `<a href="#horizon">Enter Horizon <span>→</span></a>` : "";
    document.querySelectorAll<HTMLElement>("[data-project-card]").forEach((card) => {
      card.classList.toggle("is-selected", node.projectIds.includes(card.dataset.projectCard as ProjectId));
    });
  };

  nodes.forEach((button, index) => {
    const node = content.voyage.nodes[index];
    button.addEventListener("click", () => {
      userHasSelectedNode = true;
      selectNode(node);
    });
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      userHasSelectedNode = true;
      const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
      const next = (index + delta + nodes.length) % nodes.length;
      selectNode(content.voyage.nodes[next], true);
    });
  });

  const current = content.voyage.nodes.find((node) => node.status === "current")!;
  selectNode(current);
  const section = document.getElementById("voyage");
  if (section && !state.reducedMotion) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      section.classList.add("has-entered");
      window.setTimeout(() => {
        if (!userHasSelectedNode) selectNode(current);
      }, 80);
      observer.disconnect();
    }, { threshold: .3 });
    observer.observe(section);
  }
}

export async function initializeApplication({ content, state, onSectionChange }: InitOptions): Promise<void> {
  document.documentElement.dataset.motion = state.reducedMotion ? "reduced" : "full";
  document.documentElement.dataset.section = "profile";
  if (state.reducedMotion) {
    document.querySelectorAll<SVGSVGElement>(".godot-flame-filter").forEach((svg) => svg.pauseAnimations());
  }

  const terminalRoot = document.querySelector<HTMLElement>(".terminal-shell");
  const terminal = terminalRoot ? new TerminalController(terminalRoot, content.news, state) : null;
  terminal?.start();
  const destroySiggraphMachine = initializeSiggraphMachine(state.reducedMotion);
  initializeDrawers();
  initializeVoyage(content, state);

  const renderers = new Map<SectionId, SceneRenderer[]>();
  const registerRenderer = (section: SectionId, renderer: SceneRenderer): void => {
    const sectionRenderers = renderers.get(section) ?? [];
    sectionRenderers.push(renderer);
    renderers.set(section, sectionRenderers);
  };
  let voyageOceanRenderer: TransitionAwareSceneRenderer | null = null;
  let horizonRenderer: (TransitionAwareSceneRenderer & { setBridgeActive(active: boolean): void }) | null = null;
  const { PixelOceanRenderer } = await import("../ocean/PixelOceanRenderer");
  document.querySelectorAll<HTMLCanvasElement>('[data-ocean="sunset"]').forEach((canvas) => {
    try {
      const renderer = new PixelOceanRenderer(canvas);
      renderer.setQuality(state.qualityTier);
      renderer.start();
      if (state.reducedMotion) window.setTimeout(() => renderer.pause(), 120);
      voyageOceanRenderer = renderer;
      registerRenderer("voyage", renderer);
    } catch (error) {
      canvas.closest<HTMLElement>(".scene")?.classList.add("ocean-fallback");
      console.warn("Pixel ocean fallback active", error);
    }
  });

  const horizonCanvas = document.querySelector<HTMLCanvasElement>("[data-horizon-scene]");
  if (horizonCanvas) {
    void import("../horizon/HorizonSceneRenderer").then(async ({ HorizonSceneRenderer }) => {
      const renderer = new HorizonSceneRenderer(horizonCanvas, {
        reducedMotion: state.reducedMotion,
        qualityTier: state.qualityTier,
        boatAtlasUrl: "/assets/horizon/research-boat-night-atlas.webp",
        noiseTextureUrl: "/assets/horizon/blue-noise-128.webp",
        ufoAtlasUrl: "/assets/horizon/ufo-atlas.png"
      });
      await renderer.init();
      horizonRenderer = renderer;
      registerRenderer("horizon", renderer);
      renderer.setTransitionProgress(state.reducedMotion ? 1 : state.journeyTransition);
      if (state.activeSection !== "horizon" || !state.documentVisible) renderer.pause();
    }).catch((error) => {
      horizonCanvas.closest<HTMLElement>(".horizon-scene")?.classList.add("horizon-fallback-active");
      console.warn("Horizon scene fallback active", error);
    });
  }

  let gallery: { pause?: () => void; resume?: () => void; destroy: () => void } | null = null;
  const galleryRoot = document.getElementById("hero-exhibits");
  if (galleryRoot) {
    // Gallery loading is intentionally detached from the navigation/scene
    // lifecycle. Its large cabinet and texture bundle must not delay Voyage
    // boat/landmark initialization when a visitor scrolls quickly.
    void (async () => { try {
      await new Promise<void>((resolve) => {
        if ("requestIdleCallback" in window) {
          (window as Window & { requestIdleCallback: (callback: () => void, options?: { timeout: number }) => void }).requestIdleCallback(resolve, { timeout: 600 });
        } else window.setTimeout(resolve, 80);
      });
      const { PlayCanvasGallery } = await import("../gallery/PlayCanvasGallery");
      const instance = new PlayCanvasGallery(galleryRoot, content.projects);
      await instance.init();
      gallery = instance;
      galleryRoot.classList.add("is-ready");
      if (state.activeSection !== "profile") instance.pause();
    } catch (error) {
      console.error("PlayCanvas cabinet failed; preserving static fallback", error);
      galleryRoot.innerHTML = renderGalleryPoster(content.projects);
      galleryRoot.classList.add("is-fallback");
    } })();
  }

  const boatInitializers = new Map<SectionId, Promise<void>>();
  let landmarkInitialization: Promise<void> | null = null;
  const ensureLandmarkRenderers = (): void => {
    if (landmarkInitialization || window.matchMedia("(max-width: 760px)").matches) return;
    landmarkInitialization = import("../voyage/LandmarkModelRenderer").then(async ({ LandmarkModelRenderer }) => {
      const canvas = document.querySelector<HTMLCanvasElement>("[data-landmark-scene]");
      if (!canvas) return;
      const renderer = new LandmarkModelRenderer(canvas, content.voyage.nodes);
      renderer.setQuality(state.qualityTier);
      await renderer.init();
      registerRenderer("voyage", renderer);
      if (state.activeSection !== "voyage" || !state.documentVisible) renderer.pause();
    }).catch((error) => console.warn("Voyage landmark mesh fallback active", error));
  };
  const ensureBoatRenderer = (section: SectionId): void => {
    if (section !== "voyage") return;
    if (window.matchMedia("(max-width: 760px)").matches) return;
    if (boatInitializers.has(section)) return;
    ensureLandmarkRenderers();
    const canvas = document.querySelector<HTMLCanvasElement>('[data-boat-model="sunset"]');
    if (!canvas) return;

    const initialization = import("../voyage/BoatModelRenderer")
      .then(async ({ BoatModelRenderer }) => {
        const renderer = new BoatModelRenderer(canvas, "sunset");
        renderer.setQuality(state.qualityTier);
        await renderer.init();
        registerRenderer(section, renderer);
        if (state.activeSection === section && state.documentVisible) renderer.resume();
        else renderer.pause();
      })
      .catch((error) => {
        const host = canvas.closest<HTMLElement>(".research-boat");
        host?.classList.remove("is-model-loading", "is-model-ready");
        host?.classList.add("is-model-fallback");
        console.warn("Generated voyage boat fallback active", error);
      });
    boatInitializers.set(section, initialization);
  };

  const sections = [...document.querySelectorAll<HTMLElement>("[data-section]")];
  const navLinks = [...document.querySelectorAll<HTMLAnchorElement>("[data-nav-section]")];
  const chapterNav = document.querySelector<HTMLElement>(".chapter-nav");
  const bridge = document.querySelector<HTMLElement>("[data-journey-bridge]");
  const voyageBoat = document.querySelector<HTMLElement>("[data-voyage-boat] .research-boat") ?? document.querySelector<HTMLElement>("[data-voyage-boat]");
  const horizonSection = document.getElementById("horizon");
  let transitionRaf = 0;
  let navigationTimer = 0;

  const scheduleNavigationSettle = (): void => {
    window.clearTimeout(navigationTimer);
    document.documentElement.classList.remove("horizon-ui-settled");
    state.horizonSettled = false;
    if (state.activeSection !== "horizon") return;
    navigationTimer = window.setTimeout(() => {
      state.horizonSettled = true;
      document.documentElement.classList.add("horizon-ui-settled");
    }, state.reducedMotion ? 0 : 1800);
  };

  const updateJourneyTransition = (): void => {
    transitionRaf = 0;
    if (!horizonSection) return;
    const viewportHeight = Math.max(window.innerHeight, 1);
    const horizonRect = horizonSection.getBoundingClientRect();
    const start = viewportHeight * .88;
    const end = viewportHeight * .18;
    const rawProgress = (start - horizonRect.top) / Math.max(1, start - end);
    const progress = state.reducedMotion
      ? horizonRect.top < viewportHeight * .53 ? 1 : 0
      : Math.min(1, Math.max(0, rawProgress));
    state.journeyTransition = progress;
    document.documentElement.style.setProperty("--journey-progress", progress.toFixed(4));
    voyageOceanRenderer?.setTransitionProgress(progress);
    horizonRenderer?.setTransitionProgress(progress);

    const crossing = !state.reducedMotion && progress > .08 && progress < .92 && Boolean(bridge && voyageBoat);
    document.documentElement.classList.toggle("is-journey-crossing", crossing);
    horizonRenderer?.setBridgeActive(crossing);
    if (crossing && state.documentVisible) {
      voyageOceanRenderer?.resume();
      horizonRenderer?.resume();
    }
    if (!bridge || !voyageBoat) return;
    bridge.classList.toggle("is-active", crossing);
    if (!crossing) return;

    const source = voyageBoat.getBoundingClientRect();
    const local = Math.min(1, Math.max(0, (progress - .08) / .84));
    const eased = local * local * (3 - 2 * local);
    const sourceX = source.left + source.width * .5;
    const sourceY = source.top + source.height * .5;
    const targetX = horizonRect.left + horizonRect.width * .61;
    const targetY = horizonRect.top + horizonRect.height * .66;
    const targetWidth = Math.max(74, horizonRect.height * .138);
    const width = source.width + (targetWidth - source.width) * eased;
    const x = sourceX + (targetX - sourceX) * eased;
    const y = sourceY + (targetY - sourceY) * eased;
    const frame = Math.floor((performance.now() / 400) % 12);
    const column = frame % 4;
    const row = Math.floor(frame / 4);
    bridge.style.setProperty("--bridge-x", `${x}px`);
    bridge.style.setProperty("--bridge-y", `${y}px`);
    bridge.style.setProperty("--bridge-width", `${width}px`);
    bridge.style.setProperty("--bridge-frame-x", `${column * 33.3333}%`);
    bridge.style.setProperty("--bridge-frame-y", `${row * 50}%`);
  };

  const requestTransitionUpdate = (): void => {
    if (!transitionRaf) transitionRaf = requestAnimationFrame(updateJourneyTransition);
  };

  const wakeNavigation = (): void => {
    scheduleNavigationSettle();
    requestTransitionUpdate();
  };

  window.addEventListener("scroll", wakeNavigation, { passive: true });
  chapterNav?.addEventListener("pointerenter", () => {
    window.clearTimeout(navigationTimer);
    document.documentElement.classList.remove("horizon-ui-settled");
  });
  chapterNav?.addEventListener("pointerleave", scheduleNavigationSettle);
  chapterNav?.addEventListener("focusin", () => {
    window.clearTimeout(navigationTimer);
    document.documentElement.classList.remove("horizon-ui-settled");
  });
  chapterNav?.addEventListener("focusout", scheduleNavigationSettle);
  requestTransitionUpdate();

  const sectionObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const active = (visible.target as HTMLElement).dataset.section as SectionId;
    onSectionChange(active);
    sections.forEach((section) => section.classList.toggle("is-active", section.dataset.section === active));
    navLinks.forEach((link) => {
      const current = link.dataset.navSection === active;
      link.classList.toggle("is-active", current);
      if (current) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    });
    renderers.forEach((sectionRenderers, section) => {
      if (state.reducedMotion) return;
      const transitionKeepsSceneAlive = state.journeyTransition > .08
        && state.journeyTransition < .92
        && (section === "voyage" || section === "horizon");
      sectionRenderers.forEach((renderer) => {
        if (section === active || transitionKeepsSceneAlive) renderer.resume(); else renderer.pause();
      });
    });
    ensureBoatRenderer(active);
    scheduleNavigationSettle();
    if (active === "profile") gallery?.resume?.(); else gallery?.pause?.();
    document.querySelectorAll<HTMLVideoElement>("[data-section-video]").forEach((video) => {
      if (video.dataset.sectionVideo === active && !state.reducedMotion) video.play().catch(() => undefined);
      else video.pause();
    });
  }, { threshold: [.25, .45, .7] });
  sections.forEach((section) => sectionObserver.observe(section));

  document.addEventListener("visibilitychange", () => {
    state.documentVisible = !document.hidden;
    if (document.hidden) {
      renderers.forEach((sectionRenderers) => sectionRenderers.forEach((renderer) => renderer.pause()));
      gallery?.pause?.();
      document.querySelectorAll("video").forEach((video) => video.pause());
    } else if (!state.reducedMotion) {
      renderers.get(state.activeSection)?.forEach((renderer) => renderer.resume());
      if (state.activeSection === "profile") gallery?.resume?.();
    }
  });

  window.addEventListener("resize", () => {
    renderers.forEach((sectionRenderers) => sectionRenderers.forEach((renderer) => renderer.resize()));
    requestTransitionUpdate();
  });
  window.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target as HTMLElement;
    if (target.matches("input, textarea, [contenteditable=true]")) return;
    if (event.key === "Home") {
      event.preventDefault();
      document.getElementById("profile")?.scrollIntoView({ behavior: state.reducedMotion ? "auto" : "smooth" });
    }
    if (event.key === "End") {
      event.preventDefault();
      document.getElementById("horizon")?.scrollIntoView({ behavior: state.reducedMotion ? "auto" : "smooth" });
    }
    if (event.key === "Escape") {
      document.querySelectorAll(".gallery-ui-card.is-active").forEach((card) => card.classList.remove("is-active"));
      state.selectedProject = null;
    }
  });

  window.addEventListener("beforeunload", () => {
    terminal?.destroy();
    destroySiggraphMachine();
    gallery?.destroy();
    cancelAnimationFrame(transitionRaf);
    window.clearTimeout(navigationTimer);
    renderers.forEach((sectionRenderers) => sectionRenderers.forEach((renderer) => renderer.destroy()));
  });
}
