import { Fragment, useMemo } from 'react'
import { X } from 'lucide-react'
import { buildRoutineProgressionGuide } from '@/lib/routine/routineProgressionGuide'
import type { GuideBlock } from '@/lib/routine/routineProgressionGuide'
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

const DATA_LABEL = 'SERIES/REPS /PESO KG'

function weekCellBg(i: number): string {
  return i % 2 === 0
    ? 'bg-zinc-300/90 dark:bg-zinc-700/55'
    : 'bg-brand-primary/30 dark:bg-brand-primary/25'
}

function weekHeaderBg(i: number): string {
  return i % 2 === 0 ? 'bg-zinc-600' : 'bg-brand-primary/85'
}

function BlockExerciseRows({ block }: { block: GuideBlock }) {
  const labelCol = (
    <div className="flex w-[4.75rem] shrink-0 items-center justify-center border-r border-black/15 px-0.5 text-center text-[7px] font-bold uppercase leading-tight text-zinc-600 dark:border-white/15 dark:text-zinc-300">
      {DATA_LABEL}
    </div>
  )

  return (
    <>
      {block.exercises.map((row, exIdx) => (
        <tr key={row.key} className="bg-zinc-100 dark:bg-zinc-900">
          <td className="sticky left-0 z-10 border-b border-r border-zinc-700 bg-black px-2 py-2 align-middle text-[11px] font-semibold uppercase leading-tight text-white">
            {row.exerciseName}
          </td>
          {row.weeks.map((cell, i) => (
            <td key={i} className={cn('border-b border-zinc-700 p-0 align-middle', weekCellBg(i))}>
              <div className="flex min-h-[2.35rem]">
                {exIdx === 0 ? labelCol : <div className="w-[4.75rem] shrink-0 border-r border-black/15 dark:border-white/15" aria-hidden />}
                <div className="flex min-w-0 flex-1 items-center justify-center px-2 py-1.5 text-center text-[11px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {cell?.trim() || ''}
                </div>
              </div>
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

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
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/75 p-1 sm:p-3"
      role="dialog"
      aria-modal
      aria-labelledby="progression-guide-title"
    >
      <div className="mx-auto flex h-full w-full max-w-[92rem] flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-primary">
              Solo entrenador · no PDF ni alumno
            </p>
            <h2 id="progression-guide-title" className="truncate text-base font-bold text-white">
              Guía de progresión — {routineName}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              Días y semanas · CIRCUITO o INDIVIDUAL · aclaración/descanso · series/reps/peso.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Cerrar guía"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-4 space-y-8">
          {sections.length === 0 ? (
            <p className="text-sm text-zinc-400">Agregá semanas y días para ver la guía.</p>
          ) : (
            sections.map((section) => (
              <section key={section.dayKey} className="overflow-hidden rounded-lg border border-zinc-800">
                <div className="bg-brand-primary px-3 py-2 text-sm font-extrabold uppercase tracking-widest text-white">
                  {section.dayTitle}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-20 min-w-[11rem] border-b border-r border-zinc-700 bg-black px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-white">
                          Ejercicio / bloque
                        </th>
                        {weekLabels.map((w, i) => (
                          <th
                            key={i}
                            className={cn(
                              'min-w-[10rem] border-b border-zinc-700 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-white',
                              weekHeaderBg(i),
                            )}
                          >
                            <div>{w.label}</div>
                            {w.dates ? (
                              <div className="mt-0.5 text-[9px] font-normal normal-case text-white/80">{w.dates}</div>
                            ) : null}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.blocks.map((block, blockIdx) => (
                        <Fragment key={block.key}>
                          {blockIdx > 0 ? (
                            <tr aria-hidden>
                              <td colSpan={1 + weekLabels.length} className="h-1.5 bg-red-600 p-0" />
                            </tr>
                          ) : null}

                          <tr className="bg-black">
                            <td className="sticky left-0 z-10 border-b border-r border-zinc-700 bg-black px-2 py-2 text-center text-[11px] font-extrabold uppercase tracking-wider text-white">
                              {KIND_LABEL[block.kind]}
                            </td>
                            {block.headerNotesByWeek.map((note, i) => (
                              <td
                                key={i}
                                className={cn(
                                  'border-b border-zinc-700 px-2 py-2 text-center text-[10px] font-semibold uppercase leading-snug',
                                  i % 2 === 0 ? 'bg-zinc-400 text-zinc-900' : 'bg-brand-primary/75 text-white',
                                )}
                              >
                                {note?.trim() || ''}
                              </td>
                            ))}
                          </tr>

                          <BlockExerciseRows block={block} />
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
