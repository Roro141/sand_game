// How the player's body pushes sand around.
//
// The silhouette is "solid", so grains pile on it. Two extra rules make it
// feel physical:
//
//   lift:   when the body moves INTO cells that hold grains (you raise your
//           hand under a pile), push those grains up to the nearest free cell
//           above, so the pile rides on your hand instead of passing through.
//
//   splash: grains touching fast-moving pixels get thrown up and sideways,
//           so a quick swipe flings sand.

import { EMPTY } from "./sand.js";

// Find a free cell for a grain stuck at (x, y): look straight up first,
// then up-and-sideways. Returns an index, or -1 if nothing is free nearby.
function freeCellAbove(world, solid, x, y, reach) {
  const W = world.width;
  for (let d = 1; d <= reach; d++) {
    const yy = y - d;
    if (yy < 0) break;
    for (const dx of [0, -1, 1, -2, 2]) {
      const xx = x + dx;
      if (xx < 0 || xx >= W) continue;
      const i = yy * W + xx;
      if (world.cells[i] === EMPTY && !solid[i]) return i;
    }
  }
  return -1;
}

// Returns how many grains were moved (and how many had to be removed).
export function liftGrains(world, solid, reach = 12) {
  const { width: W, height: H, cells } = world;
  let moved = 0, removed = 0;
  // Top to bottom, so upper grains move first and make room for lower ones.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (cells[i] === EMPTY || !solid[i]) continue;
      const j = freeCellAbove(world, solid, x, y, reach);
      if (j >= 0) { world.swap(i, j); moved++; }
      else { cells[i] = EMPTY; removed++; } // buried deep inside the body: let it go
    }
  }
  return { moved, removed };
}

// Throw grains that sit on or next to moving pixels.
// `chance` keeps it from being all-or-nothing; `height` is how far they fly.
export function splash(world, motion, solid, { chance = 0.35, height = 10, spread = 5 } = {}) {
  const { width: W, height: H, cells } = world;
  const rand = world.random;
  let thrown = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (cells[i] === EMPTY) continue;
      const near = motion[i] || motion[i + W] || motion[i - 1] || motion[i + 1];
      if (!near || rand() > chance) continue;
      const tx = x + Math.round((rand() * 2 - 1) * spread);
      const ty = y - 2 - Math.floor(rand() * height);
      if (tx < 0 || tx >= W || ty < 0) continue;
      const j = ty * W + tx;
      if (cells[j] === EMPTY && !solid[j]) { world.swap(i, j); thrown++; }
    }
  }
  return thrown;
}
