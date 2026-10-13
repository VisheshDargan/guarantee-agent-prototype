"""Frame-accurate capture of the prototype walkthrough under a virtual clock.

Usage:
    python3 capture.py PAGE OUTDIR [DSF] [STRIDE] [MAXSEC]

    PAGE    path or URL of the prototype (for example ../../index.html)
    OUTDIR  folder for frames (f00000.jpg ...) and meta.json
    DSF     device scale factor, 2 gives 3200x1800 frames from a 1600x900 viewport (default 2)
    STRIDE  save every Nth frame, 1 for a full render, 4 for a quick preview (default 1)
    MAXSEC  safety limit on length in seconds (default 70)

Needs: pip install playwright && playwright install chromium
"""
import json, os, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
PAGE = sys.argv[1]
OUT = sys.argv[2]
DSF = float(sys.argv[3]) if len(sys.argv) > 3 else 2
STRIDE = int(sys.argv[4]) if len(sys.argv) > 4 else 1
MAXSEC = float(sys.argv[5]) if len(sys.argv) > 5 else 70
URL = PAGE if '://' in PAGE else Path(PAGE).resolve().as_uri()
VC = (HERE / 'vclock.js').read_text()
DIR = (HERE / 'director.js').read_text()
FPS = 30
DT = 1000 / FPS
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(args=['--force-color-profile=srgb', '--hide-scrollbars'])
    ctx = b.new_context(viewport={'width': 1600, 'height': 900}, device_scale_factor=DSF)
    pg = ctx.new_page()
    pg.add_init_script(VC)  # the virtual clock is installed before any page script runs
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
    pg.goto(URL + '#Listing')
    pg.evaluate("document.fonts.ready")
    pg.evaluate("window.__fast = true")
    pg.mouse.move(1150, 700)
    for _ in range(10):  # short pre-roll so the first screen settles
        pg.evaluate("(dt) => __step(dt)", DT)
    pg.evaluate(DIR)
    meta, speed, n, tail, t0 = [], 1.0, 0, None, time.time()
    while n < MAXSEC * FPS:
        # advance the page by exactly one frame (scaled by the director's speed), then read cursor and camera
        st = pg.evaluate("(dt) => { __step(dt); return __dirState(); }", DT * speed)
        speed = st['speed']
        cx, cy = st['cur']
        if cx == cx and cy == cy:  # skip NaN while a target is off screen
            pg.mouse.move(cx, cy)  # real mouse moves, so hover states render
        if n % STRIDE == 0:
            pg.screenshot(path=f"{OUT}/f{n:05d}.jpg", type='jpeg', quality=93)
        meta.append({'n': n, 't': st['t'], 'cam': st['cam'], 'cur': st['cur'], 'speed': speed})
        n += 1
        if st['done'] and tail is None:
            tail = n + 6
        if tail is not None and n >= tail:
            break
        if n % 150 == 0:
            print(f"frame {n}  t={st['t']:.0f} ms  {time.time() - t0:.0f}s", flush=True)
    marks = pg.evaluate("window.__marks")
    json.dump({'frames': meta, 'marks': marks, 'errors': errs[:50], 'stride': STRIDE, 'dsf': DSF},
              open(f"{OUT}/meta.json", 'w'))
    print('done:', n, 'frames, marks', marks, 'errors', errs[:10], flush=True)
    b.close()
