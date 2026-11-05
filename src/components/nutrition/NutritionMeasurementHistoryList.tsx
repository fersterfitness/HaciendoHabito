import { type ReactNode, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, Copy, Loader2, Pencil, Trash2 } from 'lucide-react'
import { IS_V2 } from '@/lib/uiVersion'
import type { NutritionMeasurement } from '@/types/database'
import { mergedMediansForPresentation } from '@/lib/nutrition/anthropometryPresentation'
import { weightOf } from '@/lib/nutrition/measurementDerivatives'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

function hasProgramData(m: NutritionMeasurement): boolean {
  const med = mergedMediansForPresentation(m)
  return Object.values(med).some((v) => v != null && Number.isFinite(v as number))
}

function heightLabel(m: NutritionMeasurement): string {
  const med = mergedMediansForPresentation(m)
  const cm = med.talla_corporal_cm ?? m.height_cm
  return cm != null ? `${cm} cm` : '—'
}

function weightLabel(m: NutritionMeasurement): string {
  const w = weightOf(m)
  return w != null ? `${w} kg` : '—'
}

type SortKey = 'num' | 'date' | 'weight'
type Sort = { key: SortKey; dir: 'asc' | 'desc' }

const TH = 'whitespace-nowrap px-3 py-2.5 text-3xs font-semibold text-ink-muted sm:px-4'

function SortTh({ label, k, sort, onSort }: { label: ReactNode; k: SortKey; sort: Sort; onSort: (k: SortKey) => void }) {
  if (!IS_V2) return <th className={TH}>{label}</th>
  const active = sort.key === k
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className={TH} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn('inline-flex items-center gap-1 transition-colors hover:text-ink-primary', active && 'text-ink-primary')}
      >
        {label}
        <Icon className={cn('h-3 w-3', !active && 'opacity-50')} aria-hidden />
      </button>
    </th>
  )
}

export function NutritionMeasurementHistoryList({
  measurements,
  selectedId,
  onSelect,
  onEdit,
  onClone,
  onDelete,
  deletingId = null,
}: {
  measurements: NutritionMeasurement[]
  selectedId: string | null
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onClone: (id: string) => void
  onDelete?: (id: string) => void
  deletingId?: string | null
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>({ key: 'date', dir: 'desc' })

  /** N° de respaldo según el orden cronológico (la lista llega de la más nueva a la más vieja). */
  const fallbackNum = useMemo(() => new Map(measurements.map((m, i) => [m.id, measurements.length - i])), [measurements])

  const rows = useMemo(() => {
    if (!IS_V2) return measurements
    const val = (m: NutritionMeasurement): number | null =>
      sort.key === 'date'
        ? new Date(m.measured_at).getTime()
        : sort.key === 'num'
          ? (m.measurement_number ?? fallbackNum.get(m.id) ?? null)
          : weightOf(m)
    const sign = sort.dir === 'asc' ? 1 : -1
    return [...measurements].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      return (va - vb) * sign || (new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime())
    })
  }, [measurements, sort, fallbackNum])

  function onSort(k: SortKey) {
    setSort((prev) => (prev.key === k ? { key: k, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: k === 'date' ? 'desc' : 'asc' }))
  }

  if (measurements.length === 0) {
    return (
      <p className="text-sm text-ink-muted py-2">
        Todavía no hay controles guardados. Usá el programa de arriba o la medición rápida.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-2xs text-ink-muted">
        {measurements.length === 1
          ? '1 control guardado. Clic en la fila para el informe «Presentación».'
          : `${measurements.length} controles. Clic en la fila para el informe; Editar o Clonar cargan el programa arriba.`}
      </p>

      <div className="overflow-x-auto rounded-xl border border-surface-border/80">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-surface-border bg-surface-elevated/40">
              <SortTh label="N°" k="num" sort={sort} onSort={onSort} />
              <SortTh label="Fecha" k="date" sort={sort} onSort={onSort} />
              <th className="whitespace-nowrap px-3 py-2.5 text-3xs font-semibold text-ink-muted sm:px-4">
                Tipo
              </th>
              <SortTh label="Peso" k="weight" sort={sort} onSort={onSort} />
              <th className="whitespace-nowrap px-3 py-2.5 text-3xs font-semibold text-ink-muted sm:px-4">
                Talla
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-3xs font-semibold text-ink-muted sm:px-4">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, index) => {
              const active = m.id === selectedId
              const program = hasProgramData(m)
              const controlNum = m.measurement_number ?? fallbackNum.get(m.id) ?? measurements.length - index
              return (
                <tr
                  key={m.id}
                  className={cn(
                    'group cursor-pointer transition-colors',
                    active
                      ? 'bg-brand-secondary/10'
                      : 'hover:bg-surface-elevated/40',
                    index < measurements.length - 1 && 'border-b border-surface-border/70',
                  )}
                  onClick={() => onSelect(m.id)}
                >
                  <td className="px-3 py-2.5 sm:px-4">
                    <span
                      className={cn(
                        'inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg px-1.5 text-2xs font-semibold tabular-nums',
                        active
                          ? 'bg-brand-secondary/20 text-brand-secondary'
                          : 'bg-surface-elevated text-ink-muted',
                      )}
                    >
                      {controlNum}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-sm font-medium text-ink-primary sm:px-4">
                    {format(parseISO(m.measured_at), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4">
                    <span
                      className={cn(
                        'inline-flex rounded-md border px-2 py-0.5 text-3xs font-medium',
                        program
                          ? 'border-brand-secondary/30 bg-brand-secondary/10 text-brand-secondary'
                          : 'border-surface-border text-ink-muted',
                      )}
                    >
                      {program ? 'Programa Holway' : 'Express'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-sm tabular-nums text-ink-secondary sm:px-4">
                    {weightLabel(m)}
                  </td>
                  <td className="px-3 py-2.5 text-sm tabular-nums text-ink-secondary sm:px-4">
                    {heightLabel(m)}
                  </td>
                  <td className="px-2 py-2 sm:px-3" onClick={(e) => e.stopPropagation()}>
                    {confirmId === m.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="hidden text-xs text-ink-muted sm:inline">¿Eliminar?</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          className="h-8 px-2 sm:px-2.5"
                          icon={
                            deletingId === m.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : undefined
                          }
                          disabled={deletingId === m.id}
                          onClick={() => onDelete?.(m.id)}
                          title="Confirmar eliminación"
                        >
                          Sí
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 sm:px-2.5"
                          disabled={deletingId === m.id}
                          onClick={() => setConfirmId(null)}
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 sm:px-2.5"
                          icon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => onEdit(m.id)}
                          title="Editar en el programa"
                        >
                          <span className="hidden sm:inline">Editar</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 px-2 sm:px-2.5"
                          icon={<Copy className="h-3.5 w-3.5" />}
                          onClick={() => onClone(m.id)}
                          title="Clonar como nuevo control"
                        >
                          <span className="hidden sm:inline">Clonar</span>
                        </Button>
                        {onDelete ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-ink-muted hover:text-status-expired sm:px-2.5"
                            icon={<Trash2 className="h-3.5 w-3.5" />}
                            onClick={() => setConfirmId(m.id)}
                            title="Eliminar control"
                          >
                            <span className="sr-only">Eliminar</span>
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function NutritionMeasurementHistoryListTitle() {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-secondary/15 text-brand-secondary">
        <Activity className="h-4 w-4" aria-hidden />
      </span>
      <div>
        <h3 className="text-sm font-semibold text-ink-primary">Historial de controles</h3>
        <p className="text-xs text-ink-muted">Todas las antropometrías guardadas de este paciente</p>
      </div>
    </div>
  )
}
