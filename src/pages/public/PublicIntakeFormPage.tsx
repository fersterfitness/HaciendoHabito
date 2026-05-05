import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Sun, Moon, Dumbbell, Salad, Check } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { IntakeFersterForm } from '@/pages/public/IntakeFersterForm'
import { IntakeNutritionForm } from '@/pages/public/IntakeNutritionForm'
import { supabase } from '@/lib/supabase'
import type { WebPlan } from '@/types/database'

type FormType = 'entrenamiento' | 'nutricion' | null

const ACCENT = '#ffcc33'

type PlanDetail = {
  id: string
  name: string
  price: string
  badge: string
  shortDescription: string
  intro: string
  info: string[]
  gifts: string[]
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
    <div className="space-y-3 w-full max-w-[330px]">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/65 font-semibold">Planes disponibles</p>
      <div className="space-y-3">
        {plans.map((plan) => (
          <button
            type="button"
            key={plan.name}
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
    <div className="h-full max-h-[calc(100vh-5rem)] overflow-y-auto scrollbar-hide px-1 pb-20 lg:pb-1">
      <div className="rounded-2xl border border-[#ffcc33]/35 bg-[#3b2d0f] p-5 sm:p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#ffe99f]">Detalle del plan</p>
            <h2 className="text-xl sm:text-2xl font-bold mt-1">{plan.name}</h2>
          </div>
          <span className="text-2xl font-extrabold">{plan.price}</span>
        </div>

        <p className="mt-4 text-sm text-white/85 leading-relaxed">{plan.intro}</p>

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

/** Panel izquierdo: marca + planes */
function LeftBrandPanel({
  theme,
  plans,
  selectedPlanId,
  onSelectPlan,
}: {
  theme: 'light' | 'dark'
  plans: PlanDetail[]
  selectedPlanId: string | null
  onSelectPlan: (id: string) => void
}) {
  return (
    <div className="relative lg:w-[44%] min-h-[340px] lg:min-h-[min(100vh-2rem,860px)] flex-shrink-0 overflow-hidden">
      <HeroBgLayers theme={theme} />

      <div className="relative z-[2] h-full min-h-[inherit] flex flex-col p-6 sm:p-9">
        <div className="flex-1 flex flex-col items-center text-center px-2 py-4 lg:py-2">
          <div className="relative mb-5">
            <div
              className="pointer-events-none absolute -inset-4 rounded-[2rem] blur-3xl opacity-70"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${ACCENT} 0%, transparent 70%)`,
              }}
            />
            <div className="relative rounded-[1.2rem] border border-white/20 bg-black/35 p-1 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.85)] backdrop-blur-md ring-1 ring-white/10">
              <img
                src="/app_icon_original_1024.png"
                alt="Haciéndolo hábito"
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-[1rem]"
              />
            </div>
          </div>

          <h2 className="text-[1.45rem] sm:text-3xl lg:text-[1.7rem] font-bold text-white tracking-tight drop-shadow-lg max-w-[16rem] lg:max-w-none">
            Haciéndolo hábito
          </h2>
          <div className="mt-3 mb-5">
            <PlansStack
              plans={plans}
              selectedPlanId={selectedPlanId}
              onSelectPlan={onSelectPlan}
            />
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
  const [formType,  setFormType]  = useState<FormType>(null)
  const [plans, setPlans] = useState<PlanDetail[]>(DEFAULT_PLANS)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [isPlanFlipped, setIsPlanFlipped] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const flipTimerRef = useRef<number | null>(null)
  const selectedPlan = selectedPlanId
    ? plans.find((p) => p.id === selectedPlanId) ?? null
    : null

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
      const { data, error } = await supabase
        .from('web_plans')
        .select('slug, title, price_label, short_description, intro_text, includes_items, gifts_items, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order')
      if (error || !mounted) return
      const mapped = ((data as Array<Pick<WebPlan, 'slug' | 'title' | 'price_label' | 'short_description' | 'intro_text' | 'includes_items' | 'gifts_items' | 'sort_order' | 'is_active'>>) ?? [])
        .map((row) => ({
          id: row.slug,
          name: row.title,
          price: row.price_label,
          badge:
            row.slug === 'plan-entrenamiento'
              ? 'Entrenamiento'
              : row.slug === 'plan-nutricion'
              ? 'Nutrición'
              : 'Full',
          shortDescription: row.short_description,
          intro: row.intro_text,
          info: row.includes_items ?? [],
          gifts: row.gifts_items ?? [],
        }))
      if (mapped.length === 3) setPlans(mapped)
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
      setSelectedPlanId(null)
      flipTimerRef.current = null
    }, 320)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-4 pt-16 sm:pt-4 py-10 relative">
        <PublicAuthTopBar />
        <div className="w-full max-w-[960px] rounded-3xl overflow-hidden border border-surface-border bg-surface-card shadow-card dark:shadow-2xl flex flex-col lg:flex-row">
          <LeftBrandPanel
            theme={theme}
            plans={plans}
            selectedPlanId={selectedPlanId}
            onSelectPlan={handleSelectPlan}
          />
          <div className="flex-1 flex flex-col items-center justify-center p-10 sm:p-14 text-center">
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
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4 pt-16 sm:pt-4 py-8 md:py-12 relative">
      <PublicAuthTopBar />
      <div className="w-full max-w-[960px] rounded-3xl overflow-hidden border border-surface-border bg-surface-card shadow-card dark:shadow-2xl flex flex-col lg:flex-row">
        <LeftBrandPanel
          theme={theme}
          plans={plans}
          selectedPlanId={selectedPlanId}
          onSelectPlan={handleSelectPlan}
        />

        {/* Panel derecho — selector de tipo o formulario */}
        <div className="flex-1 px-6 sm:px-10 py-10 lg:py-12 lg:pl-10 lg:pr-12 lg:h-[min(100vh-5rem,860px)]">
          {isMobile ? (
            selectedPlan ? (
              <PlanDetailView plan={selectedPlan} onBack={handleBackToForm} />
            ) : (
              <div className="h-full overflow-y-auto">
                {formType === null ? (
                  <FormTypeSelector onSelect={setFormType} />
                ) : formType === 'nutricion' ? (
                  <IntakeNutritionForm onSuccess={() => setDone(true)} />
                ) : (
                  <IntakeFersterForm onSuccess={() => setDone(true)} />
                )}
              </div>
            )
          ) : (
            <div className="h-full" style={{ perspective: '1600px' }}>
              <div
                className="relative h-full transition-transform duration-700"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: isPlanFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
              <div style={{ backfaceVisibility: 'hidden' }} className="h-full overflow-y-auto scrollbar-hide">
                  {formType === null ? (
                    <FormTypeSelector onSelect={setFormType} />
                  ) : formType === 'nutricion' ? (
                    <IntakeNutritionForm onSuccess={() => setDone(true)} />
                  ) : (
                    <IntakeFersterForm onSuccess={() => setDone(true)} />
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

// ─── Selector de tipo de formulario ──────────────────────────────────────────

function FormTypeSelector({ onSelect }: { onSelect: (t: NonNullable<FormType>) => void }) {
  return (
    <div className="max-w-md mx-auto lg:mx-0 flex flex-col justify-center h-full py-4">
      <h1 className="text-2xl sm:text-[1.65rem] font-bold text-ink-primary tracking-tight mb-2">
        Formulario de registro
      </h1>
      <p className="text-sm text-ink-secondary mb-8">
        Seleccioná el tipo de consulta para comenzar con el cuestionario correspondiente.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onSelect('entrenamiento')}
          className="group flex flex-col items-center gap-4 rounded-2xl border-2 border-surface-border bg-surface-card p-8 text-center transition-all hover:border-[#ffcc33]/60 hover:shadow-lg hover:shadow-[#ffcc33]/10 hover:-translate-y-0.5"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ffcc33]/10 text-[#ffcc33] transition-transform group-hover:scale-110">
            <Dumbbell className="h-7 w-7" />
          </span>
          <div>
            <p className="text-base font-bold text-ink-primary">Entrenamiento</p>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              Plan personalizado, rutinas y seguimiento físico.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelect('nutricion')}
          className="group flex flex-col items-center gap-4 rounded-2xl border-2 border-surface-border bg-surface-card p-8 text-center transition-all hover:border-[#ffcc33]/60 hover:shadow-lg hover:shadow-[#ffcc33]/10 hover:-translate-y-0.5"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ffcc33]/10 text-[#ffcc33] transition-transform group-hover:scale-110">
            <Salad className="h-7 w-7" />
          </span>
          <div>
            <p className="text-base font-bold text-ink-primary">Nutrición</p>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              Plan nutricional personalizado y seguimiento alimentario.
            </p>
          </div>
        </button>
      </div>

      <p className="text-center text-xs text-ink-muted mt-8">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="font-medium hover:underline text-[#ffcc33]">
          Iniciar sesión
        </Link>
      </p>
    </div>
  )
}
