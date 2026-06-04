import { Fragment, useMemo } from 'react'
import { X } from 'lucide-react'
import { buildRoutineProgressionGuide } from '@/lib/routine/routineProgressionGuide'
import type { RoutineBlock, RoutineDay, RoutineExercise, Exercise } from '@/types/database'
import { cn } from '@/lib/utils'

type Ex = RoutineExercise & { exercise?: Exercise }
type Day = RoutineDay & { exercises: Ex[] }
type Block = RoutineBlock & { days: Day[] }

type Props = {
  open: boolean
  onClose: () => void
  routineName: string
  blocks: Block[]
}

const KIND_LABEL = {
  circuit: 'CIRCUITO',
  individual: 'INDIVIDUAL',
} as const

export function RoutineProgressionGuidePanel({ open, onClose, routineName, blocks }: Props) {
  const sections = useMemo(() => buildRoutineProgressionGuide(blocks), [blocks])
  const weekLabels = useMemo(
    () =>
      [...blocks]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((b, i) => ({
          label: b.name?.trim() || `Semana ${i + 1}`,
          dates:
            b.start_date || b.end_date
              ? `${b.start_date ? new Date(b.start_date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '?'} – ${b.end_date ? new Date(b.end_date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '?'}`
              : null,
        })),
    [blocks],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-2 sm:p-4" role="dialog" aria-modal aria-labelledby="progression-guide-title">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-base shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-surface-border bg-brand-primary/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-primary">Solo entrenador · no PDF ni alumno</p>
            <h2 id="progression-guide-title" className="truncate text-base font-bold text-ink-primary">
              Guía de progresión — {routineName}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Series, reps y peso planificados por semana (SIN KG si no hay peso cargado).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-surface-border p-2 text-ink-muted hover:bg-surface-elevated hover:text-ink-primary"
            aria-label="Cerrar guía"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4 space-y-6">
          {sections.length === 0 ? (
            <p className="text-sm text-ink-muted">Agregá semanas y días para ver la guía.</p>
          ) : (
            sections.map((section) => (
              <section key={section.dayKey} className="space-y-2">
                <h3 className="sticky top-0 z-10 rounded-lg bg-brand-primary px-3 py-2 text-sm font-bold uppercase tracking-wide text-white">
                  {section.dayTitle}
                </h3>
                <div className="overflow-x-auto rounded-xl border border-surface-border">
                  <table className="w-full min-w-[720px] border-collapse text-xs">
                    <thead>
                      <tr className="bg-surface-elevated">
                        <th className="sticky left-0 z-10 min-w-[160px] border-b border-r border-surface-border bg-surface-elevated px-2 py-2 text-left font-semibold text-ink-primary">
                          Ejercicio / bloque
                        </th>
                        {weekLabels.map((w, i) => (
                          <th
                            key={i}
                            className={cn(
                              'min-w-[100px] border-b border-surface-border px-2 py-2 text-center font-semibold',
                              i % 2 === 0 ? 'bg-brand-primary/15 text-brand-primary' : 'bg-surface-card text-ink-primary',
                            )}
                          >
                            <div>{w.label}</div>
                            {w.dates ? <div className="mt-0.5 font-normal text-[10px] text-ink-muted">{w.dates}</div> : null}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.blocks.map((block) => (
                        <Fragment key={block.key}>
                          <tr className="bg-zinc-900/90 dark:bg-zinc-950">
                            <td className="sticky left-0 z-10 border-b border-r border-surface-border bg-zinc-900 px-2 py-2 align-top font-bold uppercase tracking-wide text-white dark:bg-zinc-950">
                              {KIND_LABEL[block.kind]}
                            </td>
                            {block.headerNotesByWeek.map((note, i) => (
                              <td
                                key={i}
                                className={cn(
                                  'border-b border-surface-border px-2 py-2 align-top whitespace-pre-wrap text-[10px] font-medium text-ink-secondary',
                                  i % 2 === 0 ? 'bg-brand-primary/5' : 'bg-surface-card/50',
                                )}
                              >
                                {note?.trim() || ''}
                              </td>
                            ))}
                          </tr>
                          {block.exercises.map((row, exIdx) => (
                            <tr key={row.key} className="hover:bg-surface-elevated/40">
                              <td className="sticky left-0 z-10 border-b border-r border-surface-border bg-surface-base px-2 py-2 align-top">
                                <div className="font-semibold text-ink-primary">{row.exerciseName}</div>
                              </td>
                              {row.weeks.map((cell, i) => (
                                <td
                                  key={i}
                                  className={cn(
                                    'border-b border-surface-border px-2 py-2 align-top text-center',
                                    i % 2 === 0 ? 'bg-brand-primary/5' : '',
                                  )}
                                >
                                  {exIdx === 0 ? (
                                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-ink-muted">
                                      Series/reps / peso
                                    </p>
                                  ) : null}
                                  <p className="font-medium tabular-nums text-ink-primary whitespace-pre-wrap">
                                    {cell ?? ''}
                                  </p>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
