import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BarChart3 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { bodySexOf } from '@/components/nutrition/body2d/zones'
import { loadPainEvents, painInRange, type PainEvent } from '@/lib/checkIn/painEvents'
import { painMuscles } from '@/lib/volume/painMuscles'
import { loadVolumeData, FACTORY_PROFILE, type VolumeData } from '@/lib/volume/volumeData'
import {
  computeWeekVolume,
  MUSCLE_IDS,
  muscleTarget,
  VOLUME_MUSCLES,
  volumeStatus,
  type MuscleId,
  type VolumeExerciseInput,
  type VolumeStatus,
} from '@/lib/volume/trainingVolume'
import { VolumeBodyMini, type BodyPain } from './VolumeBodyMap'

type Week = {
  id: string
  name: string | null
  sort_order: number
  start_date: string | null
  end_date: string | null
  days: { id: string; day_name: string; sort_order: number; exercises: VolumeExerciseInput[] }[]
}

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Semana que se está haciendo hoy; si hoy no cae en ninguna, la última que ya arrancó (o la primera). */
function currentWeekIndex(weeks: Week[], today: string): number {
  const inside = weeks.findIndex((w) => w.start_date && w.end_date && w.start_date <= today && today <= w.end_date)
  if (inside >= 0) return inside
  let last = -1
  weeks.forEach((w, i) => {
    if (w.start_date && w.start_date <= today) last = i
  })
  return Math.max(0, last)
}

/**
 * v2 · Ficha del alumno: mapa muscular chico de la semana en curso de la rutina activa, con las
 * molestias del check-in. El detalle completo está en el panel de Volumen de la rutina.
 */
export function StudentVolumeMini({
  routineId,
  studentId,
  gender,
  onOpen,
}: {
  routineId: string
  studentId: string
  gender: 'M' | 'F' | 'otro' | null
  onOpen: () => void
}) {
  const [weeks, setWeeks] = useState<Week[] | null>(null)
  const [data, setData] = useState<VolumeData | null>(null)
  const [pains, setPains] = useState<PainEvent[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setWeeks(null)
    setFailed(false)
    Promise.all([
      supabase
        .from('routine_blocks')
        .select('*, days:routine_days(*, exercises:routine_exercises(*, exercise:exercise_library(name, muscle_group:muscle_groups(slug))))')
        .eq('routine_id', routineId)
        .order('sort_order'),
      loadVolumeData(studentId),
      loadPainEvents(studentId).catch(() => [] as PainEvent[]),
    ])
      .then(([blocksRes, volume, painList]) => {
        if (!alive) return
        if (blocksRes.error) throw new Error(blocksRes.error.message)
        setWeeks((blocksRes.data ?? []) as Week[])
        setData(volume)
        setPains(painList)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [routineId, studentId])

  const view = useMemo(() => {
    if (!weeks?.length || !data) return null
    const idx = currentWeekIndex(weeks, todayYmd())
    const week = weeks[idx]!
    const settings = (data.profiles.find((p) => p.is_default) ?? data.profiles[0] ?? FACTORY_PROFILE).settings
    const vol = computeWeekVolume(
      [...(week.days ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      { settings, factorOverrides: data.factorOverrides, methodNames: data.methodNames },
    )
    const status = Object.fromEntries(
      MUSCLE_IDS.map((id) => [id, volumeStatus(vol.weighted[id], muscleTarget(settings, id))]),
    ) as Record<MuscleId, VolumeStatus>
    const bodyPains: BodyPain[] = painInRange(pains, week.start_date, week.end_date).flatMap((p) =>
      painMuscles(p.note).map((muscle) => ({ muscle, text: `${p.date.slice(8, 10)}/${p.date.slice(5, 7)} · ${p.note || 'sin aclaración'}` })),
    )
    const pick = (st: VolumeStatus) => MUSCLE_IDS.filter((id) => status[id] === st)
    return { label: week.name?.trim() || `Semana ${idx + 1}`, status, bodyPains, low: pick('low'), high: pick('high'), ok: pick('ok') }
  }, [weeks, data, pains])

  const sex = bodySexOf({ id: studentId, gender }) ?? 'M'
  const name = (m: MuscleId) => VOLUME_MUSCLES.find((v) => v.id === m)!.label
  const painNames = view ? [...new Set(view.bodyPains.map((p) => p.muscle))].map(name) : []

  return (
    <section className="rounded-xl border border-surface-border/70 bg-surface-elevated/60 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-3xs font-semibold text-ink-muted">Volumen{view ? ` · ${view.label}` : ''}</p>
        <Button type="button" variant="secondary" size="sm" icon={<BarChart3 className="h-3.5 w-3.5" />} onClick={onOpen}>
          Ver volumen
        </Button>
      </div>

      {failed ? (
        <p className="mt-3 text-body-sm text-ink-muted">No se pudo calcular el volumen.</p>
      ) : !weeks || !data ? (
        <p className="mt-3 text-body-sm text-ink-muted">Calculando…</p>
      ) : !view ? (
        <p className="mt-3 text-body-sm text-ink-muted">La rutina todavía no tiene semanas cargadas.</p>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <VolumeBodyMini sex={sex} status={view.status} pains={view.bodyPains} />
          <ul className="min-w-0 flex-1 space-y-1.5 text-body-sm">
            <li className="flex gap-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: 'rgb(104 196 140)' }} />
              <span className="text-ink-secondary">
                <span className="font-semibold text-ink-primary">{view.ok.length}</span> en rango
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: 'rgb(240 192 112)' }} />
              <span className="text-ink-secondary">
                <span className="font-semibold text-ink-primary">{view.low.length}</span> por debajo
                {view.low.length ? `: ${view.low.map(name).join(', ')}` : ''}
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: 'rgb(236 120 104)' }} />
              <span className="text-ink-secondary">
                <span className="font-semibold text-ink-primary">{view.high.length}</span> por encima
                {view.high.length ? `: ${view.high.map(name).join(', ')}` : ''}
              </span>
            </li>
            {painNames.length ? (
              <li className="flex gap-2 font-medium text-status-expired">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Molestia esta semana: {painNames.join(', ')}</span>
              </li>
            ) : null}
          </ul>
        </div>
      )}
    </section>
  )
}
