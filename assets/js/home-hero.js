import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const data = window.HOME_HERO;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const textureLoader = new THREE.TextureLoader();
let woodMaterialCache;
let glassNormalCache;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderProfile() {
  const root = document.getElementById("hero-profile");
  if (!root || !data) return;
  const profile = data.profile;
  root.innerHTML = `
    <div class="hero-card-shell">
      <div class="hero-card-grid" aria-hidden="true"></div>
      <nav class="profile-nav" aria-label="Primary navigation">
        <a href="#profile">Profile</a>
        <a href="#stack">Stack</a>
        <a href="#the-end">The End!</a>
      </nav>
      <div class="portrait-port">
        <img src="${profile.avatar}" alt="Avatar for Zongyuan Yang">
        <span class="portrait-spark spark-a"></span>
        <span class="portrait-spark spark-b"></span>
      </div>
      <div class="profile-copy">
        <div class="identity-row">
          ${profile.identity.map((item, index) => `<span class="identity-chip identity-${index}">${escapeHtml(item)}</span>`).join("")}
        </div>
        <h1>${escapeHtml(profile.title)}</h1>
        <div class="achievement-stack">
          ${profile.achievements.map((item) => `<span class="achievement-badge ${item.material}">${escapeHtml(item.label)}</span>`).join("")}
        </div>
        <div class="direction-list">
          ${profile.directions.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
        <p class="oasis-vision">${escapeHtml(profile.vision)}</p>
        <div class="profile-module-grid">
          ${profile.modules.map((item) => `
            <article class="profile-module">
              <span>${escapeHtml(item.tag)}</span>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.body)}</p>
            </article>
          `).join("")}
        </div>
        <div class="contact-dock">
          ${profile.contacts.map((item) => `
            <a class="contact-button contact-${item.type}" href="${item.href}" ${item.href.startsWith("http") ? 'target="_blank" rel="noreferrer"' : ""}>
              <span class="contact-icon" aria-hidden="true">${iconFor(item.type)}</span>
              <span>${escapeHtml(item.label)}</span>
            </a>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function iconFor(type) {
  if (type === "email") return "@";
  if (type === "github") return "{}";
  if (type === "scholar") return "G";
  return "*";
}

function renderExhibits() {
  const root = document.getElementById("hero-exhibits");
  if (!root || !data) return;
  root.innerHTML = "";
  data.exhibits.forEach((item) => {
    const cell = document.createElement("article");
    cell.className = `exhibit-cell exhibit-${item.id}`;
    cell.dataset.exhibit = item.id;
    cell.tabIndex = 0;
    cell.setAttribute("role", "button");
    cell.setAttribute("aria-pressed", "false");
    cell.setAttribute("aria-label", `${item.title} exhibit. Toggle glass cover.`);
    cell.innerHTML = `
      <div class="cell-nameplate">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.achievement)}</span>
        <em>${escapeHtml(item.direction)}</em>
      </div>
      <div class="exhibit-depth">
        <canvas class="exhibit-canvas" aria-hidden="true"></canvas>
      </div>
      <div class="glass-cover" aria-hidden="true"></div>
      <div class="exhibit-action-panel">
        <p>${escapeHtml(item.summary)}</p>
        <div class="exhibit-links">
          ${item.links.map((link) => {
            const title = link.state === "coming-soon" ? ' title="Coming soon"' : "";
            const external = link.href.startsWith("http");
            const target = external ? ' target="_blank" rel="noreferrer"' : "";
            return `<a href="${link.href}"${title}${target}>${escapeHtml(link.label)}</a>`;
          }).join("")}
        </div>
      </div>
    `;
    cell.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      toggleCell(cell);
    });
    cell.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleCell(cell);
      }
    });
    root.appendChild(cell);
    initExhibitScene(cell.querySelector("canvas"), item);
  });
}

function toggleCell(cell) {
  const next = !cell.classList.contains("is-open");
  cell.classList.toggle("is-open", next);
  cell.setAttribute("aria-pressed", String(next));
}

