// Finding the player in the camera image, without any machine learning.
//
// Two classic tricks:
//
// 1. Background subtraction: remember what the scene looks like with nobody
//    in it. Any pixel that now looks different is probably the player.
//    Works even when the player holds perfectly still.
//
// 2. Frame differencing: compare this frame with the previous one. Pixels
//    that changed a lot are moving right now. We use this for "splashing".
//
// Frames are RGBA byte arrays (4 bytes per pixel), as returned by
// getImageData(). Masks are Uint8Array with one byte per pixel: 1 = yes, 0 = no.

// How different two pixels are: sum of the red, green and blue differences (0..765).
export function colorDistance(a, i, b, j) {
  return Math.abs(a[i] - b[j]) + Math.abs(a[i + 1] - b[j + 1]) + Math.abs(a[i + 2] - b[j + 2]);
}

export class BackgroundModel {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixels = new Float32Array(width * height * 3); // averaged RGB
    this.samples = 0;
  }

  get ready() { return this.samples > 0; }

  reset() { this.pixels.fill(0); this.samples = 0; }

  // Average several frames so camera noise doesn't get baked in.
  addSample(frame) {
    const n = this.samples + 1;
    for (let p = 0, i = 0; p < this.pixels.length; p += 3, i += 4) {
      this.pixels[p] += (frame[i] - this.pixels[p]) / n;
      this.pixels[p + 1] += (frame[i + 1] - this.pixels[p + 1]) / n;
      this.pixels[p + 2] += (frame[i + 2] - this.pixels[p + 2]) / n;
    }
    this.samples = n;
  }

  // Mark pixels that differ from the background by more than `threshold`.
  subtract(frame, threshold, out = new Uint8Array(this.width * this.height)) {
    const bg = this.pixels;
    for (let k = 0, p = 0, i = 0; k < out.length; k++, p += 3, i += 4) {
      const d = Math.abs(frame[i] - bg[p]) + Math.abs(frame[i + 1] - bg[p + 1]) + Math.abs(frame[i + 2] - bg[p + 2]);
      out[k] = d > threshold ? 1 : 0;
    }
    return out;
  }

  // Slowly blend the current frame into the background, but only where the
  // player isn't. This keeps up with gradual lighting changes (clouds, lamps).
  adapt(frame, mask, rate = 0.01) {
    const bg = this.pixels;
    for (let k = 0, p = 0, i = 0; k < mask.length; k++, p += 3, i += 4) {
      if (mask[k]) continue;
      bg[p] += (frame[i] - bg[p]) * rate;
      bg[p + 1] += (frame[i + 1] - bg[p + 1]) * rate;
      bg[p + 2] += (frame[i + 2] - bg[p + 2]) * rate;
    }
  }
}

// Pixels that changed a lot since the previous frame.
export function frameDifference(prev, curr, width, height, threshold, out = new Uint8Array(width * height)) {
  for (let k = 0, i = 0; k < out.length; k++, i += 4) {
    out[k] = colorDistance(prev, i, curr, i) > threshold ? 1 : 0;
  }
  return out;
}

// Camera noise makes masks speckled. A "majority filter" fixes most of it:
// a pixel is on if at least `min` of the 9 pixels in its 3x3 block are on.
// Lone specks disappear and small holes get filled.
export function majorityFilter(mask, width, height, min = 5, out = new Uint8Array(width * height)) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          count += mask[yy * width + xx];
        }
      }
      out[y * width + x] = count >= min ? 1 : 0;
    }
  }
  return out;
}

// What fraction of the mask is on (handy for "is anyone there?" checks).
export function coverage(mask) {
  let on = 0;
  for (let k = 0; k < mask.length; k++) on += mask[k];
  return on / mask.length;
}
