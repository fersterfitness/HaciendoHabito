import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggleMoonIcon, ThemeToggleSunIcon } from '@/components/ui/ThemeToggleIcons'
import { useTheme } from '@/contexts/ThemeContext'
import { BrandLogo } from '@/components/branding/BrandLogo'
import { IntakeFersterForm } from '@/pages/public/IntakeFersterForm'
import { IntakeNutritionForm } from '@/pages/public/IntakeNutritionForm'
import { IntakeFullForm } from '@/pages/public/IntakeFullForm'
import { supabase } from '@/lib/supabase'
import { IntakeChangeablePlansSection } from '@/components/public/IntakeChangeablePlansSection'
import { IntakeSuccessScreen } from '@/components/public/IntakeSuccessScreen'
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
import {
  intakePanelGroupLabelClass,
  intakePanelSegmentIdleClass,
  intakePanelSegmentSelectedClass,
  intakePanelSurfaceClass,
} from '@/lib/intake/intakePanelUi'
import {
  findIntakeProfessional,
  fullPlanCredentialLine,
  INTAKE_NUTRITION_SLUG_DEFAULT,
  INTAKE_TRAINER_SLUG_DEFAULT,
  mergeIntakeNutritionistsFromDb,
  mergeIntakeTrainersFromDb,
  type IntakeProfessional,
  type PublicIntakeProfessionalRow,
} from '@/lib/intake/intakeProfessionals'