function initExhibitScene(canvas, item) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07111f);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  camera.position.set(0, 0.45, 8.6);
  camera.lookAt(0, 0.25, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.15 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.36, 0.9));

  const rig = new THREE.Group();
  scene.add(rig);

  addLighting(scene, item);
  addEnvironment(rig, item);
  const card = addHeroCard(rig, item);
  const trophy = addTrophy(rig, item);
  addDistortedGlass(rig);

  const clock = new THREE.Clock();
  const resize = () => {
    const rect = canvas.parentElement.getBoundingClientRect();
    const width = Math.max(240, Math.floor(rect.width));
    const height = Math.max(210, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const animate = () => {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    if (!prefersReducedMotion) {
      trophy.rotation.y += 0.008;
      trophy.position.y = trophy.userData.baseY + Math.sin(time * 1.2) * 0.05;
      card.rotation.y = card.userData.baseRotationY + Math.sin(time * 0.7) * 0.025;
      rig.rotation.y = Math.sin(time * 0.32) * 0.025;
    }
    composer.render();
  };

  resize();
  new ResizeObserver(resize).observe(canvas.parentElement);
  animate();
}

function addLighting(scene, item) {
  const palette = paletteFor(item);
  scene.add(new THREE.HemisphereLight(0xbdefff, 0x3a1908, 0.74));

  const target = new THREE.Object3D();
  target.position.set(0, -0.42, 0.06);
  scene.add(target);

  const key = new THREE.SpotLight(0xfff1c2, 10.8, 15, 0.55, 0.72, 1.35);
  key.position.set(0, 3.4, 1.55);
  key.target = target;
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.8;
  key.shadow.camera.far = 12;
  key.shadow.bias = -0.00018;
  scene.add(key);

  const rim = new THREE.PointLight(palette.rim, 2.4, 10);
  rim.position.set(2.85, 0.6, 2.35);
  scene.add(rim);

  const fill = new THREE.PointLight(palette.key, 0.95, 8);
  fill.position.set(-2.7, 0.2, 2.1);
  scene.add(fill);
}

function addEnvironment(root, item) {
  const palette = paletteFor(item);
  const wood = getWoodMaterial();
  const innerGlow = new THREE.MeshBasicMaterial({ color: palette.rim, transparent: true, opacity: 0.12, side: THREE.BackSide });

  const back = wall(new THREE.BoxGeometry(6.2, 4.7, 0.18), wood, [0, 0.03, -1.75]);
  const floor = wall(new THREE.BoxGeometry(6.2, 0.18, 3.6), wood, [0, -2.04, 0]);
  const ceiling = wall(new THREE.BoxGeometry(6.2, 0.18, 3.6), wood, [0, 2.28, 0]);
  const left = wall(new THREE.BoxGeometry(0.18, 4.5, 3.6), wood, [-3.1, 0.12, 0]);
  const right = wall(new THREE.BoxGeometry(0.18, 4.5, 3.6), wood, [3.1, 0.12, 0]);
  root.add(back, floor, ceiling, left, right);

  const glowPlate = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 4.1), innerGlow);
  glowPlate.position.set(0, 0.02, -1.63);
  root.add(glowPlate);

  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.82, 2.8, 32, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff6cf,
      transparent: true,
      opacity: 0.035,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  );
  beam.position.set(0, 0.46, 0.65);
  beam.rotation.x = Math.PI;
  root.add(beam);

  const shadowBlob = new THREE.Mesh(
    new THREE.CircleGeometry(1.72, 64),
    new THREE.MeshBasicMaterial({
      color: 0x070402,
      transparent: true,
      opacity: 0.28,
      depthWrite: false
    })
  );
  shadowBlob.position.set(0.24, -1.935, 0.48);
  shadowBlob.rotation.x = -Math.PI / 2;
  shadowBlob.scale.set(1.35, 0.52, 1);
  root.add(shadowBlob);

  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.56, 0.18, 32),
    new THREE.MeshPhysicalMaterial({
      color: 0x17110b,
      metalness: 0.62,
      roughness: 0.2,
      emissive: 0xffd370,
      emissiveIntensity: 0.38
    })
  );
  lamp.position.set(0, 2.15, 1.16);
  lamp.castShadow = true;
  root.add(lamp);

  const railMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x111822,
    metalness: 0.78,
    roughness: 0.24,
    clearcoat: 0.6
  });
  [
    [[6.28, 0.12, 0.12], [0, 2.31, 1.82]],
    [[6.28, 0.12, 0.12], [0, -2.12, 1.82]],
    [[0.12, 4.52, 0.12], [-3.17, 0.1, 1.82]],
    [[0.12, 4.52, 0.12], [3.17, 0.1, 1.82]]
  ].forEach(([size, position]) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(...size), railMaterial);
    rail.position.set(...position);
    rail.castShadow = true;
    rail.receiveShadow = true;
    root.add(rail);
  });
}

