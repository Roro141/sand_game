import { test } from "node:test";
import assert from "node:assert/strict";
import { SandWorld, EMPTY, SAND, WATER, mulberry32 } from "../src/sand.js";

const world = (w, h, opts = {}) => new SandWorld(w, h, { random: mulberry32(42), drain: false, ...opts });
const run = (wld, n, solid) => { for (let i = 0; i < n; i++) wld.step(solid); };

test("a grain falls one cell per step", () => {
  const w = world(5, 6);
  w.set(2, 0, SAND);
  w.step();
  assert.equal(w.get(2, 0), EMPTY);
  assert.equal(w.get(2, 1), SAND);
});

test("a grain lands on the floor and stops", () => {
  const w = world(5, 6);
  w.set(2, 0, SAND);
  run(w, 20);
  assert.equal(w.get(2, 5), SAND);
  assert.equal(w.count(SAND), 1);
});

test("grains are never created or destroyed when draining is off", () => {
  const w = world(30, 30);
  for (let x = 5; x < 25; x++) { w.set(x, 0, SAND); w.set(x, 2, WATER); }
  run(w, 200);
  assert.equal(w.count(SAND), 20);
  assert.equal(w.count(WATER), 20);
});

test("a column of sand slumps into a pile, not a tower", () => {
  const w = world(21, 15);
  for (let y = 0; y < 10; y++) w.set(10, y, SAND);
  run(w, 100);
  const height = (x) => { let h = 0; for (let y = 0; y < 15; y++) if (w.get(x, y) === SAND) h++; return h; };
  assert.ok(height(10) < 10, "center column got shorter");
  assert.ok(height(9) + height(11) > 0, "neighbours got some sand");
});

test("water spreads flat across the floor", () => {
  const w = world(20, 6);
  for (let y = 0; y < 5; y++) w.set(10, y, WATER);
  run(w, 200);
  let bottom = 0;
  for (let x = 0; x < 20; x++) if (w.get(x, 5) === WATER) bottom++;
  assert.equal(bottom, 5, "all five drops ended up in the bottom row");
});

test("sand sinks below water", () => {
  const w = world(1, 4);
  w.set(0, 3, WATER);
  w.set(0, 2, SAND);
  run(w, 3);
  assert.equal(w.get(0, 3), SAND);
  assert.equal(w.get(0, 2), WATER);
});

test("solid cells hold sand up", () => {
  const w = world(5, 10);
  const solid = new Uint8Array(5 * 10);
  for (let x = 0; x < 5; x++) solid[6 * 5 + x] = 1; // a shelf on row 6
  w.set(2, 0, SAND);
  run(w, 30, solid);
  assert.equal(w.get(2, 5), SAND, "resting on the shelf");
});

test("grip keeps sand resting on a solid peak from sliding off", () => {
  const peak = new Uint8Array(5 * 6);
  peak[3 * 5 + 2] = 1; // one solid cell: the top of a head
  const slippery = world(5, 6);
  slippery.set(2, 2, SAND);
  run(slippery, 10, peak);
  assert.notEqual(slippery.get(2, 2), SAND, "without grip it rolls off");

  const grippy = world(5, 6, { grip: 1 });
  grippy.set(2, 2, SAND);
  run(grippy, 10, peak);
  assert.equal(grippy.get(2, 2), SAND, "with full grip it stays");
});

test("grip does not stop sand sliding off other sand", () => {
  const w = world(9, 6, { grip: 1 });
  w.set(4, 5, SAND);
  w.set(4, 4, SAND);
  run(w, 10);
  assert.equal(w.get(4, 4), EMPTY, "top grain slid off the grain below");
});

test("draining removes grains that reach the bottom", () => {
  const w = world(5, 6, { drain: true });
  w.set(2, 0, SAND);
  run(w, 20);
  assert.equal(w.count(SAND), 0);
});
