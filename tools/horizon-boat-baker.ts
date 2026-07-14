import * as pc from "playcanvas";

declare global {
  interface Window {
    __horizonBakeResult?: { atlasPng: string; atlasWebp: string; noisePng: string; noiseWebp: string };
    __horizonBakeError?: string;
  }
}

const SOURCE_WIDTH = 512;
const SOURCE_HEIGHT = 384;
const FRAME_WIDTH = 128;
const FRAME_HEIGHT = 96;
const MODEL_URL = "/assets/voyage/models/research-boat-v1.glb?v=horizon-atlas-bake-v1";

function loadContainer(app: pc.Application, url: string): Promise<pc.ContainerResource> {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(url, "container", (error, asset) => {
      if (error || !asset?.resource) reject(error ?? new Error(`Unable to load ${url}`));
      else resolve(asset.resource as pc.ContainerResource);
    });
  });
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function buildNoiseTexture(): { png: string; webp: string } {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  const random = new Float32Array(size * size);
  let seed = 0x4f415349;
  for (let index = 0; index < random.length; index += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    random[index] = seed / 0x100000000;
  }
  const highPass = new Float32Array(random.length);
  let minimum = Infinity;
  let maximum = -Infinity;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let neighborhood = 0;
      let count = 0;
      for (let oy = -2; oy <= 2; oy += 1) {
        for (let ox = -2; ox <= 2; ox += 1) {
          if (!ox && !oy) continue;
          neighborhood += random[((y + oy + size) % size) * size + ((x + ox + size) % size)];
          count += 1;
        }
      }
      const value = random[y * size + x] - neighborhood / count;
      highPass[y * size + x] = value;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }
  const image = context.createImageData(size, size);
  for (let index = 0; index < highPass.length; index += 1) {
    const value = Math.round(((highPass[index] - minimum) / Math.max(.0001, maximum - minimum)) * 255);
    image.data[index * 4] = value;
    image.data[index * 4 + 1] = value;
    image.data[index * 4 + 2] = value;
    image.data[index * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return {
    png: canvas.toDataURL("image/png"),
    webp: canvas.toDataURL("image/webp", .94)
  };
}

async function bake(): Promise<void> {
  const source = document.querySelector<HTMLCanvasElement>("#boat-source")!;
  const app = new pc.Application(source, {
    graphicsDeviceOptions: {
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true
    }
  });
  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_FIXED, SOURCE_WIDTH, SOURCE_HEIGHT);
  app.scene.ambientLight = new pc.Color(.12, .17, .28);
  app.scene.exposure = 1.18;
  app.scene.skybox = null;

  const camera = new pc.Entity("horizon-atlas-camera");
  camera.addComponent("camera", {
    projection: pc.PROJECTION_ORTHOGRAPHIC,
    orthoHeight: .60,
    clearColor: new pc.Color(0, 0, 0, 0),
    nearClip: .05,
    farClip: 20,
    toneMapping: pc.TONEMAP_ACES2,
    gammaCorrection: pc.GAMMA_SRGB
  });
  camera.setPosition(1.35, .72, 1.55);
  camera.lookAt(0, -.015, 0);
  app.root.addChild(camera);

  const moon = new pc.Entity("moon-key");
  moon.addComponent("light", {
    type: "directional",
    color: new pc.Color(.48, .60, .94),
    intensity: 1.75,
    castShadows: false
  });
  moon.setLocalEulerAngles(42, 136, 0);
  app.root.addChild(moon);

  const oasis = new pc.Entity("oasis-rim");
  oasis.addComponent("light", {
    type: "directional",
    color: new pc.Color(.18, .72, .42),
    intensity: .58,
    castShadows: false
  });
  oasis.setLocalEulerAngles(-24, -48, 0);
  app.root.addChild(oasis);

  app.start();
  app.autoRender = false;
  const resource = await loadContainer(app, MODEL_URL);
  const model = resource.instantiateRenderEntity({ castShadows: false, receiveShadows: false });
  model.setLocalPosition(0, -.025, 0);
  model.setLocalScale(1, 1, 1);
  app.root.addChild(model);
  model.findComponents("render").forEach((component) => {
    const render = component as pc.RenderComponent;
    render.castShadows = false;
    render.receiveShadows = false;
    render.meshInstances.forEach((meshInstance) => {
      const original = meshInstance.material as pc.StandardMaterial;
      const material = original.clone();
      material.diffuse = new pc.Color(.57, .66, .84);
      material.emissive = new pc.Color(0, 0, 0);
      material.emissiveIntensity = 0;
      material.update();
      meshInstance.material = material;
    });
  });

  const atlas = document.createElement("canvas");
  atlas.width = FRAME_WIDTH * 4;
  atlas.height = FRAME_HEIGHT * 3;
  const context = atlas.getContext("2d", { willReadFrequently: true })!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  const pose = [-.72, -.44, -.18, .08, .34, .60, .76, .52, .22, -.06, -.34, -.60];
  for (let frame = 0; frame < 12; frame += 1) {
    model.setLocalEulerAngles(pose[frame] * .35, 90 + Math.sin(frame / 12 * Math.PI * 2) * .42, pose[frame]);
    model.setLocalPosition(0, -.025 + Math.sin(frame / 12 * Math.PI * 2) * .006, 0);
    app.renderNextFrame = true;
    await nextFrame();
    context.drawImage(source, 0, 0, SOURCE_WIDTH, SOURCE_HEIGHT, (frame % 4) * FRAME_WIDTH, Math.floor(frame / 4) * FRAME_HEIGHT, FRAME_WIDTH, FRAME_HEIGHT);
  }

  const pixels = context.getImageData(0, 0, atlas.width, atlas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const alpha = pixels.data[index + 3];
    if (alpha < 8) {
      pixels.data[index + 3] = 0;
      continue;
    }
    pixels.data[index] = Math.round(pixels.data[index] / 12) * 12;
    pixels.data[index + 1] = Math.round(pixels.data[index + 1] / 12) * 12;
    pixels.data[index + 2] = Math.round(pixels.data[index + 2] / 12) * 12;
    pixels.data[index + 3] = alpha < 96 ? Math.round(alpha / 32) * 32 : 255;
  }
  context.putImageData(pixels, 0, 0);

  // A restrained two-pixel cabin lamp is added after palette normalization.
  context.fillStyle = "#d8a346";
  for (let frame = 0; frame < 12; frame += 1) {
    const x = (frame % 4) * FRAME_WIDTH + 71;
    const y = Math.floor(frame / 4) * FRAME_HEIGHT + 63;
    context.fillRect(x, y, 2, 1);
  }

  const noise = buildNoiseTexture();
  window.__horizonBakeResult = {
    atlasPng: atlas.toDataURL("image/png"),
    atlasWebp: atlas.toDataURL("image/webp", .92),
    noisePng: noise.png,
    noiseWebp: noise.webp
  };
  app.destroy();
}

bake().catch((error) => {
  window.__horizonBakeError = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(error);
});
