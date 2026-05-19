import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, CheckCircle2, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggleMoonIcon, ThemeToggleSunIcon } from '@/components/ui/ThemeToggleIcons'
import { useTheme } from '@/contexts/ThemeContext'
import { BrandLogo } from '@/components/branding/BrandLogo'
import { IntakeFersterForm } from '@/pages/public/IntakeFersterForm'
import { IntakeNutritionForm } from '@/pages/public/IntakeNutritionForm'
import { IntakeFullForm } from '@/pages/public/IntakeFullForm'
import { supabase } from '@/lib/supabase'
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
import { webIntakeCatalogDisplayUrl } from '@/lib/webIntakeCatalogAssets'

/** Texto completo (detalle del plan / tooltip). En el selector sólo usamos líneas cortas. */
const PUBLIC_PLAN_SOLO_CREDENTIAL_LINE =
  'Lic. en alto rendimiento (estudiante) · Prof. Educación física · Especialización deportiva'
const PUBLIC_PLAN_CONJOINT_CREDENTIAL_LINE =
  'Cristian Crossetto — Licenciado/a en Nutrición y especialización deportiva'
const PUBLIC_PLAN_FULL_CREDENTIAL_LINE =
  'Tomás Ferster + Cristian Crossetto — Plan integral de entrenamiento y nutrición'

/** Defaults si no hay fila en `web_intake_catalog_settings`. */
const DEFAULT_INTAKE_MODALITY_LABELS = {
  solo: 'FERSTER FITNESS',
  withNutritionist: 'NUTRICIÓN',
  full: 'PLAN FULL (ENTRENO + NUTRICIÓN)',
} as const

/** Clase para el label en mayúsculas (Modalidad / Entrenador / …). */
const intakeHeroFieldLabelClass = (theme: 'light' | 'dark') =>
  cn(
    'mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em]',
    theme === 'dark' ? 'text-white/45' : 'text-ink-muted',
  )

/** Título corto en la fila de botones; el detalle completo va debajo al elegir. */
const MODALITY_CARD_COPY: Record<
  WebPlanCatalogSegment,
  { short: string; detail: string }
> = {
  solo: {
    short: 'Entreno',
    detail: 'Plan de entrenamiento con acompañamiento de Ferster Fitness.',
  },
  with_nutritionist: {
    short: 'Nutrición',
    detail: 'Seguimiento nutricional con profesional matriculado.',
  },
  full: {
    short: 'Full',
    detail: 'Entrenamiento y nutrición juntos en un plan integral.',
  },
}

function buildIntakeModalityOptions(labels: {
  solo: string | null
  withNutritionist: string | null
  full: string | null
}): { segment: WebPlanCatalogSegment; label: string }[] {
  return [
    { segment: 'solo', label: labels.solo?.trim() || DEFAULT_INTAKE_MODALITY_LABELS.solo },
    {
      segment: 'with_nutritionist',
      label: labels.withNutritionist?.trim() || DEFAULT_INTAKE_MODALITY_LABELS.withNutritionist,
    },
    { segment: 'full', label: labels.full?.trim() || DEFAULT_INTAKE_MODALITY_LABELS.full },
  ]
}

/** Sumá filas cuando haya más entrenadores disponibles en la misma línea. */
const INTAKE_TRAINER_OPTIONS: { id: string; label: string }[] = [{ id: 'tomas-ferster', label: 'Tomás Ferster' }]

/** Sumá filas cuando haya más nutricionistas. */
const INTAKE_NUTRITION_OPTIONS: { id: string; label: string }[] = [{ id: 'cris-crossetto', label: 'Cristian Crossetto' }]

function initialsFromProfessionalName(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase()
}

const INTAKE_AVATAR_PX: Record<string, number> = {
  'h-8 w-8': 32,
  'h-10 w-10': 40,
  'h-12 w-12': 48,
  'h-14 w-14': 56,
  'h-16 w-16': 64,
}

