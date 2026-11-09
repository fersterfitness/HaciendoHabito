"""
Genera el mapa de músculos del cuerpo 2D (volumen semanal del entrenador) a partir del mapa de zonas
antropométricas que arman build_body_zones.py + refine_body_zones.py.

Cada zona antropométrica pasa a un músculo según la vista, y unos pocos polígonos (deltoides,
trapecio y aductores) la parten donde hace falta. Así se reutilizan los bordes ya afinados al surco.

Entrada/salida en public/body2d:
  <nombre>-zonas.png     (entrada) índice de zona antropométrica * 20
  <nombre>-musculos.png  (salida)  índice de músculo * 18 (0 = sin músculo)

Uso: python scripts/body2d/build_muscle_zones.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

# Mismo orden que MUSCLE_BY_INDEX en src/components/routines/volumeBody/muscleZones.ts (y VOLUME_MUSCLES)
MUSCLES = ['cuadriceps', 'femoral', 'gluteo', 'aductores', 'pecho', 'deltoides', 'deltoide_post', 'espalda',
           'trapecio', 'biceps', 'triceps', 'gemelos', 'abdominales']
STEP = 18
ZONE_STEP = 20
# Índices de ZONES en build_body_zones.py
PECHO, BRAZO, ANTEBRAZO, ABDOMEN, COSTADO, CADERA, MUSLO, PANTORRILLA = range(1, 9)

# Zona antropométrica -> músculo, por vista (None = sin pintar)
BASE = {
    'frente': {PECHO: 'pecho', BRAZO: 'biceps', ABDOMEN: 'abdominales', COSTADO: 'abdominales', MUSLO: 'cuadriceps', PANTORRILLA: 'gemelos'},
    'espalda': {PECHO: 'espalda', BRAZO: 'triceps', ABDOMEN: 'espalda', COSTADO: 'espalda', CADERA: 'gluteo', MUSLO: 'femoral', PANTORRILLA: 'gemelos'},
}

# Polígonos sobre la mitad izquierda de la imagen (coordenadas 768x1152), se espejan sobre el eje del
# cuerpo. 'C' en x = el eje. Cada uno solo pisa las zonas que se indican.
SPLITS = {
    'hombre-frente': [
        ('deltoides', (PECHO, BRAZO), [(292, 192), (282, 230), (274, 268), (262, 298), (225, 302), (205, 290), (200, 250), (215, 212), (248, 192)]),
        ('trapecio', (PECHO,), [('C', 120), ('C', 196), (305, 214), (288, 190), (300, 120)]),
        ('aductores', (MUSLO,), [('C', 665), (335, 665), (345, 705), (372, 750), ('C', 765)]),
    ],
    'hombre-espalda': [
        ('deltoide_post', (PECHO, BRAZO), [(300, 195), (292, 232), (272, 268), (255, 298), (220, 300), (203, 262), (213, 215), (245, 195)]),
        ('trapecio', (PECHO,), [('C', 120), (340, 140), (288, 196), (312, 228), (336, 262), (356, 320), ('C', 412)]),
    ],
    'mujer-frente': [
        ('deltoides', (PECHO, BRAZO), [(305, 200), (298, 240), (290, 285), (270, 300), (245, 295), (238, 250), (255, 212), (280, 198)]),
        ('trapecio', (PECHO,), [('C', 120), ('C', 200), (306, 214), (296, 198), (320, 120)]),
        ('aductores', (MUSLO,), [('C', 622), (330, 622), (340, 680), (360, 730), ('C', 750)]),
    ],
    'mujer-espalda': [
        ('deltoide_post', (PECHO, BRAZO), [(305, 205), (298, 240), (285, 285), (265, 300), (242, 295), (238, 250), (255, 215), (280, 203)]),
        ('trapecio', (PECHO,), [('C', 120), (340, 160), (300, 202), (320, 235), (345, 290), ('C', 400)]),
    ],
}


def build(folder: Path):
    for name, splits in SPLITS.items():
        view = name.split('-')[1]
        im = Image.open(folder / f'{name}.webp').convert('RGBA')
        W, H = im.size
        alpha = np.asarray(im.getchannel('A')) > 127
        xs = np.nonzero(alpha.any(axis=0))[0]
        cx = (xs.min() + xs.max()) / 2
        zones = np.asarray(Image.open(folder / f'{name}-zonas.png').convert('L')).astype(np.int32) // ZONE_STEP
        out = np.zeros((H, W), dtype=np.uint8)
        for zone, muscle in BASE[view].items():
            out[zones == zone] = MUSCLES.index(muscle) + 1
        for muscle, allowed, pts in splits:
            pts = [(cx if x == 'C' else x, y) for x, y in pts]
            layer = Image.new('L', (W, H), 0)
            d = ImageDraw.Draw(layer)
            d.polygon(pts, fill=255)
            d.polygon([(2 * cx - x, y) for x, y in pts], fill=255)
            m = (np.asarray(layer) > 0) & np.isin(zones, allowed) & alpha
            out[m] = MUSCLES.index(muscle) + 1
        Image.fromarray(out * STEP, 'L').save(folder / f'{name}-musculos.png', optimize=True)
        counts = {mu: int((out == i).sum()) for i, mu in enumerate(MUSCLES, start=1) if (out == i).any()}
        print(name, 'cx', round(cx, 1), counts)


if __name__ == '__main__':
    build(Path(__file__).resolve().parents[2] / 'public' / 'body2d')
