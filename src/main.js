import { startCamera, createFrameGrabber } from "./camera.js";
import { BackgroundModel, majorityFilter, frameDifference } from "./vision.js";
import { SandWorld, SAND, WATER, EMPTY } from "./sand.js";
import { liftGrains, splash } from "./interact.js";
import { Renderer } from "./render.js";

// ---- Settings you can play with -------------------------------------------
const GRID_W = 200, GRID_H = 150; // simulation size; bigger = finer sand, slower
const MOTION_THRESHOLD = 90;      // how much change between frames counts as "moving"
const CAPTURE_SECONDS = 3;        // how long to learn the empty room
const STREAM_RATE = 14;           // grains per frame in "streams" mode
const RAIN_RATE = 10;             // grains per frame in "rain" mode
const POINTER_RADIUS = 9;         // size of the mouse/finger shadow, in cells
const GRIP = 0.85;                // how well sand sticks to you (0 = slippery, 1 = glued)

// ---- Elements -----------------------------------------------------------
const $ = (id) => document.getElementById(id);
const view = $("view"), ctx = view.getContext("2d");
const stage = $("stage"), status = $("status");
const video = document.createElement("video");

// ---- State --------------------------------------------------------------
const N = GRID_W * GRID_H;
const background = new BackgroundModel(GRID_W, GRID_H);
const rawMask = new Uint8Array(N);
const body = new Uint8Array(N);     // cleaned silhouette = solid ground
const motion = new Uint8Array(N);   // pixels moving right now
let prevFrame = null;

const world = new SandWorld(GRID_W, GRID_H, { grip: GRIP });
const renderer = new Renderer(GRID_W, GRID_H);

const settings = { material: SAND, pour: "streams", debug: false, bgThreshold: 70 };
let mode = "idle";      // "idle" | "camera" | "pointer"
let grab = null;
let captureUntil = 0;
let frameNo = 0;

// ---- Camera -------------------------------------------------------------
function beginCapture() {
  background.reset();
  captureUntil = performance.now() + CAPTURE_SECONDS * 1000;
  $("capture").hidden = false;
}

$("start").addEventListener("click", async () => {
  try {
    status.textContent = "Starting camera…";
    await startCamera(video);
    grab = createFrameGrabber(video, GRID_W, GRID_H);
    mode = "camera";
    $("intro").hidden = true;
    $("recapture").hidden = false;
    beginCapture();
  } catch (err) {
    status.textContent = err.name === "NotAllowedError"
      ? "Camera access was blocked. Allow it from the address bar, or use your mouse instead."
      : location.protocol === "file:"
        ? "Browsers block the camera on pages opened as files. See the README for how to run a local server."
        : "Couldn't start the camera: " + err.message;
  }
});

// ---- Mouse / finger mode: the pointer is a round shadow ------------------
let pointer = null, lastPointer = null;
function toGrid(e) {
  const r = view.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * GRID_W, y: (e.clientY - r.top) / r.height * GRID_H };
}
$("pointerMode").addEventListener("click", () => { mode = "pointer"; $("intro").hidden = true; });
stage.addEventListener("pointerdown", (e) => {
  if (mode !== "pointer") return;
  stage.setPointerCapture(e.pointerId);
  pointer = toGrid(e);
});
stage.addEventListener("pointermove", (e) => { if (mode === "pointer" && pointer) pointer = toGrid(e); });
const release = () => { pointer = null; lastPointer = null; };
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);

function stampDisc(mask, cx, cy, r) {
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(GRID_H - 1, Math.ceil(cy + r)); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(GRID_W - 1, Math.ceil(cx + r)); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) mask[y * GRID_W + x] = 1;
}

// ---- Pouring ------------------------------------------------------------
function pour(now) {
  if (settings.pour === "off") return;
  const rain = settings.pour === "rain";
  const n = rain ? RAIN_RATE : STREAM_RATE;
  for (let k = 0; k < n; k++) {
    let x;
    if (rain) x = Math.floor(Math.random() * GRID_W);
    else {
      const nozzle = k % 3; // three nozzles that drift slowly
      const center = GRID_W * (0.2 + 0.3 * nozzle) + Math.sin(now / 1500 + nozzle * 2) * GRID_W * 0.08;
      x = Math.round(center + (Math.random() - 0.5) * 6);
    }
    const y = Math.floor(Math.random() * 3);
    if (world.get(x, y) === EMPTY && !body[y * GRID_W + x]) world.set(x, y, settings.material);
  }
}

