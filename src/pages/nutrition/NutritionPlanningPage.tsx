import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Lightbulb, Loader2, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { createInitialPlanningWorkbook } from '@/lib/nutrition/planningWorkbookFactory'
import {
  pctKcalMacros,
  parseLocaleNumberOrZero,
  scaledFromRefs,
  sumTotals,
  ZERO_TOTALS,
  type MacroTotals,
} from '@/lib/nutrition/planningCalculations'
import type { PlanningFoodRowState, PlanningWorkbookStateV1 } from '@/lib/nutrition/planningWorkbookTypes'
import { parsePlanningData, planningDataToJson } from '@/lib/nutrition/planningWorkbookTypes'
import type { Json, NutritionPlanningWorkbook } from '@/types/database'
import { cn } from '@/lib/utils'

function fmt1(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

function TotalsBadge({ label, ...t }: MacroTotals & { label: string }) {
  const pct = pctKcalMacros(t)
  return (
    <div className="rounded-xl border border-surface-border bg-surface-muted/40 px-4 py-3 text-sm">
      <p className="text-[10px] uppercase tracking-wide text-ink-muted font-bold">{label}</p>
      <p className="tabular-nums text-ink-secondary mt-1">
        HC {fmt1(t.carbsG)} g · Prot {fmt1(t.proteinG)} g · Grasas {fmt1(t.fatG)} g · {fmt1(t.kcal)} kcal
      </p>
      {pct && (
        <p className="text-[11px] text-ink-muted mt-1 tabular-nums">
          Distribución aprox.: P {pct.p.toFixed(0)} % · HC {pct.c.toFixed(0)} % · G {pct.f.toFixed(0)} %
        </p>
      )}
    </div>
  )
}

export function NutritionPlanningPage() {
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(true)
  const [rowPk, setRowPk] = useState<string | null>(null)
  const [wb, setWb] = useState<PlanningWorkbookStateV1>(() => createInitialPlanningWorkbook())
  const wbRef = useRef(wb)
  wbRef.current = wb
  const userHasEdited = useRef(false)
  const hydrated = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('saved')
  const [resetOpen, setResetOpen] = useState(false)

  const persist = useCallback(async () => {
    if (!user?.id || !rowPk) return
    const body = wbRef.current
    setSaveState('saving')
    const { error } = await supabase
      .from('nutrition_planning_workbooks')
      .update({
        title: 'Plan de alimentación',
        data: planningDataToJson(body),
        updated_at: new Date().toISOString(),
      })
      .eq('id', rowPk)
      .eq('owner_id', user.id)
    if (error) {
      console.error(error)
      toast.error('No se pudo guardar el plan.')
      setSaveState('dirty')
      return
    }
    setSaveState('saved')
  }, [rowPk, user?.id])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      hydrated.current = false
      userHasEdited.current = false
      const { data, error } = await supabase
        .from('nutrition_planning_workbooks')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        console.error(error)
        toast.error('No se pudo cargar tu plan (¿migraciones aplicadas?).')
        setLoading(false)
        return
      }

      const insertPayload: Omit<NutritionPlanningWorkbook, 'id' | 'created_at' | 'updated_at'> = {
        owner_id: user.id,
        title: 'Plan de alimentación',
        data: planningDataToJson(createInitialPlanningWorkbook()) as Json,
      }

      if (!data) {
        const { data: ins, error: insErr } = await supabase.from('nutrition_planning_workbooks').insert(insertPayload).select('id').single()
        if (cancelled) return
        if (insErr) {
          console.error(insErr)
          toast.error(insErr.message ?? 'No se pudo crear el plan.')
          setLoading(false)
          return
        }
        const seed = createInitialPlanningWorkbook()
        setRowPk(ins.id)
        setWb(seed)
        hydrated.current = true
        setSaveState('saved')
        setLoading(false)
        return
      }

      const row = data as NutritionPlanningWorkbook
      const parsed = parsePlanningData(row.data)
      const next = parsed ?? createInitialPlanningWorkbook()
      setRowPk(row.id)
      if (!parsed) {
        await supabase
          .from('nutrition_planning_workbooks')
          .update({
            title: row.title ?? 'Plan de alimentación',
            data: planningDataToJson(next),
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
          .eq('owner_id', user.id)
      }
      setWb(next)
      hydrated.current = true
      setSaveState('saved')
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  /** Autoguardado solo tras edición del usuario (evita PATCH al cargar). */
  useEffect(() => {
    if (!hydrated.current || !rowPk || !userHasEdited.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState('dirty')
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      persist()
    }, 720)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [wb, rowPk, persist])

  const weightKg = parseLocaleNumberOrZero(wb.person.weightKg)
  const pPerKg = parseLocaleNumberOrZero(wb.macroInputs.proteinGPerKg)
  const cPerKg = parseLocaleNumberOrZero(wb.macroInputs.carbGPerKg)
  const fPerKg = parseLocaleNumberOrZero(wb.macroInputs.fatGPerKg)
  const targetKcal = parseLocaleNumberOrZero(wb.proposedKcal)

  const guideTotals = useMemo<MacroTotals>(() => {
    if (weightKg <= 0) return ZERO_TOTALS
    return {
      carbsG: weightKg * cPerKg,
      proteinG: weightKg * pPerKg,
      fatG: weightKg * fPerKg,
      kcal: weightKg * (pPerKg * 4 + cPerKg * 4 + fPerKg * 9),
    }
  }, [weightKg, cPerKg, pPerKg, fPerKg])

  const guidePctVsTarget = useMemo(() => {
    if (weightKg <= 0 || targetKcal <= 0) return null
    return pctKcalMacros({
      carbsG: weightKg * cPerKg,
      proteinG: weightKg * pPerKg,
      fatG: weightKg * fPerKg,
      kcal: targetKcal,
    })
  }, [targetKcal, weightKg, cPerKg, pPerKg, fPerKg])

  const macrosKcalGuess = weightKg * (pPerKg * 4 + cPerKg * 4 + fPerKg * 9)

  const foodGrand = useMemo(() => {
    let acc = ZERO_TOTALS
    for (const sec of wb.sections) {
      for (const r of sec.rows) {
        const q = parseLocaleNumberOrZero(r.qtyG)
        if (q <= 0) continue
        const refVals = {
          carbs: parseLocaleNumberOrZero(r.refCarbs),
          protein: parseLocaleNumberOrZero(r.refProt),
          fat: parseLocaleNumberOrZero(r.refFat),
          kcal: parseLocaleNumberOrZero(r.refKcal),
        }
        acc = sumTotals(acc, scaledFromRefs(q, refVals))
      }
    }
    return acc
  }, [wb.sections])

  function patchPerson<K extends keyof PlanningWorkbookStateV1['person']>(k: K, v: PlanningWorkbookStateV1['person'][K]) {
    userHasEdited.current = true
    setWb((prev) => ({ ...prev, person: { ...prev.person, [k]: v } }))
  }

  function patchMacroInputs<K extends keyof PlanningWorkbookStateV1['macroInputs']>(
    k: K,
    v: PlanningWorkbookStateV1['macroInputs'][K],
  ) {
    userHasEdited.current = true
    setWb((prev) => ({ ...prev, macroInputs: { ...prev.macroInputs, [k]: v } }))
  }

  function patchRow(secKey: string, rowId: string, patch: Partial<PlanningFoodRowState>) {
    userHasEdited.current = true
    setWb((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) =>
        sec.key !== secKey
          ? sec
          : {
              ...sec,
              rows: sec.rows.map((r) => (r.id !== rowId ? r : { ...r, ...patch })),
            },
      ),
    }))
  }

  async function handleResetConfirm() {
    if (!user?.id || !rowPk) return
    const seed = createInitialPlanningWorkbook()
    setWb(seed)
    userHasEdited.current = true
    setResetOpen(false)
    const { error } = await supabase
      .from('nutrition_planning_workbooks')
      .update({ data: planningDataToJson(seed), updated_at: new Date().toISOString() })
      .eq('id', rowPk)
      .eq('owner_id', user.id)
    if (error) {
      toast.error('No se pudo restablecer.')
      return
    }
    toast.success('Plantilla restablecida.')
    setSaveState('saved')
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="pb-24 lg:pb-10">
      <Header
        title="Plan ejemplo de comidas"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1.5 shrink-0 min-w-0">
            {saveState === 'saving' && (
              <span className="text-xs text-ink-muted flex items-center gap-1 whitespace-nowrap">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> Guardando…
              </span>
            )}
            {saveState === 'saved' && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0">Guardado</span>
            )}
            {saveState === 'dirty' && (
              <span className="text-[11px] text-ink-muted whitespace-nowrap shrink-0">Guardando cambios…</span>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<RotateCcw className="h-4 w-4" aria-hidden />}
              className={cn(
                'h-9 shrink-0 rounded-xl px-3 font-medium shadow-sm border-surface-border',
                'bg-surface-elevated text-ink-primary hover:bg-surface-border/35 hover:border-brand-primary/35',
              )}
              onClick={() => setResetOpen(true)}
            >
              Restaurar plantilla
            </Button>
          </div>
        }
      />
      <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 lg:px-6 pt-2">
        <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-secondary">
          Es una <strong>planilla de ejemplo</strong> tipo Excel HH: podés cargar persona y números <strong>solo si te sirven</strong>{' '}
          para explicar, y usar las tablas de abajo para armar «un día modelo» por gramos de alimento.
        </p>
        <p className="text-sm leading-relaxed text-ink-muted">
          Los valores guardados los ves solo vos acá en la cuenta; pueden ser orientativos y conviene ajustarlos con el equipo y cada alumno.
        </p>

        <div className="rounded-2xl border border-brand-primary/30 bg-brand-primary/[0.07] px-4 py-3.5 dark:bg-brand-primary/[0.12] space-y-2 w-full">
          <p className="font-semibold text-ink-primary flex items-center gap-2 text-[15px]">
            <Lightbulb className="w-4 h-4 shrink-0 text-brand-primary" aria-hidden />
            Cómo usarlo paso a paso
          </p>
          <ol className="list-decimal pl-5 space-y-1.5 text-sm text-ink-secondary leading-relaxed">
            <li>
              Esta tarjeta de <strong>persona</strong> abajo sirve solo si querés jugar con peso / kcal; si solo armás ejemplo con las tablas, podés ignorarla.
            </li>
            <li>
              En las tablas cargás los <strong>gramos por alimento</strong>; la app cuenta carbos, prot, grasa y kcal usando la columna &quot;por 100 g&quot;.
            </li>
            <li>
              Los totales muestran <strong>solo las filas con cantidad</strong>; así podés dejar líneas sin usar sin ensuciar el total.
            </li>
            <li>
              <strong>Guardado automático</strong>—no hace falta botón guardar.&nbsp;
              «Restaurar plantilla» vuelve todo al formato inicial HH (borra tus gramos editados).
            </li>
          </ol>
          <p className="text-[11px] text-ink-muted pt-2 border-t border-surface-border/70">
            Orientación práctica HH: si tu alumno trabaja con un nutricionista, estos números no reemplazan ese plan — sirven como apoyo pedagógico.
          </p>
        </div>
        </div>

        <details className="rounded-2xl border border-surface-border bg-surface-card p-5 group w-full">
          <summary className="cursor-pointer flex items-start gap-2 text-base font-semibold text-ink-primary list-none [&::-webkit-details-marker]:hidden">
            <ChevronDown className="w-5 h-5 shrink-0 text-ink-muted mt-0.5 transition-transform [.group:not([open])_&]:-rotate-90" aria-hidden />
            Rangos típicos de macros (referencia técnica — tocá para abrir)
          </summary>
          <div className="mt-4 pl-7 space-y-3 border-l-2 border-surface-border ml-2.5 pb-1">
            <ul className="text-sm text-ink-secondary space-y-2 list-disc pl-5">
              <li>Proteínas: {wb.macroGuide.proteinPerKgHint}</li>
              <li>Carbohidratos: {wb.macroGuide.carbPerKgHint}</li>
              <li>Grasas: {wb.macroGuide.fatPerKgHint}</li>
            </ul>
            <p className="text-sm text-ink-muted">{wb.macroGuide.contextNote}</p>
          </div>
        </details>

        <section className="rounded-2xl border border-surface-border bg-surface-card p-5 space-y-4 w-full">
          <div>
            <h2 className="text-lg font-semibold text-ink-primary">Tu ejemplo · persona</h2>
            <p className="text-sm text-ink-muted mt-1 leading-relaxed">
              Acá cargás datos <strong>solo si</strong> querés sumar gasto calórico y macros por peso.&nbsp;
              Para muchos entrenadores alcanza con completar gramajes en las tablas de más abajo.
            </p>
          </div>
          <div className="rounded-lg bg-surface-muted/35 border border-surface-border/80 px-3 py-2 text-xs text-ink-secondary leading-relaxed">
            <strong className="text-ink-primary">TDEE:</strong> calorías aproximadas de mantención (<em>esto no es historia clínica</em>; valores orientativos del Excel HH).
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm space-y-1">
              <span className="text-ink-muted text-xs font-semibold uppercase tracking-wide">Mantención típ · hombre (kcal)</span>
              <Input value={wb.person.tdeeMale} onChange={(e) => patchPerson('tdeeMale', e.target.value)} />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-ink-muted text-xs font-semibold uppercase tracking-wide">Mantención típ · mujer (kcal)</span>
              <Input value={wb.person.tdeeFemale} onChange={(e) => patchPerson('tdeeFemale', e.target.value)} />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-ink-muted text-xs font-semibold uppercase tracking-wide">Peso ejemplo (kg)</span>
              <Input value={wb.person.weightKg} onChange={(e) => patchPerson('weightKg', e.target.value)} inputMode="decimal" />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-ink-muted text-xs font-semibold uppercase tracking-wide">Sexo · referencia TDEE</span>
              <select
                className="flex h-10 w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 text-sm text-ink-primary focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                value={wb.person.sex}
                onChange={(e) => patchPerson('sex', e.target.value as PlanningWorkbookStateV1['person']['sex'])}
              >
                <option value="">—</option>
                <option value="M">Hombre</option>
                <option value="F">Mujer</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm space-y-1">
              <span className="text-ink-muted text-xs font-semibold uppercase tracking-wide">Objetivo (texto libre)</span>
              <textarea
                className="flex min-h-[72px] w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                value={wb.objectives}
                onChange={(e) => {
                  userHasEdited.current = true
                  setWb((p) => ({ ...p, objectives: e.target.value }))
                }}
                placeholder="Ej. mantener masa en déficit ligero · más energía los días de pierna..."
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-ink-muted text-xs font-semibold uppercase tracking-wide">Calorías diarias ejemplo (meta)</span>
              <Input
                value={wb.proposedKcal}
                onChange={(e) => {
                  userHasEdited.current = true
                  setWb((p) => ({ ...p, proposedKcal: e.target.value }))
                }}
                inputMode="decimal"
              />
              <span className="text-[11px] text-ink-muted leading-snug inline-block mt-1">
                Si cargaste peso y los g/kg de abajo, acá ves si esos macros se parecen más o menos al total de calorías que querés usar de ejemplo.
              </span>
            </label>
          </div>

          <div className="rounded-xl bg-surface-muted/50 border border-dashed border-surface-border p-4">
            <h3 className="text-sm font-semibold text-ink-primary mb-1">Macros por kg de peso (ejemplo pedagógico)</h3>
            <p className="text-xs text-ink-muted mb-3 leading-relaxed">
              Pensá estos números como &quot;hábito de clase&quot;: combinados con el peso de arriba te da gramos objetivo orientativos. Si no cargaste peso, esta zona no cuenta para mucho — no pasa nada.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm space-y-1">
                <span className="text-ink-muted text-xs">Proteína</span>
                <Input
                  value={wb.macroInputs.proteinGPerKg}
                  onChange={(e) => patchMacroInputs('proteinGPerKg', e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-ink-muted text-xs">Carbohidratos</span>
                <Input value={wb.macroInputs.carbGPerKg} onChange={(e) => patchMacroInputs('carbGPerKg', e.target.value)} inputMode="decimal" />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-ink-muted text-xs">Grasas</span>
                <Input value={wb.macroInputs.fatGPerKg} onChange={(e) => patchMacroInputs('fatGPerKg', e.target.value)} inputMode="decimal" />
              </label>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <TotalsBadge label="Gramos ejemplo (peso × g/kg cargados)" {...guideTotals} />
              <div className="rounded-xl border border-surface-border bg-surface-muted/40 px-4 py-3 text-sm">
                <p className="text-[10px] uppercase tracking-wide text-ink-muted font-bold">¿Encaja con las kcal ejemplo?</p>
                {weightKg <= 0 || targetKcal <= 0 ? (
                  <p className="text-ink-muted mt-2 text-sm">Pone peso + calorías diarias ejemplo arriba para ver una chequeo rápido.</p>
                ) : guidePctVsTarget ? (
                  <p className="tabular-nums text-ink-secondary mt-2">
                    HC {guidePctVsTarget.c.toFixed(0)} % · Prot {guidePctVsTarget.p.toFixed(0)} % · Grasas{' '}
                    {guidePctVsTarget.f.toFixed(0)} % (macros ≈ {macrosKcalGuess.toFixed(0)} kcal vs objetivo {targetKcal.toFixed(0)} kcal)
                  </p>
                ) : (
                  <p className="text-ink-muted mt-2 text-sm">Podés subir/bajar los g/kg de arriba hasta que coincida mejor con tus kcal ejemplo — es orientativo.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <details className="rounded-2xl border border-surface-border bg-surface-card p-5 group w-full">
          <summary className="cursor-pointer flex items-start gap-2 text-base font-semibold text-ink-primary list-none [&::-webkit-details-marker]:hidden outline-none select-none">
            <ChevronDown className="w-5 h-5 shrink-0 text-ink-muted mt-0.5 transition-transform [.group:not([open])_&]:-rotate-90" aria-hidden />
            Textos largos por objetivo (como el Excel — tocá para abrir si los necesitás)
          </summary>
          <div className="mt-4 ml-7 pl-2 border-l-2 border-surface-border grid gap-4 md:grid-cols-2 text-sm text-ink-secondary">
            <div className="space-y-2">
              <p className="font-medium text-ink-primary">{wb.objectivesGuide.superavitCal}</p>
              <p>{wb.objectivesGuide.deficitCal}</p>
              <p>{wb.objectivesGuide.recomposicion}</p>
              <p>{wb.objectivesGuide.longevidad}</p>
            </div>
            <div className="space-y-2">
              <p>{wb.objectivesGuide.proteinasPorObjetivo}</p>
              <p>{wb.objectivesGuide.grasasPorObjetivo}</p>
              <p>{wb.objectivesGuide.carbosPorObjetivo}</p>
              <p>{wb.objectivesGuide.pctDistribicion}</p>
            </div>
          </div>
        </details>

        <div className="rounded-xl border border-surface-border bg-surface-card px-4 py-3 text-sm space-y-2 w-full">
          <p className="font-medium text-ink-primary">Total del día modelo (solo lo que cargaste en gramos)</p>
          <TotalsBadge label="Suma tablas inferiores · sin gramos cuenta 0" {...foodGrand} />
        </div>

        <p className="text-sm text-ink-muted leading-relaxed">
          Tablas por tipo de comida como en HH: cargá <strong>cantidad en gramos</strong> donde querés.&nbsp;
          HC / prot / grasa / kcal por 100 g son editables si tu marca cambia.&nbsp;
          Tip: no hace falta rellenar todo — solo los alimentos del ejemplo que quieras mostrar.
        </p>

        <div className="space-y-8 pb-12">
          {wb.sections.map((sec) => {
            let secTotals = ZERO_TOTALS
            for (const r of sec.rows) {
              const q = parseLocaleNumberOrZero(r.qtyG)
              if (q <= 0) continue
              const refVals = {
                carbs: parseLocaleNumberOrZero(r.refCarbs),
                protein: parseLocaleNumberOrZero(r.refProt),
                fat: parseLocaleNumberOrZero(r.refFat),
                kcal: parseLocaleNumberOrZero(r.refKcal),
              }
              secTotals = sumTotals(secTotals, scaledFromRefs(q, refVals))
            }
            return (
              <section key={sec.key} className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden w-full">
                <div className="border-b border-surface-border bg-surface-muted/40 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wide">{sec.title}</h3>
                    <p className="text-[11px] text-ink-muted mt-0.5">{sec.quantityColumnHint}</p>
                  </div>
                  <p className="text-[11px] text-ink-secondary tabular-nums shrink-0">
                    Subtotal: HC {fmt1(secTotals.carbsG)} · P {fmt1(secTotals.proteinG)} · G {fmt1(secTotals.fatG)} · {fmt1(secTotals.kcal)} kcal
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
                          <tr key={r.id} className="border-b border-surface-border/80 hover:bg-surface-muted/20">
                            <td className="px-3 py-2 sticky left-0 bg-surface-card align-top border-r border-surface-border/50">
                              <p className="text-ink-primary font-medium">{r.name}</p>
                              {r.hint ? <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 leading-snug">{r.hint}</p> : null}
                            </td>
                            <td className="px-2 py-1 align-top">
                              <Input
                                className="h-9 text-xs"
                                inputMode="decimal"
                                value={r.qtyG}
                                onChange={(e) => patchRow(sec.key, r.id, { qtyG: e.target.value })}
                              />
                            </td>
                            <td className="px-2 py-1 align-top">
                              <Input
                                className="h-9 text-xs"
                                inputMode="decimal"
                                value={r.refCarbs}
                                onChange={(e) => patchRow(sec.key, r.id, { refCarbs: e.target.value })}
                              />
                            </td>
                            <td className="px-2 py-1 align-top">
                              <Input
                                className="h-9 text-xs"
                                inputMode="decimal"
                                value={r.refProt}
                                onChange={(e) => patchRow(sec.key, r.id, { refProt: e.target.value })}
                              />
                            </td>
                            <td className="px-2 py-1 align-top">
                              <Input
                                className="h-9 text-xs"
                                inputMode="decimal"
                                value={r.refFat}
                                onChange={(e) => patchRow(sec.key, r.id, { refFat: e.target.value })}
                              />
                            </td>
                            <td className="px-2 py-1 align-top">
                              <Input
                                className="h-9 text-xs"
                                inputMode="decimal"
                                value={r.refKcal}
                                onChange={(e) => patchRow(sec.key, r.id, { refKcal: e.target.value })}
                              />
                            </td>
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
      </div>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleResetConfirm}
        title="¿Volver a la plantilla base?"
        description="Se borran los gramos y los cambios en las tablas; volvés al listado inicial HH. Tus notas macro arriba también se resetean. Es útil si querés arrancar de cero un ejemplo nuevo."
        confirmLabel="Restaurar"
        variant="warning"
      />
    </div>
  )
}
