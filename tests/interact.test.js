import { test } from "node:test";
import assert from "node:assert/strict";
import { SandWorld, SAND, EMPTY, mulberry32 } from "../src/sand.js";
import { liftGrains, splash } from "../src/interact.js";

const W = 20, H = 20;
const world = () => new SandWorld(W, H, { random: mulberry32(7), drain: false });
const mask = (fill) => { const m = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (fill(x, y)) m[y * W + x] = 1; return m; };

test("a rising hand carries the grain on top of it", () => {
  const w = world();
  w.set(10, 10, SAND);
  const hand = mask((x, y) => x >= 8 && x <= 12 && y >= 9 && y <= 12); // hand moved up into the grain
  const { moved } = liftGrains(w, hand);
  assert.equal(moved, 1);
  assert.equal(w.get(10, 10), EMPTY);
  assert.equal(w.get(10, 8), SAND, "grain now sits just above the hand");
});

test("lifting keeps every grain when there is room", () => {
  const w = world();
  for (let x = 5; x < 15; x++) w.set(x, 12, SAND);
  const body = mask((x, y) => y >= 10 && y <= 14);
  const { moved, removed } = liftGrains(w, body);
  assert.equal(moved, 10);
  assert.equal(removed, 0);
  assert.equal(w.count(SAND), 10);
  for (let x = 5; x < 15; x++) assert.equal(w.get(x, 12), EMPTY);
});

test("grains deep inside the body with no room are removed, not stuck", () => {
  const w = world();
  w.set(10, 15, SAND);
  const body = mask(() => true); // body fills the whole screen
  const { removed } = liftGrains(w, body);
  assert.equal(removed, 1);
  assert.equal(w.count(SAND), 0);
});

test("splash throws grains near motion upwards and keeps the rest", () => {
  const w = world();
  for (let x = 2; x < 18; x++) w.set(x, 15, SAND);
  const motion = mask((x, y) => y === 16 && x < 10); // fast movement under the left half
  const none = new Uint8Array(W * H);
  const thrown = splash(w, motion, none, { chance: 1 });
  assert.ok(thrown > 0, "some grains flew");
  assert.equal(w.count(SAND), 16, "no grains lost");
  for (let x = 11; x < 18; x++) assert.equal(w.get(x, 15), SAND, "right half untouched");
});
