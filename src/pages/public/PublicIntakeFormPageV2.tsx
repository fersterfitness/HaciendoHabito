/**
 * /form — inscripción pública en cuatro pasos (plan → permiso → datos → confirmación).
 *
 * Usa siempre el tema de la v2 (el visitante no eligió versión): lienzo gris, tarjetas blancas,
 * acción principal en negro y flúor para lo confirmado. El plan elegido viaja en una barra flotante
 * y cada paso entra deslizándose en el sentido del avance.
 *
 * Los formularios de cada modalidad (IntakeFersterForm, IntakeNutritionForm, IntakeFullForm,
 * IntakePsychologistForm) no cambian su lógica: acá solo se decide qué se muestra y cuándo.
 */
import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, ClipboardList, Lock, Moon, ShieldCheck, Sparkles, Sun, Ticket, type LucideIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/contexts/ThemeContext'
import { IS_V2 } from '@/lib/uiVersion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { IntakeFersterForm } from '@/pages/public/IntakeFersterForm'
import { IntakeNutritionForm } from '@/pages/public/IntakeNutritionForm'
import { IntakeFullForm } from '@/pages/public/IntakeFullForm'
import { IntakePsychologistForm } from '@/pages/public/IntakePsychologistForm'
import { IntakePermissionsStep } from '@/components/public/IntakePermissionsStep'
import { IntakeBillingSwitch, IntakePlanIncludes, IntakePlanList } from '@/components/public/intake/IntakePlanPicker'
import { IntakeProAvatar, intakeProAvatarFocusForRole } from '@/components/public/intake/IntakeProAvatar'
import { buildTrainerContactWhatsAppUrl, TRAINER_CONTACT_WHATSAPP_DISPLAY } from '@/lib/trainerContact'
import { checkWebIntakeAccessStatus, readIntakeAccessSession } from '@/lib/intake/webIntakeAccess'
import { intakeBillingCaption, intakePlanTitle } from '@/lib/intake/intakePlanBilling'
import {
  type PlanBilling,
  bundlePrice3Months,
  bundlePrice6Months,
  effectiveYearlyLabel,
  formatArsRounded,
  numericFromPriceLabel,
  intakePlansToPricingPlans,
  inferWebPlanBundleCommitment,
  planVisibleForIntakeBilling,
} from '@/lib/publicIntakePlanPricing'
import { mergePublicIntakePlansFromDb, type PublicIntakePlanDetail } from '@/lib/publicIntakeCatalogOffers'
import {
  attachAvatarsToIncludeSectionViews,
  normalizeIncludeSections,
  type IntakeIncludeSectionAvatarMap,
} from '@/lib/webPlanIncludeSections'
import type { WebPlan, WebPlanCatalogSegment } from '@/types/database'
import { normalizeWebPlanCatalogSegment } from '@/lib/webPlansCatalogSegment'
import { compareBySegmentSortOrder } from '@/lib/webPlansSortOrder'
import {
  isCanonicalEntrenoNutricionPlan,
  isEntrenoPsicologoPlanTitle,
  WEB_PLAN_FULL_SUBCATEGORIES,
} from '@/lib/webPlanFullSubcategory'

type ModalityId = WebPlanCatalogSegment | 'psychologist'

/** Orden fijo en pantalla: integral → dual → individuales. */
const MODALITY_OPTIONS: { id: ModalityId; label: string; desc: string }[] = [
  { id: 'full_trio', label: 'Todo en un plan', desc: 'Los tres profesionales trabajando juntos' },
  { id: 'full', label: 'Servicio dual', desc: 'Dos profesionales en un mismo plan' },
  { id: 'solo', label: 'Entrenamiento', desc: 'Planes individuales de entrenamiento' },
  { id: 'with_nutritionist', label: 'Nutrición', desc: 'Planes individuales de nutrición' },
  { id: 'psychologist', label: 'Psicología deportiva', desc: 'Planes individuales con el psicólogo' },
]

const STEPS = [
  { id: 'plan', label: 'Plan' },
  { id: 'permissions', label: 'Permiso' },
  { id: 'form', label: 'Datos' },
  { id: 'confirmation', label: 'Listo' },
] as const

type StepId = (typeof STEPS)[number]['id']

type ProfKey = 'trainer' | 'nutritionist' | 'psychologist'
type TeamImages = Record<ProfKey, string | null>

const TEAM: { key: ProfKey; name: string; role: string; credential: string; tone: string }[] = [
  {
    key: 'trainer',
    name: 'Tomás Ferster',
    role: 'Entrenador',
    credential: 'Lic. en alto rendimiento · Prof. de educación física',
    tone: 'bg-pastel-butter',
  },
  {
    key: 'nutritionist',
    name: 'Cristian Crossetto',
    role: 'Nutricionista',
    credential: 'Lic. en nutrición · Especialización deportiva',
    tone: 'bg-pastel-lavender',
  },
  {
    key: 'psychologist',
    name: 'Santiago Rodríguez',
    role: 'Psicólogo',
    credential: 'Lic. en psicología (UBA) · Especialización deportiva',
    tone: 'bg-pastel-peach',
  },
]

