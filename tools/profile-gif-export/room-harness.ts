import "../../src/styles/arcade.css";
import "./room-harness.css";
import { ProfileSpriteStage } from "../../src/profile/ProfileSpriteStage";
import { ProfileRoomTv } from "../../src/profile/ProfileRoomTv";
import { ProfileRoomGifAutomaton } from "./ProfileRoomGifAutomaton";

declare global {
  interface Window {
    __profileRoomGifHarness?: {
      ready: boolean;
      setFrame: (frame: number) => void;
      validate: () => ReturnType<ProfileRoomGifAutomaton["validate"]>;
      getState: () => ReturnType<ProfileRoomGifAutomaton["sampleFrame"]>;
    };
  }
}

document.documentElement.dataset.profileGifExport = "room";
const root = document.querySelector<HTMLElement>("[data-profile-gif-room]");
if (!root) throw new Error("Profile Room GIF harness root is unavailable.");

const automaton = new ProfileRoomGifAutomaton();
const tv = new ProfileRoomTv(false);
const stage = new ProfileSpriteStage(root, {
  reducedMotion: false,
  onReset: () => undefined,
  onDoorInteraction: () => undefined,
  onActorInteraction: () => undefined
});
let currentFrame = 0;

window.__profileRoomGifHarness = {
  ready: false,
  setFrame(frame) {
    currentFrame = frame;
    const snapshot = automaton.sampleFrame(frame);
    tv.setTime(snapshot.simulationElapsed);
    stage.render(snapshot, tv);
  },
  validate: () => automaton.validate(),
  getState: () => automaton.sampleFrame(currentFrame)
};

await stage.init();
automaton.validate();
window.__profileRoomGifHarness.setFrame(0);
window.__profileRoomGifHarness.ready = true;
