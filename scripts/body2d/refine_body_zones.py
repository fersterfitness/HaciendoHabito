"""
Afina el mapa de zonas del cuerpo 2D que arma build_body_zones.py (correr una vez, después de él).

1. Costuras: build_body_zones.py deja una línea entre grupos y los polígonos no siguen el contorno,
   así que quedaban retazos grises (hombros, bordes del costado, cintura, axilas). Cada franja fina
   del cuerpo sin zona toma la zona más cercana; el codo también. Lo ancho que no se mide (cabeza y
   cuello, manos, rodillas, pies) queda sin pintar.
2. Bordes que siguen el músculo: los cortes entre dos zonas eran rectos (polígonos). Dentro de una
   franja de BAND_PX alrededor de cada corte, el borde se mueve al surco más cercano de la imagen
   (las líneas oscuras entre músculos), con watershed, y después se suaviza.
3. Rodillas: el rectángulo sin pintar pasa a un óvalo (la rótula); los costados quedan en muslo y
   pantorrilla.

Uso: python scripts/body2d/refine_body_zones.py [carpeta de salida]   (por defecto, public/body2d)
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.filters import gaussian, sato
from skimage.segmentation import watershed

STEP = 20
THIN_RADIUS = 13  # franjas sin zona de menos de ~2*radio píxeles de ancho se consideran costura
MAX_DIST = 24     # y solo se rellenan si una zona está a esta distancia o menos
BAND_PX = 12      # cuánto puede moverse un borde entre zonas para seguir el surco
RIDGE_WEIGHT = 0.7
SMOOTH_SIGMA = 3.0
NONE = 9          # etiqueta temporal para el cuerpo que no se pinta

# Índices de ZONES en build_body_zones.py
BRAZO, ANTEBRAZO, MUSLO, PANTORRILLA = 2, 3, 7, 8

NAMES = ['hombre-frente', 'hombre-espalda', 'mujer-frente', 'mujer-espalda']


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def neighbors(mask, labels, body):
    ring = ndimage.binary_dilation(mask, iterations=2) & body & ~mask
    return set(np.unique(labels[ring]).tolist())


def fill_seams(labels, body):
    gap = body & (labels == 0)
    # Lo ancho sobrevive a la apertura; lo fino (costuras) no.
    wide = ndimage.binary_opening(gap, structure=disk(THIN_RADIUS))
    wide = ndimage.binary_dilation(wide, structure=disk(2)) & gap
    dist, (iy, ix) = ndimage.distance_transform_edt(labels == 0, return_indices=True)
    fill = gap & ~wide & (dist <= MAX_DIST)
    out = labels.copy()
    out[fill] = labels[iy[fill], ix[fill]]
    # Codo: si un hueco solo toca brazo y antebrazo, también se pinta.
    rest, k = ndimage.label(body & (out == 0))
    for i in range(1, k + 1):
        comp = rest == i
        if neighbors(comp, out, body) - {0} == {BRAZO, ANTEBRAZO}:
            out[comp] = labels[iy[comp], ix[comp]]
    return out


def snap_borders(labels, body, rgb):
    lab = labels.astype(np.int32)
    lab[body & (lab == 0)] = NONE
    lum = rgb.mean(-1) / 255
    ridge = sato(lum, sigmas=[2, 3, 4], black_ridges=True)
    ridge /= ridge.max() + 1e-9
    elevation = RIDGE_WEIGHT * ridge + (1 - RIDGE_WEIGHT) * (1 - gaussian(lum, 2))
    # Solo los cortes entre dos zonas medidas (no contra cabeza, manos, rodillas o pies).
    muscles = np.where(lab == NONE, 0, lab)
    border = np.zeros_like(body)
    for k in range(1, NONE):
        mk = muscles == k
        border |= ndimage.binary_dilation(mk) & (muscles > 0) & ~mk
    band = (ndimage.distance_transform_edt(~(border & body)) <= BAND_PX) & body
    ws = watershed(elevation, np.where(band, 0, lab), mask=body)
    ks = np.arange(1, NONE + 1)
    votes = np.stack([gaussian((ws == k).astype(float), SMOOTH_SIGMA) for k in ks])
    ws = np.where(band, ks[votes.argmax(0)], ws)
    ws[~body] = 0
    return ws


def round_knees(ws, body):
    comp, k = ndimage.label(ws == NONE)
    _, (iy, ix) = ndimage.distance_transform_edt((ws == NONE) | (ws == 0), return_indices=True)
    for i in range(1, k + 1):
        c = comp == i
        if neighbors(c, ws, body) - {NONE} != {MUSLO, PANTORRILLA}:
            continue
        ys, xs = np.nonzero(c)
        cy, cx = (ys.min() + ys.max()) / 2, (xs.min() + xs.max()) / 2
        ry, rx = (ys.max() - ys.min()) / 2 * 1.05, (xs.max() - xs.min()) / 2 * 0.95
        out = ((ys - cy) / ry) ** 2 + ((xs - cx) / rx) ** 2 > 1
        ws[ys[out], xs[out]] = ws[iy[ys[out], xs[out]], ix[ys[out], xs[out]]]
    return ws


def refine(folder: Path, name: str, out_dir: Path):
    im = np.asarray(Image.open(folder / f'{name}.webp').convert('RGBA')).astype(float)
    body = im[..., 3] > 127
    labels = np.asarray(Image.open(folder / f'{name}-zonas.png')) // STEP
    labels = fill_seams(labels, body)
    ws = round_knees(snap_borders(labels, body, im[..., :3]), body)
    ws[ws == NONE] = 0
    Image.fromarray((ws * STEP).astype(np.uint8), 'L').save(out_dir / f'{name}-zonas.png', optimize=True)
    return int((body & (ws == 0)).sum())


if __name__ == '__main__':
    folder = Path(__file__).resolve().parents[2] / 'public' / 'body2d'
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else folder
    for n in NAMES:
        print(n, 'sin pintar', refine(folder, n, out_dir))
