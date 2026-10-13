# Walkthrough video renderer

The 45-second product walkthrough was not screen-recorded. It was rendered frame by frame from the live prototype, so every cursor move, pointer and zoom lands on an exact frame and nothing stutters.

| File | What it does |
| --- | --- |
| `vclock.js` | Replaces the page's timers, `requestAnimationFrame`, `performance.now` and `Date.now` with a virtual clock, and drives every CSS and Web Animation from it. The page only moves when the capture script says so. |
| `director.js` | The script of the video: a macOS-style cursor on eased, curved paths with a click ripple; pointers with a title, one line of why and a highlight ring; camera moves that pause on each new screen, zoom into what matters and zoom back out before navigating. Each scene starts when its screen loads. |
| `capture.py` | Opens the prototype in headless Chromium at 2x, steps the clock 1/30 s per frame, moves the real mouse so hover states render, and saves each frame plus the camera box. Waiting moments (connecting, the replay loader, activation) can play faster. |
| `post.py` | Crops each frame to the camera box and resizes to 1080p, cross-fades screen changes, adds title and end cards, and solves for an exact frame count before encoding with ffmpeg. |

```sh
pip install playwright pillow && playwright install chromium
python3 capture.py ../../index.html frames 2 4        # quick preview: every 4th frame
python3 capture.py ../../index.html frames 2 1        # full render
python3 post.py frames walkthrough.mp4 1350           # exactly 45.000 s at 30 fps
```

A low-resolution preview takes about 35 seconds and a full render about 7 minutes, so a round of feedback became a new version in under an hour.
