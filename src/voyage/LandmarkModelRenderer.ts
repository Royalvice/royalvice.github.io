import * as pc from "playcanvas";
import type { QualityTier, VoyageNode } from "../content/site";
import type { SceneRenderer } from "../scenes/SceneRenderer";

type LandmarkKind = VoyageNode["landmark"];
type NodePlacement = Pick<VoyageNode, "landmark" | "x" | "y">;
interface LandmarkConfig { url: string; euler: [number, number, number]; worldHeight: number; yaw: number; }

const VERSION = "20260713-trellis2-512-v1";
const CONFIG: Record<LandmarkKind, LandmarkConfig> = {
  dock: { url: `/assets/voyage/models/landmarks/docdiff.glb?v=${VERSION}`, euler: [0, 0, 0], worldHeight: 2.45, yaw: 0 },
  lighthouse: { url: `/assets/voyage/models/landmarks/directl.glb?v=${VERSION}`, euler: [0, 0, 0], worldHeight: 3.55, yaw: 0 },
  reef: { url: `/assets/voyage/models/landmarks/neural.glb?v=${VERSION}`, euler: [0, 0, 0], worldHeight: 1.42, yaw: 0 },
  harbor: { url: `/assets/voyage/models/landmarks/eva01.glb?v=${VERSION}`, euler: [0, 0, 0], worldHeight: 3.05, yaw: 0 },
  gate: { url: `/assets/voyage/models/landmarks/world.glb?v=${VERSION}`, euler: [0, 0, 0], worldHeight: 3.30, yaw: 0 }
};

