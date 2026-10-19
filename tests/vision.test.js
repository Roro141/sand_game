import { test } from "node:test";
import assert from "node:assert/strict";
import { BackgroundModel, frameDifference, majorityFilter, coverage } from "../src/vision.js";

const W = 10, H = 8;

// Make an RGBA frame filled with one color, optionally with a rectangle of another.
function frame(bg, rect = null, color = [0, 0, 0]) {
  const f = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const inside = rect && x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
    const c = inside ? color : bg;
    const i = (y * W + x) * 4;
    f[i] = c[0]; f[i + 1] = c[1]; f[i + 2] = c[2]; f[i + 3] = 255;
  }
  return f;
}
const at = (mask, x, y) => mask[y * W + x];

test("background subtraction finds a still object", () => {
  const bg = new BackgroundModel(W, H);
  bg.addSample(frame([100, 120, 140]));
  const mask = bg.subtract(frame([100, 120, 140], { x: 2, y: 3, w: 3, h: 2 }, [220, 40, 40]), 60);
  assert.equal(at(mask, 3, 4), 1, "inside the object");
  assert.equal(at(mask, 8, 1), 0, "plain background");
  assert.equal(coverage(mask), 6 / (W * H));
});

test("small camera noise is not mistaken for a person", () => {
  const bg = new BackgroundModel(W, H);
  bg.addSample(frame([100, 100, 100]));
  const mask = bg.subtract(frame([110, 95, 104]), 60);
  assert.equal(coverage(mask), 0);
});

test("averaging samples smooths the background", () => {
  const bg = new BackgroundModel(W, H);
  bg.addSample(frame([90, 90, 90]));
  bg.addSample(frame([110, 110, 110]));
  assert.equal(bg.samples, 2);
  assert.equal(Math.round(bg.pixels[0]), 100);
});

test("adapt follows lighting changes but not the player", () => {
  const bg = new BackgroundModel(W, H);
  bg.addSample(frame([100, 100, 100]));
  const brighter = frame([140, 140, 140]);
  const mask = new Uint8Array(W * H);
  mask[0] = 1; // the player covers pixel 0
  for (let i = 0; i < 300; i++) bg.adapt(brighter, mask, 0.05);
  assert.ok(Math.abs(bg.pixels[3] - 140) < 1, "uncovered pixel learned the new light");
  assert.equal(bg.pixels[0], 100, "covered pixel kept the old background");
});

test("frame difference only marks what changed", () => {
  const a = frame([50, 50, 50], { x: 0, y: 0, w: 2, h: 2 }, [250, 250, 250]);
  const b = frame([50, 50, 50], { x: 1, y: 0, w: 2, h: 2 }, [250, 250, 250]);
  const diff = frameDifference(a, b, W, H, 60);
  assert.equal(at(diff, 0, 0), 1, "left edge uncovered");
  assert.equal(at(diff, 1, 0), 0, "still covered in both");
  assert.equal(at(diff, 2, 0), 1, "right edge newly covered");
  assert.equal(at(diff, 5, 5), 0);
});

test("majority filter removes specks and fills holes", () => {
  const m = new Uint8Array(W * H);
  m[1 * W + 8] = 1; // lone speck
  for (let y = 2; y < 7; y++) for (let x = 1; x < 6; x++) m[y * W + x] = 1; // 5x5 block
  m[4 * W + 3] = 0; // hole in the middle
  const out = majorityFilter(m, W, H);
  assert.equal(at(out, 8, 1), 0, "speck gone");
  assert.equal(at(out, 3, 4), 1, "hole filled");
  assert.equal(at(out, 2, 3), 1, "block kept");
});
