import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { IntakeFersterForm } from '@/pages/public/IntakeFersterForm'

const ACCENT = '#7C5DFA'

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
        className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface-card px-3 py-2 text-xs font-medium text-ink-secondary hover:text-ink-primary hover:border-brand-primary/40 transition-colors shadow-sm"
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

/** Panel izquierdo: imagen + marca grande + chips para no quedar vacío */
function LeftBrandPanel({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <div className="relative lg:w-[44%] min-h-[340px] lg:min-h-[min(100vh-2rem,860px)] flex-shrink-0 overflow-hidden">
      <HeroBgLayers theme={theme} />

      <div className="relative z-[2] h-full min-h-[inherit] flex flex-col p-6 sm:p-9">
        {/* Centro: icono grande + copy + etiquetas */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-2 py-10 lg:py-6">
          <div className="relative mb-7 lg:mb-8">
            <div
              className="pointer-events-none absolute -inset-6 rounded-[2.5rem] blur-3xl opacity-70"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${ACCENT} 0%, transparent 70%)`,
              }}
            />
            <div className="relative rounded-[1.75rem] border-2 border-white/25 bg-black/35 p-1.5 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.85)] backdrop-blur-md ring-1 ring-white/10">
              <img
                src="/app_icon_original_1024.png"
                alt="Haciéndolo hábito"
                className="h-28 w-28 sm:h-32 sm:w-32 lg:h-44 lg:w-44 xl:h-[11.25rem] xl:w-[11.25rem] rounded-[1.45rem]"
              />
            </div>
          </div>

          <p className="text-[10px] uppercase tracking-[0.32em] text-violet-200/95 font-semibold mb-2 lg:mb-3">
            Ferster Fitness
          </p>
          <h2 className="text-[1.6rem] sm:text-3xl lg:text-[1.85rem] font-bold text-white tracking-tight drop-shadow-lg max-w-[16rem] lg:max-w-none">
            Haciéndolo hábito
          </h2>
          <p className="mt-4 text-sm sm:text-[0.9375rem] text-white/80 max-w-[19rem] mx-auto leading-relaxed">
            Completá el cuestionario de registro con tus datos, hábitos y fotos para armar tu plan personalizado.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {['Planes a medida', 'Seguimiento real', 'Comunidad Ferster'].map((label) => (
              <span
                key={label}
                className="rounded-full border border-white/20 bg-black/35 px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-white/95 backdrop-blur-sm"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Abajo */}
        <div className="shrink-0 mt-auto pt-8 border-t border-white/15">
          <p className="text-white text-lg sm:text-xl font-semibold leading-snug text-center lg:text-left drop-shadow-md mb-5 max-w-[22ch] mx-auto lg:mx-0">
            Hábitos que transforman,
            <span className="block text-white">día a día.</span>
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
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-4 pt-16 sm:pt-4 py-10 relative">
        <PublicAuthTopBar />
        <div className="w-full max-w-[960px] rounded-3xl overflow-hidden border border-surface-border bg-surface-card shadow-card dark:shadow-2xl flex flex-col lg:flex-row">
          <LeftBrandPanel theme={theme} />
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
        <LeftBrandPanel theme={theme} />

        {/* Panel derecho — formulario Ferster */}
        <div className="flex-1 px-6 sm:px-10 py-10 lg:py-12 lg:pl-10 lg:pr-12 max-h-[calc(100vh-5rem)] overflow-y-auto">
          <IntakeFersterForm onSuccess={() => setDone(true)} />
        </div>
      </div>
    </div>
  )
}
