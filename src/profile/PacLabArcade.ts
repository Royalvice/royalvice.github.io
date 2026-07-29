type Direction = "left" | "right" | "up" | "down" | "none";
type ActiveDirection = Exclude<Direction, "none">;
type PacLabPhase = "ready" | "playing" | "paused" | "dying" | "level-clear" | "game-over";
type SpecterState = "normal" | "frightened" | "eaten";

type Point = { x: number; y: number };
type MovingEntity = Point & { direction: Direction; speed: number };
type Specter = MovingEntity & {
  id: number;
  color: string;
  state: SpecterState;
  lastDecision: string;
};

export type PacLabDebugState = {
  open: boolean;
  phase: PacLabPhase;
  score: number;
  highScore: number;
  lives: number;
  level: number;
  pelletsRemaining: number;
  frightenedRemaining: number;
  bonusActive: boolean;
  player: { x: number; y: number; direction: Direction; queuedDirection: Direction };
  specters: Array<{ id: number; x: number; y: number; direction: Direction; state: SpecterState }>;
};

type PacLabArcadeOptions = {
  reducedMotion: boolean;
  onClose?: () => void;
};

type Maze = {
  tiles: string[][];
  pellets: Set<string>;
  powerPellets: Set<string>;
  totalPellets: number;
};

const GRID_WIDTH = 21;
const GRID_HEIGHT = 23;
const TILE = 22;
const HUD_HEIGHT = 66;
const CANVAS_WIDTH = GRID_WIDTH * TILE;
const CANVAS_HEIGHT = HUD_HEIGHT + GRID_HEIGHT * TILE + 20;
const FIXED_STEP = 1 / 120;
const PLAYER_SPAWN: Point = { x: 10, y: 17 };
const BONUS_SPAWN: Point = { x: 10, y: 14 };
const SPECTER_SPAWNS: Point[] = [
  { x: 10, y: 9 },
  { x: 9, y: 10 },
  { x: 10, y: 10 },
  { x: 11, y: 10 }
];
const DIRECTIONS: ActiveDirection[] = ["left", "up", "right", "down"];
const VECTORS: Record<ActiveDirection, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 }
};
const OPPOSITE: Record<ActiveDirection, ActiveDirection> = {
  left: "right",
  right: "left",
  up: "down",
  down: "up"
};
const SPECTER_COLORS = ["#ef5d62", "#65dce5", "#f18dcc", "#edaa56"];
const HIGH_SCORE_KEY = "royalvice.paclab.high-score.v1";

const cellKey = (x: number, y: number): string => `${x},${y}`;
const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value));

function createMaze(): Maze {
  const tiles = Array.from({ length: GRID_HEIGHT }, () => Array.from({ length: GRID_WIDTH }, () => "."));
  for (let x = 0; x < GRID_WIDTH; x += 1) {
    tiles[0][x] = "#";
    tiles[GRID_HEIGHT - 1][x] = "#";
  }
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    tiles[y][0] = "#";
    tiles[y][GRID_WIDTH - 1] = "#";
  }

  const addRect = (x: number, y: number, width: number, height: number): void => {
    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) tiles[row][column] = "#";
    }
  };
  const addSymmetricRect = (x: number, y: number, width: number, height: number): void => {
    addRect(x, y, width, height);
    addRect(GRID_WIDTH - x - width, y, width, height);
  };

  // Original Pac-Lab archipelago: every obstacle is a finite island, so the
  // surrounding corridors remain connected while the silhouette stays
  // deliberately symmetric.
  addSymmetricRect(2, 2, 3, 2);
  addSymmetricRect(7, 2, 2, 2);
  addRect(10, 1, 1, 4);
  addSymmetricRect(2, 6, 2, 3);
  addSymmetricRect(6, 6, 3, 1);
  addSymmetricRect(6, 7, 1, 3);
  addRect(9, 5, 3, 1);
  addSymmetricRect(2, 12, 3, 2);
  addSymmetricRect(6, 14, 3, 1);
  addRect(9, 15, 3, 1);
  addSymmetricRect(2, 16, 2, 3);
  addSymmetricRect(6, 17, 3, 2);
  addSymmetricRect(2, 20, 5, 1);
  addSymmetricRect(8, 21, 1, 1);

  // Specter house and the only door tile. Players cannot enter through '=';
  // specters can leave and eaten specters can return.
  for (let x = 8; x <= 12; x += 1) {
    tiles[8][x] = x === 10 ? "=" : "#";
    tiles[12][x] = "#";
  }
  for (let y = 9; y <= 11; y += 1) {
    tiles[y][8] = "#";
    tiles[y][12] = "#";
    for (let x = 9; x <= 11; x += 1) tiles[y][x] = " ";
  }

  // A horizontal wrap tunnel crosses the screen behind the specter house.
  for (let x = 0; x <= 7; x += 1) tiles[11][x] = " ";
  for (let x = 13; x < GRID_WIDTH; x += 1) tiles[11][x] = " ";

  const powerCells: Point[] = [
    { x: 1, y: 1 }, { x: 19, y: 1 }, { x: 1, y: 21 }, { x: 19, y: 21 }
  ];
  for (const point of powerCells) tiles[point.y][point.x] = "o";
  tiles[PLAYER_SPAWN.y][PLAYER_SPAWN.x] = " ";
  tiles[BONUS_SPAWN.y][BONUS_SPAWN.x] = " ";

  const pellets = new Set<string>();
  const powerPellets = new Set<string>();
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      if (tiles[y][x] === ".") pellets.add(cellKey(x, y));
      if (tiles[y][x] === "o") powerPellets.add(cellKey(x, y));
    }
  }

  // Fail early if a later visual edit accidentally strands any collectible.
  const reachable = new Set<string>();
  const queue: Point[] = [{ ...PLAYER_SPAWN }];
  while (queue.length) {
    const point = queue.shift()!;
    const key = cellKey(point.x, point.y);
    if (reachable.has(key)) continue;
    reachable.add(key);
    for (const direction of DIRECTIONS) {
      const vector = VECTORS[direction];
      const next = { x: point.x + vector.x, y: point.y + vector.y };
      if (next.y === 11 && next.x < 0) next.x = GRID_WIDTH - 1;
      if (next.y === 11 && next.x >= GRID_WIDTH) next.x = 0;
      if (next.x < 0 || next.x >= GRID_WIDTH || next.y < 0 || next.y >= GRID_HEIGHT) continue;
      const tile = tiles[next.y][next.x];
      if (tile !== "#" && tile !== "=" && !reachable.has(cellKey(next.x, next.y))) queue.push(next);
    }
  }
  const unreachable = [...pellets, ...powerPellets].filter((key) => !reachable.has(key));
  if (unreachable.length) throw new Error(`Pac-Lab maze has ${unreachable.length} unreachable collectibles.`);

  return { tiles, pellets, powerPellets, totalPellets: pellets.size + powerPellets.size };
}

