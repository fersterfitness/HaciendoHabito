/**
 * Cuerpo generado por código (respaldo mientras no haya modelo 3D real).
 * Músculos como elipsoides y conos redondeados fundidos en un campo de distancia,
 * convertido a malla con «surface nets». Cada vértice queda asignado a la zona
 * del músculo más cercano.
 */
import type { BodyZoneId } from '@/lib/nutrition/bodyZoneComparison'
import { BODY_ZONE_INDEX, type BodyMeshData, type BodySex } from './types'

type V3 = [number, number, number]
type Zone = BodyZoneId | null

interface Prim {
  t: 0 | 1
  zone: Zone
  k: number
  sub?: boolean
  c?: V3
  r?: V3
  a?: V3
  b?: V3
  r1?: number
  r2?: number
  bc: V3
  br: number
  ba?: V3
  l2?: number
  rr?: number
  a2?: number
  il2?: number
}

const E = (c: V3, r: V3, zone: Zone, k = 0.03): Prim => ({ t: 0, c, r, zone, k, bc: c, br: Math.max(...r) })
const C = (a: V3, b: V3, r1: number, r2: number, zone: Zone, k = 0.03): Prim => ({ t: 1, a, b, r1, r2, zone, k, bc: a, br: 0 })
const along = (p: V3, d: V3, s: number): V3 => [p[0] + d[0] * s, p[1] + d[1] * s, p[2] + d[2] * s]
const off = (p: V3, o: V3): V3 => [p[0] + o[0], p[1] + o[1], p[2] + o[2]]

function anatomy(sex: BodySex): Prim[] {
  const f = sex === 'F', mus = f ? 0.82 : 1
  const out: Prim[] = [], side: Prim[] = []
  out.push(E([0, 0.97, 0], f ? [0.172, 0.115, 0.112] : [0.158, 0.11, 0.108], 'cadera', 0.04))
  out.push(E([0, 1.12, 0], f ? [0.118, 0.14, 0.092] : [0.13, 0.15, 0.098], 'abdomen', 0.04))
  out.push(E([0, 1.3, -0.005], f ? [0.138, 0.15, 0.1] : [0.155, 0.16, 0.108], 'pecho', 0.05))
  out.push(C([0, 1.47, -0.005], [0, 1.6, 0.01], 0.058, 0.048, null, 0.03))
  out.push(E([0, 1.7, 0.012], [0.082, 0.107, 0.097], null, 0.02))
  out.push(E([0, 1.648, 0.034], [0.06, 0.045, 0.06], null, 0.03))
  out.push({ ...C([0, 1.0, -0.118], [0, 1.44, -0.122], 0.014, 0.014, null, 0.03), sub: true })
  if (!f) {
    for (const [y, z] of [[1.05, 0.074], [1.115, 0.082], [1.18, 0.081]] as const) for (const x of [0.034, -0.034]) out.push(E([x, y, z], [0.028, 0.024, 0.018], 'abdomen', 0.02))
    out.push({ ...C([0, 1.32, 0.112], [0, 1.41, 0.108], 0.011, 0.011, null, 0.02), sub: true })
  }
  side.push(E([0.075, 0.93, -0.06], f ? [0.095, 0.11, 0.085] : [0.085, 0.1, 0.075], 'cadera', 0.04))
  side.push(E([0.103, 1.08, 0.008], f ? [0.04, 0.08, 0.068] : [0.042, 0.082, 0.072], 'costado', 0.035))
  side.push(E([0.115, 1.27, -0.035], [0.075 * mus, 0.15, 0.072], 'pecho', 0.04))
  side.push(E([0.065, 1.34, -0.068], [0.088, 0.12, 0.048], 'pecho', 0.04))
  side.push(C([0, 1.52, -0.03], [f ? 0.135 : 0.15, 1.46, -0.02], 0.045 * mus, 0.03, 'pecho', 0.03))
  side.push(f ? E([0.066, 1.305, 0.07], [0.066, 0.064, 0.06], 'pecho', 0.03) : E([0.07, 1.35, 0.07], [0.09, 0.062, 0.052], 'pecho', 0.03))
  const S: V3 = [f ? 0.172 : 0.195, 1.44, 0]
  const th = 0.33, d: V3 = [Math.sin(th), -Math.cos(th), 0]
  const Eb = along(S, d, 0.29)
  side.push(E(off(S, [0.012, -0.018, 0]), [0.066 * mus, 0.08, 0.07 * mus], 'brazo', 0.03))
  side.push(C(S, Eb, 0.05 * mus, 0.038, 'brazo', 0.025))
  side.push(C(off(along(S, d, 0.07), [0, 0, 0.022]), off(along(S, d, 0.23), [0, 0, 0.018]), 0.045 * mus, 0.034 * mus, 'brazo', 0.02))
  side.push(C(off(along(S, d, 0.05), [0, 0, -0.022]), off(along(S, d, 0.21), [0, 0, -0.018]), 0.046 * mus, 0.034 * mus, 'brazo', 0.02))
  const th2 = 0.24, d2: V3 = [Math.sin(th2), -Math.cos(th2), 0.06]
  const W = along(Eb, d2, 0.25)
  side.push(E(Eb, [0.034, 0.036, 0.034], null, 0.02))
  side.push(C(Eb, W, 0.043 * mus, 0.027, 'antebrazo', 0.02))
  side.push(C(off(along(Eb, d2, 0.02), [0.008, 0, 0.012]), off(along(Eb, d2, 0.13), [0.004, 0, 0.008]), 0.05 * mus, 0.037 * mus, 'antebrazo', 0.02))
  side.push(E(along(W, d2, 0.075), [0.022, 0.064, 0.044], null, 0.015))
  const hx = f ? 0.1 : 0.095
  const H: V3 = [hx, 0.93, 0], K: V3 = [hx + 0.015, 0.52, 0.015], A: V3 = [hx + 0.025, 0.09, -0.01]
  side.push(C(H, K, f ? 0.096 : 0.088, 0.054, 'muslo', 0.04))
  side.push(C(off(H, [0.005, -0.07, 0.03]), off(K, [0, 0.08, 0.035]), 0.07 * mus, 0.05, 'muslo', 0.03))
  side.push(E([hx + 0.055, 0.72, 0], [0.04 * mus, 0.12, 0.055], 'muslo', 0.03))
  side.push(E([hx - 0.02, 0.6, 0.035], [0.04 * mus, 0.06, 0.045 * mus], 'muslo', 0.025))
  side.push(C(off(H, [0, -0.07, -0.035]), off(K, [0, 0.06, -0.03]), 0.065 * mus, 0.045, 'muslo', 0.03))
  side.push(E(off(K, [0, -0.01, 0.025]), [0.042, 0.045, 0.035], null, 0.02))
  side.push(C(K, A, 0.05, 0.03, 'pantorrilla', 0.03))
  side.push(E([hx, 0.4, -0.035], [0.045 * mus, 0.095, 0.05 * mus], 'pantorrilla', 0.025))
  side.push(E([hx + 0.04, 0.41, -0.03], [0.035 * mus, 0.085, 0.04 * mus], 'pantorrilla', 0.025))
  side.push(E(off(A, [0, -0.015, 0.005]), [0.035, 0.03, 0.04], null, 0.02))
  side.push(C(off(A, [0, -0.045, -0.02]), off(A, [0.01, -0.06, 0.15]), 0.042, 0.028, null, 0.02))
  for (const p of side) {
    out.push(p)
    const m: Prim = { ...p }
    if (m.t === 0) m.c = [-m.c![0], m.c![1], m.c![2]]
    else { m.a = [-m.a![0], m.a![1], m.a![2]]; m.b = [-m.b![0], m.b![1], m.b![2]] }
    out.push(m)
  }
  for (const p of out) {
    if (p.t === 0) { p.bc = p.c!; p.br = Math.max(...p.r!) }
    else {
      const a = p.a!, b = p.b!
      p.bc = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
      p.br = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2 + Math.max(p.r1!, p.r2!)
      p.ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
      p.l2 = p.ba[0] ** 2 + p.ba[1] ** 2 + p.ba[2] ** 2
      p.rr = p.r1! - p.r2!
      p.a2 = p.l2 - p.rr * p.rr
      p.il2 = 1 / p.l2
    }
  }
  return out
}

