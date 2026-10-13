"""Post-production for the walkthrough: camera crop, title card, screen cross-fades, end card,
and an exact frame count, encoded to H.264.

Usage:
    python3 post.py CAPDIR OUT.mp4 TOTAL_FRAMES [TITLE_DIR] [END_DIR]

    CAPDIR        output of capture.py (frames + meta.json), captured with STRIDE 1
    TOTAL_FRAMES  exact length of the final video at 30 fps (1350 = 45.000 s)
    TITLE_DIR     optional folder of title-card frames (PNG/JPG, 1920x1080)
    END_DIR       optional folder of end-card frames (PNG, 1920x1080)

The end card absorbs the difference, so the file always lands on TOTAL_FRAMES.
Needs: pip install pillow, and ffmpeg on PATH.
"""
import json, os, subprocess, sys
from multiprocessing import Pool
from PIL import Image

CAP, OUT, TOTAL = sys.argv[1], sys.argv[2], int(sys.argv[3])
TITLE = sys.argv[4] if len(sys.argv) > 4 else None
END = sys.argv[5] if len(sys.argv) > 5 else None
M = json.load(open(f'{CAP}/meta.json'))
F, DSF = M['frames'], M['dsf']
W, H = 1920, 1080
XMARKS = ['Connect', 'Limits', 'Main']  # screen changes that get a cross-fade instead of a cut
XN, TN, EXF = 12, 16, 10                 # cross-fade, title push-dissolve and end-card fade lengths (frames)
NC = len(F)
TPRE = 32 if TITLE else 0
NEND = TOTAL - TPRE - NC
assert NEND >= 0, f'capture is longer than TOTAL_FRAMES by {-NEND} frames'
ss = lambda a: a * a * (3 - 2 * a)       # smoothstep easing


def render(n):
    """Crop the virtual camera's box out of the 2x frame and resize to 1080p (sub-pixel box keeps pans smooth)."""
    im = Image.open(f'{CAP}/f{n:05d}.jpg').convert('RGB')
    x, y, w, h = F[n]['cam']
    return im.resize((W, H), Image.LANCZOS, box=(x * DSF, y * DSF, (x + w) * DSF, (y + h) * DSF)).tobytes()


def zoom(im, s):
    cw, ch = W / s, H / s
    return im.resize((W, H), Image.LANCZOS, box=((W - cw) / 2, (H - ch) / 2, (W + cw) / 2, (H + ch) / 2))


def main():
    tfr = sorted(os.listdir(TITLE)) if TITLE else []
    ends = sorted(f for f in os.listdir(END) if f.endswith('.png'))[:NEND] if END else []
    mk = dict(M['marks'])
    starts = [next(i for i, f in enumerate(F) if f['t'] >= mk[m] - 1) for m in XMARKS if m in mk]
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                           '-s', f'{W}x{H}', '-r', '30', '-i', '-',
                           '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', f'{TOTAL / 30:.3f}',
                           '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
                           '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', OUT], stdin=subprocess.PIPE)
    count = 0
    for k in range(TPRE):
        ff.stdin.write(Image.open(f'{TITLE}/{tfr[k]}').convert('RGB').resize((W, H)).tobytes()); count += 1
    held, last = {}, None
    with Pool(2) as pool:
        for i, buf in enumerate(pool.imap(render, range(NC), chunksize=8)):
            if TITLE and i < TN and TPRE + i < len(tfr):  # push-dissolve from the title into the first screen
                a = ss((i + 1) / (TN + 1))
                t = zoom(Image.open(f'{TITLE}/{tfr[TPRE + i]}').convert('RGB').resize((W, H)), 1 + 0.06 * a)
                c = zoom(Image.frombytes('RGB', (W, H), buf), 1.035 - 0.035 * a)
                buf = Image.blend(t, c, a).tobytes()
            for k in starts:  # cross-fade from the last frame of the old screen
                if i == k - 1: held[k] = buf
                if k <= i < k + XN and k in held:
                    a = ss((i - k + 1) / (XN + 1))
                    buf = Image.blend(Image.frombytes('RGB', (W, H), held[k]), Image.frombytes('RGB', (W, H), buf), a).tobytes()
            ff.stdin.write(buf); last = buf; count += 1
    lastim = Image.frombytes('RGB', (W, H), last)
    for k in range(NEND):
        e = Image.open(f'{END}/{ends[min(k, len(ends) - 1)]}').convert('RGB').resize((W, H)) if ends else lastim
        if ends and k < EXF: e = Image.blend(lastim, e, ss((k + 1) / (EXF + 1)))
        ff.stdin.write(e.tobytes()); count += 1
    ff.stdin.close(); ff.wait()
    print('wrote', count, 'frames =', count / 30, 's')


if __name__ == '__main__':
    main()
