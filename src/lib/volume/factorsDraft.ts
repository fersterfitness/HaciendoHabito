import { VOLUME_MUSCLES, type MuscleFactors, type MuscleId } from '@/lib/volume/trainingVolume'

/** Valores de implicación como texto editable (acepta coma decimal). */
export type FactorsDraft = Partial<Record<MuscleId, string>>

export function factorsToDraft(f: MuscleFactors): FactorsDraft {
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, String(v).replace('.', ',')])) as FactorsDraft
}

export function draftToFactors(d: FactorsDraft): MuscleFactors {
  const out: MuscleFactors = {}
  for (const m of VOLUME_MUSCLES) {
    const v = Number(String(d[m.id] ?? '').replace(',', '.'))
    if (Number.isFinite(v) && v > 0) out[m.id] = Math.min(1.5, Math.round(v * 100) / 100)
  }
  return out
}