function sdEllipsoid(x: number, y: number, z: number, p: Prim) {
  const c = p.c!, r = p.r!
  const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2]
  const k0 = Math.sqrt(px * px + py * py + pz * pz)
  const qx = px / r[0], qy = py / r[1], qz = pz / r[2]
  const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz)
  return k1 === 0 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1
}

/** Cono redondeado (Inigo Quilez). */
function sdRoundCone(x: number, y: number, z: number, p: Prim) {
  const a = p.a!, ba = p.ba!, l2 = p.l2!, rr = p.rr!, a2 = p.a2!, il2 = p.il2!
  const pax = x - a[0], pay = y - a[1], paz = z - a[2]
  const yy = pax * ba[0] + pay * ba[1] + paz * ba[2], zz = yy - l2
  const wx = pax * l2 - ba[0] * yy, wy = pay * l2 - ba[1] * yy, wz = paz * l2 - ba[2] * yy
  const x2 = wx * wx + wy * wy + wz * wz, y2 = yy * yy * l2, z2 = zz * zz * l2
  const k = Math.sign(rr) * rr * rr * x2
  if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - p.r2!
  if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - p.r1!
  return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - p.r1!
}

function prim(x: number, y: number, z: number, p: Prim) {
  const lb = Math.hypot(x - p.bc[0], y - p.bc[1], z - p.bc[2]) - p.br
  if (lb > 0.09) return lb
  return p.t === 0 ? sdEllipsoid(x, y, z, p) : sdRoundCone(x, y, z, p)
}