const EASE = [0.16, 1, 0.3, 1] as const

const HOW_IT_WORKS = [
  { title: 'Elegís el plan', text: 'Modalidad y plazo de pago.' },
  { title: 'Coordinás con Tomás', text: 'Por WhatsApp, y te habilita.' },
  { title: 'Completás tus datos', text: 'Para armar tu plan a medida.' },
]

/** Cada paso entra desde el lado hacia el que se avanza y sale por el opuesto. */
const STEP_VARIANTS = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.36, ease: EASE } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -20, transition: { duration: 0.16, ease: 'easeIn' as const } }),
}

/* ─────────────────────── Precio según el plazo elegido ─────────────────────── */
function displayPriceForPlan(plan: PublicIntakePlanDetail, billing: PlanBilling): string {
  const commit = inferWebPlanBundleCommitment(plan.id, plan.name)
  const totalN = numericFromPriceLabel(plan.price)
  if (commit === 3 && totalN > 0) {
    const monthly = formatArsRounded(Math.round(totalN / 3))
    switch (billing) {
      case 'monthly': return monthly
      case 'months3': return plan.price
      case 'months6': return bundlePrice6Months(monthly)
      case 'annual':  return effectiveYearlyLabel(monthly, plan.priceYearly)
    }
  }
  if (commit === 6 && totalN > 0) {
    const monthly = formatArsRounded(Math.round(totalN / 6))
    switch (billing) {
      case 'monthly': return monthly
      case 'months3': return bundlePrice3Months(monthly)
      case 'months6': return plan.price
      case 'annual':  return effectiveYearlyLabel(monthly, plan.priceYearly)
    }
  }
  switch (billing) {
    case 'monthly': return plan.price
    case 'months3': return plan.price3mLabel?.trim() || bundlePrice3Months(plan.price)
    case 'months6': return plan.price6mLabel?.trim() || bundlePrice6Months(plan.price)
    case 'annual':  return effectiveYearlyLabel(plan.price, plan.priceYearly)
  }
}

/* ═════════════════════════════════════════════════════════════════════════
 * Página
 * ═════════════════════════════════════════════════════════════════════════ */
