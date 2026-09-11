# YZY After Hours Arcade

The room's television opens a real PlayCanvas cabinet. EmulatorJS renders into
an isolated same-origin canvas, sampled by the cabinet's curved CRT mesh.
There is no HTML game screen pasted over the hardware.

## Hosted game files

The complete shelf (15 ROM ZIPs and two BIOS ZIPs) lives in `roms/` and `bios/`.
Git LFS stores these objects. The Pages workflow checks out the real LFS objects,
then Vite copies them into the same-origin static site. `sources.json` records
source URLs, sizes and hashes. Music is hosted in `/assets/audio/`.

Development and production use exactly the same public files. No private
middleware or external ROM service is needed. `npm run verify:arcade` requires
all 15 sets and rejects missing files, ZIP corruption and unresolved pointers.

`node tools/arcade/check-local-games.mjs` boots each installed game with the
actual FBNeo core, applies a coin and start input, and captures boot/start
screens plus native diagnostics in `.local/arcade/review/`. Inspect screenshots
as well as frame counters: a running core can still display a ROM error/menu.

## Shared television

The expanded view uses a teal CRT cabinet with walnut cheeks, enamel trim,
a low control deck and a freestanding wooden disclaimer sign. `src/arcade/ArcadeCabinetScene.ts` defines the
hardware. `node tools/arcade/bake-tv.mjs` projects that same model with the
room's 45-degree camera into `public/assets/profile/arcade-tv/`. Its manifest
contains the foot pivot and projected screen aperture; the dungeon draws the
live attract animation into that opening. Re-bake after changing geometry.

## Reproducible runtime and deployment

`npm run prepare:arcade` fetches exactly EmulatorJS 4.2.3 and FBNeo package 4.2.3
from npm, verifies pinned SHA-512 digests, and generates `runtime/` and the
public inventory. Both development and build run this preparation. Only the
single-thread WebGL1/WebGL2 core is included; no external runtime fallback.

The runner fixes 4.2.3's external-file ArrayBuffer/typed-array mismatch so the
BIOS is actually written to the core filesystem. It retains the normal MVS
DIP-switch defaults. Games are not substituted with test fixtures.

## Controls and credits

On phones, drag the eight-way virtual joystick; releasing it returns to center.
Six action buttons support simultaneous touch input. Closing or losing focus
clears held inputs. The wooden notice is in English, with Contact: Royalvice.

- Arrows / WASD: joystick; J K L / U I O: the six physical buttons.
- 5 / C: one coin; Enter / 1: start; P: pause; Esc: return to the room.
- Touch: joystick on the 3D panel or direction pad below it, action buttons.
- Standard gamepad: left stick / D-pad, face buttons, shoulders, Select coin,
  Start. Action order follows the panel. SF uses Y X L / B A R internally;
  the 2–4-button games map in native B A Y X order.

The cabinet starts with no tokens. The one-time Horizon wish coin unlocks unlimited
virtual credits across games and future visits on the same browser/origin.
Only a fresh press emits a 100 ms coin input to the core. Switching games
restarts the old board if revisited; closing the cabinet keeps the active
board in memory. No real money is involved.

The runner exposes no save-state, rewind or service-mode UI and disables persisted emulator settings. Native FBNeo cheat options are disabled by default and become selectable only after the shared wish coin has been inserted.
This is a client-side play experience, not a tamper-proof accounting system.
When playing, Returning Home is gently lowered and later restored without
changing its play/pause state or position. Closing/blur pauses the core and
releases all held controls.

## Sources and licenses

- [EmulatorJS v4.2.3](https://github.com/EmulatorJS/EmulatorJS/tree/v4.2.3), GPL-3.0;
  original sources and full license are included in the generated runtime.
- [EmulatorJS FBNeo fork](https://github.com/EmulatorJS/FBNeo) and
  [upstream FBNeo](https://github.com/finalburnneo/FBNeo), non-commercial license.
  The package's build report records `2025-06-14T18:50:28+00:00`.
- [FBNeo ROM and BIOS requirements](https://docs.libretro.com/library/fbneo/).

Local real-core tests optionally use Gridlee from the
[MAME-authorized download](https://www.mamedev.org/roms/gridlee/), solely for
non-commercial validation. Download it locally, then run
`ARCADE_TEST_ROM=/absolute/path/gridlee.zip npm run test:arcade`.
The test intercepts requests inside its browser context. Gridlee is never added
to the shipped catalog, repository game assets, or public build.

## Wish coin (v1)

The sixth manually clicked Horizon firework awards one keepsake. `yzy.arcade.wish-coin.v1` persists click progress, acquisition and one-time insertion on this browser/origin. Cabin-window fireworks and debug fireworks do not award coins. The golden receiver accepts the keepsake once; after that the gameplay credit key supplies unlimited debounced native coin pulses. No coins are supplied initially.

The cupboard and open machine share `ArcadeCabinetScene.ts`; run `node tools/arcade/bake-tv.mjs` after changing its geometry. The gameplay camera frames the CRT more closely, keeping the joystick below the glass.

Cheat definitions and pinned source/checksum records are in `cheats/`. Fourteen native definitions come from finalburnneo/FBNeo-cheats; Raiden II uses only the P1 infinite-lives entry from the recorded stock-card source. The runner loads these into `/fbneo/cheats/` before boot and exposes the actual `fbneo-cheat-*` core options. Options default to off and switching games reloads that game's definitions. Changing an option uses the native `setVariable` interface; it is not a simulated toggle. Individual game/ROM-specific effects still depend on the matched ROM revision.
