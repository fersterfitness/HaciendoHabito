import { ArrowRight, Users } from 'lucide-react'
import type { Kpi3dIconId } from '@/components/icons/kpi3dIcons'
import { Header } from '@/components/layout/Header'
import { DirectoryPageShell } from '@/components/directory/DirectoryPageShell'
import { Button } from '@/components/ui/Button'
import { StatIcon } from '@/components/ui/StatIcon'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { cn } from '@/lib/utils'

const STEPS = [
  { n: 1, title: 'Elegí un paciente', detail: 'Desde Pacientes o la búsqueda global.' },
  { n: 2, title: 'Cargá controles', detail: 'Pestaña Antropometría y programa de 5 mediciones.' },
  { n: 3, title: 'Seguí y exportá', detail: 'Resumen, gráficos y PDF entre los dos últimos controles.' },
] as const

const FEATURES: {
  kpi3dIcon: Kpi3dIconId
  label: string
  description: string
  tabHint: string
}[] = [
  {
    kpi3dIcon: 'anthropometry-pdf',
    label: 'Programa antropométrico',
    description: 'Cinco mediciones por variable, medianas y % de error técnico (TE) en la carpeta del paciente.',
    tabHint: 'Antropometría',
  },
  {
    kpi3dIcon: 'calendar',
    label: 'Evolución y gráficos',
    description: 'Perímetros y pliegues del programa de antropometría, con evolución entre controles.',
    tabHint: 'Resumen',
  },
  {
    kpi3dIcon: 'attended',
    label: 'PDF de evolución',
    description: 'Compará los dos últimos controles con texto adaptable: empático, técnico o motivador.',
    tabHint: 'Resumen · PDF',
  },
  {
    kpi3dIcon: 'meal-plans',
    label: 'Calculadora y reemplazos',
    description: 'Requerimientos energéticos y equivalencias para armar el plan semanal.',
    tabHint: 'Plan',
  },
]

export function NutritionEvolutionPage() {
  const navigate = useAppNavigate()

  return (
    <div>
      <Header title="Evolución nutricional" showBack />

      <DirectoryPageShell className="max-w-4xl space-y-6">
        <section
          className={cn(
            'relative overflow-hidden rounded-2xl border border-brand-secondary/25',
            'bg-gradient-to-br from-brand-secondary/[0.14] via-brand-secondary/[0.05] to-transparent',
            'px-5 py-6 sm:px-7 sm:py-7',
          )}
        >
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-brand-secondary/10 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-secondary">
                Seguimiento clínico
              </p>
              <h2 className="text-xl font-semibold tracking-tight text-ink-primary sm:text-2xl">
                Todo vive en la carpeta del paciente
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-ink-secondary">
                No hay un panel aparte: abrí la ficha, cargá mediciones y usá resumen, gráficos y exportación desde
                las mismas pestañas.
              </p>
            </div>
            <Button
              type="button"
              variant="gradientSecondary"
              icon={<Users className="h-4 w-4" />}
              onClick={() => navigate('/nutrition')}
              className="shrink-0 self-start sm:self-center"
            >
              Ir a pacientes
            </Button>
          </div>
        </section>

        <section aria-label="Pasos rápidos">
          <ol className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="flex gap-3 rounded-xl border border-surface-border/80 bg-surface-card/60 px-4 py-3.5"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-secondary/12 text-sm font-bold tabular-nums text-brand-secondary"
                  aria-hidden
                >
                  {step.n}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-primary">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="evolution-features-heading">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 id="evolution-features-heading" className="text-sm font-semibold text-ink-primary">
                Qué encontrás en cada pestaña
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">Herramientas ya integradas en la carpeta nutricional.</p>
            </div>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li
                key={f.label}
                className={cn(
                  'group rounded-2xl border border-surface-border/80 bg-surface-card p-4',
                  'transition-colors duration-200 hover:border-brand-secondary/30 hover:bg-surface-elevated/40',
                )}
              >
                <div className="flex items-start gap-3.5">
                  <StatIcon kpi3dIcon={f.kpi3dIcon} tone="accent" variant="3d" className="h-12 w-12" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink-primary">{f.label}</p>
                      <span className="rounded-md border border-brand-secondary/25 bg-brand-secondary/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-secondary">
                        {f.tabHint}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">{f.description}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="flex flex-col gap-3 rounded-2xl border border-dashed border-surface-border/90 bg-surface-elevated/25 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
        >
          <p className="text-sm text-ink-secondary">
            <span className="font-medium text-ink-primary">Tip:</span> desde Pacientes, abrí un nombre y navegá con
            las pestañas superiores (Resumen, Antropometría, Plan…).
          </p>
          <button
            type="button"
            onClick={() => navigate('/nutrition')}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-secondary transition-colors hover:text-brand-secondary/80"
          >
            Ver listado de pacientes
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </section>
      </DirectoryPageShell>
    </div>
  )
}
