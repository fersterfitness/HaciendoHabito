import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Sun, Moon, Check, BicepsFlexed, Salad, Zap } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { IntakeFersterForm } from '@/pages/public/IntakeFersterForm'
import { IntakeNutritionForm } from '@/pages/public/IntakeNutritionForm'
import { IntakeFullForm } from '@/pages/public/IntakeFullForm'
import { supabase } from '@/lib/supabase'
import type { WebPlan, WebPlanCatalogSegment } from '@/types/database'

const ACCENT = '#ffcc33'

/** Ordena precios tipo «$60.000», «$100.000», etc. (sólo dígitos). */
function numericFromPriceLabel(label: string): number {
  const digits = label.replace(/\s/g, '').replace(/[^\d]/g, '')
  return digits ? parseInt(digits, 10) : 0
}

/** Texto completo (detalle del plan / tooltip). En el selector sólo usamos líneas cortas. */
const PUBLIC_PLAN_SOLO_CREDENTIAL_LINE =
  'Lic. en alto rendimiento (estudiante) · Prof. Educación física · Especialización deportiva'
const PUBLIC_PLAN_CONJOINT_CREDENTIAL_LINE =
  'Cristian Crossetto — Licenciado/a en Nutrición y especialización deportiva'
const PUBLIC_PLAN_FULL_CREDENTIAL_LINE =
  'Tomás Ferster + Cristian Crossetto — Plan integral de entrenamiento y nutrición'

const SEGMENT_SOLO_SUB = 'Tomás Ferster — Prof. Educación Física · Lic. en Alto Rendimiento'
const SEGMENT_CRIS_SUB = 'Cristian Crossetto — Lic. en Nutrición · Esp. en Nutrición deportiva'
const SEGMENT_FULL_SUB = 'Entrenamiento + Nutrición'

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

