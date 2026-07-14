import { siGithub, siGooglescholar, siHuggingface } from "simple-icons";

type SimpleIcon = {
  title: string;
  path: string;
};

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function iconMarkup(icon: SimpleIcon): string {
  return `
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="${icon.path}"></path>
    </svg>
  `;
}

function renderSocialLinks(): string {
  const links = [
    { label: "GitHub", href: "https://github.com/Royalvice", icon: siGithub },
    {
      label: "Google Scholar",
      href: "https://scholar.google.com.hk/citations?user=2IYvwdwAAAAJ&hl=zh-CN",
      icon: siGooglescholar
    },
    { label: "Hugging Face", href: "https://huggingface.co/Royalvice", icon: siHuggingface }
  ];

  return links.map((link) => `
    <a class="profile-social-chip" href="${escapeHtml(link.href)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(link.label)}">
      ${iconMarkup(link.icon)}
      <span>${escapeHtml(link.label)}</span>
    </a>
  `).join("");
}

function renderBioHTML(): string {
  return `
    <!-- Intro -->
    <div class="bio-intro rune-block" data-block="intro">
      <p class="bio-intro-text">I am Zongyuan Yang, a Second-year PhD at BUPT.</p>
    </div>

    <!-- Research Main Card (Title + Contributions + Skills) -->
    <div class="bio-card bio-research-card rune-block" data-block="research">
      <div class="card-stamp">RESEARCH</div>
      <h3 class="research-card-title">Neural Graphics &amp; 3D AIGC &amp; Interactive World Models</h3>
      <div class="research-card-body">
        <div class="research-card-left">
          <div class="r-contrib-item">
            <span class="r-contrib-dot"></span>
            <p class="r-contrib-text">Real-time light-field rendering for naked-eye 3D displays</p>
          </div>
          <div class="r-contrib-item">
            <span class="r-contrib-dot"></span>
            <p class="r-contrib-text">Native 3D MLLM pre-training &amp; post-training</p>
          </div>
        </div>
        <div class="research-card-right">
          <div class="skill-pill skill-dl">
            <span class="skill-label">Deep Learning</span>
          </div>
          <div class="skill-pill skill-ah">
            <span class="skill-label">Agent Harnessing</span>
          </div>
          <div class="skill-pill skill-cg">
            <span class="skill-label">Computer Graphics</span>
          </div>
        </div>
      </div>
    </div>

    <!-- SIGGRAPH Card -->
    <div class="bio-siggraph rune-block" data-block="siggraph">
      <div class="siggraph-card">
        <div class="siggraph-prismatic"></div>
        <div class="siggraph-body">
          <div class="siggraph-left">
            <span class="siggraph-count">×2</span>
          </div>
          <div class="siggraph-divider"></div>
          <div class="siggraph-right">
            <span class="siggraph-name">SIGGRAPH</span>
            <span class="siggraph-sub">First-Author Papers</span>
          </div>
        </div>
        <div class="siggraph-glow"></div>
      </div>
    </div>

    <!-- Interests Large Card -->
    <div class="bio-card bio-interests-card rune-block" data-block="interests">
      <div class="card-stamp">INTERESTS</div>
      <div class="interests-grid">
        <div class="icard">
          <span class="icard-icon">🎮</span>
          <span class="icard-name">Game Dev</span>
        </div>
        <div class="icard">
          <span class="icard-icon">🏋️</span>
          <span class="icard-name">Fitness</span>
        </div>
        <div class="icard">
          <span class="icard-icon">🎵</span>
          <span class="icard-name">Music</span>
        </div>
        <div class="icard">
          <span class="icard-icon">☯️</span>
          <span class="icard-name">Metaphysics</span>
        </div>
      </div>
    </div>

    <!-- Endeavors -->
    <div class="bio-endeavors rune-block" data-block="endeavors">
      <div class="endeavors-bar">
        <span class="endeavors-accent"></span>
        <span class="endeavors-text">Currently exploring game development with Godot.</span>
      </div>
    </div>
  `;
}

export function renderProfileCard(): void {
  const root = document.getElementById("hero-profile");
  const profile = window.HOME_HERO?.profile;
  if (!root || !profile) return;

  root.innerHTML = `
    <div class="hero-card-shell profile-terminal profile-terminal--minimal">
      <div class="hero-card-grid" aria-hidden="true"></div>
      <div class="profile-nav-row">
        <nav class="profile-nav" aria-label="Primary navigation">
          <a href="#profile">Profile</a>
          <a href="#stack">Stack</a>
          <a href="#the-end">The End!</a>
        </nav>
      </div>

      <section class="minimal-profile-core profile-identity-row" aria-label="Profile identity">
        <div class="profile-left-column">
          <figure class="minimal-portrait" aria-label="Profile avatar">
            <img src="${profile.avatar}" alt="Avatar for Zongyuan Yang">
          </figure>
          <div class="minimal-profile-copy">
            <h1>${escapeHtml(profile.title)}</h1>
            <p class="profile-direction-line">Neural Graphics · 3D MLLM · Game World Model</p>
            <nav class="profile-social-row" aria-label="Profile links">
              ${renderSocialLinks()}
            </nav>
          </div>
        </div>
        <div class="profile-bio-container">
          <canvas class="spark-canvas"></canvas>
          <div class="profile-bio satisfy-font">
            ${renderBioHTML()}
          </div>
        </div>
      </section>

      <div class="middle-void-space"></div>

      <section class="profile-news-terminal profile-news-terminal--matrix" aria-label="News">
        <div class="tui-scanlines"></div>
        <div class="tui-inner-glow"></div>
        <div class="tui-content">
          <div id="profile-news-list"></div>
          <div class="tui-cursor-line"><span class="tui-cursor">█</span></div>
        </div>
      </section>
    </div>
  `;

  root.dataset.motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "static";

  initRuneSparks();
  initBlockReveal();
}

