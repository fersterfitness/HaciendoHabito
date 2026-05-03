import { ChevronDown } from 'lucide-react'
import type { MealSlotKey, MealSlotPick, PlanningWorkbookStateV1 } from '@/lib/nutrition/planningWorkbookTypes'
import {
  MEAL_SLOT_LABELS,
  mealDistributionHasMealPicks,
  normalizeMealDistribution,
} from '@/lib/nutrition/planningWorkbookTypes'
import {
  grandTotalsFromWorkbook,
  parseLocaleNumberOrZero,
  scaledFromRefs,
  sumTotals,
  ZERO_TOTALS,
} from '@/lib/nutrition/planningCalculations'
import { cn, formatDate } from '@/lib/utils'
import { buildStudentQuantitySummaryLines } from '@/lib/nutrition/mealPickPresentation'

function fmt1(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

function mealLayoutFrom(md: ReturnType<typeof normalizeMealDistribution>) {
  return [
    { slot: 'desayuno' as MealSlotKey, title: MEAL_SLOT_LABELS.desayuno, notes: md.desayuno },
    ...(md.includeMidMorning
      ? [{ slot: 'mediaManana' as MealSlotKey, title: MEAL_SLOT_LABELS.mediaManana, notes: md.mediaManana }]
      : []),
    { slot: 'almuerzo', title: MEAL_SLOT_LABELS.almuerzo, notes: md.almuerzo },
    ...(md.includeMidAfternoon
      ? [{ slot: 'mediaTarde' as MealSlotKey, title: MEAL_SLOT_LABELS.mediaTarde, notes: md.mediaTarde }]
      : []),
    { slot: 'merienda', title: MEAL_SLOT_LABELS.merienda, notes: md.merienda },
    { slot: 'cena', title: MEAL_SLOT_LABELS.cena, notes: md.cena },
  ]
}

function anyMealContent(md: ReturnType<typeof normalizeMealDistribution>) {
  if (mealDistributionHasMealPicks(md)) return true
  return mealLayoutFrom(md).some((b) => b.notes.trim().length > 0)
}

/** Hint guardado o texto de plantilla (Mi lista no tiene notas en esta vista si no hubo snapshot). */
function hintForStudentPick(p: MealSlotPick, wb: PlanningWorkbookStateV1): string | undefined {
  const snap = p.hintSnapshot?.trim()
  if (snap) return snap
  if (p.kind === 'plan_row') {
    const sec = wb.sections.find((s) => s.key === p.secKey)
    const row = sec?.rows.find((r) => r.id === p.rowId)
    return row?.hint?.trim() || undefined
  }
  return undefined
}

/** Vista solo lectura del plan. `student` oculta macros y columnas técnicas. */
export function PlanningWorkbookReadonlyView({
  wb,
  className,
  audience = 'trainer',
  documentUpdatedAt,
}: {
  wb: PlanningWorkbookStateV1
  className?: string
  audience?: 'trainer' | 'student'
  /** ej. `trainer_student_meal_plans.updated_at` o workbook guardado */
  documentUpdatedAt?: string | null
}) {
  const showTechnical = audience === 'trainer'
  const md = normalizeMealDistribution(wb.mealDistribution)
  const layout = mealLayoutFrom(md)
  const showMealCard = anyMealContent(md) || audience === 'student'

  const foodGrand = grandTotalsFromWorkbook(wb)

  return (
    <div className={cn('space-y-6', className)}>
      {showMealCard ? (
        <section className="rounded-2xl border border-surface-border bg-surface-card p-5 space-y-4 w-full print:border-0 print:shadow-none">
          <div>
            <h2 className="text-sm font-bold text-ink-primary uppercase tracking-wide">Distribución del día</h2>
            {documentUpdatedAt ? (
              <p className="text-[10px] text-ink-muted mt-1 tabular-nums">
                Última actualización: {formatDate(documentUpdatedAt)}
              </p>
            ) : null}
            {!anyMealContent(md) && audience === 'student' ? (
              <p className="text-sm text-ink-muted mt-2 leading-relaxed">
                Tu entrenador puede completar aquí los alimentos sugeridos por momento del día.
              </p>
            ) : null}
          </div>
          <div className="space-y-4">
            {layout.map((b) => {
              const picks: MealSlotPick[] =
                (md.picksByMeal?.[b.slot as MealSlotKey] as MealSlotPick[] | undefined) ?? []
              const hasSlot = picks.length > 0 || b.notes.trim().length > 0
              if (!hasSlot) return null
              return (
                <div
                  key={b.slot}
                  className="rounded-xl border border-surface-border bg-surface-card overflow-hidden shadow-sm"
                >
                  <div className="px-3 py-2 bg-surface-muted/50 border-b border-surface-border">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{b.title}</p>
                  </div>
                  <div className="p-3 space-y-3 bg-surface-muted/10">
                    {picks.length > 0 ? (
                      <ul className="space-y-2">
                        {picks.map((p) => {
                          const hintText = hintForStudentPick(p, wb)
                          const lines = buildStudentQuantitySummaryLines({
                            gramsStr: p.qtyG,
                            nameSnapshot: p.nameSnapshot,
                            hint: hintText,
                            preparation: p.preparation,
                          })
                          return (
                            <li
                              key={p.id}
                              className="rounded-lg border border-surface-border/70 bg-surface-card px-2.5 py-2 text-sm"
                            >
                              <div className="grid grid-cols-1 min-[420px]:grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 items-start">
                                <div className="min-w-0 space-y-1">
                                  <p className="font-medium text-ink-primary text-[13px] leading-snug">{p.nameSnapshot}</p>
                                  {lines.prepLine ? (
                                    <p className="text-[10px] text-ink-muted leading-snug">{lines.prepLine}</p>
                                  ) : null}
                                  {hintText ? (
                                    <p className="text-[10px] text-ink-muted italic leading-snug border-l-2 border-brand-primary/30 pl-2">
                                      Tip / unidad: {hintText}
                                    </p>
                                  ) : null}
                                </div>
                                <p className="text-[10px] text-ink-secondary tabular-nums leading-snug min-[420px]:text-right min-[420px]:max-w-[12rem] min-[420px]:self-start">
                                  {lines.gramsLine}
                                </p>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                    {b.notes.trim() ? (
                      <div className="rounded-lg border border-dashed border-surface-border/80 bg-surface-muted/20 px-2.5 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-ink-muted mb-1">Observaciones</p>
                        <p className="text-xs text-ink-secondary whitespace-pre-wrap leading-relaxed">{b.notes.trim()}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
          {wb.objectives.trim() && audience === 'student' ? (
            <div className="pt-2 border-t border-surface-border/80">
              <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wide mb-1">Objetivo</p>
              <p className="text-sm text-ink-secondary whitespace-pre-wrap">{wb.objectives}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {showTechnical ? (
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
      ) : null}

      {showTechnical ? (
        <div className="rounded-xl border border-surface-border bg-surface-card px-4 py-3 text-sm">
          <p className="font-medium text-ink-primary mb-1">Total del día modelo</p>
          <p className="tabular-nums text-ink-secondary text-sm">
            HC {fmt1(foodGrand.carbsG)} g · Prot {fmt1(foodGrand.proteinG)} g · Grasas {fmt1(foodGrand.fatG)} g ·{' '}
            {fmt1(foodGrand.kcal)} kcal
          </p>
        </div>
      ) : null}

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
                {showTechnical ? (
                  <p className="text-[11px] text-ink-secondary tabular-nums shrink-0">
                    Subtotal: HC {fmt1(secTotals.carbsG)} · P {fmt1(secTotals.proteinG)} · G {fmt1(secTotals.fatG)} ·{' '}
                    {fmt1(secTotals.kcal)} kcal
                  </p>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                <table className={cn('w-full text-xs', showTechnical ? 'min-w-[960px]' : 'min-w-[280px]')}>
                  <thead>
                    <tr className="border-b border-surface-border text-left bg-surface-muted/30">
                      <th className="px-3 py-2 font-semibold sticky left-0 bg-surface-muted/30 z-[1] w-[260px]">Alimento</th>
                      <th className="px-2 py-2 font-semibold w-[76px]">Cant. g</th>
                      {showTechnical ? (
                        <>
                          <th className="px-2 py-2 font-semibold w-[64px]">HC /100</th>
                          <th className="px-2 py-2 font-semibold w-[64px]">P /100</th>
                          <th className="px-2 py-2 font-semibold w-[64px]">G /100</th>
                          <th className="px-2 py-2 font-semibold w-[72px]">kcal /100</th>
                          <th className="px-2 py-2 font-semibold w-[72px]">HC</th>
                          <th className="px-2 py-2 font-semibold w-[72px]">P</th>
                          <th className="px-2 py-2 font-semibold w-[72px]">G</th>
                          <th className="px-2 py-2 font-semibold w-[80px]">kcal</th>
                        </>
                      ) : null}
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
                          {showTechnical ? (
                            <>
                              <td className="px-2 py-2 tabular-nums text-ink-secondary">{r.refCarbs}</td>
                              <td className="px-2 py-2 tabular-nums text-ink-secondary">{r.refProt}</td>
                              <td className="px-2 py-2 tabular-nums text-ink-secondary">{r.refFat}</td>
                              <td className="px-2 py-2 tabular-nums text-ink-secondary">{r.refKcal}</td>
                              <td className="px-2 py-2 tabular-nums text-ink-secondary">{fmt1(out.carbsG)}</td>
                              <td className="px-2 py-2 tabular-nums text-ink-secondary">{fmt1(out.proteinG)}</td>
                              <td className="px-2 py-2 tabular-nums text-ink-secondary">{fmt1(out.fatG)}</td>
                              <td className="px-2 py-2 tabular-nums text-ink-secondary">{fmt1(out.kcal)}</td>
                            </>
                          ) : null}
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

      {showTechnical ? (
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
      ) : null}
    </div>
  )
}