function wall(geometry, material, position) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function getWoodMaterial() {
  if (woodMaterialCache) return woodMaterialCache;

  const makeMap = (src, repeatX, repeatY, color = false) => {
    const map = textureLoader.load(src);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeatX, repeatY);
    if (color) map.colorSpace = THREE.SRGBColorSpace;
    return map;
  };

  woodMaterialCache = new THREE.MeshStandardMaterial({
    map: makeMap("assets/materials/oak_wood_planks/diff.jpg", 2.4, 1.7, true),
    normalMap: makeMap("assets/materials/oak_wood_planks/normal.jpg", 2.4, 1.7),
    roughnessMap: makeMap("assets/materials/oak_wood_planks/rough.jpg", 2.4, 1.7),
    aoMap: makeMap("assets/materials/oak_wood_planks/ao.jpg", 2.4, 1.7),
    color: 0xffb36a,
    roughness: 0.78,
    metalness: 0.02
  });
  return woodMaterialCache;
}

function addDistortedGlass(root) {
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(6.0, 4.35, 32, 18),
    new THREE.MeshPhysicalMaterial({
      color: 0xe8fbff,
      transparent: true,
      opacity: 0.22,
      transmission: 0.78,
      thickness: 0.72,
      ior: 1.42,
      roughness: 0.035,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      normalMap: getGlassNormalMap(),
      normalScale: new THREE.Vector2(0.13, 0.13),
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  glass.position.set(0, 0.08, 1.74);
  glass.renderOrder = 8;
  root.add(glass);

  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(6.05, 4.4, 0.028),
    new THREE.MeshBasicMaterial({
      color: 0xdff5ff,
      transparent: true,
      opacity: 0.075,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  edge.position.set(0, 0.08, 1.72);
  edge.renderOrder = 7;
  root.add(edge);
}

function getGlassNormalMap() {
  if (glassNormalCache) return glassNormalCache;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgb(128,128,255)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const wave = Math.sin(x * 0.16) * 11 + Math.cos(y * 0.12) * 9 + Math.sin((x + y) * 0.055) * 7;
      const r = Math.max(0, Math.min(255, 128 + wave));
      const g = Math.max(0, Math.min(255, 128 - wave * 0.55));
      ctx.fillStyle = `rgb(${r},${g},255)`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  glassNormalCache = new THREE.CanvasTexture(canvas);
  glassNormalCache.wrapS = THREE.RepeatWrapping;
  glassNormalCache.wrapT = THREE.RepeatWrapping;
  glassNormalCache.repeat.set(1.8, 1.3);
  return glassNormalCache;
}

function addHeroCard(root, item) {
  const group = new THREE.Group();
  const layout = layoutFor(item);
  let texture;
  if (item.media.type === "video") {
    const video = document.createElement("video");
    video.src = item.media.src;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;
    video.play().catch(() => {});
    texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
  } else {
    texture = textureLoader.load(item.media.src);
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 2.0, 0.12),
    new THREE.MeshPhysicalMaterial({
      color: 0xf8fcff,
      metalness: 0.42,
      roughness: 0.18,
      clearcoat: 1
    })
  );
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  const image = new THREE.Mesh(
    new THREE.PlaneGeometry(2.48, 1.72),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  image.position.z = 0.072;
  image.receiveShadow = true;
  group.add(image);

  const sheen = new THREE.Mesh(
    new THREE.PlaneGeometry(2.54, 1.78),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending
    })
  );
  sheen.position.z = 0.084;
  sheen.rotation.z = -0.12;
  group.add(sheen);

  group.position.set(...layout.cardPosition);
  group.rotation.y = layout.cardRotationY;
  group.rotation.z = layout.cardRotationZ;
  group.userData.baseRotationY = layout.cardRotationY;
  group.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = node.castShadow || node !== image;
      node.receiveShadow = true;
    }
  });
  root.add(group);
  return group;
}