class PacLabGame {
  phase: PacLabPhase = "ready";
  score = 0;
  highScore = 0;
  lives = 3;
  level = 1;
  elapsed = 0;
  player: MovingEntity = { ...PLAYER_SPAWN, direction: "left", speed: 5.25 };
  queuedDirection: Direction = "left";
  specters: Specter[] = [];
  frightenedRemaining = 0;
  bonusActive = false;
  private bonusRemaining = 0;
  private bonusMilestones = new Set<number>();
  private maze = createMaze();
  private pellets = new Set(this.maze.pellets);
  private powerPellets = new Set(this.maze.powerPellets);
  private pelletsEaten = 0;
  private frightenedChain = 0;
  private modeElapsed = 0;
  private deathRemaining = 0;
  private levelClearRemaining = 0;
  private readyRemaining = -1;
  private resumePhase: PacLabPhase = "playing";
  private extraLifeAwarded = false;
  private randomState = 0x4f1bbcdc;

  constructor() {
    try {
      this.highScore = Math.max(0, Number(localStorage.getItem(HIGH_SCORE_KEY) || 0));
    } catch {
      this.highScore = 0;
    }
    this.resetEntities();
  }

  get pelletsRemaining(): number {
    return this.pellets.size + this.powerPellets.size;
  }

  get tiles(): string[][] {
    return this.maze.tiles;
  }

  get pelletCells(): ReadonlySet<string> {
    return this.pellets;
  }

  get powerPelletCells(): ReadonlySet<string> {
    return this.powerPellets;
  }

  reset(): void {
    this.phase = "ready";
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.elapsed = 0;
    this.extraLifeAwarded = false;
    this.resetLevel();
    this.readyRemaining = -1;
  }

  start(): void {
    if (this.phase === "game-over") this.reset();
    if (this.phase === "paused") {
      this.phase = this.resumePhase === "paused" ? "playing" : this.resumePhase;
      return;
    }
    if (this.phase === "ready") {
      this.readyRemaining = -1;
      this.phase = "playing";
    }
  }

  togglePause(): void {
    if (this.phase === "paused") {
      this.phase = this.resumePhase;
      return;
    }
    if (this.phase === "playing" || this.phase === "ready") {
      this.resumePhase = this.phase;
      this.phase = "paused";
    }
  }

  pause(): void {
    if (this.phase === "paused" || this.phase === "game-over") return;
    this.resumePhase = this.phase;
    this.phase = "paused";
  }

  setDirection(direction: ActiveDirection): void {
    this.queuedDirection = direction;
    if (this.phase === "ready") this.start();
  }

  advance(seconds: number): void {
    const steps = Math.min(36_000, Math.ceil(Math.max(0, seconds) / FIXED_STEP));
    for (let index = 0; index < steps; index += 1) this.step(FIXED_STEP);
  }

