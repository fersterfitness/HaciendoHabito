"""
Genera los assets del cuerpo 2D de «Comparar controles».

Entrada: carpeta con hombre-frente.png, hombre-espalda.png, mujer-frente.png, mujer-espalda.png
(1024x1536, fondo transparente).
Salida (public/body2d):
  <nombre>.webp        imagen reducida a 768x1152
  <nombre>-zonas.png   mapa de zonas: valor = índice de zona * 20 (0 = sin zona)

Las zonas se dibujan como polígonos sobre la mitad izquierda de la imagen (coordenadas de la
original 1024x1536) y se espejan. Cada zona se achica unos píxeles para que quede una línea fina
sin pintar entre grupos musculares.

Uso: python scripts/body2d/build_body_zones.py "<carpeta de PNG>"
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# Mismo orden que BODY_ZONE_BY_INDEX en src/components/nutrition/body2d/zones.ts
ZONES = ['pecho', 'brazo', 'antebrazo', 'abdomen', 'costado', 'cadera', 'muslo', 'pantorrilla']
STEP = 20
OUT_W, OUT_H = 768, 1152
GAP_PX = 3  # separación entre grupos, en píxeles de la original

POLYS = {
    'hombre-frente': {
        'brazo': [(395, 270), (380, 300), (372, 350), (362, 410), (335, 460), (318, 530), (306, 578), (215, 578), (200, 450), (250, 300), (330, 262)],
        'antebrazo': [(306, 584), (290, 650), (255, 725), (150, 725), (170, 584)],
        'pecho': [(512, 262), (468, 252), (430, 252), (395, 270), (380, 300), (372, 350), (362, 410), (392, 430), (450, 442), (512, 444)],
        'abdomen': [(512, 444), (450, 442), (444, 500), (446, 560), (452, 620), (462, 652), (512, 656)],
        'costado': [(450, 442), (392, 430), (362, 410), (360, 470), (375, 540), (388, 600), (398, 652), (462, 652), (452, 620), (446, 560), (444, 500)],
        'cadera': [(512, 656), (398, 652), (362, 700), (312, 780), (316, 900), (420, 905), (480, 880), (512, 870)],
        'muslo': [(316, 902), (420, 907), (480, 882), (510, 880), (505, 960), (480, 1010), (440, 1032), (310, 1032), (295, 960)],
        'pantorrilla': [(298, 1095), (507, 1095), (507, 1405), (298, 1405)],
    },
    'hombre-espalda': {
        'brazo': [(385, 262), (352, 290), (345, 350), (348, 410), (332, 460), (305, 540), (190, 540), (230, 300), (330, 255)],
        'antebrazo': [(305, 546), (285, 620), (250, 725), (140, 725), (180, 546)],
        'pecho': [(512, 232), (470, 226), (430, 245), (385, 262), (352, 290), (345, 350), (348, 410), (370, 470), (385, 520), (512, 525)],
        'abdomen': [(512, 525), (440, 522), (440, 600), (450, 628), (512, 630)],
        'costado': [(440, 522), (385, 520), (380, 560), (385, 610), (395, 630), (450, 628), (440, 600)],
        'cadera': [(512, 630), (395, 630), (356, 680), (312, 760), (312, 895), (420, 900), (495, 880), (512, 875)],
        'muslo': [(312, 898), (420, 903), (495, 883), (510, 883), (505, 980), (480, 1040), (330, 1045), (315, 980)],
        'pantorrilla': [(298, 1088), (507, 1088), (507, 1420), (298, 1420)],
    },
    'mujer-frente': {
        'brazo': [(405, 268), (395, 300), (390, 360), (390, 420), (372, 470), (350, 520), (325, 568), (235, 568), (260, 420), (300, 300), (380, 262)],
        'antebrazo': [(325, 575), (300, 640), (270, 735), (170, 735), (220, 575)],
        'pecho': [(512, 255), (470, 250), (440, 262), (405, 268), (395, 300), (390, 360), (390, 420), (400, 470), (410, 492), (512, 495)],
        'abdomen': [(512, 495), (450, 495), (445, 560), (450, 620), (462, 655), (512, 658)],
        'costado': [(450, 495), (410, 492), (400, 470), (390, 520), (392, 580), (398, 630), (405, 655), (462, 655), (450, 620), (445, 560)],
        'cadera': [(512, 655), (400, 652), (358, 700), (332, 790), (330, 818), (420, 822), (480, 816), (512, 812)],
        'muslo': [(330, 821), (420, 825), (490, 819), (510, 819), (500, 920), (480, 980), (445, 1008), (355, 1008), (348, 920)],
        'pantorrilla': [(322, 1090), (507, 1090), (507, 1420), (322, 1420)],
    },
    'mujer-espalda': {
        'brazo': [(400, 275), (372, 300), (370, 360), (375, 420), (368, 470), (345, 520), (310, 556), (225, 556), (260, 420), (300, 300), (380, 268)],
        'antebrazo': [(310, 563), (290, 640), (265, 730), (165, 730), (215, 563)],
        'pecho': [(512, 250), (465, 250), (430, 262), (400, 275), (372, 300), (370, 360), (375, 420), (392, 470), (400, 495), (512, 498)],
        'abdomen': [(512, 498), (450, 498), (445, 560), (450, 620), (452, 638), (512, 642)],
        'costado': [(450, 498), (400, 495), (392, 470), (385, 520), (392, 580), (398, 638), (452, 638), (450, 620), (445, 560)],
        'cadera': [(512, 642), (398, 638), (352, 700), (326, 790), (326, 822), (420, 827), (490, 816), (512, 812)],
        'muslo': [(326, 826), (420, 830), (490, 820), (510, 820), (500, 950), (470, 1040), (360, 1045), (345, 950)],
        'pantorrilla': [(328, 1085), (507, 1085), (507, 1440), (328, 1440)],
    },
}


def build(src_dir: Path, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, polys in POLYS.items():
        im = Image.open(src_dir / f'{name}.png').convert('RGBA')
        W, H = im.size
        alpha = np.asarray(im.getchannel('A')) > 127
        xs = np.nonzero(alpha.any(axis=0))[0]
        cx = (xs.min() + xs.max()) / 2
        labels = np.zeros((H, W), dtype=np.uint8)
        for zi, zone in enumerate(ZONES, start=1):
            pts = polys[zone]
            layer = Image.new('L', (W, H), 0)
            d = ImageDraw.Draw(layer)
            d.polygon(pts, fill=255)
            d.polygon([(2 * cx - x, y) for x, y in pts], fill=255)
            # achicar para dejar la separación entre grupos
            layer = layer.filter(ImageFilter.MinFilter(GAP_PX * 2 + 1))
            m = (np.asarray(layer) > 0) & alpha & (labels == 0)
            labels[m] = zi
        lab = Image.fromarray(labels * STEP, 'L').resize((OUT_W, OUT_H), Image.NEAREST)
        lab.save(out_dir / f'{name}-zonas.png', optimize=True)
        im.resize((OUT_W, OUT_H), Image.LANCZOS).save(out_dir / f'{name}.webp', quality=84, method=6)
        counts = {z: int((labels == i).sum()) for i, z in enumerate(ZONES, start=1)}
        print(name, 'cx', round(cx, 1), counts)


if __name__ == '__main__':
    src = Path(sys.argv[1])
    out = Path(__file__).resolve().parents[2] / 'public' / 'body2d'
    build(src, out)
