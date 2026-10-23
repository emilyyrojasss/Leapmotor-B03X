# Refina los recortes: una sola pieza, sin huecos, borde suave sin halo del fondo original.
import sys, numpy as np, cv2
from scipy import ndimage as ndi
from PIL import Image
SP, ORIG, n = sys.argv[1], sys.argv[2], sys.argv[3]
rgb = np.asarray(Image.open(f'{ORIG}/b03x-{n}.webp').convert('RGB')).astype(np.float32) / 255
m = np.asarray(Image.open(f'{SP}/m2/{n}-mask.png').convert('L')).astype(np.float32) / 255

# 1) solo la pieza más grande + rellenar huecos internos (vidrios que Vision dejó fuera)
lab, k = ndi.label(m > 0.5)
big = lab == (np.argmax(np.bincount(lab.ravel())[1:]) + 1)
solid = ndi.binary_fill_holes(big)
m = np.where(solid & ~big, 1.0, m) * ndi.binary_dilation(solid, iterations=3)

# 2) borde: suavizado + umbral suave => se come ~1px de halo y queda antialiasado
mb = cv2.GaussianBlur(m, (0, 0), 1.2)
a = np.clip((mb - 0.5) / 0.22, 0, 1)
a = a * a * (3 - 2 * a)

# 3) descontaminar color del borde: extender el color del interior hacia afuera
inner = (cv2.erode((a > 0.99).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0).astype(np.float32)
fill = rgb.copy(); have = inner.copy()
for s in (3, 6, 12, 24):
    w = cv2.GaussianBlur(inner, (0, 0), s)[..., None]
    c = cv2.GaussianBlur(rgb * inner[..., None], (0, 0), s) / np.maximum(w, 1e-6)
    take = (have < 0.5) & (w[..., 0] > 0.02)
    fill[take] = c[take]; have[take] = 1
edge = (a < 0.99)[..., None]
out = np.where(edge, fill, rgb)

rgba = np.dstack([out, a])
Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{SP}/m2/{n}-ref.png')
print(n, 'ok', k, 'componentes')