export function PublicIntakeFormPageV2() {
  const { theme, toggleTheme } = useTheme()

  const [plans, setPlans] = useState<PublicIntakePlanDetail[]>(() => mergePublicIntakePlansFromDb([]))
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [planBilling, setPlanBilling] = useState<PlanBilling>('monthly')
  const [catalogSegment, setCatalogSegment] = useState<ModalityId>('full_trio')
  const [step, setStep] = useState<StepId>('plan')
  /** 1 = se avanza, -1 = se vuelve: decide de qué lado entra el paso. */
  const [direction, setDirection] = useState(1)
  const [catalogImages, setCatalogImages] = useState<TeamImages>({ trainer: null, nutritionist: null, psychologist: null })
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [plansLoaded, setPlansLoaded] = useState(false)
  const isReady = imagesLoaded && plansLoaded

  // El visitante no eligió versión de interfaz: acá siempre va el tema nuevo.
  useLayoutEffect(() => {
    if (IS_V2) return
    const root = document.documentElement
    root.classList.add('ui-v2')
    return () => root.classList.remove('ui-v2')
  }, [])

  useEffect(() => {
    document.title = 'Inscripción · Haciéndolo Hábito'
  }, [])

  /* ─────────────── Fotos del equipo ─────────────── */
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase
        .from('web_intake_catalog_settings')
        .select('solo_segment_image_url, with_nutritionist_segment_image_url, cris_solo_segment_image_url, psychologist_segment_image_url')
        .eq('id', 1)
        .maybeSingle()
      if (!mounted) return
      if (data) {
        const str = (v: unknown): string | null => (typeof v === 'string' && v.trim()) ? v.trim() : null
        const d = data as Record<string, unknown>
        setCatalogImages({
          trainer:      str(d.solo_segment_image_url),
          nutritionist: str(d.cris_solo_segment_image_url) ?? str(d.with_nutritionist_segment_image_url),
          psychologist: str(d.psychologist_segment_image_url),
        })
      }
      setImagesLoaded(true)
    })()
    return () => { mounted = false }
  }, [])

  /* ─────────────── Planes ─────────────── */
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data, error } = await supabase
        .from('web_plans')
        .select(
          'slug, title, price_label, price_yearly_label, price_3m_label, price_6m_label, short_description, intro_text, includes_items, includes_sections, gifts_items, sort_order, is_active, show_in_public_intake, catalog_segment, display_badge, credential_line_override',
        )
        .eq('is_active', true)
        .eq('show_in_public_intake', true)
        .order('sort_order')
      if (!mounted) return
      // Si la consulta falla quedan los planes del catálogo base: la página igual se muestra.
      if (error) {
        setPlansLoaded(true)
        return
      }
      type Row = Pick<WebPlan, 'slug' | 'title' | 'price_label' | 'price_yearly_label' | 'price_3m_label' | 'price_6m_label' | 'short_description' | 'intro_text' | 'includes_items' | 'includes_sections' | 'gifts_items' | 'sort_order' | 'is_active' | 'catalog_segment' | 'display_badge' | 'credential_line_override'>
      const mapped: PublicIntakePlanDetail[] = ((data as Row[]) ?? []).map((row) => {
        const segment = normalizeWebPlanCatalogSegment(String(row.catalog_segment ?? 'solo'))
        const id = row.slug
        const badge = row.display_badge?.trim() || (id === 'plan-nutricion' ? 'Nutrición' : id === 'plan-full' ? 'Full' : 'Plan')
        return {
          id, catalogSegment: segment,
          displayBadge: row.display_badge ?? null,
          credentialLineOverride: row.credential_line_override ?? null,
          name: row.title,
          price: row.price_label,
          priceYearly: row.price_yearly_label ?? null,
          price3mLabel: row.price_3m_label ?? null,
          price6mLabel: row.price_6m_label ?? null,
          badge,
          shortDescription: row.short_description,
          intro: row.intro_text,
          info: row.includes_items ?? [],
          includeSections: normalizeIncludeSections(
            row.includes_sections,
            row.includes_items ?? [],
            segment,
          ),
          gifts: row.gifts_items ?? [],
          sortOrder: row.sort_order ?? 9999,
        }
      })
      setPlans(mergePublicIntakePlansFromDb(mapped))
      setPlansLoaded(true)
    })()
    return () => { mounted = false }
  }, [])

  /* ─────────────── Derivados ─────────────── */
  const plansVisible = useMemo(() => {
    return plans
      .filter((p) => {
        if (p.catalogSegment !== catalogSegment) return false
        const bundle = inferWebPlanBundleCommitment(p.id, p.name)
        return planVisibleForIntakeBilling(bundle, planBilling)
      })
      .sort(compareBySegmentSortOrder)
  }, [plans, catalogSegment, planBilling])

  useEffect(() => {
    if (plansVisible.length === 0) return
    const valid = selectedPlanId && plansVisible.some((p) => p.id === selectedPlanId)
    if (!valid) setSelectedPlanId(plansVisible[0]!.id)
  }, [plansVisible, selectedPlanId])

  const selectedPlan = useMemo(
    () => (selectedPlanId ? plans.find((p) => p.id === selectedPlanId) ?? null : null),
    [plans, selectedPlanId],
  )
  /** El plan elegido solo cuenta si está entre los que se ven con la modalidad y el plazo actuales. */
  const selectedVisible = Boolean(selectedPlan && plansVisible.some((p) => p.id === selectedPlan.id))

  const avatars = useMemo<IntakeIncludeSectionAvatarMap>(
    () => ({
      trainer: { avatarUrl: catalogImages.trainer, subtitle: 'Tomás Ferster' },
      nutritionist: { avatarUrl: catalogImages.nutritionist, subtitle: 'Cristian Crossetto' },
      psychologist: { avatarUrl: catalogImages.psychologist, subtitle: 'Santiago Rodríguez' },
    }),
    [catalogImages],
  )

  /** En «Servicio dual» los planes se agrupan por la pareja de profesionales. */
  const planGroups = useMemo(() => {
    if (catalogSegment !== 'full') return [{ key: 'all', label: null as string | null, plans: plansVisible }]
    return WEB_PLAN_FULL_SUBCATEGORIES.map((sub) => ({
      key: sub.key as string,
      label: sub.label as string | null,
      plans: plansVisible.filter((p) =>
        sub.key === 'entreno_nutricion' ? isCanonicalEntrenoNutricionPlan(p.id, p.name) : isEntrenoPsicologoPlanTitle(p.name),
      ),
    })).filter((g) => g.plans.length > 0)
  }, [catalogSegment, plansVisible])

  const intakeKind =
    catalogSegment === 'psychologist'
      ? 'psychologist'
      : catalogSegment === 'with_nutritionist'
        ? 'nutricion'
        : catalogSegment === 'full' || catalogSegment === 'full_trio'
          ? 'full'
          : 'entrenamiento'
  const stepIndex = STEPS.findIndex((s) => s.id === step)
  const selectedPrice = selectedPlan ? displayPriceForPlan(selectedPlan, planBilling) : null

  function go(next: StepId) {
    setDirection(STEPS.findIndex((s) => s.id === next) >= stepIndex ? 1 : -1)
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goToPermisos() {
    go(selectedPlanId ? 'permissions' : 'plan')
  }

  async function goToDatos() {
    if (!selectedPlanId) {
      go('plan')
      return
    }
    const session = readIntakeAccessSession()
    if (!session?.token || session.planSlug !== selectedPlanId) {
      go('permissions')
      return
    }
    const check = await checkWebIntakeAccessStatus(session.token)
    if (!check.ok || check.status !== 'approved') {
      toast.error(
        check.ok && check.status === 'pending'
          ? 'Tu acceso aún no fue aprobado. Coordiná el pago por WhatsApp.'
          : check.ok
            ? 'El acceso no fue aprobado.'
            : check.error,
      )
      go('permissions')
      return
    }
    go('form')
  }

  function jumpTo(id: StepId) {
    if (id === step || step === 'confirmation' || id === 'confirmation') return
    if (id === 'plan') go('plan')
    else if (id === 'permissions') goToPermisos()
    else void goToDatos()
  }

  const intakeAccessToken = readIntakeAccessSession()?.token ?? null
  const trainerWaUrl = buildTrainerContactWhatsAppUrl()

  /** Sin permiso aprobado no puede quedar en paso Datos (ni saltarse Permisos). */
  useEffect(() => {
    if (step !== 'form' || !selectedPlanId) return
    let cancelled = false
    ;(async () => {
      const session = readIntakeAccessSession()
      if (!session?.token || session.planSlug !== selectedPlanId) {
        if (!cancelled) setStep('permissions')
        return
      }
      const check = await checkWebIntakeAccessStatus(session.token)
      if (cancelled) return
      if (!check.ok || check.status !== 'approved') setStep('permissions')
    })()
    return () => {
      cancelled = true
    }
  }, [step, selectedPlanId])

  const formProps = {
    selectedPlanSlug: selectedPlanId,
    selectedPlanLabel: selectedPlan?.name ?? null,
    selectedPlanPrice: selectedPrice,
    selectedPlanBilling: planBilling,
    intakeAccessToken,
    onSuccess: () => go('confirmation'),
    compact: true,
  }

  const showPlanBar = isReady && step === 'plan' && selectedVisible
  const selectedPricing = useMemo(
    () => (selectedPlan && selectedVisible ? intakePlansToPricingPlans([selectedPlan])[0] ?? null : null),
    [selectedPlan, selectedVisible],
  )
  const activeModality = MODALITY_OPTIONS.find((m) => m.id === catalogSegment)
  const summary = (
    <PlanSummary plan={selectedPlan} price={selectedPrice} billing={planBilling} avatars={avatars} theme={theme} onChangePlan={() => go('plan')} />
  )

  return (
    <MotionConfig reducedMotion="user">
      <div className="hh-intake flex min-h-screen flex-col bg-[rgb(var(--v2-canvas))] text-ink-primary">
        {/* ═══════════ Encabezado: marca, pasos y accesos ═══════════ */}
        <header className="sticky top-0 z-30 border-b border-surface-border bg-surface-base/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 px-4 py-2 lg:px-6">
            <Link to="/form" className="hh-focus flex min-h-11 items-center gap-2.5 rounded-lg" onClick={() => go('plan')}>
              <img src="/app-icon.svg" alt="" className="h-8 w-8 rounded-lg" />
              <span className="hidden text-base font-semibold tracking-tight lg:inline">Haciéndolo Hábito</span>
            </Link>

            <div className="order-last w-full pb-1 md:order-none md:w-auto md:flex-1 md:pb-0">
              <StepRail currentIndex={stepIndex} locked={step === 'confirmation'} onJump={jumpTo} />
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <a
                href={trainerWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`WhatsApp · ${TRAINER_CONTACT_WHATSAPP_DISPLAY}`}
                aria-label="Escribir por WhatsApp"
                className="hh-focus flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-surface-elevated hover:text-ink-primary"
              >
                <WhatsAppIcon className="h-[18px] w-[18px]" />
              </a>
              <button
                type="button"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                className="hh-focus flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-surface-elevated hover:text-ink-primary"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Link
                to="/login"
                className="hh-focus ml-1 inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-surface-elevated px-3 text-body-sm font-medium text-ink-primary transition-colors hover:bg-surface-border"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </header>

        <main className={cn('mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-6 lg:py-10', showPlanBar && 'pb-28 lg:pb-10')}>
          {!isReady ? (
            <LoadingSkeleton />
          ) : (
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div key={step} custom={direction} variants={STEP_VARIANTS} initial="enter" animate="center" exit="exit">
                {/* ─────────── Paso 1: plan ─────────── */}
                {step === 'plan' && (
                  <Panel>
                    <PanelHeader
                      icon={Ticket}
                      title="Elegí tu plan"
                      text="Elegí con quién querés trabajar y cómo pagarlo. Después coordinás con Tomás y completás tus datos."
                      aside={<TeamStack images={catalogImages} theme={theme} />}
                    />

                    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-10">
                      {/* Izquierda: modalidad, plazo y lista de planes */}
                      <div className="min-w-0">
                        <ModalityTabs value={catalogSegment} onChange={setCatalogSegment} />
                        <div className="mb-3 mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <h2 className="text-lg font-medium leading-tight tracking-[-0.01em]">Planes</h2>
                            {activeModality ? <p className="hidden text-body-sm text-ink-muted xl:block">{activeModality.desc}</p> : null}
                          </div>
                          <div className="shrink-0">
                            <IntakeBillingSwitch value={planBilling} onChange={setPlanBilling} />
                          </div>
                        </div>

                        <AnimatePresence mode="wait" initial={false}>
                          <motion.div
                            key={catalogSegment}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.12 }}
                            className="space-y-5"
                          >
                            {plansVisible.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-surface-inputBorder px-5 py-10 text-center">
                                <Sparkles className="mx-auto mb-2 h-5 w-5 text-ink-muted" aria-hidden />
                                <p className="text-sm text-ink-secondary">No hay planes con este plazo en esta modalidad.</p>
                                <p className="mt-1 text-body-sm text-ink-muted">Probá con otro plazo de pago o con otra modalidad.</p>
                              </div>
                            ) : (
                              planGroups.map((group) => (
                                <div key={group.key}>
                                  {group.label ? <p className="mb-2 text-body-sm text-ink-muted">{group.label}</p> : null}
                                  <IntakePlanList
                                    plans={intakePlansToPricingPlans(group.plans)}
                                    selectedPlanId={selectedPlanId}
                                    onSelect={setSelectedPlanId}
                                    billing={planBilling}
                                    renderMobileDetails={(plan) => <IntakePlanIncludes plan={plan} avatars={avatars} theme={theme} />}
                                  />
                                </div>
                              ))
                            )}
                          </motion.div>
                        </AnimatePresence>

                        <ol className="mt-6 grid gap-3 border-t border-surface-border pt-5 sm:grid-cols-3">
                          {HOW_IT_WORKS.map((h, i) => (
                            <li key={h.title} className="flex gap-2.5">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-3xs font-medium tabular-nums text-ink-secondary">
                                {i + 1}
                              </span>
                              <span className="min-w-0 text-body-sm leading-snug">
                                <span className="block font-medium text-ink-primary">{h.title}</span>
                                <span className="text-ink-muted">{h.text}</span>
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* Derecha: el plan elegido en detalle y el botón para seguir */}
                      <aside className="hidden lg:block">
                        <div className="sticky top-20 rounded-2xl border border-surface-border bg-surface-panel p-6">
                          {selectedPricing ? (
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.div
                                key={selectedPricing.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.2, ease: EASE }}
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <h2 className="text-xl font-medium tracking-[-0.02em]">{intakePlanTitle(selectedPricing.name)}</h2>
                                  {selectedPricing.badge?.trim() ? (
                                    <span className="hh-pastel rounded-md bg-pastel-butter px-2 py-0.5 text-2xs font-medium text-pastel-butter-ink">
                                      {intakePlanTitle(selectedPricing.badge)}
                                    </span>
                                  ) : null}
                                </div>
                                {selectedPricing.description?.trim() ? (
                                  <p className="mt-1 text-body-sm leading-snug text-ink-muted">{selectedPricing.description.trim()}</p>
                                ) : null}
                                <p className="mt-4 flex items-baseline gap-2">
                                  <span className="text-4xl font-semibold tabular-nums tracking-[-0.03em]">{selectedPrice}</span>
                                  <span className="text-body-sm text-ink-muted">{intakeBillingCaption(planBilling)}</span>
                                </p>

                                <Button type="button" size="lg" className="mt-5 w-full" onClick={goToPermisos}>
                                  Continuar con este plan
                                  <ArrowRight className="h-4 w-4" aria-hidden />
                                </Button>
                                <p className="mt-2 text-center text-2xs text-ink-muted">Cancelás cuando quieras.</p>

                                <div className="mt-5 border-t border-surface-border pt-5">
                                  <p className="mb-4 text-2xs font-medium text-ink-muted">Qué incluye</p>
                                  <IntakePlanIncludes plan={selectedPricing} avatars={avatars} theme={theme} />
                                </div>
                              </motion.div>
                            </AnimatePresence>
                          ) : (
                            <p className="py-10 text-center text-body-sm text-ink-muted">Elegí un plan de la lista para ver el detalle.</p>
                          )}
                        </div>
                      </aside>
                    </div>
                  </Panel>
                )}

                {/* ─────────── Paso 2: permiso ─────────── */}
                {step === 'permissions' && selectedPlan && (
                  <Panel>
                    <PanelHeader
                      icon={ShieldCheck}
                      title="Coordiná con Tomás"
                      text="Tomás confirma tu pago y te habilita el formulario. Podés salir y volver cuando quieras: el permiso queda guardado."
                    />
                    <StepColumns aside={summary}>
                      <IntakePermissionsStep
                        planSlug={selectedPlanId!}
                        planName={selectedPlan.name}
                        onBack={() => go('plan')}
                        onApproved={() => go('form')}
                      />
                    </StepColumns>
                  </Panel>
                )}

                {/* ─────────── Paso 3: datos ─────────── */}
                {step === 'form' && (
                  <Panel>
                    <PanelHeader
                      icon={ClipboardList}
                      back={() => go('permissions')}
                      title="Contanos de vos"
                      text={
                        <span className="inline-flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Confidencial: solo lo ve el profesional que te acompaña.
                        </span>
                      }
                    />
                    <StepColumns aside={summary}>
                      {intakeKind === 'nutricion' ? (
                        <IntakeNutritionForm {...formProps} />
                      ) : intakeKind === 'full' ? (
                        <IntakeFullForm {...formProps} />
                      ) : intakeKind === 'psychologist' ? (
                        <IntakePsychologistForm {...formProps} />
                      ) : (
                        <IntakeFersterForm {...formProps} />
                      )}
                    </StepColumns>
                  </Panel>
                )}

                {/* ─────────── Paso 4: confirmación ─────────── */}
                {step === 'confirmation' && <ConfirmationView planName={selectedPlan?.name ?? null} onAgain={() => go('plan')} />}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        <footer className="border-t border-surface-border">
          <p className="mx-auto w-full max-w-6xl px-4 py-5 text-2xs text-ink-muted lg:px-6">
            © {new Date().getFullYear()} Ferster Fitness · Haciéndolo Hábito
          </p>
        </footer>

        {/* ═══════════ Barra flotante: el plan elegido y el botón para seguir ═══════════ */}
        <AnimatePresence>
          {showPlanBar && selectedPlan ? (
            <motion.div
              key="plan-bar"
              initial={{ y: 96, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3 lg:hidden"
            >
              <div className="pointer-events-auto mx-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl bg-ink-primary py-2.5 pl-4 pr-2.5 text-surface-base shadow-[0_18px_40px_-16px_rgb(0_0_0/0.55)]">
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="text-2xs opacity-65">Tu plan</p>
                  <p className="truncate text-sm font-medium">{intakePlanTitle(selectedPlan.name)}</p>
                </div>
                <div className="shrink-0 text-right leading-tight">
                  <p className="text-base font-semibold tabular-nums">{selectedPrice}</p>
                  <p className="hidden text-2xs opacity-65 sm:block">{intakeBillingCaption(planBilling)}</p>
                </div>
                <button
                  type="button"
                  onClick={goToPermisos}
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-status-ok px-4 text-sm font-semibold text-black transition-transform active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-ok"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}

/* ─────────────────────── Piezas de la página ─────────────────────── */

/** La hoja blanca donde vive cada paso. */
function Panel({ children }: { children: ReactNode }) {
  return <section className="rounded-3xl border border-surface-border bg-surface-card p-5 sm:p-8">{children}</section>
}

/** Cabecera de un paso: ícono en un círculo pastel (o el botón de volver), título y una línea de contexto. */
function PanelHeader({
  icon: Icon,
  title,
  text,
  aside,
  back,
}: {
  icon: LucideIcon
  title: string
  text: ReactNode
  aside?: ReactNode
  back?: () => void
}) {
  return (
    <header className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-4 border-b border-surface-border pb-6 sm:mb-8">
      {back ? (
        <button
          type="button"
          onClick={back}
          aria-label="Volver al paso anterior"
          className="hh-focus flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-ink-secondary transition-colors hover:bg-surface-border hover:text-ink-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      ) : (
        <span className="hh-pastel flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pastel-mint text-pastel-mint-ink" aria-hidden>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
      )}
      <div className="min-w-0 flex-1 basis-64">
        <h1 className="text-2xl font-medium leading-tight tracking-[-0.02em]">{title}</h1>
        <p className="mt-1 text-sm text-ink-secondary">{text}</p>
      </div>
      {aside}
    </header>
  )
}

/** Contenido a la izquierda y el resumen del plan a la derecha (arriba en el celu). */
function StepColumns({ children, aside }: { children: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-10">
      <aside className="lg:order-last">
        <div className="lg:sticky lg:top-20">{aside}</div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Los cuatro pasos en el encabezado. Se puede volver a uno anterior; avanzar pasa por las validaciones. */
function StepRail({
  currentIndex,
  locked,
  onJump,
}: {
  currentIndex: number
  locked: boolean
  onJump: (id: StepId) => void
}) {
  return (
    <nav aria-label="Pasos de la inscripción">
      <ol className="flex items-center md:justify-center">
        {STEPS.map((s, i) => {
          const done = i < currentIndex || locked
          const active = i === currentIndex
          const last = i === STEPS.length - 1
          return (
            <li key={s.id} className={cn('flex items-center', !last && 'flex-1 md:flex-none')}>
              <button
                type="button"
                onClick={() => onJump(s.id)}
                disabled={locked || last}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'hh-focus relative flex h-9 items-center gap-2 rounded-lg px-2 text-body-sm font-medium transition-colors',
                  active ? 'text-ink-primary' : done ? 'text-ink-secondary' : 'text-ink-muted',
                  !locked && !last && !active && 'hover:text-ink-primary',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="hh-intake-step"
                    className="absolute inset-0 rounded-lg bg-surface-elevated"
                    transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                    aria-hidden
                  />
                ) : null}
                <span
                  className={cn(
                    'relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-3xs font-semibold tabular-nums transition-colors duration-300',
                    done
                      ? 'bg-status-ok text-black'
                      : active
                        ? 'bg-ink-primary text-surface-base'
                        : 'bg-surface-elevated text-ink-muted',
                  )}
                >
                  {done ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : i + 1}
                </span>
                <span className={cn('relative', !active && 'hidden sm:inline')}>{s.label}</span>
              </button>
              {!last ? (
                <span className="relative mx-1 h-px flex-1 overflow-hidden bg-surface-border md:w-8 md:flex-none" aria-hidden>
                  <motion.span
                    className="absolute inset-0 origin-left bg-ink-primary"
                    initial={false}
                    animate={{ scaleX: i < currentIndex || locked ? 1 : 0 }}
                    transition={{ duration: 0.4, ease: EASE }}
                  />
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** El equipo, discreto: tres fotos chicas encimadas y los nombres al lado. */
function TeamStack({ images, theme }: { images: TeamImages; theme: 'light' | 'dark' }) {
  return (
    <div className="flex items-center gap-3" aria-label="El equipo">
      <span className="flex -space-x-2">
        {TEAM.map((p, i) => (
          <motion.span
            key={p.key}
            title={`${p.name} · ${p.role}`}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.1 + i * 0.06 }}
            className="rounded-full ring-2 ring-surface-card"
          >
            <IntakeProAvatar
              label={p.name}
              url={images[p.key]}
              sizeClass="h-9 w-9"
              theme={theme}
              shape="circle"
              focus={intakeProAvatarFocusForRole(p.key)}
              priority
              expandable
              noRing
            />
          </motion.span>
        ))}
      </span>
      <p className="text-body-sm leading-tight">
        <span className="block font-medium text-ink-primary">Tomás, Cristian y Santiago</span>
        <span className="text-ink-muted">Entrenador, nutricionista y psicólogo</span>
      </p>
    </div>
  )
}

/** Modalidades como pestañas: la línea de abajo se desliza a la elegida. */
function ModalityTabs({ value, onChange }: { value: ModalityId; onChange: (id: ModalityId) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Modalidad"
      className="-mx-5 flex gap-1 overflow-x-auto border-b border-surface-border px-5 scrollbar-hide sm:mx-0 sm:px-0"
    >
      {MODALITY_OPTIONS.map((m) => {
        const active = value === m.id
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.id)}
            className={cn(
              'hh-focus relative flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg px-3 text-sm transition-colors',
              active ? 'font-medium text-ink-primary' : 'text-ink-muted hover:text-ink-primary',
            )}
          >
            {m.label}
            {active ? (
              <motion.span
                layoutId="hh-intake-modality-line"
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ink-primary"
                transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                aria-hidden
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/** Resumen del plan elegido: acompaña los pasos de permiso y datos. */
function PlanSummary({
  plan,
  price,
  billing,
  avatars,
  theme,
  onChangePlan,
}: {
  plan: PublicIntakePlanDetail | null
  price: string | null
  billing: PlanBilling
  avatars: IntakeIncludeSectionAvatarMap
  theme: 'light' | 'dark'
  onChangePlan: () => void
}) {
  const pricing = useMemo(() => (plan ? intakePlansToPricingPlans([plan])[0] ?? null : null), [plan])
  if (!plan || !pricing) return null
  const sections = attachAvatarsToIncludeSectionViews(pricing.featureSections ?? [], avatars)
  const features = pricing.features.slice(0, 5)
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-panel p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-medium text-ink-muted">Tu plan</p>
          <p className="mt-0.5 text-lg font-medium leading-tight tracking-[-0.01em]">{intakePlanTitle(plan.name)}</p>
        </div>
        <Button type="button" variant="soft" size="sm" onClick={onChangePlan}>
          Cambiar
        </Button>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-2xl font-semibold tabular-nums tracking-[-0.03em]">{price}</p>
        <p className="text-2xs text-ink-muted">{intakeBillingCaption(billing)}</p>
      </div>

      {sections.length > 0 ? (
        <ul className="mt-4 hidden space-y-2.5 border-t border-surface-border pt-4 lg:block">
          {sections.map((s) => (
            <li key={s.professional} className="flex items-center gap-2.5">
              <IntakeProAvatar
                label={s.title}
                url={s.avatarUrl ?? null}
                sizeClass="h-8 w-8"
                theme={theme}
                focus={intakeProAvatarFocusForRole(s.professional)}
              />
              <div className="min-w-0">
                <p className="truncate text-body-sm font-medium leading-tight">{s.subtitle?.trim() || s.title}</p>
                <p className="text-2xs text-ink-muted">
                  {s.title} · {s.items.length} {s.items.length === 1 ? 'servicio' : 'servicios'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : features.length > 0 ? (
        <ul className="mt-4 hidden space-y-1.5 border-t border-surface-border pt-4 lg:block">
          {features.map((f) => (
            <li key={f.text} className="flex items-start gap-2 text-body-sm leading-snug text-ink-secondary">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={2.5} aria-hidden />
              {f.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

const NEXT_STEPS = [
  { title: 'Recibimos tu inscripción', text: 'Tus datos ya le llegaron al equipo.', done: true },
  { title: 'El equipo revisa tus datos', text: 'Con eso arman tu plan a medida.', done: false },
  { title: 'Te escriben para arrancar', text: 'Por WhatsApp o por mail, a la brevedad.', done: false },
]

function ConfirmationView({ planName, onAgain }: { planName: string | null; onAgain: () => void }) {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate([45, 35, 45])
  }, [])

  return (
    <div className="mx-auto w-full max-w-xl py-4 sm:py-10" role="status" aria-live="polite">
      <div className="rounded-2xl border border-surface-border bg-surface-card p-6 sm:p-8">
        <div className="relative mb-5 h-14 w-14">
          <motion.span
            className="absolute inset-0 rounded-full bg-status-ok"
            initial={{ scale: 0.9, opacity: 0.55 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
            aria-hidden
          />
          <motion.span
            className="relative flex h-full w-full items-center justify-center rounded-full bg-status-ok text-black"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 20 }}
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.38, ease: 'easeOut', delay: 0.22 }}
              />
            </svg>
          </motion.span>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: 0.18 }}>
          <h1 className="text-3xl font-semibold leading-tight tracking-[-0.03em]">¡Listo, recibimos tus datos!</h1>
          <p className="mt-2 text-base leading-relaxed text-ink-secondary">
            {planName ? (
              <>
                Tu inscripción a <span className="font-semibold text-ink-primary">{planName}</span> quedó registrada.
              </>
            ) : (
              'Tu inscripción quedó registrada.'
            )}{' '}
            El equipo de Haciéndolo Hábito se va a comunicar con vos a la brevedad.
          </p>
        </motion.div>

        <ol className="mt-6 border-t border-surface-border pt-2">
          {NEXT_STEPS.map((s, i) => (
            <motion.li
              key={s.title}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.36, ease: EASE, delay: 0.32 + i * 0.09 }}
              className="flex items-start gap-3 py-3"
            >
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-semibold tabular-nums',
                  s.done ? 'bg-status-ok text-black' : 'bg-surface-elevated text-ink-secondary',
                )}
              >
                {s.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              <div>
                <p className="text-sm font-medium leading-tight">{s.title}</p>
                <p className="mt-0.5 text-body-sm text-ink-muted">{s.text}</p>
              </div>
            </motion.li>
          ))}
        </ol>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button asChild size="lg">
            <Link to="/login">
              Ir al login
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button type="button" variant="soft" size="lg" onClick={onAgain}>
            Hacer otra inscripción
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Mientras cargan planes y fotos: la silueta del panel, no un logo latiendo. */
function LoadingSkeleton() {
  const block = 'animate-pulse rounded-xl bg-surface-elevated'
  return (
    <Panel>
      <div role="status" aria-label="Cargando planes">
        <div className="mb-8 flex items-center gap-4 border-b border-surface-border pb-6">
          <div className={cn(block, 'h-12 w-12 rounded-full')} />
          <div className="flex-1 space-y-2">
            <div className={cn(block, 'h-6 w-48')} />
            <div className={cn(block, 'h-4 w-full max-w-md')} />
          </div>
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-10">
          <div className="space-y-4">
            <div className={cn(block, 'h-10')} />
            <div className={cn(block, 'h-56 rounded-2xl')} />
          </div>
          <div className={cn(block, 'hidden h-80 rounded-2xl lg:block')} />
        </div>
      </div>
    </Panel>
  )
}