/** Cuadrado con esquinas redondeadas (alineado a inputs / tarjetas), no óvalo ni cápsula. */
function IntakeProAvatar({
  label,
  url,
  sizeClass = 'h-14 w-14',
  theme = 'dark',
  priority = false,
}: {
  label: string
  url?: string | null
  sizeClass?: string
  theme?: 'light' | 'dark'
  /** true = eager + fetchpriority (fotos visibles al cargar el paso). */
  priority?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const [useOriginalSrc, setUseOriginalSrc] = useState(false)
  const cssPx = INTAKE_AVATAR_PX[sizeClass] ?? 56
  const optimizedSrc = webIntakeCatalogDisplayUrl(url, cssPx)
  const rawSrc = url?.trim() || null
  const imgSrc = useOriginalSrc ? rawSrc : optimizedSrc

  useEffect(() => {
    setFailed(false)
    setUseOriginalSrc(false)
  }, [url])

  const showImg = Boolean(imgSrc && !failed)
  return showImg ? (
    <img
      src={imgSrc!}
      alt=""
      width={cssPx}
      height={cssPx}
      className={cn(
        sizeClass,
        'shrink-0 rounded-xl object-cover object-[center_18%] ring-1',
        theme === 'light' ? 'ring-neutral-200/80' : 'ring-white/20',
      )}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onError={() => {
        if (!useOriginalSrc && rawSrc && optimizedSrc !== rawSrc) {
          setUseOriginalSrc(true)
          return
        }
        setFailed(true)
      }}
    />
  ) : (
    <span
      className={cn(
        sizeClass,
        'flex shrink-0 items-center justify-center rounded-lg px-0.5 text-[9px] font-bold uppercase leading-tight ring-1',
        theme === 'light'
          ? 'bg-neutral-200/90 text-neutral-800 ring-neutral-300/70'
          : 'bg-white/12 text-white/90 ring-white/15',
      )}
      aria-hidden
    >
      {initialsFromProfessionalName(label)}
    </span>
  )
}

type IntakeAvatarOption = { id: string; label: string; avatarUrl?: string | null }

type IntakeHorizontalChoiceOption = {
  id: string
  title: string
  /** Línea principal de detalle (modalidad). Para profesionales se reemplaza por `subtitle`. */
  detail: string
  /** Subtítulo corto para la tarjeta compacta de profesional (credenciales). */
  subtitle?: string
  avatarUrl?: string | null
  avatarLabel?: string
}

/**
 * Opciones en fila (sin desplegable): al tocar una, se muestra el detalle debajo.
 */
function IntakeHorizontalChoiceRow({
  groupId,
  groupLabel,
  value,
  onChange,
  options,
  disabled = false,
  emptyLabel = 'No aplica',
  theme = 'dark',
}: {
  groupId: string
  groupLabel: string
  value: string
  onChange: (id: string) => void
  options: IntakeHorizontalChoiceOption[]
  disabled?: boolean
  emptyLabel?: string
  theme?: 'light' | 'dark'
}) {
  const selected = options.find((o) => o.id === value)
  const interactive = !disabled && options.length > 0
  const labelId = `${groupId}-label`
  const detailId = `${groupId}-detail`
  const isDark = theme === 'dark'
  /** Caso compacto: un solo profesional con avatar → tile horizontal. */
  const compactSingleAvatar =
    interactive && options.length === 1 && Boolean(options[0]?.avatarLabel)

  const segmentedButtonClass = (isSelected: boolean) =>
    cn(
      'flex min-h-[2.6rem] min-w-0 flex-1 touch-manipulation items-center justify-center rounded-lg border px-2 py-2 transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
      'text-center text-[12px] font-semibold leading-tight',
      isDark
        ? cn(
            'focus-visible:ring-white/30',
            isSelected
              ? '!text-white border-white/55 bg-white/14 font-semibold ring-1 ring-white/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]'
              : '!text-white/60 border-white/10 bg-white/[0.02] font-medium hover:!text-white/80 hover:border-white/22',
          )
        : cn(
            'focus-visible:ring-neutral-400/40',
            isSelected
              ? 'border-neutral-900/25 bg-white font-semibold text-ink-primary shadow-[0_2px_10px_rgba(15,23,42,0.08)] ring-1 ring-neutral-900/[0.07]'
              : 'border-surface-border bg-surface-card font-medium text-ink-muted hover:border-neutral-300/90 hover:text-ink-secondary',
          ),
    )

  const emptyClasses = isDark
    ? 'border-white/12 !text-white/40'
    : 'border-surface-border text-ink-muted'

  const compactBtnClasses = (isSelected: boolean) =>
    isDark
      ? isSelected
        ? 'border-white/40 bg-white/[0.08] ring-1 ring-white/25'
        : 'border-white/12 bg-white/[0.025] hover:border-white/22 hover:bg-white/[0.05]'
      : isSelected
        ? 'border-neutral-900/20 bg-white ring-1 ring-neutral-900/[0.06] shadow-sm'
        : 'border-surface-border bg-surface-card hover:border-neutral-300/80 hover:bg-surface-elevated'

  const compactNameClass = isDark ? '!text-white' : 'text-ink-primary'
  const compactSubtitleClass = isDark ? '!text-white/55' : 'text-ink-muted'
  const detailClass = isDark ? '!text-white/50' : 'text-ink-muted'

  return (
    <div className="min-w-0">
      <p id={labelId} className={intakeHeroFieldLabelClass(theme)}>
        {groupLabel}
      </p>

      {!interactive ? (
        <div
          className={cn(
            'mt-1.5 rounded-lg border border-dashed px-3 py-2 text-[12px] italic',
            emptyClasses,
          )}
          aria-disabled
        >
          {emptyLabel}
        </div>
      ) : compactSingleAvatar ? (
        (() => {
          const opt = options[0]!
          const isSelected = value === opt.id
          return (
            <button
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(opt.id)}
              className={cn(
                'mt-1.5 flex w-full touch-manipulation items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
                isDark ? 'focus-visible:ring-white/30' : 'focus-visible:ring-brand-primary/40',
                compactBtnClasses(isSelected),
              )}
            >
              <IntakeProAvatar
                theme={theme}
                label={opt.avatarLabel!}
                url={opt.avatarUrl}
                sizeClass="h-14 w-14"
                priority
              />
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-[13px] font-semibold leading-tight', compactNameClass)}>
                  {opt.avatarLabel}
                </p>
                {opt.subtitle ? (
                  <p className={cn('mt-0.5 text-[11px] leading-snug line-clamp-2', compactSubtitleClass)}>
                    {opt.subtitle}
                  </p>
                ) : null}
              </div>
            </button>
          )
        })()
      ) : (
        <>
          <div
            role="radiogroup"
            aria-labelledby={labelId}
            className={cn('mt-1.5 flex gap-1.5', options.length > 3 && 'flex-wrap')}
          >
            {options.map((opt) => {
              const isSelected = value === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-describedby={isSelected ? detailId : undefined}
                  onClick={() => onChange(opt.id)}
                  className={segmentedButtonClass(isSelected)}
                >
                  {opt.title}
                </button>
              )
            })}
          </div>
          {selected?.detail ? (
            <p
              id={detailId}
              className={cn('mt-1.5 text-[11px] leading-snug', detailClass)}
              aria-live="polite"
            >
              {selected.detail}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}

type PublicIntakeSlots = {
  slotsOpen: boolean
  slotsRemaining: number | null
  slotsMessage: string | null
}

function IntakeSlotsBanner({ spots, compact }: { spots: PublicIntakeSlots; compact?: boolean }) {
  const { slotsOpen, slotsRemaining, slotsMessage } = spots
  const trimmed = slotsMessage?.trim() || ''

  let title = 'Cupos disponibles'
  let body = trimmed || 'Hay lugar para nuevas consultas.'
  let tone = 'border-white/[0.26] bg-white/[0.11]'

  if (!slotsOpen) {
    title = 'Cupos cerrados'
    body = trimmed || 'No estamos tomando nuevas inscripciones. Podés dejar tus datos y te contactamos.'
    tone = 'border-white/[0.28] bg-black/40'
  } else if (typeof slotsRemaining === 'number') {
    if (slotsRemaining <= 0 && !trimmed) {
      body = 'No quedan cupos numerados disponibles.'
      tone = 'border-amber-400/45 bg-black/40'
    } else if (slotsRemaining <= 3) {
      title = slotsRemaining <= 0 ? 'Sin cupos numerados' : 'Quedan pocos lugares'
      body = trimmed || (
        slotsRemaining > 0
          ? `Aproximadamente ${slotsRemaining} cupo${slotsRemaining === 1 ? '' : 's'} disponibles.`
          : 'Consultanos por lista de espera.'
      )
      tone = 'border-white/[0.24] bg-white/[0.09]'
    } else if (trimmed) {
      body = trimmed
    }
  }

  // Mobile: pill compacta de una línea
  if (compact) {
    return (
      <div
        className={`mb-3 flex items-center gap-1.5 overflow-hidden rounded-xl border px-2.5 py-1.5 ${tone}`}
        title={`${title} — ${body}`}
      >
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.1em] text-white/80">{title}</span>
        <span className="shrink-0 text-white/30 text-[9px]" aria-hidden>·</span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-white/70">{body}</span>
      </div>
    )
  }

  return (
    <div
      className={`mb-4 flex min-h-[2.5rem] items-center gap-2 overflow-hidden rounded-2xl border px-3 py-2 backdrop-blur-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07),0_8px_28px_rgba(0,0,0,0.22)] ${tone}`}
      title={`${title} — ${body}`}
    >
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-white/88">{title}</span>
      <span className="shrink-0 text-white/35" aria-hidden>
        ·
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight text-white/95">{body}</span>
    </div>
  )
}

function isLikelyYouTube(url: string): boolean {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/)/i.test(url)
}

function youtubeEmbedUrl(url: string): string | null {
  const m1 = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/)
  const m2 = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/)
  const id = (m1?.[1] ?? m2?.[1])?.trim()
  return id ? `https://www.youtube.com/embed/${id}` : null
}

