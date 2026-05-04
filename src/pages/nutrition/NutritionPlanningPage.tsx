import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Apple,
  BookmarkPlus,
  BookOpen,
  Check,
  ChevronDown,
  FileDown,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
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
  diffTotals,
  pctKcalMacros,
  parseLocaleNumber,
  parseLocaleNumberOrZero,
  plannedNutritionTotalsFromWorkbook,
  scaledFromRefs,
  sumTotals,
  ZERO_TOTALS,
  type MacroTotals,
} from '@/lib/nutrition/planningCalculations'
import type {
  MealDistributionState,
  MealPreparationChoice,
  MealSlotKey,
  MealSlotPick,
  PlanningFoodRowState,
  PlanningWorkbookStateV1,
} from '@/lib/nutrition/planningWorkbookTypes'
import {
  MEAL_SLOT_LABELS,
  newMealPickId,
  normalizeMealDistribution,
} from '@/lib/nutrition/planningWorkbookTypes'
import { parsePlanningData, planningDataToJson } from '@/lib/nutrition/planningWorkbookTypes'
import { buildStudentQuantitySummaryLines } from '@/lib/nutrition/mealPickPresentation'
import { downloadPlanningWorkbookPdf } from '@/lib/nutrition/downloadPlanningWorkbookPdf'
import type { Json, NutritionFoodLibrary, NutritionPlanningWorkbook, Student } from '@/types/database'
import { cn, formatDate } from '@/lib/utils'
import {
  orphanLibraryDraftLibIds,
  visibleMealSlotKeys,
} from '@/lib/nutrition/mealDistributionHelpers'
import {
  listMealDistributionTemplates,
  removeMealDistributionTemplate,
  saveMealDistributionTemplate,
  type MealDistributionTemplate,
} from '@/lib/nutrition/mealDistributionTemplates'
import {
  ACTIVITY_FACTOR_GUIDE_ROWS,
  mifflinStJeorBmrFemale,
  mifflinStJeorBmrMale,
  tdeeFromBmr,
} from '@/lib/nutrition/tdeeCalculator'