function addTrophy(root, item) {
  const palette = paletteFor(item);
  const layout = layoutFor(item);
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.92, 0.32, 8),
    new THREE.MeshPhysicalMaterial({
      color: palette.floor,
      metalness: 0.86,
      roughness: 0.15,
      clearcoat: 1
    })
  );
  base.position.y = -0.72;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, 0.92, 18),
    new THREE.MeshPhysicalMaterial({
      color: palette.key,
      metalness: 0.72,
      roughness: 0.12,
      transmission: 0.12,
      clearcoat: 1
    })
  );
  stem.position.y = -0.18;
  stem.castShadow = true;
  stem.receiveShadow = true;
  group.add(stem);

  const coreGeometry = geometryFor(item);
  const core = new THREE.Mesh(
    coreGeometry,
    new THREE.MeshPhysicalMaterial({
      color: palette.key,
      metalness: item.id === "docdiff" ? 0.88 : 0.45,
      roughness: 0.08,
      transmission: item.id === "docdiff" ? 0.05 : 0.32,
      clearcoat: 1,
      emissive: palette.rim,
      emissiveIntensity: 0.18
    })
  );
  core.position.y = 0.66;
  core.castShadow = true;
  core.receiveShadow = true;
  group.add(core);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.035, 12, 96),
    new THREE.MeshBasicMaterial({ color: palette.rim, transparent: true, opacity: 0.76 })
  );
  halo.position.y = 0.66;
  halo.rotation.x = Math.PI / 2.2;
  group.add(halo);

  group.position.set(...layout.trophyPosition);
  group.scale.setScalar(layout.trophyScale);
  group.userData.baseY = layout.trophyPosition[1];
  group.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  root.add(group);
  return group;
}

function layoutFor(item) {
  const layouts = {
    ssat: {
      cardPosition: [-1.04, 0.36, 0.34],
      cardRotationY: -0.12,
      cardRotationZ: -0.015,
      trophyPosition: [1.16, -0.58, 0.86],
      trophyScale: 1
    },
    directl: {
      cardPosition: [-1.24, 0.46, 0.22],
      cardRotationY: -0.2,
      cardRotationZ: 0.025,
      trophyPosition: [1.18, -0.56, 0.72],
      trophyScale: 1.08
    },
    eva01: {
      cardPosition: [-0.72, 0.18, 0.18],
      cardRotationY: -0.03,
      cardRotationZ: -0.035,
      trophyPosition: [1.18, -0.7, 0.92],
      trophyScale: 1.14
    },
    docdiff: {
      cardPosition: [-1.18, 0.08, 0.24],
      cardRotationY: -0.18,
      cardRotationZ: 0.018,
      trophyPosition: [1.24, -0.6, 0.72],
      trophyScale: 0.94
    }
  };
  return layouts[item.id] || layouts.ssat;
}

function geometryFor(item) {
  if (item.id === "directl") return new THREE.IcosahedronGeometry(0.68, 1);
  if (item.id === "eva01") return new THREE.BoxGeometry(0.9, 0.9, 0.9, 3, 3, 3);
  if (item.id === "docdiff") return new THREE.CylinderGeometry(0.62, 0.62, 0.86, 6);
  return new THREE.OctahedronGeometry(0.76, 1);
}

function paletteFor(item) {
  const palettes = {
    ssat: { key: 0xffd84d, rim: 0x31f7ff, back: 0x041c35, floor: 0xffb000 },
    directl: { key: 0xff4fd8, rim: 0x31f7ff, back: 0x261140, floor: 0xd7f6ff },
    eva01: { key: 0x8dffdd, rim: 0xff4fd8, back: 0x102a33, floor: 0x82ffe3 },
    docdiff: { key: 0xf4f7fb, rim: 0x9fc6ff, back: 0x142035, floor: 0xc9d3df }
  };
  return palettes[item.id] || palettes.ssat;
}

renderProfile();
renderExhibits();
