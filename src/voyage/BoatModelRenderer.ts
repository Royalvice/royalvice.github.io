import * as pc from "playcanvas";
import type { QualityTier } from "../content/site";
import type { SceneRenderer } from "../scenes/SceneRenderer";

type BoatPreset = "sunset" | "horizon";

const BOAT_MODEL_URL = "/assets/voyage/models/research-boat-v1.glb?v=20260712-trellis2-1024-v1";
const STUDIO_HDR_URL = "/assets/gallery/materials/studio_small_08_1k.hdr";

export class BoatModelRenderer implements SceneRenderer {
  private readonly app: pc.Application;
  private readonly host: HTMLElement | null;
  private camera: pc.Entity | null = null;
  private model: pc.Entity | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private quality: QualityTier = "balanced";
  private running = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly preset: BoatPreset) {
    this.host = canvas.closest<HTMLElement>(".research-boat");
    this.canvas.style.backgroundColor = "transparent";
    this.app = new pc.Application(canvas, {
      graphicsDeviceOptions: {
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
        preserveDrawingBuffer: false
      }
    });
  }

  async init(): Promise<void> {
    this.configureScene();
    this.app.start();
    this.app.autoRender = false;

    // The model is the critical visual. Do not hold its first frame behind the
    // much larger HDR environment download; directional/ambient lighting is
    // already configured and gives a valid initial render.
    const boat = await this.loadContainer(BOAT_MODEL_URL);
    this.installModel(boat);
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    if (this.host) this.resizeObserver.observe(this.host);
    this.start();

    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    this.host?.classList.remove("is-model-loading", "is-model-fallback");
    this.host?.classList.add("is-model-ready");
    void this.loadTexture(STUDIO_HDR_URL).then((studioHdr) => {
      this.applyEnvironment(studioHdr);
      if (this.running) this.app.renderNextFrame = true;
    }).catch((error) => console.warn("Boat environment texture fallback active", error));
  }

  start(): void {
    this.running = true;
    this.app.autoRender = false;
    this.app.renderNextFrame = true;
  }

  pause(): void {
    this.running = false;
    this.app.autoRender = false;
  }

  resume(): void {
    this.running = true;
    this.app.renderNextFrame = true;
  }

  resize(): void {
    const rect = this.host?.getBoundingClientRect() ?? this.canvas.getBoundingClientRect();
    const width = Math.max(96, Math.round(rect.width));
    const height = Math.max(72, Math.round(rect.height));
    this.app.graphicsDevice.maxPixelRatio = this.quality === "high" ? 1.75 : this.quality === "balanced" ? 1.35 : 1;
    this.app.resizeCanvas(width, height);
    if (this.camera?.camera) {
      const aspect = width / Math.max(height, 1);
      this.camera.camera.orthoHeight = (this.preset === "horizon" ? 0.60 : 0.57) * Math.max(1, 1.22 / aspect);
    }
    if (this.running) this.app.renderNextFrame = true;
  }

  setQuality(tier: QualityTier): void {
    this.quality = tier;
    this.resize();
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.host?.classList.remove("is-model-ready");
    this.model = null;
    this.camera = null;
    this.app.destroy();
  }

  private configureScene(): void {
    this.app.setCanvasFillMode(pc.FILLMODE_NONE);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.app.scene.ambientLight = this.preset === "horizon"
      ? new pc.Color(0.16, 0.20, 0.34)
      : new pc.Color(0.34, 0.25, 0.16);
    this.app.scene.exposure = this.preset === "horizon" ? 1.08 : 1.16;
    this.app.scene.skybox = null;

    const camera = new pc.Entity(`${this.preset}-research-boat-camera`);
    camera.addComponent("camera", {
      projection: pc.PROJECTION_ORTHOGRAPHIC,
      orthoHeight: this.preset === "horizon" ? 0.60 : 0.57,
      clearColor: new pc.Color(0, 0, 0, 0),
      nearClip: 0.05,
      farClip: 20,
      toneMapping: pc.TONEMAP_ACES2,
      gammaCorrection: pc.GAMMA_SRGB
    });
    camera.setPosition(1.35, 0.72, 1.55);
    camera.lookAt(0, -0.015, 0);
    this.app.root.addChild(camera);
    this.camera = camera;
    if (camera.camera) {
      camera.camera.clearColor = new pc.Color(0, 0, 0, 0);
      camera.camera.clearColorBuffer = true;
    }

    const key = new pc.Entity(`${this.preset}-boat-key-light`);
    key.addComponent("light", {
      type: "directional",
      color: this.preset === "horizon" ? new pc.Color(0.46, 0.56, 0.95) : new pc.Color(1.0, 0.72, 0.37),
      intensity: this.preset === "horizon" ? 1.35 : 1.7,
      castShadows: false
    });
    key.setLocalEulerAngles(42, 136, 0);
    this.app.root.addChild(key);

    const fill = new pc.Entity(`${this.preset}-boat-fill-light`);
    fill.addComponent("light", {
      type: "directional",
      color: this.preset === "horizon" ? new pc.Color(0.20, 0.48, 0.56) : new pc.Color(0.22, 0.44, 0.52),
      intensity: this.preset === "horizon" ? 0.56 : 0.38,
      castShadows: false
    });
    fill.setLocalEulerAngles(-28, -42, 0);
    this.app.root.addChild(fill);
  }

  private applyEnvironment(studioHdr: pc.Texture): void {
    const lightingSource = pc.EnvLighting.generateLightingSource(studioHdr, { size: 64 });
    this.app.scene.envAtlas = pc.EnvLighting.generateAtlas(lightingSource, {
      size: 128,
      numReflectionSamples: 128,
      numAmbientSamples: 128
    });
    this.app.scene.ambientSource = pc.AMBIENTSRC_ENVALATLAS;
    this.app.scene.skybox = null;
    const skyboxLayer = this.app.scene.layers.getLayerById(pc.LAYERID_SKYBOX);
    if (skyboxLayer) skyboxLayer.enabled = false;
    this.app.scene.skyboxIntensity = this.preset === "horizon" ? 0.20 : 0.28;
    this.app.scene.skyboxMip = 3;
    this.app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, this.preset === "horizon" ? 18 : -28, 0);
    if (this.camera?.camera) {
      this.camera.camera.clearColor = new pc.Color(0, 0, 0, 0);
      this.camera.camera.clearColorBuffer = true;
    }
  }

  private installModel(resource: pc.ContainerResource): void {
    const model = resource.instantiateRenderEntity({
      castShadows: false,
      receiveShadows: false
    });
    model.name = `${this.preset}-generated-research-boat`;
    model.setLocalPosition(0, this.preset === "horizon" ? -0.025 : -0.01, 0);
    model.setLocalEulerAngles(0, 90, 0);
    model.setLocalScale(1, 1, 1);
    this.app.root.addChild(model);
    this.model = model;

    model.findComponents("render").forEach((component) => {
      const render = component as pc.RenderComponent;
      render.castShadows = false;
      render.receiveShadows = false;
      render.meshInstances.forEach((meshInstance) => {
        const source = meshInstance.material as pc.StandardMaterial;
        const material = source.clone();
        material.name = `${source.name || "generated-boat"}.${this.preset}.runtime`;
        material.diffuse = this.preset === "horizon"
          ? new pc.Color(0.62, 0.69, 0.86)
          : new pc.Color(1.0, 0.94, 0.78);
        material.emissive = new pc.Color(0, 0, 0);
        material.emissiveIntensity = 0;
        material.update();
        meshInstance.material = material;
      });
    });
  }

  private loadContainer(url: string): Promise<pc.ContainerResource> {
    return new Promise((resolve, reject) => {
      this.app.assets.loadFromUrl(url, "container", (error, asset) => {
        if (error || !asset?.resource) {
          reject(error ?? new Error(`Failed to load generated research boat: ${url}`));
          return;
        }
        resolve(asset.resource as pc.ContainerResource);
      });
    });
  }

  private loadTexture(url: string): Promise<pc.Texture> {
    return new Promise((resolve, reject) => {
      this.app.assets.loadFromUrl(url, "texture", (error, asset) => {
        if (error || !asset?.resource) {
          reject(error ?? new Error(`Failed to load boat environment texture: ${url}`));
          return;
        }
        resolve(asset.resource as pc.Texture);
      });
    });
  }
}