function fmt1(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

function approxAgeFromBirthDate(birthIso: string | null | undefined): number | null {
  if (!birthIso || typeof birthIso !== 'string') return null
  const d = new Date(birthIso.length === 10 ? `${birthIso}T12:00:00` : birthIso)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1
  if (age < 0 || age > 124) return null
  return age
}

/** Valores por 100 g guardados en Guía → columnas HC/P/G/kcal del plan */
function formatLibNutrientForPlanning(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '0'
  return String(n)
}

/** Celda compacta P / HC / G en la misma vista que kcal (alta visibilidad en claro y oscuro). */
function LiveMacroCell({
  abbr,
  intakeG,
  goalG,
}: {
  abbr: string
  intakeG: number
  goalG: number
}) {
  const hasGoal = goalG > 0
  const remainderG = goalG - intakeG
  const over = hasGoal && remainderG < 0
  const pct = hasGoal ? Math.round((100 * intakeG) / goalG) : null
  const barPct = hasGoal ? Math.min(100, Math.max(0, (100 * intakeG) / goalG)) : 0

  return (
    <div className="min-w-0 rounded-lg border border-emerald-500/35 dark:border-emerald-500/35 bg-white/90 dark:bg-black/35 px-2 py-2 sm:px-2.5 text-center shadow-sm">
      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
        {abbr}
      </p>
      <p className="text-lg sm:text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-200 leading-tight mt-0.5">
        {fmt1(intakeG)}
        <span className="text-[10px] font-semibold text-emerald-600/90 dark:text-emerald-300/90 ml-0.5">g</span>
      </p>
      <p className="text-[9px] tabular-nums text-emerald-800/90 dark:text-emerald-100/85 mt-1 leading-tight">
        Meta {hasGoal ? `${fmt1(goalG)} g` : '—'}
      </p>
      <p
        className={cn(
          'text-[10px] sm:text-[11px] font-bold tabular-nums leading-tight mt-0.5',
          !hasGoal ? 'text-emerald-600/50 dark:text-emerald-300/40' : over ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-100',
        )}
      >
        Rest {hasGoal ? `${fmt1(remainderG)} g` : '—'}
      </p>
      {hasGoal && pct != null ? (
        <p className="text-[9px] tabular-nums text-emerald-800/85 dark:text-emerald-200/75 mt-0.5">Obj. {pct} %</p>
      ) : null}
      {hasGoal ? (
        <div className="h-1.5 mt-1.5 rounded-full bg-emerald-200/90 dark:bg-emerald-950/70 overflow-hidden mx-auto max-w-[5.5rem]">
          <div
            className="h-full rounded-full bg-emerald-500 dark:bg-emerald-300 transition-[width] duration-300 ease-out"
            style={{ width: `${barPct}%` }}
          />
        </div>
      ) : intakeG > 0 ? (
        <p className="text-[8px] text-emerald-800/75 dark:text-emerald-200/65 leading-snug mt-1 px-0.5">
          Peso y g/kg en 2
        </p>
      ) : null}
    </div>
  )
}

function TotalsBadge({
  label,
  compact,
  ...t
}: MacroTotals & { label: string; compact?: boolean }) {
  const pct = pctKcalMacros(t)
  return (
    <div
      className={cn(
        'rounded-xl border border-surface-border bg-surface-muted/40 text-sm',
        compact ? 'px-3 py-2' : 'px-4 py-3',
      )}
    >
      <p className={cn('uppercase tracking-wide text-ink-muted font-bold', compact ? 'text-[9px]' : 'text-[10px]')}>
        {label}
      </p>
      <p className={cn('tabular-nums text-ink-secondary', compact ? 'text-xs mt-0.5 leading-snug' : 'mt-1')}>
        HC {fmt1(t.carbsG)} · P {fmt1(t.proteinG)} · G {fmt1(t.fatG)} · {fmt1(t.kcal)} kcal
      </p>
      {pct && !compact && (
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
  const [mealPickSlot, setMealPickSlot] = useState<MealSlotKey | null>(null)
  const [mealPickTab, setMealPickTab] = useState<'plan' | 'library'>('plan')
  const [mealPickSecKey, setMealPickSecKey] = useState('')
  const [mealPickRowId, setMealPickRowId] = useState('')
  const [mealPickQty, setMealPickQty] = useState('')
  const [mealPickLibId, setMealPickLibId] = useState('')
  const [mealPickLibQty, setMealPickLibQty] = useState('')
  const [mealPickPreparation, setMealPickPreparation] = useState<MealPreparationChoice>('infer')
  const [workbookUpdatedAt, setWorkbookUpdatedAt] = useState<string | null>(null)
  const [templateListVersion, setTemplateListVersion] = useState(0)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [templateSaveName, setTemplateSaveName] = useState('')
  const [applyTemplateTarget, setApplyTemplateTarget] = useState<MealDistributionTemplate | null>(null)

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

  /** Planes viejos con gramos en Mi lista pero sin refs guardadas: completar desde la Guía cuando cargue la lista. */
  useEffect(() => {
    if (loading || !libraryFoods.length) return
    setWb((prev) => {
      const draft = prev.libraryQtyDraft ?? {}
      const refs = { ...(prev.libraryFoodRefsById ?? {}) }
      let changed = false
      for (const id of Object.keys(draft)) {
        if (refs[id]) continue
        const lib = libraryFoods.find((f) => f.id === id)
        if (!lib) continue
        refs[id] = {
          c: lib.carbs_g_per_100g ?? 0,
          p: lib.protein_g_per_100g ?? 0,
          f: lib.fat_g_per_100g ?? 0,
          k: lib.energy_kcal_per_100g ?? 0,
        }
        changed = true
      }
      if (!changed) return prev
      userHasEdited.current = true
      return { ...prev, libraryFoodRefsById: refs }
    })
  }, [libraryFoods, loading])

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
    if (!libraryPicker && !tableTargetLib && !assignOpen && !mealPickSlot) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setLibraryPicker(null)
      setLibraryQuery('')
      setTableTargetLib(null)
      setAssignOpen(false)
      setMealPickSlot(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [libraryPicker, tableTargetLib, assignOpen, mealPickSlot])

  const mealPickRows = useMemo(
    () => wb.sections.find((s) => s.key === mealPickSecKey)?.rows ?? [],
    [wb.sections, mealPickSecKey],
  )

  useEffect(() => {
    if (!mealPickSlot) return
    setMealPickTab('plan')
    setMealPickPreparation('infer')
    const w = wbRef.current
    const firstSec = w.sections[0]
    const sk = firstSec?.key ?? ''
    setMealPickSecKey(sk)
    const r0 = firstSec?.rows[0]
    setMealPickRowId(r0?.id ?? '')
    setMealPickQty((r0?.qtyG ?? '').trim())
    const lib0 = libraryFoods[0]
    setMealPickLibId(lib0?.id ?? '')
    setMealPickLibQty(lib0 ? (w.libraryQtyDraft?.[lib0.id] ?? '').trim() : '')
  }, [mealPickSlot, libraryFoods])

  useEffect(() => {
    if (!mealPickSlot) return
    const r0 = mealPickRows[0]
    setMealPickRowId(r0?.id ?? '')
    setMealPickQty((r0?.qtyG ?? '').trim())
  }, [mealPickSecKey, mealPickSlot, mealPickRows])

  const libraryFiltered = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase()
    if (!q) return libraryFoods
    return libraryFoods.filter((f) => f.display_name.toLowerCase().includes(q))
  }, [libraryFoods, libraryQuery])

  const persist = useCallback(async () => {
    if (!user?.id || !rowPk) return
    const body = wbRef.current
    setSaveState('saving')
    const { data, error } = await supabase
      .from('nutrition_planning_workbooks')
      .update({
        title: 'Plan de alimentación',
        data: planningDataToJson(body),
        updated_at: new Date().toISOString(),
      })
      .eq('id', rowPk)
      .eq('owner_id', user.id)
      .select('updated_at')
      .single()
    if (error) {
      console.error(error)
      toast.error('No se pudo guardar el plan.')
      setSaveState('dirty')
      return
    }
    if (data?.updated_at) setWorkbookUpdatedAt(data.updated_at)
    setSaveState('saved')
  }, [rowPk, user?.id])

  /** Cancela el debounce y guarda ya (evita perder gramos de Mi lista al salir antes del timer). */
  const flushPersist = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    await persist()
  }, [persist])

  useEffect(() => {
    function onHidden() {
      if (document.visibilityState === 'hidden' && userHasEdited.current) void flushPersist()
    }
    function onPageHide() {
      if (userHasEdited.current) void flushPersist()
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [flushPersist])

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
        const { data: ins, error: insErr } = await supabase
          .from('nutrition_planning_workbooks')
          .insert(insertPayload)
          .select('id, updated_at')
          .single()
        if (cancelled) return
        if (insErr) {
          console.error(insErr)
          toast.error(insErr.message ?? 'No se pudo crear el plan.')
          setLoading(false)
          return
        }
        const seed = createInitialPlanningWorkbook()
        setRowPk(ins.id)
        setWorkbookUpdatedAt(ins.updated_at ?? null)
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
      setWorkbookUpdatedAt(row.updated_at ?? null)
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

  const heightCmNum = parseLocaleNumberOrZero(wb.person.heightCm)
  const ageYearsNum = parseLocaleNumberOrZero(wb.person.ageYears)
  const activityFac = parseLocaleNumber(wb.person.activityFactor)
  const activityOk = Number.isFinite(activityFac) && activityFac > 0

  const calcBmrMale = useMemo(
    () =>
      weightKg > 0 && heightCmNum > 0 && ageYearsNum > 0
        ? mifflinStJeorBmrMale(weightKg, heightCmNum, ageYearsNum)
        : NaN,
    [weightKg, heightCmNum, ageYearsNum],
  )
  const calcBmrFemale = useMemo(
    () =>
      weightKg > 0 && heightCmNum > 0 && ageYearsNum > 0
        ? mifflinStJeorBmrFemale(weightKg, heightCmNum, ageYearsNum)
        : NaN,
    [weightKg, heightCmNum, ageYearsNum],
  )
  const calcTdeeMale = useMemo(
    () => (activityOk ? tdeeFromBmr(calcBmrMale, activityFac) : NaN),
    [calcBmrMale, activityOk, activityFac],
  )
  const calcTdeeFemale = useMemo(
    () => (activityOk ? tdeeFromBmr(calcBmrFemale, activityFac) : NaN),
    [calcBmrFemale, activityOk, activityFac],
  )

  const intakeTotals = useMemo(() => plannedNutritionTotalsFromWorkbook(wb), [wb])
  const remainderVsGuide =
    weightKg > 0 && (guideTotals.carbsG > 0 || guideTotals.proteinG > 0 || guideTotals.fatG > 0)
      ? diffTotals(guideTotals, intakeTotals)
      : null
  const remainderKcalTarget =
    targetKcal > 0 ? { ...ZERO_TOTALS, kcal: targetKcal - intakeTotals.kcal } : null

  const foodGrand = intakeTotals

  const mealDistribution = normalizeMealDistribution(wb.mealDistribution)

  const orphanLibDraftIds = useMemo(() => orphanLibraryDraftLibIds(wb), [wb])
  const mealTemplates = useMemo(() => listMealDistributionTemplates(), [templateListVersion])
  const visibleMealSlots = useMemo(() => visibleMealSlotKeys(mealDistribution), [mealDistribution])

  function patchMeal<K extends keyof MealDistributionState>(k: K, v: MealDistributionState[K]) {
    userHasEdited.current = true
    setWb((prev) => {
      const cur = normalizeMealDistribution(prev.mealDistribution)
      return {
        ...prev,
        mealDistribution: { ...cur, [k]: v },
      }
    })
  }

  function patchPicksForSlot(slot: MealSlotKey, picks: MealSlotPick[]) {
    userHasEdited.current = true
    setWb((prev) => {
      const cur = normalizeMealDistribution(prev.mealDistribution)
      const nextMap: NonNullable<MealDistributionState['picksByMeal']> = { ...(cur.picksByMeal ?? {}) }
      if (picks.length === 0) {
        delete nextMap[slot]
      } else {
        nextMap[slot] = picks
      }
      return {
        ...prev,
        mealDistribution: {
          ...cur,
          picksByMeal: Object.keys(nextMap).length ? nextMap : {},
        },
      }
    })
  }

  function appendMealPick(slot: MealSlotKey, pick: MealSlotPick) {
    const cur = mealDistribution.picksByMeal?.[slot] ?? []
    patchPicksForSlot(slot, [...cur, pick])
  }

  function updateMealPickQty(slot: MealSlotKey, pickId: string, qtyG: string) {
    const list = (mealDistribution.picksByMeal?.[slot] ?? []).map((p) => (p.id === pickId ? { ...p, qtyG } : p))
    patchPicksForSlot(slot, list)
  }

  function removeMealPick(slot: MealSlotKey, pickId: string) {
    const list = (mealDistribution.picksByMeal?.[slot] ?? []).filter((p) => p.id !== pickId)
    patchPicksForSlot(slot, list)
  }

  function updatePickPreparation(slot: MealSlotKey, pickId: string, preparation: MealPreparationChoice) {
    const list = (mealDistribution.picksByMeal?.[slot] ?? []).map((p) => {
      if (p.id !== pickId) return p
      if (preparation === 'infer') {
        const { preparation: _prep, ...rest } = p
        return rest as MealSlotPick
      }
      return { ...p, preparation }
    })
    patchPicksForSlot(slot, list)
  }

  function replaceMealDistribution(next: MealDistributionState) {
    userHasEdited.current = true
    setWb((prev) => ({
      ...prev,
      mealDistribution: normalizeMealDistribution(next),
    }))
  }

  function syncPickHintSnapshot(slot: MealSlotKey, pickId: string) {
    const picks = mealDistribution.picksByMeal?.[slot] ?? []
    const p = picks.find((x) => x.id === pickId)
    if (!p) return
    let hintStr = ''
    if (p.kind === 'plan_row') {
      const sec = wb.sections.find((s) => s.key === p.secKey)
      const row = sec?.rows.find((r) => r.id === p.rowId)
      hintStr = row?.hint?.trim() ?? ''
    } else {
      hintStr = libraryFoods.find((f) => f.id === p.libraryFoodId)?.notes?.trim() ?? ''
    }
    const list = picks.map((x) => {
      if (x.id !== pickId) return x
      if (hintStr) {
        return { ...x, hintSnapshot: hintStr } as MealSlotPick
      }
      if (x.kind === 'plan_row') {
        const { hintSnapshot: _s, ...rest } = x
        return rest as MealSlotPick
      }
      const { hintSnapshot: _s2, ...rest } = x
      return rest as MealSlotPick
    })
    patchPicksForSlot(slot, list)
    toast.success('Tip sincronizado con la Guía / plantilla.')
  }

  function duplicateMealPick(fromSlot: MealSlotKey, pickId: string, toSlot: MealSlotKey) {
    const picks = mealDistribution.picksByMeal?.[fromSlot] ?? []
    const p = picks.find((x) => x.id === pickId)
    if (!p) return
    const hintSnap = p.hintSnapshot?.trim()
    const prep = p.preparation && p.preparation !== 'infer' ? p.preparation : undefined
    let clone: MealSlotPick
    if (p.kind === 'plan_row') {
      clone = {
        id: newMealPickId(),
        kind: 'plan_row',
        secKey: p.secKey,
        rowId: p.rowId,
        qtyG: p.qtyG,
        nameSnapshot: p.nameSnapshot,
        ...(hintSnap ? { hintSnapshot: hintSnap } : {}),
        ...(prep ? { preparation: prep } : {}),
      }
    } else {
      clone = {
        id: newMealPickId(),
        kind: 'library',
        libraryFoodId: p.libraryFoodId,
        qtyG: p.qtyG,
        nameSnapshot: p.nameSnapshot,
        ...(hintSnap ? { hintSnapshot: hintSnap } : {}),
        ...(prep ? { preparation: prep } : {}),
      }
    }
    const dest = mealDistribution.picksByMeal?.[toSlot] ?? []
    patchPicksForSlot(toSlot, [...dest, clone])
    toast.success(`Copiado a «${MEAL_SLOT_LABELS[toSlot]}».`)
  }

  /** Hint para PDF / alumno: snapshot guardado o texto vivo de fila / Mi lista. */
  function hintForPickDisplay(p: MealSlotPick): string | undefined {
    const snap = p.hintSnapshot?.trim()
    if (snap) return snap
    if (p.kind === 'plan_row') {
      const sec = wb.sections.find((s) => s.key === p.secKey)
      const row = sec?.rows.find((r) => r.id === p.rowId)
      return row?.hint?.trim() || undefined
    }
    const lib = libraryFoods.find((f) => f.id === p.libraryFoodId)
    return lib?.notes?.trim() || undefined
  }

  function displayNameForMealPick(p: MealSlotPick): string {
    if (p.kind === 'library') {
      const lib = libraryFoods.find((f) => f.id === p.libraryFoodId)
      return lib?.display_name?.trim() || p.nameSnapshot
    }
    const sec = wb.sections.find((s) => s.key === p.secKey)
    const row = sec?.rows.find((r) => r.id === p.rowId)
    return row?.name?.trim() || p.nameSnapshot
  }

  function macroLineForMealPick(p: MealSlotPick): string | null {
    const q = parseLocaleNumberOrZero(p.qtyG)
    if (q <= 0) return null
    if (p.kind === 'plan_row') {
      const sec = wb.sections.find((s) => s.key === p.secKey)
      const row = sec?.rows.find((r) => r.id === p.rowId)
      if (!row) return null
      const t = scaledFromRefs(q, {
        carbs: parseLocaleNumberOrZero(row.refCarbs),
        protein: parseLocaleNumberOrZero(row.refProt),
        fat: parseLocaleNumberOrZero(row.refFat),
        kcal: parseLocaleNumberOrZero(row.refKcal),
      })
      return `Esta porción: HC ${fmt1(t.carbsG)} · P ${fmt1(t.proteinG)} · G ${fmt1(t.fatG)} · ${fmt1(t.kcal)} kcal`
    }
    const lib = libraryFoods.find((f) => f.id === p.libraryFoodId)
    if (!lib) return null
    const t = scaledFromRefs(q, {
      carbs: lib.carbs_g_per_100g ?? 0,
      protein: lib.protein_g_per_100g ?? 0,
      fat: lib.fat_g_per_100g ?? 0,
      kcal: lib.energy_kcal_per_100g ?? 0,
    })
    return `Esta porción: HC ${fmt1(t.carbsG)} · P ${fmt1(t.proteinG)} · G ${fmt1(t.fatG)} · ${fmt1(t.kcal)} kcal`
  }

  function confirmMealPick() {
    if (!mealPickSlot) return
    if (mealPickTab === 'plan') {
      const sec = wb.sections.find((s) => s.key === mealPickSecKey)
      const row = sec?.rows.find((r) => r.id === mealPickRowId)
      if (!sec || !row) {
        toast.error('Elegí tabla y alimento.')
        return
      }
      const qty = mealPickQty.trim() || (row.qtyG ?? '').trim()
      const hintSnap = row.hint?.trim()
      appendMealPick(mealPickSlot, {
        id: newMealPickId(),
        kind: 'plan_row',
        secKey: mealPickSecKey,
        rowId: mealPickRowId,
        qtyG: qty,
        nameSnapshot: row.name,
        ...(hintSnap ? { hintSnapshot: hintSnap } : {}),
        ...(mealPickPreparation !== 'infer' ? { preparation: mealPickPreparation } : {}),
      })
    } else {
      const lib = libraryFoods.find((f) => f.id === mealPickLibId)
      if (!lib) {
        toast.error('Elegí un alimento de Mi lista o actualizá la Guía.')
        return
      }
      const slot = mealPickSlot
      const notesSnap = lib.notes?.trim()
      const pick: MealSlotPick = {
        id: newMealPickId(),
        kind: 'library',
        libraryFoodId: lib.id,
        qtyG: mealPickLibQty.trim(),
        nameSnapshot: lib.display_name,
        ...(notesSnap ? { hintSnapshot: notesSnap } : {}),
        ...(mealPickPreparation !== 'infer' ? { preparation: mealPickPreparation } : {}),
      }
      userHasEdited.current = true
      setWb((prev) => {
        const cur = normalizeMealDistribution(prev.mealDistribution)
        const curList = [...(cur.picksByMeal?.[slot] ?? []), pick]
        const nextMap: NonNullable<MealDistributionState['picksByMeal']> = { ...(cur.picksByMeal ?? {}) }
        nextMap[slot] = curList
        const nextRefs = {
          ...(prev.libraryFoodRefsById ?? {}),
          [lib.id]: {
            c: lib.carbs_g_per_100g ?? 0,
            p: lib.protein_g_per_100g ?? 0,
            f: lib.fat_g_per_100g ?? 0,
            k: lib.energy_kcal_per_100g ?? 0,
          },
        }
        return {
          ...prev,
          libraryFoodRefsById: nextRefs,
          mealDistribution: { ...cur, picksByMeal: nextMap },
        }
      })
    }
    setMealPickSlot(null)
    toast.success('Alimento agregado al momento.')
  }

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
        .select('weight_kg, height_cm, birth_date, gender, intake_ferster')
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

      const ageYears = approxAgeFromBirthDate(st.birth_date)
      const heightCm =
        st.height_cm != null && Number.isFinite(st.height_cm) ? String(Math.round(st.height_cm)) : ''

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
            ...(heightCm ? { heightCm } : {}),
            ...(ageYears != null ? { ageYears: String(ageYears) } : {}),
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

  function patchLibraryQtyDraft(libId: string, val: string) {
    userHasEdited.current = true
    const lib = libraryFoods.find((f) => f.id === libId)
    setWb((prev) => {
      const nextRefs = { ...(prev.libraryFoodRefsById ?? {}) }
      if (lib) {
        nextRefs[libId] = {
          c: lib.carbs_g_per_100g ?? 0,
          p: lib.protein_g_per_100g ?? 0,
          f: lib.fat_g_per_100g ?? 0,
          k: lib.energy_kcal_per_100g ?? 0,
        }
      }
      return {
        ...prev,
        libraryQtyDraft: { ...(prev.libraryQtyDraft ?? {}), [libId]: val },
        libraryFoodRefsById: nextRefs,
      }
    })
  }

  function applyFoodToPlanRow(lib: NutritionFoodLibrary, secKey: string, rowId: string) {
    const qty = (wbRef.current.libraryQtyDraft?.[lib.id] ?? '').trim()
    patchRow(secKey, rowId, {
      name: lib.display_name,
      refCarbs: formatLibNutrientForPlanning(lib.carbs_g_per_100g),
      refProt: formatLibNutrientForPlanning(lib.protein_g_per_100g),
      refFat: formatLibNutrientForPlanning(lib.fat_g_per_100g),
      refKcal: formatLibNutrientForPlanning(lib.energy_kcal_per_100g),
      qtyG: qty,
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
      const refId = wbRef.current.personReferenceStudentId
      const studentName = refId ? referenceStudents.find((s) => s.id === refId)?.full_name : undefined
      await downloadPlanningWorkbookPdf(wbRef.current, {
        professionalName: profile?.full_name,
        studentName,
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
    const { data: resetRow, error } = await supabase
      .from('nutrition_planning_workbooks')
      .update({ data: planningDataToJson(seed), updated_at: new Date().toISOString() })
      .eq('id', rowPk)
      .eq('owner_id', user.id)
      .select('updated_at')
      .single()
    if (error) {
      toast.error('No se pudo restablecer.')
      return
    }
    if (resetRow?.updated_at) setWorkbookUpdatedAt(resetRow.updated_at)
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
        title="Armar plan de alimentación"
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
            {workbookUpdatedAt ? (
              <span className="text-[10px] text-ink-muted whitespace-nowrap shrink-0 hidden sm:inline">
                Actualizado {formatDate(workbookUpdatedAt)}
              </span>
            ) : null}
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
      <div className="mx-auto w-full max-w-[1200px] space-y-5 px-4 lg:px-6 pt-2">
        <section
          className="rounded-2xl border border-surface-border bg-surface-card w-full shadow-sm overflow-hidden"
          aria-labelledby="principal-plan-heading"
        >
          <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-surface-border/80 bg-surface-muted/20">
            <h2 id="principal-plan-heading" className="text-base font-semibold text-ink-primary">
              Datos del plan
            </h2>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              Primero ves el <strong>seguimiento</strong>, después ajustás <strong>objetivos</strong>; la{' '}
              <strong>calculadora TDEE</strong> queda disponible cuando la necesités. Abajo: distribución para el alumno/PDF y tablas de trabajo.
            </p>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {/* 1 · Seguimiento — siempre visible */}
            <div className="rounded-xl border border-brand-primary/25 bg-brand-primary/[0.04] dark:bg-brand-primary/[0.07] p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">1 · Seguimiento</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Compará tus objetivos con lo sumado en tablas, Mi lista y comidas del día.
                  </p>
                </div>
                <div className="w-full sm:max-w-[min(100%,20rem)] shrink-0">
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-1">{referenceEntityLabel}</label>
                  <select
                    className={selectPlanClasses}
                    disabled={referenceStudentsLoading}
                    value={wb.personReferenceStudentId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      void applyReferenceStudent(v || null)
                    }}
                  >
                    <option value="">Sin referencia · plantilla</option>
                    {referenceStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-ink-muted mt-1 block leading-snug">
                    Opcional · trae peso, sexo, altura y edad si están en la ficha.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <div className="rounded-lg bg-surface-card border border-surface-border px-3 py-2">
                  <p className="text-[9px] uppercase font-semibold text-ink-muted">Meta kcal</p>
                  <p className="text-lg font-bold tabular-nums text-ink-primary">{targetKcal > 0 ? fmt1(targetKcal) : '—'}</p>
                </div>
                <div className="rounded-lg bg-surface-card border border-surface-border px-3 py-2">
                  <p className="text-[9px] uppercase font-semibold text-ink-muted">Consumido</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{fmt1(intakeTotals.kcal)}</p>
                </div>
                <div className="rounded-lg bg-surface-card border border-surface-border px-3 py-2">
                  <p className="text-[9px] uppercase font-semibold text-ink-muted">Restante kcal</p>
                  <p
                    className={cn(
                      'text-lg font-bold tabular-nums',
                      remainderKcalTarget && remainderKcalTarget.kcal < 0
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-emerald-700 dark:text-emerald-300',
                    )}
                  >
                    {remainderKcalTarget ? fmt1(remainderKcalTarget.kcal) : targetKcal > 0 ? fmt1(targetKcal - intakeTotals.kcal) : '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-card border border-surface-border px-3 py-2">
                  <p className="text-[9px] uppercase font-semibold text-ink-muted">Del objetivo</p>
                  <p className="text-lg font-bold tabular-nums text-ink-primary">
                    {targetKcal > 0 ? `${Math.round((100 * intakeTotals.kcal) / targetKcal)} %` : '—'}
                  </p>
                </div>
              </div>

              <TotalsBadge compact label="Ya sumaste (macros)" {...foodGrand} />

              {remainderVsGuide ? (
                <div className="rounded-lg border border-surface-border bg-surface-card px-3 py-2 text-[11px]">
                  <p className="text-[9px] uppercase font-bold text-ink-muted mb-1">Gramos restantes vs objetivo (g/kg × peso)</p>
                  <p className="tabular-nums text-ink-secondary leading-relaxed">
                    Prot {fmt1(remainderVsGuide.proteinG)} g · HC {fmt1(remainderVsGuide.carbsG)} g · Grasas {fmt1(remainderVsGuide.fatG)} g · negativo =
                    fuiste pasado · orientativo
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-ink-muted">Cargá peso en la calculadora y g/kg más abajo para ver gramos restantes.</p>
              )}
            </div>

            {/* 2 · Objetivos — abierto por defecto */}
            <details
              open
              className="group rounded-xl border border-surface-border bg-surface-muted/10 overflow-hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 hover:bg-surface-muted/35 [&::-webkit-details-marker]:hidden border-b border-surface-border/60">
                <span className="text-sm font-medium text-ink-primary">2 · Objetivos, calorías y macros</span>
                <ChevronDown className="h-4 w-4 text-ink-muted shrink-0 transition-transform [.group:not([open])_&]:-rotate-90" aria-hidden />
              </summary>
              <div className="p-4 space-y-4 border-t border-surface-border/40">
                <p className="text-[11px] text-ink-muted -mt-1">
                  Como la segunda solapa del Excel HH: texto de objetivo, calorías del día target y targets en g/kg.
                </p>
                <label className="text-sm space-y-1 block max-w-[12rem]">
                  <span className="text-ink-muted text-xs font-semibold uppercase tracking-wide">Peso (kg)</span>
                  <Input value={wb.person.weightKg} onChange={(e) => patchPerson('weightKg', e.target.value)} inputMode="decimal" />
                  <span className="text-[10px] text-ink-muted leading-snug inline-block mt-1">
                    Para g/kg y para la calculadora TDEE; también desde «{referenceEntityLabel}» en el punto 1.
                  </span>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm space-y-1">
                    <span className="text-ink-muted text-xs font-semibold uppercase tracking-wide">Objetivo en texto</span>
                    <textarea
                      className="flex min-h-[64px] w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                      value={wb.objectives}
                      onChange={(e) => {
                        userHasEdited.current = true
                        setWb((p) => ({ ...p, objectives: e.target.value }))
                      }}
                      placeholder="Ej. déficit ligero…"
                    />
                  </label>
                  <label className="text-sm space-y-1">
                    <span className="text-ink-muted text-xs font-semibold uppercase tracking-wide">Calorías propuestas · meta del día</span>
                    <Input
                      value={wb.proposedKcal}
                      onChange={(e) => {
                        userHasEdited.current = true
                        setWb((p) => ({ ...p, proposedKcal: e.target.value }))
                      }}
                      inputMode="decimal"
                      placeholder="Ej. 2700"
                    />
                    <span className="text-[10px] text-ink-muted">Base para «restante» en el cuadro 1 (TDEE ± ajuste o manual).</span>
                  </label>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-primary mb-2">Macros · g/kg de peso</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-sm space-y-1">
                      <span className="text-ink-muted text-[10px]">Proteína</span>
                      <Input
                        value={wb.macroInputs.proteinGPerKg}
                        onChange={(e) => patchMacroInputs('proteinGPerKg', e.target.value)}
                        inputMode="decimal"
                      />
                    </label>
                    <label className="text-sm space-y-1">
                      <span className="text-ink-muted text-[10px]">Carbohidratos</span>
                      <Input value={wb.macroInputs.carbGPerKg} onChange={(e) => patchMacroInputs('carbGPerKg', e.target.value)} inputMode="decimal" />
                    </label>
                    <label className="text-sm space-y-1">
                      <span className="text-ink-muted text-[10px]">Grasas</span>
                      <Input value={wb.macroInputs.fatGPerKg} onChange={(e) => patchMacroInputs('fatGPerKg', e.target.value)} inputMode="decimal" />
                    </label>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <TotalsBadge label="Objetivo · gramos (peso × g/kg)" {...guideTotals} compact />
                  <div className="rounded-xl border border-surface-border bg-surface-muted/30 px-3 py-2.5 text-sm space-y-1.5">
                    <p className="text-[9px] uppercase tracking-wide text-ink-muted font-bold">Total cantidad · kcal desde esos macros</p>
                    <p className="text-base font-semibold tabular-nums text-ink-primary">
                      {weightKg > 0 ? `${macrosKcalGuess.toLocaleString('es-AR', { maximumFractionDigits: 0 })} kcal` : '—'}
                    </p>
                    {weightKg > 0 && targetKcal > 0 ? (
                      <p className="text-[11px] text-ink-secondary tabular-nums">
                        vs {targetKcal.toLocaleString('es-AR', { maximumFractionDigits: 0 })} kcal meta · Δ{' '}
                        {(macrosKcalGuess - targetKcal).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      </p>
                    ) : null}
                    {weightKg > 0 && targetKcal > 0 && guidePctVsTarget ? (
                      <p className="text-[10px] text-ink-muted tabular-nums">
                        % sobre meta: HC {guidePctVsTarget.c.toFixed(0)} · P {guidePctVsTarget.p.toFixed(0)} · G{' '}
                        {guidePctVsTarget.f.toFixed(0)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </details>

            {/* 3 · TDEE colapsado por defecto */}
            <details className="group rounded-xl border border-surface-border bg-surface-muted/10 overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 hover:bg-surface-muted/35 [&::-webkit-details-marker]:hidden border-b border-surface-border/60">
                <div className="min-w-0 text-left space-y-0.5">
                  <span className="text-sm font-medium text-ink-primary block">3 · Calculadora TMB / TDEE</span>
                  <span className="text-[10px] text-ink-muted block tabular-nums">
                    Mifflin–St Jeor ·{' '}
                    {Number.isFinite(calcTdeeMale) && Number.isFinite(calcTdeeFemale)
                      ? `TDEE ejemplo H ${fmt1(calcTdeeMale)} · M ${fmt1(calcTdeeFemale)} kcal`
                      : 'Completa datos y factor cuando la abras'}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-ink-muted shrink-0 transition-transform [.group:not([open])_&]:-rotate-90" aria-hidden />
              </summary>
              <div className="p-4 space-y-4 border-t border-surface-border/40">
                <p className="text-[11px] text-amber-800 dark:text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 leading-relaxed">
                  Orientación pedagógica (plantilla tipo HH); no sustituye criterio clínico.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-sm space-y-1">
                    <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wide">Altura (cm)</span>
                    <Input value={wb.person.heightCm} onChange={(e) => patchPerson('heightCm', e.target.value)} inputMode="decimal" />
                  </label>
                  <label className="text-sm space-y-1">
                    <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wide">Edad (años)</span>
                    <Input value={wb.person.ageYears} onChange={(e) => patchPerson('ageYears', e.target.value)} inputMode="decimal" />
                  </label>
                  <label className="text-sm space-y-1 lg:col-span-2">
                    <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wide">Sexo · copiar TDEE</span>
                    <select
                      className={selectPlanClasses}
                      value={wb.person.sex}
                      onChange={(e) => patchPerson('sex', e.target.value as PlanningWorkbookStateV1['person']['sex'])}
                    >
                      <option value="">—</option>
                      <option value="M">Hombre</option>
                      <option value="F">Mujer</option>
                    </select>
                  </label>
                </div>
                <details className="group/actguide rounded-lg border border-surface-border bg-surface-card text-[11px] overflow-hidden">
                  <summary className="cursor-pointer px-3 py-2 font-medium text-ink-secondary hover:bg-surface-muted/40 list-none flex justify-between items-center [&::-webkit-details-marker]:hidden">
                    Tabla de factores de actividad (guía)
                    <ChevronDown className="h-3.5 w-3.5 text-ink-muted transition-transform [.group\\/actguide:not([open])_&]:-rotate-90" aria-hidden />
                  </summary>
                  <div className="border-t border-surface-border overflow-x-auto px-2 pb-2 pt-2">
                    <table className="w-full border-collapse min-w-[320px]">
                      <thead className="bg-surface-muted/50 text-ink-muted text-[9px] uppercase">
                        <tr>
                          <th className="text-left px-2 py-1 border-b border-surface-border">Nivel</th>
                          <th className="text-left px-2 py-1 border-b border-surface-border w-16">Factor</th>
                          <th className="text-left px-2 py-1 border-b border-surface-border">Notas</th>
                        </tr>
                      </thead>
                      <tbody className="text-ink-secondary">
                        {ACTIVITY_FACTOR_GUIDE_ROWS.map((r) => (
                          <tr key={r.label} className="border-b border-surface-border/60">
                            <td className="px-2 py-1.5 font-medium text-ink-primary">{r.label}</td>
                            <td className="px-2 py-1.5 tabular-nums">{r.range}</td>
                            <td className="px-2 py-1.5 leading-snug">{r.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
                <label className="block max-w-[11rem] space-y-1">
                  <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wide">Actividad estimada ×</span>
                  <Input
                    value={wb.person.activityFactor}
                    onChange={(e) => patchPerson('activityFactor', e.target.value)}
                    inputMode="decimal"
                    placeholder="Ej. 1,7"
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['TMB · H', calcBmrMale],
                    ['TMB · M', calcBmrFemale],
                    ['TDEE · H', calcTdeeMale],
                    ['TDEE · M', calcTdeeFemale],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-2.5 py-2">
                      <p className="text-[9px] uppercase text-ink-muted font-bold">{label}</p>
                      <p className="text-base font-semibold tabular-nums text-ink-primary">
                        {Number.isFinite(val as number) ? `${fmt1(val as number)} kcal` : '—'}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={!Number.isFinite(calcTdeeMale) || !Number.isFinite(calcTdeeFemale)}
                    onClick={() => {
                      if (!Number.isFinite(calcTdeeMale) || !Number.isFinite(calcTdeeFemale)) return
                      userHasEdited.current = true
                      const m = String(Math.round(calcTdeeMale * 10) / 10)
                      const f = String(Math.round(calcTdeeFemale * 10) / 10)
                      setWb((p) => ({ ...p, person: { ...p.person, tdeeMale: m, tdeeFemale: f } }))
                      toast.success('Mantención manual actualizada con el TDEE calculado.')
                    }}
                  >
                    Guardar TDEE en PDF (h/m)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={wb.person.sex !== 'M' || !Number.isFinite(calcTdeeMale)}
                    title={wb.person.sex !== 'M' ? 'Elegí hombre en Sexo.' : ''}
                    onClick={() => {
                      if (!Number.isFinite(calcTdeeMale)) return
                      userHasEdited.current = true
                      setWb((p) => ({ ...p, proposedKcal: String(Math.round(calcTdeeMale * 10) / 10) }))
                      toast.success('Calorías propuestas = TDEE hombre.')
                    }}
                  >
                    TDEE H → meta kcal
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={wb.person.sex !== 'F' || !Number.isFinite(calcTdeeFemale)}
                    title={wb.person.sex !== 'F' ? 'Elegí mujer en Sexo.' : ''}
                    onClick={() => {
                      if (!Number.isFinite(calcTdeeFemale)) return
                      userHasEdited.current = true
                      setWb((p) => ({ ...p, proposedKcal: String(Math.round(calcTdeeFemale * 10) / 10) }))
                      toast.success('Calorías propuestas = TDEE mujer.')
                    }}
                  >
                    TDEE M → meta kcal
                  </Button>
                </div>
                <div className="rounded-lg bg-surface-muted/50 border border-surface-border px-3 py-2 text-[11px] text-ink-secondary flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="tabular-nums shrink-0">Mantención PDF (manual):</span>
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span className="text-ink-muted whitespace-nowrap">H</span>
                    <Input
                      className="h-8 w-[4.5rem] text-xs"
                      aria-label="Mantención hombre kcal"
                      value={wb.person.tdeeMale}
                      onChange={(e) => patchPerson('tdeeMale', e.target.value)}
                    />
                    <span className="text-ink-muted whitespace-nowrap">M</span>
                    <Input
                      className="h-8 w-[4.5rem] text-xs"
                      aria-label="Mantención mujer kcal"
                      value={wb.person.tdeeFemale}
                      onChange={(e) => patchPerson('tdeeFemale', e.target.value)}
                    />
                  </span>
                  <span className="text-ink-muted">kcal</span>
                </div>
              </div>
            </details>
          </div>
        </section>

        <details className="rounded-2xl border border-surface-border bg-surface-card p-4 group w-full">
          <summary className="cursor-pointer flex items-start gap-2 text-sm font-semibold text-ink-primary list-none [&::-webkit-details-marker]:hidden">
            <Lightbulb className="w-4 h-4 shrink-0 text-brand-primary mt-0.5" aria-hidden />
            Cómo usar la pantalla (paso a paso)
          </summary>
          <ol className="mt-3 list-decimal pl-5 space-y-1.5 text-sm text-ink-secondary leading-relaxed">
            <li>
              <strong>1 · Seguimiento</strong> te dice si ya llegaste a tus kcal/meta y macros; <strong>2 · Objetivos</strong> donde cargás texto, calorías y g/kg (podés tenerlo siempre abierto).
            </li>
            <li>
              Abrí <strong>3 · TDEE</strong> solo cuando quieras Mifflin–St Jeor + factor de actividad; la tabla larga está anidada para no ocupar lugar.
            </li>
            <li>
              <strong>Distribución del día</strong> va al alumno/PDF; las <strong>tablas HH</strong> más abajo son tu hoja de trabajo con macros por 100 g.
            </li>
            <li>
              Todo se <strong>guarda solo</strong>; «Restaurar plantilla» vuelve al formato inicial HH en tu cuenta.
            </li>
          </ol>
          <p className="text-[11px] text-ink-muted pt-3 mt-2 border-t border-surface-border/70 leading-relaxed">
            Si el alumno tiene plan con nutricionista, estos números sirven como apoyo; no los sustituyan sin consenso profesional.
          </p>
        </details>

        <section
          className="rounded-2xl border border-surface-border bg-surface-card p-5 space-y-4 w-full"
          aria-labelledby="meal-dist-heading"
        >
          <div>
            <div className="flex flex-wrap items-baseline gap-2 gap-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-primary">4 · Para el alumno</span>
              <h2 id="meal-dist-heading" className="text-lg font-semibold text-ink-primary">
                Distribución del día
              </h2>
            </div>
            <p className="text-sm text-ink-muted mt-1 leading-relaxed">
              Cada comida es un bloque en <strong>orden vertical</strong> (como el PDF): tabla con un alimento por fila, separación clara entre desayuno, almuerzo, etc. Cargá desde las tablas abajo o <strong>Mi lista</strong>. Notas opcionales al pie de cada momento. Activá{' '}
              <strong>media mañana / tarde</strong> si aplican. El panel verde abajo actualiza <strong className="text-emerald-700 dark:text-emerald-300">kcal y gramos de P / HC / G</strong> con lo que sumás en tablas, Mi lista y esta distribución (metas de gramos = peso × g/kg del apartado 2).
            </p>
          </div>

          {/* Kcal + macros en vivo (sticky) */}
          <div className="sticky top-2 z-20">
            <div className="rounded-xl border border-emerald-300/70 dark:border-emerald-600/45 bg-emerald-50/95 dark:bg-emerald-950/85 backdrop-blur-sm shadow-md px-4 py-3 space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-900/80 dark:text-emerald-200/90 shrink-0">
                    Kcal del plan (en vivo)
                  </span>
                  <span className="text-2xl sm:text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300 leading-none">
                    {fmt1(intakeTotals.kcal)}
                  </span>
                  <span className="text-xs text-emerald-800/75 dark:text-emerald-200/70">kcal sumadas</span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm tabular-nums">
                  <div>
                    <p className="text-[9px] font-semibold uppercase text-emerald-800/65 dark:text-emerald-300/70">Meta</p>
                    <p className="font-semibold text-ink-primary">{targetKcal > 0 ? `${fmt1(targetKcal)} kcal` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase text-emerald-800/65 dark:text-emerald-300/70">Restante</p>
                    <p
                      className={cn(
                        'text-lg font-bold',
                        !remainderKcalTarget && targetKcal <= 0
                          ? 'text-ink-muted text-base font-medium'
                          : remainderKcalTarget && remainderKcalTarget.kcal < 0
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-emerald-800 dark:text-emerald-200',
                      )}
                    >
                      {remainderKcalTarget
                        ? `${fmt1(remainderKcalTarget.kcal)} kcal`
                        : targetKcal > 0
                          ? `${fmt1(targetKcal - intakeTotals.kcal)} kcal`
                          : 'Definí meta en 2 · Objetivos'}
                    </p>
                  </div>
                  {targetKcal > 0 ? (
                    <div>
                      <p className="text-[9px] font-semibold uppercase text-emerald-800/65 dark:text-emerald-300/70">Del objetivo</p>
                      <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                        {`${Math.round((100 * intakeTotals.kcal) / targetKcal)} %`}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Macros: misma tarjeta, justo encima de la barra de kcal — siempre visibles al cargar alimentos */}
              <div
                className="rounded-lg border border-emerald-500/40 dark:border-emerald-500/40 bg-emerald-100/50 dark:bg-emerald-950/60 px-2 py-2 sm:py-2.5"
                aria-live="polite"
                aria-label="Macros del plan en tiempo real"
              >
                <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-200/95 mb-1.5 text-center sm:text-left px-0.5">
                  Macros en vivo (g) — se actualizan al cargar tablas, Mi lista o comidas del día
                </p>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <LiveMacroCell abbr="Proteínas" intakeG={intakeTotals.proteinG} goalG={guideTotals.proteinG} />
                  <LiveMacroCell abbr="Carbos" intakeG={intakeTotals.carbsG} goalG={guideTotals.carbsG} />
                  <LiveMacroCell abbr="Grasas" intakeG={intakeTotals.fatG} goalG={guideTotals.fatG} />
                </div>
              </div>

              {targetKcal > 0 ? (
                <div className="h-2 rounded-full bg-emerald-200/80 dark:bg-emerald-900/60 overflow-hidden border border-emerald-300/40 dark:border-emerald-700/40">
                  <div
                    className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400 transition-[width] duration-300 ease-out"
                    style={{
                      width: `${Math.min(100, Math.max(0, (100 * intakeTotals.kcal) / targetKcal))}%`,
                    }}
                    role="progressbar"
                    aria-valuenow={Math.round(intakeTotals.kcal)}
                    aria-valuemin={0}
                    aria-valuemax={Math.round(targetKcal)}
                    aria-label="Avance de kcal respecto a la meta"
                  />
                </div>
              ) : (
                <p className="text-[11px] text-emerald-900/70 dark:text-emerald-200/65 leading-snug">
                  Cargá <strong className="font-semibold">Calorías propuestas</strong> en la sección 2 para ver cuánto te falta descontar respecto a la meta.
                </p>
              )}
            </div>
          </div>

          {orphanLibDraftIds.length > 0 ? (
            <div
              role="status"
              className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm text-ink-secondary"
            >
              <p className="font-medium text-amber-900 dark:text-amber-200/95">
                Tenés gramos en «Alimentos personalizados» que todavía no agregaste a un momento del día.
              </p>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                El PDF solo incluye lo que esté en esta distribución. Usá «Desde tablas / Mi lista» en cada comida o copiá ítems
                desde la tabla de Mi lista.
              </p>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between border border-surface-border/80 rounded-xl p-3 bg-surface-muted/15">
            <div className="flex flex-col gap-2 min-w-[200px] flex-1">
              <label htmlFor="apply-meal-template" className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                Plantillas (este navegador)
              </label>
              <select
                id="apply-meal-template"
                className={cn(selectPlanClasses, 'h-9 text-xs')}
                value=""
                onChange={(e) => {
                  const id = e.target.value
                  e.target.value = ''
                  if (!id) return
                  const t = mealTemplates.find((x) => x.id === id)
                  if (t) setApplyTemplateTarget(t)
                }}
              >
                <option value="">Aplicar plantilla guardada…</option>
                {mealTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {saveTemplateOpen ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-ink-muted">Nombre</span>
                    <Input
                      className="h-9 min-w-[12rem]"
                      value={templateSaveName}
                      onChange={(e) => setTemplateSaveName(e.target.value)}
                      placeholder="Ej. Semana típica"
                      autoFocus
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9"
                    onClick={() => {
                      const created = saveMealDistributionTemplate(templateSaveName, mealDistribution)
                      if (!created) {
                        toast.error('Escribí un nombre para la plantilla.')
                        return
                      }
                      setTemplateSaveName('')
                      setSaveTemplateOpen(false)
                      setTemplateListVersion((v) => v + 1)
                      toast.success('Plantilla guardada en este navegador.')
                    }}
                  >
                    Guardar
                  </Button>
                  <Button type="button" variant="secondary" size="sm" className="h-9" onClick={() => setSaveTemplateOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1"
                  icon={<BookmarkPlus className="h-3.5 w-3.5" aria-hidden />}
                  onClick={() => setSaveTemplateOpen(true)}
                >
                  Guardar como plantilla
                </Button>
              )}
            </div>
          </div>
          {mealTemplates.length > 0 ? (
            <details className="text-xs text-ink-muted">
              <summary className="cursor-pointer font-medium text-ink-secondary">Gestionar plantillas guardadas</summary>
              <ul className="mt-2 space-y-1.5 pl-1">
                {mealTemplates.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{t.name}</span>
                    <button
                      type="button"
                      className="text-red-600 hover:underline text-[11px] font-medium"
                      onClick={() => {
                        removeMealDistributionTemplate(t.id)
                        setTemplateListVersion((v) => v + 1)
                        toast.success('Plantilla eliminada.')
                      }}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-primary">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={mealDistribution.includeMidMorning}
                onChange={(e) => patchMeal('includeMidMorning', e.target.checked)}
                className="size-4 rounded border-surface-inputBorder text-brand-primary focus:ring-brand-primary/30"
              />
              Incluir media mañana
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={mealDistribution.includeMidAfternoon}
                onChange={(e) => patchMeal('includeMidAfternoon', e.target.checked)}
                className="size-4 rounded border-surface-inputBorder text-brand-primary focus:ring-brand-primary/30"
              />
              Incluir media tarde
            </label>
          </div>
          <div className="flex flex-col gap-6">
            {(
              [
                { key: 'desayuno' as MealSlotKey, label: MEAL_SLOT_LABELS.desayuno, visible: true },
                { key: 'mediaManana', label: MEAL_SLOT_LABELS.mediaManana, visible: mealDistribution.includeMidMorning },
                { key: 'almuerzo', label: MEAL_SLOT_LABELS.almuerzo, visible: true },
                { key: 'mediaTarde', label: MEAL_SLOT_LABELS.mediaTarde, visible: mealDistribution.includeMidAfternoon },
                { key: 'merienda', label: MEAL_SLOT_LABELS.merienda, visible: true },
                { key: 'cena', label: MEAL_SLOT_LABELS.cena, visible: true },
              ] as const
            )
              .filter((x) => x.visible)
              .map(({ key, label }) => {
                const picks = mealDistribution.picksByMeal?.[key] ?? []
                const notes = mealDistribution[key as keyof MealDistributionState]
                const notesStr = typeof notes === 'string' ? notes : ''
                return (
                  <div
                    key={key}
                    role="region"
                    aria-labelledby={`meal-slot-title-${key}`}
                    className="rounded-xl border border-surface-border bg-surface-card overflow-hidden text-sm shadow-sm"
                  >
                    {/* Cabecera de momento — alineada al PDF (franja + título) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700">
                      <span
                        id={`meal-slot-title-${key}`}
                        className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300"
                      >
                        {label}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 h-8 text-xs gap-1 border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900/50"
                        icon={<Plus className="h-3.5 w-3.5" aria-hidden />}
                        onClick={() => setMealPickSlot(key)}
                      >
                        Desde tablas / Mi lista
                      </Button>
                    </div>
                    <div className="bg-slate-50/80 dark:bg-slate-950/40">
                      {picks.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[520px] border-collapse text-sm">
                            <thead>
                              <tr className="border-b border-surface-border bg-surface-elevated/90 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                                <th className="text-left px-3 py-2 min-w-0">Alimento</th>
                                <th className="text-left px-2 py-2 hidden md:table-cell">Macros (orient.)</th>
                                <th className="text-right px-2 py-2 whitespace-nowrap w-[7rem]">Cantidad</th>
                                <th className="text-right px-2 py-2 w-[6.5rem]">g</th>
                                <th className="w-11 px-1 py-2" aria-label="Quitar" />
                              </tr>
                            </thead>
                            <tbody>
                              {picks.map((p, rowIdx) => {
                                const macroLine = macroLineForMealPick(p)
                                const hintText = hintForPickDisplay(p)
                                const studentQty = buildStudentQuantitySummaryLines({
                                  gramsStr: p.qtyG,
                                  nameSnapshot: p.nameSnapshot,
                                  hint: hintText,
                                  preparation: p.preparation,
                                })
                                return (
                                  <Fragment key={p.id}>
                                    <tr
                                      className={cn(
                                        'border-b border-surface-border align-top',
                                        rowIdx % 2 === 0 ? 'bg-white dark:bg-slate-900/35' : 'bg-slate-50/90 dark:bg-slate-900/20',
                                      )}
                                    >
                                      <td className="px-3 py-2.5 align-top min-w-0 max-w-[40%]">
                                        <p className="font-semibold text-ink-primary text-[13px] leading-snug">
                                          {displayNameForMealPick(p)}
                                        </p>
                                        {studentQty.prepLine ? (
                                          <p className="text-[10px] text-emerald-700 dark:text-emerald-400/90 leading-snug mt-1">
                                            {studentQty.prepLine}
                                          </p>
                                        ) : null}
                                        {hintText ? (
                                          <p className="text-[10px] text-ink-muted italic leading-snug mt-1 border-l-2 border-brand-primary/35 pl-2">
                                            Tip / unidad: {hintText}
                                          </p>
                                        ) : null}
                                        <div className="mt-2 space-y-1.5 md:hidden">
                                          {macroLine ? (
                                            <p className="text-[10px] text-ink-muted tabular-nums leading-snug">
                                              {macroLine}
                                            </p>
                                          ) : null}
                                        </div>
                                      </td>
                                      <td className="px-2 py-2.5 align-top hidden md:table-cell">
                                        {macroLine ? (
                                          <p className="text-[10px] text-ink-muted tabular-nums leading-relaxed max-w-[14rem]">
                                            {macroLine}
                                          </p>
                                        ) : (
                                          <span className="text-ink-muted text-[10px]">—</span>
                                        )}
                                      </td>
                                      <td className="px-2 py-2.5 align-top text-right">
                                        <p className="text-[10px] text-ink-secondary tabular-nums leading-snug">
                                          {studentQty.gramsLine}
                                        </p>
                                      </td>
                                      <td className="px-2 py-2 align-top">
                                        <div className="flex items-center justify-end gap-1">
                                          <span className="text-[10px] text-ink-muted">g</span>
                                          <Input
                                            className="h-8 w-[4.25rem] text-xs tabular-nums"
                                            inputMode="decimal"
                                            value={p.qtyG}
                                            onChange={(e) => updateMealPickQty(key, p.id, e.target.value)}
                                            aria-label={`Gramos · ${displayNameForMealPick(p)}`}
                                          />
                                        </div>
                                      </td>
                                      <td className="px-1 py-2 align-top text-center">
                                        <button
                                          type="button"
                                          className="rounded-lg p-1.5 text-ink-muted hover:bg-red-500/10 hover:text-red-600 mx-auto"
                                          title="Quitar"
                                          onClick={() => removeMealPick(key, p.id)}
                                        >
                                          <Trash2 className="h-4 w-4" aria-hidden />
                                        </button>
                                      </td>
                                    </tr>
                                    <tr className="border-b border-surface-border bg-surface-muted/50 dark:bg-slate-900/45">
                                      <td colSpan={5} className="px-3 py-2">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2">
                                          <button
                                            type="button"
                                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-surface-border bg-surface-card px-2 py-1.5 text-[10px] font-medium text-ink-secondary hover:bg-surface-elevated w-fit"
                                            title="Actualizar tip desde la fila del plan o las notas de Mi lista"
                                            onClick={() => syncPickHintSnapshot(key, p.id)}
                                          >
                                            <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                            Sincronizar tip
                                          </button>
                                          <label htmlFor={`dup-${key}-${p.id}`} className="sr-only">
                                            Copiar «{displayNameForMealPick(p)}» a otro momento
                                          </label>
                                          <select
                                            id={`dup-${key}-${p.id}`}
                                            className={cn(selectPlanClasses, 'h-8 max-w-full sm:max-w-[11rem] text-[10px] py-0 w-full sm:w-auto')}
                                            value=""
                                            onChange={(e) => {
                                              const to = e.target.value as MealSlotKey
                                              e.target.value = ''
                                              if (to) duplicateMealPick(key, p.id, to)
                                            }}
                                          >
                                            <option value="">Copiar a…</option>
                                            {visibleMealSlots.map((slot) => (
                                              <option key={slot} value={slot}>
                                                {MEAL_SLOT_LABELS[slot]}
                                              </option>
                                            ))}
                                          </select>
                                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0 flex-1">
                                            <span id={`prep-desc-${p.id}`} className="sr-only">
                                              Define cómo se muestra crudo o cocido en el PDF para este alimento.
                                            </span>
                                            <span className="text-[9px] text-ink-muted uppercase tracking-wide shrink-0">
                                              Referencia PDF
                                            </span>
                                            <select
                                              className={cn(
                                                selectPlanClasses,
                                                'h-8 flex-1 min-w-0 text-[11px] py-0 sm:max-w-[18rem]',
                                              )}
                                              value={p.preparation ?? 'infer'}
                                              onChange={(e) =>
                                                updatePickPreparation(key, p.id, e.target.value as MealPreparationChoice)
                                              }
                                              aria-label={`Crudo o cocido · ${displayNameForMealPick(p)}`}
                                              aria-describedby={`prep-desc-${p.id}`}
                                            >
                                              <option value="infer">Automático (nombre y notas)</option>
                                              <option value="crudo">Cantidad en crudo</option>
                                              <option value="cocido">Cantidad cocida</option>
                                            </select>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  </Fragment>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="px-4 py-6 text-center text-sm text-ink-muted border-b border-surface-border/60">
                          Sin alimentos en este momento. Usá <strong className="text-ink-secondary">Desde tablas / Mi lista</strong>{' '}
                          para agregar el primero (queda uno debajo del otro, como en el PDF).
                        </p>
                      )}
                      <div className="border-t border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/30 px-3 py-3">
                        <label className="block space-y-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                            Notas del momento (opcional)
                          </span>
                          <textarea
                            className="flex min-h-[64px] w-full rounded-lg border border-surface-inputBorder bg-surface-input px-2.5 py-2 text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                            value={notesStr}
                            onChange={(e) => patchMeal(key, e.target.value)}
                            placeholder="Observaciones para este momento (aparecen en el PDF debajo de la tabla)…"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </section>

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

        <details className="rounded-2xl border border-surface-border bg-surface-card p-5 group w-full">
          <summary className="cursor-pointer flex items-start gap-2 text-base font-semibold text-ink-primary list-none [&::-webkit-details-marker]:hidden outline-none select-none">
            <ChevronDown className="w-5 h-5 shrink-0 text-ink-muted mt-0.5 transition-transform [.group:not([open])_&]:-rotate-90" aria-hidden />
            Información sobre objetivos
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

        <p className="text-xs text-ink-muted leading-relaxed italic">
          El cuadro <strong className="not-italic">1 · Seguimiento</strong> arriba resume consumido y restante antes de llegar al PDF y a las tablas.
        </p>

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
                . Cargá <strong>gramos</strong> acá para ver HC/P/G/kcal del ítem; <strong>Usar</strong> copia el alimento al momento elegido (incluye los gramos si los cargaste).
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
                    <th className="px-2 py-2 font-semibold w-[44px] text-center" title="Suma al total del día cuando cargás gramos">
                      <span className="sr-only">Incluido en el total</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {libraryFoods.map((lib) => {
                    const qDraft = parseLocaleNumberOrZero(wb.libraryQtyDraft?.[lib.id] ?? '')
                    const libRefs = {
                      carbs: lib.carbs_g_per_100g ?? 0,
                      protein: lib.protein_g_per_100g ?? 0,
                      fat: lib.fat_g_per_100g ?? 0,
                      kcal: lib.energy_kcal_per_100g ?? 0,
                    }
                    const outLib =
                      qDraft > 0 ? scaledFromRefs(qDraft, libRefs) : ZERO_TOTALS
                    return (
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
                        <td className="px-2 py-1 align-top">
                          <Input
                            className="h-9 text-xs"
                            inputMode="decimal"
                            value={wb.libraryQtyDraft?.[lib.id] ?? ''}
                            onChange={(e) => patchLibraryQtyDraft(lib.id, e.target.value)}
                            onBlur={() => void flushPersist()}
                            aria-label={`Gramos · ${lib.display_name}`}
                          />
                        </td>
                        <td className="px-2 py-2 tabular-nums text-ink-secondary align-middle">{fmt1(lib.carbs_g_per_100g ?? NaN)}</td>
                        <td className="px-2 py-2 tabular-nums text-ink-secondary align-middle">{fmt1(lib.protein_g_per_100g ?? NaN)}</td>
                        <td className="px-2 py-2 tabular-nums text-ink-secondary align-middle">{fmt1(lib.fat_g_per_100g ?? NaN)}</td>
                        <td className="px-2 py-2 tabular-nums text-ink-secondary align-middle">{fmt1(lib.energy_kcal_per_100g ?? NaN)}</td>
                        <td className="px-2 py-2 tabular-nums text-ink-secondary align-middle">{fmt1(outLib.carbsG)}</td>
                        <td className="px-2 py-2 tabular-nums text-ink-secondary align-middle">{fmt1(outLib.proteinG)}</td>
                        <td className="px-2 py-2 tabular-nums text-ink-secondary align-middle">{fmt1(outLib.fatG)}</td>
                        <td className="px-2 py-2 tabular-nums text-ink-secondary align-middle">{fmt1(outLib.kcal)}</td>
                        <td className="px-2 py-2 align-middle text-center">
                          {qDraft > 0 ? (
                            <Check
                              className="inline h-4 w-4 text-brand-primary shrink-0"
                              strokeWidth={2.5}
                              aria-label={`${lib.display_name} suma al total del día`}
                            />
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="rounded-lg border border-dashed border-surface-border bg-surface-muted/15 px-3 py-2 text-xs text-ink-secondary">
          <span className="font-semibold text-ink-primary">Fuentes tipo Excel HH</span> — valores por 100 g para copiar o ajustar rápido al armar el día; el seguimiento contra objetivos está arriba.
        </div>

        <div className="space-y-5 pb-12">
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
              <section key={sec.key} className="rounded-xl border border-surface-border bg-surface-card overflow-hidden w-full">
                <div className="border-b border-surface-border bg-surface-muted/40 px-3 py-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-ink-primary uppercase tracking-wide">{sec.title}</h3>
                    <p className="text-[10px] text-ink-muted mt-0.5 leading-snug">{sec.quantityColumnHint}</p>
                  </div>
                  <p className="text-[10px] text-ink-secondary tabular-nums shrink-0">
                    Subtotal: HC {fmt1(secTotals.carbsG)} · P {fmt1(secTotals.proteinG)} · G {fmt1(secTotals.fatG)} · {fmt1(secTotals.kcal)} kcal
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] min-w-[880px]">
                    <thead>
                      <tr className="border-b border-surface-border text-left bg-surface-muted/30">
                        <th className="px-2 py-1.5 font-semibold sticky left-0 bg-surface-muted/30 z-[1] w-[220px]">Alimento</th>
                        <th className="px-1.5 py-1.5 font-semibold w-[68px]">Cant. g</th>
                        <th className="px-1.5 py-1.5 font-semibold w-[56px]">HC /100</th>
                        <th className="px-1.5 py-1.5 font-semibold w-[56px]">P /100</th>
                        <th className="px-1.5 py-1.5 font-semibold w-[56px]">G /100</th>
                        <th className="px-1.5 py-1.5 font-semibold w-[64px]">kcal /100</th>
                        <th className="px-1.5 py-1.5 font-semibold w-[64px]">HC</th>
                        <th className="px-1.5 py-1.5 font-semibold w-[64px]">P</th>
                        <th className="px-1.5 py-1.5 font-semibold w-[64px]">G</th>
                        <th className="px-1.5 py-1.5 font-semibold w-[72px]">kcal</th>
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
                            <td className="px-2 py-1.5 sticky left-0 bg-surface-card align-top border-r border-surface-border/50 max-w-[240px]">
                              <div className="flex items-start gap-1.5 min-w-0">
                                <div className="min-w-0 flex-1">
                                  <p className="text-ink-primary font-medium break-words leading-snug text-[11px]">{r.name}</p>
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
                                className="h-8 text-[11px]"
                                inputMode="decimal"
                                value={r.qtyG}
                                onChange={(e) => patchRow(sec.key, r.id, { qtyG: e.target.value })}
                              />
                            </td>
                            <td className="px-1.5 py-1 align-top">
                              <Input
                                className="h-8 text-[11px]"
                                inputMode="decimal"
                                value={r.refCarbs}
                                onChange={(e) => patchRow(sec.key, r.id, { refCarbs: e.target.value })}
                              />
                            </td>
                            <td className="px-1.5 py-1 align-top">
                              <Input
                                className="h-8 text-[11px]"
                                inputMode="decimal"
                                value={r.refProt}
                                onChange={(e) => patchRow(sec.key, r.id, { refProt: e.target.value })}
                              />
                            </td>
                            <td className="px-1.5 py-1 align-top">
                              <Input
                                className="h-8 text-[11px]"
                                inputMode="decimal"
                                value={r.refFat}
                                onChange={(e) => patchRow(sec.key, r.id, { refFat: e.target.value })}
                              />
                            </td>
                            <td className="px-1.5 py-1 align-top">
                              <Input
                                className="h-8 text-[11px]"
                                inputMode="decimal"
                                value={r.refKcal}
                                onChange={(e) => patchRow(sec.key, r.id, { refKcal: e.target.value })}
                              />
                            </td>
                            <td className="px-1.5 py-1.5 tabular-nums text-ink-secondary text-[11px]">{fmt1(out.carbsG)}</td>
                            <td className="px-1.5 py-1.5 tabular-nums text-ink-secondary text-[11px]">{fmt1(out.proteinG)}</td>
                            <td className="px-1.5 py-1.5 tabular-nums text-ink-secondary text-[11px]">{fmt1(out.fatG)}</td>
                            <td className="px-1.5 py-1.5 tabular-nums text-ink-secondary text-[11px]">{fmt1(out.kcal)}</td>
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

      {mealPickSlot ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            role="presentation"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMealPickSlot(null)}
          />
          <div
            role="dialog"
            aria-labelledby="meal-pick-title"
            className="relative w-full max-w-lg rounded-2xl border border-surface-border bg-surface-card p-5 shadow-2xl max-h-[min(90vh,720px)] overflow-y-auto"
          >
            <h3 id="meal-pick-title" className="text-base font-semibold text-ink-primary pr-8">
              Agregar a «{MEAL_SLOT_LABELS[mealPickSlot]}»
            </h3>
            <p className="text-xs text-ink-muted mt-1 mb-4 leading-relaxed">
              Elegí una fila de las tablas inferiores (valores por 100 g del plan) o un alimento de Mi lista, y la cantidad en
              gramos para este momento.
            </p>
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMealPickTab('plan')}
                className={cn(
                  'flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  mealPickTab === 'plan'
                    ? 'bg-brand-primary text-white'
                    : 'bg-surface-muted text-ink-secondary hover:bg-surface-border/80',
                )}
              >
                Tabla del plan
              </button>
              <button
                type="button"
                onClick={() => setMealPickTab('library')}
                className={cn(
                  'flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  mealPickTab === 'library'
                    ? 'bg-brand-primary text-white'
                    : 'bg-surface-muted text-ink-secondary hover:bg-surface-border/80',
                )}
              >
                Mi lista
              </button>
            </div>
            {mealPickTab === 'plan' ? (
              <div className="space-y-3">
                <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wide">Tabla</label>
                <select
                  className={selectPlanClasses}
                  value={mealPickSecKey}
                  onChange={(e) => setMealPickSecKey(e.target.value)}
                >
                  {wb.sections.map((sec) => (
                    <option key={sec.key} value={sec.key}>
                      {sec.title}
                    </option>
                  ))}
                </select>
                <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wide">Alimento</label>
                <select
                  className={selectPlanClasses}
                  value={mealPickRowId}
                  onChange={(e) => {
                    const id = e.target.value
                    setMealPickRowId(id)
                    const r = mealPickRows.find((x) => x.id === id)
                    setMealPickQty((r?.qtyG ?? '').trim())
                  }}
                >
                  {mealPickRows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
                  Gramos (este momento)
                </label>
                <Input
                  className="h-10"
                  inputMode="decimal"
                  value={mealPickQty}
                  onChange={(e) => setMealPickQty(e.target.value)}
                  placeholder="Ej. 120"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
                  Alimento de Mi lista
                </label>
                <select
                  className={selectPlanClasses}
                  value={mealPickLibId}
                  onChange={(e) => {
                    const id = e.target.value
                    setMealPickLibId(id)
                    setMealPickLibQty((wb.libraryQtyDraft?.[id] ?? '').trim())
                  }}
                >
                  {libraryFoods.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.display_name}
                    </option>
                  ))}
                </select>
                {libraryFoods.length === 0 ? (
                  <p className="text-xs text-ink-muted">
                    No hay ítems cargados.&nbsp;
                    <Link to="/nutrition/foods" className="text-brand-primary font-medium hover:underline">
                      Ir a la Guía
                    </Link>
                  </p>
                ) : null}
                <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
                  Gramos (este momento)
                </label>
                <Input
                  className="h-10"
                  inputMode="decimal"
                  value={mealPickLibQty}
                  onChange={(e) => setMealPickLibQty(e.target.value)}
                  placeholder="Ej. 80"
                />
              </div>
            )}
            <div className="space-y-2 pt-2 border-t border-surface-border/70">
              <label className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
                Referencia para el alumno (PDF)
              </label>
              <select
                className={selectPlanClasses}
                value={mealPickPreparation}
                onChange={(e) => setMealPickPreparation(e.target.value as MealPreparationChoice)}
              >
                <option value="infer">Automático según nombre y notas de la fila</option>
                <option value="crudo">Cantidad en crudo</option>
                <option value="cocido">Cantidad cocida</option>
              </select>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                El PDF muestra gramos y, cuando aplica, cucharadas orientativas; en carnes/pescado/huevo prioriza gramos y el tip de la fila (ej. churrasco en g), no cucharadas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end mt-6">
              <Button variant="secondary" type="button" onClick={() => setMealPickSlot(null)}>
                Cancelar
              </Button>
              <Button type="button" onClick={confirmMealPick}>
                Agregar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

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

      <ConfirmDialog
        open={!!applyTemplateTarget}
        onClose={() => setApplyTemplateTarget(null)}
        onConfirm={() => {
          const t = applyTemplateTarget
          if (!t) return
          const label = t.name
          replaceMealDistribution(t.mealDistribution)
          setApplyTemplateTarget(null)
          toast.success(`Se aplicó la plantilla «${label}».`)
        }}
        title="Aplicar plantilla"
        description={
          applyTemplateTarget
            ? `Se reemplaza la distribución del día (momentos, ítems y notas) por «${applyTemplateTarget.name}».`
            : ''
        }
        confirmLabel="Aplicar"
        variant="warning"
      />
    </div>
  )
}
