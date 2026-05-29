/**
 * /v2/form — V2 modernizado en estilo dashboard claro.
 *
 * Inspirado en interfaces tipo Hotelio / app de cashier: fondo cream neutro,
 * cards blancas con sombras suaves, stepper horizontal arriba, sidebar de
 * resumen del plan a la derecha, CTAs naranjas brand-primary.
 *
 * Reutiliza componentes del form original sin tocarlos (IntakeFersterForm,
 * IntakeNutritionForm, IntakeFullForm, IntakeChangeablePlansSection).
 */
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, ArrowLeft, Check, CheckCircle2, Sparkles,
  Calendar, Users, Moon, Sun,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/contexts/ThemeContext'
import { BrandLogo } from '@/components/branding/BrandLogo'
import { cn } from '@/lib/utils'
import { IntakeFersterForm } from '@/pages/public/IntakeFersterForm'
import { IntakeNutritionForm } from '@/pages/public/IntakeNutritionForm'
import { IntakeFullForm } from '@/pages/public/IntakeFullForm'
import { IntakeChangeablePlansSection } from '@/components/public/IntakeChangeablePlansSection'
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
import {
  mergePublicIntakePlansFromDb,
  type PublicIntakePlanDetail,
} from '@/lib/publicIntakeCatalogOffers'
import type { WebPlan, WebPlanCatalogSegment } from '@/types/database'

const MODALITY_OPTIONS: { segment: WebPlanCatalogSegment; short: string; label: string; desc: string }[] = [
  { segment: 'solo',              short: 'Entrenamiento', label: 'Ferster Fitness',  desc: 'Plan de entrenamiento personalizado' },
  { segment: 'with_nutritionist', short: 'Nutrición',     label: 'Con nutricionista', desc: 'Acompañamiento nutricional individual' },
  { segment: 'full',              short: 'Full',          label: 'Entreno + Nutrición', desc: 'Plan integral de transformación' },
]

const STEPS = [
  { id: 'plan',         label: 'Plan',         icon3d: '/icons/3dicons/kpi/routines.png' },
  { id: 'form',         label: 'Datos',        icon3d: '/icons/3dicons/kpi/anthropometry-pdf.png' },
  { id: 'confirmation', label: 'Confirmación', icon3d: '/icons/3dicons/kpi/patients.png' },
] as const

type StepId = typeof STEPS[number]['id']

/* ─────────────────────── Helpers de pricing ─────────────────────── */
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

function planBillingCaption(billing: PlanBilling): string {
  switch (billing) {
    case 'monthly': return 'Por mes'
    case 'months3': return 'Total · 3 meses'
    case 'months6': return 'Total · 6 meses'
    case 'annual':  return 'Por año · pago único'
  }
}

/* ═════════════════════════════════════════════════════════════════════════
 * Componente principal
 * ═════════════════════════════════════════════════════════════════════════ */
