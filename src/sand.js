// A falling-sand world: a cellular automaton.
//
// The world is a grid. Each cell is EMPTY, SAND or WATER. Every frame we walk
// the grid from the bottom up and let each grain follow a few simple rules:
//
//   SAND:  fall straight down if there's room; otherwise slide down-left or
//          down-right; sinks through water (swaps places with it).
//   WATER: same as sand, but if it can't go down it flows sideways.
//
// Piles, slopes and puddles all come out of these rules; nothing is scripted.
//
// "solid" is a separate mask (1 = blocked) for things that aren't grains,
// like the player's silhouette. Grains can't move into solid cells.

export const EMPTY = 0, SAND = 1, WATER = 2;

// Small, fast, seedable random number generator (so tests are repeatable).
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SandWorld {
  constructor(width, height, { random = Math.random, drain = true } = {}) {
    this.width = width;
    this.height = height;
    this.random = random;
    this.drain = drain;                       // grains that reach the bottom disappear
    this.cells = new Uint8Array(width * height);
    this.shade = new Uint8Array(width * height); // per-grain color variation, 0..255
    this.stamp = new Uint32Array(width * height); // last frame a cell was moved into
    this.frame = 1;
    this.noSolid = new Uint8Array(width * height);
  }

  index(x, y) { return y * this.width + x; }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1; // outside
    return this.cells[y * this.width + x];
  }

  set(x, y, type, shade = Math.floor(this.random() * 256)) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = y * this.width + x;
    this.cells[i] = type;
    this.shade[i] = shade;
  }

  clear() { this.cells.fill(EMPTY); }

  count(type) {
    let n = 0;
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i] === type) n++;
    return n;
  }

  // Move the grain at index a to index b, swapping whatever was at b.
  swap(a, b) {
    const c = this.cells[a], s = this.shade[a];
    this.cells[a] = this.cells[b]; this.shade[a] = this.shade[b];
    this.cells[b] = c; this.shade[b] = s;
    this.stamp[b] = this.frame;
    if (this.cells[a] !== EMPTY) this.stamp[a] = this.frame;
  }

  // Can a grain of `type` move into (x, y)? Sand may displace water.
  canEnter(x, y, type, solid) {
    if (x < 0 || x >= this.width || y < 0) return false;
    if (y >= this.height) return false;
    const i = y * this.width + x;
    if (solid[i]) return false;
    const target = this.cells[i];
    return target === EMPTY || (type === SAND && target === WATER);
  }

  step(solid = this.noSolid) {
    const { width: W, height: H, cells } = this;
    this.frame++;

    // The bottom row drains away, so sand that misses you doesn't flood the screen.
    if (this.drain) {
      for (let x = 0; x < W; x++) cells[(H - 1) * W + x] = EMPTY;
    }

    // Alternate scan direction each frame so piles don't lean one way.
    const leftToRight = this.frame % 2 === 0;
    for (let y = H - 2; y >= 0; y--) {
      for (let n = 0; n < W; n++) {
        const x = leftToRight ? n : W - 1 - n;
        const i = y * W + x;
        const type = cells[i];
        if (type === EMPTY || this.stamp[i] === this.frame) continue;

        // 1. Straight down.
        if (this.canEnter(x, y + 1, type, solid)) { this.swap(i, i + W); continue; }

        // 2. Diagonally down, in a random order.
        const dir = this.random() < 0.5 ? -1 : 1;
        if (this.canEnter(x + dir, y + 1, type, solid)) { this.swap(i, i + W + dir); continue; }
        if (this.canEnter(x - dir, y + 1, type, solid)) { this.swap(i, i + W - dir); continue; }

        // 3. Water flows sideways when it can't fall.
        if (type === WATER) {
          if (this.get(x + dir, y) === EMPTY && !solid[i + dir]) { this.swap(i, i + dir); continue; }
          if (this.get(x - dir, y) === EMPTY && !solid[i - dir]) { this.swap(i, i - dir); continue; }
        }
      }
    }
  }
}
