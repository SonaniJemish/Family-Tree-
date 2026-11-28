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
bg = Image.open(os.path.join(ROOT, 'background.jpg')).convert('RGB')
bg.save(os.path.join(OUT, 'background.jpg'), quality=84, optimize=True)

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
