import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggleMoonIcon, ThemeToggleSunIcon } from '@/components/ui/ThemeToggleIcons'
import { useTheme } from '@/contexts/ThemeContext'
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
  withCris: 'NUTRICIÓN',
  full: 'PLAN FULL (ENTRENO + NUTRICIÓN)',
} as const

function buildIntakeModalityOptions(labels: {
  solo: string | null
  withCris: string | null
  full: string | null
}): { segment: WebPlanCatalogSegment; label: string }[] {
  return [
    { segment: 'solo', label: labels.solo?.trim() || DEFAULT_INTAKE_MODALITY_LABELS.solo },
    { segment: 'with_cris', label: labels.withCris?.trim() || DEFAULT_INTAKE_MODALITY_LABELS.withCris },
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

/** Cuadrado con esquinas redondeadas (alineado a inputs / tarjetas), no óvalo ni cápsula. */
function IntakeProAvatar({
  label,
  url,
  sizeClass = 'h-8 w-8',
  theme = 'dark',
}: {
  label: string
  url?: string | null
  sizeClass?: string
  theme?: 'light' | 'dark'
}) {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
  }, [url])
  const showImg = Boolean(url?.trim() && !failed)
  return showImg ? (
    <img
      src={url!.trim()}
      alt=""
      className={cn(
        sizeClass,
        'shrink-0 rounded-lg object-cover object-top ring-1',
        theme === 'light' ? 'ring-neutral-200/80' : 'ring-white/20',
      )}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
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

/**
 * Selector con foto al lado del nombre (el `<select>` nativo no permite imágenes en opciones).
 */
function IntakeAvatarSelect({
  id,
  label,
  hint,
  value,
  disabled = false,
  onChange,
  theme,
  options,
  emptyLabel = 'No aplica',
}: {
  id: string
  label: string
  hint?: string
  value: string
  disabled?: boolean
  onChange: (v: string) => void
  theme: 'light' | 'dark'
  options: IntakeAvatarOption[]
  /** Texto cuando está deshabilitado o sin opciones. */
  emptyLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = `${id}-listbox`

  const selected = options.find((o) => o.id === value)

  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const triggerClass = cn(
    'relative flex w-full items-center gap-2 rounded-lg border px-2.5 py-[0.42rem] pr-9 text-left text-[13px] leading-tight transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-38',
    theme === 'dark'
      ? 'border-white/[0.08] bg-[#141414] text-white shadow-none focus:border-white/30 focus:ring-white/20 disabled:border-white/[0.05] disabled:bg-[#141414]'
      : 'border-neutral-200/95 bg-white/95 text-neutral-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_1px_2px_rgba(15,23,42,0.05)] focus:border-neutral-300 focus:ring-neutral-400/30 disabled:bg-neutral-100/85 disabled:text-neutral-500',
    disabled && 'cursor-not-allowed',
    !disabled &&
      options.length > 0 &&
      (theme === 'dark' ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-pointer hover:bg-neutral-50/95'),
  )

  const showTriggerContent = !disabled && options.length > 0 && selected

  const labelClass =
    theme === 'dark'
      ? 'text-white/42'
      : 'text-neutral-600'

  return (
    <div ref={rootRef} className="min-w-0">
      <label htmlFor={id} className={cn('mb-0.5 block text-[8px] font-semibold uppercase tracking-[0.13em]', labelClass)}>
        {label}
      </label>
      <div className="relative">
        <button
          id={id}
          type="button"
          disabled={disabled || options.length === 0}
          title={hint}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => {
            if (disabled || options.length === 0) return
            setOpen((o) => !o)
          }}
          className={triggerClass}
        >
          {showTriggerContent ? (
            <>
              <IntakeProAvatar theme={theme} label={selected!.label} url={selected.avatarUrl} />
              <span className="min-w-0 flex-1 truncate">{selected!.label}</span>
            </>
          ) : (
            <span
              className={cn(
                'min-w-0 flex-1 truncate',
                theme === 'dark' ? 'text-white/55' : 'text-neutral-500',
              )}
            >
              {disabled || options.length === 0 ? emptyLabel : '—'}
            </span>
          )}
        </button>
        <span
          className={cn(
            'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px]',
            theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500',
          )}
          aria-hidden
        >
          ▾
        </span>

        {open && options.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className={cn(
              'absolute left-0 right-0 top-[calc(100%+4px)] z-[80] max-h-60 overflow-auto rounded-lg border py-1',
              theme === 'dark'
                ? 'border-white/[0.14] bg-[#0f0f0f] shadow-xl'
                : 'border-neutral-200/95 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.14),0_2px_8px_rgba(15,23,42,0.06)]',
            )}
          >
            {options.map((o) => (
              <li key={o.id} role="option" aria-selected={value === o.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-[13px] transition-colors',
                    theme === 'dark'
                      ? cn('text-white', value === o.id ? 'bg-white/12' : 'hover:bg-white/10')
                      : cn(
                          'text-neutral-900',
                          value === o.id ? 'bg-neutral-100' : 'hover:bg-neutral-50',
                        ),
                  )}
                  onClick={() => {
                    onChange(o.id)
                    setOpen(false)
                  }}
                >
                  <IntakeProAvatar theme={theme} label={o.label} url={o.avatarUrl} />
                  <span className="min-w-0 flex-1">{o.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

function IntakeMinimalSelect({
  id,
  label,
  hint,
  value,
  disabled = false,
  onChange,
  children,
  theme,
}: {
  id: string
  label: string
  hint?: string
  value: string
  disabled?: boolean
  onChange: (v: string) => void
  children: ReactNode
  theme: 'light' | 'dark'
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className={cn(
          'mb-0.5 block text-[8px] font-semibold uppercase tracking-[0.13em]',
          theme === 'dark' ? 'text-white/42' : 'text-neutral-600',
        )}
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          disabled={disabled}
          value={value}
          title={hint}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full appearance-none rounded-lg border px-3 py-[0.42rem] pr-9 text-[13px] leading-tight transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-38',
            theme === 'dark'
              ? 'border-white/[0.08] bg-[#141414] text-white shadow-none focus:border-white/30 focus:ring-white/20 disabled:border-white/[0.05] disabled:bg-[#141414]'
              : 'border-neutral-200/95 bg-white/95 text-neutral-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_1px_2px_rgba(15,23,42,0.05)] focus:border-neutral-300 focus:ring-neutral-400/30 disabled:cursor-not-allowed disabled:bg-neutral-100/85 disabled:text-neutral-500',
            disabled && 'cursor-not-allowed',
          )}
        >
          {children}
        </select>
        <span
          className={cn(
            'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px]',
            theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500',
          )}
          aria-hidden
        >
          ▾
        </span>
      </div>
    </div>
  )
}

type PublicIntakeSlots = {
  slotsOpen: boolean
  slotsRemaining: number | null
  slotsMessage: string | null
}

function IntakeSlotsBanner({ spots }: { spots: PublicIntakeSlots }) {
  const { slotsOpen, slotsRemaining, slotsMessage } = spots
  const trimmed = slotsMessage?.trim() || ''

  let title = 'Cupos disponibles'
  let body = trimmed || 'Hay lugar para nuevas consultas.'
  let tone = 'border-white/[0.26] bg-white/[0.11]'

  if (!slotsOpen) {
    title = 'Cupos cerrados por ahora'
    body = trimmed || 'En este momento no estamos tomando nuevas inscripciones. Podés igual dejar tus datos y te contactamos cuando haya lugar.'
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
}: {
  plan: PlanDetail
  planBilling: PlanBilling
  onBack: () => void
}) {
  return (
    <div className="h-full min-h-0 max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain scrollbar-hide px-1 pb-20 lg:pb-1">
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
        ) : plan.catalogSegment === 'with_cris' ? (
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

      <div className="lg:hidden fixed inset-x-4 bottom-4 z-20">
        <button
          type="button"
          onClick={onBack}
          className="w-full rounded-xl border border-white/16 bg-zinc-950/90 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)] hover:bg-white/[0.05]"
        >
          Continuar con este plan
        </button>
      </div>
    </div>
  )
}

function HeroBgLayers({ theme }: { theme: 'light' | 'dark' }) {
  const photo =
    'url(https://images.unsplash.com/photo-1509316785289-025f5cd90c3d?w=1400&q=88)'
  if (theme === 'light') {
    return (
      <>
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: photo }} />
          <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-slate-800/10 to-slate-950/88" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/45 via-transparent to-slate-800/20" />
        </div>
        <div
          className="absolute inset-0 z-[1] pointer-events-none opacity-35 mix-blend-overlay"
          style={{
            background:
              'radial-gradient(ellipse 120% 80% at 50% -10%, rgba(255,255,255,0.12), transparent 55%)',
          }}
        />
      </>
    )
  }
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

function PublicAuthTopBar() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface-card px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:border-zinc-400/50 hover:text-ink-primary dark:hover:border-zinc-500/50 shadow-sm"
      >
        Ir al panel
        <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </Link>
      <button
        type="button"
        onClick={toggleTheme}
        className="p-2 rounded-xl text-ink-muted hover:text-ink-primary hover:bg-surface-card border border-surface-border transition-all"
        title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
      >
        {theme === 'dark' ? <ThemeToggleSunIcon /> : <ThemeToggleMoonIcon />}
      </button>
    </div>
  )
}

/** Panel izquierdo: marca + selector de profesional + planes */
function LeftBrandPanel({
  theme,
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
  withCrisSegmentImageUrl,
  crisSoloSegmentImageUrl,
  modalityOptions,
}: {
  theme: 'light' | 'dark'
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
  withCrisSegmentImageUrl: string | null
  crisSoloSegmentImageUrl: string | null
  modalityOptions: { segment: WebPlanCatalogSegment; label: string }[]
}) {
  const hasPlansForSegment = (seg: WebPlanCatalogSegment) => plansAll.some((p) => p.catalogSegment === seg)

  const [trainerChoice, setTrainerChoice] = useState(INTAKE_TRAINER_OPTIONS[0]?.id ?? '')
  const [nutritionChoice, setNutritionChoice] = useState(INTAKE_NUTRITION_OPTIONS[0]?.id ?? '')

  const modalitySegment: WebPlanCatalogSegment =
    catalogSegment !== null && modalityOptions.some((o) => o.segment === catalogSegment)
      ? catalogSegment
      : 'solo'

  const includeTraining = modalitySegment === 'solo' || modalitySegment === 'full'
  const includeNutrition = modalitySegment === 'with_cris' || modalitySegment === 'full'

  const trainerAvatarOptions: IntakeAvatarOption[] = useMemo(
    () =>
      INTAKE_TRAINER_OPTIONS.map((o) => ({
        ...o,
        avatarUrl: o.id === 'tomas-ferster' ? soloSegmentImageUrl : null,
      })),
    [soloSegmentImageUrl],
  )

  const nutritionAvatarUrl: string | null =
    modalitySegment === 'with_cris'
      ? crisSoloSegmentImageUrl ?? withCrisSegmentImageUrl
      : withCrisSegmentImageUrl

  const nutritionAvatarOptions: IntakeAvatarOption[] = useMemo(
    () =>
      INTAKE_NUTRITION_OPTIONS.map((o) => ({
        ...o,
        avatarUrl: o.id === 'cris-crossetto' ? nutritionAvatarUrl : null,
      })),
    [nutritionAvatarUrl],
  )

  return (
    <div className="relative lg:w-[48%] min-h-0 lg:min-h-[min(100vh-2rem,860px)] flex-shrink-0 min-w-0">
      <HeroBgLayers theme={theme} />

      <div className="relative z-[2] flex h-full min-h-[inherit] flex-col px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-visible [-webkit-overflow-scrolling:touch] min-w-0">
          <div className="mx-auto w-full max-w-[min(400px,calc(100vw-2rem))] min-w-0 shrink-0 space-y-4">
            {/* Marca: una sola lectura */}
            <div className="relative flex items-center justify-center gap-2.5 sm:justify-start sm:gap-3">
              <div
                className="pointer-events-none absolute left-1/2 top-6 h-24 w-[min(100%,20rem)] -translate-x-1/2 rounded-full opacity-28 blur-3xl sm:left-[18%] sm:translate-x-0"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.1), transparent 72%)',
                }}
                aria-hidden
              />
              <img
                src="/logo-brand.png"
                alt="Haciéndolo hábito"
                className="relative z-[1] h-8 w-auto max-w-[120px] object-contain object-left opacity-95 sm:h-9 sm:max-w-[132px]"
              />
              <p className="relative z-[1] min-w-0 truncate text-[15px] font-bold leading-snug tracking-tight text-white/95 sm:text-base">
                Haciéndolo hábito
              </p>
            </div>

            {/* Superficie única: opciones + planes sin doble marco */}
            <div
              className={cn(
                'relative z-[1] rounded-2xl border p-4 backdrop-blur-md sm:p-[1.1rem]',
                theme === 'light'
                  ? 'border-white/45 bg-white/28 shadow-[0_10px_40px_rgba(15,23,42,0.11),inset_0_1px_0_rgba(255,255,255,0.72)]'
                  : 'border-white/[0.07] bg-black/38 shadow-none',
              )}
            >
              <div className="grid grid-cols-1 gap-2">
                  <IntakeMinimalSelect
                    theme={theme}
                    id="intake-modality"
                    label="Modalidad"
                    hint="FERSTER FITNESS = solo plan entrenamiento. NUTRICIÓN = acompañamiento nutricional. PLAN FULL = entreno + nutrición. Sólo se listan ofertas de la modalidad elegida; los selectores de arriba no cambian esa lista."
                    value={modalitySegment}
                    onChange={(raw) =>
                      onSelectCatalogSegment(raw as WebPlanCatalogSegment)
                    }
                  >
                    {modalityOptions.map((o) => (
                      <option key={o.segment} value={o.segment}>
                        {o.label}
                      </option>
                    ))}
                  </IntakeMinimalSelect>

                  <IntakeAvatarSelect
                    theme={theme}
                    id="intake-trainer"
                    label="Entrenador"
                    hint={`${PUBLIC_PLAN_SOLO_CREDENTIAL_LINE}`}
                    value={includeTraining ? trainerChoice : ''}
                    disabled={!includeTraining}
                    emptyLabel="No aplica"
                    onChange={(v) => setTrainerChoice(v)}
                    options={includeTraining ? trainerAvatarOptions : []}
                  />

                  <IntakeAvatarSelect
                    theme={theme}
                    id="intake-nutrition"
                    label="Nutricionista"
                    hint={`${PUBLIC_PLAN_CONJOINT_CREDENTIAL_LINE}`}
                    value={includeNutrition ? nutritionChoice : ''}
                    disabled={!includeNutrition}
                    emptyLabel="No aplica"
                    onChange={(v) => setNutritionChoice(v)}
                    options={includeNutrition ? nutritionAvatarOptions : []}
                  />
              </div>

              {plansVisible.length > 0 ? (
                <>
                  <div
                    className={cn(
                      'my-4 border-t pt-1',
                      theme === 'light' ? 'border-neutral-200/45' : 'border-white/[0.055]',
                    )}
                    aria-hidden
                  />
                  <IntakeChangeablePlansSection
                    title="Ofertas"
                    footerText="Podés cancelar cuando quieras."
                    buttonText="Ver detalle"
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
                    uiTheme={theme}
                  />
                </>
              ) : (
                <p className="mt-3 text-center text-[11px] leading-relaxed text-white/52">
                  {catalogSegment === null
                    ? 'Elegí una opción del paso 1.'
                    : catalogSegment === 'with_cris'
                      ? 'Por ahora no hay ofertas en esta modalidad. Cuando estén listas, el equipo las publica desde Planes web en el panel.'
                    : catalogSegment === 'full' && !hasPlansForSegment('full')
                      ? 'Plan integral entrenamiento + nutrición. Si no ves planes, cargalos desde el panel.'
                      : 'Próximamente sumaremos opciones para esta línea.'}
                </p>
              )}

              {catalogSegment === 'full' && plansVisible.length === 0 && (
                <p className="mt-2 text-center text-[10px] text-white/40">
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
  const { theme, setTheme } = useTheme()
  useEffect(() => {
    setTheme('dark')
  }, [setTheme])
  const [done,      setDone]      = useState(false)
  const [plans, setPlans] = useState<PlanDetail[]>(() => mergePublicIntakePlansFromDb([]))
  const [catalogSegment, setCatalogSegment] = useState<WebPlanCatalogSegment | null>('solo')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [planBilling, setPlanBilling] = useState<PlanBilling>('monthly')
  const [isPlanFlipped, setIsPlanFlipped] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const flipTimerRef = useRef<number | null>(null)
  const [publicSpots, setPublicSpots] = useState<PublicIntakeSlots>({
    slotsOpen: true,
    slotsRemaining: null,
    slotsMessage: null,
  })
  const [testimonialVideos, setTestimonialVideos] = useState<string[]>([])
  const [catalogSegmentImages, setCatalogSegmentImages] = useState<{
    solo: string | null
    withCris: string | null
    crisSolo: string | null
  }>({ solo: null, withCris: null, crisSolo: null })
  const [modalityLabels, setModalityLabels] = useState<{
    solo: string | null
    withCris: string | null
    full: string | null
  }>({ solo: null, withCris: null, full: null })
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
    if (catalogSegment === 'with_cris') return 'nutricion'
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
      if (segments.has('with_cris')) return 'with_cris'
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
    const apply = () => setIsMobile(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase
        .from('web_intake_catalog_settings')
        .select(
          'testimonial_videos, intake_slots_open, intake_slots_remaining, intake_slots_public_message, solo_segment_image_url, with_cris_segment_image_url, cris_solo_segment_image_url, modality_label_solo, modality_label_with_cris, modality_label_full',
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
          withCris: str('with_cris_segment_image_url'),
          crisSolo: str('cris_solo_segment_image_url'),
        })
        setModalityLabels({
          solo: typeof d.modality_label_solo === 'string' && d.modality_label_solo.trim() ? d.modality_label_solo.trim() : null,
          withCris:
            typeof d.modality_label_with_cris === 'string' && d.modality_label_with_cris.trim()
              ? d.modality_label_with_cris.trim()
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
      const { data, error } = await supabase
        .from('web_plans')
        .select(
          'slug, title, price_label, price_yearly_label, price_3m_label, price_6m_label, short_description, intro_text, includes_items, gifts_items, sort_order, is_active, show_in_public_intake, catalog_segment, display_badge, credential_line_override',
        )
        .eq('is_active', true)
        .eq('show_in_public_intake', true)
        .order('sort_order')
      if (error || !mounted) return
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
          rawSeg === 'with_cris' ? 'with_cris'
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
      if (mounted) setPlans(mergePublicIntakePlansFromDb(mapped))
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

  function handleSelectPlan(planId: string) {
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
    flipTimerRef.current = window.setTimeout(() => {
      flipTimerRef.current = null
    }, 320)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-4 pt-16 sm:pt-4 py-10 relative">
        <PublicAuthTopBar />
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
            withCrisSegmentImageUrl={catalogSegmentImages.withCris}
            crisSoloSegmentImageUrl={catalogSegmentImages.crisSolo}
            modalityOptions={modalityOptions}
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

  return (
    <div className="min-h-screen bg-surface-base flex items-start justify-center sm:items-center p-0 sm:p-4 sm:pt-4 sm:py-8 md:py-12 relative">
      <PublicAuthTopBar />
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
          onConfirmPlan={() => {
            if (selectedPlanId) handleSelectPlan(selectedPlanId)
          }}
          soloSegmentImageUrl={catalogSegmentImages.solo}
          withCrisSegmentImageUrl={catalogSegmentImages.withCris}
          crisSoloSegmentImageUrl={catalogSegmentImages.crisSolo}
          modalityOptions={modalityOptions}
        />

        {/* Panel derecho — selector de tipo o formulario */}
        <div className="flex-1 flex flex-col px-4 sm:px-8 lg:px-10 py-6 sm:py-8 lg:py-12 lg:pr-12 lg:overflow-y-auto lg:max-h-[min(100vh-2rem,1200px)]">
          {isMobile ? (
            selectedPlan ? (
              <PlanDetailView plan={selectedPlan} planBilling={planBilling} onBack={handleBackToForm} />
            ) : (
              <div>
                <IntakeSlotsBanner spots={publicSpots} />
                <TestimonialsSection urls={testimonialVideos} />
                {intakeKind === 'nutricion' ? (
                  <IntakeNutritionForm
                    selectedPlanSlug={selectedPlanId}
                    selectedPlanLabel={selectedPlan?.name ?? null}
                    selectedPlanPrice={selectedPlan ? displayPriceForPlan(selectedPlan, planBilling) : null}
                    onSuccess={() => setDone(true)}
                  />
                ) : intakeKind === 'full' ? (
                  <IntakeFullForm
                    selectedPlanSlug={selectedPlanId}
                    selectedPlanLabel={selectedPlan?.name ?? null}
                    selectedPlanPrice={selectedPlan ? displayPriceForPlan(selectedPlan, planBilling) : null}
                    onSuccess={() => setDone(true)}
                  />
                ) : (
                  <IntakeFersterForm
                    selectedPlanSlug={selectedPlanId}
                    selectedPlanLabel={selectedPlan?.name ?? null}
                    selectedPlanPrice={selectedPlan ? displayPriceForPlan(selectedPlan, planBilling) : null}
                    onSuccess={() => setDone(true)}
                  />
                )}
              </div>
            )
          ) : (
            <div className="flex-1" style={{ perspective: '1600px' }}>
              <div
                className="relative transition-transform duration-700"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: isPlanFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
              <div style={{ backfaceVisibility: 'hidden' }} className="scrollbar-hide">
                  <IntakeSlotsBanner spots={publicSpots} />
                  <TestimonialsSection urls={testimonialVideos} />
                  {intakeKind === 'nutricion' ? (
                    <IntakeNutritionForm
                      selectedPlanSlug={selectedPlanId}
                      selectedPlanLabel={selectedPlan?.name ?? null}
                      selectedPlanPrice={selectedPlan ? displayPriceForPlan(selectedPlan, planBilling) : null}
                      onSuccess={() => setDone(true)}
                    />
                  ) : intakeKind === 'full' ? (
                    <IntakeFullForm
                      selectedPlanSlug={selectedPlanId}
                      selectedPlanLabel={selectedPlan?.name ?? null}
                      selectedPlanPrice={selectedPlan ? displayPriceForPlan(selectedPlan, planBilling) : null}
                      onSuccess={() => setDone(true)}
                    />
                  ) : (
                    <IntakeFersterForm
                      selectedPlanSlug={selectedPlanId}
                      selectedPlanLabel={selectedPlan?.name ?? null}
                      selectedPlanPrice={selectedPlan ? displayPriceForPlan(selectedPlan, planBilling) : null}
                      onSuccess={() => setDone(true)}
                    />
                  )}
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
          )}
        </div>
      </div>
    </div>
  )
}
