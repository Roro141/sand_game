import { startCamera, createFrameGrabber } from "./camera.js";
import { BackgroundModel, majorityFilter, frameDifference } from "./vision.js";

const GRID_W = 200, GRID_H = 150;
const BG_THRESHOLD = 70;      // how different from the empty scene counts as "you"
const MOTION_THRESHOLD = 90;  // how much change between frames counts as "moving"
const CAPTURE_SECONDS = 3;

const view = document.getElementById("view");
const ctx = view.getContext("2d");
const status = document.getElementById("status");
const recaptureBtn = document.getElementById("recapture");
const video = document.createElement("video");

const small = document.createElement("canvas");
small.width = GRID_W; small.height = GRID_H;
const smallCtx = small.getContext("2d");
const image = smallCtx.createImageData(GRID_W, GRID_H);

const background = new BackgroundModel(GRID_W, GRID_H);
let rawMask = new Uint8Array(GRID_W * GRID_H);
let body = new Uint8Array(GRID_W * GRID_H);     // cleaned silhouette
let motion = new Uint8Array(GRID_W * GRID_H);   // pixels moving right now
let prevFrame = null;

let grab = null;
let captureUntil = 0; // while now < captureUntil we are learning the background

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

function frame(now) {
  const pixels = grab && grab();
  if (pixels) {
    if (now < captureUntil) {
      // Learning phase: skip the first few frames while the camera settles.
      if (captureUntil - now < (CAPTURE_SECONDS - 0.5) * 1000) background.addSample(pixels);
      status.textContent = `Lean out of the frame… ${Math.ceil((captureUntil - now) / 1000)}`;
    } else if (background.ready) {
      status.textContent = "";
      background.subtract(pixels, BG_THRESHOLD, rawMask);
      majorityFilter(rawMask, GRID_W, GRID_H, 5, body);
      background.adapt(pixels, body, 0.004);
    }
    if (prevFrame) frameDifference(prevFrame, pixels, GRID_W, GRID_H, MOTION_THRESHOLD, motion);
    prevFrame = prevFrame || new Uint8ClampedArray(pixels.length);
    prevFrame.set(pixels);

    // Debug view: dim camera, silhouette in blue, motion in white.
    const out = image.data;
    for (let k = 0, i = 0; k < body.length; k++, i += 4) {
      const grey = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3 * 0.35;
      if (motion[k]) { out[i] = 255; out[i + 1] = 255; out[i + 2] = 255; }
      else if (body[k] && background.ready && now >= captureUntil) { out[i] = 60; out[i + 1] = 140; out[i + 2] = 255; }
      else { out[i] = grey; out[i + 1] = grey; out[i + 2] = grey; }
      out[i + 3] = 255;
    }
    smallCtx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, view.width, view.height);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