  step(dt: number): void {
    if (this.phase === "paused" || this.phase === "game-over") return;
    this.elapsed += dt;
    if (this.phase === "ready") {
      if (this.readyRemaining >= 0) {
        this.readyRemaining -= dt;
        if (this.readyRemaining <= 0) this.phase = "playing";
      }
      return;
    }
    if (this.phase === "dying") {
      this.deathRemaining -= dt;
      if (this.deathRemaining <= 0) this.finishDeath();
      return;
    }
    if (this.phase === "level-clear") {
      this.levelClearRemaining -= dt;
      if (this.levelClearRemaining <= 0) {
        this.level += 1;
        this.resetLevel();
        this.phase = "ready";
        this.readyRemaining = 1.15;
      }
      return;
    }

    this.modeElapsed += dt;
    if (this.frightenedRemaining > 0) {
      this.frightenedRemaining = Math.max(0, this.frightenedRemaining - dt);
      if (this.frightenedRemaining === 0) {
        this.specters.forEach((specter) => { if (specter.state === "frightened") specter.state = "normal"; });
        this.frightenedChain = 0;
      }
    }
    if (this.bonusActive) {
      this.bonusRemaining -= dt;
      if (this.bonusRemaining <= 0) this.bonusActive = false;
    }

    this.movePlayer(dt);
    this.consumeCollectible();
    this.updateBonus();
    this.moveSpecters(dt);
    this.resolveCollisions();
  }

  setScenario(name: "power-pellet" | "ghost-chain" | "death" | "level-clear"): void {
    if (name === "power-pellet") {
      this.phase = "playing";
      this.player.x = 1;
      this.player.y = 1;
      this.powerPellets.add(cellKey(1, 1));
      this.consumeCollectible();
      return;
    }
    if (name === "ghost-chain") {
      this.setScenario("power-pellet");
      const specter = this.specters[0];
      specter.state = "frightened";
      specter.x = this.player.x;
      specter.y = this.player.y;
      this.resolveCollisions();
      return;
    }
    if (name === "death") {
      this.phase = "playing";
      this.frightenedRemaining = 0;
      const specter = this.specters[0];
      specter.state = "normal";
      specter.x = this.player.x;
      specter.y = this.player.y;
      this.resolveCollisions();
      return;
    }
    this.phase = "playing";
    this.pellets.clear();
    this.powerPellets.clear();
    const key = cellKey(Math.round(this.player.x), Math.round(this.player.y));
    this.pellets.add(key);
    this.consumeCollectible();
  }

  private resetLevel(): void {
    this.maze = createMaze();
    this.pellets = new Set(this.maze.pellets);
    this.powerPellets = new Set(this.maze.powerPellets);
    this.pelletsEaten = 0;
    this.frightenedRemaining = 0;
    this.frightenedChain = 0;
    this.modeElapsed = 0;
    this.bonusActive = false;
    this.bonusRemaining = 0;
    this.bonusMilestones.clear();
    this.resetEntities();
  }

  private resetEntities(): void {
    this.player = {
      ...PLAYER_SPAWN,
      direction: "left",
      speed: Math.min(6.35, 5.25 + (this.level - 1) * .12)
    };
    this.queuedDirection = "left";
    this.specters = SPECTER_SPAWNS.map((spawn, id) => ({
      ...spawn,
      id,
      color: SPECTER_COLORS[id],
      state: "normal",
      direction: id % 2 ? "left" : "up",
      speed: Math.min(6.05, 4.35 + (this.level - 1) * .14 + id * .04),
      lastDecision: ""
    }));
  }

  private movePlayer(dt: number): void {
    this.moveEntity(this.player, dt, false, () => {
      if (this.queuedDirection !== "none" && this.canMove(this.player, this.queuedDirection, false)) {
        this.player.direction = this.queuedDirection;
      }
    });
  }

  private moveSpecters(dt: number): void {
    this.specters.forEach((specter) => {
      if (specter.state === "eaten" && Math.hypot(specter.x - 10, specter.y - 10) < .25) {
        specter.state = this.frightenedRemaining > 0 ? "frightened" : "normal";
      }
      this.moveEntity(specter, dt, true, () => {
        const key = cellKey(Math.round(specter.x), Math.round(specter.y));
        if (specter.lastDecision === key) return;
        specter.lastDecision = key;
        specter.direction = this.chooseSpecterDirection(specter);
      });
    });
  }

