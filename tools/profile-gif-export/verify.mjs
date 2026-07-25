#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const outDir = path.resolve(process.argv[2] || "dist/profile-gifs");
const manifest = JSON.parse(await readFile(path.join(outDir, "manifest.json"), "utf8"));

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

for (const card of manifest.cards) {
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
}

process.stdout.write(`Verified ${manifest.cards.length} profile GIFs in ${outDir}.\n`);
