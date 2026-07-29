#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const sourceRoot = process.env.PROFILE_ADVENTURE_OUT || "/private/tmp/royalvice-profile-adventure-generation";
const targetRoot = path.resolve("public/assets/profile/adventure");
const assets = [
  ["nobita-strip-t2i.png", "sprites/nobita.webp"],
  ["doraemon-strip-i2i.png", "sprites/doraemon.webp"],
  ["shizuka-strip-i2i.png", "sprites/shizuka.webp"],
  ["gian-strip-i2i.png", "sprites/gian.webp"],
  ["suneo-strip-i2i.png", "sprites/suneo.webp"],
  ["anywhere-door-canonical.png", "props/anywhere-door.webp"],
  ["adventure-props.png", "props/profile-adventure-props.webp"]
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const [sourceName, targetName] of assets) {
  const source = path.join(sourceRoot, sourceName);
  const target = path.join(targetRoot, targetName);
  const encoded = (await fs.readFile(source)).toString("base64");
  const result = await page.evaluate(async ({ encoded }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${encoded}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas2D unavailable while packing sprites.");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    let transparent = 0;
    let feathered = 0;
    for (let index = 0; index < pixels.data.length; index += 4) {
      const r = pixels.data[index];
      const g = pixels.data[index + 1];
      const b = pixels.data[index + 2];
      const greenDistance = Math.hypot(r, 255 - g, b);
      const dominance = g - Math.max(r, b);
      let alpha = 255;
      if (g > 108 && dominance > 24) {
        const distanceAlpha = Math.max(0, Math.min(1, (greenDistance - 20) / 78));
        const dominanceAlpha = Math.max(0, Math.min(1, (116 - dominance) / 76));
        alpha = Math.round(255 * Math.min(distanceAlpha, dominanceAlpha));
      }
      if (alpha < 252) {
        pixels.data[index + 1] = Math.min(g, Math.max(r, b) + 20);
        pixels.data[index + 3] = alpha;
        if (alpha === 0) transparent += 1;
        else feathered += 1;
      }
    }
    context.putImageData(pixels, 0, 0);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("WebP encoding failed.")), "image/webp", 0.9);
    });
    return {
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
      width: canvas.width,
      height: canvas.height,
      transparent,
      feathered
    };
  }, { encoded });
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, Buffer.from(result.bytes));
  console.log(`${targetName}: ${result.width}x${result.height}, transparent=${result.transparent}, feathered=${result.feathered}`);
}

const characterTargets = assets.slice(0, 5).map(([, targetName]) => path.join(targetRoot, targetName));
const characterSources = await Promise.all(characterTargets.map(async (target) => (await fs.readFile(target)).toString("base64")));
const combinedCharacters = await page.evaluate(async (encodedImages) => {
  const images = await Promise.all(encodedImages.map(async (encoded) => {
    const image = new Image();
    image.src = `data:image/webp;base64,${encoded}`;
    await image.decode();
    return image;
  }));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(...images.map((image) => image.naturalWidth));
  canvas.height = images.reduce((height, image) => height + image.naturalHeight, 0);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas2D unavailable while combining the character atlas.");
  let y = 0;
  images.forEach((image) => {
    context.drawImage(image, 0, y);
    y += image.naturalHeight;
  });
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Combined WebP encoding failed.")), "image/webp", 0.9);
  });
  return { bytes: Array.from(new Uint8Array(await blob.arrayBuffer())), width: canvas.width, height: canvas.height };
}, characterSources);
const combinedPath = path.join(targetRoot, "atlases/profile-adventure-characters.webp");
await fs.mkdir(path.dirname(combinedPath), { recursive: true });
await fs.writeFile(combinedPath, Buffer.from(combinedCharacters.bytes));
await fs.copyFile(
  path.join(targetRoot, "props/profile-adventure-props.webp"),
  path.join(targetRoot, "atlases/profile-adventure-props.webp")
);
console.log(`atlases/profile-adventure-characters.webp: ${combinedCharacters.width}x${combinedCharacters.height}`);

await browser.close();
