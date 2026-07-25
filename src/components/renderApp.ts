import githubSvg from "simple-icons/icons/github.svg?raw";
import scholarSvg from "simple-icons/icons/googlescholar.svg?raw";
import huggingFaceSvg from "simple-icons/icons/huggingface.svg?raw";
import type { AppState } from "../app/state";
import type { LinkItem, Project, ProjectId, SectionId, SiteContent, VoyageNode } from "../content/site";
import type { SceneRenderer, TransitionAwareSceneRenderer } from "../scenes/SceneRenderer";
import type { PlayCanvasGallery } from "../gallery/PlayCanvasGallery";
import type { ProfileAdventureDirector } from "../profile/ProfileAdventureDirector";
import { TerminalController } from "./TerminalController";

type InitOptions = {
  content: SiteContent;
  state: AppState;
  onSectionChange: (section: SectionId) => void;
};

const SIGGRAPH_FIRST_AUTHOR_PAPER_COUNT = 3;
const SIGGRAPH_REEL_CYCLES = 7;
const SIGGRAPH_REEL_DIGITS = 10;

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
    dock: "/assets/voyage/landmarks/posters/v2/dock-cutout.webp",
    lighthouse: "/assets/voyage/landmarks/posters/v2/lighthouse-cutout.webp",
    reef: "/assets/voyage/landmarks/posters/v2/prism-cutout.webp",
    harbor: "/assets/voyage/landmarks/posters/v2/harbor-cutout.webp",
    gate: "/assets/voyage/landmarks/posters/v2/gate-cutout.webp"
  };
  return `<div class="landmark-model" data-landmark-model="${kind}" aria-hidden="true"><img class="landmark-poster" src="${posters[kind]}" alt="" loading="lazy" decoding="async" /></div>`;
}

function renderGalleryPoster(projects: Project[]): string {
  return `
    <div class="gallery-poster" data-gallery-poster>
      ${projects.map((project) => `
        <article class="poster-slot poster-${project.id}">
          <img src="${escapeHtml(project.heroTexture)}" alt="${escapeHtml(project.media.alt)}" />
          <span><b>${escapeHtml(project.title)}</b><small>${escapeHtml(project.venue)}</small></span>
        </article>
      `).join("")}
      <div class="gallery-loading-copy"><span></span> INITIALIZING PLAYCANVAS CABINET</div>
    </div>
  `;
}

function renderProfileRoomFallback(): string {
  return `
    <picture class="profile-room-fallback" aria-hidden="true">
      <source media="(max-width: 760px)" srcset="/assets/profile/adventure/room-v3/posters/profile-room-v3-fallback-mobile.webp" />
      <img src="/assets/profile/adventure/room-v3/posters/profile-room-v3-fallback-desktop.webp" alt="" decoding="async" />
    </picture>
  `;
}

