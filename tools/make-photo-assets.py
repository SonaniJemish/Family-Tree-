"""
Turns the 4 photo-real pictures made in Figma (assets/photo/*.jpg) into the small pieces the tree uses
(assets/photo/processed/*). Run:  python3 tools/make-photo-assets.py   then:  node tools/build-assets.js
"""
import os, sys, math
import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage as ndi

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'photo')
OUT = os.path.join(ROOT, 'processed')
BG_COLOR, BG_LIGHT = 0.92, 0.14     # how colourful, how much lighter the background is
FOCUS_ROW = 0.72                    # sharp row of the background picture (0 = top, 1 = bottom): the ground under the tree
os.makedirs(OUT, exist_ok=True)

def seamless_tile(im, size, brighten=1.0):
    """One tile that repeats without a seam and without mirror patterns:
    the picture is shifted by half, and its middle is faded back into the original."""
    im = im.resize((size, size), Image.LANCZOS)
    if brighten != 1.0:
        im = ImageEnhance.Brightness(im).enhance(brighten)
    A = np.asarray(im).astype(np.float32)
    B = np.roll(A, (size // 2, size // 2), axis=(0, 1))
    t = (np.arange(size) + 0.5) / size
    e = np.minimum(t, 1 - t) / 0.09                   # 0 at the edge, 1 after 9% of the tile
    w = np.clip(e, 0, 1)
    w = w * w * (3 - 2 * w)                           # smooth step
    M = np.outer(w, w)[..., None]                     # only a thin band along the edges is mixed (little ghosting)
    R = M * A + (1 - M) * B
    return Image.fromarray(np.clip(R, 0, 255).astype(np.uint8))

# ---- bark: lighter, tile that repeats without a seam (blended with its half-shifted copy)
bark = Image.open(os.path.join(ROOT, 'bark.jpg')).convert('RGB')
seamless_tile(bark, 640, 1.10).save(os.path.join(OUT, 'bark-tile.jpg'), quality=84, optimize=True)

# ---- foliage: dense leaves texture for the crown
fol = Image.open(os.path.join(ROOT, 'foliage.jpg')).convert('RGB')
seamless_tile(fol, 640, 1.0).save(os.path.join(OUT, 'foliage-tile.jpg'), quality=82, optimize=True)

# ---- background
# Depth of field like a camera (DSLR): the meadow row where the tree stands is sharp; the further away
# (hills, sky) and the nearer (flowers at the bottom edge) a row is, the more it is blurred.
from PIL import ImageFilter
bg = Image.open(os.path.join(ROOT, 'background.jpg')).convert('RGB')
SIG = [0.0, 1.2, 2.5, 4.5, 7.0, 10.0, 14.0, 19.0]       # blur strengths (pixels) we mix between
stack = [np.asarray(bg).astype(np.float32)] + [np.asarray(bg.filter(ImageFilter.GaussianBlur(s))).astype(np.float32) for s in SIG[1:]]
Hh = bg.height
FOCUS = FOCUS_ROW
yy = np.arange(Hh) / float(Hh - 1)
d = yy - FOCUS
far = np.clip(-d / 0.60, 0, 1) ** 1.2                  # towards the horizon / sky
near = np.clip(d / 0.26, 0, 1) ** 1.2                  # towards the camera (bottom edge)
sig = 0.4 + (np.where(d < 0, far * 17.0, near * 16.0))
idx = np.clip(np.interp(sig, SIG, np.arange(len(SIG))), 0, len(SIG) - 1)
lo = np.floor(idx).astype(int); hi = np.minimum(lo + 1, len(SIG) - 1); fr = (idx - lo)[:, None, None]
res = np.empty_like(stack[0])
for y in range(Hh):
    res[y] = stack[lo[y]][y] * (1 - fr[y]) + stack[hi[y]][y] * fr[y]
bg = Image.fromarray(np.clip(res, 0, 255).astype(np.uint8))
bg = ImageEnhance.Color(bg).enhance(BG_COLOR)
bg = Image.blend(bg, Image.new('RGB', bg.size, (240, 246, 250)), BG_LIGHT)
bg.save(os.path.join(OUT, 'background.jpg'), quality=84, optimize=True)
_top = np.asarray(bg)[:6].reshape(-1, 3).mean(0)
print('background top colour: #%02x%02x%02x' % tuple(int(v) for v in _top))

# ---- single leaves cut out of the white sheet, all turned "tip up", stalk at the bottom centre
sheet = Image.open(os.path.join(ROOT, 'leaves-sheet.jpg')).convert('RGB')
a = np.asarray(sheet).astype(np.float32)
mx, mn = a.max(2), a.min(2)
sat = (mx - mn) / np.maximum(mx, 1)
alpha = np.clip((sat - 0.16) / (0.34 - 0.16), 0, 1)           # shadows are grey (low saturation) -> dropped
alpha = ndi.binary_fill_holes(alpha > 0.5) * np.maximum(alpha, 0.0) if False else alpha
solid = ndi.binary_fill_holes(alpha > 0.5)
alpha = np.where(solid, np.maximum(alpha, 1.0 * (ndi.binary_erosion(solid, iterations=2))), alpha)
lab, n = ndi.label(solid)
sizes = ndi.sum(solid, lab, range(1, n + 1))
order = np.argsort(sizes)[::-1][:8]
k = 0
for idx in sorted(order, key=lambda i: ndi.center_of_mass(solid, lab, i + 1)[0] // 400 * 10000 + ndi.center_of_mass(solid, lab, i + 1)[1]):
    comp = (lab == idx + 1)
    comp = ndi.binary_dilation(comp, iterations=3)
    ys, xs = np.nonzero(comp)
    y0, y1, x0, x1 = ys.min() - 4, ys.max() + 5, xs.min() - 4, xs.max() + 5
    rgb = a[y0:y1, x0:x1]
    al = (alpha * comp)[y0:y1, x0:x1]
    # take white out of the soft edge so there is no light halo
    al_s = np.maximum(al, 1e-3)[..., None]
    rgb = np.clip((rgb - (1 - al_s) * 255.0) / al_s, 0, 255)
    rgba = np.dstack([rgb, al * 255.0]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    # find the tip (the pixel farthest from the middle) and turn the leaf so the tip points straight up
    m = np.asarray(im)[..., 3] > 128
    cy, cx = ndi.center_of_mass(m)
    yy, xx = np.nonzero(m)
    d = (yy - cy) ** 2 + (xx - cx) ** 2
    t = np.argmax(d)
    ang = math.degrees(math.atan2(xx[t] - cx, -(yy[t] - cy)))   # 0 = already up, + = leaning right
    im = im.rotate(ang, resample=Image.BICUBIC, expand=True)
    bb = im.getbbox()
    im = im.crop(bb)
    s = 190.0 / im.height
    im = im.resize((max(1, round(im.width * s)), 190), Image.LANCZOS)
    im.save(os.path.join(OUT, 'leaf-%d.png' % (k + 1)), optimize=True)
    k += 1
print('leaves cut:', k)


# ---- Krishna with the flute and the cows: cut out of the flat magenta (#FF00FF) background
kc = np.asarray(Image.open(os.path.join(ROOT, 'krishna-cows.jpg')).convert('RGB')).astype(np.float32)
R_, G_, B_ = kc[..., 0], kc[..., 1], kc[..., 2]
m = np.minimum(R_, B_) - G_                              # big for magenta, small for pink flowers / skin / clothes
al = 1.0 - np.clip((m - 70.0) / 110.0, 0, 1)
al = np.where(m > 180, 0.0, al)
# keep only the biggest connected piece plus pieces near it (drops stray specks)
lab, nlab = ndi.label(al > 0.5)
sz = ndi.sum(al > 0.5, lab, range(1, nlab + 1))
keep = np.zeros_like(al, bool)
for i, z in enumerate(sz):
    if z > 400: keep |= (lab == i + 1)
keep = ndi.binary_dilation(keep, iterations=3)
al = al * keep
# take the magenta out of the soft edge (no pink fringe)
a3 = np.maximum(al, 1e-3)[..., None]
key = np.array([255.0, 0.0, 255.0])
rgb = np.clip((kc - (1 - a3) * key) / a3, 0, 255)
# remaining pink tint on the edge: pull red/blue down to green where the pixel is mostly edge
edge = (al > 0) & (al < 0.95)
tint = np.clip(np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1], 0, 255) * edge
rgb[..., 0] -= tint * 0.5
rgb[..., 2] -= tint * 0.5
img = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), al * 255.0]).astype(np.uint8), 'RGBA')
img = img.crop(img.getbbox())
# the pasted-looking flower/grass rim at the foot of the scene fades away; the tree view draws its own tiny grass there
A = np.asarray(img).astype(np.float32)
hh_, ww_ = A.shape[:2]
t = np.clip((np.arange(hh_) / hh_ - 0.80) / (0.97 - 0.80), 0, 1)
A[..., 3] *= (1 - t * t * (3 - 2 * t))[:, None]
img = Image.fromarray(A.astype(np.uint8), 'RGBA')
img = img.resize((900, round(img.height * 900 / img.width)), Image.LANCZOS)
img.save(os.path.join(OUT, 'krishna-cows.png'), optimize=True)
try:
    img.save(os.path.join(OUT, 'krishna-cows.webp'), quality=88, method=6)
except Exception as e:
    print('no webp', e)
print('krishna scene', img.size)
