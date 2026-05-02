import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Apple,
  BookOpen,
  ChevronDown,
  FileDown,
  Lightbulb,
  Loader2,
  RotateCcw,
  Search,
  UserPlus,
  X,
} from 'lucide-react'
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
import { downloadPlanningWorkbookPdf } from '@/lib/nutrition/downloadPlanningWorkbookPdf'
import type { Json, NutritionFoodLibrary, NutritionPlanningWorkbook, Student } from '@/types/database'
import { cn } from '@/lib/utils'

function fmt1(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

/** Valores por 100 g guardados en Guía → columnas HC/P/G/kcal del plan */
function formatLibNutrientForPlanning(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '0'
  return String(n)
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
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
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
  const [libraryFoods, setLibraryFoods] = useState<NutritionFoodLibrary[]>([])
  const [libraryPicker, setLibraryPicker] = useState<{ secKey: string; rowId: string } | null>(null)
  const [libraryQuery, setLibraryQuery] = useState('')
  const [libraryRefreshing, setLibraryRefreshing] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignStudentId, setAssignStudentId] = useState('')
  const [assignTitle, setAssignTitle] = useState('Plan de alimentación')
  const [assignStudents, setAssignStudents] = useState<Pick<Student, 'id' | 'full_name'>[]>([])
  /** Lista para rellenar «persona» desde ficha (misma fuente que asignar plan). */
  const [referenceStudents, setReferenceStudents] = useState<Pick<Student, 'id' | 'full_name'>[]>([])
  const [referenceStudentsLoading, setReferenceStudentsLoading] = useState(true)
  /** Primera carga de Mi lista terminada (vacío ≠ cargando). */
  const [libraryHydrated, setLibraryHydrated] = useState(false)
  /** Desde la tarjeta: elegir en qué fila del plan aplicar el alimento. */
  const [tableTargetLib, setTableTargetLib] = useState<NutritionFoodLibrary | null>(null)
  const [tableTargetSecKey, setTableTargetSecKey] = useState('')
  const [tableTargetRowId, setTableTargetRowId] = useState('')

  const loadLibraryFoods = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false
    try {
      const { data, error } = await supabase
        .from('nutrition_food_library')
        .select(
          'id, owner_id, display_name, external_source, external_fdc_id, protein_g_per_100g, fat_g_per_100g, carbs_g_per_100g, fiber_g_per_100g, energy_kcal_per_100g, portion_basis, source_label, notes, created_at, updated_at',
        )
        .eq('owner_id', user.id)
        .order('display_name')
      if (error) {
        toast.error(error.message || 'No se pudo cargar Mi lista.')
        return false
      }
      setLibraryFoods((data ?? []) as NutritionFoodLibrary[])
      return true
    } finally {
      setLibraryHydrated(true)
    }
  }, [user?.id])

  /** Al entrar a esta pantalla o volver desde la Guía, lista fresca (antes solo dependía de user). */
  useEffect(() => {
    if (!user?.id || location.pathname !== '/nutrition/planning') return
    void loadLibraryFoods()
  }, [user?.id, location.pathname, location.key, loadLibraryFoods])

  /** Si guardaste un alimento en otra pestaña y volvés acá. */
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== 'visible' || !user?.id) return
      void loadLibraryFoods()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [user?.id, loadLibraryFoods])

  const canAssignToStudent = profile?.role === 'trainer' || profile?.role === 'admin'
  const referenceEntityLabel = profile?.role === 'nutritionist' ? 'paciente' : 'alumno'

  useEffect(() => {
    if (!user?.id) {
      setReferenceStudents([])
      setReferenceStudentsLoading(false)
      return
    }
    let cancelled = false
    setReferenceStudentsLoading(true)
    ;(async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name')
        .eq('owner_id', user.id)
        .order('full_name')
      if (cancelled) return
      if (error) {
        console.error(error)
        setReferenceStudents([])
      } else {
        setReferenceStudents((data ?? []) as Pick<Student, 'id' | 'full_name'>[])
      }
      setReferenceStudentsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  /** Si el plan guardaba un id que ya no existe en la lista, limpiar vínculo. */
  useEffect(() => {
    if (!hydrated.current || referenceStudentsLoading) return
    const id = wb.personReferenceStudentId
    if (!id) return
    if (!referenceStudents.some((s) => s.id === id)) {
      userHasEdited.current = true
      setWb((p) => ({ ...p, personReferenceStudentId: null }))
    }
  }, [referenceStudents, referenceStudentsLoading, wb.personReferenceStudentId])

  useEffect(() => {
    if (!assignOpen || !user?.id) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('students')
        .select('id, full_name')
        .eq('owner_id', user.id)
        .order('full_name')
      if (cancelled) return
      const list = (data ?? []) as Pick<Student, 'id' | 'full_name'>[]
      setAssignStudents(list)
      setAssignStudentId((prev) => {
        if (prev && list.some((s) => s.id === prev)) return prev
        return list[0]?.id ?? ''
      })
    })()
    return () => {
      cancelled = true
    }
  }, [assignOpen, user?.id])

  useEffect(() => {
    if (!libraryPicker && !tableTargetLib && !assignOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setLibraryPicker(null)
      setLibraryQuery('')
      setTableTargetLib(null)
      setAssignOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [libraryPicker, tableTargetLib, assignOpen])

  const libraryFiltered = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase()
    if (!q) return libraryFoods
    return libraryFoods.filter((f) => f.display_name.toLowerCase().includes(q))
  }, [libraryFoods, libraryQuery])

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

  const applyReferenceStudent = useCallback(
    async (studentId: string | null) => {
      if (!user?.id) return
      userHasEdited.current = true
      if (!studentId) {
        setWb((p) => ({ ...p, personReferenceStudentId: null }))
        return
      }

      const { data: st, error: stErr } = await supabase
        .from('students')
        .select('weight_kg, gender, intake_ferster')
        .eq('id', studentId)
        .eq('owner_id', user.id)
        .maybeSingle()

      if (stErr || !st) {
        toast.error(stErr?.message ?? 'No se encontró la ficha.')
        return
      }

      const { data: meas } = await supabase
        .from('nutrition_measurements')
        .select('weight_kg')
        .eq('owner_id', user.id)
        .eq('student_id', studentId)
        .order('measured_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let weightNum = st.weight_kg
      if (meas?.weight_kg != null && Number.isFinite(meas.weight_kg)) {
        weightNum = meas.weight_kg
      }

      const sex: PlanningWorkbookStateV1['person']['sex'] =
        st.gender === 'M' ? 'M' : st.gender === 'F' ? 'F' : ''

      setWb((prev) => {
        const fromIntake = st.intake_ferster?.main_goal?.trim()
        const nextObjectives =
          !prev.objectives.trim() && fromIntake ? fromIntake : prev.objectives

        return {
          ...prev,
          personReferenceStudentId: studentId,
          person: {
            ...prev.person,
            weightKg:
              weightNum != null && Number.isFinite(weightNum)
                ? String(weightNum)
                : prev.person.weightKg,
            sex: sex || prev.person.sex,
          },
          objectives: nextObjectives,
        }
      })

      toast.success('Datos de referencia cargados desde la ficha (podés editarlos).')
    },
    [user?.id],
  )

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

  function applyFoodToPlanRow(lib: NutritionFoodLibrary, secKey: string, rowId: string) {
    patchRow(secKey, rowId, {
      name: lib.display_name,
      refCarbs: formatLibNutrientForPlanning(lib.carbs_g_per_100g),
      refProt: formatLibNutrientForPlanning(lib.protein_g_per_100g),
      refFat: formatLibNutrientForPlanning(lib.fat_g_per_100g),
      refKcal: formatLibNutrientForPlanning(lib.energy_kcal_per_100g),
      hint: undefined,
    })
    const sec = wb.sections.find((s) => s.key === secKey)
    toast.success(`${lib.display_name} · ${sec?.title ?? 'tabla'}`)
  }

  function applyFoodFromLibrary(lib: NutritionFoodLibrary) {
    if (!libraryPicker) return
    applyFoodToPlanRow(lib, libraryPicker.secKey, libraryPicker.rowId)
    setLibraryPicker(null)
    setLibraryQuery('')
  }

  function openTableTargetModal(lib: NutritionFoodLibrary) {
    const first = wb.sections[0]
    setTableTargetLib(lib)
    setTableTargetSecKey(first?.key ?? '')
    setTableTargetRowId(first?.rows[0]?.id ?? '')
  }

  function confirmTableTargetApply() {
    if (!tableTargetLib || !tableTargetSecKey || !tableTargetRowId) return
    applyFoodToPlanRow(tableTargetLib, tableTargetSecKey, tableTargetRowId)
    setTableTargetLib(null)
  }

  const rowsForTableTarget = useMemo(() => {
    return wb.sections.find((s) => s.key === tableTargetSecKey)?.rows ?? []
  }, [wb.sections, tableTargetSecKey])

  const selectPlanClasses =
    'flex h-10 w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 text-sm text-ink-primary focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20'

  async function handleAssignToStudent() {
    if (!assignStudentId || !user?.id) {
      toast.error('Elegí un alumno.')
      return
    }
    setAssignSaving(true)
    const { error } = await supabase.from('trainer_student_meal_plans').insert({
      owner_id: user.id,
      student_id: assignStudentId,
      title: assignTitle.trim() || 'Plan de alimentación',
      data: planningDataToJson(wbRef.current) as Json,
    })
    setAssignSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Plan asignado. El alumno lo ve en «Mi plan de alimentación» si tiene la cuenta vinculada.')
    setAssignOpen(false)
  }

  async function handleExportPdf() {
    try {
      await downloadPlanningWorkbookPdf(wbRef.current, {
        professionalName: profile?.full_name,
        fileBaseName: 'plan-alimentacion',
      })
      toast.success('PDF descargado.')
    } catch (e) {
      console.error(e)
      toast.error('No se pudo generar el PDF.')
    }
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
        title="Plan de alimentación"
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
              variant="outline"
              size="sm"
              icon={<FileDown className="h-4 w-4" aria-hidden />}
              className="h-9 shrink-0 rounded-xl"
              onClick={() => void handleExportPdf()}
            >
              PDF
            </Button>
            {canAssignToStudent ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<UserPlus className="h-4 w-4" aria-hidden />}
                className="h-9 shrink-0 rounded-xl"
                onClick={() => {
                  setAssignTitle('Plan de alimentación')
                  setAssignOpen(true)
                }}
              >
                Asignar a alumno
              </Button>
            ) : null}
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

          <label className="text-sm space-y-1 block">
            <span className="text-ink-muted text-xs font-semibold uppercase tracking-wide">
              Referencia desde tu lista ({referenceEntityLabel})
            </span>
            <select
              className={selectPlanClasses}
              disabled={referenceStudentsLoading}
              value={wb.personReferenceStudentId ?? ''}
              onChange={(e) => {
                const v = e.target.value
                void applyReferenceStudent(v || null)
              }}
            >
              <option value="">Ninguno — plantilla genérica</option>
              {referenceStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-ink-muted leading-snug inline-block mt-1">
              Al elegir un {referenceEntityLabel}, se completan peso (prioriza la última medición nutricional si existe) y sexo para la referencia TDEE.&nbsp;
              Si el objetivo en texto está vacío y hay objetivo en el formulario Ferster, se copia ahí.&nbsp;
              TDEE y kcal diarias ejemplo siguen siendo manuales: en la ficha no hay un único número guardado para eso.
            </span>
          </label>

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
          Tip: tocá «Mi lista» (<BookOpen className="inline-block h-3.5 w-3.5 align-text-bottom mx-px text-brand-primary" aria-hidden />) junto al alimento para traer algo que hayas guardado en{' '}
          <Link to="/nutrition/foods" className="text-brand-primary hover:underline font-medium">
            Guía de alimentos
          </Link>{' '}
          cuando la plantilla no alcanza.
        </p>

        <section className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden w-full">
          <div className="border-b border-surface-border bg-surface-muted/40 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink-primary uppercase tracking-wide flex items-center gap-2">
                <Apple className="w-4 h-4 text-brand-primary shrink-0" aria-hidden />
                Alimentos personalizados
              </h2>
              <p className="text-[11px] text-ink-muted mt-1 leading-relaxed max-w-[640px]">
                Desde <strong>Mi lista</strong> en la{' '}
                <Link to="/nutrition/foods" className="text-brand-primary hover:underline font-medium">
                  Guía de alimentos
                </Link>
                . Misma grilla que abajo: referencias por 100 g; tocá <strong>Usar</strong> para copiar a una fila del plan o <strong>Lista</strong> en las tablas.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              loading={libraryRefreshing}
              onClick={() => void loadLibraryFoods()}
            >
              Actualizar lista
            </Button>
          </div>

          {!libraryHydrated ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : libraryFoods.length === 0 ? (
            <div className="px-4 py-6 text-sm text-ink-secondary space-y-2 border-t border-surface-border/80 bg-surface-muted/20">
              <p>Aún no aparece ningún alimento de tu lista.</p>
              <p className="text-xs text-ink-muted leading-relaxed">
                Guardá en la Guía y tocá <strong>Actualizar lista</strong>. Si ya guardaste y sigue vacío, revisá la cuenta o errores al guardar.
              </p>
              <Link to="/nutrition/foods" className="inline-flex text-brand-primary font-medium hover:underline">
                Ir a Guía de alimentos
              </Link>
            </div>
          ) : (
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
                  {libraryFoods.map((lib) => (
                    <tr key={lib.id} className="border-b border-surface-border/80 hover:bg-surface-muted/20">
                      <td className="px-3 py-2 sticky left-0 bg-surface-card align-top border-r border-surface-border/50 max-w-[280px]">
                        <div className="flex items-start gap-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-ink-primary font-medium break-words">{lib.display_name}</p>
                          </div>
                          <button
                            type="button"
                            title="Copiar a una fila del plan"
                            onClick={() => openTableTargetModal(lib)}
                            className={cn(
                              'flex shrink-0 flex-col items-center gap-0.5 rounded-lg border border-surface-border bg-surface-muted/50 px-1.5 py-1 sm:flex-row sm:gap-1',
                              'text-[10px] font-semibold uppercase tracking-wide text-ink-muted hover:text-brand-primary',
                              'hover:border-brand-primary/40 hover:bg-surface-elevated transition-colors',
                            )}
                          >
                            <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                            <span>Usar</span>
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2 align-middle text-ink-muted tabular-nums text-center">—</td>
                      <td className="px-2 py-2 tabular-nums text-ink-secondary align-middle">{fmt1(lib.carbs_g_per_100g ?? NaN)}</td>
                      <td className="px-2 py-2 tabular-nums text-ink-secondary align-middle">{fmt1(lib.protein_g_per_100g ?? NaN)}</td>
                      <td className="px-2 py-2 tabular-nums text-ink-secondary align-middle">{fmt1(lib.fat_g_per_100g ?? NaN)}</td>
                      <td className="px-2 py-2 tabular-nums text-ink-secondary align-middle">{fmt1(lib.energy_kcal_per_100g ?? NaN)}</td>
                      <td className="px-2 py-2 tabular-nums text-ink-muted align-middle text-center">—</td>
                      <td className="px-2 py-2 tabular-nums text-ink-muted align-middle text-center">—</td>
                      <td className="px-2 py-2 tabular-nums text-ink-muted align-middle text-center">—</td>
                      <td className="px-2 py-2 tabular-nums text-ink-muted align-middle text-center">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

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
                            <td className="px-3 py-2 sticky left-0 bg-surface-card align-top border-r border-surface-border/50 max-w-[280px]">
                              <div className="flex items-start gap-2 min-w-0">
                                <div className="min-w-0 flex-1">
                                  <p className="text-ink-primary font-medium break-words">{r.name}</p>
                                  {r.hint ? (
                                    <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 leading-snug">{r.hint}</p>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  title="Mi lista · traer desde Guía de alimentos"
                                  aria-label={`Abrir Mi lista para la fila ${r.name}`}
                                  onClick={async () => {
                                    setLibraryQuery('')
                                    setLibraryPicker({ secKey: sec.key, rowId: r.id })
                                    setLibraryRefreshing(true)
                                    await loadLibraryFoods()
                                    setLibraryRefreshing(false)
                                  }}
                                  className={cn(
                                    'flex shrink-0 flex-col items-center gap-0.5 rounded-lg border border-surface-border bg-surface-muted/50 px-1.5 py-1 sm:flex-row sm:gap-1',
                                    'text-[10px] font-semibold uppercase tracking-wide text-ink-muted hover:text-brand-primary',
                                    'hover:border-brand-primary/40 hover:bg-surface-elevated transition-colors',
                                  )}
                                >
                                  <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                                  <span>Lista</span>
                                </button>
                              </div>
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

      {tableTargetLib ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            role="presentation"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setTableTargetLib(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-surface-border bg-surface-card p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-ink-primary pr-8">
              ¿En qué fila va «{tableTargetLib.display_name}»?
            </h3>
            <p className="text-xs text-ink-muted mt-1 mb-4 leading-relaxed">
              Se cargan nombre y macros por 100 g en esa fila de la tabla (podés cambiar los gramos después).
            </p>
            <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1.5">Momento</label>
            <select
              className={cn(selectPlanClasses, 'mb-4')}
              value={tableTargetSecKey}
              onChange={(e) => {
                const k = e.target.value
                setTableTargetSecKey(k)
                const sec = wb.sections.find((s) => s.key === k)
                setTableTargetRowId(sec?.rows[0]?.id ?? '')
              }}
            >
              {wb.sections.map((sec) => (
                <option key={sec.key} value={sec.key}>
                  {sec.title}
                </option>
              ))}
            </select>
            <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1.5">Fila de la plantilla</label>
            <select className={cn(selectPlanClasses, 'mb-5')} value={tableTargetRowId} onChange={(e) => setTableTargetRowId(e.target.value)}>
              {rowsForTableTarget.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="secondary" type="button" onClick={() => setTableTargetLib(null)}>
                Cancelar
              </Button>
              <Button type="button" onClick={confirmTableTargetApply}>
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {libraryPicker ? (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
          <div
            role="presentation"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setLibraryPicker(null)
              setLibraryQuery('')
            }}
          />
          <div
            role="dialog"
            aria-labelledby="library-picker-title"
            className="relative flex max-h-[min(85vh,640px)] w-full sm:max-w-lg flex-col rounded-t-2xl sm:rounded-2xl border border-surface-border bg-surface-card shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-surface-border p-4">
              <div>
                <h2 id="library-picker-title" className="text-base font-semibold text-ink-primary">
                  Mi lista · Guía de alimentos
                </h2>
                <p className="text-xs text-ink-muted mt-1 leading-snug">
                  Elegí un alimento guardado: se cargan nombre y valores por 100 g en esta fila.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-ink-muted hover:bg-surface-muted hover:text-ink-primary shrink-0"
                onClick={() => {
                  setLibraryPicker(null)
                  setLibraryQuery('')
                }}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="shrink-0 p-4 pt-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
                <Input
                  className="pl-10 h-10"
                  placeholder="Buscar por nombre..."
                  value={libraryQuery}
                  onChange={(e) => setLibraryQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {libraryRefreshing ? (
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              ) : libraryFoods.length === 0 ? (
                <p className="text-sm text-ink-muted leading-relaxed">
                  Todavía no tenés alimentos en Mi lista.&nbsp;
                  <Link to="/nutrition/foods" className="text-brand-primary font-medium hover:underline">
                    Abrí la Guía
                  </Link>{' '}
                  y guardá desde el catálogo o USDA.
                </p>
              ) : libraryFiltered.length === 0 ? (
                <p className="text-sm text-ink-muted">No coincide ningún nombre con «{libraryQuery}».</p>
              ) : (
                <ul className="space-y-2">
                  {libraryFiltered.map((lib) => (
                    <li key={lib.id}>
                      <button
                        type="button"
                        onClick={() => applyFoodFromLibrary(lib)}
                        className={cn(
                          'w-full rounded-xl border border-surface-border bg-surface-muted/30 px-3 py-2.5 text-left',
                          'hover:border-brand-primary/40 hover:bg-surface-muted/50 transition-colors',
                        )}
                      >
                        <span className="font-medium text-ink-primary block text-sm">{lib.display_name}</span>
                        <span className="text-[11px] text-ink-muted tabular-nums mt-1 inline-block">
                          HC {formatLibNutrientForPlanning(lib.carbs_g_per_100g)} · P {formatLibNutrientForPlanning(lib.protein_g_per_100g)} · G{' '}
                          {formatLibNutrientForPlanning(lib.fat_g_per_100g)} · {formatLibNutrientForPlanning(lib.energy_kcal_per_100g)} kcal /100 g
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {assignOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            role="presentation"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !assignSaving && setAssignOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-surface-border bg-surface-card p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-ink-primary">Asignar plan a un alumno</h3>
            <p className="text-xs text-ink-muted mt-1 mb-4 leading-relaxed">
              Se guarda una copia del contenido actual del plan. El alumno la ve en su cuenta si su usuario está vinculado en la ficha.
            </p>
            <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1.5">Alumno</label>
            <select
              className={cn(selectPlanClasses, 'mb-4')}
              value={assignStudentId}
              onChange={(e) => setAssignStudentId(e.target.value)}
            >
              {assignStudents.length === 0 ? (
                <option value="">No hay alumnos cargados</option>
              ) : (
                assignStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))
              )}
            </select>
            <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1.5">Título del plan</label>
            <Input className="mb-5" value={assignTitle} onChange={(e) => setAssignTitle(e.target.value)} placeholder="Ej. Plan marzo · déficit" />
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="secondary" type="button" disabled={assignSaving} onClick={() => setAssignOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" loading={assignSaving} disabled={!assignStudentId} onClick={() => void handleAssignToStudent()}>
                Asignar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

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