function TestimonialsSection({ urls }: { urls: string[] }) {
  const clean = (urls ?? []).map((u) => u.trim()).filter(Boolean)
  if (clean.length === 0) return null
  return (
    <div className="mb-6 rounded-2xl border border-surface-border/80 bg-surface-elevated/25 px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-semibold">Testimonios</p>
      <p className="mt-1 text-sm font-semibold text-ink-primary">Personas que ya hicieron el proceso</p>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {clean.slice(0, 4).map((u) => {
          const yt = isLikelyYouTube(u) ? youtubeEmbedUrl(u) : null
          return (
            <div key={u} className="overflow-hidden rounded-xl border border-surface-border bg-surface-card">
              {yt ? (
                <iframe
                  src={yt}
                  title="Testimonio"
                  className="h-44 w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <video className="h-44 w-full bg-black" controls preload="metadata">
                  <source src={u} />
                </video>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

type PlanDetail = PublicIntakePlanDetail

function planCardBadge(plan: Pick<PlanDetail, 'id' | 'displayBadge'>): string {
  const b = plan.displayBadge?.trim()
  if (b) return b
  if (plan.id === 'plan-entrenamiento') return 'Entrenamiento'
  if (plan.id === 'plan-nutricion') return 'Nutrición'
  if (plan.id === 'plan-full') return 'Full'
  return 'Plan'
}

function displayPriceForPlan(plan: PlanDetail, billing: PlanBilling): string {
  const commit = inferWebPlanBundleCommitment(plan.id, plan.name)
  const totalN = numericFromPriceLabel(plan.price)
  if (commit === 3 && totalN > 0) {
    const impliedMonthly = formatArsRounded(Math.round(totalN / 3))
    switch (billing) {
      case 'monthly':
        return impliedMonthly
      case 'months3':
        return plan.price
      case 'months6':
        return bundlePrice6Months(impliedMonthly)
      case 'annual':
        return effectiveYearlyLabel(impliedMonthly, plan.priceYearly)
    }
  }
  if (commit === 6 && totalN > 0) {
    const impliedMonthly = formatArsRounded(Math.round(totalN / 6))
    switch (billing) {
      case 'monthly':
        return impliedMonthly
      case 'months3':
        return bundlePrice3Months(impliedMonthly)
      case 'months6':
        return plan.price
      case 'annual':
        return effectiveYearlyLabel(impliedMonthly, plan.priceYearly)
    }
  }
  switch (billing) {
    case 'monthly':
      return plan.price
    case 'months3':
      return plan.price3mLabel?.trim() || bundlePrice3Months(plan.price)
    case 'months6':
      return plan.price6mLabel?.trim() || bundlePrice6Months(plan.price)
    case 'annual':
      return effectiveYearlyLabel(plan.price, plan.priceYearly)
  }
}

function planBillingCaption(billing: PlanBilling): string {
  switch (billing) {
    case 'monthly':
      return 'Por mes'
    case 'months3':
      return 'Total · 3 meses'
    case 'months6':
      return 'Total · 6 meses'
    case 'annual':
      return 'Por año · pago único'
  }
}

function PlanDetailView({
  plan,
  planBilling,
  onBack,
  panelId,
}: {
  plan: PlanDetail
  planBilling: PlanBilling
  onBack: () => void
  panelId?: string
}) {
  return (
    <div
      id={panelId}
      className="h-full min-h-0 max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain scrollbar-hide px-1 pb-28 lg:pb-1"
    >
      <div className="rounded-2xl border border-white/12 bg-zinc-950/85 p-5 sm:p-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/55">Detalle de la oferta</p>
            <h2 className="text-xl sm:text-2xl font-bold mt-1">{plan.name}</h2>
          </div>
          <div className="text-right">
            <span className="block text-2xl font-extrabold tabular-nums">
              {displayPriceForPlan(plan, planBilling)}
            </span>
            <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">
              {planBillingCaption(planBilling)}
            </span>
          </div>
        </div>

        <p className="mt-4 whitespace-pre-wrap break-words text-sm text-white/85 leading-relaxed">{plan.intro}</p>

        {plan.credentialLineOverride?.trim() ? (
          <p className="mt-4 border-l-2 border-white/35 pl-3 text-sm font-medium leading-relaxed text-white/90 whitespace-pre-wrap">
            {plan.credentialLineOverride.trim()}
          </p>
        ) : plan.catalogSegment === 'with_nutritionist' ? (
          <p className="mt-4 border-l-2 border-white/35 pl-3 text-sm font-medium leading-relaxed text-white/90">
            {PUBLIC_PLAN_CONJOINT_CREDENTIAL_LINE}
          </p>
        ) : plan.catalogSegment === 'full' ? (
          <p className="mt-4 border-l-2 border-white/30 pl-3 text-sm font-medium leading-relaxed text-white/90">
            {PUBLIC_PLAN_FULL_CREDENTIAL_LINE}
          </p>
        ) : plan.catalogSegment === 'solo' ? (
          <p className="mt-4 text-sm leading-relaxed text-white/75">{PUBLIC_PLAN_SOLO_CREDENTIAL_LINE}</p>
        ) : null}

        <div className="mt-5 pt-4 border-t border-white/10">
          <p className="text-sm font-semibold text-white mb-2">Incluye</p>
          <ul className="space-y-2">
            {plan.info.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-white/85 leading-relaxed">
                <Check className="h-4 w-4 mt-0.5 text-white/70 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 pt-4 border-t border-white/10">
          <p className="text-sm font-semibold text-white mb-2">De regalo</p>
          <ul className="space-y-2">
            {plan.gifts.map((gift) => (
              <li key={gift} className="flex items-start gap-2 text-sm text-white/85 leading-relaxed">
                <Check className="h-4 w-4 mt-0.5 text-white/70 shrink-0" />
                <span>{gift}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="mt-6 hidden lg:block w-full rounded-xl border border-white/18 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.11] transition-colors"
        >
          Elegir este plan y volver al formulario
        </button>
      </div>

      <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-zinc-950 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onBack()
          }}
          className="w-full rounded-xl border border-white/20 bg-white px-4 py-3.5 text-sm font-bold text-zinc-900 shadow-lg touch-manipulation active:scale-[0.99] transition-transform"
        >
          Elegir este plan y continuar →
        </button>
      </div>
    </div>
  )
}

function HeroBgLayers({ theme }: { theme: 'light' | 'dark' }) {
  if (theme === 'light') {
    return (
      <>
        <div className="absolute inset-0 z-0 bg-surface-base" />
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(255,107,53,0.10), transparent 60%)',
          }}
          aria-hidden
        />
      </>
    )
  }
  const photo =
    'url(https://images.unsplash.com/photo-1509316785289-025f5cd90c3d?w=1400&q=88)'
  return (
    <>
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: photo }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#15101f]/85 via-transparent to-[#0c0b12]/92" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
      </div>
      <div
        className="absolute inset-0 z-[1] pointer-events-none opacity-50 mix-blend-screen"
        style={{
          background: 'radial-gradient(ellipse 120% 80% at 50% -10%, rgba(255,255,255,0.14), transparent 55%)',
        }}
      />
    </>
  )
}

/** Acciones flotantes — mismo patrón que /login (Panel + tema). */
function PublicIntakeTopActions({
  backLabel,
  onBack,
  tone = 'light',
}: {
  backLabel?: string
  onBack?: () => void
  /** `dark` = botones translúcidos para fondo oscuro (paso planes en mobile). */
  tone?: 'light' | 'dark'
}) {
  const { theme, toggleTheme } = useTheme()
  const darkTone = tone === 'dark'

  const buttonBase =
    'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium shadow-sm backdrop-blur-sm transition-colors'
  const iconButtonBase =
    'inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm backdrop-blur-sm transition-all'

  const surfaceClasses = darkTone
    ? 'border-white/15 bg-white/[0.06] text-white/85 hover:border-white/30 hover:text-white hover:bg-white/[0.1]'
    : 'border-surface-border bg-surface-card text-ink-secondary hover:border-brand-primary/40 hover:text-ink-primary'

  const iconSurfaceClasses = darkTone
    ? 'border-white/15 bg-white/[0.06] text-white/85 hover:bg-white/[0.1] hover:text-white'
    : 'border-surface-border bg-surface-card text-ink-muted hover:bg-surface-elevated hover:text-ink-primary'

  return (
    <>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className={cn('absolute top-4 left-4 z-30', buttonBase, surfaceClasses, 'gap-1 px-2.5')}
        >
          <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {backLabel ?? 'Planes'}
        </button>
      ) : null}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        <Link to="/login" className={cn(buttonBase, surfaceClasses)}>
          Panel
          <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className={cn(iconButtonBase, iconSurfaceClasses)}
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
        >
          {theme === 'dark' ? <ThemeToggleSunIcon /> : <ThemeToggleMoonIcon />}
        </button>
      </div>
    </>
  )
}

/** Panel izquierdo: marca + selector de profesional + planes */
function LeftBrandPanel({
  theme: appTheme,
  plansAll,
  plansVisible,
  catalogSegment,
  onSelectCatalogSegment,
  selectedPlanId,
  onSelectPlan,
  onConfirmPlan,
  planBilling,
  onPlanBillingChange,
  soloSegmentImageUrl,
  withNutritionistSegmentImageUrl,
  crisSoloSegmentImageUrl,
  modalityOptions,
  catalogError,
  catalogLoading,
  buttonText = 'Ver detalle',
}: {
  theme: 'light' | 'dark'
  catalogError?: string | null
  catalogLoading?: boolean
  plansAll: PlanDetail[]
  plansVisible: PlanDetail[]
  catalogSegment: WebPlanCatalogSegment | null
  onSelectCatalogSegment: (s: WebPlanCatalogSegment) => void
  selectedPlanId: string | null
  onSelectPlan: (id: string) => void
  /** Igual que antes: pasar al detalle / volteo del formulario. */
  onConfirmPlan: () => void
  planBilling: PlanBilling
  onPlanBillingChange: (v: PlanBilling) => void
  /** Fotos del panel Ajustes → Planes web (`web_intake_catalog_settings`). */
  soloSegmentImageUrl: string | null
  withNutritionistSegmentImageUrl: string | null
  crisSoloSegmentImageUrl: string | null
  modalityOptions: { segment: WebPlanCatalogSegment; label: string }[]
  /** Texto del botón de acción principal en el selector de planes. */
  buttonText?: string
}) {
  const hasPlansForSegment = (seg: WebPlanCatalogSegment) => plansAll.some((p) => p.catalogSegment === seg)
  const panelTheme = appTheme
  const isDarkPanel = panelTheme === 'dark'

  const [trainerChoice, setTrainerChoice] = useState(INTAKE_TRAINER_OPTIONS[0]?.id ?? '')
  const [nutritionChoice, setNutritionChoice] = useState(INTAKE_NUTRITION_OPTIONS[0]?.id ?? '')

  const modalitySegment: WebPlanCatalogSegment =
    catalogSegment !== null && modalityOptions.some((o) => o.segment === catalogSegment)
      ? catalogSegment
      : 'solo'

  const includeTraining = modalitySegment === 'solo' || modalitySegment === 'full'
  const includeNutrition = modalitySegment === 'with_nutritionist' || modalitySegment === 'full'

  const trainerAvatarOptions: IntakeAvatarOption[] = useMemo(
    () =>
      INTAKE_TRAINER_OPTIONS.map((o) => ({
        ...o,
        avatarUrl: o.id === 'tomas-ferster' ? soloSegmentImageUrl : null,
      })),
    [soloSegmentImageUrl],
  )

  const nutritionAvatarUrl: string | null =
    modalitySegment === 'with_nutritionist'
      ? crisSoloSegmentImageUrl ?? withNutritionistSegmentImageUrl
      : withNutritionistSegmentImageUrl

  const nutritionAvatarOptions: IntakeAvatarOption[] = useMemo(
    () =>
      INTAKE_NUTRITION_OPTIONS.map((o) => ({
        ...o,
        avatarUrl: o.id === 'cris-crossetto' ? nutritionAvatarUrl : null,
      })),
    [nutritionAvatarUrl],
  )

  const modalityChoiceOptions = useMemo<IntakeHorizontalChoiceOption[]>(
    () =>
      modalityOptions.map((o) => {
        const copy = MODALITY_CARD_COPY[o.segment]
        return {
          id: o.segment,
          title: copy.short,
          detail: copy.detail,
        }
      }),
    [modalityOptions],
  )

  const trainerChoiceOptions = useMemo<IntakeHorizontalChoiceOption[]>(
    () =>
      trainerAvatarOptions.map((o) => ({
        id: o.id,
        title: o.label.split(/\s+/)[0] ?? o.label,
        detail: '',
        subtitle: PUBLIC_PLAN_SOLO_CREDENTIAL_LINE,
        avatarUrl: o.avatarUrl,
        avatarLabel: o.label,
      })),
    [trainerAvatarOptions],
  )

  const nutritionChoiceOptions = useMemo<IntakeHorizontalChoiceOption[]>(
    () =>
      nutritionAvatarOptions.map((o) => ({
        id: o.id,
        title: o.label.split(/\s+/)[0] ?? o.label,
        detail: '',
        subtitle: PUBLIC_PLAN_CONJOINT_CREDENTIAL_LINE,
        avatarUrl: o.avatarUrl,
        avatarLabel: o.label,
      })),
    [nutritionAvatarOptions],
  )

  return (
    <div className="relative lg:w-[48%] min-h-0 lg:min-h-[min(100vh-2rem,860px)] flex-shrink-0 min-w-0">
      <HeroBgLayers theme={panelTheme} />

      <div className="relative z-[2] flex h-full min-h-[inherit] flex-col px-4 pt-16 pb-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-visible [-webkit-overflow-scrolling:touch] min-w-0">
          <div className="mx-auto w-full max-w-[min(400px,calc(100vw-2rem))] min-w-0 shrink-0 space-y-4">
              {catalogError ? (
                <p
                  className={cn(
                    'text-[11px] rounded-lg border px-2.5 py-2',
                    isDarkPanel
                      ? 'text-amber-200/90 border-amber-400/30 bg-amber-500/15'
                      : 'text-amber-900 border-amber-300 bg-amber-50',
                  )}
                >
                  {catalogError}
                </p>
              ) : catalogLoading ? (
                <p className={cn('text-[11px]', isDarkPanel ? 'text-white/50' : 'text-ink-muted')}>
                  Actualizando precios…
                </p>
              ) : null}
            {/* Marca: una sola lectura */}
            <div className="relative flex items-center justify-center gap-2.5 sm:justify-start sm:gap-3">
              {isDarkPanel ? (
                <div
                  className="pointer-events-none absolute left-1/2 top-6 h-24 w-[min(100%,20rem)] -translate-x-1/2 rounded-full opacity-28 blur-3xl sm:left-[18%] sm:translate-x-0"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.1), transparent 72%)',
                  }}
                  aria-hidden
                />
              ) : null}
              <BrandLogo
                size="sm"
                decorative
                className="relative z-[1] h-8 w-8 sm:h-9 sm:w-9 opacity-95"
              />
              <p
                className={cn(
                  'relative z-[1] min-w-0 truncate text-[15px] font-bold leading-snug tracking-tight sm:text-base',
                  isDarkPanel ? 'text-white/95' : 'text-ink-primary',
                )}
              >
                Haciéndolo hábito
              </p>
            </div>

            {/* Superficie única: opciones + planes sin doble marco */}
            <div
              className={cn(
                'intake-hero-surface relative z-[1] rounded-xl border p-3.5 backdrop-blur-md sm:p-4',
                isDarkPanel
                  ? 'border-white/[0.08] bg-white/[0.025] text-white'
                  : 'border-surface-border bg-surface-card text-ink-primary shadow-sm',
              )}
            >
              <div className="space-y-3.5">
                <IntakeHorizontalChoiceRow
                  groupId="intake-modality"
                  groupLabel="Modalidad"
                  theme={panelTheme}
                  value={modalitySegment}
                  onChange={(seg) => onSelectCatalogSegment(seg as WebPlanCatalogSegment)}
                  options={modalityChoiceOptions}
                />

                <IntakeHorizontalChoiceRow
                  groupId="intake-trainer"
                  groupLabel="Entrenador"
                  theme={panelTheme}
                  value={includeTraining ? trainerChoice : ''}
                  disabled={!includeTraining}
                  emptyLabel="No aplica"
                  onChange={setTrainerChoice}
                  options={trainerChoiceOptions}
                />

                <IntakeHorizontalChoiceRow
                  groupId="intake-nutrition"
                  groupLabel="Nutricionista"
                  theme={panelTheme}
                  value={includeNutrition ? nutritionChoice : ''}
                  disabled={!includeNutrition}
                  emptyLabel="No aplica"
                  onChange={setNutritionChoice}
                  options={nutritionChoiceOptions}
                />
              </div>

              {plansVisible.length > 0 ? (
                <>
                  <div
                    className={cn(
                      'my-4 border-t pt-1',
                      isDarkPanel ? 'border-white/[0.06]' : 'border-surface-border',
                    )}
                    aria-hidden
                  />
                  <IntakeChangeablePlansSection
                    title="Ofertas"
                    footerText="Podés cancelar cuando quieras."
                    buttonText={buttonText}
                    plans={intakePlansToPricingPlans(plansVisible)}
                    selectedPlanId={selectedPlanId}
                    onSelectPlan={onSelectPlan}
                    onContinue={onConfirmPlan}
                    billing={planBilling}
                    onBillingChange={onPlanBillingChange}
                    badgeVariant="amber"
                    tone="card"
                    embedded
                    flush
                    uiTheme={panelTheme}
                  />
                </>
              ) : (
                <p
                  className={cn(
                    'mt-3 text-center text-[11px] leading-relaxed',
                    isDarkPanel ? 'text-white/52' : 'text-ink-muted',
                  )}
                >
                  {catalogSegment === null
                    ? 'Elegí una opción del paso 1.'
                    : catalogSegment === 'with_nutritionist'
                      ? 'Todavía no hay ofertas publicadas en esta modalidad. Cargalas desde Planes web (segmento Nutrición) en el panel.'
                    : catalogSegment === 'full' && !hasPlansForSegment('full')
                      ? 'Plan integral entrenamiento + nutrición. Si no ves planes, cargalos desde el panel.'
                      : 'Próximamente sumaremos opciones para esta línea.'}
                </p>
              )}

              {catalogSegment === 'full' && plansVisible.length === 0 && (
                <p
                  className={cn(
                    'mt-2 text-center text-[10px]',
                    isDarkPanel ? 'text-white/40' : 'text-ink-muted',
                  )}
                >
                  Podés avanzar con el formulario; un asesor te cuenta los detalles del plan Full.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="relative z-[1] mt-auto hidden shrink-0 border-t border-white/[0.06] pt-2.5 lg:block">
          <p className="mx-auto max-w-sm text-center text-[10px] font-medium leading-snug text-white/48 lg:mx-0 lg:text-left">
            Hábitos que transforman, día a día.
          </p>
        </div>
      </div>
    </div>
  )
}


export function PublicIntakeFormPage() {
  const { theme } = useTheme()
  const [done,      setDone]      = useState(false)
  const [plans, setPlans] = useState<PlanDetail[]>(() => mergePublicIntakePlansFromDb([]))
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [catalogSegment, setCatalogSegment] = useState<WebPlanCatalogSegment | null>('solo')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [planBilling, setPlanBilling] = useState<PlanBilling>('monthly')
  const [isPlanFlipped, setIsPlanFlipped] = useState(false)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches,
  )
  /** Móvil: una pantalla a la vez (planes → detalle → formulario). */
  const [mobileStep, setMobileStep] = useState<'plans' | 'detail' | 'form'>('plans')
  const flipTimerRef = useRef<number | null>(null)
  const [publicSpots, setPublicSpots] = useState<PublicIntakeSlots>({
    slotsOpen: true,
    slotsRemaining: null,
    slotsMessage: null,
  })
  const [testimonialVideos, setTestimonialVideos] = useState<string[]>([])
  const [catalogSegmentImages, setCatalogSegmentImages] = useState<{
    solo: string | null
    withNutritionist: string | null
    crisSolo: string | null
  }>({ solo: null, withNutritionist: null, crisSolo: null })
  const [modalityLabels, setModalityLabels] = useState<{
    solo: string | null
    withNutritionist: string | null
    full: string | null
  }>({ solo: null, withNutritionist: null, full: null })
  const modalityOptions = useMemo(() => buildIntakeModalityOptions(modalityLabels), [modalityLabels])
  const plansVisible = useMemo(() => {
    return plans.filter((p) => {
      if (catalogSegment === null || p.catalogSegment !== catalogSegment) return false
      const bundle = inferWebPlanBundleCommitment(p.id, p.name)
      return planVisibleForIntakeBilling(bundle, planBilling)
    })
  }, [plans, catalogSegment, planBilling])

  useEffect(() => {
    if (plansVisible.length === 0) return
    const valid = Boolean(selectedPlanId && plansVisible.some((p) => p.id === selectedPlanId))
    if (!valid) setSelectedPlanId(plansVisible[0].id)
  }, [plansVisible, selectedPlanId])

  const intakeKind = useMemo<'entrenamiento' | 'nutricion' | 'full'>(() => {
    if (catalogSegment === 'with_nutritionist') return 'nutricion'
    if (catalogSegment === 'full') return 'full'
    return 'entrenamiento'
  }, [catalogSegment])

  const selectedPlan = selectedPlanId
    ? plans.find((p) => p.id === selectedPlanId) ?? null
    : null

  useEffect(() => {
    const segments = new Set(plans.map((p) => p.catalogSegment))
    setCatalogSegment((curr) => {
      if (curr && segments.has(curr)) return curr
      if (segments.has('solo')) return 'solo'
      if (segments.has('with_nutritionist')) return 'with_nutritionist'
      if (segments.has('full')) return 'full'
      return 'solo'
    })
  }, [plans])

  useEffect(() => {
    if (!selectedPlanId || catalogSegment === null) return
    const row = plans.find((p) => p.id === selectedPlanId)
    if (!row || row.catalogSegment !== catalogSegment) {
      setSelectedPlanId(null)
      setIsPlanFlipped(false)
    }
  }, [catalogSegment, plans, selectedPlanId])

  useEffect(() => {
    return () => {
      if (flipTimerRef.current != null) window.clearTimeout(flipTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const apply = () => {
      const mobile = media.matches
      setIsMobile(mobile)
      if (!mobile) setMobileStep('plans')
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (!isMobile) return
    document.body.style.overflow = mobileStep === 'detail' ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobile, mobileStep])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase
        .from('web_intake_catalog_settings')
        .select(
          'testimonial_videos, intake_slots_open, intake_slots_remaining, intake_slots_public_message, solo_segment_image_url, with_nutritionist_segment_image_url, cris_solo_segment_image_url, modality_label_solo, modality_label_with_nutritionist, modality_label_full',
        )
        .eq('id', 1)
        .maybeSingle()
      if (!mounted) return
      if (data) {
        const d = data as Record<string, unknown>
        setPublicSpots({
          slotsOpen: d.intake_slots_open !== false,
          slotsRemaining: typeof d.intake_slots_remaining === 'number' ? d.intake_slots_remaining : null,
          slotsMessage: typeof d.intake_slots_public_message === 'string' ? d.intake_slots_public_message : null,
        })
        setTestimonialVideos(((data.testimonial_videos as string[] | null) ?? []).filter(Boolean))
        const str = (k: string) => (typeof d[k] === 'string' && (d[k] as string).trim() ? (d[k] as string).trim() : null)
        setCatalogSegmentImages({
          solo: str('solo_segment_image_url'),
          withNutritionist: str('with_nutritionist_segment_image_url'),
          crisSolo: str('cris_solo_segment_image_url'),
        })
        setModalityLabels({
          solo: typeof d.modality_label_solo === 'string' && d.modality_label_solo.trim() ? d.modality_label_solo.trim() : null,
          withNutritionist:
            typeof d.modality_label_with_nutritionist === 'string' && d.modality_label_with_nutritionist.trim()
              ? d.modality_label_with_nutritionist.trim()
              : null,
          full: typeof d.modality_label_full === 'string' && d.modality_label_full.trim() ? d.modality_label_full.trim() : null,
        })
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setCatalogLoading(true)
      setCatalogError(null)
      const { data, error } = await supabase
        .from('web_plans')
        .select(
          'slug, title, price_label, price_yearly_label, price_3m_label, price_6m_label, short_description, intro_text, includes_items, gifts_items, sort_order, is_active, show_in_public_intake, catalog_segment, display_badge, credential_line_override',
        )
        .eq('is_active', true)
        .eq('show_in_public_intake', true)
        .order('sort_order')
      if (!mounted) return
      setCatalogLoading(false)
      if (error) {
        setCatalogError('No pudimos actualizar los precios desde el servidor. Se muestran valores por defecto.')
        setPlans(mergePublicIntakePlansFromDb([]))
        return
      }
      type Row = Pick<
        WebPlan,
        | 'slug'
        | 'title'
        | 'price_label'
        | 'price_yearly_label'
        | 'price_3m_label'
        | 'price_6m_label'
        | 'short_description'
        | 'intro_text'
        | 'includes_items'
        | 'gifts_items'
        | 'sort_order'
        | 'is_active'
        | 'catalog_segment'
        | 'display_badge'
        | 'credential_line_override'
      >
      const mapped: PlanDetail[] = ((data as Row[]) ?? []).map((row) => {
        const id = row.slug
        const rawSeg = String(row.catalog_segment ?? 'solo')
        const segment: WebPlanCatalogSegment =
          rawSeg === 'with_nutritionist' || rawSeg === 'with_cris' ? 'with_nutritionist'
          : rawSeg === 'full' ? 'full'
          : 'solo'
        const displayBadge = row.display_badge ?? null
        const credentialLineOverride = row.credential_line_override ?? null
        return {
          id,
          catalogSegment: segment,
          displayBadge,
          credentialLineOverride,
          name: row.title,
          price: row.price_label,
          priceYearly: row.price_yearly_label ?? null,
          price3mLabel: row.price_3m_label ?? null,
          price6mLabel: row.price_6m_label ?? null,
          badge: planCardBadge({ id, displayBadge }),
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
        setCatalogError(null)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  function clearFlipTimer() {
    if (flipTimerRef.current != null) {
      window.clearTimeout(flipTimerRef.current)
      flipTimerRef.current = null
    }
  }

  /** Elige plan en la lista estilo pricing (Watermelon): no voltea el panel; usa Continuar para eso. */
  function handlePickPlan(planId: string) {
    clearFlipTimer()
    setIsPlanFlipped(false)
    setSelectedPlanId(planId)
  }

  function scrollIntakeToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openMobilePlanDetail(planId?: string) {
    if (planId) setSelectedPlanId(planId)
    setMobileStep('detail')
    scrollIntakeToTop()
  }

  function handleSelectPlan(planId: string) {
    if (isMobile) {
      if (selectedPlanId === planId && mobileStep === 'detail') {
        handleBackToForm()
        return
      }
      openMobilePlanDetail(planId)
      return
    }

    if (selectedPlanId === planId && isPlanFlipped) {
      handleBackToForm()
      return
    }

    clearFlipTimer()
    setIsPlanFlipped(false)
    flipTimerRef.current = window.setTimeout(() => {
      setSelectedPlanId(planId)
      setIsPlanFlipped(true)
      flipTimerRef.current = null
    }, 300)
  }

  function handleBackToForm() {
    clearFlipTimer()
    setIsPlanFlipped(false)
    if (isMobile) {
      setMobileStep('form')
      scrollIntakeToTop()
      return
    }
    flipTimerRef.current = window.setTimeout(() => {
      flipTimerRef.current = null
    }, 320)
  }

  function renderIntakeForm() {
    const compact = isMobile
    return (
      <>
        {/* Banner de cupos: en mobile solo si hay algo importante que mostrar */}
        {(!compact || !publicSpots.slotsOpen || publicSpots.slotsRemaining !== null) ? (
          <IntakeSlotsBanner spots={publicSpots} compact={compact} />
        ) : null}
        {/* Testimonios solo en desktop (en mobile suman demasiado ruido visual) */}
        {!compact ? <TestimonialsSection urls={testimonialVideos} /> : null}
        {intakeKind === 'nutricion' ? (
          <IntakeNutritionForm
            selectedPlanSlug={selectedPlanId}
            selectedPlanLabel={selectedPlan?.name ?? null}
            selectedPlanPrice={selectedPlan ? displayPriceForPlan(selectedPlan, planBilling) : null}
            onSuccess={() => setDone(true)}
            compact={compact}
          />
        ) : intakeKind === 'full' ? (
          <IntakeFullForm
            selectedPlanSlug={selectedPlanId}
            selectedPlanLabel={selectedPlan?.name ?? null}
            selectedPlanPrice={selectedPlan ? displayPriceForPlan(selectedPlan, planBilling) : null}
            onSuccess={() => setDone(true)}
            compact={compact}
          />
        ) : (
          <IntakeFersterForm
            selectedPlanSlug={selectedPlanId}
            selectedPlanLabel={selectedPlan?.name ?? null}
            selectedPlanPrice={selectedPlan ? displayPriceForPlan(selectedPlan, planBilling) : null}
            onSuccess={() => setDone(true)}
            compact={compact}
          />
        )}
      </>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-4 pt-16 sm:pt-4 py-10 relative">
        <PublicIntakeTopActions />
        <div className="w-full max-w-[1040px] rounded-none sm:rounded-3xl overflow-hidden border-0 sm:border border-surface-border bg-surface-card shadow-none sm:shadow-card dark:sm:shadow-lg flex flex-col lg:flex-row min-h-screen sm:min-h-0">
          <LeftBrandPanel
            theme={theme}
            plansAll={plans}
            plansVisible={plansVisible}
            catalogSegment={catalogSegment}
            onSelectCatalogSegment={setCatalogSegment}
            selectedPlanId={selectedPlanId}
            onSelectPlan={handlePickPlan}
            planBilling={planBilling}
            onPlanBillingChange={setPlanBilling}
            onConfirmPlan={() => {}}
            soloSegmentImageUrl={catalogSegmentImages.solo}
            withNutritionistSegmentImageUrl={catalogSegmentImages.withNutritionist}
            crisSoloSegmentImageUrl={catalogSegmentImages.crisSolo}
            modalityOptions={modalityOptions}
            catalogError={catalogError}
            catalogLoading={catalogLoading}
          />
          <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-14 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200/90 dark:bg-white/[0.08]">
              <CheckCircle2 className="h-9 w-9 text-zinc-600 dark:text-zinc-400" aria-hidden />
            </div>
            <h1 className="text-2xl font-bold text-ink-primary tracking-tight mb-2">Recibimos tus datos</h1>
            <p className="text-ink-secondary text-sm max-w-sm leading-relaxed">
              Gracias por tu interés. El equipo de Haciéndolo hábito se va a comunicar con vos a la brevedad.
            </p>
            <p className="text-ink-muted text-xs mt-8">Podés cerrar esta pestaña.</p>
          </div>
        </div>
      </div>
    )
  }

  const leftPanelProps = {
    theme,
    plansAll: plans,
    plansVisible,
    catalogSegment,
    onSelectCatalogSegment: setCatalogSegment,
    selectedPlanId,
    onSelectPlan: handlePickPlan,
    planBilling,
    onPlanBillingChange: setPlanBilling,
    onConfirmPlan: () => {
      if (!selectedPlanId) return
      if (isMobile) {
        // Ir directo al formulario; el detalle se puede ver desde ahí con un enlace
        setMobileStep('form')
        scrollIntakeToTop()
      } else {
        handleSelectPlan(selectedPlanId)
      }
    },
    buttonText: isMobile ? 'Continuar →' : 'Ver detalle',
    soloSegmentImageUrl: catalogSegmentImages.solo,
    withNutritionistSegmentImageUrl: catalogSegmentImages.withNutritionist,
    crisSoloSegmentImageUrl: catalogSegmentImages.crisSolo,
    modalityOptions,
    catalogError,
    catalogLoading,
  } as const

  const mobileBack =
    isMobile && mobileStep === 'form'
      ? { label: 'Planes', onBack: () => { setMobileStep('plans'); scrollIntakeToTop() } }
      : isMobile && mobileStep === 'detail'
        ? { label: 'Formulario', onBack: () => { setMobileStep('form'); scrollIntakeToTop() } }
        : null

  const intakeTopTone: 'light' | 'dark' =
    isMobile && mobileStep === 'plans' && theme === 'dark' ? 'dark' : 'light'

  return (
    <div className="min-h-screen bg-surface-base flex items-start justify-center sm:items-center p-0 sm:p-4 sm:pt-4 sm:py-8 md:py-12 relative">
      <PublicIntakeTopActions
        backLabel={mobileBack?.label}
        onBack={mobileBack?.onBack}
        tone={intakeTopTone}
      />
      {isMobile ? (
        <div
          className={cn(
            'relative w-full min-h-screen flex flex-col bg-surface-base',
            mobileStep === 'plans' ? 'pt-0' : 'pt-14',
          )}
        >
          {mobileStep === 'plans' ? <LeftBrandPanel {...leftPanelProps} /> : null}

          {mobileStep === 'detail' && selectedPlan ? (
            <div className="fixed inset-0 z-40 flex flex-col bg-surface-base pt-14">
              <div className="flex-1 min-h-0">
                <PlanDetailView
                  panelId="intake-plan-detail-mobile"
                  plan={selectedPlan}
                  planBilling={planBilling}
                  onBack={handleBackToForm}
                />
              </div>
            </div>
          ) : null}

          {mobileStep === 'form' ? (
            <div id="intake-form-panel" className="flex-1 flex flex-col min-h-screen bg-surface-base pt-14">
              <div className="px-4 pt-2 pb-16 flex-1">
                {/* Pill del plan elegido — compacto y sin ruido */}
                {selectedPlan ? (
                  <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-surface-border bg-surface-card px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink-primary leading-tight">
                        {selectedPlan.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-muted tabular-nums">
                        {displayPriceForPlan(selectedPlan, planBilling)} <span className="text-ink-muted/60">·</span> {planBillingCaption(planBilling)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => { setMobileStep('detail'); scrollIntakeToTop() }}
                        className="text-[11px] font-medium text-ink-muted hover:text-ink-secondary"
                      >
                        Detalle
                      </button>
                      <span className="text-ink-muted/40 text-[10px]" aria-hidden>|</span>
                      <button
                        type="button"
                        onClick={() => { setMobileStep('plans'); scrollIntakeToTop() }}
                        className="text-[11px] font-medium text-ink-muted hover:text-ink-secondary"
                      >
                        Cambiar
                      </button>
                    </div>
                  </div>
                ) : null}
                {renderIntakeForm()}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="w-full max-w-[1040px] rounded-none sm:rounded-3xl overflow-hidden border-0 sm:border border-surface-border bg-surface-card shadow-none sm:shadow-card dark:sm:shadow-lg flex flex-col lg:flex-row min-h-screen sm:min-h-0">
          <LeftBrandPanel {...leftPanelProps} />
          <div className="flex-1 flex flex-col px-4 sm:px-8 lg:px-10 py-6 sm:py-8 lg:py-12 lg:pr-12 lg:overflow-y-auto lg:max-h-[min(100vh-2rem,1200px)]">
            <div className="flex-1" style={{ perspective: '1600px' }}>
              <div
                className="relative transition-transform duration-700"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: isPlanFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                <div style={{ backfaceVisibility: 'hidden' }} className="scrollbar-hide">
                  {renderIntakeForm()}
                </div>
                <div
                  className="absolute inset-0 scrollbar-hide"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  {selectedPlan ? (
                    <PlanDetailView plan={selectedPlan} planBilling={planBilling} onBack={handleBackToForm} />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