function CatalogSegmentThumbnail({
  imageUrl,
  titleFallback,
  compactFallback,
}: {
  imageUrl: string | null
  titleFallback: string
  compactFallback?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const showImg = Boolean(imageUrl && !failed)
  return (
    <div className="mx-auto mb-2 w-16 h-20 shrink-0 overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10">
      {showImg ? (
        <img
          src={imageUrl!}
          alt=""
          className="h-full w-full object-cover object-top"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : compactFallback ? (
        <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-bold leading-tight text-[#ffe99f]">{titleFallback}</span>
      ) : (
        <span className="flex h-full w-full items-center justify-center text-xl font-black text-[#ffe99f]">{titleFallback}</span>
      )}
    </div>
  )
}

type PlanDetail = {
  id: string
  catalogSegment: WebPlanCatalogSegment
  displayBadge: string | null
  name: string
  price: string
  badge: string
  shortDescription: string
  intro: string
  info: string[]
  gifts: string[]
}

function planCardBadge(plan: Pick<PlanDetail, 'id' | 'displayBadge'>): string {
  const b = plan.displayBadge?.trim()
  if (b) return b
  if (plan.id === 'plan-entrenamiento') return 'Entrenamiento'
  if (plan.id === 'plan-nutricion') return 'Nutrición'
  if (plan.id === 'plan-full') return 'Full'
  return 'Plan'
}

const COMMON_GIFTS = [
  'Calendario gratis para anotar tus hábitos.',
  'Análisis estadístico de hábitos y progreso.',
  'En mujeres: análisis del ciclo menstrual y su rendimiento.',
  'Materiales y guías digitales.',
]

const DEFAULT_PLANS: PlanDetail[] = [
  {
    id: 'plan-entrenamiento',
    catalogSegment: 'solo',
    displayBadge: null,
    name: 'Primer Plan Entrenamiento',
    price: '$60.000',
    badge: 'Entrenamiento',
    shortDescription: 'Entrenamiento personalizado con seguimiento mensual.',
    intro:
      'Plan avanzado de entrenamiento orientado al rendimiento físico, con enfoque en fuerza, resistencia y recuperación. Seguimiento continuo y ajustes según objetivos.',
    info: [
      'Videollamada de bienvenida gratuita.',
      'Videollamada mensual para ajustes/progreso.',
      'Actualización mensual de tu rutina.',
      'Rutina 100% personalizada.',
      'Correcciones por WhatsApp/video y seguimiento continuo.',
      'Encuentro presencial para ajustes técnicos (cuando se pueda pactar).',
    ],
    gifts: COMMON_GIFTS,
  },
  {
    id: 'plan-nutricion',
    catalogSegment: 'solo',
    displayBadge: null,
    name: 'Segundo Plan Nutrición',
    price: '$80.000',
    badge: 'Nutrición',
    shortDescription: 'Plan nutricional + seguimiento para sostener hábitos.',
    intro:
      'Plan premium de acompañamiento integral en nutrición para establecer y mantener hábitos saludables de forma sostenida, con planificación adaptada a tu contexto.',
    info: [
      'Videollamada de bienvenida gratuita.',
      'Videollamada mensual para seguimiento de progreso.',
      'Planificación nutricional adaptada a tus objetivos.',
      'Ajustes mensuales según evolución.',
      'Soporte y seguimiento continuo por WhatsApp.',
      'Coordinación con tu equipo de profesionales si aplica.',
    ],
    gifts: COMMON_GIFTS,
  },
  {
    id: 'plan-full',
    catalogSegment: 'solo',
    displayBadge: null,
    name: 'Plan Full',
    price: '$100.000',
    badge: 'Full',
    shortDescription: 'Combina entrenamiento + nutrición en un plan integral.',
    intro:
      'Plan integral que abarca entrenamiento y nutrición en conjunto, orientado a maximizar resultados con acompañamiento completo, estrategia personalizada y seguimiento continuo.',
    info: [
      'Videollamada de bienvenida + evaluación inicial completa.',
      'Videollamada mensual de progreso y ajustes.',
      'Rutina 100% personalizada + planificación nutricional.',
      'Ajustes mensuales de entrenamiento y alimentación.',
      'Correcciones técnicas por video/WhatsApp.',
      'Soporte continuo y encuentros presenciales cuando se puedan pactar.',
    ],
    gifts: COMMON_GIFTS,
  },
]

function PlansStack({
  plans,
  selectedPlanId,
  onSelectPlan,
}: {
  plans: PlanDetail[]
  selectedPlanId: string | null
  onSelectPlan: (id: string) => void
}) {
  return (
    <div className="space-y-3 w-full">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/65 font-semibold">Planes disponibles</p>
      <div className="space-y-3">
        {plans.map((plan) => (
          <button
            type="button"
            key={plan.id}
            onClick={() => onSelectPlan(plan.id)}
            className={[
              'w-full text-left rounded-2xl border p-4 transition-all backdrop-blur-sm hover:-translate-y-0.5',
              selectedPlanId === plan.id
                ? 'border-2 border-[#ffcc33]/80 bg-[#3b2d0f] text-white shadow-[0_0_38px_-8px_rgba(255,204,51,0.72)] scale-[1.01]'
                : 'border-white/15 bg-black/25 text-white',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="inline-flex items-center rounded-full border border-white/15 bg-black/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#ffe99f] mb-1.5">
                  {plan.badge}
                </span>
                <p className="text-sm font-semibold">{plan.name}</p>
                <p className={selectedPlanId === plan.id ? 'text-white/80 text-[11px] mt-0.5' : 'text-white/65 text-[11px] mt-0.5'}>
                  {plan.shortDescription}
                </p>
              </div>
              {selectedPlanId === plan.id ? (
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-[#ffcc33]/20 px-2 py-0.5 text-[10px] font-semibold text-[#ffe99f]">
                    Seleccionado
                  </span>
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#ffcc33]/60 bg-[#ffcc33]/15">
                    <Check className="h-3 w-3 text-[#ffe99f]" />
                  </span>
                </div>
              ) : null}
            </div>

            <p className="mt-3 mb-3">
              <span className="text-2xl font-bold">{plan.price}</span>
            </p>

            <ul className="space-y-1.5">
              {plan.info.slice(0, 3).map((feature) => (
                <li
                  key={feature}
                  className={selectedPlanId === plan.id ? 'flex items-center gap-2 text-xs text-white/85' : 'flex items-center gap-2 text-xs text-white/75'}
                >
                  <Check className={selectedPlanId === plan.id ? 'h-3.5 w-3.5 text-[#ffe99f]' : 'h-3.5 w-3.5 text-[#f4d76f]'} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 px-1 text-center text-[10px] leading-snug text-white/55">
              Tocá la tarjeta para ver todos los ítems y el detalle completo.
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

function PlanDetailView({
  plan,
  onBack,
}: {
  plan: PlanDetail
  onBack: () => void
}) {
  return (
    <div className="h-full min-h-0 max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain scrollbar-hide px-1 pb-20 lg:pb-1">
      <div className="rounded-2xl border border-[#ffcc33]/35 bg-[#3b2d0f] p-5 sm:p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#ffe99f]">Detalle del plan</p>
            <h2 className="text-xl sm:text-2xl font-bold mt-1">{plan.name}</h2>
          </div>
          <span className="text-2xl font-extrabold">{plan.price}</span>
        </div>

        <p className="mt-4 whitespace-pre-wrap break-words text-sm text-white/85 leading-relaxed">{plan.intro}</p>

        {plan.catalogSegment === 'with_cris' ? (
          <p className="mt-4 border-l-2 border-[#ffcc33]/70 pl-3 text-sm font-medium leading-relaxed text-[#ffe99f]/95">
            {PUBLIC_PLAN_CONJOINT_CREDENTIAL_LINE}
          </p>
        ) : plan.catalogSegment === 'solo' ? (
          <p className="mt-4 text-sm leading-relaxed text-white/75">{PUBLIC_PLAN_SOLO_CREDENTIAL_LINE}</p>
        ) : null}

        <div className="mt-5 pt-4 border-t border-[#f0c419]/20">
          <p className="text-sm font-semibold text-[#ffe99f] mb-2">Incluye</p>
          <ul className="space-y-2">
            {plan.info.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-white/85 leading-relaxed">
                <Check className="h-4 w-4 mt-0.5 text-[#ffe99f] shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 pt-4 border-t border-[#f0c419]/20">
          <p className="text-sm font-semibold text-[#ffe99f] mb-2">De regalo</p>
          <ul className="space-y-2">
            {plan.gifts.map((gift) => (
              <li key={gift} className="flex items-start gap-2 text-sm text-white/85 leading-relaxed">
                <Check className="h-4 w-4 mt-0.5 text-[#ffe99f] shrink-0" />
                <span>{gift}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="mt-6 hidden lg:block w-full rounded-xl border border-[#ffcc33]/45 bg-[#ffcc33]/12 px-4 py-2.5 text-sm font-semibold text-[#ffe99f] hover:bg-[#ffcc33]/20 transition-colors"
        >
          Elegir este plan y volver al formulario
        </button>
      </div>

      <div className="lg:hidden fixed inset-x-4 bottom-4 z-20">
        <button
          type="button"
          onClick={onBack}
          className="w-full rounded-xl border border-[#ffcc33]/55 bg-[#3b2d0f] px-4 py-3 text-sm font-semibold text-[#ffe99f] shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)]"
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
          style={{ background: `radial-gradient(ellipse 120% 80% at 50% -10%, ${ACCENT}45, transparent 55%)` }}
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
        style={{ background: `radial-gradient(ellipse 120% 80% at 50% -10%, ${ACCENT}50, transparent 55%)` }}
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
        className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface-card px-3 py-2 text-xs font-medium text-ink-secondary hover:text-ink-primary hover:border-[#ffcc33]/45 transition-colors shadow-sm"
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
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
  soloSegmentImageUrl,
  withCrisSegmentImageUrl,
  fullSegmentImageUrl,
  onSelectCatalogSegment,
  selectedPlanId,
  onSelectPlan,
}: {
  theme: 'light' | 'dark'
  plansAll: PlanDetail[]
  plansVisible: PlanDetail[]
  catalogSegment: WebPlanCatalogSegment | null
  soloSegmentImageUrl: string | null
  withCrisSegmentImageUrl: string | null
  fullSegmentImageUrl: string | null
  onSelectCatalogSegment: (s: WebPlanCatalogSegment) => void
  selectedPlanId: string | null
  onSelectPlan: (id: string) => void
}) {
  const hasPlansForSegment = (seg: WebPlanCatalogSegment) => plansAll.some((p) => p.catalogSegment === seg)

  const professionalCards: {
    segment: WebPlanCatalogSegment
    label: string
    sub: string
    credential: string
    icon: React.ReactNode
    imageUrl: string | null
    fallback: string
  }[] = [
    {
      segment: 'solo',
      label: 'Entrenador',
      sub: SEGMENT_SOLO_SUB,
      credential: PUBLIC_PLAN_SOLO_CREDENTIAL_LINE,
      icon: <BicepsFlexed className="h-4 w-4" />,
      imageUrl: soloSegmentImageUrl,
      fallback: 'TF',
    },
    {
      segment: 'with_cris',
      label: 'Nutricionista',
      sub: SEGMENT_CRIS_SUB,
      credential: PUBLIC_PLAN_CONJOINT_CREDENTIAL_LINE,
      icon: <Salad className="h-4 w-4" />,
      imageUrl: withCrisSegmentImageUrl,
      fallback: 'CC',
    },
    {
      segment: 'full',
      label: 'Full',
      sub: SEGMENT_FULL_SUB,
      credential: PUBLIC_PLAN_FULL_CREDENTIAL_LINE,
      icon: <Zap className="h-4 w-4" />,
      imageUrl: fullSegmentImageUrl,
      fallback: 'TF+CC',
    },
  ]

  return (
    <div className="relative lg:w-[48%] min-h-0 lg:min-h-[min(100vh-2rem,860px)] flex-shrink-0 overflow-hidden">
      <HeroBgLayers theme={theme} />

      <div className="relative z-[2] h-full min-h-[inherit] flex flex-col p-5 sm:p-7 lg:p-9">
        <div className="flex-1 flex flex-col items-center text-center px-2 py-3 lg:py-2">
          {/* Logo */}
          <div className="relative mb-3 lg:mb-5">
            <div
              className="pointer-events-none absolute -inset-8 rounded-[2rem] blur-3xl opacity-50"
              style={{ background: `radial-gradient(circle at 50% 50%, ${ACCENT} 0%, transparent 65%)` }}
            />
            <div className="relative flex justify-center px-2">
              <img
                src="/logo-brand.png"
                alt="Haciéndolo hábito"
                className="h-14 w-auto max-w-[min(280px,calc(100vw-3.5rem))] object-contain object-center drop-shadow-[0_4px_28px_rgba(0,0,0,0.5)] sm:h-20 sm:max-w-[360px] lg:h-28 lg:max-w-[min(480px,90%)]"
              />
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl lg:text-[1.7rem] font-bold text-white tracking-tight drop-shadow-lg mb-3 lg:mb-4">
            Haciéndolo hábito
          </h2>

          {/* 3 Professional cards — grid 3 columnas estilo perfil */}
          <div className="mb-4 lg:mb-5 w-full max-w-full sm:max-w-[390px]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/65 font-semibold mb-3">Elegí tu profesional</p>
            <div className="grid grid-cols-3 gap-2.5">
              {professionalCards.map((card) => {
                const isSelected = catalogSegment === card.segment
                return (
                  <button
                    key={card.segment}
                    type="button"
                    onClick={() => onSelectCatalogSegment(card.segment)}
                    title={card.credential}
                    className={[
                      'flex flex-col rounded-2xl border overflow-hidden text-center transition-all backdrop-blur-sm hover:scale-[1.02] active:scale-[0.99]',
                      isSelected
                        ? 'border-[#ffcc33]/80 ring-2 ring-[#ffcc33]/35 shadow-[0_0_32px_-8px_rgba(255,204,51,0.6)]'
                        : 'border-white/12 hover:border-white/25',
                    ].join(' ')}
                    aria-pressed={isSelected}
                  >
                    {/* Foto / avatar — proporción 3:4 retrato */}
                    <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                      <div className="absolute inset-0">
                        {card.imageUrl ? (
                          <img
                            src={card.imageUrl}
                            alt={card.label}
                            className="h-full w-full object-cover object-top"
                          />
                        ) : card.segment === 'full' ? (
                          <div className="h-full w-full flex flex-col items-center justify-center gap-1.5 bg-gradient-to-b from-[#2a1f00] to-[#1a1200]">
                            <div className="flex gap-1.5 items-center">
                              <BicepsFlexed className="h-4 w-4 text-[#ffe99f]/70" />
                              <span className="text-white/30 text-xs">+</span>
                              <Salad className="h-4 w-4 text-[#ffe99f]/70" />
                            </div>
                            <span className="text-[10px] font-bold text-[#ffe99f]/60 tracking-wide">FULL</span>
                          </div>
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-gradient-to-b from-white/8 to-white/4">
                            <span className="text-2xl font-black text-[#ffe99f]/50">{card.fallback}</span>
                          </div>
                        )}
                        {/* Gradiente inferior para leer el texto */}
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
                        {/* Ícono de rol — badge flotante arriba izquierda */}
                        <div className={[
                          'absolute top-1.5 left-1.5 h-5 w-5 rounded-lg flex items-center justify-center backdrop-blur-sm',
                          isSelected ? 'bg-[#ffcc33]/25 text-[#ffe99f]' : 'bg-black/40 text-white/50',
                        ].join(' ')}>
                          {card.icon}
                        </div>
                        {/* Check seleccionado — badge arriba derecha */}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-[#ffcc33] flex items-center justify-center">
                            <Check className="h-3 w-3 text-black" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Texto debajo de la foto */}
                    <div className={[
                      'flex-1 px-2 pt-2 pb-2.5 flex flex-col gap-0.5',
                      isSelected ? 'bg-[#3b2d0f]/80' : 'bg-black/30',
                    ].join(' ')}>
                      <p className={['text-[11px] font-bold leading-tight', isSelected ? 'text-white' : 'text-white/85'].join(' ')}>
                        {card.label}
                      </p>
                      <p className={['text-[8.5px] leading-snug', isSelected ? 'text-white/60' : 'text-white/38'].join(' ')}>
                        {card.sub}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Plans stack for selected segment */}
          <div className="mt-1 mb-3 lg:mt-2 lg:mb-5 w-full max-w-full sm:max-w-[390px]">
            {plansVisible.length === 0 ? (
              <p className="max-w-[280px] text-center text-[11px] text-white/60 mx-auto">
                {catalogSegment === null
                  ? 'Seleccioná arriba con quién querés trabajar.'
                  : catalogSegment === 'full'
                    ? hasPlansForSegment('full')
                      ? null
                      : 'Plan Full: incluye entrenamiento + nutrición con ambos profesionales.'
                    : 'Próximamente cargaremos planes en esta línea.'}
              </p>
            ) : (
              <PlansStack
                plans={plansVisible}
                selectedPlanId={selectedPlanId}
                onSelectPlan={onSelectPlan}
              />
            )}
            {catalogSegment === 'full' && plansVisible.length === 0 && (
              <p className="mt-3 max-w-[280px] text-center text-[11px] text-white/50 mx-auto">
                Completá el formulario para continuar. Un asesor se contactará con vos con los detalles del plan.
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 mt-auto pt-5 border-t border-white/15 hidden lg:block">
          <p className="text-white text-base sm:text-lg font-semibold leading-tight text-center lg:text-left drop-shadow-md mb-3 whitespace-nowrap mx-auto lg:mx-0">
            Hábitos que transforman, día a día.
          </p>
          <div className="flex gap-2 justify-center lg:justify-start">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 rounded-full transition-all"
                style={{
                  width: i === 0 ? '2rem' : '0.5rem',
                  backgroundColor: i === 0 ? ACCENT : 'rgba(255,255,255,0.4)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function PublicIntakeFormPage() {
  const { theme } = useTheme()
  const [done,      setDone]      = useState(false)
  const [plans, setPlans] = useState<PlanDetail[]>(DEFAULT_PLANS)
  const [catalogSegment, setCatalogSegment] = useState<WebPlanCatalogSegment | null>('solo')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [isPlanFlipped, setIsPlanFlipped] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const flipTimerRef = useRef<number | null>(null)
  const [soloSegmentImgUrl, setSoloSegmentImgUrl] = useState<string | null>(null)
  const [withCrisSegmentImgUrl, setWithCrisSegmentImgUrl] = useState<string | null>(null)
  const [fullSegmentImgUrl, setFullSegmentImgUrl] = useState<string | null>(null)
  const [testimonialVideos, setTestimonialVideos] = useState<string[]>([])
  const plansVisible = useMemo(() => plans.filter((p) => catalogSegment !== null && p.catalogSegment === catalogSegment), [
    plans,
    catalogSegment,
  ])

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
        .select('solo_segment_image_url, with_cris_segment_image_url, full_segment_image_url, testimonial_videos')
        .eq('id', 1)
        .maybeSingle()
      if (!mounted) return
      if (data) {
        setSoloSegmentImgUrl(data.solo_segment_image_url)
        setWithCrisSegmentImgUrl(data.with_cris_segment_image_url)
        setFullSegmentImgUrl((data as Record<string, unknown>).full_segment_image_url as string | null ?? null)
        setTestimonialVideos(((data.testimonial_videos as string[] | null) ?? []).filter(Boolean))
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
          'slug, title, price_label, short_description, intro_text, includes_items, gifts_items, sort_order, is_active, catalog_segment, display_badge',
        )
        .eq('is_active', true)
        .order('sort_order')
      if (error || !mounted) return
      type Row = Pick<
        WebPlan,
        | 'slug'
        | 'title'
        | 'price_label'
        | 'short_description'
        | 'intro_text'
        | 'includes_items'
        | 'gifts_items'
        | 'sort_order'
        | 'is_active'
        | 'catalog_segment'
        | 'display_badge'
      >
      const mapped: PlanDetail[] = ((data as Row[]) ?? []).map((row) => {
        const id = row.slug
        const segment: WebPlanCatalogSegment =
          row.catalog_segment === 'with_cris' ? 'with_cris'
          : row.catalog_segment === 'full' ? 'full'
          : 'solo'
        const displayBadge = row.display_badge ?? null
        return {
          id,
          catalogSegment: segment,
          displayBadge,
          name: row.title,
          price: row.price_label,
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
      if (mapped.length > 0) setPlans(mapped)
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
        <div className="w-full max-w-[1040px] rounded-none sm:rounded-3xl overflow-hidden border-0 sm:border border-surface-border bg-surface-card shadow-none sm:shadow-card dark:sm:shadow-2xl flex flex-col lg:flex-row min-h-screen sm:min-h-0">
          <LeftBrandPanel
            theme={theme}
            plansAll={plans}
            plansVisible={plansVisible}
            catalogSegment={catalogSegment}
            soloSegmentImageUrl={soloSegmentImgUrl}
            withCrisSegmentImageUrl={withCrisSegmentImgUrl}
            fullSegmentImageUrl={fullSegmentImgUrl}
            onSelectCatalogSegment={setCatalogSegment}
            selectedPlanId={selectedPlanId}
            onSelectPlan={handleSelectPlan}
          />
          <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-14 text-center">
            <div
              className="mb-6 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: `${ACCENT}22` }}
            >
              <CheckCircle2 className="h-9 w-9" style={{ color: ACCENT }} aria-hidden />
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
      <div className="w-full max-w-[1040px] rounded-none sm:rounded-3xl overflow-hidden border-0 sm:border border-surface-border bg-surface-card shadow-none sm:shadow-card dark:sm:shadow-2xl flex flex-col lg:flex-row min-h-screen sm:min-h-0">
        <LeftBrandPanel
          theme={theme}
          plansAll={plans}
          plansVisible={plansVisible}
          catalogSegment={catalogSegment}
          soloSegmentImageUrl={soloSegmentImgUrl}
          withCrisSegmentImageUrl={withCrisSegmentImgUrl}
          fullSegmentImageUrl={fullSegmentImgUrl}
          onSelectCatalogSegment={setCatalogSegment}
          selectedPlanId={selectedPlanId}
          onSelectPlan={handleSelectPlan}
        />

        {/* Panel derecho — selector de tipo o formulario */}
        <div className="flex-1 flex flex-col px-4 sm:px-8 lg:px-10 py-6 sm:py-8 lg:py-12 lg:pr-12 lg:overflow-y-auto lg:max-h-[min(100vh-2rem,1200px)]">
          {isMobile ? (
            selectedPlan ? (
              <PlanDetailView plan={selectedPlan} onBack={handleBackToForm} />
            ) : (
              <div>
                <TestimonialsSection urls={testimonialVideos} />
                {intakeKind === 'nutricion' ? (
                  <IntakeNutritionForm
                    selectedPlanSlug={selectedPlanId}
                    selectedPlanLabel={selectedPlan?.name ?? null}
                    selectedPlanPrice={selectedPlan?.price ?? null}
                    onSuccess={() => setDone(true)}
                  />
                ) : intakeKind === 'full' ? (
                  <IntakeFullForm
                    selectedPlanSlug={selectedPlanId}
                    selectedPlanLabel={selectedPlan?.name ?? null}
                    selectedPlanPrice={selectedPlan?.price ?? null}
                    onSuccess={() => setDone(true)}
                  />
                ) : (
                  <IntakeFersterForm
                    selectedPlanSlug={selectedPlanId}
                    selectedPlanLabel={selectedPlan?.name ?? null}
                    selectedPlanPrice={selectedPlan?.price ?? null}
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
                  <TestimonialsSection urls={testimonialVideos} />
                  {intakeKind === 'nutricion' ? (
                    <IntakeNutritionForm
                      selectedPlanSlug={selectedPlanId}
                      selectedPlanLabel={selectedPlan?.name ?? null}
                      selectedPlanPrice={selectedPlan?.price ?? null}
                      onSuccess={() => setDone(true)}
                    />
                  ) : intakeKind === 'full' ? (
                    <IntakeFullForm
                      selectedPlanSlug={selectedPlanId}
                      selectedPlanLabel={selectedPlan?.name ?? null}
                      selectedPlanPrice={selectedPlan?.price ?? null}
                      onSuccess={() => setDone(true)}
                    />
                  ) : (
                    <IntakeFersterForm
                      selectedPlanSlug={selectedPlanId}
                      selectedPlanLabel={selectedPlan?.name ?? null}
                      selectedPlanPrice={selectedPlan?.price ?? null}
                      onSuccess={() => setDone(true)}
                    />
                  )}
                </div>

              <div
                className="absolute inset-0 scrollbar-hide"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  {selectedPlan ? (
                    <PlanDetailView plan={selectedPlan} onBack={handleBackToForm} />
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
