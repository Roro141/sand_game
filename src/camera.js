// Webcam access and frame grabbing.
//
// A video frame is just a grid of pixels. To work with it we draw the <video>
// onto a small hidden canvas and read the pixels back with getImageData().
// We read it small (the same size as the sand grid), because comparing
// 40,000 pixels per frame is cheap and comparing 900,000 is not.

export async function startCamera(video) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser can't access a camera.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return stream;
}

// Returns a function that grabs the current video frame, mirrored (so it moves
// like a mirror would) and scaled to width x height, as RGBA bytes.
export function createFrameGrabber(video, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  return function grab() {
    // Crop the video to our aspect ratio so nothing gets squashed.
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    const target = width / height;
    let sw = vw, sh = vh, sx = 0, sy = 0;
    if (vw / vh > target) { sw = vh * target; sx = (vw - sw) / 2; }
    else { sh = vw / target; sy = (vh - sh) / 2; }

    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1); // mirror
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
    ctx.restore();
    return ctx.getImageData(0, 0, width, height).data;
  };
}