  private moveEntity(entity: MovingEntity, dt: number, ghost: boolean, atCenter: () => void): void {
    const centerX = Math.round(entity.x);
    const centerY = Math.round(entity.y);
    const deltaX = centerX - entity.x;
    const deltaY = centerY - entity.y;
    const vector = entity.direction === "none" ? null : VECTORS[entity.direction];
    const approachingCenter = vector ? deltaX * vector.x + deltaY * vector.y > 0 : false;
    const centered = Math.abs(deltaX) < .0001 && Math.abs(deltaY) < .0001;
    const crossingCenter = approachingCenter && Math.hypot(deltaX, deltaY) <= entity.speed * dt * 1.7 + .002;
    if (centered || crossingCenter) {
      entity.x = centerX;
      entity.y = centerY;
      atCenter();
      if (entity.direction !== "none" && !this.canMove(entity, entity.direction, ghost)) entity.direction = "none";
    }
    if (entity.direction !== "none") {
      const vector = VECTORS[entity.direction];
      const stateScale = ghost && (entity as Specter).state === "frightened" ? .66 : ghost && (entity as Specter).state === "eaten" ? 1.55 : 1;
      entity.x += vector.x * entity.speed * stateScale * dt;
      entity.y += vector.y * entity.speed * stateScale * dt;
    }
    if (Math.round(entity.y) === 11) {
      if (entity.x < -.65) entity.x = GRID_WIDTH - .35;
      if (entity.x > GRID_WIDTH - .35) entity.x = -.65;
    }
  }

  private canMove(entity: Point, direction: ActiveDirection, ghost: boolean): boolean {
    const vector = VECTORS[direction];
    let x = Math.round(entity.x) + vector.x;
    const y = Math.round(entity.y) + vector.y;
    if (y === 11 && x < 0) x = GRID_WIDTH - 1;
    if (y === 11 && x >= GRID_WIDTH) x = 0;
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
    const tile = this.maze.tiles[y][x];
    return tile !== "#" && (ghost || tile !== "=");
  }

  private chooseSpecterDirection(specter: Specter): Direction {
    const valid = DIRECTIONS.filter((direction) => this.canMove(specter, direction, true));
    if (!valid.length) return "none";
    const current = specter.direction === "none" ? null : specter.direction;
    const choices = current && valid.length > 1 ? valid.filter((direction) => direction !== OPPOSITE[current]) : valid;
    if (specter.state === "frightened") return choices[Math.floor(this.random() * choices.length)];

    const target = this.specterTarget(specter);
    return choices.reduce((best, direction) => {
      const vector = VECTORS[direction];
      const x = Math.round(specter.x) + vector.x;
      const y = Math.round(specter.y) + vector.y;
      const distance = Math.abs(x - target.x) + Math.abs(y - target.y);
      const bestVector = VECTORS[best];
      const bestDistance = Math.abs(Math.round(specter.x) + bestVector.x - target.x) + Math.abs(Math.round(specter.y) + bestVector.y - target.y);
      return distance < bestDistance ? direction : best;
    }, choices[0]);
  }

  private specterTarget(specter: Specter): Point {
    if (specter.state === "eaten") return { x: 10, y: 10 };
    const modePosition = this.modeElapsed % 52;
    const scatter = modePosition < 7 || (modePosition >= 27 && modePosition < 34);
    const corners: Point[] = [{ x: 19, y: 1 }, { x: 1, y: 1 }, { x: 19, y: 21 }, { x: 1, y: 21 }];
    if (scatter) return corners[specter.id];
    const playerTile = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
    const direction = this.player.direction === "none" ? "left" : this.player.direction;
    const ahead = VECTORS[direction];
    if (specter.id === 0) return playerTile;
    if (specter.id === 1) return { x: playerTile.x + ahead.x * 4, y: playerTile.y + ahead.y * 4 };
    if (specter.id === 2) {
      const leader = this.specters[0];
      const pivot = { x: playerTile.x + ahead.x * 2, y: playerTile.y + ahead.y * 2 };
      return { x: pivot.x * 2 - Math.round(leader.x), y: pivot.y * 2 - Math.round(leader.y) };
    }
    return Math.hypot(specter.x - playerTile.x, specter.y - playerTile.y) > 7 ? playerTile : corners[3];
  }

  private consumeCollectible(): void {
    const x = Math.round(this.player.x);
    const y = Math.round(this.player.y);
    if (Math.hypot(this.player.x - x, this.player.y - y) > .36) return;
    const key = cellKey(x, y);
    if (this.pellets.delete(key)) {
      this.addScore(10);
      this.pelletsEaten += 1;
    } else if (this.powerPellets.delete(key)) {
      this.addScore(50);
      this.pelletsEaten += 1;
      this.frightenedRemaining = Math.max(3, 7 - (this.level - 1) * .45);
      this.frightenedChain = 0;
      this.specters.forEach((specter) => {
        if (specter.state !== "eaten") specter.state = "frightened";
        if (specter.direction !== "none") specter.direction = OPPOSITE[specter.direction];
        specter.lastDecision = "";
      });
    }
    if (this.pelletsRemaining === 0 && this.phase === "playing") {
      this.phase = "level-clear";
      this.levelClearRemaining = 1.55;
      this.bonusActive = false;
    }
  }

