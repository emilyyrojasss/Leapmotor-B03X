# Vidrios semitransparentes: dentro de cada polígono de vidrio, lo claro (cielo/fondo
# visto a través, reflejos) se vuelve transparente y lo oscuro (interior, marcos) queda sólido.
import sys, json, numpy as np, cv2
from PIL import Image
SP = sys.argv[1]
GLASS = {
 '05': [[(160,428),(205,332),(255,302),(460,293),(800,287),(1000,299),(1120,370),(1282,462),(1180,468),(830,455),(395,440)]],
 '17': [[(568,358),(652,207),(1160,207),(1238,358)]],
 '09': [[(255,385),(258,272),(350,240),(735,213),(800,390)],
        [(735,213),(1050,222),(1200,290),(1292,385),(885,388),(800,390)]],
 '11': [[(188,375),(232,262),(612,256),(585,385)],
        [(615,262),(800,233),(1040,233),(1062,400),(800,388),(588,386)],
        [(1090,246),(1210,268),(1338,395),(1165,402)]],
 '13': [[(457,415),(640,272),(722,257),(992,256),(940,322),(906,420)],
        [(940,322),(1012,268),(1195,256),(1200,420),(925,425)],
        [(1215,256),(1470,266),(1487,420),(1240,420)],
        [(1482,272),(1560,282),(1640,332),(1650,410),(1495,415)]],
 '59': [[(522,388),(702,268),(872,216),(985,226),(860,402),(700,410)],
        [(860,402),(985,226),(1145,224),(1152,386)],
        [(1160,224),(1405,224),(1450,356),(1185,382)],
        [(1418,230),(1500,246),(1562,282),(1580,342),(1470,352)]],
}
for n, polys in GLASS.items():
    im = np.asarray(Image.open(f'{SP}/m2/{n}-canvas.png').convert('RGBA')).astype(np.float32) / 255
    rgb, a = im[..., :3], im[..., 3]
    g = np.zeros(a.shape, np.float32)
    for p in polys: cv2.fillPoly(g, [np.array(p, np.int32)], 1.0)
    g = cv2.GaussianBlur(g, (0, 0), 2.0)                    # borde del vidrio suave
    L = rgb @ np.array([.2126, .7152, .0722], np.float32)
    ga = np.clip(1.05 - 1.1 * L, 0.12, 0.88)                 # claro -> transparente
    a2 = a * (1 - g + g * ga)
    tint = np.array([.05, .07, .08], np.float32)            # leve tinte de vidrio
    rgb2 = rgb * (1 - g[..., None] * .35) + tint * g[..., None] * .35
    out = np.dstack([rgb2, a2])
    Image.fromarray((out * 255 + .5).astype(np.uint8)).save(f'{SP}/m2/{n}-glass.png')
    # vista previa sobre fondo oscuro con texto detrás (como en el hero)
    bg = Image.new('RGBA', (1800, 1000), (11, 12, 10, 255))
    from PIL import ImageDraw, ImageFont
    d = ImageDraw.Draw(bg)
    try: f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 420)
    except Exception: f = None
    d.text((180, 60), 'B03X', fill=(243, 241, 234, 255), font=f)
    bg.alpha_composite(Image.open(f'{SP}/m2/{n}-glass.png'))
    bg.convert('RGB').resize((900, 500)).save(f'{SP}/m2/{n}-prev.jpg', quality=85)
    print(n, 'ok')