export function PublicIntakeFormPageV2() {
  // Respeta dark/light mode del global — no fuerza ningún tema
  const { theme, toggleTheme } = useTheme()

  const [plans, setPlans] = useState<PublicIntakePlanDetail[]>(() => mergePublicIntakePlansFromDb([]))
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [planBilling, setPlanBilling] = useState<PlanBilling>('monthly')
  const [catalogSegment, setCatalogSegment] = useState<WebPlanCatalogSegment>('solo')
  const [step, setStep] = useState<StepId>('plan')
  const [catalogImages, setCatalogImages] = useState<{
    trainer: string | null
    nutritionist: string | null
    psychologist: string | null
  }>({ trainer: null, nutritionist: null, psychologist: null })
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [plansLoaded, setPlansLoaded] = useState(false)
  const isReady = imagesLoaded && plansLoaded

  /* ─────────────── Fetch de imágenes del equipo ─────────────── */
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

  /* ─────────────── Fetch de planes ─────────────── */
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data, error } = await supabase
        .from('web_plans')
        .select(
          'slug, title, price_label, price_yearly_label, price_3m_label, price_6m_label, short_description, intro_text, includes_items, gifts_items, sort_order, is_active, show_in_public_intake, catalog_segment, display_badge, credential_line_override',
        )
        .eq('is_active', true)
        .eq('show_in_public_intake', true)
        .order('sort_order')
      if (!mounted || error) return
      type Row = Pick<WebPlan, 'slug' | 'title' | 'price_label' | 'price_yearly_label' | 'price_3m_label' | 'price_6m_label' | 'short_description' | 'intro_text' | 'includes_items' | 'gifts_items' | 'sort_order' | 'is_active' | 'catalog_segment' | 'display_badge' | 'credential_line_override'>
      const mapped: PublicIntakePlanDetail[] = ((data as Row[]) ?? []).map((row) => {
        const rawSeg = String(row.catalog_segment ?? 'solo')
        const segment: WebPlanCatalogSegment =
          rawSeg === 'with_nutritionist' || rawSeg === 'with_cris' ? 'with_nutritionist'
          : rawSeg === 'full' ? 'full' : 'solo'
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
          gifts: row.gifts_items ?? [],
        }
      })
      mapped.sort((a, b) => {
        const da = numericFromPriceLabel(a.price)
        const db = numericFromPriceLabel(b.price)
        if (da !== db) return da - db
        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
      })
      if (mounted) {
        setPlans(mergePublicIntakePlansFromDb(mapped))
        setPlansLoaded(true)
      }
    })()
    return () => { mounted = false }
  }, [])

  /* ─────────────── Derivados ─────────────── */
  const plansVisible = useMemo(() => plans.filter((p) => {
    if (p.catalogSegment !== catalogSegment) return false
    const bundle = inferWebPlanBundleCommitment(p.id, p.name)
    return planVisibleForIntakeBilling(bundle, planBilling)
  }), [plans, catalogSegment, planBilling])

  useEffect(() => {
    if (plansVisible.length === 0) return
    const valid = selectedPlanId && plansVisible.some((p) => p.id === selectedPlanId)
    if (!valid) setSelectedPlanId(plansVisible[0]!.id)
  }, [plansVisible, selectedPlanId])

  const selectedPlan = useMemo(
    () => (selectedPlanId ? plans.find((p) => p.id === selectedPlanId) ?? null : null),
    [plans, selectedPlanId],
  )
  const intakeKind = catalogSegment === 'with_nutritionist' ? 'nutricion' : catalogSegment === 'full' ? 'full' : 'entrenamiento'
  const stepIndex = STEPS.findIndex((s) => s.id === step)

  if (!isReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-stone-100 dark:bg-zinc-950">
        <img
          src="/logo_mark_original_white_transparent.png"
          alt="Haciéndolo Hábito"
          className="v2f-splash-logo h-24 w-24 object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)] dark:drop-shadow-[0_8px_32px_rgba(0,0,0,0.6)] sm:h-32 sm:w-32"
          draggable={false}
        />
        <div className="flex gap-1.5">
          <span className="v2f-dot h-2 w-2 rounded-full bg-brand-primary/60" style={{ animationDelay: '0ms' }} />
          <span className="v2f-dot h-2 w-2 rounded-full bg-brand-primary/60" style={{ animationDelay: '160ms' }} />
          <span className="v2f-dot h-2 w-2 rounded-full bg-brand-primary/60" style={{ animationDelay: '320ms' }} />
        </div>
        <style>{`
          @keyframes v2f-logo-pulse { 0%,100% { opacity:1; transform: scale(1) } 50% { opacity:0.7; transform: scale(0.94) } }
          @keyframes v2f-dot-bounce { 0%,80%,100% { transform: translateY(0); opacity:0.4 } 40% { transform: translateY(-6px); opacity:1 } }
          .v2f-splash-logo { animation: v2f-logo-pulse 2s ease-in-out infinite }
          .v2f-dot { animation: v2f-dot-bounce 1.2s ease-in-out infinite }
        `}</style>
      </div>
    )
  }

  return (
    <div className="v2form-root relative min-h-screen bg-stone-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Fondo radial sutil solo en dark */}
      <div className="pointer-events-none fixed inset-0 hidden dark:block" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-brand-primary/[0.04] blur-[120px]" />
      </div>
      {/* Estilos locales scoped */}
      <style>{`
        @keyframes v2f-fade-up { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes v2f-slide-in { from { opacity: 0; transform: translateX(20px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes v2f-drop-in { from { opacity: 0; transform: translateY(-28px) } to { opacity: 1; transform: translateY(0) } }
        .v2f-fade-up { opacity: 0; animation: v2f-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards }
        .v2f-slide { opacity: 0; animation: v2f-slide-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards }
        .v2f-drop { opacity: 0; animation: v2f-drop-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards }
        .v2f-d1 { animation-delay: 60ms }
        .v2f-d2 { animation-delay: 140ms }
        .v2f-d3 { animation-delay: 220ms }
        .v2f-d4 { animation-delay: 300ms }
        .v2f-d5 { animation-delay: 380ms }

        /* Card moderna con hover lift sutil */
        .v2f-card {
          transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .v2f-card-hover:hover {
          transform: translateY(-2px);
        }

        /* Animaciones team cards */
        @keyframes v2f-pulse-ring {
          0% { box-shadow: 0 0 0 0 rgb(var(--brand-primary) / 0.45) }
          70% { box-shadow: 0 0 0 12px rgb(var(--brand-primary) / 0) }
          100% { box-shadow: 0 0 0 0 rgb(var(--brand-primary) / 0) }
        }
        @keyframes v2f-team-in {
          from { opacity: 0; transform: translateY(20px) scale(0.96) }
          to { opacity: 1; transform: translateY(0) scale(1) }
        }
        .v2f-team-card {
          opacity: 0;
          animation: v2f-team-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease, border-color 0.25s ease;
        }
        .v2f-team-card:nth-child(1) { animation-delay: 100ms }
        .v2f-team-card:nth-child(2) { animation-delay: 220ms }
        .v2f-team-card:nth-child(3) { animation-delay: 340ms }
        .v2f-team-card:hover { transform: translateY(-4px) }
        .v2f-team-card:hover .v2f-team-avatar { transform: scale(1.06) }
        .v2f-team-avatar {
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .v2f-team-avatar-pulse {
          animation: v2f-pulse-ring 2.4s ease-out infinite;
        }

        /* Glow naranja en focus de inputs */
        .v2f-shell input:focus,
        .v2f-shell input:focus-visible,
        .v2f-shell select:focus,
        .v2f-shell textarea:focus {
          box-shadow: 0 0 0 3px rgb(var(--brand-primary) / 0.18) !important;
          outline: none;
          border-color: rgb(var(--brand-primary) / 0.5) !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .v2f-fade-up, .v2f-slide { animation: none !important; opacity: 1 !important }
          .v2f-card-hover:hover { transform: none }
        }
      `}</style>

      {/* ═══════════ Top bar ═══════════ */}
      <header className="v2f-fade-up sticky top-0 z-30 border-b border-zinc-200/80 bg-white/85 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandLogo size="lg" decorative className="h-9 w-9 sm:h-10 sm:w-10" />
            <span className="text-sm font-bold tracking-tight text-zinc-900 sm:text-base dark:text-white">
              Haciéndolo <span className="text-brand-primary">Hábito</span>
            </span>
          </div>
          <nav className="hidden items-center gap-1 sm:flex">
            <a href="#planes" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">Planes</a>
            <a href="#datos"  className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">Datos</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/v2/login"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:text-white"
            >
              Ya tengo cuenta
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white"
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="v2f-shell mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
        {/* ═══════════ Hero compacto ═══════════ */}
        <div className="v2f-drop v2f-d1 mb-6 text-center sm:mb-7">
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-3xl md:text-[34px]">
            Empezá tu transformación
          </h1>
        </div>

        {/* ═══════════ Stepper horizontal — clickable en steps completados ═══════════ */}
        <div className="v2f-drop v2f-d2 mb-6 sm:mb-8">
          <Stepper
            steps={STEPS}
            currentIndex={stepIndex}
            onJump={(targetIdx) => {
              // Solo dejar volver hacia atrás (no saltarse pasos hacia adelante)
              if (targetIdx < stepIndex) {
                setStep(STEPS[targetIdx]!.id)
              }
            }}
          />
        </div>

        {/* ═══════════ Grid principal: sidebar solo en step "form" para no comer ancho en "plan" ═══════════ */}
        <div className={cn(
          'grid gap-5 lg:gap-6',
          step === 'form' ? 'lg:grid-cols-[1fr_320px]' : 'grid-cols-1',
        )}>

          {/* ─────────── Card principal: contenido del step ─────────── */}
          <section
            id={step === 'plan' ? 'planes' : 'datos'}
            className={cn(
              'v2f-drop v2f-d3 v2f-card rounded-2xl border bg-white p-5 sm:p-7',
              'border-zinc-200/80 shadow-[0_2px_24px_-12px_rgba(15,23,42,0.08)]',
              'dark:border-zinc-800/70 dark:bg-zinc-900 dark:shadow-[0_2px_24px_-8px_rgba(0,0,0,0.5)]',
            )}
          >
            {step === 'plan' && (
              <div key="step-plan" className="v2f-slide space-y-7">
                <header className="text-center">
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl">
                    Elegí tu plan
                  </h2>
                </header>

                {/* Conocé al equipo — siempre visible, primero */}
                <MeetTheTeam
                  trainerImage={catalogImages.trainer}
                  nutritionistImage={catalogImages.nutritionist}
                  psychologistImage={catalogImages.psychologist}
                />

                {/* Separador visual */}
                <div className="flex items-center gap-4">
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent to-zinc-200 dark:to-zinc-800" />
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-brand-primary" aria-hidden />
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Tu plan</span>
                  </div>
                  <span className="h-px flex-1 bg-gradient-to-l from-transparent to-zinc-200 dark:to-zinc-800" />
                </div>

                {/* Modality cards */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Modalidad</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {MODALITY_OPTIONS.map((m) => {
                      const active = catalogSegment === m.segment
                      return (
                        <button
                          key={m.segment}
                          type="button"
                          onClick={() => setCatalogSegment(m.segment)}
                          className={cn(
                            'group v2f-card v2f-card-hover relative flex flex-col gap-1 overflow-hidden rounded-xl border p-3.5 text-left',
                            active
                              ? 'border-brand-primary bg-gradient-to-br from-brand-primary/[0.08] to-brand-primary/[0.03] ring-2 ring-brand-primary/20 shadow-[0_8px_28px_-12px_rgba(255,72,0,0.35)]'
                              : 'border-zinc-200 bg-zinc-50/50 hover:border-zinc-300 hover:bg-white hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700 dark:hover:bg-zinc-900',
                          )}
                        >
                          {/* Glow naranja en active */}
                          {active && (
                            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-brand-primary/20 blur-2xl" aria-hidden />
                          )}
                          <span className={cn(
                            'relative text-[10px] font-bold uppercase tracking-wider',
                            active ? 'text-brand-primary' : 'text-zinc-500 dark:text-zinc-400',
                          )}>{m.short}</span>
                          <span className="relative text-sm font-semibold text-zinc-900 dark:text-white">{m.label}</span>
                          <span className="relative text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{m.desc}</span>
                          {active && (
                            <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white shadow-sm">
                              <Check className="h-3 w-3" aria-hidden />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Plans section */}
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Ofertas disponibles</p>
                  {plansVisible.length > 0 ? (
                    <div className="-mx-1">
                      <IntakeChangeablePlansSection
                        title="Ofertas"
                        footerText="Cancelás cuando quieras."
                        buttonText={selectedPlanId ? 'Continuar →' : 'Elegí un plan'}
                        plans={intakePlansToPricingPlans(plansVisible)}
                        selectedPlanId={selectedPlanId}
                        onSelectPlan={(id) => setSelectedPlanId(id)}
                        onContinue={() => { if (selectedPlanId) setStep('form') }}
                        billing={planBilling}
                        onBillingChange={setPlanBilling}
                        badgeVariant="amber"
                        tone="card"
                        embedded
                        flush
                        uiTheme={theme}
                        includeSectionAvatars={{
                          trainer:      { avatarUrl: catalogImages.trainer,      subtitle: 'Tomás Ferster' },
                          nutritionist: { avatarUrl: catalogImages.nutritionist, subtitle: 'Cristian Crossetto' },
                          psychologist: { avatarUrl: catalogImages.psychologist, subtitle: 'Santiago Rodríguez' },
                        }}
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
                      <Sparkles className="mx-auto mb-2 h-5 w-5 text-zinc-400" aria-hidden />
                      Próximamente sumaremos opciones en esta modalidad.
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 'form' && (
              <div key="step-form" className="v2f-slide space-y-6">
                <header className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-5 dark:border-zinc-800">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Back button siempre visible */}
                    <button
                      type="button"
                      onClick={() => setStep('plan')}
                      aria-label="Volver al paso anterior"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition-colors hover:border-brand-primary/40 hover:bg-brand-primary/[0.05] hover:text-brand-primary dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-brand-primary/40 dark:hover:text-brand-primary"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-primary">Paso 2</p>
                      <h2 className="mt-0.5 text-xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">Contanos un poco de vos</h2>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">100% confidencial — solo lo ve el profesional asignado.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('plan')}
                    className="hidden items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white sm:inline-flex"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Cambiar plan
                  </button>
                </header>

                {/* Form (reutiliza componentes existentes) */}
                <div className="-mx-1">
                  {intakeKind === 'nutricion' ? (
                    <IntakeNutritionForm
                      selectedPlanSlug={selectedPlanId}
                      selectedPlanLabel={selectedPlan?.name ?? null}
                      selectedPlanPrice={selectedPlan ? displayPriceForPlan(selectedPlan, planBilling) : null}
                      onSuccess={() => setStep('confirmation')}
                      compact
                    />
                  ) : intakeKind === 'full' ? (
                    <IntakeFullForm
                      selectedPlanSlug={selectedPlanId}
                      selectedPlanLabel={selectedPlan?.name ?? null}
                      selectedPlanPrice={selectedPlan ? displayPriceForPlan(selectedPlan, planBilling) : null}
                      onSuccess={() => setStep('confirmation')}
                      compact
                    />
                  ) : (
                    <IntakeFersterForm
                      selectedPlanSlug={selectedPlanId}
                      selectedPlanLabel={selectedPlan?.name ?? null}
                      selectedPlanPrice={selectedPlan ? displayPriceForPlan(selectedPlan, planBilling) : null}
                      onSuccess={() => setStep('confirmation')}
                      compact
                    />
                  )}
                </div>
              </div>
            )}

            {step === 'confirmation' && (
              <ConfirmationView
                onAgain={() => { setStep('plan') }}
                planName={selectedPlan?.name ?? null}
              />
            )}
          </section>

          {/* ─────────── Sidebar: resumen del plan (solo durante form) ─────────── */}
          {step === 'form' && (
            <aside className="v2f-drop v2f-d4 lg:sticky lg:top-[5.5rem] lg:self-start">
              <PlanSummary
                plan={selectedPlan}
                billing={planBilling}
                step={step}
                onChangePlan={() => setStep('plan')}
              />
            </aside>
          )}
        </div>

        <p className="mt-10 text-center text-[10px] text-zinc-400 dark:text-zinc-600">
          © {new Date().getFullYear()} Ferster Fitness · Haciéndolo Hábito
        </p>
      </main>
    </div>
  )
}

/* ─────────────────────── Stepper horizontal — soporta jump back ─────────────────────── */
function Stepper({
  steps,
  currentIndex,
  onJump,
}: {
  steps: ReadonlyArray<{ id: string; label: string; icon3d: string }>
  currentIndex: number
  onJump?: (targetIdx: number) => void
}) {
  return (
    <div className={cn(
      'rounded-2xl border bg-white px-4 py-3',
      'border-zinc-200/80 shadow-[0_2px_16px_-10px_rgba(15,23,42,0.08)]',
      'dark:border-zinc-800/70 dark:bg-zinc-900 dark:shadow-[0_2px_24px_-8px_rgba(0,0,0,0.5)]',
    )}>
      <ol className="flex items-center justify-between">
        {steps.map((s, i) => {
          const completed = i < currentIndex
          const active = i === currentIndex
          const clickable = completed && onJump
          const NodeTag = clickable ? 'button' : 'div'
          return (
            <li key={s.id} className={cn('flex flex-1 items-center', i === steps.length - 1 && 'flex-none')}>
              {/* Node + label */}
              <NodeTag
                {...(clickable ? { type: 'button' as const, onClick: () => onJump?.(i), 'aria-label': `Volver al paso ${i + 1}: ${s.label}` } : {})}
                className={cn(
                  'flex flex-col items-center gap-1.5 transition-opacity',
                  clickable && 'cursor-pointer',
                  !active && !completed && 'opacity-50',
                )}
              >
                {/* Círculo con número o check */}
                <span className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
                  completed && 'border-green-500 bg-green-500 text-white',
                  active && 'border-brand-primary bg-white text-brand-primary shadow-[0_0_0_4px_rgba(255,72,0,0.12)] dark:bg-zinc-900',
                  !completed && !active && 'border-zinc-300 bg-white text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-500',
                )}>
                  {completed
                    ? <Check className="h-4 w-4" aria-hidden />
                    : <span>{i + 1}</span>
                  }
                </span>
                {/* Label debajo */}
                <span className={cn(
                  'hidden text-xs font-medium sm:block',
                  active ? 'text-zinc-900 dark:text-white' : completed ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-400 dark:text-zinc-500',
                )}>{s.label}</span>
              </NodeTag>

              {/* Línea conectora */}
              {i < steps.length - 1 && (
                <span className={cn(
                  'mx-3 h-0.5 flex-1 rounded-full transition-colors',
                  i < currentIndex ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700',
                )} aria-hidden />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ─────────────────────── Tu equipo — info plena de los 3 profesionales ─────────────────────── */
type ProfKey = 'trainer' | 'nutritionist' | 'psychologist'
type ProfessionalDef = {
  name: string
  role: string
  credential: string
  tagline: string
  key: ProfKey
  /** Color de acento para el fallback (cuando no hay foto). */
  accentClass: string
}

const TEAM: ProfessionalDef[] = [
  {
    name: 'Tomás Ferster',
    role: 'Entrenador',
    credential: 'Lic. alto rendimiento · Prof. Educación física',
    tagline: 'Diseña y supervisa tu plan de entrenamiento.',
    key: 'trainer',
    accentClass: 'from-blue-500/15 to-blue-400/5 text-blue-700 dark:text-blue-300',
  },
  {
    name: 'Cristian Crossetto',
    role: 'Nutricionista',
    credential: 'Lic. en Nutrición · Especialización deportiva',
    tagline: 'Tu alimentación, planificada e individualizada.',
    key: 'nutritionist',
    accentClass: 'from-green-500/15 to-green-400/5 text-green-700 dark:text-green-300',
  },
  {
    name: 'Santiago Rodríguez',
    role: 'Psicólogo',
    credential: 'Acompañamiento mental · Hábitos y motivación',
    tagline: 'Trabaja la cabeza y la adherencia al proceso.',
    key: 'psychologist',
    accentClass: 'from-violet-500/15 to-violet-400/5 text-violet-700 dark:text-violet-300',
  },
]

function MeetTheTeam({
  trainerImage,
  nutritionistImage,
  psychologistImage,
}: {
  trainerImage: string | null
  nutritionistImage: string | null
  psychologistImage: string | null
}) {
  return (
    <section>
      <div className="mb-4 flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 animate-bounce text-brand-primary" aria-hidden />
          <h3 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white sm:text-lg">
            Nuestro equipo de profesionales
          </h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-green-700 ring-1 ring-green-200 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/30">
          <Check className="h-2.5 w-2.5" aria-hidden /> Verificados
        </span>
      </div>

      <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        {TEAM.map((p) => {
          const img =
            p.key === 'trainer'      ? trainerImage :
            p.key === 'nutritionist' ? nutritionistImage :
            psychologistImage
          const initials = p.name.split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
          return (
            <article
              key={p.key}
              className={cn(
                'v2f-team-card group relative overflow-hidden rounded-3xl p-2.5',
                'bg-white shadow-[0_8px_40px_-4px_rgba(0,0,0,0.18),0_2px_12px_-2px_rgba(0,0,0,0.10)]',
                'hover:shadow-[0_20px_60px_-8px_rgba(0,0,0,0.24),0_6px_20px_-4px_rgba(255,72,0,0.15)]',
                'dark:bg-zinc-800 dark:shadow-[0_8px_40px_-2px_rgba(0,0,0,0.7),0_2px_14px_-1px_rgba(0,0,0,0.5)]',
                'dark:hover:shadow-[0_20px_60px_-6px_rgba(0,0,0,0.8),0_6px_20px_-4px_rgba(255,72,0,0.25)]',
                'transition-all duration-300',
              )}
            >
              {/* Foto con margen y esquinas redondeadas */}
              <div className="relative overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-700" style={{ aspectRatio: '3/4' }}>
                {img ? (
                  <img
                    src={img}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    style={{ objectPosition: 'center' }}
                    loading="lazy"
                    draggable={false}
                  />
                ) : (
                  <span className={cn(
                    'flex h-full w-full items-center justify-center text-2xl font-bold bg-gradient-to-br',
                    p.accentClass,
                  )}>
                    {initials}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="px-2 py-3">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">{p.name}</p>
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      fill="#22c55e"
                      d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
                    />
                    <path
                      fill="#fff"
                      d="M9.8 17.3l-4.2-4.1L7 11.8l2.8 2.7L17 7.4l1.4 1.4-8.6 8.5z"
                    />
                  </svg>
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                  {p.tagline}
                </p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

/* ─────────────────────── Plan summary sidebar ─────────────────────── */
function PlanSummary({
  plan,
  billing,
  step,
  onChangePlan,
}: {
  plan: PublicIntakePlanDetail | null
  billing: PlanBilling
  step: StepId
  onChangePlan: () => void
}) {
  if (!plan) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
        <Sparkles className="mx-auto mb-2 h-6 w-6 text-zinc-400" aria-hidden />
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Resumen del plan</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Cuando elijas un plan vas a verlo acá con el detalle de precio.</p>
      </div>
    )
  }
  const price = displayPriceForPlan(plan, billing)
  const features = plan.info.slice(0, 5)
  return (
    <div className={cn(
      'v2f-card rounded-2xl border bg-white p-5',
      'border-zinc-200/80 shadow-[0_2px_24px_-12px_rgba(15,23,42,0.08)]',
      'dark:border-zinc-800/70 dark:bg-zinc-900 dark:shadow-[0_2px_24px_-8px_rgba(0,0,0,0.5)]',
    )}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Tu plan</p>
          <h3 className="mt-0.5 text-base font-bold text-zinc-900 dark:text-white">{plan.name}</h3>
        </div>
        {step !== 'plan' && step !== 'confirmation' && (
          <button
            type="button"
            onClick={onChangePlan}
            className="shrink-0 text-[11px] font-semibold text-brand-primary underline-offset-2 hover:underline"
          >
            Cambiar
          </button>
        )}
      </header>

      <div className="rounded-xl border border-zinc-100 bg-gradient-to-br from-orange-50/60 to-stone-50 p-4 dark:border-zinc-800 dark:from-orange-500/[0.08] dark:to-zinc-900/40">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Precio</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-zinc-900 dark:text-white">{price}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{planBillingCaption(billing)}</p>
      </div>

      {features.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Incluye</p>
          <ul className="space-y-1.5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[12px] leading-snug text-zinc-700 dark:text-zinc-300">
                <span className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-brand-primary/15 text-brand-primary">
                  <Check className="h-2.5 w-2.5" aria-hidden />
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-5 border-t border-zinc-100 pt-3 text-center text-[10px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        Cancelás cuando quieras
      </p>
    </div>
  )
}

/* ─────────────────────── Confirmation view ─────────────────────── */
function ConfirmationView({ planName, onAgain }: { planName: string | null; onAgain: () => void }) {
  return (
    <div className="v2f-slide flex flex-col items-center py-6 text-center sm:py-10">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-green-50 ring-1 ring-green-200 dark:bg-green-500/10 dark:ring-green-500/30">
        <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" aria-hidden />
      </div>
      <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-[11px] font-semibold text-green-700 ring-1 ring-green-200 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/30">
        <Check className="h-3 w-3" aria-hidden />
        Inscripción confirmada
      </span>
      <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
        ¡Recibimos tus datos!
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {planName ? <>Tu inscripción al plan <span className="font-semibold text-zinc-800 dark:text-zinc-200">«{planName}»</span> fue recibida. </> : 'Tu inscripción fue recibida. '}
        El equipo de Haciéndolo Hábito se va a comunicar con vos a la brevedad.
      </p>

      <div className="mt-7 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onAgain}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Hacer otra inscripción
        </button>
        <Link
          to="/v2/login"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover"
        >
          Ir al login
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  )
}
