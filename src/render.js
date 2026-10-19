// Turning the simulation into pixels.
//
// Everything is drawn into one small ImageData (one pixel per grid cell),
// then scaled up with smoothing off, so each grain is a crisp square.

import { SAND, WATER } from "./sand.js";

// Each palette is a list of colors; a grain's `shade` (0..255) picks one,
// so neighbouring grains vary slightly, like real sand.
export const PALETTES = {
  dune:   ["#f2c14e", "#e9b13f", "#f6d27a", "#dca33b", "#f8dc93"],
  sunset: ["#ff7a59", "#ff9f68", "#ffc26b", "#ff6f91", "#f9b384"],
  candy:  ["#ff8ad8", "#8be9fd", "#b8f28b", "#ffd36e", "#c3a6ff"],
  mint:   ["#7ee0b5", "#5fd1a8", "#a8f0cf", "#4fbf98", "#c2f5df"],
};
export const WATER_COLORS = ["#4aa3ff", "#5bb0ff", "#3d94f0", "#6cbaff"];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const lookup = (colors) => colors.map(hexToRgb);

export class Renderer {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d");
    this.image = this.ctx.createImageData(width, height);
    this.setPalette("dune");
    this.water = lookup(WATER_COLORS);
  }

  setPalette(name) { this.palette = lookup(PALETTES[name] || PALETTES.dune); }

  // camera: RGBA frame or null; body: silhouette mask or null.
  // In debug mode we show what the computer "sees": the camera in grey,
  // the detected body in blue and moving pixels in white.
  draw(world, camera, body, { showCamera = true, debug = false, motion = null } = {}) {
    const out = this.image.data, cells = world.cells, shade = world.shade;
    const pal = this.palette, water = this.water;
    for (let k = 0, i = 0; k < cells.length; k++, i += 4) {
      const c = cells[k];
      let r, g, b;
      if (debug) {
        const lum = camera ? (camera[i] + camera[i + 1] + camera[i + 2]) / 3 * 0.45 : 20;
        if (motion && motion[k]) { r = 255; g = 255; b = 255; }
        else if (body && body[k]) { r = 60; g = 140; b = 255; }
        else if (c !== 0) { r = 120; g = 100; b = 50; }
        else { r = lum; g = lum; b = lum; }
      }
      else if (c === SAND) [r, g, b] = pal[shade[k] % pal.length];
      else if (c === WATER) [r, g, b] = water[shade[k] % water.length];
      else if (body && body[k]) {
        // The player: a deep shadow with a hint of the camera image.
        const lum = camera ? (camera[i] + camera[i + 1] + camera[i + 2]) / 3 : 0;
        r = 28 + lum * 0.10; g = 44 + lum * 0.12; b = 78 + lum * 0.16;
      } else {
        // Background: night sky, with a faint ghost of the room if enabled.
        const lum = camera && showCamera ? (camera[i] + camera[i + 1] + camera[i + 2]) / 3 : 0;
        const fade = k / cells.length; // a little lighter toward the bottom
        r = 12 + lum * 0.08 + fade * 6; g = 22 + lum * 0.08 + fade * 10; b = 34 + lum * 0.09 + fade * 14;
      }
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
    }
    this.ctx.putImageData(this.image, 0, 0);
  }

  blitTo(ctx, w, h) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.canvas, 0, 0, w, h);
  }
}