  private updateBonus(): void {
    for (const milestone of [.35, .7]) {
      if (this.bonusMilestones.has(milestone)) continue;
      if (this.pelletsEaten / this.maze.totalPellets >= milestone) {
        this.bonusMilestones.add(milestone);
        this.bonusActive = true;
        this.bonusRemaining = 8;
      }
    }
    if (this.bonusActive && Math.hypot(this.player.x - BONUS_SPAWN.x, this.player.y - BONUS_SPAWN.y) < .58) {
      const values = [100, 300, 500, 700, 1_000, 2_000, 3_000, 5_000];
      this.addScore(values[Math.min(values.length - 1, this.level - 1)]);
      this.bonusActive = false;
    }
  }

  private resolveCollisions(): void {
    if (this.phase !== "playing") return;
    for (const specter of this.specters) {
      if (specter.state === "eaten" || Math.hypot(this.player.x - specter.x, this.player.y - specter.y) >= .56) continue;
      if (specter.state === "frightened") {
        specter.state = "eaten";
        this.addScore([200, 400, 800, 1_600][Math.min(3, this.frightenedChain)]);
        this.frightenedChain += 1;
        specter.lastDecision = "";
      } else {
        this.phase = "dying";
        this.deathRemaining = 1.25;
        break;
      }
    }
  }

  private finishDeath(): void {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = "game-over";
      return;
    }
    this.resetEntities();
    this.frightenedRemaining = 0;
    this.phase = "ready";
    this.readyRemaining = 1.15;
  }

  private addScore(points: number): void {
    this.score += points;
    if (!this.extraLifeAwarded && this.score >= 10_000) {
      this.extraLifeAwarded = true;
      this.lives += 1;
    }
    if (this.score <= this.highScore) return;
    this.highScore = this.score;
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
    } catch {
      // Storage can be disabled; the current run still keeps its high score.
    }
  }

  private random(): number {
    let state = this.randomState | 0;
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    this.randomState = state | 0;
    return (state >>> 0) / 0x1_0000_0000;
  }
}

function arrowSvg(direction: ActiveDirection): string {
  const rotation = { up: 0, right: 90, down: 180, left: 270 }[direction];
  return `<svg viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${rotation}deg)"><path d="M12 4 4.5 13h4.7v7h5.6v-7h4.7z"/></svg>`;
}

export class PacLabArcade {
  private readonly dialog: HTMLDialogElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly liveStatus: HTMLElement;
  private readonly game = new PacLabGame();
  private readonly listeners: Array<() => void> = [];
  private trigger: HTMLElement | null = null;
  private raf = 0;
  private lastFrame = 0;
  private accumulator = 0;
  private openState = false;
  private lastAnnouncedPhase: PacLabPhase | null = null;

  constructor(private options: PacLabArcadeOptions) {
    this.dialog = document.createElement("dialog");
    this.dialog.id = "paclab-dialog";
    this.dialog.className = "paclab-dialog";
    this.dialog.dataset.paclabDialog = "";
    this.dialog.setAttribute("aria-labelledby", "paclab-title");
    this.dialog.innerHTML = `
      <div class="paclab-cabinet" data-paclab-cabinet>
        <button class="paclab-close" type="button" data-paclab-close aria-label="Close Pac-Lab arcade"><span>Close</span><i aria-hidden="true">×</i></button>
        <header class="paclab-marquee">
          <span>PAC-LAB / HIDDEN PROGRAM</span>
          <h2 id="paclab-title">THE SPECTRAL MAZE</h2>
          <b>ORIGINAL NEURAL ARCADE SYSTEM</b>
        </header>
        <div class="paclab-instructions" aria-label="Game controls">
          <span><b>MOVE</b> WASD / ARROWS</span>
          <span><b>PAUSE</b> SPACE</span>
          <span><b>START</b> ENTER</span>
          <span><b>CLOSE</b> ESC</span>
        </div>
        <div class="paclab-bezel">
          <div class="paclab-crt-glass">
            <canvas class="paclab-canvas" data-paclab-canvas width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" tabindex="0" aria-label="Playable original maze chase. Use WASD or arrow keys to move."></canvas>
            <span class="paclab-scanlines" aria-hidden="true"></span>
            <span class="paclab-glass-flare" aria-hidden="true"></span>
          </div>
        </div>
        <div class="paclab-control-deck">
          <div class="paclab-dpad" aria-label="Touch movement controls">
            ${(["up", "left", "down", "right"] as ActiveDirection[]).map((direction) => `<button class="paclab-dir paclab-dir-${direction}" type="button" data-paclab-direction="${direction}" aria-label="Move ${direction}">${arrowSvg(direction)}</button>`).join("")}
          </div>
          <div class="paclab-deck-center" aria-hidden="true"><i></i><span>PAC-LAB<br>MODEL 05</span><i></i></div>
          <div class="paclab-actions">
            <button type="button" data-paclab-pause><i></i><span>Pause</span></button>
            <button type="button" data-paclab-start><i></i><span>Start</span></button>
          </div>
        </div>
        <footer class="paclab-base">
          <span class="paclab-speaker" aria-hidden="true"></span>
          <p>ONE PLAYER · LOCAL SYSTEM · NO NETWORK</p>
          <span class="paclab-power" aria-hidden="true"><i></i>POWER</span>
        </footer>
        <p class="sr-only" data-paclab-live aria-live="polite"></p>
      </div>
    `;
    document.body.append(this.dialog);
    const canvas = this.dialog.querySelector<HTMLCanvasElement>("[data-paclab-canvas]");
    const context = canvas?.getContext("2d", { alpha: false });
    const liveStatus = this.dialog.querySelector<HTMLElement>("[data-paclab-live]");
    if (!canvas || !context || !liveStatus) throw new Error("Pac-Lab Canvas2D could not be initialized.");
    this.canvas = canvas;
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
    this.liveStatus = liveStatus;

    this.bind(this.dialog.querySelector("[data-paclab-close]"), "click", () => this.close());
    this.bind(this.dialog.querySelector("[data-paclab-start]"), "click", () => this.start());
    this.bind(this.dialog.querySelector("[data-paclab-pause]"), "click", () => this.togglePause());
    this.dialog.querySelectorAll<HTMLButtonElement>("[data-paclab-direction]").forEach((button) => {
      this.bind(button, "pointerdown", ((event: PointerEvent) => {
        event.preventDefault();
        this.setDirection(button.dataset.paclabDirection as ActiveDirection);
      }) as EventListener);
    });
    this.bind(this.dialog, "keydown", ((event: KeyboardEvent) => this.onKeydown(event)) as EventListener);
    this.bind(this.dialog, "cancel", ((event: Event) => {
      event.preventDefault();
      this.close();
    }) as EventListener);
    this.bind(this.dialog, "pointerdown", ((event: PointerEvent) => {
      if (event.target === this.dialog) this.close();
    }) as EventListener);
    this.bind(document, "visibilitychange", () => {
      if (document.hidden && this.openState) this.game.pause();
    });
    this.installDebugHook();
    this.draw();
  }

