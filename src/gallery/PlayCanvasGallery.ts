import * as pc from "playcanvas";
import type { GalleryProject } from "../data/gallery";

declare global {
  interface Window {
    __galleryDebug?: () => unknown;
    __webglContexts?: number;
  }
}

type AreaLightLuts = {
  LTC_MAT_1: number[];
  LTC_MAT_2: number[];
};

type WoodTextureSet = {
  diff: pc.Texture;
  walnutDiff: pc.Texture;
  cherryDiff: pc.Texture;
  sideDiff: pc.Texture;
  floorDiff: pc.Texture;
  normal: pc.Texture;
  rough: pc.Texture;
  floorRough: pc.Texture;
  ao: pc.Texture;
  lightmap: pc.Texture;
};

type GalleryAssets = {
  cabinet: pc.ContainerResource;
  studioHdr: pc.Texture;
  areaLuts: AreaLightLuts;
  wood: WoodTextureSet;
  heroes: pc.Texture[];
};

type GallerySlotRuntime = {
  index: number;
  project: GalleryProject;
  root: pc.Entity;
  heroAnchor: pc.Entity;
  trophyAnchor: pc.Entity;
  glassAnchor: pc.Entity;
  lightAnchor: pc.Entity;
  plaqueAnchor: pc.Entity;
  cardFrameAnchor: pc.Entity;
  rimLightAnchor: pc.Entity;
  heroMaterial: pc.StandardMaterial;
  plaqueMaterial: pc.StandardMaterial;
  diffuserMaterial: pc.StandardMaterial;
  topLight: pc.Entity;
  fillLight: pc.Entity;
  sideFillLight: pc.Entity;
  heroLight: pc.Entity;
  rimLight: pc.Entity;
  trophySpotlight: pc.Entity;
  trophy: pc.Entity;
  activeWeight: number;
  spotlightWeight: number;
};

type MaterialOptions = {
  name: string;
  diffuse: pc.Color;
  emissive?: pc.Color;
  emissiveIntensity?: number;
  metalness?: number;
  gloss?: number;
  reflectivity?: number;
  clearCoat?: number;
  clearCoatGloss?: number;
  opacity?: number;
  twoSided?: boolean;
};

type MatrixPlaqueRuntime = {
  texture: pc.Texture;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  project: GalleryProject;
  seed: number;
};

type HeroVideoRuntime = {
  projectId: string;
  url: string;
  texture: pc.Texture;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  project: GalleryProject;
  video: HTMLVideoElement;
  ready: boolean;
  failed: boolean;
  lastUploadedMediaTime: number;
};

type HeroColorProbe = {
  sourceMean: [number, number, number];
  renderedMean: [number, number, number];
  delta: number;
};

type GeneratedTrophyAsset = {
  label: "v2" | "v3-lod";
  url: string;
  timeoutMs?: number;
};

const ASSET_VERSION = "20260701-walnut-cabinet-v6k-walnut-metal-floor";
const CABINET_MODEL_URL = `/assets/gallery/models/wooden-gallery-cabinet-v6.glb?v=${ASSET_VERSION}`;
const STUDIO_HDR_URL = "/assets/gallery/materials/studio_small_08_1k.hdr";
const AREA_LUTS_URL = "/assets/gallery/materials/area-light-luts.json";
const WALNUT_V6_DIR = "/assets/gallery/materials/walnut_cabinet_v6";
const CABINET_LIGHTMAP_URL = `/assets/gallery/materials/cabinet_lightmap_v6.png?v=${ASSET_VERSION}`;
const DEFAULT_WOOD_CANDIDATE = "walnut_cabinet_v6";
const GENERATED_TROPHY_V2_VERSION = "20260722-perf-v2";
const GENERATED_TROPHY_V3_VERSION = "20260722-perf-v3-lod";
const BACKGROUND_TROPHY_WARMUP_DELAY_MS = 12_000;
const BACKGROUND_TROPHY_IDLE_TIMEOUT_MS = 4_000;
// A lower-poly v3 is an acceleration path, never a visual dependency. Each
// slot keeps its authored v2 model as an in-order network/runtime fallback.
const GENERATED_TROPHY_SOURCES: ReadonlyArray<ReadonlyArray<GeneratedTrophyAsset>> = [
  [
    {
      label: "v3-lod",
      url: `/assets/gallery/models/generated/trophy-ssat-v3-lod.glb?v=${GENERATED_TROPHY_V3_VERSION}`,
      // PlayCanvas retries failed container requests internally. Bound only
      // the optional LOD so a CDN/cache miss cannot postpone the visible v2.
      timeoutMs: 8_000
    },
    { label: "v2", url: `/assets/gallery/models/generated/trophy-ssat-v2-perf.glb?v=${GENERATED_TROPHY_V2_VERSION}` }
  ],
  [
    { label: "v3-lod", url: `/assets/gallery/models/generated/trophy-directl-v3-lod.glb?v=${GENERATED_TROPHY_V3_VERSION}`, timeoutMs: 8_000 },
    { label: "v2", url: `/assets/gallery/models/generated/trophy-directl-v2-perf.glb?v=${GENERATED_TROPHY_V2_VERSION}` }
  ],
  [
    { label: "v3-lod", url: `/assets/gallery/models/generated/trophy-eva01-v3-lod.glb?v=${GENERATED_TROPHY_V3_VERSION}`, timeoutMs: 8_000 },
    { label: "v2", url: `/assets/gallery/models/generated/trophy-eva01-v2-perf.glb?v=${GENERATED_TROPHY_V2_VERSION}` }
  ],
  [
    { label: "v3-lod", url: `/assets/gallery/models/generated/trophy-docdiff-v3-lod.glb?v=${GENERATED_TROPHY_V3_VERSION}`, timeoutMs: 8_000 },
    { label: "v2", url: `/assets/gallery/models/generated/trophy-docdiff-v2-perf.glb?v=${GENERATED_TROPHY_V2_VERSION}` }
  ]
];
const CABINET_VERSION = "v6";
const CABINET_WIDTH = 5.55;
const CABINET_HEIGHT = 4.78;
const CABINET_FRONT_Z = 0.67;
const DESKTOP_CAMERA_Z = 7.35;

const TROPHY_FLOOR_Y = -0.905;
const TROPHY_FRONT_Z = 0.34;
const TROPHY_RIGHT_X = 0.56;
const TROPHY_SCALES = [0.71, 0.74, 0.71, 0.70] as const;
const TROPHY_SPOTLIGHT_INTENSITIES = [30, 48, 32, 60] as const;
const HERO_MEDIA_BRIGHTNESS: Record<string, number> = {
  ssat: 0.88,
  directl: 0.86,
  eva01: 0.74,
  docdiff: 0.64
};
const HERO_IMAGE_EMISSIVE = 0.14;
const HERO_VIDEO_EMISSIVE = 0.16;
const MOBILE_CAMERA_Z = 4.45;
const DESKTOP_OVERSCAN = 0.948;
const MOBILE_OVERSCAN = 1.03;
const tierColors: Record<GalleryProject["trophyTier"], pc.Color> = {
  "legendary-holo": new pc.Color(0.96, 0.82, 1.0),
  gold: new pc.Color(1.0, 0.72, 0.26),
  silver: new pc.Color(0.86, 0.9, 0.96),
  "blue-crystal": new pc.Color(0.35, 0.84, 1.0)
};

function setTextureSampling(texture: pc.Texture, repeat: boolean): pc.Texture {
  texture.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
  texture.magFilter = pc.FILTER_LINEAR;
  texture.addressU = repeat ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE;
  texture.addressV = repeat ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE;
  texture.mipmaps = true;
  texture.anisotropy = 8;
  return texture;
}

function makeMaterial(options: MaterialOptions): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.name = options.name;
  material.useMetalness = true;
  material.enableGGXSpecular = true;
  material.diffuse = options.diffuse;
  material.ambient = options.diffuse;
  material.metalness = options.metalness ?? 0;
  material.gloss = options.gloss ?? 0.45;
  material.reflectivity = options.reflectivity ?? 0.18;
  material.fresnelModel = pc.FRESNEL_SCHLICK;
  material.twoSidedLighting = options.twoSided ?? false;
  material.useSkybox = true;

  if (options.emissive) {
    material.emissive = options.emissive;
    material.emissiveIntensity = options.emissiveIntensity ?? 0.5;
  }

  if (options.clearCoat !== undefined) {
    material.clearCoat = options.clearCoat;
    material.clearCoatGloss = options.clearCoatGloss ?? 0.5;
  }

  if (options.opacity !== undefined && options.opacity < 1) {
    material.opacity = options.opacity;
    material.opacityFadesSpecular = false;
    material.blendType = pc.BLEND_NORMAL;
    material.depthWrite = false;
    material.cull = pc.CULLFACE_NONE;
  }

  material.update();
  return material;
}

function getWoodCandidateId(): string {
  return DEFAULT_WOOD_CANDIDATE;
}

/**
 * Color probes are a calibration diagnostic, not a visual dependency. Reading
 * pixels back from a canvas stalls the GPU command queue, so production keeps
 * the probe dormant unless a developer explicitly requests it in the URL.
 */
function isColorProbeRequested(): boolean {
  return new URLSearchParams(window.location.search).has("gallery-color-probe");
}

function addVerticalQuad(parent: pc.Entity, device: pc.GraphicsDevice, name: string, material: pc.Material, options: {
  width: number;
  height: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  castShadows?: boolean;
  receiveShadows?: boolean;
}): pc.Entity {
  const halfWidth = options.width * 0.5;
  const halfHeight = options.height * 0.5;
  const geometry = new pc.Geometry();
  geometry.positions = [
    -halfWidth, -halfHeight, 0,
    halfWidth, -halfHeight, 0,
    halfWidth, halfHeight, 0,
    -halfWidth, halfHeight, 0
  ];
  geometry.normals = [
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1
  ];
  geometry.uvs = [
    0, 1,
    1, 1,
    1, 0,
    0, 0
  ];
  geometry.indices = [0, 1, 2, 0, 2, 3];
  const mesh = pc.Mesh.fromGeometry(device, geometry);
  const meshInstance = new pc.MeshInstance(mesh, material);
  meshInstance.castShadow = options.castShadows ?? false;
  meshInstance.receiveShadow = options.receiveShadows ?? false;

  const entity = new pc.Entity(name);
  entity.addComponent("render", {
    type: "asset",
    meshInstances: [meshInstance],
    castShadows: options.castShadows ?? false,
    receiveShadows: options.receiveShadows ?? false
  });
  if (options.position) entity.setLocalPosition(...options.position);
  if (options.rotation) entity.setLocalEulerAngles(...options.rotation);
  parent.addChild(entity);
  return entity;
}

