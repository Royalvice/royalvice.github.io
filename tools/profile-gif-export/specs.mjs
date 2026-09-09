export const CARD_SPECS = {
  profile: {
    id: "profile-card",
    file: "profile-card.gif",
    selector: ".profile-dossier",
    layoutWidth: 800,
    layoutHeight: 340,
    captureScale: 3,
    width: 1920,
    height: 816,
    resample: "lanczos",
    frames: 192,
    duration: 8,
    keyframes: [0, 12, 36, 61, 84, 108, 168, 180, 191]
  },
  room: {
    id: "sprite-room",
    file: "sprite-room.gif",
    selector: "[data-profile-gif-room]",
    layoutWidth: 720,
    layoutHeight: 350,
    captureScale: 1,
    width: 720,
    height: 350,
    resample: null,
    frames: 1_440,
    duration: 60,
    keyframes: [0, 240, 480, 720, 960, 1_200, 1_320, 1_416, 1_439]
  },
  news: {
    id: "news-terminal",
    file: "news-terminal.gif",
    selector: ".terminal-canvas",
    layoutWidth: 1920,
    layoutHeight: 1080,
    captureScale: 1,
    width: 1920,
    height: 1080,
    resample: "lanczos",
    frames: 480,
    duration: 20,
    keyframes: [0, 58, 90, 160, 240, 300, 380, 440, 479]
  }
};
