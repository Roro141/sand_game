import { startCamera, createFrameGrabber } from "./camera.js";
import { BackgroundModel, majorityFilter, frameDifference } from "./vision.js";
import { SandWorld, SAND, WATER } from "./sand.js";
import { liftGrains, splash } from "./interact.js";
import { Renderer } from "./render.js";

const GRID_W = 200, GRID_H = 150;
const BG_THRESHOLD = 70;      // how different from the empty scene counts as "you"
const MOTION_THRESHOLD = 90;  // how much change between frames counts as "moving"
const CAPTURE_SECONDS = 3;
const POUR_RATE = 14;         // grains added per frame

const view = document.getElementById("view");
const ctx = view.getContext("2d");
const status = document.getElementById("status");
const recaptureBtn = document.getElementById("recapture");
const video = document.createElement("video");

const background = new BackgroundModel(GRID_W, GRID_H);
const rawMask = new Uint8Array(GRID_W * GRID_H);
const body = new Uint8Array(GRID_W * GRID_H);     // cleaned silhouette = solid ground
const motion = new Uint8Array(GRID_W * GRID_H);   // pixels moving right now
const noBody = new Uint8Array(GRID_W * GRID_H);
let prevFrame = null;

const world = new SandWorld(GRID_W, GRID_H);
const renderer = new Renderer(GRID_W, GRID_H);
let material = SAND;

let grab = null;
let captureUntil = 0;

function beginCapture() {
  background.reset();
  captureUntil = performance.now() + CAPTURE_SECONDS * 1000;
}

document.getElementById("start").addEventListener("click", async () => {
  try {
    status.textContent = "Starting camera…";
    await startCamera(video);
    grab = createFrameGrabber(video, GRID_W, GRID_H);
    recaptureBtn.hidden = false;
    beginCapture();
  } catch (err) {
    status.textContent = "Couldn't start the camera: " + err.message;
  }
});
recaptureBtn.addEventListener("click", beginCapture);

// Sand pours from three nozzles that drift slowly, so it doesn't always
// land in the same spot.
function pour(now) {
  for (let n = 0; n < POUR_RATE; n++) {
    const nozzle = n % 3;
    const center = GRID_W * (0.2 + 0.3 * nozzle) + Math.sin(now / 1500 + nozzle * 2) * GRID_W * 0.08;
    const x = Math.round(center + (Math.random() - 0.5) * 6);
    const y = Math.floor(Math.random() * 3);
    if (world.get(x, y) === 0) world.set(x, y, material);
  }
}

function frame(now) {
  const pixels = grab ? grab() : null;
  let tracking = false;

  if (pixels) {
    if (now < captureUntil) {
      if (captureUntil - now < (CAPTURE_SECONDS - 0.5) * 1000) background.addSample(pixels);
      status.textContent = `Lean out of the frame… ${Math.ceil((captureUntil - now) / 1000)}`;
    } else if (background.ready) {
      status.textContent = "";
      background.subtract(pixels, BG_THRESHOLD, rawMask);
      majorityFilter(rawMask, GRID_W, GRID_H, 5, body);
      background.adapt(pixels, body, 0.004);
      tracking = true;
    }
    if (prevFrame) frameDifference(prevFrame, pixels, GRID_W, GRID_H, MOTION_THRESHOLD, motion);
    prevFrame = prevFrame || new Uint8ClampedArray(pixels.length);
    prevFrame.set(pixels);
  }

  const solid = tracking ? body : noBody;
  if (tracking) {
    liftGrains(world, solid);
    splash(world, motion, solid);
  }
  pour(now);
  world.step(solid);

  renderer.draw(world, pixels, tracking ? body : null);
  renderer.blitTo(ctx, view.width, view.height);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
