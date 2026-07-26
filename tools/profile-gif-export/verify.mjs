#!/usr/bin/env node

import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const outDir = path.resolve(process.argv[2] || "dist/profile-gifs");
const manifest = JSON.parse(await readFile(path.join(outDir, "manifest.json"), "utf8"));
const expectedCards = {
  "profile-card": { width: 1920, height: 816, frames: 192, duration: 8, layoutWidth: 800, layoutHeight: 340, captureScale: 3, resample: "lanczos" },
  "news-terminal": { width: 1920, height: 934, frames: 240, duration: 10, layoutWidth: 720, layoutHeight: 350, captureScale: 3, resample: "lanczos" },
  "sprite-room": { width: 720, height: 350, frames: 1_440, duration: 60, layoutWidth: 720, layoutHeight: 350, captureScale: 1, resample: null }
};
if (manifest.schemaVersion !== 2) throw new Error(`Expected manifest schema v2, received ${manifest.schemaVersion}.`);
const cardIds = manifest.cards.map((card) => card.id);
if (JSON.stringify(cardIds) !== JSON.stringify(manifest.publication.order)) {
  throw new Error("Manifest card order differs from publication order.");
}
const publishedOrder = ["profile-card", "news-terminal"];
const isPublishedSet = JSON.stringify(cardIds) === JSON.stringify(publishedOrder);
const isSingleDevelopmentCard = cardIds.length === 1 && ["profile-card", "news-terminal", "sprite-room"].includes(cardIds[0]);
if (!isPublishedSet && !isSingleDevelopmentCard) throw new Error(`Unexpected GIF publication set: ${cardIds.join(", ")}.`);
if (isPublishedSet) {
  try {
    await access(path.join(outDir, "sprite-room.gif"));
    throw new Error("Published output still contains sprite-room.gif.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
if (manifest.publication.palette?.statsMode !== "full" || manifest.publication.palette?.dither !== "none") {
  throw new Error("Manifest does not declare the high-fidelity full/no-dither palette profile.");
}
if (manifest.publication.fps !== 24 || manifest.publication.maxBytes !== 36_700_160) {
  throw new Error("Manifest publication frame rate or byte cap drifted from the locked profile.");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => code === 0
      ? resolve(Buffer.concat(stdout))
      : reject(new Error(`${command} failed (${code}): ${Buffer.concat(stderr).toString()}`)));
  });
}

async function decodedPixelHash(file, frame) {
  return createHash("sha256").update(await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-i", file,
    "-vf", `select=eq(n\\,${frame})`, "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"
  ])).digest("hex");
}

for (const card of manifest.cards) {
  const expected = expectedCards[card.id];
  if (!expected) throw new Error(`Unknown profile GIF card ${card.id}.`);
  for (const field of ["width", "height", "frames", "duration", "layoutWidth", "layoutHeight", "captureScale", "resample"]) {
    if (card[field] !== expected[field]) throw new Error(`${card.file} ${field} differs from the locked specification.`);
  }
  const file = path.join(outDir, card.file);
  const bytes = (await stat(file)).size;
  const digest = createHash("sha256").update(await readFile(file)).digest("hex");
  if (bytes !== card.verification.bytes) throw new Error(`${card.file} byte count differs from manifest.`);
  if (digest !== card.verification.sha256) throw new Error(`${card.file} SHA-256 differs from manifest.`);
  if (bytes > manifest.publication.maxBytes) throw new Error(`${card.file} exceeds the publication cap.`);
  const probe = JSON.parse((await run("ffprobe", [
    "-v", "error", "-count_frames", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,nb_read_frames:format=duration,size",
    "-of", "json", file
  ])).toString());
  const stream = probe.streams[0];
  if (Number(stream.width) !== card.width || Number(stream.height) !== card.height) throw new Error(`${card.file} dimensions differ from manifest.`);
  if (Number(stream.nb_read_frames) !== card.frames) throw new Error(`${card.file} frame count differs from manifest.`);
  const duration = Number(probe.format.duration);
  if (Math.abs(duration - card.duration) > .03) throw new Error(`${card.file} duration differs from manifest.`);
  if (Math.abs(Number(stream.nb_read_frames) / duration - card.fps) > .08) throw new Error(`${card.file} effective frame rate differs from manifest.`);
  if (![256, 224, 192].includes(card.encoding.colors)) throw new Error(`${card.file} uses an unapproved palette size.`);
  if (card.fidelity.threshold !== .975 || card.fidelity.minimum < .975) throw new Error(`${card.file} fails the keyframe color-fidelity threshold.`);
  const first = await decodedPixelHash(file, 0);
  const last = await decodedPixelHash(file, card.frames - 1);
  if (first !== last) throw new Error(`${card.file} decoded first and last pixels differ.`);
  if (first !== card.verification.firstPixelSha256 || last !== card.verification.lastPixelSha256) {
    throw new Error(`${card.file} loop hashes differ from manifest.`);
  }
}

process.stdout.write(`Verified ${manifest.cards.length} profile GIFs in ${outDir}.\n`);
