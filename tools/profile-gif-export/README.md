# Profile GIF export plugin

This directory is an export-only toolchain. It is served by Vite during the
export job, but it is not imported by the production application and does not
add a public page or runtime API.

Run a production export against an already-running Vite development server:

```bash
npm run export:profile-gifs -- \
  --base-url http://127.0.0.1:4173 \
  --out-dir dist/profile-gifs \
  --width 1920 \
  --fps 24 \
  --max-bytes 36700160
```

The publication command creates two looping GIFs, `profile-card.gif` at
`1920x816` and `news-terminal.gif` at `1920x934`, plus a schema-v2
`manifest.json`, source and encoded contact sheets, and selected diagnostic PNG
keyframes. Browser screenshots are supersampled before Lanczos normalization so
GitHub Camo always downsamples rather than enlarges the cards.

Each GIF is encoded with a global 256-color, full-animation palette and no
dithering, then retried at 224 and 192 colors only if needed. Width and frame
rate are never silently reduced. The export fails if the 192-color result still
exceeds 35 MiB, if keyframe SSIM drops below 0.975, if the encoded frame count
or duration drifts, or if the decoded first and last pixel hashes differ.

`ProfileRoomGifAutomaton.ts` remains available as an optional deterministic
60-second development harness, but it is not part of the published Profile set.
Export it manually at its legacy dimensions when needed:

```bash
npm run export:profile-gifs -- \
  --base-url http://127.0.0.1:4173 \
  --out-dir /tmp/profile-room-gif \
  --only room \
  --width 720 \
  --fps 24 \
  --max-bytes 36700160
```