function initRuneSparks() {
  const container = document.querySelector('.profile-bio-container') as HTMLElement;
  const canvas = document.querySelector('.spark-canvas') as HTMLCanvasElement;
  if (!container || !canvas) return;

  const ctx = canvas.getContext('2d')!;
  const MAX_PARTICLES = 40;
  interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }
  const particles: Particle[] = [];

  function resize() {
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function spawnSparks(x: number, y: number) {
    if (particles.length >= MAX_PARTICLES) return;
    for (let i = 0; i < 2; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.8) * 6,
        life: 1.0,
        color: Math.random() > 0.5 ? '#ffaa00' : '#ff6600'
      });
    }
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35;
      p.life -= 0.04;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life * 0.85;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 2, 2);
    }
    ctx.globalAlpha = 1.0;
    requestAnimationFrame(loop);
  }
  loop();

  const canvasRect = { left: 0, top: 0 };
  function updateCanvasRect() {
    const r = canvas.getBoundingClientRect();
    canvasRect.left = r.left;
    canvasRect.top = r.top;
  }
  window.addEventListener('resize', updateCanvasRect);
  updateCanvasRect();

  // Hover sparks on bio-intro text only
  container.addEventListener('mousemove', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.bio-intro') && particles.length < MAX_PARTICLES - 5) {
      particles.push({
        x: e.clientX - canvasRect.left + (Math.random() - 0.5) * 8,
        y: e.clientY - canvasRect.top + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.9) * 5,
        life: 0.8,
        color: Math.random() > 0.3 ? '#ffcc44' : '#ff8800'
      });
    }
  });

  (container as any)._spawnSparks = spawnSparks;
  (container as any)._getCanvasRect = () => canvas.getBoundingClientRect();
}

function initBlockReveal() {
  const container = document.querySelector('.profile-bio-container') as HTMLElement;
  if (!container) return;

  const blocks = Array.from(container.querySelectorAll('.rune-block')) as HTMLElement[];
  let currentBlockIdx = 0;
  let isHovered = false;
  let lastTime = 0;

  // Word-by-word reveal for bio-intro only (fix space bug)
  function wrapWords(el: Element) {
    const textEl = el.querySelector('.bio-intro-text');
    if (!textEl || textEl.getAttribute('data-wrapped')) return;
    textEl.setAttribute('data-wrapped', 'true');

    const text = textEl.textContent || '';
    const words = text.split(' ');
    let idx = parseInt((container as any)._wordIdx || '0');
    // Wrap word by word, preserving spaces as real text nodes between spans
    const html = words.map((word, i) => {
      const span = `<span class="rune-word" style="--word-index:${idx++}">${word}</span>`;
      return i < words.length - 1 ? span + ' ' : span;
    }).join('');
    (container as any)._wordIdx = String(idx);
    (textEl as HTMLElement).innerHTML = html;
  }

  (container as any)._wordIdx = '0';
  blocks.forEach(b => wrapWords(b));

  function getRevealableWords(block: HTMLElement): HTMLElement[] {
    return Array.from(block.querySelectorAll('.rune-word:not(.revealed)')) as HTMLElement[];
  }

  function revealBlock(block: HTMLElement, batchSize: number) {
    const words = getRevealableWords(block);
    const spawnSparks = (container as any)._spawnSparks;
    const getCanvasRect = (container as any)._getCanvasRect;
    const canvasRect = getCanvasRect ? getCanvasRect() : { left: 0, top: 0 };

    const toReveal = words.slice(0, batchSize);
    const rects = toReveal.map(w => w.getBoundingClientRect());
    toReveal.forEach((w, i) => {
      w.classList.add('revealed');
      if (spawnSparks) {
        const rect = rects[i];
        spawnSparks(rect.left - canvasRect.left + rect.width / 2, rect.top - canvasRect.top + rect.height / 2);
      }
    });

    if (getRevealableWords(block).length === 0) {
      block.classList.add('block-revealed');
    }
  }

  function tick(time: number) {
    const activeHover = isHovered || (window as any).isPlaywrightHoverMock;
    if (!activeHover) return;
    if (currentBlockIdx >= blocks.length) return;

    if (time - lastTime > 20) {
      const block = blocks[currentBlockIdx];
      const mockBatch = (window as any).isPlaywrightHoverMock ? 20 : 3;

      const words = getRevealableWords(block);
      if (words.length === 0) {
        // Structural block (cards, siggraph, etc) - reveal immediately
        block.classList.add('block-revealed');
        currentBlockIdx++;
      } else {
        revealBlock(block, mockBatch);
        if (getRevealableWords(block).length === 0) {
          block.classList.add('block-revealed');
          currentBlockIdx++;
        }
      }
      lastTime = time;
    }

    if (currentBlockIdx < blocks.length) {
      requestAnimationFrame(tick);
    } else {
      container.classList.add('all-revealed');
    }
  }

  container.addEventListener('mouseenter', () => {
    isHovered = true;
    if (currentBlockIdx < blocks.length) {
      requestAnimationFrame(tick);
    }
  });

  container.addEventListener('mouseleave', () => {
    isHovered = false;
  });
}
