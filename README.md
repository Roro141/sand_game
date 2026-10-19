# Shadow Sandbox

Sand falls from the sky and piles up on your webcam silhouette. Raise your hands to catch it, swipe to fling it, sit still and let it bury your shoulders.

It runs entirely in the browser in plain JavaScript: no frameworks, no libraries, no AI models. Your video never leaves your computer.

## Run it locally

Browsers only allow the camera on `https://` pages or on `localhost`. Opening `index.html` by double-clicking won't work. Start a small local server in this folder:

```bash
python3 -m http.server 8000     # or: npm start
```

Then open http://localhost:8000.

1. Click **Turn on camera** and allow access.
2. **Lean out of the picture for 3 seconds** so it can learn what the empty room looks like.
3. Lean back in and play.

No camera? Click "use your mouse or finger as the shadow".

| Key | Does |
|---|---|
| `P` | Stop / restart pouring |
| `C` | Clear all sand |
| `S` | Save a snapshot (PNG) |
| `B` | Re-learn the empty room (if you moved the camera or the light changed) |
| `D` | Debug view: what the camera "sees" |

**If your shadow looks wrong:** lower **Sensitivity** if your body has holes in it; raise it if bits of the room show up as you. A plain wall behind you and steady lighting work best. Don't sit in front of a window.

## Put it on GitHub and online

```bash
# 1. Create an empty repo on github.com (no README), then:
git remote add origin https://github.com/<your-username>/shadow-sandbox.git
git push -u origin main
```

To get a free public link: on GitHub open **Settings → Pages**, set **Source** to "Deploy from a branch", pick `main` and `/ (root)`, and save. After a minute it's live at `https://<your-username>.github.io/shadow-sandbox/`. GitHub Pages is `https://`, so the camera works there.

## Run the tests

```bash
npm test     # uses Node's built-in test runner, nothing to install (Node 18+)
```

20 tests cover silhouette detection, the sand rules and the body–sand interaction. They run in Node because those modules are pure functions over arrays with no browser APIs.

## How it works

The screen is a 200 × 150 grid. Every frame (~60 times a second):

```
camera frame ──► shrink to 200×150, mirror ──► compare to empty room ──► silhouette mask
                                         └──► compare to last frame  ──► motion mask
silhouette + motion ──► lift & splash grains ──► sand rules step ──► draw
```

### 1. Finding you without AI: background subtraction (`src/vision.js`)

When you lean out, the app averages a few frames of the empty room. After that, any pixel whose color differs from that saved image by more than a threshold is "you". This works even when you hold still, which simply comparing consecutive frames can't do.

Camera images are noisy, so the raw mask is speckled. A **majority filter** cleans it: a pixel stays on only if at least 5 of the 9 pixels around it are on. Lone specks vanish and small holes fill in.

The saved background also **adapts** slowly in places where you aren't, so gradual lighting changes don't turn the room into "you".

### 2. Detecting fast movement: frame differencing (`src/vision.js`)

Comparing this frame to the previous one shows which pixels just changed a lot. That's the motion mask, and it's what makes swipes splash sand.

### 3. The sand: a cellular automaton (`src/sand.js`)

Each cell is empty, sand or water. Walking the grid from the bottom up, every grain follows a few rules:

- **Sand:** fall down if there's room; else slide down-left or down-right; sink through water.
- **Water:** the same, but if it can't fall it flows sideways.
- **Grip:** sand resting directly on you usually stays put, so it can pile on your head and shoulders.

Piles, slopes and puddles all emerge from those rules. Two details matter more than they look: the scan direction alternates every frame (otherwise all piles lean one way), and each moved grain is stamped so it can't move twice in one frame.

### 4. You vs. the sand (`src/interact.js`)

- **Lift:** if your body moves into cells that hold grains (raising a hand under a pile), those grains are pushed up to the nearest free cell above. That's why sand rides on your hand instead of passing through it.
- **Splash:** grains next to fast-moving pixels get thrown up and sideways.

### 5. Drawing (`src/render.js`)

Everything is written into one 200 × 150 `ImageData`, one pixel per cell, then scaled up with smoothing off, so each grain is a crisp square.

## Project layout

```
index.html        page and controls
styles.css        design
src/camera.js     webcam access, grabbing small mirrored frames
src/vision.js     background subtraction, frame differencing, noise filter
src/sand.js       the falling-sand world
src/interact.js   lift and splash rules
src/render.js     palettes and drawing
src/main.js       wires it all together: settings, controls, main loop
tests/            unit tests (node --test)
```

## Things to tweak

The top of `src/main.js` has the knobs: grid size, pour rates, `GRIP`, `MOTION_THRESHOLD`, pointer size. Try a 400 × 300 grid for finer sand and watch the frame rate drop, then figure out why.

## Ideas for what to build next

Each one teaches something new:

- **Fire, smoke or snow**: new materials with their own rules (smoke rises, snow sticks). *Cellular automata design.*
- **Run the sand in a Web Worker** so it never stutters the page. *Concurrency in the browser.*
- **Move the simulation to the GPU** with WebGL shaders and run a 1000 × 750 grid. *GPU programming.*
- **Record a 5-second GIF** of you getting buried. *Video encoding.*
- **Better silhouettes**: add shadow removal by comparing brightness and color separately (shadows are darker but the same hue). *Classic computer vision.*

## The history

The git log tells the story of how this was built, one working step at a time:

```bash
git log --oneline --reverse
```

## License

MIT