export class LandmarkModelRenderer implements SceneRenderer {
  private readonly app: pc.Application;
  private readonly roots: { entity: pc.Entity; node: NodePlacement }[] = [];
  private camera: pc.Entity | null = null;
  private running = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly nodes: NodePlacement[]) {
    this.app = new pc.Application(canvas, { graphicsDeviceOptions: { alpha: true, antialias: true, powerPreference: "low-power" } });
  }

  async init(): Promise<void> {
    this.app.setCanvasFillMode(pc.FILLMODE_NONE);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.app.scene.ambientLight = new pc.Color(.44, .40, .34);
    this.app.scene.exposure = 1.18;
    const camera = new pc.Entity("voyage-landmark-camera");
    camera.addComponent("camera", { projection: pc.PROJECTION_ORTHOGRAPHIC, orthoHeight: 10, clearColor: new pc.Color(0, 0, 0, 0), toneMapping: pc.TONEMAP_ACES2, gammaCorrection: pc.GAMMA_SRGB });
    camera.setPosition(0, 0, 8);
    camera.lookAt(0, 0, 0);
    this.app.root.addChild(camera);
    this.camera = camera;
    const key = new pc.Entity("voyage-landmark-key");
    key.addComponent("light", { type: "directional", color: new pc.Color(1, .73, .40), intensity: 1.72, castShadows: false });
    key.setLocalEulerAngles(42, 148, 0);
    this.app.root.addChild(key);
    const fill = new pc.Entity("voyage-landmark-fill");
    fill.addComponent("light", { type: "directional", color: new pc.Color(.20, .43, .58), intensity: .52, castShadows: false });
    fill.setLocalEulerAngles(-32, -35, 0);
    this.app.root.addChild(fill);

    const environment = this.loadTexture("/assets/gallery/materials/studio_small_08_1k.hdr");
    await Promise.all(this.nodes.map(async (node) => {
      const config = CONFIG[node.landmark];
      const resource = await this.loadContainer(config.url);
      this.roots.push({ entity: this.installModel(resource, node.landmark, config), node });
    }));
    try { this.applyEnvironment(await environment); }
    catch (error) { console.warn("Landmark HDR environment fallback active", error); }
    this.resize();
    this.app.start();
    this.app.autoRender = false;
    this.app.renderNextFrame = true;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    this.canvas.closest<HTMLElement>(".ocean-map")?.classList.add("landmarks-model-ready");
  }

  start(): void { this.resume(); }
  pause(): void { this.running = false; this.app.autoRender = false; }
  resume(): void { this.running = true; this.app.renderNextFrame = true; }
  resize(): void {
    const rect = this.canvas.closest<HTMLElement>(".ocean-map")?.getBoundingClientRect() ?? this.canvas.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width));
    const height = Math.max(180, Math.round(rect.height));
    const aspect = width / height;
    const renderWidth = 640;
    const renderHeight = Math.max(220, Math.round(renderWidth / aspect));
    this.app.resizeCanvas(renderWidth, renderHeight);
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    if (this.camera?.camera) {
      this.camera.camera.orthoHeight = 10;
      this.camera.camera.aspectRatioMode = pc.ASPECT_MANUAL;
      this.camera.camera.aspectRatio = aspect;
    }
    this.roots.forEach(({ entity, node }) => {
      const landmark = document.querySelector<HTMLElement>(`[data-landmark-model="${node.landmark}"]`);
      const landmarkRect = landmark?.getBoundingClientRect();
      const anchorX = landmarkRect ? landmarkRect.left + landmarkRect.width * .5 : rect.left + node.x / 100 * rect.width;
      const anchorY = landmarkRect ? landmarkRect.bottom - 3 : rect.top + node.y / 100 * rect.height;
      const x = (anchorX - rect.left) / rect.width;
      const y = (anchorY - rect.top) / rect.height;
      entity.setLocalPosition((x - .5) * 20 * aspect, (.5 - y) * 20, 0);
    });
    if (this.running) this.app.renderNextFrame = true;
  }
  setQuality(tier: QualityTier): void { this.app.graphicsDevice.maxPixelRatio = tier === "high" ? 1.35 : 1; }
  destroy(): void { this.app.destroy(); }

  private installModel(resource: pc.ContainerResource, kind: LandmarkKind, config: LandmarkConfig): pc.Entity {
    const wrapper = new pc.Entity(`${kind}-trellis-landmark`);
    const normalized = new pc.Entity(`${kind}-normalized`);
    const model = resource.instantiateRenderEntity({ castShadows: false, receiveShadows: false });
    model.name = `${kind}-i23d-model`;
    model.setLocalEulerAngles(...config.euler);
    wrapper.setLocalEulerAngles(0, config.yaw, 0);
    normalized.addChild(model);
    wrapper.addChild(normalized);
    this.app.root.addChild(wrapper);
    model.syncHierarchy();
    const bounds = this.collectBounds(model);
    const center = bounds.center;
    const minimumY = center.y - bounds.halfExtents.y;
    const height = Math.max(bounds.halfExtents.y * 2, .0001);
    model.setLocalPosition(-center.x, -minimumY, -center.z);
    const fit = config.worldHeight / height;
    normalized.setLocalScale(fit, fit, fit);
    model.findComponents("render").forEach((component) => {
      const render = component as pc.RenderComponent;
      render.castShadows = false;
      render.receiveShadows = false;
      render.meshInstances.forEach((meshInstance) => {
        const source = meshInstance.material as pc.StandardMaterial;
        const material = source.clone();
        material.name = `${source.name || "trellis"}.${kind}.runtime`;
        material.emissive = new pc.Color(0, 0, 0);
        material.emissiveIntensity = 0;
        material.update();
        meshInstance.material = material;
      });
    });
    return wrapper;
  }

  private collectBounds(root: pc.Entity): pc.BoundingBox {
    const box = new pc.BoundingBox();
    let initialized = false;
    root.findComponents("render").forEach((component) => {
      (component as pc.RenderComponent).meshInstances.forEach((instance) => {
        if (!initialized) { box.copy(instance.aabb); initialized = true; }
        else box.add(instance.aabb);
      });
    });
    if (!initialized) throw new Error(`No render bounds found for ${root.name}`);
    return box;
  }

  private loadContainer(url: string): Promise<pc.ContainerResource> {
    return new Promise((resolve, reject) => {
      this.app.assets.loadFromUrl(url, "container", (error, asset) => {
        if (error || !asset?.resource) reject(error ?? new Error(`Failed to load landmark model: ${url}`));
        else resolve(asset.resource as pc.ContainerResource);
      });
    });
  }

  private loadTexture(url: string): Promise<pc.Texture> {
    return new Promise((resolve, reject) => {
      this.app.assets.loadFromUrl(url, "texture", (error, asset) => {
        if (error || !asset?.resource) reject(error ?? new Error(`Failed to load landmark environment: ${url}`));
        else resolve(asset.resource as pc.Texture);
      });
    });
  }

  private applyEnvironment(source: pc.Texture): void {
    const lightingSource = pc.EnvLighting.generateLightingSource(source, { size: 64 });
    this.app.scene.envAtlas = pc.EnvLighting.generateAtlas(lightingSource, { size: 128, numReflectionSamples: 128, numAmbientSamples: 128 });
    this.app.scene.ambientSource = pc.AMBIENTSRC_ENVALATLAS;
    this.app.scene.skybox = null;
    this.app.scene.skyboxIntensity = .24;
    this.app.scene.skyboxMip = 3;
    this.app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, -28, 0);
    const skyboxLayer = this.app.scene.layers.getLayerById(pc.LAYERID_SKYBOX);
    if (skyboxLayer) skyboxLayer.enabled = false;
  }
}
