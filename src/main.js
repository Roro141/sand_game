import { startCamera, createFrameGrabber } from "./camera.js";

const GRID_W = 200, GRID_H = 150;

const view = document.getElementById("view");
const ctx = view.getContext("2d");
const status = document.getElementById("status");
const video = document.createElement("video");

// Small canvas at grid size; we scale it up when drawing so pixels stay chunky.
const small = document.createElement("canvas");
small.width = GRID_W; small.height = GRID_H;
const smallCtx = small.getContext("2d");
const image = smallCtx.createImageData(GRID_W, GRID_H);

let grab = null;

document.getElementById("start").addEventListener("click", async () => {
  try {
    status.textContent = "Starting camera…";
    await startCamera(video);
    grab = createFrameGrabber(video, GRID_W, GRID_H);
    status.textContent = "";
  } catch (err) {
    status.textContent = "Couldn't start the camera: " + err.message;
  }
});

function frame() {
  const pixels = grab && grab();
  if (pixels) {
    image.data.set(pixels);
    smallCtx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, view.width, view.height);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