/** Defaults si no hay fila en `web_intake_catalog_settings`. */
const DEFAULT_INTAKE_MODALITY_LABELS = {
  solo: 'FERSTER FITNESS',
  withNutritionist: 'NUTRICIÓN',
  full: 'PLAN FULL (ENTRENO + NUTRICIÓN)',
} as const

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
      'flex min-h-[2.75rem] min-w-0 flex-1 touch-manipulation items-center justify-center rounded-xl border px-2 py-2 transition-all',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary/35 focus-visible:ring-offset-0',
      'text-center text-[12px] font-semibold leading-tight',
      isSelected ? intakePanelSegmentSelectedClass(theme) : intakePanelSegmentIdleClass(theme),
    )

  const emptyClasses = isDark
    ? 'border-white/12 !text-white/40'
    : 'border-surface-border text-ink-muted'

  const compactBtnClasses = (isSelected: boolean) =>
    isDark
      ? isSelected
        ? 'border-brand-secondary/45 bg-brand-secondary/12 ring-1 ring-brand-secondary/28'
        : 'border-white/12 bg-white/[0.025] hover:border-brand-secondary/30 hover:bg-brand-secondary/8'
      : isSelected
        ? 'border-brand-secondary/35 bg-brand-secondary/8 ring-1 ring-brand-secondary/20 shadow-sm'
        : 'border-surface-border bg-surface-card hover:border-brand-secondary/25 hover:bg-surface-elevated'

  const compactNameClass = isDark ? '!text-white' : 'text-ink-primary'
  const compactSubtitleClass = isDark ? '!text-white/55' : 'text-ink-muted'
  const detailClass = isDark ? '!text-white/50' : 'text-ink-muted'

  return (
    <div className="min-w-0">
      <p id={labelId} className={intakePanelGroupLabelClass(theme)}>
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
                isDark ? 'focus-visible:ring-brand-secondary/40' : 'focus-visible:ring-brand-secondary/35',
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
  selectedTrainer,
  selectedNutritionist,
}: {
  plan: PlanDetail
  planBilling: PlanBilling
  onBack: () => void
  panelId?: string
  selectedTrainer: IntakeProfessional | null
  selectedNutritionist: IntakeProfessional | null
}) {
  const credentialFallback =
    plan.catalogSegment === 'with_nutritionist'
      ? selectedNutritionist?.credentialLine
      : plan.catalogSegment === 'full'
        ? fullPlanCredentialLine(selectedTrainer, selectedNutritionist)
        : selectedTrainer?.credentialLine
  return (
    <div
      id={panelId}
      className={cn(
        'w-full min-w-0',
        panelId ? 'h-full max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain scrollbar-hide pb-28' : 'pb-8 lg:pb-10',
      )}
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
        ) : credentialFallback?.trim() ? (
          <p className="mt-4 border-l-2 border-white/35 pl-3 text-sm font-medium leading-relaxed text-white/90">
            {credentialFallback.trim()}
          </p>
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
              'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(169,121,255,0.1), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(200,120,255,0.06), transparent 45%)',
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
    : 'border-surface-border bg-surface-card text-ink-secondary hover:border-brand-secondary/40 hover:text-brand-secondary'

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
  publicSpots,
  trainers,
  nutritionists,
  trainerChoice,
  onTrainerChoiceChange,
  nutritionChoice,
  onNutritionChoiceChange,
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
  publicSpots?: PublicIntakeSlots
  trainers: IntakeProfessional[]
  nutritionists: IntakeProfessional[]
  trainerChoice: string
  onTrainerChoiceChange: (slug: string) => void
  nutritionChoice: string
  onNutritionChoiceChange: (slug: string) => void
}) {
  const hasPlansForSegment = (seg: WebPlanCatalogSegment) => plansAll.some((p) => p.catalogSegment === seg)
  const panelTheme = appTheme
  const isDarkPanel = panelTheme === 'dark'

  const modalitySegment: WebPlanCatalogSegment =
    catalogSegment !== null && modalityOptions.some((o) => o.segment === catalogSegment)
      ? catalogSegment
      : 'solo'

  const includeTraining = modalitySegment === 'solo' || modalitySegment === 'full'
  const includeNutrition = modalitySegment === 'with_nutritionist' || modalitySegment === 'full'

  const nutritionAvatarUrl: string | null =
    modalitySegment === 'with_nutritionist'
      ? crisSoloSegmentImageUrl ?? withNutritionistSegmentImageUrl
      : withNutritionistSegmentImageUrl

  const trainerAvatarOptions: IntakeAvatarOption[] = useMemo(
    () =>
      trainers.map((o) => ({
        id: o.slug,
        label: o.fullName,
        avatarUrl:
          o.slug === INTAKE_TRAINER_SLUG_DEFAULT ? soloSegmentImageUrl : null,
      })),
    [soloSegmentImageUrl, trainers],
  )

  const nutritionAvatarOptions: IntakeAvatarOption[] = useMemo(
    () =>
      nutritionists.map((o) => ({
        id: o.slug,
        label: o.fullName,
        avatarUrl:
          o.slug === INTAKE_NUTRITION_SLUG_DEFAULT ? nutritionAvatarUrl : null,
      })),
    [nutritionAvatarUrl, nutritionists],
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
      trainerAvatarOptions.map((o) => {
        const pro = trainers.find((t) => t.slug === o.id)
        return {
          id: o.id,
          title: o.label.split(/\s+/)[0] ?? o.label,
          detail: '',
          subtitle: pro?.credentialLine ?? '',
          avatarUrl: o.avatarUrl,
          avatarLabel: o.label,
        }
      }),
    [trainerAvatarOptions, trainers],
  )

  const nutritionChoiceOptions = useMemo<IntakeHorizontalChoiceOption[]>(
    () =>
      nutritionAvatarOptions.map((o) => {
        const pro = nutritionists.find((n) => n.slug === o.id)
        return {
          id: o.id,
          title: o.label.split(/\s+/)[0] ?? o.label,
          detail: '',
          subtitle: pro?.credentialLine ?? '',
          avatarUrl: o.avatarUrl,
          avatarLabel: o.label,
        }
      }),
    [nutritionAvatarOptions, nutritionists],
  )

  return (
    <div className="relative min-w-0 flex-shrink-0 lg:w-[48%] lg:self-start">
      <HeroBgLayers theme={panelTheme} />

      <div className="relative z-[2] flex flex-col px-4 pt-4 pb-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-visible [-webkit-overflow-scrolling:touch] min-w-0 max-lg:max-h-[calc(100dvh-4rem)] lg:overflow-visible">
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
            <div className="relative flex items-center justify-center gap-3 sm:justify-start">
              {isDarkPanel ? (
                <div
                  className="pointer-events-none absolute left-1/2 top-4 h-28 w-[min(100%,18rem)] -translate-x-1/2 rounded-full bg-brand-secondary/20 opacity-40 blur-3xl sm:left-[12%] sm:translate-x-0"
                  aria-hidden
                />
              ) : (
                <div
                  className="pointer-events-none absolute -left-4 top-0 h-20 w-32 rounded-full bg-brand-secondary/15 blur-2xl"
                  aria-hidden
                />
              )}
              <BrandLogo size="sm" decorative className="relative z-[1] h-9 w-9 shrink-0" />
              <div className="relative z-[1] min-w-0">
                <p
                  className={cn(
                    'truncate text-base font-bold leading-tight tracking-tight',
                    isDarkPanel ? 'text-white' : 'text-ink-primary',
                  )}
                >
                  Haciéndolo hábito
                </p>
                <p className={cn('text-[11px]', isDarkPanel ? 'text-white/50' : 'text-ink-muted')}>
                  Elegí modalidad y plan
                </p>
              </div>
            </div>

            <div className={intakePanelSurfaceClass(panelTheme)}>
              <div className="space-y-3.5">
                <IntakeHorizontalChoiceRow
                  groupId="intake-modality"
                  groupLabel="Modalidad"
                  theme={panelTheme}
                  value={modalitySegment}
                  onChange={(seg) => onSelectCatalogSegment(seg as WebPlanCatalogSegment)}
                  options={modalityChoiceOptions}
                />

                {/* En mobile se ocultan: son valores fijos de un solo profesional
                    que suman ruido visual sin aportar decisión al usuario. */}
                <div className="hidden lg:block space-y-3.5">
                  <IntakeHorizontalChoiceRow
                    groupId="intake-trainer"
                    groupLabel="Entrenador"
                    theme={panelTheme}
                    value={includeTraining ? trainerChoice : ''}
                    disabled={!includeTraining}
                    emptyLabel="No aplica"
                    onChange={onTrainerChoiceChange}
                    options={trainerChoiceOptions}
                  />

                  <IntakeHorizontalChoiceRow
                    groupId="intake-nutrition"
                    groupLabel="Nutricionista"
                    theme={panelTheme}
                    value={includeNutrition ? nutritionChoice : ''}
                    disabled={!includeNutrition}
                    emptyLabel="No aplica"
                    onChange={onNutritionChoiceChange}
                    options={nutritionChoiceOptions}
                  />
                </div>
              </div>

              {plansVisible.length > 0 ? (
                <>
                  <div
                    id="intake-offers-section"
                    className={cn(
                      'my-4 border-t pt-1',
                      isDarkPanel ? 'border-white/[0.06]' : 'border-surface-border',
                    )}
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
                  {publicSpots ? (
                    <div className="mt-3 hidden lg:block">
                      <IntakeSlotsBanner spots={publicSpots} compact />
                    </div>
                  ) : null}
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
  const [trainers, setTrainers] = useState<IntakeProfessional[]>(() => mergeIntakeTrainersFromDb([]))
  const [nutritionists, setNutritionists] = useState<IntakeProfessional[]>(() =>
    mergeIntakeNutritionistsFromDb([]),
  )
  const [trainerChoice, setTrainerChoice] = useState(INTAKE_TRAINER_SLUG_DEFAULT)
  const [nutritionChoice, setNutritionChoice] = useState(INTAKE_NUTRITION_SLUG_DEFAULT)
  const modalityOptions = useMemo(() => buildIntakeModalityOptions(modalityLabels), [modalityLabels])
  const selectedTrainer = useMemo(
    () => findIntakeProfessional(trainers, trainerChoice),
    [trainers, trainerChoice],
  )
  const selectedNutritionist = useMemo(
    () => findIntakeProfessional(nutritionists, nutritionChoice),
    [nutritionists, nutritionChoice],
  )
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
    if (trainers.length > 0 && !trainers.some((t) => t.slug === trainerChoice)) {
      setTrainerChoice(trainers[0]!.slug)
    }
  }, [trainers, trainerChoice])

  useEffect(() => {
    if (nutritionists.length > 0 && !nutritionists.some((n) => n.slug === nutritionChoice)) {
      setNutritionChoice(nutritionists[0]!.slug)
    }
  }, [nutritionists, nutritionChoice])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: proRows } = await supabase.rpc('list_public_intake_professionals')
      if (mounted && proRows && Array.isArray(proRows)) {
        const rows = proRows as PublicIntakeProfessionalRow[]
        setTrainers(mergeIntakeTrainersFromDb(rows))
        setNutritionists(mergeIntakeNutritionistsFromDb(rows))
      }

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

  /** Elige plan en la lista estilo pricing (Watermelon): no voltea el panel; usa Continuar para eso. */
  function handlePickPlan(planId: string) {
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

    setSelectedPlanId(planId)
    setIsPlanFlipped(true)
    scrollIntakeToTop()
  }

  function handleBackToForm() {
    setIsPlanFlipped(false)
    if (isMobile) {
      setMobileStep('form')
      scrollIntakeToTop()
    }
  }

  const onRequestChangePlan = useCallback(() => {
    if (isMobile) {
      setMobileStep('plans')
      scrollIntakeToTop()
      return
    }
    if (isPlanFlipped) handleBackToForm()
    document.getElementById('intake-offers-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [isMobile, isPlanFlipped])

  function renderIntakeForm() {
    const compact = isMobile
    const showMobileSlotsBanner =
      compact &&
      (!publicSpots.slotsOpen ||
        publicSpots.slotsRemaining !== null ||
        Boolean(publicSpots.slotsMessage?.trim()))
    return (
      <>
        {showMobileSlotsBanner ? <IntakeSlotsBanner spots={publicSpots} compact /> : null}
        {intakeKind === 'nutricion' ? (
          <IntakeNutritionForm
            selectedPlanSlug={selectedPlanId}
            selectedPlanLabel={selectedPlan?.name ?? null}
            selectedPlanPrice={selectedPlan ? displayPriceForPlan(selectedPlan, planBilling) : null}
            selectedNutritionist={selectedNutritionist}
            onSuccess={() => setDone(true)}
            compact={compact}
            onRequestChangePlan={onRequestChangePlan}
          />
        ) : intakeKind === 'full' ? (
          <IntakeFullForm
            selectedPlanSlug={selectedPlanId}
            selectedPlanLabel={selectedPlan?.name ?? null}
            selectedPlanPrice={selectedPlan ? displayPriceForPlan(selectedPlan, planBilling) : null}
            selectedTrainer={selectedTrainer}
            selectedNutritionist={selectedNutritionist}
            onSuccess={() => setDone(true)}
            compact={compact}
            onRequestChangePlan={onRequestChangePlan}
          />
        ) : (
          <IntakeFersterForm
            selectedPlanSlug={selectedPlanId}
            selectedPlanLabel={selectedPlan?.name ?? null}
            selectedPlanPrice={selectedPlan ? displayPriceForPlan(selectedPlan, planBilling) : null}
            selectedTrainer={selectedTrainer}
            onSuccess={() => setDone(true)}
            compact={compact}
            onRequestChangePlan={onRequestChangePlan}
          />
        )}
        {!compact && testimonialVideos.length > 0 ? (
          <div className="mt-10 border-t border-surface-border/60 pt-8">
            <TestimonialsSection urls={testimonialVideos} />
          </div>
        ) : null}
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
            trainers={trainers}
            nutritionists={nutritionists}
            trainerChoice={trainerChoice}
            onTrainerChoiceChange={setTrainerChoice}
            nutritionChoice={nutritionChoice}
            onNutritionChoiceChange={setNutritionChoice}
          />
          <IntakeSuccessScreen planName={selectedPlan?.name ?? null} className="flex-1" />
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
    publicSpots,
    trainers,
    nutritionists,
    trainerChoice,
    onTrainerChoiceChange: setTrainerChoice,
    nutritionChoice,
    onNutritionChoiceChange: setNutritionChoice,
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
                  selectedTrainer={selectedTrainer}
                  selectedNutritionist={selectedNutritionist}
                />
              </div>
            </div>
          ) : null}

          {mobileStep === 'form' ? (
            <div
              id="intake-form-panel"
              className="relative flex min-h-screen flex-1 flex-col bg-gradient-to-b from-brand-secondary/[0.08] via-surface-base to-surface-base pt-14"
            >
              <div className="relative z-[1] flex-1 px-4 pt-2 pb-[max(4rem,env(safe-area-inset-bottom))]">
                {selectedPlan ? (
                  <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-brand-secondary/25 bg-surface-card/90 px-3.5 py-2.5 shadow-sm backdrop-blur-sm">
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-brand-secondary">Tu plan</p>
                      <p className="truncate text-sm font-semibold text-ink-primary leading-tight">
                        {selectedPlan.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-ink-muted tabular-nums">
                        {displayPriceForPlan(selectedPlan, planBilling)} · {planBillingCaption(planBilling)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onRequestChangePlan}
                      className="shrink-0 rounded-lg border border-brand-secondary/35 bg-brand-secondary/10 px-2.5 py-1.5 text-[11px] font-semibold text-brand-secondary"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : null}
                {renderIntakeForm()}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex w-full max-w-[1040px] min-h-screen flex-col overflow-hidden rounded-none border-0 bg-surface-card shadow-none sm:min-h-0 sm:rounded-3xl sm:border sm:border-surface-border sm:shadow-card dark:sm:shadow-lg lg:min-h-0 lg:flex-row lg:items-start lg:overflow-visible">
          <LeftBrandPanel {...leftPanelProps} />
          <div className="relative flex min-w-0 flex-1 flex-col self-stretch px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-12 lg:pr-12">
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-secondary/[0.06] via-transparent to-brand-tertiary/[0.04]"
              aria-hidden
            />
            <div className="relative z-[1] w-full min-w-0">
              {isPlanFlipped && selectedPlan ? (
                <PlanDetailView
                  plan={selectedPlan}
                  planBilling={planBilling}
                  onBack={handleBackToForm}
                  selectedTrainer={selectedTrainer}
                  selectedNutritionist={selectedNutritionist}
                />
              ) : (
                renderIntakeForm()
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