function field(x: number, y: number, z: number, P: Prim[]) {
  let d = 1e9
  for (const p of P) {
    const v = prim(x, y, z, p), k = p.k
    if (p.sub) {
      const h = Math.max(k - Math.abs(-d - v), 0) / k
      d = -(Math.min(-d, v) - h * h * k * 0.25)
      continue
    }
    const h = Math.max(k - Math.abs(d - v), 0) / k
    d = Math.min(d, v) - h * h * k * 0.25
  }
  return d
}

/** Sin dependencias de three: corre en un Web Worker para no trabar la pantalla. */
export function buildProceduralBodyData(sex: BodySex): BodyMeshData {
  const P = anatomy(sex)
  const h = 0.0075, x0 = -0.46, y0 = -0.005, z0 = -0.18
  const nx = Math.ceil(0.92 / h) + 1, ny = Math.ceil(1.84 / h) + 1, nz = Math.ceil(0.44 / h) + 1
  const F = new Float32Array(nx * ny * nz)
  const id = (i: number, j: number, k: number) => i + nx * (j + ny * k)
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[id(i, j, k)] = field(x0 + i * h, y0 + j * h, z0 + k * h, P)

  const cx = nx - 1, cy = ny - 1, cz = nz - 1
  const cid = (i: number, j: number, k: number) => i + cx * (j + cy * k)
  const cellV = new Int32Array(cx * cy * cz).fill(-1)
  const pos: number[] = []
  const edges: [number, number][] = []
  for (let a = 0; a < 8; a++) for (const bit of [1, 2, 4]) if (!(a & bit)) edges.push([a, a | bit])
  const cv = new Float32Array(8)
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    let inside = 0
    for (let c = 0; c < 8; c++) {
      cv[c] = F[id(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))]!
      if (cv[c]! < 0) inside++
    }
    if (inside === 0 || inside === 8) continue
    let sx = 0, sy = 0, sz = 0, n = 0
    for (const [a, b] of edges) {
      const va = cv[a]!, vb = cv[b]!
      if ((va < 0) === (vb < 0)) continue
      const t = va / (va - vb)
      sx += (a & 1) + ((b & 1) - (a & 1)) * t
      sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t
      sz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t
      n++
    }
    cellV[cid(i, j, k)] = pos.length / 3
    pos.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h)
  }

  const idx: number[] = []
  const quad = (a: number, b: number, c: number, d: number) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return
    idx.push(a, b, c, a, c, d)
  }
  for (let k = 1; k < cz; k++) for (let j = 1; j < cy; j++) for (let i = 1; i < cx; i++) {
    const v0 = F[id(i, j, k)]! < 0
    if (v0 !== F[id(i + 1, j, k)]! < 0) quad(cellV[cid(i, j - 1, k - 1)]!, cellV[cid(i, j, k - 1)]!, cellV[cid(i, j, k)]!, cellV[cid(i, j - 1, k)]!)
    if (v0 !== F[id(i, j + 1, k)]! < 0) quad(cellV[cid(i - 1, j, k - 1)]!, cellV[cid(i - 1, j, k)]!, cellV[cid(i, j, k)]!, cellV[cid(i, j, k - 1)]!)
    if (v0 !== F[id(i, j, k + 1)]! < 0) quad(cellV[cid(i - 1, j - 1, k)]!, cellV[cid(i, j - 1, k)]!, cellV[cid(i, j, k)]!, cellV[cid(i - 1, j, k)]!)
  }

  const nv = pos.length / 3
  const nor = new Float32Array(nv * 3)
  const zones = new Uint8Array(nv)
  const e = h * 0.5
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3]!, y = pos[v * 3 + 1]!, z = pos[v * 3 + 2]!
    const gx = field(x + e, y, z, P) - field(x - e, y, z, P)
    const gy = field(x, y + e, z, P) - field(x, y - e, z, P)
    const gz = field(x, y, z + e, P) - field(x, y, z - e, P)
    const l = Math.hypot(gx, gy, gz) || 1
    nor[v * 3] = gx / l; nor[v * 3 + 1] = gy / l; nor[v * 3 + 2] = gz / l
    let best = 1e9, bz: Zone = null
    for (const p of P) {
      if (p.sub) continue
      const dv = prim(x, y, z, p)
      if (dv < best) { best = dv; bz = p.zone }
    }
    zones[v] = bz ? BODY_ZONE_INDEX[bz] : 0
  }
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t]! * 3, b = idx[t + 1]! * 3, c = idx[t + 2]! * 3
    const ux = pos[b]! - pos[a]!, uy = pos[b + 1]! - pos[a + 1]!, uz = pos[b + 2]! - pos[a + 2]!
    const wx = pos[c]! - pos[a]!, wy = pos[c + 1]! - pos[a + 1]!, wz = pos[c + 2]! - pos[a + 2]!
    const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx
    if (fx * nor[a]! + fy * nor[a + 1]! + fz * nor[a + 2]! < 0) { const s = idx[t + 1]!; idx[t + 1] = idx[t + 2]!; idx[t + 2] = s }
  }

  return { positions: new Float32Array(pos), normals: nor, index: new Uint32Array(idx), zones }
}
