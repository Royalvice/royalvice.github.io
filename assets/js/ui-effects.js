(function () {
  const data = window.SITE_CONTENT;
  if (!data) return;

  const byId = (id) => document.getElementById(id);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  function linkMarkup(link) {
    const external = link.href && link.href.startsWith("http");
    const disabled = link.state === "coming-soon";
    const href = disabled ? "#" : link.href;
    const target = external && !disabled ? ' target="_blank" rel="noreferrer"' : "";
    const state = disabled ? ' aria-disabled="true" tabindex="-1"' : "";
    return `<a class="stack-link" href="${escapeHtml(href)}"${target}${state}>${escapeHtml(link.label)}</a>`;
  }

  function renderProfileNews() {
    const root = byId("profile-news-list");
    if (!root || !Array.isArray(data.news)) return;
    const items = data.news;
    const duplicated = [...items, ...items];
    const glyphs = ["101", "SYS", "RUN", "SIG", "OASIS", "GPU", "MLLM", "3D", "TOG", "ICCV", "MM", "OK", "EVA", "THOTH"];
    root.innerHTML = `
      <article class="matrix-news-feed" aria-label="Live research news terminal" tabindex="0">
        <div class="matrix-news-chrome" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div class="matrix-news-head">
          <span>news@oasis:~/live</span>
          <b>hover to tail</b>
        </div>
        <div class="matrix-news-screen" role="log" aria-live="polite">
          <div class="matrix-news-rain" aria-hidden="true">
            ${Array.from({ length: 22 }, (_, index) => `<i style="--i:${index}">${escapeHtml(glyphs[index % glyphs.length])}</i>`).join("")}
          </div>
          <div class="matrix-news-prompt" aria-hidden="true">
            <span>zongyuan@oasis</span><b>:~$</b><em> tail -f ./research/news.log --game-mode</em><strong></strong>
          </div>
          <div class="matrix-news-window">
            <div class="matrix-news-track">
              ${duplicated.map((item, index) => `
                <p class="matrix-news-line ${item.rarity || ""}" aria-hidden="${index >= items.length ? "true" : "false"}">
                  <span class="news-date">${escapeHtml(item.date)}</span>
                  <b class="news-tag">${escapeHtml(item.type || "LOG").toUpperCase()}</b>
                  <em class="news-message">${escapeHtml(item.text)}</em>
                </p>
              `).join("")}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function mediaMarkup(media, className = "media-window") {
    if (!media) return "";
    if (media.type === "video") {
      const poster = media.poster ? ` poster="${escapeHtml(media.poster)}"` : "";
      return `
        <div class="${className}">
          <video autoplay muted loop playsinline${poster} aria-label="${escapeHtml(media.alt || "Project preview")}">
            <source src="${escapeHtml(media.src)}" type="video/mp4">
          </video>
        </div>
      `;
    }
    return `
      <figure class="${className}">
        <img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt || "Project preview")}" loading="lazy">
      </figure>
    `;
  }

  function renderCartridge(item, compact = false) {
    const card = el("article", `stack-cartridge ${item.rarity || "rare"}${compact ? " compact" : ""}`);
    const links = (item.links || []).map(linkMarkup).join("");
    card.innerHTML = `
      <div class="cartridge-topline">
        <span>${escapeHtml(item.venue)}</span>
        <b>${escapeHtml(item.rarity || "rare")}</b>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.text)}</p>
      <div class="stack-links">${links}</div>
    `;
    return card;
  }

  function renderMediaCard(item, extraClass = "") {
    const card = el("article", `voyage-media-card ${item.rarity || "rare"} ${extraClass}`);
    const links = (item.links || []).map(linkMarkup).join("");
    card.innerHTML = `
      <div class="voyage-media-topline">
        <span>${escapeHtml(item.venue)}</span>
        <b>${escapeHtml(item.rarity || "rare")}</b>
      </div>
      ${mediaMarkup(item.media, "voyage-media-window")}
      <div class="voyage-media-copy">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>
        <div class="stack-links">${links}</div>
      </div>
    `;
    return card;
  }

  function renderStackBoard() {
    const root = byId("stack-board");
    const board = data.stackBoard;
    if (!root || !board) return;

    const neuralLane = board.lanes.find((lane) => lane.label === "Neural Graphics Rendering");
    const mllmLane = board.lanes.find((lane) => lane.label === "3D MLLM");
    const unclassifiedLane = board.lanes.find((lane) => lane.label === "Unclassified");
    const ssat = neuralLane?.items?.find((item) => item.title === "SSAT");
    const directl = neuralLane?.items?.find((item) => item.title === "DirectL");
    const eva = mllmLane?.featured;
    const voyage = board.voyage || {};
    const progress = Math.round((voyage.progress || 0.75) * 100);
    const supportItems = [
      ...(neuralLane?.items || []).filter((item) => item.title !== "SSAT" && item.title !== "DirectL"),
      ...(unclassifiedLane?.items || [])
    ];

    root.innerHTML = `
      <header class="stack-header">
        <div>
          <span class="stack-kicker">${escapeHtml(board.direction.kicker)}</span>
          <h2>${escapeHtml(board.direction.title)}</h2>
        </div>
        <p>${escapeHtml(board.direction.body)}</p>
        <div class="capability-tags" aria-label="Capability tags">
          ${board.direction.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
      </header>

      <div class="voyage-layout">
        <section class="voyage-map-panel" aria-label="PhD Voyage Map">
          <div class="voyage-panel-head">
            <span>PhD Voyage</span>
            <b>${escapeHtml(voyage.progressText || "3 / 4")}</b>
            <p>${escapeHtml(voyage.caption || "")}</p>
          </div>

          <div class="voyage-ocean" style="--voyage-progress: ${progress}%">
            <div class="wave-layer wave-a" aria-hidden="true"></div>
            <div class="wave-layer wave-b" aria-hidden="true"></div>
            <div class="voyage-map-legend" aria-hidden="true">
              <span>Origin: DocDiff</span>
              <span>Current: 3D MLLM</span>
              <span>Horizon: Game World Model</span>
            </div>
            <div class="voyage-landmarks" aria-hidden="true">
              <span class="landmark landmark-display">Spatial Display Current</span>
              <span class="landmark landmark-render">Neural Graphics Reef</span>
              <span class="landmark landmark-mllm">Native 3D Harbor</span>
            </div>
            <svg class="voyage-route-svg" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true">
              <path class="route-shadow" d="M40 150 C180 60 315 205 455 118 C595 32 725 190 960 78"></path>
              <path class="route-main" d="M40 150 C180 60 315 205 455 118 C595 32 725 190 960 78"></path>
            </svg>
            <div class="voyage-progress-rail" aria-hidden="true"><span></span></div>
            <div class="voyage-nodes" aria-label="Research route nodes">
              ${(voyage.nodes || []).map((node) => `
                <article class="voyage-node node-${escapeHtml(node.id)}" style="--node-x: ${Math.round((node.progress || 0) * 100)}%">
                  <b>${escapeHtml(node.title)}</b>
                  <span>${escapeHtml(node.lane)}</span>
                </article>
              `).join("")}
            </div>
            <div class="voyage-boat" aria-label="${escapeHtml(voyage.label || "PhD Voyage")} ${escapeHtml(voyage.progressText || "3 / 4")}">
              <svg viewBox="0 0 132 92" role="img" aria-label="Small research boat">
                <path class="boat-sail-back" d="M63 9 L88 54 L63 54 Z"></path>
                <path class="boat-sail-front" d="M59 15 L31 57 L59 57 Z"></path>
                <path class="boat-mast" d="M62 7 L62 62"></path>
                <path class="boat-hull" d="M19 58 L113 58 L96 78 L36 78 Z"></path>
                <path class="boat-window" d="M45 64 H78"></path>
              </svg>
              <span>${escapeHtml(voyage.currentStage || "Current Stage")} ${escapeHtml(voyage.progressText || "3 / 4")}</span>
            </div>
            <aside class="voyage-current-panel" aria-label="Current voyage status">
              <span>${escapeHtml(voyage.label || "PhD Voyage")}</span>
              <b>${escapeHtml(voyage.progressText || "3 / 4")}</b>
              <p>${escapeHtml(voyage.caption || "")}</p>
            </aside>
            <div class="voyage-media-strip" id="voyage-media-strip"></div>
          </div>
        </section>

        <aside class="voyage-side-panel" aria-label="Voyage support panels">
          <section class="stack-panel compact-route-panel">
            <div class="panel-title"><span>Route Briefs</span><b>Nodes</b></div>
            <div class="support-node-list" id="support-node-list"></div>
          </section>
          <section class="stack-panel compact-awards-panel">
            <div class="panel-title"><span>Awards</span><b>Stamp Rail</b></div>
            <div class="award-stamp-rail" id="award-mini-grid"></div>
          </section>
          <section class="stack-panel compact-service-panel">
            <div class="panel-title"><span>Academic Services</span><b>Guild</b></div>
            <div class="service-strip" id="service-mini-list"></div>
          </section>
          <section class="stack-panel compact-archive-panel">
            <div class="panel-title"><span>Archive</span><b>Compact</b></div>
            <div class="archive-chip-grid">
              ${board.archive.map((item) => `<span class="archive-chip"><b>${escapeHtml(item.title)}</b><em>${escapeHtml(item.venue)}</em></span>`).join("")}
            </div>
          </section>
        </aside>
      </div>
    `;

    const mediaRoot = byId("voyage-media-strip");
    if (ssat) mediaRoot?.appendChild(renderMediaCard(ssat, "media-ssat"));
    if (directl) mediaRoot?.appendChild(renderMediaCard(directl, "media-directl"));
    if (eva) mediaRoot?.appendChild(renderMediaCard({
      ...eva,
      rarity: "rare",
      media: eva.media || { type: "image", src: eva.hero, alt: "EVA01 teaser" },
      links: eva.links || [],
      text: eva.text || "",
      venue: eva.venue || "3D MLLM"
    }, "media-eva01"));

    const supportRoot = byId("support-node-list");
    supportItems.forEach((item) => {
      const row = el("article", `support-node ${item.rarity || "rare"}`);
      row.innerHTML = `
        <span>${escapeHtml(item.venue)}</span>
        <b>${escapeHtml(item.title)}</b>
        <p>${escapeHtml(item.text)}</p>
        <div class="stack-links">${(item.links || []).map(linkMarkup).join("")}</div>
      `;
      supportRoot?.appendChild(row);
    });

    const awardRoot = byId("award-mini-grid");
    data.awards?.forEach((item) => {
      const tile = el("article", "award-mini award-stamp");
      tile.innerHTML = `<b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.text)}</p>`;
      awardRoot?.appendChild(tile);
    });

    const serviceRoot = byId("service-mini-list");
    data.services?.forEach((item) => {
      const row = el("article", "service-mini");
      row.innerHTML = `<span>${escapeHtml(item.tag)}</span><p>${escapeHtml(item.text)}</p>`;
      serviceRoot?.appendChild(row);
    });
  }

  function renderEnding() {
    const root = byId("end-console");
    const ending = data.ending;
    if (!root || !ending) return;
    root.innerHTML = `
      <div class="end-titleplate">
        <span>${escapeHtml(ending.kicker)}</span>
        <h2>${escapeHtml(ending.title)}</h2>
        <p>${escapeHtml(ending.lead)}</p>
      </div>
      <div class="end-chapter-grid">
        ${ending.chapters.map((chapter) => `
          <article class="end-chapter">
            <span>Chapter</span>
            <h3>${escapeHtml(chapter.title)}</h3>
            <p>${escapeHtml(chapter.text)}</p>
          </article>
        `).join("")}
      </div>
    `;
  }

  function navObserver() {
    const links = [...document.querySelectorAll(".profile-nav a, .hud-nav nav a")];
    if (!links.length) return;
    const map = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.classList.remove("is-active"));
        map.get(entry.target.id)?.classList.add("is-active");
      });
    }, { threshold: 0.34 });
    map.forEach((_, id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  function tiltCards() {
    document.querySelectorAll(".voyage-media-card, .support-node, .end-chapter").forEach((card) => {
      card.addEventListener("mousemove", (event) => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${-y * 2.5}deg) rotateY(${x * 2.5}deg)`;
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
      });
    });
  }

  function startInlineVideos() {
    document.querySelectorAll("video[autoplay]").forEach((video) => {
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // The muted frame is still visible; browsers can resume on interaction.
        });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderProfileNews();
    renderStackBoard();
    renderEnding();
    startInlineVideos();
    navObserver();
    tiltCards();
  });
})();
