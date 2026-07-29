#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.PROFILE_ROOM_URL || "http://127.0.0.1:4173";
const output = process.env.PROFILE_ROOM_VISUAL_OUTPUT || "/tmp/profile-room-visual-safety";
const durationSeconds = Number(process.env.PROFILE_ROOM_VISUAL_DURATION || 180);
const fixedStep = 1 / 30;
const frameCount = Math.round(durationSeconds / fixedStep);
const mobile = process.env.PROFILE_ROOM_VISUAL_MOBILE === "1";

const decodeDataUrl = (dataUrl) => Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 },
  deviceScaleFactor: 1
});
const pageErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(message.text());
});
page.on("pageerror", (error) => pageErrors.push(String(error)));

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => window.__profileAdventureDebug?.getState().ready === true, null, { timeout: 60_000 });

  const evaluated = await page.evaluate(async ({ frameCount: frames, fixedStep: step, mobile: mobileMode }) => {
    const debug = window.__profileAdventureDebug;
    if (!debug) throw new Error("Profile room debug hook is unavailable.");
    debug.setSeed(0x51f15e);
    debug.setTime(0);

    const canvas = document.querySelector(".profile-sprite-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Profile room canvas is unavailable.");
    if (mobileMode !== (canvas.width === 320)) {
      throw new Error(`Expected ${mobileMode ? "mobile" : "desktop"} Canvas, got ${canvas.width}x${canvas.height}.`);
    }

    const loadImage = async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    };
    const actorIds = ["nobita", "doraemon", "shizuka", "gian", "suneo"];
    const actorScales = { nobita: 0.94, doraemon: 1, shizuka: 0.9, gian: 1.08, suneo: 0.86 };
    const baseFrameOrder = [
      "idle", "walk-contact", "walk-passing", "walk-opposite-contact", "interaction-a",
      "interaction-b", "portal-reaction", "celebration", "character-signature"
    ];
    const lifeFrameOrder = [
      "think-a", "think-b", "drink-a", "drink-b", "sit-game-a", "sit-game-b",
      "portal-enter", "portal-return", "room-reaction"
    ];
    const assetUrls = [
      "/assets/profile/adventure/room-v3/furniture/furniture-grounded-v4-3x3.webp",
      ...actorIds.flatMap((id) => [
        `/assets/profile/adventure/room-v4/actors/${id}-base-3x3.webp`,
        `/assets/profile/adventure/room-v4/actors/${id}-movement-3x3.webp`,
        `/assets/profile/adventure/room-v4/actors/${id}-life-3x3.webp`
      ])
    ];
    const loaded = await Promise.all(assetUrls.map((url) => loadImage(url)));
    const images = new Map(assetUrls.map((url, index) => [url, loaded[index]]));
    const furniture = images.get(assetUrls[0]);
    if (!furniture) throw new Error("Furniture atlas failed to load.");

    const width = canvas.width;
    const height = canvas.height;
    const mapPoint = (point) => {
      if (!mobileMode) return [point[0] * width, point[1] * height];
      const x = 0.05 + point[0] * 0.9;
      const y = point[1] < 0.34
        ? 0.04 + point[1] * 0.95
        : point[1] < 0.64
          ? 0.02 + point[1] * 1.02
          : -0.02 + point[1] * 1.06;
      return [x * width, y * height];
    };
    const deskSpecs = [
      { station: "secondary-desk", propKey: "secondaryDesk", centre: [0.23, 0.88], guardBottom: 0.88, halfWidth: 0.025 },
      { station: "primary-desk", propKey: "primaryDesk", centre: [0.48, 0.88], guardBottom: 0.88, halfWidth: 0.025 }
    ];
    const layout = debug.getState().layout;
    const deskRects = new Map();
    const deskMasks = new Map();
    for (const spec of deskSpecs) {
      const prop = layout.props[spec.propKey];
      const [anchorX, anchorY] = mapPoint(prop.worldAnchor);
      const size = mobileMode ? prop.mobileSize : prop.desktopSize;
      const deskWidth = Math.round(size[0] * width);
      const deskHeight = Math.round(size[1] * height);
      const rect = {
        left: Math.round(anchorX - deskWidth * 0.5),
        top: Math.round(anchorY - deskHeight * 0.945),
        width: deskWidth,
        height: deskHeight
      };
      deskRects.set(spec.station, rect);
      const mask = document.createElement("canvas");
      mask.width = width;
      mask.height = height;
      const context = mask.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Desk mask context is unavailable.");
      context.imageSmoothingEnabled = false;
      context.drawImage(furniture, 0, 128, 128, 128, rect.left, rect.top, rect.width, rect.height);
      deskMasks.set(spec.station, context.getImageData(0, 0, width, height).data);
    }

    const actorCanvas = document.createElement("canvas");
    actorCanvas.width = width;
    actorCanvas.height = height;
    const actorContext = actorCanvas.getContext("2d", { willReadFrequently: true });
    if (!actorContext) throw new Error("Actor mask context is unavailable.");
    actorContext.imageSmoothingEnabled = false;

    const actorSize = (id) => Math.round((mobileMode ? 50 : width >= 640 ? 60 : 58) * actorScales[id]);
    const actorSource = (id, frame) => {
      const [group, frameName, indexValue] = frame.split(":");
      let index = -1;
      let kind = group;
      if (group === "movement") {
        const directionOffset = frameName === "down" ? 0 : frameName === "side" ? 3 : frameName === "up" ? 6 : -1;
        index = directionOffset < 0 ? -1 : directionOffset + Math.min(2, Math.max(0, Number(indexValue) || 0));
      } else if (group === "base") {
        index = baseFrameOrder.indexOf(frameName);
      } else if (group === "life") {
        index = lifeFrameOrder.indexOf(frameName);
      }
      if (index < 0) return null;
      const image = images.get(`/assets/profile/adventure/room-v4/actors/${id}-${kind}-3x3.webp`);
      return image ? { image, index, group, frameName } : null;
    };
    const actorScreenBounds = (id, actor, elapsed) => {
      const size = actorSize(id);
      const portalDuration = Math.max(0.01, actor.activityDuration || 1.4);
      const progress = Math.min(1, Math.max(0, actor.stateElapsed / portalDuration));
      const portalOffset = actor.state === "portal-entering" ? progress * 10 : actor.state === "portal-returning" ? (1 - progress) * 9 : 0;
      const idle = actor.state === "walking" ? 0 : Math.sin(elapsed * 1.7 + actorIds.indexOf(id)) * 0.35;
      const [mappedX, mappedY] = mapPoint(actor.position);
      const x = Math.round(mappedX + portalOffset);
      const y = Math.round(mappedY + idle);
      return { left: Math.floor(x - size / 2) - 1, top: y - size - 1, right: Math.ceil(x + size / 2) + 1, bottom: y + 1, x, y, size };
    };
    const needsDeskOcclusion = (actor, spec) => {
      if (!actor.visible) return false;
      const bounds = layout.props[spec.propKey].collisionBounds;
      return Math.abs(actor.position[0] - spec.centre[0]) <= spec.halfWidth + 0.004
        && actor.position[1] >= bounds[1] - 0.02
        && actor.position[1] <= spec.guardBottom + 0.008;
    };
    const rectanglesIntersect = (a, b) => a.left < b.left + b.width && a.right > b.left && a.top < b.top + b.height && a.bottom > b.top;
    const exposed = [];
    let exposedCount = 0;
    let maxObservedActorDeskOverlapPixels = 0;
    let shadowProbe = null;
    const previousPositions = new Map();
    const pendingEgress = new Map();
    const egresses = [];

    const maybeRecordEgress = (id, actor, state) => {
      const previous = previousPositions.get(id);
      for (const spec of deskSpecs) {
        const key = `${id}:${spec.station}`;
        const aligned = Math.abs(actor.position[0] - spec.centre[0]) <= spec.halfWidth + 0.004;
        const movingForward = Boolean(previous && actor.position[1] > previous.position[1] + 1e-7);
        const inside = aligned && movingForward && actor.position[1] >= 0.8 && actor.position[1] <= spec.guardBottom + 0.008;
        if (inside) {
          pendingEgress.set(key, {
            actor: id,
            station: spec.station,
            elapsed: state.simulationElapsed,
            state: {
              position: [...actor.position],
              facing: actor.facing,
              station: actor.station,
              frame: actor.frame,
              state: actor.state
            },
            canvas: canvas.toDataURL("image/png")
          });
          continue;
        }
        const pending = pendingEgress.get(key);
        const outside = aligned && movingForward && actor.position[1] > spec.guardBottom + 0.008;
        if (pending && outside && !egresses.some((entry) => entry.actor === id && entry.station === spec.station)) {
          egresses.push({
            before: pending,
            after: {
              actor: id,
              station: spec.station,
              elapsed: state.simulationElapsed,
              state: {
                position: [...actor.position],
                facing: actor.facing,
                station: actor.station,
                frame: actor.frame,
                state: actor.state
              },
              canvas: canvas.toDataURL("image/png")
            }
          });
          pendingEgress.delete(key);
        } else if (!aligned || !movingForward) {
          pendingEgress.delete(key);
        }
      }
      previousPositions.set(id, { position: [...actor.position] });
    };

    for (let frame = 0; frame <= frames; frame += 1) {
      const state = debug.getState();
      for (const id of actorIds) {
        const actor = state.actors[id];
        if (!actor.visible || actor.state === "portal-away") continue;
        maybeRecordEgress(id, actor, state);
        if (!shadowProbe && id === "gian" && actor.position[1] <= 0.725) {
          const station = deskSpecs.find((spec) => needsDeskOcclusion(actor, spec));
          if (station) shadowProbe = {
            elapsed: state.simulationElapsed,
            actor: id,
            station: station.station,
            position: [...actor.position]
          };
        }
        const screenBounds = actorScreenBounds(id, actor, state.simulationElapsed);
        const candidates = deskSpecs.filter((spec) => !needsDeskOcclusion(actor, spec) && rectanglesIntersect(screenBounds, deskRects.get(spec.station)));
        if (!candidates.length) continue;
        const source = actorSource(id, actor.frame);
        if (!source) {
          exposed.push({ elapsed: state.simulationElapsed, actor: id, reason: `Unknown actor frame ${actor.frame}` });
          exposedCount += 1;
          continue;
        }
        actorContext.clearRect(0, 0, width, height);
        actorContext.save();
        actorContext.translate(screenBounds.x, screenBounds.y);
        if (actor.facing === "left" && actor.frame.includes("movement:side")) actorContext.scale(-1, 1);
        const sourceX = (source.index % 3) * 128;
        const sourceY = Math.floor(source.index / 3) * 128;
        actorContext.drawImage(source.image, sourceX, sourceY, 128, 128, -screenBounds.size / 2, -screenBounds.size, screenBounds.size, screenBounds.size);
        actorContext.restore();
        const left = Math.max(0, screenBounds.left);
        const top = Math.max(0, screenBounds.top);
        const right = Math.min(width, screenBounds.right);
        const bottom = Math.min(height, screenBounds.bottom);
        const actorPixels = actorContext.getImageData(left, top, Math.max(1, right - left), Math.max(1, bottom - top)).data;
        for (const spec of candidates) {
          const deskPixels = deskMasks.get(spec.station);
          let overlapPixels = 0;
          for (let y = top; y < bottom; y += 1) {
            for (let x = left; x < right; x += 1) {
              const localIndex = ((y - top) * (right - left) + (x - left)) * 4 + 3;
              if (actorPixels[localIndex] < 16 || deskPixels[(y * width + x) * 4 + 3] < 16) continue;
              overlapPixels += 1;
            }
          }
          maxObservedActorDeskOverlapPixels = Math.max(maxObservedActorDeskOverlapPixels, overlapPixels);
          if (overlapPixels > 0) {
            exposedCount += 1;
            if (exposed.length < 24) {
              exposed.push({
                elapsed: state.simulationElapsed,
                actor: id,
                station: spec.station,
                position: [...actor.position],
                frame: actor.frame,
                overlapPixels
              });
            }
          }
        }
      }
      if (frame < frames) debug.advanceTime(step);
    }

    let shadowVerification = null;
    if (shadowProbe) {
      const stageContext = canvas.getContext("2d", { willReadFrequently: true });
      if (!stageContext) throw new Error("Stage Canvas context is unavailable for the shadow probe.");
      debug.setTime(shadowProbe.elapsed);
      const withShadow = stageContext.getImageData(0, 0, width, height).data;
      const [mappedShadowX, mappedShadowY] = mapPoint(shadowProbe.position);
      const targetX = Math.round(mappedShadowX);
      const targetY = Math.round(mappedShadowY + 2);
      const size = actorSize(shadowProbe.actor);
      const radiusX = size * 0.27;
      const radiusY = size * 0.072;
      const nativeEllipse = stageContext.ellipse;
      let suppressedEllipseCalls = 0;
      try {
        stageContext.ellipse = function patchedEllipse(x, y, ...rest) {
          if (Math.abs(x - targetX) < 0.01 && Math.abs(y - targetY) < 0.01) {
            suppressedEllipseCalls += 1;
            return;
          }
          return nativeEllipse.call(this, x, y, ...rest);
        };
        debug.setTime(shadowProbe.elapsed);
        const withoutShadow = stageContext.getImageData(0, 0, width, height).data;
        let differencePixels = 0;
        for (let y = Math.max(0, Math.floor(targetY - radiusY - 1)); y <= Math.min(height - 1, Math.ceil(targetY + radiusY + 1)); y += 1) {
          for (let x = Math.max(0, Math.floor(targetX - radiusX - 1)); x <= Math.min(width - 1, Math.ceil(targetX + radiusX + 1)); x += 1) {
            const ellipse = ((x - targetX) / radiusX) ** 2 + ((y - targetY) / radiusY) ** 2;
            if (ellipse > 1) continue;
            const offset = (y * width + x) * 4;
            if (
              Math.abs(withShadow[offset] - withoutShadow[offset]) > 2
              || Math.abs(withShadow[offset + 1] - withoutShadow[offset + 1]) > 2
              || Math.abs(withShadow[offset + 2] - withoutShadow[offset + 2]) > 2
            ) differencePixels += 1;
          }
        }
        shadowVerification = { ...shadowProbe, target: [targetX, targetY], suppressedEllipseCalls, differencePixels };
      } finally {
        delete stageContext.ellipse;
        debug.setTime(shadowProbe.elapsed);
      }
    }

    const preferredEgress = egresses.find((entry) => entry.before.actor === "gian") || egresses[0] || null;
    return {
      durationSeconds: frames * step,
      scannedFrames: frames + 1,
      canvas: [width, height],
      mobile: mobileMode,
      exposedCount,
      maxObservedActorDeskOverlapPixels,
      exposed,
      egressCount: egresses.length,
      egress: preferredEgress && {
        actor: preferredEgress.before.actor,
        station: preferredEgress.before.station,
        before: { elapsed: preferredEgress.before.elapsed, state: preferredEgress.before.state },
        after: { elapsed: preferredEgress.after.elapsed, state: preferredEgress.after.state }
      },
      shadowVerification,
      captures: preferredEgress && {
        before: preferredEgress.before.canvas,
        after: preferredEgress.after.canvas
      }
    };
  }, { frameCount, fixedStep, mobile });

  await fs.mkdir(output, { recursive: true });
  const captures = evaluated.captures || null;
  const report = { ...evaluated, pageErrors, captures: undefined };
  if (captures) {
    const beforePath = path.join(output, "desk-egress-before.png");
    const afterPath = path.join(output, "desk-egress-after.png");
    await Promise.all([
      fs.writeFile(beforePath, decodeDataUrl(captures.before)),
      fs.writeFile(afterPath, decodeDataUrl(captures.after))
    ]);
    report.capturePaths = { before: beforePath, after: afterPath };
  }
  await fs.writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (
    report.exposedCount
    || report.pageErrors.length
    || !report.egress
    || !report.shadowVerification
    || report.shadowVerification.suppressedEllipseCalls
    || report.shadowVerification.differencePixels
  ) process.exitCode = 1;
} finally {
  await browser.close();
}
