import { MUSCLE_IDS, VOLUME_MUSCLES, muscleTarget, volumeStatus, type MuscleId, type VolumeSettings, type VolumeStatus, type WeekVolume } from './trainingVolume'

/** «Comparar» con volumen (feedback nov3): series efectivas por músculo, la otra rutina contra la que se arma. */
export type VolumeCompareRow = {
  id: MuscleId
  label: string
  before: number
  now: number
  diff: number
  statusBefore: VolumeStatus
  statusNow: VolumeStatus
  target: { min: number; max: number }
}

export function compareWeekVolume(before: WeekVolume, now: WeekVolume, settings: VolumeSettings): VolumeCompareRow[] {
  return MUSCLE_IDS.map((id) => {
    const target = muscleTarget(settings, id)
    const b = before.weighted[id] ?? 0
    const n = now.weighted[id] ?? 0
    return {
      id,
      label: VOLUME_MUSCLES.find((m) => m.id === id)!.label,
      before: b,
      now: n,
      diff: Math.round((n - b) * 10) / 10,
      statusBefore: volumeStatus(b, target),
      statusNow: volumeStatus(n, target),
      target,
    }
  }).filter((r) => r.before > 0 || r.now > 0)
}