// ---- Controls -----------------------------------------------------------
function pressOnly(selector, button) {
  document.querySelectorAll(selector).forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
}
document.querySelectorAll("[data-material]").forEach((b) => b.addEventListener("click", () => {
  settings.material = b.dataset.material === "water" ? WATER : SAND;
  pressOnly("[data-material]", b);
}));
document.querySelectorAll("[data-palette]").forEach((b) => b.addEventListener("click", () => {
  renderer.setPalette(b.dataset.palette);
  pressOnly("[data-palette]", b);
}));
function setPour(value) {
  settings.pour = value;
  pressOnly("[data-pour]", document.querySelector(`[data-pour="${value}"]`));
}
document.querySelectorAll("[data-pour]").forEach((b) => b.addEventListener("click", () => setPour(b.dataset.pour)));
const toggleDebug = () => { settings.debug = !settings.debug; $("debug").setAttribute("aria-pressed", String(settings.debug)); };
$("clear").addEventListener("click", () => world.clear());
$("snapshot").addEventListener("click", snapshot);
$("recapture").addEventListener("click", beginCapture);
$("debug").addEventListener("click", toggleDebug);
$("sensitivity").addEventListener("input", (e) => {
  // The slider reads as "sensitivity", so higher = smaller threshold.
  settings.bgThreshold = 180 - Number(e.target.value);
});
let lastPour = "streams";
window.addEventListener("keydown", (e) => {
  if (e.target.matches("input")) return;
  const k = e.key.toLowerCase();
  if (k === "c") world.clear();
  else if (k === "s") snapshot();
  else if (k === "d") toggleDebug();
  else if (k === "b" && mode === "camera") beginCapture();
  else if (k === "p") {
    if (settings.pour === "off") setPour(lastPour);
    else { lastPour = settings.pour; setPour("off"); }
  }
});

function snapshot() {
  const link = document.createElement("a");
  link.download = `shadow-sandbox-${Date.now()}.png`;
  link.href = view.toDataURL("image/png");
  link.click();
}

// ---- Main loop ----------------------------------------------------------
function frame(now) {
  frameNo++;
  let pixels = null;
  let solidActive = false;

  if (mode === "camera") {
    pixels = grab();
    if (pixels) {
      if (now < captureUntil) {
        if (captureUntil - now < (CAPTURE_SECONDS - 0.5) * 1000) background.addSample(pixels);
        $("count").textContent = Math.ceil((captureUntil - now) / 1000);
        body.fill(0); motion.fill(0);
      } else if (background.ready) {
        $("capture").hidden = true;
        background.subtract(pixels, settings.bgThreshold, rawMask);
        majorityFilter(rawMask, GRID_W, GRID_H, 5, body);
        background.adapt(pixels, body, 0.004);
        if (prevFrame) frameDifference(prevFrame, pixels, GRID_W, GRID_H, MOTION_THRESHOLD, motion);
        solidActive = true;
      }
      prevFrame = prevFrame || new Uint8ClampedArray(pixels.length);
      prevFrame.set(pixels);
    }
  } else if (mode === "pointer") {
    body.fill(0); motion.fill(0);
    if (pointer) {
      stampDisc(body, pointer.x, pointer.y, POINTER_RADIUS);
      const speed = lastPointer ? Math.hypot(pointer.x - lastPointer.x, pointer.y - lastPointer.y) : 0;
      if (speed > 2.5) stampDisc(motion, pointer.x, pointer.y, POINTER_RADIUS + 2);
      lastPointer = { ...pointer };
    }
    solidActive = true;
  }

  if (solidActive) {
    liftGrains(world, body);
    splash(world, motion, body);
  }
  pour(now);
  world.step(body);

  renderer.draw(world, pixels, solidActive ? body : null, { debug: settings.debug, motion });
  renderer.blitTo(ctx, view.width, view.height);

  if (frameNo % 15 === 0) {
    const n = world.count(SAND) + world.count(WATER);
    $("grains").textContent = `${n.toLocaleString()} grains`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