function renderProfile(content: SiteContent): string {
  const p = content.profile;
  const brandIcons: Record<string, string> = { github: githubSvg, scholar: scholarSvg, huggingface: huggingFaceSvg };
  const reelDigits = Array.from({ length: SIGGRAPH_REEL_CYCLES + 1 }, () => Array.from({ length: SIGGRAPH_REEL_DIGITS }, (_, digit) => digit)).flat();
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
            <div class="profile-telemetry-row">
              <ol class="research-route" aria-label="Research route">
                <li class="is-complete"><span></span><b>Neural Graphics</b></li>
                <li class="is-current" aria-current="step"><span></span><b>3D MLLM</b></li>
                <li class="is-future"><span></span><b>Game World Model</b></li>
              </ol>
              <a class="visitor-telemetry" data-visitor-telemetry data-state="preview" href="https://visitorbadge.io/status?path=https%3A%2F%2Froyalvice.github.io%2F" target="_blank" rel="noreferrer" aria-label="View today's and total visitor counts for royalvice.github.io">
                <span class="visitor-heading"><i class="visitor-signal" aria-hidden="true"></i><b>LIVE COUNT</b></span>
                <span class="visitor-preview" data-visitor-fallback>-- / ----</span>
                <img data-visitor-image referrerpolicy="no-referrer" alt="Today's visitors followed by total visitors for royalvice.github.io" hidden />
                <small>TODAY / TOTAL</small>
              </a>
            </div>
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
            <div class="siggraph-machine" data-siggraph-machine data-result="rolling" aria-label="Three SIGGRAPH first-author papers holographic counter">
              <span class="siggraph-hologram" aria-hidden="true"></span>
              <div class="siggraph-counter" aria-hidden="true">
                <span class="siggraph-multiplier">×</span>
                <span class="siggraph-reel">
                  <span class="siggraph-reel-track" data-siggraph-track data-target-digit="${SIGGRAPH_FIRST_AUTHOR_PAPER_COUNT}">
                    ${reelDigits.map((digit) => `<b>${digit}</b>`).join("")}
                  </span>
                </span>
              </div>
              <div class="siggraph-copy">
                <b>SIGGRAPH</b>
                <span>First-Author Papers</span>
              </div>
              <button class="siggraph-lever" type="button" aria-label="Pull lever to resolve the SIGGRAPH counter at three">
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

        <div class="future-slot" data-future-slot>${renderProfileRoomFallback()}</div>

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
          <div class="terminal-domain-bar" aria-label="Research signal domains">
            <span class="terminal-domain-badge domain-neural-graphics is-online" data-terminal-domain="neural-graphics" data-active="true"><i aria-hidden="true">◇</i><b>Neural Graphics</b></span>
            <span class="terminal-domain-badge domain-agent-harness is-online" data-terminal-domain="agent-harness" data-active="true"><i aria-hidden="true">⌘</i><b>Agent Harness</b></span>
            <span class="terminal-domain-badge domain-mllm is-online" data-terminal-domain="mllm" data-active="true"><i aria-hidden="true">◫</i><b>MLLM</b></span>
            <span class="terminal-domain-badge domain-game-world-model is-offline" data-terminal-domain="game-world-model" data-active="false"><i aria-hidden="true">▦</i><b>Game World Model</b></span>
          </div>
          <div class="terminal-command">
            <span class="terminal-user">zongyuan@oasis</span>
            <span class="terminal-path">~/research</span>
            <b>$</b>
            <code>tail -f news.log</code>
          </div>
          <div class="terminal-columns" aria-hidden="true"><span>DATE</span><span>STREAM</span><span>EVENT</span></div>
          <div class="terminal-viewport">
            <div class="terminal-lines" data-terminal-lines role="log" aria-live="off" tabindex="0"></div>
            <div class="terminal-output-cursor terminal-cycle-boundary" aria-hidden="true">
              <i></i><b>END OF NEWS</b><code>LOOP ↻</code><i></i>
            </div>
          </div>
          <footer class="terminal-status">
            <span><i aria-hidden="true"></i><b data-terminal-footer>follow mode · waiting for append</b></span>
            <code>UTF-8 / RO</code>
          </footer>
        </section>
      </div>

      <section class="gallery-stage profile-reveal" style="--reveal-index:1" aria-label="Selected research cabinet">
        <div class="gallery-stage-head"><span>Selected Works / 04</span><b>Realtime PBR Cabinet · Portal Linked</b></div>
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
    <article class="evidence-card" data-project-card="${project.id}" hidden>
      <div class="evidence-topline"><span>${escapeHtml(project.venue)}</span><b>Frame / ${escapeHtml(project.id)}</b></div>
      <figure class="evidence-media-matte" data-evidence-media>${renderMedia(project)}</figure>
      <div class="evidence-copy">
        <div><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.summary)}</p></div>
        <nav aria-label="${escapeHtml(project.title)} links">${linksMarkup(project.links)}</nav>
      </div>
    </article>
  `;
}

function renderVoyage(content: SiteContent): string {
  const current = content.voyage.nodes.find((node) => node.status === "current")!;
  const currentLog = content.voyage.logs[current.id];
  return `
    <section class="scene voyage-scene" id="voyage" aria-labelledby="voyage-title" data-section="voyage">
      <picture class="voyage-fallback-art" aria-hidden="true">
        <source media="(max-width: 760px)" srcset="/assets/voyage/voyage-fallback-mobile.webp" />
        <img src="/assets/voyage/voyage-fallback-desktop.webp" alt="" loading="lazy" decoding="async" />
      </picture>
      <canvas class="voyage-scene-canvas" data-voyage-scene aria-label="Cinematic pixel voyage from the Document Dock to the OASIS Gate"></canvas>
      <div class="voyage-vignette" aria-hidden="true"></div>

      <header class="voyage-header scene-reveal">
        <div class="voyage-title-lockup">
          <span>Act II · Research Voyage</span>
          <h2 id="voyage-title">THE LUMINOUS WAKE</h2>
          <p>Neural Graphics <i>→</i> Native 3D <i>→</i> Interactive World Models</p>
        </div>
        <div class="voyage-progress" aria-label="Current research stage 03 of 04">
          <span>Current Berth</span><strong>03 / 04</strong><i><b></b></i>
        </div>
        <button class="voyage-skip" type="button" data-voyage-skip>Skip cinematic <span>↗</span></button>
      </header>

      <div class="voyage-nodes" role="listbox" aria-label="Research voyage chapters">
        ${content.voyage.nodes.map((node, index) => `
          <button class="voyage-node node-${node.status}" style="--node-x:${node.x}%;--node-y:${node.y}%" data-voyage-node="${node.id}" data-node-index="${index}" data-asset-state="poster" role="option" aria-selected="${node.id === current.id}" aria-label="${String(index).padStart(2, "0")} ${escapeHtml(node.title)}: ${escapeHtml(node.subtitle)}">
            ${landmarkMarkup(node.landmark)}
            <span class="voyage-beacon" aria-hidden="true"><i></i><b>${String(index).padStart(2, "0")}</b></span>
            <span class="voyage-node-copy"><b>${escapeHtml(node.title)}</b><small>${escapeHtml(node.subtitle)}</small></span>
          </button>
        `).join("")}
      </div>

      <ol class="voyage-index" aria-hidden="true">
        ${content.voyage.nodes.map((node, index) => `<li class="${node.id === current.id ? "is-current" : ""}"><b>${String(index).padStart(2, "0")}</b><span>${escapeHtml(node.id === "directl" ? "LIGHTFIELD" : node.id === "neural" ? "PRISM" : node.id === "eva01" ? "NATIVE" : node.id === "world" ? "OASIS" : "DOCK")}</span></li>`).join("")}
      </ol>

      <div class="voyage-right-rail" data-voyage-right-rail>
        <aside class="captains-log" data-captains-log aria-label="Captain’s research log">
          <span class="journal-binding" aria-hidden="true"></span>
          <div class="journal-heading"><span>Captain’s Log</span><b data-log-entry>Entry ${escapeHtml(currentLog.entry)}</b></div>
          <div class="journal-status"><i></i><span data-log-status>Current berth · EVA01</span></div>
          <h3 data-log-title>${escapeHtml(currentLog.title)}</h3>
          <strong data-log-subtitle>${escapeHtml(currentLog.subtitle)}</strong>
          <dl class="journal-instruments">
            <div><dt>Watch</dt><dd data-log-watch>${escapeHtml(currentLog.watch)}</dd></div>
            <div><dt>Bearing</dt><dd data-log-bearing>${escapeHtml(currentLog.bearing)}</dd></div>
            <div><dt>Sea state</dt><dd data-log-sea>${escapeHtml(currentLog.seaState)}</dd></div>
            <div><dt>Date</dt><dd data-log-date>${escapeHtml(currentLog.date)}</dd></div>
          </dl>
          <div class="journal-copy" data-log-copy>
            ${currentLog.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
          </div>
          <nav class="captain-actions" data-captain-actions aria-label="Selected log links"></nav>
          <div class="journal-controls">
            <button type="button" data-evidence-toggle aria-expanded="false" aria-controls="voyage-evidence">Open evidence <span>↓</span></button>
          </div>
          <div class="journal-stamps" aria-label="Research distinctions">
            ${content.awards.map((award, index) => `<span title="${escapeHtml(award.text)}"><b>${String(index + 1).padStart(2, "0")}</b>${escapeHtml(award.title)}</span>`).join("")}
          </div>
        </aside>

        <section class="evidence-viewer" id="voyage-evidence" data-evidence-panel aria-label="Selected chapter evidence" aria-hidden="true" tabindex="-1">
          <header class="evidence-viewer-header">
            <div><span>Evidence monitor</span><b data-evidence-title>${escapeHtml(currentLog.title)}</b></div>
            <div class="evidence-viewer-tools">
              <span data-evidence-count>01 / 01</span>
              <button type="button" data-evidence-close aria-label="Close evidence viewer">Close <i aria-hidden="true">×</i></button>
            </div>
          </header>
          <div class="evidence-stage" aria-live="polite">
            ${content.projects.map(renderEvidenceCard).join("")}
            <article class="evidence-card evidence-future" data-evidence-future hidden>
              <div class="evidence-topline"><span>Uncharted waters</span><b>Frame / 04</b></div>
              <figure class="evidence-media-matte"><div class="evidence-aperture" aria-hidden="true"><i></i></div></figure>
              <div class="evidence-copy"><div><h3>OASIS</h3><p>The next evidence is an interactive world that continues beyond the final frame.</p></div><nav><a class="project-link" href="#horizon">Enter Horizon</a></nav></div>
            </article>
          </div>
          <nav class="evidence-pager" aria-label="Evidence frames">
            <button type="button" data-evidence-prev aria-label="Previous evidence frame">← Prev</button>
            <span>Complete frame · Original aspect</span>
            <button type="button" data-evidence-next aria-label="Next evidence frame">Next →</button>
          </nav>
        </section>
      </div>
    </section>
  `;
}

function renderHorizon(content: SiteContent): string {
  return `
    <section class="scene horizon-scene" id="horizon" aria-labelledby="horizon-title" data-section="horizon">
      <picture class="horizon-fallback" aria-hidden="true">
        <source media="(max-width: 760px)" srcset="/assets/horizon/horizon-fallback-mobile.webp" />
        <img src="/assets/horizon/horizon-fallback-desktop.webp" alt="" loading="lazy" decoding="async" />
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
      setPosition(SIGGRAPH_FIRST_AUTHOR_PAPER_COUNT);
      machine.dataset.result = String(SIGGRAPH_FIRST_AUTHOR_PAPER_COUNT);
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
    const wasSettled = machine.dataset.result === String(SIGGRAPH_FIRST_AUTHOR_PAPER_COUNT);
    let startY = cancelReelAtCurrentPosition();
    if (wasSettled) {
      setPosition(SIGGRAPH_FIRST_AUTHOR_PAPER_COUNT);
      startY = -SIGGRAPH_FIRST_AUTHOR_PAPER_COUNT * cellHeight();
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
      setPosition(SIGGRAPH_FIRST_AUTHOR_PAPER_COUNT);
      machine.dataset.result = String(SIGGRAPH_FIRST_AUTHOR_PAPER_COUNT);
      machine.classList.remove("is-resolving", "is-pulling");
      machine.classList.add("is-settled", "is-payout");
      playCoinBurst();
      lever.disabled = false;
      later(() => machine.classList.remove("is-payout"), 450);
      return;
    }

    const finalIndex = SIGGRAPH_REEL_CYCLES * SIGGRAPH_REEL_DIGITS + SIGGRAPH_FIRST_AUTHOR_PAPER_COUNT;
    const finalY = -finalIndex * cellHeight();
    reelAnimation = track.animate(
      [
        { transform: `translate3d(0, ${startY}px, 0)`, offset: 0 },
        { transform: `translate3d(0, ${finalY}px, 0)`, offset: 1 }
      ],
      { duration: 2050, easing: "cubic-bezier(.1,.72,.14,1)", fill: "forwards" }
    );
    const settle = (): void => {
      if (!machine.classList.contains("is-resolving")) return;
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
      machine.dataset.result = String(SIGGRAPH_FIRST_AUTHOR_PAPER_COUNT);
      machine.classList.remove("is-resolving", "is-pulling");
      machine.classList.add("is-settled", "is-payout");
      playCoinBurst();
      lever.disabled = false;
      later(() => machine.classList.remove("is-payout"), 1350);
    };
    reelAnimation.finished.then(settle).catch(() => undefined);
    // Background tabs, overloaded GPU processes, and headless compositors can
    // leave Web Animations' `finished` promise pending indefinitely. The
    // semantic counter must still resolve after the authored reel duration.
    later(settle, 2_500);
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

type VoyageRendererBridge = {
  selectNode(node: VoyageNode["id"]): void;
  skipIntro(): void;
  setEvidenceOpen(open: boolean): void;
  setEvidenceIndex(index: number): void;
};

type VoyageUiController = {
  attachRenderer(renderer: VoyageRendererBridge): void;
  selectFromRenderer(node: VoyageNode["id"]): void;
  setEvidenceFromRenderer(open: boolean): void;
  destroy(): void;
};

function initializeVoyage(content: SiteContent, state: AppState): VoyageUiController | null {
  const section = document.getElementById("voyage");
  const nodes = [...document.querySelectorAll<HTMLButtonElement>("[data-voyage-node]")];
  const log = document.querySelector<HTMLElement>("[data-captains-log]");
  const evidence = document.querySelector<HTMLElement>("[data-evidence-panel]");
  const evidenceToggle = document.querySelector<HTMLButtonElement>("[data-evidence-toggle]");
  const evidenceClose = document.querySelector<HTMLButtonElement>("[data-evidence-close]");
  const evidencePrev = document.querySelector<HTMLButtonElement>("[data-evidence-prev]");
  const evidenceNext = document.querySelector<HTMLButtonElement>("[data-evidence-next]");
  const evidenceCount = document.querySelector<HTMLElement>("[data-evidence-count]");
  const evidenceCards = [...document.querySelectorAll<HTMLElement>("[data-project-card],[data-evidence-future]")];
  const skipButton = document.querySelector<HTMLButtonElement>("[data-voyage-skip]");
  if (!section || !log || !evidence || !evidenceToggle) return null;
  let renderer: VoyageRendererBridge | null = null;
  let selectedNode = content.voyage.nodes.find((node) => node.status === "current")!;
  let evidenceOpen = false;
  let evidenceIndex = 0;

  const eligibleEvidenceCards = (): HTMLElement[] => evidenceCards.filter((card) => card.dataset.evidenceEligible === "true");

  const setEvidenceIndex = (index: number, notifyRenderer = true): void => {
    const eligible = eligibleEvidenceCards();
    evidenceIndex = Math.max(0, Math.min(Math.max(0, eligible.length - 1), Math.floor(index)));
    evidenceCards.forEach((card) => { card.hidden = card !== eligible[evidenceIndex]; });
    const total = Math.max(1, eligible.length);
    if (evidenceCount) evidenceCount.textContent = `${String(evidenceIndex + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    const atStart = evidenceIndex <= 0;
    const atEnd = evidenceIndex >= total - 1;
    if (evidencePrev) {
      evidencePrev.disabled = atStart;
      evidencePrev.tabIndex = atStart ? -1 : 0;
    }
    if (evidenceNext) {
      evidenceNext.disabled = atEnd;
      evidenceNext.tabIndex = atEnd ? -1 : 0;
    }
    if (notifyRenderer) renderer?.setEvidenceIndex(evidenceIndex);
  };

  const setEvidenceOpen = (open: boolean, notifyRenderer = true): void => {
    evidenceOpen = open;
    section.classList.toggle("is-evidence-open", open);
    evidence.setAttribute("aria-hidden", String(!open));
    evidenceToggle.setAttribute("aria-expanded", String(open));
    evidenceToggle.firstChild!.textContent = open ? "Close evidence " : "Open evidence ";
    if (notifyRenderer) renderer?.setEvidenceOpen(open);
    if (open) {
      // Opening either evidence layout can cause the activating button to
      // become the browser's scroll anchor while the rail changes height.
      // Re-anchor the authored scene so the complete viewer stays visible.
      requestAnimationFrame(() => window.scrollTo({ top: section.offsetTop, behavior: "auto" }));
    }
  };

  const renderLog = (node: VoyageNode): void => {
    const entry = content.voyage.logs[node.id];
    log.querySelector<HTMLElement>("[data-log-entry]")!.textContent = `Entry ${entry.entry}`;
    log.querySelector<HTMLElement>("[data-log-status]")!.textContent = node.status === "current" ? "Current berth · EVA01" : node.status === "future" ? "Uncharted bearing" : "Recorded passage";
    log.querySelector<HTMLElement>("[data-log-title]")!.textContent = entry.title;
    log.querySelector<HTMLElement>("[data-log-subtitle]")!.textContent = entry.subtitle;
    log.querySelector<HTMLElement>("[data-log-watch]")!.textContent = entry.watch;
    log.querySelector<HTMLElement>("[data-log-bearing]")!.textContent = entry.bearing;
    log.querySelector<HTMLElement>("[data-log-sea]")!.textContent = entry.seaState;
    log.querySelector<HTMLElement>("[data-log-date]")!.textContent = entry.date;
    log.querySelector<HTMLElement>("[data-log-copy]")!.innerHTML = entry.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
    const projects = entry.projectIds.map((id) => content.projects.find((project) => project.id === id)).filter((project): project is Project => Boolean(project));
    const actions = log.querySelector<HTMLElement>("[data-captain-actions]")!;
    actions.innerHTML = node.id === "world"
      ? `<a href="#horizon">Enter Horizon <span>→</span></a>`
      : projects.flatMap((project) => project.links.filter((link) => link.href).slice(0, 2).map((link) => `<a href="${escapeHtml(link.href)}" target="_blank" rel="noreferrer">${escapeHtml(project.title)} · ${escapeHtml(link.label)} <span>↗</span></a>`)).join("");
    document.querySelectorAll<HTMLElement>("[data-project-card]").forEach((card) => {
      card.dataset.evidenceEligible = String(entry.projectIds.includes(card.dataset.projectCard as ProjectId));
    });
    const future = document.querySelector<HTMLElement>("[data-evidence-future]");
    if (future) future.dataset.evidenceEligible = String(node.id === "world");
    document.querySelector<HTMLElement>("[data-evidence-title]")!.textContent = entry.title;
    setEvidenceIndex(0);
  };

  const selectNode = (node: VoyageNode, options: { focus?: boolean; user?: boolean; notifyRenderer?: boolean } = {}): void => {
    const selectingCurrentOpen = options.user && selectedNode.id === node.id && evidenceOpen;
    state.selectedVoyageNode = node.id;
    selectedNode = node;
    nodes.forEach((button) => {
      const selected = button.dataset.voyageNode === node.id;
      button.setAttribute("aria-selected", String(selected));
      if (selected && options.focus) button.focus();
    });
    document.querySelectorAll<HTMLElement>(".voyage-index li").forEach((item, index) => {
      item.classList.toggle("is-current", content.voyage.nodes[index]?.id === node.id);
    });
    renderLog(node);
    if (options.user) setEvidenceOpen(!selectingCurrentOpen, options.notifyRenderer !== false);
    if (options.notifyRenderer !== false) renderer?.selectNode(node.id);
  };

  nodes.forEach((button, index) => {
    const node = content.voyage.nodes[index];
    button.addEventListener("click", () => {
      renderer?.skipIntro();
      selectNode(node, { user: true });
    });
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      renderer?.skipIntro();
      const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
      const next = (index + delta + nodes.length) % nodes.length;
      selectNode(content.voyage.nodes[next], { focus: true, user: true });
    });
  });

  const skipFromPointer = (event: PointerEvent): void => {
    if (event.isPrimary && event.button === 0) renderer?.skipIntro();
  };
  const skipFromKeyboard = (event: KeyboardEvent): void => {
    if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) renderer?.skipIntro();
  };
  const onEscape = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !evidenceOpen) return;
    setEvidenceOpen(false);
    evidenceToggle.focus();
  };
  const onEvidenceIndexRequest = (event: Event): void => {
    const detail = (event as CustomEvent<{ index?: number }>).detail;
    if (typeof detail?.index === "number") setEvidenceIndex(detail.index, false);
  };
  const showPreviousEvidence = (): void => setEvidenceIndex(evidenceIndex - 1);
  const showNextEvidence = (): void => setEvidenceIndex(evidenceIndex + 1);
  section.addEventListener("pointerdown", skipFromPointer, { passive: true });
  section.addEventListener("keydown", skipFromKeyboard);
  section.addEventListener("voyage:evidence-index", onEvidenceIndexRequest);
  document.addEventListener("keydown", onEscape);
  skipButton?.addEventListener("click", () => renderer?.skipIntro());
  evidenceToggle.addEventListener("click", () => setEvidenceOpen(!evidenceOpen));
  evidenceClose?.addEventListener("click", () => {
    setEvidenceOpen(false);
    evidenceToggle.focus();
  });
  evidencePrev?.addEventListener("click", showPreviousEvidence);
  evidenceNext?.addEventListener("click", showNextEvidence);
  evidenceCards.forEach((card) => {
    const media = card.querySelector<HTMLImageElement | HTMLVideoElement>("img,video");
    if (!media) {
      card.classList.add("is-media-ready");
      return;
    }
    const markReady = (): void => card.classList.add("is-media-ready");
    const markFailed = (): void => {
      card.classList.remove("is-media-ready");
      card.classList.add("is-media-failed");
      const matte = card.querySelector<HTMLElement>("[data-evidence-media],.evidence-media-matte");
      if (matte) {
        matte.dataset.mediaFallback = "Preview unavailable · use the project links below";
        matte.setAttribute("role", "img");
        matte.setAttribute("aria-label", "Evidence preview unavailable. Project links remain available below.");
      }
    };
    if (media instanceof HTMLImageElement) {
      if (media.complete) {
        if (media.naturalWidth > 0) markReady(); else markFailed();
      } else media.addEventListener("load", markReady, { once: true });
      media.addEventListener("error", markFailed, { once: true });
    } else {
      if (media.readyState >= HTMLMediaElement.HAVE_METADATA) markReady();
      else media.addEventListener("loadedmetadata", markReady, { once: true });
      media.addEventListener("error", markFailed, { once: true });
      media.querySelector("source")?.addEventListener("error", markFailed, { once: true });
    }
  });
  selectNode(selectedNode, { notifyRenderer: false });
  setEvidenceOpen(false, false);

  return {
    attachRenderer(instance) {
      renderer = instance;
      renderer.selectNode(selectedNode.id);
      renderer.setEvidenceOpen(evidenceOpen);
      renderer.setEvidenceIndex(evidenceIndex);
    },
    selectFromRenderer(nodeId) {
      const node = content.voyage.nodes.find((candidate) => candidate.id === nodeId);
      if (node) selectNode(node, { notifyRenderer: false });
    },
    setEvidenceFromRenderer(open) {
      setEvidenceOpen(open, false);
    },
    destroy() {
      section.removeEventListener("pointerdown", skipFromPointer);
      section.removeEventListener("keydown", skipFromKeyboard);
      section.removeEventListener("voyage:evidence-index", onEvidenceIndexRequest);
      document.removeEventListener("keydown", onEscape);
      evidencePrev?.removeEventListener("click", showPreviousEvidence);
      evidenceNext?.removeEventListener("click", showNextEvidence);
    }
  };
}

export async function initializeApplication({ content, state, onSectionChange }: InitOptions): Promise<void> {
  document.documentElement.dataset.motion = state.reducedMotion ? "reduced" : "full";
  document.documentElement.dataset.section = "profile";
  if (state.reducedMotion) {
    document.querySelectorAll<SVGSVGElement>(".godot-flame-filter").forEach((svg) => svg.pauseAnimations());
  }

  const visitorTelemetry = document.querySelector<HTMLElement>("[data-visitor-telemetry]");
  const visitorImage = visitorTelemetry?.querySelector<HTMLImageElement>("[data-visitor-image]");
  const visitorFallback = visitorTelemetry?.querySelector<HTMLElement>("[data-visitor-fallback]");
  if (visitorTelemetry && visitorImage && visitorFallback) {
    visitorImage.addEventListener("load", () => {
      visitorTelemetry.dataset.state = "live";
      visitorImage.hidden = false;
      visitorFallback.hidden = true;
    }, { once: true });
    visitorImage.addEventListener("error", () => {
      visitorTelemetry.dataset.state = "offline";
      visitorImage.hidden = true;
      visitorFallback.hidden = false;
      visitorFallback.textContent = "SIGNAL OFFLINE";
    }, { once: true });
    visitorImage.src = "https://api.visitorbadge.io/api/combined?path=https%3A%2F%2Froyalvice.github.io%2F&label=VISITORS&labelColor=%23060d09&countColor=%231b6e3a&style=flat-square&labelStyle=upper";
  }

  const terminalRoot = document.querySelector<HTMLElement>(".terminal-shell");
  const terminal = terminalRoot ? new TerminalController(terminalRoot, content.news, state) : null;
  terminal?.start();
  const destroySiggraphMachine = initializeSiggraphMachine(state.reducedMotion);
  initializeDrawers();
  const voyageUi = initializeVoyage(content, state);

  const renderers = new Map<SectionId, SceneRenderer[]>();
  const registerRenderer = (section: SectionId, renderer: SceneRenderer): void => {
    const sectionRenderers = renderers.get(section) ?? [];
    sectionRenderers.push(renderer);
    renderers.set(section, sectionRenderers);
  };
  let voyageRenderer: TransitionAwareSceneRenderer | null = null;
  let horizonRenderer: TransitionAwareSceneRenderer | null = null;
  let voyageAssetsReady: Promise<void> | null = null;
  let horizonPrewarmRequested = false;
  let horizonPrewarmIdleHandle: number | null = null;
  let horizonPrewarmTimer = 0;

  const horizonCanvas = document.querySelector<HTMLCanvasElement>("[data-horizon-scene]");
  let horizonInitialization: Promise<void> | null = null;
  const ensureHorizonRenderer = (): void => {
    if (!horizonCanvas || horizonInitialization) return;
    horizonInitialization = import("../horizon/HorizonSceneRenderer").then(async ({ HorizonSceneRenderer }) => {
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
      if (state.activeSection === "horizon" && state.documentVisible && !state.reducedMotion) renderer.resume(); else renderer.pause();
    }).catch((error) => {
      horizonCanvas.closest<HTMLElement>(".horizon-scene")?.classList.add("horizon-fallback-active");
      console.warn("Horizon scene fallback active", error);
    });
  };

  let gallery: PlayCanvasGallery | null = null;
  let profileAdventure: ProfileAdventureDirector | null = null;
  let galleryInitialization: Promise<void> = Promise.resolve();
  const adventureRoot = document.querySelector<HTMLElement>("[data-future-slot]");
  const galleryRoot = document.getElementById("hero-exhibits");
  if (galleryRoot) {
    // Navigation and pause/resume lifecycles stay independent, but the first
    // PlayCanvas shader compilation is serialized. PlayCanvas shares shader
    // include/cache state across applications; compiling the cabinet and
    // Voyage worlds concurrently can cross-contaminate StandardMaterial
    // programs on Chromium even though the scenes themselves are separate.
    galleryInitialization = (async () => { try {
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

  // The room is already represented by the authored static poster. Hydrate
  // its Canvas2D simulation in an independent idle slice: it must remain
  // available even when the optional PlayCanvas cabinet is slow or falls
  // back. The room only decodes images and does not share WebGL shader state.
  let profileAdventureInitialization: Promise<void> | null = null;
  const ensureProfileAdventure = (): void => {
    if (!adventureRoot || profileAdventureInitialization) return;
    profileAdventureInitialization = (async () => {
      await new Promise<void>((resolve) => {
        const idleWindow = window as Window & {
          requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
        };
        if (idleWindow.requestIdleCallback) {
          idleWindow.requestIdleCallback(resolve, { timeout: 1_400 });
        } else window.setTimeout(resolve, 120);
      });
      const { ProfileAdventureDirector } = await import("../profile/ProfileAdventureDirector");
      const director = new ProfileAdventureDirector(adventureRoot, { reducedMotion: state.reducedMotion });
      await director.init();
      profileAdventure = director;
      adventureRoot.classList.add("is-ready");
      if (state.activeSection === "profile" && state.documentVisible && !state.reducedMotion) director.resume();
      else director.pause();
    })().catch((error) => {
      adventureRoot.innerHTML = renderProfileRoomFallback();
      adventureRoot.classList.add("is-fallback");
      console.warn("Profile sprite room fallback active", error);
    }).finally(() => {
      // The cabinet's generated trophies are decorative upgrades over the
      // already-visible authored meshes. Release their idle warmup only after
      // this heavier sprite room has either initialized or chosen its poster.
      galleryRoot?.dispatchEvent(new CustomEvent("gallery:companion-ready"));
    });
  };
  ensureProfileAdventure();

  let voyageInitialization: Promise<void> | null = null;
  const ensureVoyageRenderer = (): void => {
    if (voyageInitialization) return;
    const canvas = document.querySelector<HTMLCanvasElement>("[data-voyage-scene]");
    if (!canvas) return;
    voyageInitialization = galleryInitialization.then(() => import("../voyage/VoyageSceneRenderer")).then(async ({ VoyageSceneRenderer }) => {
      const renderer = new VoyageSceneRenderer(canvas, {
        nodes: content.voyage.nodes,
        reducedMotion: state.reducedMotion,
        qualityTier: state.qualityTier,
        onSelectNode: (node) => voyageUi?.selectFromRenderer(node),
        onEvidenceOpenChange: (open) => voyageUi?.setEvidenceFromRenderer(open)
      });
      renderer.setQuality(state.qualityTier);
      await renderer.init();
      voyageRenderer = renderer;
      voyageAssetsReady = renderer.whenAssetsReady();
      voyageUi?.attachRenderer(renderer);
      registerRenderer("voyage", renderer);
      renderer.setTransitionProgress(state.reducedMotion ? 0 : state.journeyTransition);
      if (state.activeSection === "voyage" && state.documentVisible && !state.reducedMotion) renderer.resume();
      else renderer.pause();
    }).catch((error) => {
      canvas.closest<HTMLElement>(".voyage-scene")?.classList.add("voyage-fallback-active");
      console.warn("THE LUMINOUS WAKE WebGL fallback active", error);
    });
  };

  const scheduleHorizonPrewarm = (): void => {
    if (horizonPrewarmRequested || horizonInitialization || !horizonCanvas) return;
    horizonPrewarmRequested = true;
    const startAtIdle = (): void => {
      if (horizonInitialization || !horizonCanvas) return;
      if (state.activeSection === "horizon") {
        ensureHorizonRenderer();
        return;
      }
      const run = (): void => {
        horizonPrewarmIdleHandle = null;
        horizonPrewarmTimer = 0;
        ensureHorizonRenderer();
      };
      const idleWindow = window as Window & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      };
      if (idleWindow.requestIdleCallback) {
        horizonPrewarmIdleHandle = idleWindow.requestIdleCallback(run, { timeout: 900 });
      } else {
        horizonPrewarmTimer = window.setTimeout(run, 160);
      }
    };

    // Do not overlap Horizon's shader/texture setup with Voyage's six streamed
    // GLB installs. A direct navigation to Horizon is still immediate above;
    // this path is only the invisible prewarm performed near the boundary.
    if (voyageAssetsReady) {
      void voyageAssetsReady.finally(startAtIdle);
      return;
    }
    if (voyageInitialization) {
      void voyageInitialization.finally(() => {
        if (voyageAssetsReady) void voyageAssetsReady.finally(startAtIdle);
        else startAtIdle();
      });
      return;
    }
    startAtIdle();
  };

  const sections = [...document.querySelectorAll<HTMLElement>("main > .scene[data-section]")];
  const navLinks = [...document.querySelectorAll<HTMLAnchorElement>("[data-nav-section]")];
  const chapterNav = document.querySelector<HTMLElement>(".chapter-nav");
  const voyageSection = document.getElementById("voyage");
  const horizonSection = document.getElementById("horizon");
  const horizonPrewarmObserver = horizonSection ? new IntersectionObserver((entries, observer) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    scheduleHorizonPrewarm();
    observer.disconnect();
  }, { rootMargin: "24% 0px", threshold: .01 }) : null;
  if (horizonSection) horizonPrewarmObserver?.observe(horizonSection);
  const voyagePrewarmObserver = voyageSection ? new IntersectionObserver((entries, observer) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    ensureVoyageRenderer();
    observer.disconnect();
  }, { rootMargin: "0px", threshold: .01 }) : null;
  if (voyageSection) voyagePrewarmObserver?.observe(voyageSection);
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
    // Reduced-motion scenes are independent static keyframes: Voyage keeps
    // its authored final palette while Horizon keeps its fully entered frame.
    // Do not let a late layout shift cross-fade either static renderer.
    voyageRenderer?.setTransitionProgress(state.reducedMotion ? 0 : progress);
    horizonRenderer?.setTransitionProgress(state.reducedMotion ? 1 : progress);

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
      sectionRenderers.forEach((renderer) => {
        if (section === active) renderer.resume(); else renderer.pause();
      });
    });
    if (active === "voyage") ensureVoyageRenderer();
    if (active === "horizon") ensureHorizonRenderer();
    scheduleNavigationSettle();
    if (active === "profile") {
      gallery?.resume();
      profileAdventure?.resume();
    } else {
      gallery?.pause();
      profileAdventure?.pause();
    }
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
      profileAdventure?.pause();
      document.querySelectorAll("video").forEach((video) => video.pause());
    } else if (!state.reducedMotion) {
      renderers.get(state.activeSection)?.forEach((renderer) => renderer.resume());
      if (state.activeSection === "profile") gallery?.resume?.();
      if (state.activeSection === "profile") profileAdventure?.resume();
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
      if (state.activeSection === "profile") profileAdventure?.cancelManualActions();
    }
  });

  window.addEventListener("beforeunload", () => {
    terminal?.destroy();
    destroySiggraphMachine();
    voyageUi?.destroy();
    horizonPrewarmObserver?.disconnect();
    voyagePrewarmObserver?.disconnect();
    if (horizonPrewarmIdleHandle !== null) {
      (window as Window & { cancelIdleCallback?: (handle: number) => void }).cancelIdleCallback?.(horizonPrewarmIdleHandle);
    }
    window.clearTimeout(horizonPrewarmTimer);
    gallery?.destroy();
    profileAdventure?.destroy();
    cancelAnimationFrame(transitionRaf);
    window.clearTimeout(navigationTimer);
    renderers.forEach((sectionRenderers) => sectionRenderers.forEach((renderer) => renderer.destroy()));
  });
}