  open(trigger?: HTMLElement | null): void {
    if (this.openState) return;
    this.trigger = trigger || document.querySelector<HTMLElement>("[data-profile-tv]");
    this.openState = true;
    document.documentElement.classList.add("has-paclab-open");
    this.dialog.showModal();
    this.canvas.focus({ preventScroll: true });
    this.lastFrame = performance.now();
    this.accumulator = 0;
    this.startLoop();
    this.draw();
  }

  close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.game.pause();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.dialog.open) this.dialog.close();
    document.documentElement.classList.remove("has-paclab-open");
    this.options.onClose?.();
    requestAnimationFrame(() => this.trigger?.focus({ preventScroll: true }));
  }

  start(): void {
    this.game.start();
    this.announce();
    this.draw();
  }

  pause(): void {
    this.game.pause();
    this.announce();
    this.draw();
  }

  resume(): void {
    if (this.game.phase === "paused") this.game.start();
    this.draw();
  }

  reset(): void {
    this.game.reset();
    this.announce();
    this.draw();
  }

  destroy(): void {
    this.close();
    this.listeners.splice(0).forEach((dispose) => dispose());
    this.dialog.remove();
    if (window.__pacLabDebug === this.debugHook) delete window.__pacLabDebug;
  }

  private togglePause(): void {
    this.game.togglePause();
    this.announce();
    this.draw();
  }

  private setDirection(direction: ActiveDirection): void {
    this.game.setDirection(direction);
    this.draw();
  }

  private onKeydown(event: KeyboardEvent): void {
    if (!this.openState || event.altKey || event.ctrlKey || event.metaKey) return;
    const directions: Record<string, ActiveDirection | undefined> = {
      ArrowLeft: "left", a: "left", A: "left",
      ArrowRight: "right", d: "right", D: "right",
      ArrowUp: "up", w: "up", W: "up",
      ArrowDown: "down", s: "down", S: "down"
    };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      this.setDirection(direction);
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      this.togglePause();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      this.start();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.close();
      return;
    }
    if (event.key === "Tab") this.trapFocus(event);
  }

  private trapFocus(event: KeyboardEvent): void {
    const focusable = [...this.dialog.querySelectorAll<HTMLElement>("button:not(:disabled),canvas[tabindex='0']")].filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private startLoop(): void {
    cancelAnimationFrame(this.raf);
    const tick = (now: number): void => {
      if (!this.openState) return;
      const delta = Math.min(.12, Math.max(0, (now - this.lastFrame) / 1_000));
      this.lastFrame = now;
      this.accumulator += delta;
      while (this.accumulator >= FIXED_STEP) {
        this.game.step(FIXED_STEP);
        this.accumulator -= FIXED_STEP;
      }
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#010404";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.drawHud(ctx);
    this.drawMaze(ctx);
    this.drawBonus(ctx);
    this.drawPlayer(ctx);
    this.game.specters.forEach((specter) => this.drawSpecter(ctx, specter));
    this.drawOverlay(ctx);
    this.announce();
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#030b0c";
    ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);
    ctx.fillStyle = "#8ba49d";
    ctx.font = "600 10px 'Courier New', monospace";
    ctx.textAlign = "left";
    ctx.fillText("SCORE", 15, 17);
    ctx.textAlign = "center";
    ctx.fillText("HIGH", CANVAS_WIDTH / 2, 17);
    ctx.textAlign = "right";
    ctx.fillText(`LEVEL ${String(this.game.level).padStart(2, "0")}`, CANVAS_WIDTH - 15, 17);
    ctx.fillStyle = "#f4d77e";
    ctx.font = "700 19px 'Courier New', monospace";
    ctx.textAlign = "left";
    ctx.fillText(String(this.game.score).padStart(7, "0"), 15, 42);
    ctx.textAlign = "center";
    ctx.fillText(String(this.game.highScore).padStart(7, "0"), CANVAS_WIDTH / 2, 42);
    ctx.textAlign = "right";
    ctx.fillStyle = "#75d6c5";
    ctx.fillText(`${"◆".repeat(Math.max(0, this.game.lives))}`, CANVAS_WIDTH - 15, 42);
    ctx.strokeStyle = "rgba(198,151,78,.34)";
    ctx.beginPath();
    ctx.moveTo(12, HUD_HEIGHT - 8.5);
    ctx.lineTo(CANVAS_WIDTH - 12, HUD_HEIGHT - 8.5);
    ctx.stroke();
  }

  private drawMaze(ctx: CanvasRenderingContext2D): void {
    for (let y = 0; y < GRID_HEIGHT; y += 1) {
      for (let x = 0; x < GRID_WIDTH; x += 1) {
        const tile = this.game.tiles[y][x];
        const left = x * TILE;
        const top = HUD_HEIGHT + y * TILE;
        if (tile === "#") {
          ctx.fillStyle = "#07161c";
          ctx.fillRect(left, top, TILE, TILE);
          ctx.strokeStyle = "#246d7b";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(left + 3.5, top + 3.5, TILE - 7, TILE - 7);
          ctx.fillStyle = "rgba(94,219,215,.12)";
          ctx.fillRect(left + 5, top + 5, TILE - 10, 2);
        } else if (tile === "=") {
          ctx.fillStyle = "#c58a48";
          ctx.fillRect(left + 2, top + 9, TILE - 4, 3);
          ctx.fillStyle = "#f4d792";
          ctx.fillRect(left + 5, top + 9, TILE - 10, 1);
        }
      }
    }
    ctx.fillStyle = "#e7c873";
    for (const key of this.game.pelletCells) {
      const [x, y] = key.split(",").map(Number);
      ctx.fillRect(x * TILE + TILE / 2 - 1.5, HUD_HEIGHT + y * TILE + TILE / 2 - 1.5, 3, 3);
    }
    const pulse = .72 + Math.sin(this.game.elapsed * 7) * .28;
    for (const key of this.game.powerPelletCells) {
      const [x, y] = key.split(",").map(Number);
      ctx.fillStyle = `rgba(255,231,151,${pulse})`;
      ctx.beginPath();
      ctx.arc(x * TILE + TILE / 2, HUD_HEIGHT + y * TILE + TILE / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBonus(ctx: CanvasRenderingContext2D): void {
    if (!this.game.bonusActive) return;
    const x = BONUS_SPAWN.x * TILE + TILE / 2;
    const y = HUD_HEIGHT + BONUS_SPAWN.y * TILE + TILE / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.game.elapsed * 1.8);
    ctx.fillStyle = "#e991b7";
    ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = "#ffe0f1";
    ctx.fillRect(-2, -5, 4, 4);
    ctx.strokeStyle = "#713654";
    ctx.strokeRect(-7.5, -7.5, 15, 15);
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const x = (this.game.player.x + .5) * TILE;
    const y = HUD_HEIGHT + (this.game.player.y + .5) * TILE;
    const angle = this.game.player.direction === "right" ? 0 : this.game.player.direction === "down" ? Math.PI / 2 : this.game.player.direction === "left" ? Math.PI : -Math.PI / 2;
    const bite = this.game.phase === "dying" ? clamp((1.25 - .4) * 1.6, .25, 1.4) : .18 + Math.abs(Math.sin(this.game.elapsed * 11)) * .28;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = this.game.phase === "dying" && Math.floor(this.game.elapsed * 12) % 2 ? "#fff0b1" : "#f4c951";
    ctx.shadowColor = "rgba(255,201,65,.46)";
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 8.4, bite, Math.PI * 2 - bite);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff4bf";
    ctx.fillRect(-1, -6, 3, 2);
    ctx.restore();
  }

  private drawSpecter(ctx: CanvasRenderingContext2D, specter: Specter): void {
    const x = (specter.x + .5) * TILE;
    const y = HUD_HEIGHT + (specter.y + .5) * TILE;
    ctx.save();
    ctx.translate(x, y);
    const flashing = this.game.frightenedRemaining < 1.6 && Math.floor(this.game.elapsed * 10) % 2 === 0;
    const color = specter.state === "frightened" ? (flashing ? "#dfe8d4" : "#3568aa") : specter.color;
    if (specter.state !== "eaten") {
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-8, -8, 16, 14, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#091116";
      ctx.fillRect(-7, 4, 4, 4);
      ctx.fillRect(-1, 4, 4, 4);
      ctx.fillRect(5, 4, 3, 4);
    }
    const eyeVector = specter.direction === "none" ? { x: 0, y: 0 } : VECTORS[specter.direction];
    ctx.fillStyle = "#f7f2d8";
    ctx.fillRect(-5, -4, 4, 5);
    ctx.fillRect(2, -4, 4, 5);
    ctx.fillStyle = specter.state === "frightened" ? "#101d37" : "#173f74";
    ctx.fillRect(-4 + eyeVector.x, -3 + eyeVector.y, 2, 2);
    ctx.fillRect(3 + eyeVector.x, -3 + eyeVector.y, 2, 2);
    ctx.restore();
  }

  private drawOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.game.phase === "playing" || this.game.phase === "dying") return;
    const labels: Record<Exclude<PacLabPhase, "playing" | "dying">, [string, string]> = {
      ready: ["SYSTEM READY", "PRESS ENTER OR CHOOSE A DIRECTION"],
      paused: ["SIMULATION HOLD", "SPACE OR ENTER TO RESUME"],
      "level-clear": ["FIELD CLEARED", "CALIBRATING NEXT LEVEL"],
      "game-over": ["RUN TERMINATED", "PRESS ENTER TO RESTART"]
    };
    const [title, subtitle] = labels[this.game.phase];
    const top = HUD_HEIGHT + GRID_HEIGHT * TILE / 2 - 38;
    ctx.fillStyle = "rgba(2,8,9,.88)";
    ctx.fillRect(35, top, CANVAS_WIDTH - 70, 76);
    ctx.strokeStyle = "rgba(222,177,94,.68)";
    ctx.strokeRect(39.5, top + 4.5, CANVAS_WIDTH - 79, 67);
    ctx.fillStyle = "#f2d596";
    ctx.font = "700 18px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(title, CANVAS_WIDTH / 2, top + 32);
    ctx.fillStyle = "#72cbbd";
    ctx.font = "600 9px 'Courier New', monospace";
    ctx.fillText(subtitle, CANVAS_WIDTH / 2, top + 53);
  }

  private announce(): void {
    if (this.lastAnnouncedPhase === this.game.phase) return;
    this.lastAnnouncedPhase = this.game.phase;
    this.liveStatus.textContent = `Pac-Lab ${this.game.phase}. Score ${this.game.score}. Level ${this.game.level}. Lives ${this.game.lives}.`;
  }

  private getState = (): PacLabDebugState => ({
    open: this.openState,
    phase: this.game.phase,
    score: this.game.score,
    highScore: this.game.highScore,
    lives: this.game.lives,
    level: this.game.level,
    pelletsRemaining: this.game.pelletsRemaining,
    frightenedRemaining: this.game.frightenedRemaining,
    bonusActive: this.game.bonusActive,
    player: { ...this.game.player, queuedDirection: this.game.queuedDirection },
    specters: this.game.specters.map((specter) => ({
      id: specter.id,
      x: specter.x,
      y: specter.y,
      direction: specter.direction,
      state: specter.state
    }))
  });

  private debugHook = {
    getState: () => this.getState(),
    open: () => this.open(),
    close: () => this.close(),
    start: () => this.start(),
    pause: () => this.pause(),
    reset: () => this.reset(),
    setDirection: (direction: ActiveDirection) => this.setDirection(direction),
    advanceTime: (seconds: number) => {
      this.game.advance(seconds);
      this.draw();
      return this.getState();
    },
    setScenario: (name: "power-pellet" | "ghost-chain" | "death" | "level-clear") => {
      this.game.setScenario(name);
      this.draw();
      return this.getState();
    }
  };

  private installDebugHook(): void {
    window.__pacLabDebug = this.debugHook;
  }

  private bind(target: EventTarget | null, event: string, callback: EventListener): void {
    if (!target) return;
    target.addEventListener(event, callback);
    this.listeners.push(() => target.removeEventListener(event, callback));
  }
}

declare global {
  interface Window {
    __pacLabDebug?: {
      getState: () => PacLabDebugState;
      open: () => void;
      close: () => void;
      start: () => void;
      pause: () => void;
      reset: () => void;
      setDirection: (direction: ActiveDirection) => void;
      advanceTime: (seconds: number) => PacLabDebugState;
      setScenario: (name: "power-pellet" | "ghost-chain" | "death" | "level-clear") => PacLabDebugState;
    };
  }
}
