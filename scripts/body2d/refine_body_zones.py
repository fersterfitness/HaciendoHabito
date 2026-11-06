"""
Rellena las costuras sin pintar del mapa de zonas del cuerpo 2D.

build_body_zones.py deja una línea entre grupos y los polígonos no siguen el contorno del cuerpo,
así que quedaban retazos grises (hombros, bordes del costado, cintura). Acá cada píxel del cuerpo
sin zona que forma parte de una franja fina toma la zona más cercana. Lo que es ancho y no se mide
(cabeza y cuello, manos, rodillas, pies) queda sin pintar; el codo sí se pinta.

Uso (sobre public/body2d, se puede correr más de una vez): python scripts/body2d/refine_body_zones.py
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

STEP = 20
THIN_RADIUS = 13  # franjas de menos de ~2*radio píxeles de ancho se consideran costura
MAX_DIST = 24     # y solo se rellenan si una zona está a esta distancia o menos

ELBOW = {2, 3}  # índices de brazo y antebrazo (ver ZONES en build_body_zones.py)

NAMES = ['hombre-frente', 'hombre-espalda', 'mujer-frente', 'mujer-espalda']


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def refine(folder: Path, name: str, out: Path | None = None):
    body = np.asarray(Image.open(folder / f'{name}.webp').convert('RGBA'))[..., 3] > 127
    labels = np.asarray(Image.open(folder / f'{name}-zonas.png')) // STEP
    gap = body & (labels == 0)
    # Lo ancho sobrevive a la apertura; lo fino (costuras) no.
    wide = ndimage.binary_opening(gap, structure=disk(THIN_RADIUS))
    wide = ndimage.binary_dilation(wide, structure=disk(2)) & gap
    thin = gap & ~wide
    dist, (iy, ix) = ndimage.distance_transform_edt(labels == 0, return_indices=True)
    fill = thin & (dist <= MAX_DIST)
    out_labels = labels.copy()
    out_labels[fill] = labels[iy[fill], ix[fill]]
    # El codo queda ancho en algún cuerpo: si un hueco solo toca brazo y antebrazo, también se pinta.
    rest, k = ndimage.label(body & (out_labels == 0))
    for i in range(1, k + 1):
        comp = rest == i
        ring = ndimage.binary_dilation(comp, iterations=2) & (out_labels > 0)
        if set(np.unique(out_labels[ring]).tolist()) == ELBOW:
            out_labels[comp] = labels[iy[comp], ix[comp]]
    Image.fromarray((out_labels * STEP).astype(np.uint8), 'L').save((out or folder) / f'{name}-zonas.png', optimize=True)
    return int(gap.sum()), int(fill.sum())


if __name__ == '__main__':
    folder = Path(__file__).resolve().parents[2] / 'public' / 'body2d'
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    for n in NAMES:
        g, f = refine(folder, n, out)
        print(n, 'sin zona', g, 'rellenados', f)
