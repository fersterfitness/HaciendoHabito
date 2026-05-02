import { ChevronDown } from 'lucide-react'
import type { PlanningWorkbookStateV1 } from '@/lib/nutrition/planningWorkbookTypes'
import {
  parseLocaleNumberOrZero,
  scaledFromRefs,
  sumTotals,
  ZERO_TOTALS,
} from '@/lib/nutrition/planningCalculations'
import { cn } from '@/lib/utils'

function fmt1(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

/** Vista solo lectura del plan tipo Excel (entrenador/alumno). */
export function PlanningWorkbookReadonlyView({
  wb,
  className,
}: {
  wb: PlanningWorkbookStateV1
  className?: string
}) {
  const foodGrand = (() => {
    let acc = ZERO_TOTALS
    for (const sec of wb.sections) {
      for (const r of sec.rows) {
        const q = parseLocaleNumberOrZero(r.qtyG)
        if (q <= 0) continue
        acc = sumTotals(
          acc,
          scaledFromRefs(q, {
            carbs: parseLocaleNumberOrZero(r.refCarbs),
            protein: parseLocaleNumberOrZero(r.refProt),
            fat: parseLocaleNumberOrZero(r.refFat),
            kcal: parseLocaleNumberOrZero(r.refKcal),
          }),
        )
      }
    }
    return acc
  })()

  return (
    <div className={cn('space-y-6', className)}>
      <section className="rounded-2xl border border-surface-border bg-surface-card p-5 space-y-3 w-full">
        <h2 className="text-sm font-bold text-ink-primary uppercase tracking-wide">Persona · referencia</h2>
        <dl className="grid gap-2 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-[11px] text-ink-muted uppercase font-semibold">Mantención típ · hombre (kcal)</dt>
            <dd className="text-ink-primary">{wb.person.tdeeMale || '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-muted uppercase font-semibold">Mantención típ · mujer (kcal)</dt>
            <dd className="text-ink-primary">{wb.person.tdeeFemale || '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-muted uppercase font-semibold">Peso ejemplo (kg)</dt>
            <dd className="text-ink-primary">{wb.person.weightKg || '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-muted uppercase font-semibold">Sexo · TDEE</dt>
            <dd className="text-ink-primary">{wb.person.sex === 'M' ? 'Hombre' : wb.person.sex === 'F' ? 'Mujer' : '—'}</dd>
          </div>
        </dl>
        <div>
          <p className="text-[11px] text-ink-muted uppercase font-semibold mb-1">Objetivo</p>
          <p className="text-sm text-ink-secondary whitespace-pre-wrap">{wb.objectives || '—'}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] text-ink-muted uppercase font-semibold">Calorías diarias ejemplo</p>
            <p className="text-sm text-ink-primary">{wb.proposedKcal || '—'}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-[10px] text-ink-muted">Prot g/kg</p>
              <p className="tabular-nums">{wb.macroInputs.proteinGPerKg}</p>
            </div>
            <div>
              <p className="text-[10px] text-ink-muted">Carb g/kg</p>
              <p className="tabular-nums">{wb.macroInputs.carbGPerKg}</p>
            </div>
            <div>
              <p className="text-[10px] text-ink-muted">Grasa g/kg</p>
              <p className="tabular-nums">{wb.macroInputs.fatGPerKg}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-surface-border bg-surface-card px-4 py-3 text-sm">
        <p className="font-medium text-ink-primary mb-1">Total del día modelo</p>
        <p className="tabular-nums text-ink-secondary text-sm">
          HC {fmt1(foodGrand.carbsG)} g · Prot {fmt1(foodGrand.proteinG)} g · Grasas {fmt1(foodGrand.fatG)} g · {fmt1(foodGrand.kcal)}{' '}
          kcal
        </p>
      </div>

      <div className="space-y-8">
        {wb.sections.map((sec) => {
          let secTotals = ZERO_TOTALS
          for (const r of sec.rows) {
            const q = parseLocaleNumberOrZero(r.qtyG)
            if (q <= 0) continue
            secTotals = sumTotals(
              secTotals,
              scaledFromRefs(q, {
                carbs: parseLocaleNumberOrZero(r.refCarbs),
                protein: parseLocaleNumberOrZero(r.refProt),
                fat: parseLocaleNumberOrZero(r.refFat),
                kcal: parseLocaleNumberOrZero(r.refKcal),
              }),
            )
          }
          return (
            <section key={sec.key} className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden w-full">
              <div className="border-b border-surface-border bg-surface-muted/40 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wide">{sec.title}</h3>
                  <p className="text-[11px] text-ink-muted mt-0.5">{sec.quantityColumnHint}</p>
                </div>
                <p className="text-[11px] text-ink-secondary tabular-nums shrink-0">
                  Subtotal: HC {fmt1(secTotals.carbsG)} · P {fmt1(secTotals.proteinG)} · G {fmt1(secTotals.fatG)} ·{' '}
                  {fmt1(secTotals.kcal)} kcal
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[960px]">
                  <thead>
                    <tr className="border-b border-surface-border text-left bg-surface-muted/30">
                      <th className="px-3 py-2 font-semibold sticky left-0 bg-surface-muted/30 z-[1] w-[260px]">Alimento</th>
                      <th className="px-2 py-2 font-semibold w-[76px]">Cant. g</th>
                      <th className="px-2 py-2 font-semibold w-[64px]">HC /100</th>
                      <th className="px-2 py-2 font-semibold w-[64px]">P /100</th>
                      <th className="px-2 py-2 font-semibold w-[64px]">G /100</th>
                      <th className="px-2 py-2 font-semibold w-[72px]">kcal /100</th>
                      <th className="px-2 py-2 font-semibold w-[72px]">HC</th>
                      <th className="px-2 py-2 font-semibold w-[72px]">P</th>
                      <th className="px-2 py-2 font-semibold w-[72px]">G</th>
                      <th className="px-2 py-2 font-semibold w-[80px]">kcal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.rows.map((r) => {
                      const q = parseLocaleNumberOrZero(r.qtyG)
                      const refVals = {
                        carbs: parseLocaleNumberOrZero(r.refCarbs),
                        protein: parseLocaleNumberOrZero(r.refProt),
                        fat: parseLocaleNumberOrZero(r.refFat),
                        kcal: parseLocaleNumberOrZero(r.refKcal),
                      }
                      const out = q > 0 ? scaledFromRefs(q, refVals) : ZERO_TOTALS
                      return (
                        <tr key={r.id} className="border-b border-surface-border/80">
                          <td className="px-3 py-2 sticky left-0 bg-surface-card align-top border-r border-surface-border/50 max-w-[280px]">
                            <p className="text-ink-primary font-medium break-words">{r.name}</p>
                            {r.hint ? (
                              <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 leading-snug">{r.hint}</p>
                            ) : null}
                          </td>
                          <td className="px-2 py-2 tabular-nums text-ink-secondary">{r.qtyG || '—'}</td>
                          <td className="px-2 py-2 tabular-nums text-ink-secondary">{r.refCarbs}</td>
                          <td className="px-2 py-2 tabular-nums text-ink-secondary">{r.refProt}</td>
                          <td className="px-2 py-2 tabular-nums text-ink-secondary">{r.refFat}</td>
                          <td className="px-2 py-2 tabular-nums text-ink-secondary">{r.refKcal}</td>
                          <td className="px-2 py-2 tabular-nums text-ink-secondary">{fmt1(out.carbsG)}</td>
                          <td className="px-2 py-2 tabular-nums text-ink-secondary">{fmt1(out.proteinG)}</td>
                          <td className="px-2 py-2 tabular-nums text-ink-secondary">{fmt1(out.fatG)}</td>
                          <td className="px-2 py-2 tabular-nums text-ink-secondary">{fmt1(out.kcal)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>

      <details className="rounded-2xl border border-surface-border bg-surface-card p-5 group">
        <summary className="cursor-pointer flex items-start gap-2 text-sm font-semibold text-ink-primary list-none [&::-webkit-details-marker]:hidden">
          <ChevronDown className="w-5 h-5 shrink-0 text-ink-muted mt-0.5 transition-transform [.group:not([open])_&]:-rotate-90" aria-hidden />
          Referencias de macros y textos largos (opcional)
        </summary>
        <div className="mt-4 space-y-4 text-sm text-ink-secondary">
          <ul className="list-disc pl-5 space-y-1">
            <li>Proteínas: {wb.macroGuide.proteinPerKgHint}</li>
            <li>Carbohidratos: {wb.macroGuide.carbPerKgHint}</li>
            <li>Grasas: {wb.macroGuide.fatPerKgHint}</li>
          </ul>
          <p className="text-ink-muted text-xs">{wb.macroGuide.contextNote}</p>
          <div className="grid gap-2 md:grid-cols-2 border-t border-surface-border pt-4">
            <p>{wb.objectivesGuide.superavitCal}</p>
            <p>{wb.objectivesGuide.deficitCal}</p>
          </div>
        </div>
      </details>
    </div>
  )
}