function findEntity(root: pc.Entity, name: string): pc.Entity {
  const found = root.findByName(name);
  if (!found || !(found instanceof pc.Entity)) {
    throw new Error(`wooden gallery cabinet is missing node: ${name}`);
  }
  return found;
}

function drawFittedImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  mode: "cover" | "contain" = "cover"
): void {
  const sourceWidth = "videoWidth" in image
    ? image.videoWidth
    : "naturalWidth" in image
      ? image.naturalWidth
      : "width" in image
        ? Number(image.width)
        : width;
  const sourceHeight = "videoHeight" in image
    ? image.videoHeight
    : "naturalHeight" in image
      ? image.naturalHeight
      : "height" in image
        ? Number(image.height)
        : height;
  if (!sourceWidth || !sourceHeight) return;
  const scale = mode === "cover"
    ? Math.max(width / sourceWidth, height / sourceHeight)
    : Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function sampleCanvasMean(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): [number, number, number] {
  const data = ctx.getImageData(x, y, width, height).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 16) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count += 1;
  }
  return count ? [r / count, g / count, b / count] : [0, 0, 0];
}

function sampleImageMean(image: CanvasImageSource, width = 128, height = 128): [number, number, number] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [0, 0, 0];
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawFittedImage(ctx, image, 0, 0, canvas.width, canvas.height, "contain");
  return sampleCanvasMean(ctx, 0, 0, canvas.width, canvas.height);
}

function colorDelta(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
    (a[1] - b[1]) ** 2 +
    (a[2] - b[2]) ** 2
  );
}

function setFittedMonoFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  startSize: number,
  minSize: number,
  maxWidth: number
): number {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  ctx.font = `${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  return size;
}

function drawHeroMediaSurface(
  ctx: CanvasRenderingContext2D,
  project: GalleryProject,
  source: CanvasImageSource
): void {
  const { width, height } = ctx.canvas;

  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  const mediaBrightness = HERO_MEDIA_BRIGHTNESS[project.id] ?? 0.84;
  ctx.filter = `brightness(${mediaBrightness}) contrast(0.92) saturate(0.96)`;
  drawFittedImage(ctx, source, 0, 0, width, height, "contain");
  ctx.filter = "none";
}

function makeCanvasTexture(device: pc.GraphicsDevice, name: string, canvas: HTMLCanvasElement, repeat = false): pc.Texture {
  const texture = new pc.Texture(device, {
    name,
    width: canvas.width,
    height: canvas.height,
    format: pc.PIXELFORMAT_RGBA8,
    mipmaps: true
  });
  texture.setSource(canvas);
  return setTextureSampling(texture, repeat);
}

export class PlayCanvasGallery {
  private app: pc.Application;
  private camera: pc.Entity | null = null;
  private cameraFrame?: pc.CameraFrame;
  private cabinetRoot: pc.Entity | null = null;
  private slots: GallerySlotRuntime[] = [];
  private resizeObserver?: ResizeObserver;
  private isMobile = false;
  private activeIndex = -1;
  private hoverIndex: number | null = null;
  private anchorsFound = 0;
  private materialBindings: Record<string, boolean> = {};
  private envAtlasReady = false;
  private lightmapReady = false;
  private generatedHeroMedia: Record<string, boolean> = {};
  private heroColorProbe: Record<string, HeroColorProbe> = {};
  private trophyMeshes: Record<string, boolean> = {};
  private generatedTrophyModels: Record<string, boolean> = {};
  private generatedTrophySources: Record<string, GeneratedTrophyAsset["label"]> = {};
  private heroVideoStates: Record<string, { url: string; ready: boolean; failed: boolean }> = {};
  private heroVideos: HeroVideoRuntime[] = [];
  private matrixPlaques: MatrixPlaqueRuntime[] = [];
  private plaqueUpdateAccumulator = 0;
  private videoUpdateAccumulator = 0;
  private colorProbeAccumulator = 0;
  private lightingAccumulator = 0;
  private frameSamples: number[] = [];
  private time = 0;
  private woodCandidate = getWoodCandidateId();
  private paused = false;
  private spotlightSceneWeight = 0;
  private generatedTrophyQueue: number[] = [];
  private generatedTrophySettled = new Set<number>();
  private generatedTrophyLoadingIndex: number | null = null;
  private generatedTrophyIdleHandle: number | null = null;
  private generatedTrophyTimer = 0;
  private generatedTrophyInteractionStarted = false;
  private profileCompanionReady = false;
  private destroyed = false;
  private staticCabinetBatchGroupId: number | null = null;
  private staticCabinetBatchSourceMeshes = 0;
  private staticCabinetBatchCount = 0;
  private readonly colorProbeEnabled = isColorProbeRequested();
  constructor(private root: HTMLElement, private projects: GalleryProject[]) {
    this.root.innerHTML = this.renderShell();
    const canvas = this.root.querySelector<HTMLCanvasElement>(".playcanvas-gallery-canvas");
    if (!canvas) throw new Error("PlayCanvas wooden gallery shell failed to mount.");

    this.app = new pc.Application(canvas, {
      graphicsDeviceOptions: {
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
      }
    });
    // HTML project controls are the accessible, authoritative interaction
    // layer. Bind them as soon as the shell exists so keyboard selection does
    // not wait for optional GLB, video, HDRI or shader initialization.
    this.bindOverlayEvents();
  }

  async init(): Promise<void> {
    this.root.addEventListener("gallery:companion-ready", this.onProfileCompanionReady);
    this.configureApp();
    this.createCamera();

    const assets = await this.loadGalleryAssets();
    this.applyEnvironment(assets);
    this.createSceneBackdrop();
    this.instantiateCabinet(assets);
    this.installDebugHook();

    this.app.on("update", (dt: number) => this.update(dt));
    // The cabinet is a mostly static PBR scene. Its only continuous visual
    // inputs are the 24 fps video card, 13 fps matrix plaques, and transient
    // hover lighting. Rendering every browser tick does not add information,
    // but it does re-run TAA, SSAO and bloom needlessly.
    this.app.autoRender = false;
    this.app.start();
    this.applySpotlightLighting(0, true);
    this.app.renderNextFrame = true;
    this.scheduleGeneratedTrophyLoading();
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.root);
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelGeneratedTrophyScheduling();
    this.root.removeEventListener("gallery:companion-ready", this.onProfileCompanionReady);
    this.resizeObserver?.disconnect();
    this.cameraFrame?.destroy();
    this.heroVideos.forEach((runtime) => {
      runtime.video.pause();
      runtime.video.removeAttribute("src");
      runtime.video.load();
    });
    delete window.__galleryDebug;
    this.app.destroy();
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.app.autoRender = false;
    this.heroVideos.forEach((runtime) => runtime.video.pause());
    this.cancelGeneratedTrophyScheduling();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.lightingAccumulator = 0;
    this.app.autoRender = false;
    this.app.renderNextFrame = true;
    this.heroVideos.forEach((runtime) => {
      if (!runtime.failed) runtime.video.play().catch(() => undefined);
    });
    this.scheduleGeneratedTrophyLoading();
  }

  getRootElement(): HTMLElement {
    return this.root;
  }









  private renderShell(): string {
    const cards = this.projects.slice(0, 4).map((project, index) => {
      const links = project.links.map((link) => {
        const disabled = link.state === "coming-soon" || !link.href;
        return disabled
          ? `<span class="is-disabled" aria-disabled="true">${link.label}</span>`
          : `<a href="${link.href}" target="_blank" rel="noreferrer">${link.label}</a>`;
      }).join("");

      return `
        <article class="gallery-ui-card" data-project="${project.id}" data-index="${index}" tabindex="0" role="button" aria-label="${project.title} project display case">
          <span class="gallery-hotspot-label"><i aria-hidden="true"></i><span><b>${project.title}</b><small>${project.venue}</small></span></span>
          <div class="gallery-action-panel">
            <p>${project.summary}</p>
            <nav class="gallery-links" aria-label="${project.title} links">${links}</nav>
          </div>
        </article>
      `;
    }).join("");

    return `
      <div class="playcanvas-gallery playcanvas-gallery--wooden-cabinet" data-playcanvas-gallery>
        <canvas class="playcanvas-gallery-canvas" aria-label="Realtime PlayCanvas wooden PBR research cabinet"></canvas>
        <div class="gallery-crt" aria-hidden="true"></div>
        <div class="gallery-overlay">${cards}</div>
        <p class="gallery-calibration-credit">Wood PBR: Poly Haven European Walnut Veneer 05, CC0. HDRI: Poly Haven Studio Small 08, CC0.</p>
      </div>
    `;
  }

  private configureApp(): void {
    this.app.setCanvasFillMode(pc.FILLMODE_NONE);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.app.scene.ambientSource = pc.AMBIENTSRC_ENVALATLAS;
    this.app.scene.ambientLight = new pc.Color(0.17, 0.125, 0.09);
    this.app.scene.exposure = 0.96;
    this.app.scene.lighting.areaLightsEnabled = true;
    this.app.scene.lighting.shadowsEnabled = true;
    this.app.scene.skyboxIntensity = 0.09;
    this.app.scene.skyboxMip = 2;
  }

  private createCamera(): void {
    const camera = new pc.Entity("wooden-gallery-camera");
    camera.addComponent("camera", {
      projection: pc.PROJECTION_PERSPECTIVE,
      clearColor: new pc.Color(0, 0, 0),
      nearClip: 0.08,
      farClip: 80,
      toneMapping: pc.TONEMAP_ACES2,
      gammaCorrection: pc.GAMMA_SRGB
    });
    camera.setPosition(0, 0.08, DESKTOP_CAMERA_Z);
    camera.lookAt(0, 0.04, 0);
    this.app.root.addChild(camera);
    this.camera = camera;

    if (camera.camera) {
      const frame = new pc.CameraFrame(this.app, camera.camera);
      frame.rendering.renderFormats = [pc.PIXELFORMAT_111110F, pc.PIXELFORMAT_RGBA16F, pc.PIXELFORMAT_RGBA32F];
      frame.rendering.samples = 1;
      frame.rendering.toneMapping = pc.TONEMAP_ACES2;
      frame.rendering.sharpness = 0.36;
      frame.taa.enabled = true;
      frame.taa.jitter = 0.045;
      frame.ssao.type = pc.SSAOTYPE_COMBINE;
      frame.ssao.blurEnabled = true;
      frame.ssao.randomize = false;
      frame.ssao.intensity = 0.060;
      frame.ssao.radius = 0.28;
      frame.ssao.samples = 16;
      frame.ssao.power = 1.1;
      frame.bloom.intensity = 0.035;
      frame.bloom.blurLevel = 3;
      frame.bloom.threshold = 0.82;
      frame.grading.enabled = true;
      frame.grading.brightness = 1.035;
      frame.grading.contrast = 1.010;
      frame.grading.saturation = 1.080;
      frame.grading.tint = new pc.Color(1, 1, 1);
      frame.colorEnhance.enabled = false;
      frame.colorEnhance.shadows = 0;
      frame.colorEnhance.highlights = 0;
      frame.colorEnhance.vibrance = 0;
      frame.colorEnhance.midtones = 0;
      frame.colorEnhance.dehaze = 0;
      frame.vignette.intensity = 0.015;
      frame.fringing.intensity = 0;
      frame.update();
      frame.enabled = true;
      this.cameraFrame = frame;
    }
  }

  private applyEnvironment(assets: GalleryAssets): void {
    this.app.setAreaLightLuts(assets.areaLuts.LTC_MAT_1, assets.areaLuts.LTC_MAT_2);
    const lightingSource = pc.EnvLighting.generateLightingSource(assets.studioHdr, { size: 128 });
    this.app.scene.envAtlas = pc.EnvLighting.generateAtlas(lightingSource, {
      size: 384,
      numReflectionSamples: 768,
      numAmbientSamples: 768
    });
    // Keep the HDR-derived envAtlas for PBR reflections, but do not expose the
    // neutral studio HDRI as a gray page background around the cabinet.
    this.app.scene.skybox = null;
    this.app.scene.ambientSource = pc.AMBIENTSRC_ENVALATLAS;
    this.app.scene.skyboxIntensity = 0.17;
    this.app.scene.skyboxMip = 3;
    this.app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, -32, 0);
    this.envAtlasReady = !!this.app.scene.envAtlas;
  }

  private createSceneBackdrop(): void {
    const material = makeMaterial({
      name: "mat_warm_walnut_void.runtime",
      diffuse: new pc.Color(0.022, 0.012, 0.006),
      emissive: new pc.Color(0.030, 0.018, 0.008),
      emissiveIntensity: 0.13,
      gloss: 0.18,
      reflectivity: 0.02,
      twoSided: true
    });
    material.useLighting = false;
    material.update();
    const backdrop = addVerticalQuad(this.app.root, this.app.graphicsDevice, "warm-walnut-gallery-backdrop", material, {
      width: 9.3,
      height: 8.1,
      position: [0, 0.05, -0.86],
      receiveShadows: false,
      castShadows: false
    });
    backdrop.setLocalEulerAngles(0, 0, 0);
  }

  private instantiateCabinet(assets: GalleryAssets): void {
    const materials = this.createCabinetMaterials(assets.wood);
    const cabinet = assets.cabinet.instantiateRenderEntity({
      castShadows: true,
      receiveShadows: true
    });
    cabinet.name = "wooden-gallery-cabinet-runtime";
    this.app.root.addChild(cabinet);
    this.cabinetRoot = cabinet;
    this.applyCabinetMaterials(cabinet, materials);

    for (let index = 0; index < Math.min(4, this.projects.length); index += 1) {
      const slotRoot = findEntity(cabinet, `slot-${index}`);
      const heroAnchor = findEntity(cabinet, `slot-${index}.hero-anchor`);
      const trophyAnchor = findEntity(cabinet, `slot-${index}.trophy-anchor`);
      const glassAnchor = findEntity(cabinet, `slot-${index}.glass-anchor`);
      const lightAnchor = findEntity(cabinet, `slot-${index}.light-anchor`);
      const plaqueAnchor = findEntity(cabinet, `slot-${index}.plaque-anchor`);
      const cardFrameAnchor = findEntity(cabinet, `slot-${index}.card-frame-anchor`);
      const rimLightAnchor = findEntity(cabinet, `slot-${index}.rim-light-anchor`);
      const plaqueScreen = findEntity(cabinet, `slot-${index}.plaque-screen`);
      const lightDiffuser = findEntity(cabinet, `slot-${index}.light-diffuser`);
      const trophy = findEntity(cabinet, `slot-${index}.trophy-root`);
      // The cabinet GLB contains the former trophy geometry. Disable it before
      // PlayCanvas renders its first frame so an async model swap cannot leak
      // the old silhouette during refresh.
      trophy.findComponents("render").forEach((component) => {
        (component as pc.RenderComponent).enabled = false;
      });
      const trophyScale = TROPHY_SCALES[index] ?? TROPHY_SCALES[0];
      trophy.setLocalPosition(TROPHY_RIGHT_X, TROPHY_FLOOR_Y, TROPHY_FRONT_Z);
      trophy.setLocalScale(trophyScale, trophyScale, trophyScale);
      trophyAnchor.setLocalPosition(TROPHY_RIGHT_X, TROPHY_FLOOR_Y, TROPHY_FRONT_Z);
      rimLightAnchor.setLocalPosition(
        TROPHY_RIGHT_X,
        TROPHY_FLOOR_Y + trophyScale * 0.48,
        TROPHY_FRONT_Z - 0.08
      );
      this.anchorsFound += 8;
      this.trophyMeshes[this.projects[index].id] = true;
      this.generatedTrophyModels[this.projects[index].id] = false;

      const heroMedia = this.createHeroMediaTexture(assets.heroes[index], this.projects[index]);
      const heroMaterial = this.createHeroBoard(heroAnchor, heroMedia, this.projects[index]);
      this.attachHeroVideo(this.projects[index], heroMaterial);
      this.hideLegacyPlaqueGeometry(cabinet, index);
      this.configurePlaqueScreen(plaqueScreen);
      plaqueScreen.enabled = false;
      const plaqueMaterial = this.applyPlaqueTexture(plaqueScreen, this.projects[index]);
      const diffuserMaterial = this.cloneSlotDiffuserMaterial(lightDiffuser, index);
      const topLight = this.createTopLight(lightAnchor, trophyAnchor, index);
      const fillLight = this.createSlotFillLight(slotRoot, heroAnchor, index);
      const sideFillLight = this.createSideFillLight(slotRoot, heroAnchor, index);
      const heroLight = this.createHeroBackLight(heroAnchor, index);
      const rimLight = this.createRimLight(rimLightAnchor, this.projects[index]);
      const trophySpotlight = this.createTrophySpotlight(slotRoot, trophy, index);

      this.slots.push({
        index,
        project: this.projects[index],
        root: slotRoot,
        heroAnchor,
        trophyAnchor,
        glassAnchor,
        lightAnchor,
        plaqueAnchor,
        cardFrameAnchor,
        rimLightAnchor,
        heroMaterial,
        plaqueMaterial,
        diffuserMaterial,
        topLight,
        fillLight,
        sideFillLight,
        heroLight,
        rimLight,
        trophySpotlight,
        trophy,
        activeWeight: 0,
        spotlightWeight: 0
      });
    }

    this.createStaticCabinetBatch(cabinet);
  }

  /**
   * The authored cabinet deliberately keeps every rail, groove and frame as a
   * separate mesh so it remains editable in DCC tools. At runtime those
   * pieces never move. Static batching preserves their exact materials,
   * lighting, shadows and lightmaps, while replacing hundreds of CPU draw
   * submissions with material-sized batches. Interactive glass, plaques,
   * diffuser brightness and trophies intentionally stay outside the batch.
   */
  private createStaticCabinetBatch(cabinet: pc.Entity): void {
    const batcher = this.app.batcher;
    if (!batcher || this.staticCabinetBatchGroupId !== null) return;

    const group = batcher.addGroup("wooden-gallery-static-cabinet", false, 32, undefined, [pc.LAYERID_WORLD]);
    let sourceMeshes = 0;
    cabinet.forEach((node) => {
      const entity = node as pc.Entity;
      const render = entity.render;
      if (!render || !this.isStaticCabinetBatchCandidate(entity.name)) return;
      render.isStatic = true;
      render.batchGroupId = group.id;
      sourceMeshes += render.meshInstances.length;
    });

    if (!sourceMeshes) {
      batcher.removeGroup(group.id);
      return;
    }

    batcher.generate([group.id]);
    const getBatches = (batcher as unknown as { getBatches: (id: number) => unknown[] }).getBatches;
    this.staticCabinetBatchGroupId = group.id;
    this.staticCabinetBatchSourceMeshes = sourceMeshes;
    this.staticCabinetBatchCount = typeof getBatches === "function" ? getBatches.call(batcher, group.id).length : 0;
  }

  private isStaticCabinetBatchCandidate(name: string): boolean {
    // Transparent panes need painter's ordering. The animated/interactive
    // parts below own per-slot material state or are swapped asynchronously.
    return !name.includes("glass")
      && !name.includes(".light-diffuser")
      && !name.includes(".plaque-screen")
      && !name.includes(".trophy-");
  }

  private installGeneratedTrophy(
    trophyRoot: pc.Entity,
    resource: pc.ContainerResource,
    projectId: string
  ): boolean {
    try {
      const legacyRenderers: pc.RenderComponent[] = [];
      const collectLegacyRenderers = (entity: pc.Entity): void => {
        if (entity.render) legacyRenderers.push(entity.render);
        entity.children.forEach((child) => {
          if (child instanceof pc.Entity) collectLegacyRenderers(child);
        });
      };
      collectLegacyRenderers(trophyRoot);

      const generated = resource.instantiateRenderEntity({
        castShadows: true,
        receiveShadows: true
      });
      generated.name = `${projectId}-generated-trophy-v1`;
      generated.enabled = false;
      generated.setLocalPosition(0, 0.501, 0);
      generated.setLocalEulerAngles(0, 0, 0);
      generated.setLocalScale(1, 1, 1);
      const metalnessByProject: Record<string, number> = {
        ssat: 0.34,
        directl: 0.28,
        eva01: 0.18,
        docdiff: 0.06
      };
      generated.findComponents("render").forEach((component) => {
        const render = component as pc.RenderComponent;
        render.meshInstances.forEach((meshInstance) => {
          const source = meshInstance.material as pc.StandardMaterial;
          const material = source.clone();
          material.name = `${source.name || "generated-trophy"}.${projectId}.runtime`;
          material.useMetalness = true;
          material.metalness = metalnessByProject[projectId] ?? 0.25;
          material.gloss = projectId === "docdiff" ? 0.32 : 0.52;
          material.reflectivity = projectId === "docdiff" ? 0.14 : 0.34;
          material.emissive = new pc.Color(0, 0, 0);
          material.emissiveIntensity = 0;
          material.update();
          meshInstance.material = material;
        });
      });
      trophyRoot.addChild(generated);
      legacyRenderers.forEach((render) => { render.enabled = false; });
      generated.enabled = true;
      this.generatedTrophyModels[projectId] = true;
      return true;
    } catch (error) {
      this.generatedTrophyModels[projectId] = false;
      console.warn(`Generated trophy fallback active for ${projectId}`, error);
      return false;
    }
  }

  private scheduleGeneratedTrophyLoading(priorityIndex?: number): void {
    if (this.destroyed) return;

    if (priorityIndex !== undefined) {
      this.generatedTrophyInteractionStarted = true;
      const project = this.projects[priorityIndex];
      if (!project || this.generatedTrophyModels[project.id] || this.generatedTrophySettled.has(priorityIndex) || this.generatedTrophyLoadingIndex === priorityIndex) return;
      this.generatedTrophyQueue = [
        priorityIndex,
        ...this.generatedTrophyQueue.filter((index) => index !== priorityIndex)
      ];
      this.cancelGeneratedTrophyScheduling();
    }

    // The profile room hydrates after the cabinet. Let it complete its image
    // decoding before non-critical trophy upgrades compete for the same main
    // thread/GPU queue. Direct user focus always bypasses this gate.
    if (priorityIndex === undefined && !this.generatedTrophyInteractionStarted && !this.profileCompanionReady) return;

    if (!this.generatedTrophyQueue.length) {
      this.generatedTrophyQueue = this.projects
        .slice(0, GENERATED_TROPHY_SOURCES.length)
        .map((project, index) => this.generatedTrophyModels[project.id] || this.generatedTrophySettled.has(index) ? -1 : index)
        .filter((index) => index >= 0);
    }

    if (this.paused || this.generatedTrophyLoadingIndex !== null || !this.generatedTrophyQueue.length) return;

    if (priorityIndex !== undefined) {
      this.requestGeneratedTrophyIdleSlot(650);
      return;
    }

    if (this.generatedTrophyTimer || this.generatedTrophyIdleHandle !== null) return;
    this.generatedTrophyTimer = window.setTimeout(() => {
      this.generatedTrophyTimer = 0;
      this.requestGeneratedTrophyIdleSlot(
        this.generatedTrophyInteractionStarted ? 1_200 : BACKGROUND_TROPHY_IDLE_TIMEOUT_MS
      );
    }, this.generatedTrophyInteractionStarted ? 1_800 : BACKGROUND_TROPHY_WARMUP_DELAY_MS);
  }

  private requestGeneratedTrophyIdleSlot(timeout: number): void {
    if (this.destroyed || this.paused || this.generatedTrophyLoadingIndex !== null || !this.generatedTrophyQueue.length) return;
    const run = (): void => {
      this.generatedTrophyIdleHandle = null;
      if (this.destroyed || this.paused) return;
      void this.loadNextGeneratedTrophy();
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      this.generatedTrophyIdleHandle = idleWindow.requestIdleCallback(run, { timeout });
    } else {
      this.generatedTrophyTimer = window.setTimeout(() => {
        this.generatedTrophyTimer = 0;
        run();
      }, Math.min(timeout, 120));
    }
  }

  private onProfileCompanionReady = (): void => {
    this.profileCompanionReady = true;
    if (!this.paused) this.scheduleGeneratedTrophyLoading();
  };

  private cancelGeneratedTrophyScheduling(): void {
    if (this.generatedTrophyTimer) {
      window.clearTimeout(this.generatedTrophyTimer);
      this.generatedTrophyTimer = 0;
    }
    if (this.generatedTrophyIdleHandle !== null) {
      const idleWindow = window as Window & { cancelIdleCallback?: (handle: number) => void };
      idleWindow.cancelIdleCallback?.(this.generatedTrophyIdleHandle);
      this.generatedTrophyIdleHandle = null;
    }
  }

  private async loadNextGeneratedTrophy(): Promise<void> {
    const index = this.generatedTrophyQueue.shift();
    if (index === undefined) return;
    const slot = this.slots[index];
    const project = this.projects[index];
    const sources = GENERATED_TROPHY_SOURCES[index];
    if (!slot || !project || !sources?.length || this.generatedTrophyModels[project.id]) {
      this.scheduleGeneratedTrophyLoading();
      return;
    }

    this.generatedTrophyLoadingIndex = index;
    try {
      let installed = false;
      let lastError: unknown;
      for (const source of sources) {
        try {
          const resource = await this.loadContainer(source.url, source.timeoutMs);
          if (this.destroyed) break;
          if (this.installGeneratedTrophy(slot.trophy, resource, project.id)) {
            this.generatedTrophySources[project.id] = source.label;
            this.app.renderNextFrame = true;
            installed = true;
            break;
          }
        } catch (error) {
          lastError = error;
        }
      }
      if (!installed && !this.destroyed) {
        this.generatedTrophyModels[project.id] = false;
        console.warn(`Generated trophy fallback active for ${project.id}`, lastError);
      }
    } finally {
      this.generatedTrophySettled.add(index);
      this.generatedTrophyLoadingIndex = null;
      if (!this.paused && !this.destroyed) this.scheduleGeneratedTrophyLoading();
    }
  }

  private createCabinetMaterials(wood: WoodTextureSet): Record<string, pc.StandardMaterial> {
    const bindWood = (
      material: pc.StandardMaterial,
      diffuseMap: pc.Texture,
      tiling: pc.Vec2,
      bumpiness: number,
      aoIntensity: number,
      useAo = true,
      normalMap = wood.normal,
      roughMap = wood.rough,
      aoMap = wood.ao
    ) => {
      material.diffuseMap = diffuseMap;
      material.diffuseMapTiling = tiling;
      material.normalMap = normalMap;
      material.normalMapTiling = tiling;
      material.bumpiness = bumpiness;
      material.glossMap = roughMap;
      material.glossMapChannel = "r";
      material.glossInvert = true;
      material.glossMapTiling = tiling;
      if (useAo) {
        material.aoMap = aoMap;
        material.aoMapChannel = "r";
        material.aoMapTiling = tiling;
        material.aoIntensity = aoIntensity;
      }
    };
    const bindLightmap = (material: pc.StandardMaterial) => {
      material.lightMap = wood.lightmap;
      material.lightMapUv = 1;
      material.lightMapChannel = "rgb";
      material.lightMapTiling = new pc.Vec2(1, 1);
      material.lightMapOffset = new pc.Vec2(0, 0);
    };

    const walnut = makeMaterial({
      name: "mat_walnut_outer_v6.runtime",
      diffuse: new pc.Color(0.52, 0.36, 0.24),
      gloss: 0.68,
      reflectivity: 0.28,
      clearCoat: 0.52,
      clearCoatGloss: 0.82
    });
    bindWood(walnut, wood.walnutDiff, new pc.Vec2(1.18, 1.18), 0.24, 0.006);
    bindLightmap(walnut);

    const warmInnerWall = makeMaterial({
      name: "mat_walnut_inner_wall_v6.runtime",
      diffuse: new pc.Color(0.58, 0.41, 0.27),
      gloss: 0.56,
      reflectivity: 0.22,
      clearCoat: 0.36,
      clearCoatGloss: 0.70
    });
    bindWood(warmInnerWall, wood.cherryDiff, new pc.Vec2(1.05, 1.05), 0.24, 0.003, true, wood.normal, wood.rough, wood.ao);
    bindLightmap(warmInnerWall);
    warmInnerWall.update();

    const warmSideWall = makeMaterial({
      name: "mat_walnut_side_wall_v6.runtime",
      diffuse: new pc.Color(0.51, 0.35, 0.22),
      gloss: 0.56,
      reflectivity: 0.22,
      clearCoat: 0.34,
      clearCoatGloss: 0.68
    });
    bindWood(warmSideWall, wood.sideDiff, new pc.Vec2(0.95, 1.18), 0.25, 0.002, true, wood.normal, wood.rough, wood.ao);
    bindLightmap(warmSideWall);
    warmSideWall.update();

    const warmRightSideWall = makeMaterial({
      name: "mat_walnut_right_side_wall_v6.runtime",
      diffuse: new pc.Color(0.54, 0.36, 0.16),
      emissive: new pc.Color(0.08, 0.045, 0.012),
      emissiveIntensity: 0.18,
      gloss: 0.58,
      reflectivity: 0.24,
      clearCoat: 0.36,
      clearCoatGloss: 0.72
    });
    bindWood(warmRightSideWall, wood.sideDiff, new pc.Vec2(0.95, 1.18), 0.24, 0.0, false, wood.normal, wood.rough, wood.ao);
    bindLightmap(warmRightSideWall);
    warmRightSideWall.update();

    const innerFloor = makeMaterial({
      name: "mat_walnut_floor_v6.runtime",
      diffuse: new pc.Color(0.56, 0.38, 0.25),
      metalness: 0.28,
      gloss: 0.82,
      reflectivity: 0.48,
      clearCoat: 0.68,
      clearCoatGloss: 0.92
    });
    bindWood(innerFloor, wood.floorDiff, new pc.Vec2(1.08, 0.78), 0.18, 0.002, true, wood.normal, wood.floorRough, wood.ao);
    bindLightmap(innerFloor);
    innerFloor.update();

    const shadowGroove = makeMaterial({
      name: "mat_shadow_groove.runtime",
      diffuse: new pc.Color(0.018, 0.006, 0.002),
      opacity: 0.18,
      gloss: 0,
      reflectivity: 0,
      twoSided: true
    });
    shadowGroove.useLighting = false;
    shadowGroove.opacityFadesSpecular = true;
    shadowGroove.update();

    const lacquer = makeMaterial({
      name: "mat_black_lacquer_trim.runtime",
      diffuse: new pc.Color(0.018, 0.014, 0.011),
      gloss: 0.86,
      reflectivity: 0.52,
      clearCoat: 0.84,
      clearCoatGloss: 0.92
    });

    const brass = makeMaterial({
      name: "mat_brass_trim.runtime",
      diffuse: new pc.Color(0.92, 0.62, 0.28),
      metalness: 1,
      gloss: 0.64,
      reflectivity: 0.72,
      clearCoat: 0.22,
      clearCoatGloss: 0.55
    });

    const diffuser = makeMaterial({
      name: "mat_light_diffuser.runtime",
      diffuse: new pc.Color(1.0, 0.82, 0.55),
      emissive: new pc.Color(1.0, 0.72, 0.36),
      emissiveIntensity: 0.82,
      gloss: 0.34,
      reflectivity: 0.08,
      twoSided: true
    });

    const glassEdge = makeMaterial({
      name: "mat_glass_edge.runtime",
      diffuse: new pc.Color(0.78, 0.96, 1.0),
      opacity: 0.24,
      gloss: 0.96,
      reflectivity: 0.42,
      clearCoat: 1,
      clearCoatGloss: 0.98,
      twoSided: true
    });

    const glassPane = makeMaterial({
      name: "mat_glass_pane.runtime",
      diffuse: new pc.Color(0.86, 0.97, 1.0),
      opacity: 0.018,
      gloss: 0.12,
      reflectivity: 0,
      clearCoat: 0,
      clearCoatGloss: 0,
      twoSided: true
    });
    glassPane.opacityFadesSpecular = true;
    glassPane.useLighting = false;

    const cardFrame = makeMaterial({
      name: "mat_card_frame.runtime",
      diffuse: new pc.Color(0.024, 0.019, 0.015),
      gloss: 0.82,
      reflectivity: 0.38,
      clearCoat: 0.78,
      clearCoatGloss: 0.9
    });

    const plaqueLcd = makeMaterial({
      name: "mat_plaque_lcd.runtime",
      diffuse: new pc.Color(0.006, 0.055, 0.038),
      emissive: new pc.Color(0.015, 0.36, 0.22),
      emissiveIntensity: 0.36,
      gloss: 0.84,
      reflectivity: 0.18,
      clearCoat: 0.84,
      clearCoatGloss: 0.94
    });

    const obsidian = makeMaterial({
      name: "mat_obsidian_plinth.runtime",
      diffuse: new pc.Color(0.014, 0.012, 0.01),
      gloss: 0.84,
      reflectivity: 0.52,
      clearCoat: 0.92,
      clearCoatGloss: 0.96
    });

    const legendary = makeMaterial({
      name: "mat_legendary_holo.runtime",
      diffuse: new pc.Color(0.88, 0.72, 1.0),
      opacity: 0.72,
      gloss: 0.92,
      reflectivity: 0.82,
      clearCoat: 1,
      clearCoatGloss: 0.98
    });
    legendary.useIridescence = true;
    legendary.iridescence = 0.78;
    legendary.iridescenceThicknessMin = 90;
    legendary.iridescenceThicknessMax = 640;
    legendary.iridescenceRefractionIndex = 1 / 1.42;
    legendary.emissive = new pc.Color(0.055, 0.04, 0.095);
    legendary.emissiveIntensity = 0.08;

    const gold = makeMaterial({
      name: "mat_gold_trophy.runtime",
      diffuse: new pc.Color(1.0, 0.66, 0.25),
      metalness: 1,
      gloss: 0.68,
      reflectivity: 0.78,
      clearCoat: 0.18,
      clearCoatGloss: 0.56
    });

    const silver = makeMaterial({
      name: "mat_silver_trophy.runtime",
      diffuse: new pc.Color(0.84, 0.9, 0.98),
      metalness: 1,
      gloss: 0.76,
      reflectivity: 0.82,
      clearCoat: 0.15,
      clearCoatGloss: 0.62
    });

    const blueCrystal = makeMaterial({
      name: "mat_blue_crystal.runtime",
      diffuse: new pc.Color(0.26, 0.82, 1.0),
      opacity: 0.7,
      gloss: 0.9,
      reflectivity: 0.72,
      clearCoat: 1,
      clearCoatGloss: 0.98
    });
    blueCrystal.refraction = 0.32;
    blueCrystal.refractionIndex = 1 / 1.46;
    blueCrystal.emissive = new pc.Color(0.02, 0.18, 0.28);
    blueCrystal.emissiveIntensity = 0.13;

    const softShadow = makeMaterial({
      name: "mat_soft_shadow.runtime",
      diffuse: new pc.Color(0, 0, 0),
      opacity: 0.18,
      gloss: 0,
      reflectivity: 0,
      twoSided: true
    });

    const map = {
      mat_walnut_outer: walnut,
      mat_warm_inner_wall: warmInnerWall,
      mat_warm_side_wall: warmSideWall,
      mat_warm_right_side_wall: warmRightSideWall,
      mat_inner_floor: innerFloor,
      mat_shadow_groove: shadowGroove,
      mat_black_lacquer_trim: lacquer,
      mat_brass_trim: brass,
      mat_light_diffuser: diffuser,
      mat_glass_edge: glassEdge,
      mat_glass_pane: glassPane,
      mat_card_frame: cardFrame,
      mat_plaque_lcd: plaqueLcd,
      mat_obsidian_plinth: obsidian,
      mat_legendary_holo: legendary,
      mat_gold_trophy: gold,
      mat_silver_trophy: silver,
      mat_blue_crystal: blueCrystal,
      mat_soft_shadow: softShadow
    };

    Object.values(map).forEach((material) => material.update());
    return map;
  }

  private applyCabinetMaterials(root: pc.Entity, materials: Record<string, pc.StandardMaterial>): void {
    Object.keys(materials).forEach((name) => {
      this.materialBindings[name] = false;
    });

    root.forEach((node) => {
      const entity = node as pc.Entity;
      if (!entity.render) return;
      entity.render.castShadows = true;
      entity.render.receiveShadows = true;
      entity.render.meshInstances.forEach((meshInstance) => {
        meshInstance.castShadow = true;
        meshInstance.receiveShadow = true;
        const sourceName = meshInstance.material?.name ?? "";
        const replacement = materials[sourceName];
        if (replacement) {
          meshInstance.material = replacement;
          this.materialBindings[sourceName] = true;
        }
        if (entity.name.includes(".right-panel") || entity.name === "outer-frame-right") {
          meshInstance.material = materials.mat_warm_right_side_wall;
          this.materialBindings.mat_warm_right_side_wall = true;
        } else if (entity.name.includes(".left-panel")) {
          meshInstance.material = materials.mat_warm_side_wall;
          this.materialBindings.mat_warm_side_wall = true;
        } else if (entity.name.includes(".back-panel") || entity.name.includes(".ceiling-panel")) {
          meshInstance.material = materials.mat_warm_inner_wall;
          this.materialBindings.mat_warm_inner_wall = true;
        } else if (entity.name.includes(".floor-panel")) {
          meshInstance.material = materials.mat_inner_floor;
          this.materialBindings.mat_inner_floor = true;
        }
      });
    });
  }

  private createHeroMediaTexture(sourceTexture: pc.Texture, project: GalleryProject): pc.Texture {
    const source = sourceTexture.getSource() as CanvasImageSource;
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(`Failed to create hero media canvas for ${project.id}`);
    drawHeroMediaSurface(ctx, project, source);

    const texture = makeCanvasTexture(this.app.graphicsDevice, `${project.id}.generated-hero-media`, canvas);
    this.generatedHeroMedia[project.id] = true;
    this.captureHeroColorProbe(project, source, ctx);
    return texture;
  }

  private drawMatrixPlaque(plaque: MatrixPlaqueRuntime, time: number): void {
    const { canvas, ctx, project, seed } = plaque;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motionTime = reducedMotion ? 0 : time;
    const pulse = reducedMotion ? 0.72 : 0.62 + Math.sin(motionTime * 2.15 + seed) * 0.12;
    const matrixGreen = "rgb(112, 255, 114)";
    const glyphs = "010110ROYALVICEAI3DMLLMTOGSIGGRAPH";

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#010604";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const vignette = ctx.createRadialGradient(130, 42, 12, 260, 72, 400);
    vignette.addColorStop(0, "rgba(52,255,112,0.20)");
    vignette.addColorStop(0.5, "rgba(12,75,34,0.10)");
    vignette.addColorStop(1, "rgba(0,0,0,0.62)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = "700 13px ui-monospace, SFMono-Regular, Menlo, monospace";
    for (let y = 30; y < canvas.height - 24; y += 24) {
      const speed = 18 + ((Math.floor(y) + seed) % 23);
      const offset = (motionTime * speed + seed * 9 + y * 1.7) % 180;
      for (let x = -120; x < canvas.width + 80; x += 18) {
        const px = x + offset;
        if (px < 14 || px > canvas.width - 14) continue;
        const glyph = glyphs[(Math.floor(px * 0.42 + y * 0.76 + seed) % glyphs.length + glyphs.length) % glyphs.length];
        const lane = Math.floor((px + y + seed) / 18) % 6;
        ctx.fillStyle = lane === 0
          ? "rgba(185,255,190,0.28)"
          : `rgba(62,255,98,${Math.max(0.035, 0.15 - lane * 0.014)})`;
        ctx.fillText(glyph, px, y);
      }
    }

    ctx.fillStyle = "rgba(0, 8, 3, 0.32)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(83,255,92,0.045)";
    for (let y = 4; y < canvas.height; y += 8) {
      ctx.fillRect(0, y, canvas.width, 1);
    }

    ctx.strokeStyle = `rgba(125, 255, 104, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    ctx.strokeStyle = "rgba(12, 96, 26, 0.62)";
    ctx.lineWidth = 1;
    ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

    ctx.fillStyle = `rgba(94, 255, 112, ${pulse + 0.12})`;
    ctx.fillRect(30, 30, 7, 252);
    ctx.fillStyle = "rgba(116,255,127,.72)";
    ctx.font = "700 18px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.letterSpacing = "2px";
    ctx.fillText("LIVE RESEARCH NODE", 56, 64);
    ctx.fillStyle = "rgba(152,255,137,0.95)";
    ctx.shadowColor = "rgba(85,255,96,0.62)";
    ctx.shadowBlur = 10;
    setFittedMonoFont(ctx, project.title.toUpperCase(), 900, 76, 40, canvas.width - 150);
    const glitch = !reducedMotion && Math.floor(motionTime * 7 + seed) % 41 === 0;
    if (glitch) {
      ctx.fillStyle = "rgba(190,255,197,.28)";
      ctx.fillText(project.title.toUpperCase(), 62, 150);
    }
    ctx.fillStyle = "rgba(152,255,137,0.96)";
    ctx.fillText(project.title.toUpperCase(), 54, 150);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(154, 255, 132, 0.88)";
    setFittedMonoFont(ctx, project.venue.toUpperCase(), 750, 34, 20, canvas.width - 150);
    ctx.fillText(project.venue.toUpperCase(), 56, 218);
    ctx.fillStyle = matrixGreen;
    ctx.font = "700 18px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(`SIGNAL ${String(seed % 100).padStart(2, "0")}  /  LINK STABLE`, 56, 270);
    const scanY = reducedMotion ? 314 : 292 + ((motionTime * 62 + seed) % 72);
    const scan = ctx.createLinearGradient(0, scanY - 10, 0, scanY + 10);
    scan.addColorStop(0, "rgba(70,255,91,0)");
    scan.addColorStop(.5, "rgba(105,255,121,.18)");
    scan.addColorStop(1, "rgba(70,255,91,0)");
    ctx.fillStyle = scan;
    ctx.fillRect(24, scanY - 10, canvas.width - 48, 20);
  }

  private createPlaqueTexture(project: GalleryProject, index: number): MatrixPlaqueRuntime {
    const canvas = document.createElement("canvas");
    canvas.width = 1180;
    canvas.height = 420;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(`Failed to create plaque canvas for ${project.id}`);
    const texture = makeCanvasTexture(this.app.graphicsDevice, `${project.id}.generated-plaque`, canvas);
    const plaque = { texture, canvas, ctx, project, seed: 17 + index * 41 + project.title.length * 13 };
    this.drawMatrixPlaque(plaque, 0);
    texture.setSource(canvas);
    return plaque;
  }

  private hideLegacyPlaqueGeometry(root: pc.Entity, index: number): void {
    [
      `slot-${index}.plaque-body`,
      `slot-${index}.plaque-screen`
    ].forEach((name) => {
      const entity = root.findByName(name);
      if (entity instanceof pc.Entity) {
        entity.enabled = false;
      }
    });
  }

  private configurePlaqueScreen(entity: pc.Entity): void {
    const position = entity.getLocalPosition().clone();
    const scale = entity.getLocalScale().clone();
    entity.setLocalScale(scale.x * 0.62, scale.y * 0.48, scale.z);
    entity.setLocalPosition(position.x - 0.16, position.y + 0.055, position.z + 0.002);
  }

  private createHeroBoard(anchor: pc.Entity, heroTexture: pc.Texture, project: GalleryProject): pc.StandardMaterial {
    const heroMaterial = makeMaterial({
      name: `${project.id}.hero-screen`,
      diffuse: new pc.Color(0.72, 0.72, 0.72),
      emissive: new pc.Color(0.82, 0.82, 0.82),
      emissiveIntensity: HERO_IMAGE_EMISSIVE,
      gloss: 0.46,
      reflectivity: 0.06,
      clearCoat: 0.42,
      clearCoatGloss: 0.72
    });
    heroMaterial.diffuseMap = heroTexture;
    heroMaterial.emissiveMap = heroTexture;
    heroMaterial.update();

    addVerticalQuad(anchor, this.app.graphicsDevice, `${project.id}-hero-screen`, heroMaterial, {
      position: [0, 0, 0.034],
      width: 1.68,
      height: 0.94,
      castShadows: false,
      receiveShadows: false
    });

    return heroMaterial;
  }

  private attachHeroVideo(project: GalleryProject, heroMaterial: pc.StandardMaterial): void {
    if (!project.heroVideo) return;

    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(`Failed to create video hero media canvas for ${project.id}`);

    const video = document.createElement("video");
    video.src = project.heroVideo;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    const texture = new pc.Texture(this.app.graphicsDevice, {
      name: `${project.id}.hero-video-card`,
      width: canvas.width,
      height: canvas.height,
      format: pc.PIXELFORMAT_RGBA8,
      mipmaps: true
    });
    texture.minFilter = pc.FILTER_LINEAR;
    texture.magFilter = pc.FILTER_LINEAR;
    texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
    texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

    const runtime: HeroVideoRuntime = {
      projectId: project.id,
      url: project.heroVideo,
      texture,
      canvas,
      ctx,
      project,
      video,
      ready: false,
      failed: false,
      lastUploadedMediaTime: -1
    };
    this.heroVideos.push(runtime);
    this.heroVideoStates[project.id] = { url: project.heroVideo, ready: false, failed: false };

    const activate = () => {
      if (runtime.ready || runtime.failed || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      drawHeroMediaSurface(ctx, project, video);
      texture.setSource(canvas);
      runtime.lastUploadedMediaTime = video.currentTime;
      heroMaterial.diffuseMap = texture;
      heroMaterial.emissiveMap = texture;
      heroMaterial.emissiveIntensity = HERO_VIDEO_EMISSIVE;
      heroMaterial.update();
      this.captureHeroColorProbe(project, video, ctx);
      runtime.ready = true;
      this.heroVideoStates[project.id] = { url: project.heroVideo ?? "", ready: true, failed: false };
      video.play().catch(() => {
        // Muted autoplay should work; if the browser still blocks it, the texture
        // keeps the loaded poster frame and resumes once user interaction happens.
      });
    };

    video.addEventListener("loadeddata", activate, { once: true });
    video.addEventListener("canplay", activate, { once: true });
    video.addEventListener("error", () => {
      runtime.failed = true;
      this.heroVideoStates[project.id] = { url: project.heroVideo ?? "", ready: false, failed: true };
    }, { once: true });
    video.load();
  }

  private applyPlaqueTexture(entity: pc.Entity, project: GalleryProject): pc.StandardMaterial {
    const plaque = this.createPlaqueTexture(project, this.matrixPlaques.length);
    this.matrixPlaques.push(plaque);
    const material = makeMaterial({
      name: `${project.id}.plaque-screen`,
      diffuse: new pc.Color(0.78, 1.0, 0.82),
      emissive: new pc.Color(0.015, 0.18, 0.09),
      emissiveIntensity: 0.09,
      gloss: 0.32,
      reflectivity: 0.06,
      clearCoat: 0.18,
      clearCoatGloss: 0.48
    });
    material.diffuseMap = plaque.texture;
    material.emissiveMap = plaque.texture;
    material.update();

    entity.render?.meshInstances.forEach((meshInstance) => {
      meshInstance.material = material;
      meshInstance.castShadow = false;
      meshInstance.receiveShadow = false;
    });
    return material;
  }

  private createTopLight(lightAnchor: pc.Entity, targetAnchor: pc.Entity, index: number): pc.Entity {
    const light = new pc.Entity(`slot-${index}-warm-rect-top-light`);
    light.addComponent("light", {
      type: "spot",
      shape: pc.LIGHTSHAPE_RECT,
      color: new pc.Color(1.0, 0.91, 0.76),
      intensity: 4.62,
      range: 4.12,
      innerConeAngle: 36,
      outerConeAngle: 76,
      falloffMode: pc.LIGHTFALLOFF_LINEAR,
      castShadows: true,
      shadowType: pc.SHADOW_PCF5,
      shadowResolution: 2048,
      shadowBias: 0.009,
      normalOffsetBias: 0.014
    });
    light.setLocalScale(0.7, 0.24, 1);
    lightAnchor.addChild(light);
    light.setLocalPosition(0, -0.015, 0.026);
    const target = targetAnchor.getPosition().clone();
    target.y += (TROPHY_SCALES[index] ?? TROPHY_SCALES[0]) * 0.44;
    target.z -= 0.04;
    light.lookAt(target);
    light.rotateLocal(90, 0, 0);
    return light;
  }

  private cloneSlotDiffuserMaterial(entity: pc.Entity, index: number): pc.StandardMaterial {
    const source = entity.render?.meshInstances[0]?.material as pc.StandardMaterial | undefined;
    if (!source) {
      return makeMaterial({
        name: `slot-${index}.light-diffuser.fallback`,
        diffuse: new pc.Color(1.0, 0.82, 0.55),
        emissive: new pc.Color(1.0, 0.72, 0.36),
        emissiveIntensity: 0.82,
        twoSided: true
      });
    }
    const material = source.clone();
    material.name = `slot-${index}.light-diffuser.runtime`;
    material.emissiveIntensity = 0.82;
    material.update();
    entity.render?.meshInstances.forEach((meshInstance) => {
      meshInstance.material = material;
      meshInstance.castShadow = false;
    });
    return material;
  }

  private createSlotFillLight(slotRoot: pc.Entity, _heroAnchor: pc.Entity, index: number): pc.Entity {
    const fill = new pc.Entity(`slot-${index}-soft-fill-light`);
    fill.addComponent("light", {
      type: "spot",
      shape: pc.LIGHTSHAPE_RECT,
      color: new pc.Color(1.0, 0.90, 0.76),
      intensity: 1.55,
      range: 3.95,
      innerConeAngle: 48,
      outerConeAngle: 92,
      falloffMode: pc.LIGHTFALLOFF_LINEAR,
      castShadows: false,
      affectSpecularity: false
    });
    fill.setLocalScale(0.62, 0.42, 1);
    slotRoot.addChild(fill);
    fill.setLocalPosition(-0.58, -0.08, 0.60);
    const target = slotRoot.getPosition().clone();
    target.x += 0.12;
    target.y -= 0.58;
    target.z -= 0.18;
    fill.lookAt(target);
    fill.rotateLocal(90, 0, 0);
    return fill;
  }

  private createSideFillLight(slotRoot: pc.Entity, _heroAnchor: pc.Entity, index: number): pc.Entity {
    const fill = new pc.Entity(`slot-${index}-right-wall-fill-light`);
    fill.addComponent("light", {
      type: "spot",
      color: new pc.Color(0.96, 0.84, 0.68),
      intensity: 0.82,
      range: 4.20,
      innerConeAngle: 62,
      outerConeAngle: 112,
      falloffMode: pc.LIGHTFALLOFF_LINEAR,
      castShadows: false,
      affectSpecularity: false
    });
    slotRoot.addChild(fill);
    fill.setLocalPosition(0.86, -0.02, 0.52);
    const target = slotRoot.getPosition().clone();
    target.x += 0.36;
    target.y -= 0.46;
    target.z -= 0.12;
    fill.lookAt(target);
    fill.rotateLocal(90, 0, 0);
    return fill;
  }

  private createHeroBackLight(heroAnchor: pc.Entity, index: number): pc.Entity {
    const heroLight = new pc.Entity(`slot-${index}-hero-screen-bounce`);
    heroLight.addComponent("light", {
      type: "omni",
      color: new pc.Color(0.48, 0.54, 0.66),
      intensity: 0.30,
      range: 0.98,
      castShadows: false,
      affectSpecularity: false
    });
    heroAnchor.addChild(heroLight);
    heroLight.setLocalPosition(0.0, -0.045, -0.08);
    return heroLight;
  }

  private createRimLight(anchor: pc.Entity, project: GalleryProject): pc.Entity {
    const rim = new pc.Entity(`${project.id}-trophy-rim-light`);
    rim.addComponent("light", {
      type: "omni",
      color: tierColors[project.trophyTier],
      intensity: 0.44,
      range: 1.05,
      castShadows: false,
      affectSpecularity: true
    });
    anchor.addChild(rim);
    rim.setLocalPosition(0, 0, 0.015);
    return rim;
  }

  private createTrophySpotlight(slotRoot: pc.Entity, trophy: pc.Entity, index: number): pc.Entity {
    const spotlight = new pc.Entity(`slot-${index}-trophy-spotlight`);
    spotlight.addComponent("light", {
      type: "spot",
      color: new pc.Color(1.0, 0.90, 0.70),
      intensity: 0,
      range: 2.75,
      innerConeAngle: 16,
      outerConeAngle: 32,
      falloffMode: pc.LIGHTFALLOFF_LINEAR,
      castShadows: false,
      shadowType: pc.SHADOW_PCF5,
      shadowResolution: 512,
      shadowBias: 0.008,
      normalOffsetBias: 0.012,
      affectSpecularity: true
    });
    slotRoot.addChild(spotlight);
    spotlight.setLocalPosition(0.08, 0.76, 0.94);
    const target = trophy.getPosition().clone();
    target.y += (TROPHY_SCALES[index] ?? TROPHY_SCALES[0]) * 0.46;
    target.z -= 0.02;
    spotlight.lookAt(target);
    spotlight.rotateLocal(90, 0, 0);
    spotlight.enabled = false;
    return spotlight;
  }

  private bindOverlayEvents(): void {
    const cards = [...this.root.querySelectorAll<HTMLElement>(".gallery-ui-card")];
    cards.forEach((card) => {
      const index = Number(card.dataset.index ?? 0);
      card.addEventListener("pointerenter", () => {
        this.beginSpotlightFocus(index);
        this.root.dispatchEvent(new CustomEvent("gallery:user-control", { detail: { index, source: "pointer" } }));
      });
      card.addEventListener("pointerleave", () => {
        if (this.hoverIndex === index) this.hoverIndex = null;
        this.updateCardState();
      });
      card.addEventListener("focus", () => {
        this.beginSpotlightFocus(index);
        this.root.dispatchEvent(new CustomEvent("gallery:user-control", { detail: { index, source: "keyboard" } }));
      });
      card.addEventListener("blur", () => {
        if (this.hoverIndex === index) this.hoverIndex = null;
        this.updateCardState();
      });
      card.addEventListener("click", (event) => {
        if ((event.target as HTMLElement).closest("a")) return;
        this.activeIndex = index;
        this.scheduleGeneratedTrophyLoading(index);
        this.root.dispatchEvent(new CustomEvent("gallery:user-control", { detail: { index, source: "click" } }));
        this.updateCardState();
      });
      card.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          this.activeIndex = -1;
          this.updateCardState();
          return;
        }
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -2 : 2;
          const next = (index + delta + cards.length) % cards.length;
          cards[next]?.focus();
          this.hoverIndex = next;
          this.updateCardState();
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.activeIndex = index;
          this.scheduleGeneratedTrophyLoading(index);
          this.updateCardState();
        }
      });
    });

  }

  private beginSpotlightFocus(index: number): void {
    this.hoverIndex = index;
    this.scheduleGeneratedTrophyLoading(index);
    const slot = this.slots[index];
    if (slot?.trophySpotlight.light) {
      slot.spotlightWeight = Math.max(slot.spotlightWeight, 0.42);
      slot.trophySpotlight.enabled = true;
      slot.trophySpotlight.light.castShadows = false;
      const maxIntensity = TROPHY_SPOTLIGHT_INTENSITIES[index] ?? TROPHY_SPOTLIGHT_INTENSITIES[0];
      slot.trophySpotlight.light.intensity = maxIntensity * slot.spotlightWeight;
      this.spotlightSceneWeight = Math.max(this.spotlightSceneWeight, 0.22);
    }
    this.updateCardState();
    this.app.renderNextFrame = true;
  }

  private updateCardState(): void {
    this.root.querySelectorAll<HTMLElement>(".gallery-ui-card").forEach((card) => {
      const index = Number(card.dataset.index ?? 0);
      card.classList.toggle("is-active", index === this.activeIndex);
      card.classList.toggle("is-hovered", index === this.hoverIndex);
    });
  }

  private update(dt: number): void {
    if (this.paused) return;
    this.time += dt;
    this.plaqueUpdateAccumulator += dt;
    this.videoUpdateAccumulator += dt;
    if (this.colorProbeEnabled) this.colorProbeAccumulator += dt;
    this.lightingAccumulator += dt;
    this.frameSamples.push(dt);
    if (this.frameSamples.length > 60) this.frameSamples.shift();
    let needsRender = false;

    if (this.plaqueUpdateAccumulator > 0.075) {
      this.plaqueUpdateAccumulator = 0;
      for (const plaque of this.matrixPlaques) {
        this.drawMatrixPlaque(plaque, this.time);
        plaque.texture.setSource(plaque.canvas);
      }
      needsRender = true;
    }

    const shouldUpdateVideo = this.videoUpdateAccumulator > 1 / 24;
    const shouldProbeColor = this.colorProbeEnabled && this.colorProbeAccumulator > 1.5;
    if (shouldUpdateVideo) this.videoUpdateAccumulator = 0;
    if (shouldProbeColor) this.colorProbeAccumulator = 0;

    for (const heroVideo of this.heroVideos) {
      if (heroVideo.ready && !heroVideo.failed && heroVideo.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const mediaTime = heroVideo.video.currentTime;
        if (shouldUpdateVideo && Math.abs(mediaTime - heroVideo.lastUploadedMediaTime) > 0.0001) {
          drawHeroMediaSurface(heroVideo.ctx, heroVideo.project, heroVideo.video);
          heroVideo.texture.setSource(heroVideo.canvas);
          heroVideo.lastUploadedMediaTime = mediaTime;
          needsRender = true;
        }
        if (shouldProbeColor) {
          this.captureHeroColorProbe(heroVideo.project, heroVideo.video, heroVideo.ctx);
        }
      }
    }

    const hasActiveLighting = this.hoverIndex !== null
      || this.spotlightSceneWeight > 0.001
      || this.slots.some((slot) => slot.spotlightWeight > 0.001);
    if (hasActiveLighting && this.lightingAccumulator >= 1 / 30) {
      const lightingDt = Math.min(0.15, Math.max(0, this.lightingAccumulator));
      this.lightingAccumulator = 0;
      this.applySpotlightLighting(lightingDt);
      needsRender = true;
    }
    if (needsRender) this.app.renderNextFrame = true;
  }

  private captureHeroColorProbe(project: GalleryProject, source: CanvasImageSource, ctx: CanvasRenderingContext2D): void {
    if (!this.colorProbeEnabled) return;
    const sourceMean = sampleImageMean(source, ctx.canvas.width, ctx.canvas.height);
    const renderedMean = sampleCanvasMean(ctx, 0, 0, ctx.canvas.width, ctx.canvas.height);
    this.heroColorProbe[project.id] = {
      sourceMean,
      renderedMean,
      delta: colorDelta(sourceMean, renderedMean)
    };
  }

  private applySpotlightLighting(lightingDt: number, force = false): void {
    const hasSpotlightFocus = this.hoverIndex !== null;
    let maxSpotlightWeight = 0;
    for (const slot of this.slots) {
      const userFocusedTrophy = slot.index === this.hoverIndex;
      const isFocusedTrophy = userFocusedTrophy;
      const focusTarget = userFocusedTrophy ? 1 : 0;
      const focusRate = isFocusedTrophy ? 3.2 : hasSpotlightFocus ? 9 : 4.2;
      const focusAlpha = 1 - Math.exp(-lightingDt * focusRate);
      slot.spotlightWeight = pc.math.lerp(slot.spotlightWeight, focusTarget, focusAlpha);
      slot.activeWeight = slot.spotlightWeight;
      maxSpotlightWeight = Math.max(maxSpotlightWeight, slot.spotlightWeight);
    }

    const sceneFocusTarget = hasSpotlightFocus ? 1 : maxSpotlightWeight;
    const sceneFocusRate = hasSpotlightFocus ? 2.1 : 5;
    const sceneFocusAlpha = 1 - Math.exp(-lightingDt * sceneFocusRate);
    this.spotlightSceneWeight = pc.math.lerp(this.spotlightSceneWeight, sceneFocusTarget, sceneFocusAlpha);
    if (!hasSpotlightFocus) {
      this.slots.forEach((slot) => {
        if (slot.spotlightWeight < 0.002) slot.spotlightWeight = 0;
      });
      if (this.spotlightSceneWeight < 0.002) this.spotlightSceneWeight = 0;
      maxSpotlightWeight = Math.max(...this.slots.map((slot) => slot.spotlightWeight), 0);
    }
    const hasVisibleLightingTransition = hasSpotlightFocus || maxSpotlightWeight > 0 || this.spotlightSceneWeight > 0;
    if (!force && !hasVisibleLightingTransition) return;
    const appliedSceneWeight = hasSpotlightFocus
      ? this.spotlightSceneWeight
      : Math.max(this.spotlightSceneWeight, maxSpotlightWeight * 0.94);

    for (const slot of this.slots) {
      const isFocusedTrophy = slot.index === this.hoverIndex;

      const cabinetLightMultiplier = pc.math.lerp(1, 0.085, appliedSceneWeight);
      if (slot.topLight.light) {
        slot.topLight.light.intensity = 4.62 * cabinetLightMultiplier;
      }
      if (slot.fillLight.light) {
        slot.fillLight.light.intensity = 1.55 * cabinetLightMultiplier;
      }
      if (slot.sideFillLight.light) {
        slot.sideFillLight.light.intensity = 0.82 * cabinetLightMultiplier;
      }
      if (slot.heroLight.light) {
        slot.heroLight.light.intensity = 0.30 * pc.math.lerp(1, 0.18, appliedSceneWeight);
      }
      if (slot.rimLight.light) {
        slot.rimLight.light.intensity = 0.44 * cabinetLightMultiplier;
      }
      if (slot.trophySpotlight.light) {
        if (slot.spotlightWeight > 0.002 && !slot.trophySpotlight.enabled) {
          slot.trophySpotlight.enabled = true;
        }
        slot.trophySpotlight.light.castShadows = false;
        const spotlightIntensity = TROPHY_SPOTLIGHT_INTENSITIES[slot.index] ?? TROPHY_SPOTLIGHT_INTENSITIES[0];
        slot.trophySpotlight.light.intensity = spotlightIntensity * slot.spotlightWeight;
        if (!isFocusedTrophy && slot.spotlightWeight < 0.006) {
          slot.trophySpotlight.light.intensity = 0;
          slot.trophySpotlight.enabled = false;
        }
      }
      const diffuserIntensity = 0.82 * pc.math.lerp(1, 0.012, appliedSceneWeight);
      if (Math.abs(slot.diffuserMaterial.emissiveIntensity - diffuserIntensity) > 0.0005) {
        slot.diffuserMaterial.emissiveIntensity = diffuserIntensity;
        slot.diffuserMaterial.update();
      }
      const mediaDim = pc.math.lerp(1, 0.34, appliedSceneWeight);
      const heroIntensity = (slot.project.heroVideo ? HERO_VIDEO_EMISSIVE : HERO_IMAGE_EMISSIVE) * mediaDim;
      if (Math.abs(slot.heroMaterial.emissiveIntensity - heroIntensity) > 0.0005) {
        slot.heroMaterial.emissiveIntensity = heroIntensity;
        slot.heroMaterial.update();
      }
      const plaqueIntensity = 0.16 * pc.math.lerp(1, 0.28, appliedSceneWeight);
      if (Math.abs(slot.plaqueMaterial.emissiveIntensity - plaqueIntensity) > 0.0005) {
        slot.plaqueMaterial.emissiveIntensity = plaqueIntensity;
        slot.plaqueMaterial.update();
      }
      slot.trophy.setLocalEulerAngles(0, Math.sin(this.time * 0.72 + slot.index) * 1.15 * slot.spotlightWeight, 0);
    }
  }

  private installDebugHook(): void {
    window.__galleryDebug = () => {
      const stats = (this.app as unknown as { stats?: Record<string, any> }).stats ?? {};
      const averageDt = this.frameSamples.length
        ? this.frameSamples.reduce((sum, value) => sum + value, 0) / this.frameSamples.length
        : 0;
      return {
        cabinetVersion: CABINET_VERSION,
        cabinetLoaded: !!this.cabinetRoot,
        anchorsFound: this.anchorsFound,
        envAtlas: this.envAtlasReady,
        lightmapReady: this.lightmapReady,
        woodCandidate: this.woodCandidate,
        materialSystem: "unified-walnut-v6",
        materialBindings: this.materialBindings,
        generatedHeroMedia: this.generatedHeroMedia,
        heroColorProbe: this.heroColorProbe,
        heroVideos: this.heroVideoStates,
        trophyMeshes: this.trophyMeshes,
        generatedTrophyModels: this.generatedTrophyModels,
        generatedTrophySources: this.generatedTrophySources,
        generatedTrophyInteractionStarted: this.generatedTrophyInteractionStarted,
        profileCompanionReady: this.profileCompanionReady,
        generatedTrophyQueue: this.generatedTrophyQueue.map((index) => this.projects[index]?.id ?? String(index)),
        generatedTrophyLoading: this.generatedTrophyLoadingIndex === null ? null : this.projects[this.generatedTrophyLoadingIndex]?.id ?? null,
        staticCabinetBatch: {
          groupId: this.staticCabinetBatchGroupId,
          sourceMeshes: this.staticCabinetBatchSourceMeshes,
          batches: this.staticCabinetBatchCount
        },
        canvasCount: document.querySelectorAll("canvas").length,
        webglContexts: window.__webglContexts ?? null,
        drawCalls: stats.drawCalls?.total ?? stats.drawCalls?.forward ?? null,
        triangles: stats.frame?.triangles ?? stats.frame?.trianglesDrawn ?? null,
        fpsEstimate: averageDt > 0 ? Math.round(1 / averageDt) : null,
        activeProject: this.projects[this.activeIndex]?.id ?? null,
        hoverProject: this.hoverIndex === null ? null : this.projects[this.hoverIndex]?.id ?? null,
        spotlightSceneWeight: this.spotlightSceneWeight,
        slots: this.slots.map((slot) => {
          const localPosition = slot.trophy.getLocalPosition();
          const worldPosition = slot.trophy.getPosition();
          const localScale = slot.trophy.getLocalScale();
          return {
            id: slot.project.id,
            trophyLocalPosition: [localPosition.x, localPosition.y, localPosition.z],
            trophyWorldPosition: [worldPosition.x, worldPosition.y, worldPosition.z],
            trophyScale: [localScale.x, localScale.y, localScale.z],
            spotlightWeight: slot.spotlightWeight,
            spotlightEnabled: slot.trophySpotlight.enabled,
            spotlightCastsShadows: slot.trophySpotlight.light?.castShadows ?? false,
            spotlightIntensity: slot.trophySpotlight.light?.intensity ?? null,
            topLightIntensity: slot.topLight.light?.intensity ?? null,
            fillLightIntensity: slot.fillLight.light?.intensity ?? null,
            sideFillIntensity: slot.sideFillLight.light?.intensity ?? null,
            heroLightIntensity: slot.heroLight.light?.intensity ?? null,
            rimLightIntensity: slot.rimLight.light?.intensity ?? null,
            diffuserEmissiveIntensity: slot.diffuserMaterial.emissiveIntensity
          };
        }),
        visibleMode: this.isMobile ? "mobile-focus" : "desktop-2x2",
        lighting: {
          exposure: this.app.scene.exposure,
          skyboxIntensity: this.app.scene.skyboxIntensity,
          ambientLight: [
            this.app.scene.ambientLight.r,
            this.app.scene.ambientLight.g,
            this.app.scene.ambientLight.b
          ],
          topLight: this.slots[0]?.topLight.light?.intensity ?? null,
          fillLight: this.slots[0]?.fillLight.light?.intensity ?? null,
          sideWallWash: this.slots[0]?.sideFillLight.light?.intensity ?? null
        },
        source: "wooden-gallery-cabinet-v6.glb"
      };
    };
  }

  private async loadGalleryAssets(): Promise<GalleryAssets> {
    const heroUrls = this.projects.slice(0, 4).map((project) => project.heroTexture);
    const [
      cabinet,
      studioHdr,
      areaLuts,
      diff,
      walnutDiff,
      cherryDiff,
      sideDiff,
      floorDiff,
      normal,
      rough,
      floorRough,
      ao,
      lightmap,
      ...heroes
    ] = await Promise.all([
      this.loadContainer(CABINET_MODEL_URL),
      this.loadTexture(STUDIO_HDR_URL, false),
      this.loadJson<AreaLightLuts>(AREA_LUTS_URL),
      this.loadTexture(`${WALNUT_V6_DIR}/walnut_wall_basecolor_v6.jpg?v=${ASSET_VERSION}`, true),
      this.loadTexture(`${WALNUT_V6_DIR}/walnut_frame_basecolor_v6.jpg?v=${ASSET_VERSION}`, true),
      this.loadTexture(`${WALNUT_V6_DIR}/walnut_wall_basecolor_v6.jpg?v=${ASSET_VERSION}`, true),
      this.loadTexture(`${WALNUT_V6_DIR}/walnut_side_basecolor_v6.jpg?v=${ASSET_VERSION}`, true),
      this.loadTexture(`${WALNUT_V6_DIR}/walnut_floor_basecolor_v6.jpg?v=${ASSET_VERSION}`, true),
      this.loadTexture(`${WALNUT_V6_DIR}/walnut_normal_v6.jpg?v=${ASSET_VERSION}`, true),
      this.loadTexture(`${WALNUT_V6_DIR}/walnut_roughness_v6.jpg?v=${ASSET_VERSION}`, true),
      this.loadTexture(`${WALNUT_V6_DIR}/walnut_floor_roughness_v6.jpg?v=${ASSET_VERSION}`, true),
      this.loadTexture(`${WALNUT_V6_DIR}/walnut_ao_v6.jpg?v=${ASSET_VERSION}`, true),
      this.loadTexture(CABINET_LIGHTMAP_URL, false),
      ...heroUrls.map((url) => this.loadTexture(url, false))
    ]);
    this.lightmapReady = !!lightmap;

    return {
      cabinet,
      studioHdr,
      areaLuts,
      wood: { diff, walnutDiff, cherryDiff, sideDiff, floorDiff, normal, rough, floorRough, ao, lightmap },
      heroes
    };
  }

  private loadContainer(url: string, timeoutMs?: number): Promise<pc.ContainerResource> {
    const load = new Promise<pc.ContainerResource>((resolve, reject) => {
      this.app.assets.loadFromUrl(url, "container", (error, asset) => {
        if (error || !asset?.resource) {
          reject(error ?? new Error(`Failed to load container: ${url}`));
          return;
        }
        resolve(asset.resource as pc.ContainerResource);
      });
    });
    if (!timeoutMs) return load;

    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error(`Timed out after ${timeoutMs}ms loading optional container: ${url}`));
      }, timeoutMs);
      load.then(
        (resource) => {
          window.clearTimeout(timer);
          resolve(resource);
        },
        (error) => {
          window.clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  private loadTexture(url: string, repeat: boolean): Promise<pc.Texture> {
    return new Promise((resolve, reject) => {
      this.app.assets.loadFromUrl(url, "texture", (error, asset) => {
        if (error || !asset?.resource) {
          reject(error ?? new Error(`Failed to load texture: ${url}`));
          return;
        }
        resolve(setTextureSampling(asset.resource as pc.Texture, repeat));
      });
    });
  }

  private loadJson<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      this.app.assets.loadFromUrl(url, "json", (error, asset) => {
        if (error || !asset?.resource) {
          reject(error ?? new Error(`Failed to load json: ${url}`));
          return;
        }
        resolve(asset.resource as T);
      });
    });
  }

  private resize(): void {
    const rect = this.root.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width));
    const height = Math.max(300, Math.round(rect.height));
    this.isMobile = window.innerWidth < 760 || width < 460;
    const scale = Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.05 : 1.25);
    this.app.graphicsDevice.maxPixelRatio = scale;
    this.app.resizeCanvas(width, height);
    this.applyResponsiveLayout(width / height);
  }

  private applyResponsiveLayout(aspect: number): void {
    if (!this.camera?.camera) return;
    const shell = this.root.querySelector<HTMLElement>(".playcanvas-gallery");
    shell?.classList.toggle("is-mobile-gallery", this.isMobile);

    const target = new pc.Vec3(0, 0.02, 0);
    const targetWidth = CABINET_WIDTH;
    const targetHeight = CABINET_HEIGHT;
    const cameraZ = this.isMobile ? MOBILE_CAMERA_Z : DESKTOP_CAMERA_Z;
    const overscan = this.isMobile ? MOBILE_OVERSCAN : DESKTOP_OVERSCAN;
    const halfHeightFromWidth = targetWidth / Math.max(aspect, 0.2) * 0.5;
    const halfHeight = Math.max(targetHeight * 0.5, halfHeightFromWidth) * overscan;
    const visibleWidth = halfHeight * 2 * Math.max(aspect, 0.2);
    const visibleHeight = halfHeight * 2;
    const insetX = Math.max(0, (1 - targetWidth / visibleWidth) * 50);
    const insetY = Math.max(0, (1 - targetHeight / visibleHeight) * 50);
    shell?.style.setProperty("--gallery-cabinet-inset-x", `${insetX.toFixed(3)}%`);
    shell?.style.setProperty("--gallery-cabinet-inset-y", `${insetY.toFixed(3)}%`);
    const distanceToFront = cameraZ - CABINET_FRONT_Z;
    this.camera.camera.fov = pc.math.RAD_TO_DEG * 2 * Math.atan(halfHeight / distanceToFront);
    this.camera.setPosition(target.x, target.y + (this.isMobile ? 0.02 : 0.08), cameraZ);
    this.camera.lookAt(target.x, target.y, target.z);
  }
}
