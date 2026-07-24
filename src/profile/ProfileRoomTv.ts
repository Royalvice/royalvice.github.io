export type ProfileRoomTvState = {
  frame: number;
  pelletsRemaining: number;
  cycleElapsed: number;
};

type Point = [number, number];

const makePath = (): Point[] => {
  const result: Point[] = [];
  const appendLine = (x1: number, y1: number, x2: number, y2: number, step = 4) => {
    const distance = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    const count = Math.max(1, Math.round(distance / step));
    for (let index = 0; index < count; index += 1) {
      const t = index / count;
      result.push([Math.round(x1 + (x2 - x1) * t), Math.round(y1 + (y2 - y1) * t)]);
    }
  };
  appendLine(8, 10, 88, 10);
  appendLine(88, 10, 88, 34);
  appendLine(88, 34, 68, 34);
  appendLine(68, 34, 68, 58);
  appendLine(68, 58, 28, 58);
  appendLine(28, 58, 28, 34);
  appendLine(28, 34, 8, 34);
  appendLine(8, 34, 8, 10);
  appendLine(8, 18, 42, 18);
  appendLine(42, 18, 42, 46);
  appendLine(42, 46, 82, 46);
  appendLine(82, 46, 82, 62);
  appendLine(82, 62, 14, 62);
  appendLine(14, 62, 14, 22);
  appendLine(14, 22, 56, 22);
  appendLine(56, 22, 56, 50);
  appendLine(56, 50, 20, 50);
  appendLine(20, 50, 20, 10);
  return result;
};

const ROUTE = makePath();

export class ProfileRoomTv {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: ProfileRoomTvState = { frame: 0, pelletsRemaining: ROUTE.length, cycleElapsed: 0 };

  constructor(private reducedMotion: boolean) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 96;
    this.canvas.height = 72;
    const context = this.canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Profile room TV Canvas2D is unavailable.");
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
    this.setTime(0);
  }

  setTime(seconds: number): void {
    const effective = this.reducedMotion ? 13.4 : Math.max(0, seconds);
    const cycle = effective % 35;
    const frame = Math.floor(effective * 10);
    const routeIndex = Math.floor(cycle * 5.25) % ROUTE.length;
    const eaten = Math.min(ROUTE.length - 12, Math.floor(cycle * 3.2));
    this.state = {
      frame,
      pelletsRemaining: ROUTE.length - eaten,
      cycleElapsed: cycle
    };
    this.draw(routeIndex, eaten, cycle);
  }

  reset(): void {
    this.setTime(0);
  }

  getState(): ProfileRoomTvState {
    return { ...this.state };
  }

  private draw(routeIndex: number, eaten: number, cycle: number): void {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#01020a";
    ctx.fillRect(0, 0, 96, 72);

    ctx.fillStyle = "#1725b8";
    ctx.fillRect(2, 2, 92, 2);
    ctx.fillRect(2, 68, 92, 2);
    ctx.fillRect(2, 2, 2, 26);
    ctx.fillRect(2, 42, 2, 28);
    ctx.fillRect(92, 2, 2, 26);
    ctx.fillRect(92, 42, 2, 28);
    ctx.fillRect(26, 14, 18, 2);
    ctx.fillRect(52, 14, 18, 2);
    ctx.fillRect(26, 16, 2, 14);
    ctx.fillRect(68, 16, 2, 14);
    ctx.fillRect(34, 28, 28, 2);
    ctx.fillRect(34, 28, 2, 14);
    ctx.fillRect(60, 28, 2, 14);
    ctx.fillRect(34, 40, 10, 2);
    ctx.fillRect(52, 40, 10, 2);
    ctx.fillRect(12, 40, 14, 2);
    ctx.fillRect(70, 40, 14, 2);
    ctx.fillRect(12, 52, 2, 10);
    ctx.fillRect(82, 52, 2, 10);
    ctx.fillStyle = "#5274ff";
    ctx.fillRect(4, 4, 88, 1);
    ctx.fillRect(4, 67, 88, 1);
    ctx.fillRect(35, 29, 26, 1);

    ctx.fillStyle = "#f4dca0";
    for (let index = eaten; index < ROUTE.length; index += 2) {
      const [x, y] = ROUTE[index];
      ctx.fillRect(x, y, 1, 1);
    }
    for (const [x, y] of [[8, 10], [88, 10], [8, 62], [88, 62]] as Point[]) {
      ctx.fillStyle = "#fff4ca";
      ctx.fillRect(x - 1, y - 1, 3, 3);
    }

    const death = cycle >= 31.5 && cycle < 33.2;
    if (!death || Math.floor(cycle * 12) % 2 === 0) {
      const [px, py] = ROUTE[routeIndex];
      const next = ROUTE[(routeIndex + 1) % ROUTE.length];
      const angle = Math.atan2(next[1] - py, next[0] - px);
      const bite = (Math.sin(this.state.frame * 0.7) * 0.5 + 0.5) * 0.48;
      ctx.fillStyle = "#ffd43b";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, death ? 2 : 4, angle + bite, angle + Math.PI * 2 - bite);
      ctx.closePath();
      ctx.fill();
    }

    const ghostColors = ["#ff4b5f", "#ff8bd9", "#58dded", "#ff9b3f"];
    ghostColors.forEach((color, index) => {
      const chase = cycle % 12 < 8;
      const offset = chase ? 11 + index * 13 : 42 + index * 17;
      const point = ROUTE[(routeIndex + offset) % ROUTE.length];
      this.drawGhost(point[0], point[1], color, index);
    });

    // CRT scanlines and a tiny deterministic score strip.
    ctx.fillStyle = "rgba(0,0,0,.20)";
    for (let y = 1; y < 72; y += 3) ctx.fillRect(0, y, 96, 1);
    ctx.fillStyle = "#e8f1ff";
    const score = Math.max(0, eaten * 10).toString().padStart(4, "0");
    for (let index = 0; index < score.length; index += 1) {
      const value = Number(score[index]);
      ctx.fillRect(42 + index * 4, 5, 2, 1 + value % 3);
    }
    ctx.fillStyle = "rgba(190,238,255,.12)";
    ctx.fillRect(5, 5, 2, 58);
  }

  private drawGhost(x: number, y: number, color: string, index: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.fillRect(x - 3, y - 1, 7, 5);
    ctx.beginPath();
    ctx.arc(x + 0.5, y - 1, 3.5, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#f4f5ff";
    ctx.fillRect(x - 2, y - 2, 2, 2);
    ctx.fillRect(x + 1, y - 2, 2, 2);
    ctx.fillStyle = "#14237d";
    const shift = index % 2;
    ctx.fillRect(x - 2 + shift, y - 2, 1, 1);
    ctx.fillRect(x + 1 + shift, y - 2, 1, 1);
    ctx.fillStyle = "#01020a";
    ctx.fillRect(x - 2, y + 3, 1, 1);
    ctx.fillRect(x + 1, y + 3, 1, 1);
  }
}
