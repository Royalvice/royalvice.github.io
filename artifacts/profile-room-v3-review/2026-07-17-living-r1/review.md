# Living Research Dungeon room-v3 visual review

All source candidates, replacement candidates, final sheets, enlarged frames, door states, lamp states and poster sources were opened with view_image.

## Final status

- nobita: movement 9/9 approved; life 9/9 approved
  - movement SHA-256: `6039cb015bba8d16a195094b373b28464dded6f3c42103ea5daa87ad73d0d200`
  - life SHA-256: `9b2a5b447f30589571c1d4dd0bf93531d93f7b78fb82f0063a351821eb03802f`
- doraemon: movement 9/9 approved; life 9/9 approved
  - movement SHA-256: `15de1ebc0f9eb20d390c3cbb94935ae1c938679d0f28ef7485d9c97304c5586e`
  - life SHA-256: `faf39ee662d7770a40453e1b55907e35dfaf8f76deb201e1fb37f7e8076aeeb1`
- shizuka: movement 9/9 approved; life 9/9 approved
  - movement SHA-256: `366f9471ffa7edf327f3e7af20c135cce1189372014bd58c2d23d191c75a1191`
  - life SHA-256: `071a6712eec196b6b4d0d9a9526645006520477072b279c4f5f5c12bfa0b4cab`
- gian: movement 9/9 approved; life 9/9 approved
  - movement SHA-256: `f0dd85f2b70e9286c9755826e0bdb19415e781caa5084aef7a0ee658b1cb445f`
  - life SHA-256: `2d1a0c824b6c31815f46da2edfd9aeae9813570e7b8e32c3d1777ec08835c1a0`
- suneo: movement 9/9 approved; life 9/9 approved
  - movement SHA-256: `f2d17af4572cbd1a2a11b4eab7e7e4a22799890c9cff7f04c4b7252fabdab6be`
  - life SHA-256: `049af703a7a082625917e10a76c91a0828473fbe62a53c9da3ae4637e8c1777c`

## Props

- Furniture atlas: 9/9 approved. Flux r2 supplied the chandelier, blackboard, eraser, desks, sofa, cooler and television; the malformed connected chair and console cells were replaced with hand-finished pixel sprites.
- Anywhere Door: 2/2 approved (closed/open only).
- Fuel lamp: 4/4 approved.
- Posters: both final 48x64 derivatives inspected at 8x nearest-neighbor enlargement.

## Rejected or repaired candidates

- Nobita life r1, Doraemon movement r1 and both Shizuka r1 sheets: rejected because the phrase `visible crown` was interpreted as a literal crown. The prompt was corrected to `visible top of the head` and r2 was generated.
- Gian movement r1 cell 3: rejected due to a small accidental crown; r2 replaced the full movement sheet.
- Furniture r1: rejected because the eraser cell was blank and the final cell was only a controller.
- Furniture r2 cell 5: the chair was fused to a desk; replaced with a standalone walnut chair sprite.
- Furniture r2 cell 9: the generated console resembled a microwave/legacy console; replaced with a vertical white/black/blue pixel console silhouette.
- One Piece search candidates from TMDB query were initially unrelated to One Piece; they were rejected after view_image. The selected East Blue source visibly contains exactly Luffy, Zoro, Nami, Usopp and Sanji.

## Budgets

- Ten actor sheets: 749606 bytes (732.0 KiB).
- Furniture, door, lamps and posters: 133950 bytes (130.8 KiB).
- Total room-v3 raster budget: 862.8 KiB.

## Runtime visual inspection

- Opened the 1920x1080 full Profile page and the authoritative 640x320 room buffer at autonomous start, TV play, blackboard thinking, water-cooler drinking, two-seat sofa use, portal entering, portal away and portal returning.
- Opened the 390x844 mobile composition, keyboard ground-focus state, reduced-motion tableau and local actor/furniture/door/lamp/poster fallbacks.
- Persistent review outputs are `browser/profile-room-v3-final-review-contact.png`, `browser/profile-page-1920x1080.png` and `browser/profile-page-mobile-390x844.png`.
- The central moving black rectangle is absent. Actor hover, performing and focus states do not draw green body boxes; keyboard focus is represented only by four warm-gold ground corners.
- All five actors render at most once. Portal-away hides the same actor instance and portal-returning restores that instance at the open door.
- The television's three inspected frames show different Pac-Lab chase positions while the rest of the room remains deterministic.

## Fallback posters

- Desktop: `640x320`, 36074 bytes, SHA-256 `3932c69cb3f9bcd2383c6f47e21fe6f2b774a5bf0df3e95fa73495d4eb93b5eb`.
- Mobile: `320x352`, 24290 bytes, SHA-256 `e3dba0480022beca4306509662faeede84b40b1d8430c2c73e9627a2f0cc5dca`.
- Both were generated from the reduced-motion final tableau and are mounted as the whole-room import/Canvas fallback as well as the legacy compatibility poster paths.

## Verification

- `npm run build`: passed.
- `npm run test:e2e`: 37/37 passed.
- `npm run test:visual`: 6/6 passed after replacing element-stability screenshots with direct authoritative Canvas captures.
- Final post-fallback regression: 3/3 Profile room E2E tests and 1/1 Profile room visual test passed.
- `git diff --check`: passed.
