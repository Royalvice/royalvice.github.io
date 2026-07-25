# Profile GIF export plugin

This directory is an export-only toolchain. It is served by Vite during the
export job, but it is not imported by the production application and does not
add a public page or runtime API.

Run a production export against an already-running Vite development server:

```bash
npm run export:profile-gifs -- \
  --base-url http://127.0.0.1:4173 \
  --out-dir dist/profile-gifs \
  --width 720 \
  --fps 24 \
  --max-bytes 36700160
```

The command creates three looping GIFs, `manifest.json`, contact sheets and
selected diagnostic PNG keyframes. `ProfileRoomGifAutomaton.ts` is the
deterministic 60-second room harness; it reuses the production Canvas stage,
assets, TV and room geometry while remaining outside the production bundle.

Each GIF is encoded at 128 colors first, then retried at 96 and 80 colors if
needed. Width and frame rate are never silently reduced. The export fails if
the 80-color result still exceeds 35 MiB, if the encoded frame count or
duration drifts, or if the decoded first and last pixel hashes differ.
