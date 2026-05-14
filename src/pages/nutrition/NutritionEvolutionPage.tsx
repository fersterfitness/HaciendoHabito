import { Activity, BookOpen, FileText, LineChart, Users } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAppNavigate } from '@/hooks/useAppNavigate'

const FEATURES: { icon: React.ReactNode; label: string; description: string }[] = [
  {
    icon: <Activity className="h-4 w-4" />,
    label: 'Programa antropométrico',
    description: 'Carga las 5 mediciones por variable y calcula medianas + % error técnico (TE).',
  },
  {
    icon: <LineChart className="h-4 w-4" />,
    label: 'Evolución y gráficos',
    description: 'Peso, % grasa, masa muscular y cintura a lo largo del tiempo, con sparklines y deltas semánticos.',
  },
  {
    icon: <FileText className="h-4 w-4" />,
    label: 'PDF de evolución',
    description: 'Comparación entre los dos últimos controles, con texto adaptable (empático / técnico / motivador).',
  },
  {
    icon: <BookOpen className="h-4 w-4" />,
    label: 'Calculadora y reemplazos',
    description: 'Requerimientos energéticos y lista de equivalencias para armar el plan.',
  },
]

export function NutritionEvolutionPage() {
  const navigate = useAppNavigate()
  return (
    <div>
      <Header title="Evolución nutricional" showBack />
      <div className="px-4 lg:px-6 py-6 space-y-5 max-w-3xl">
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <CardTitle className="mb-1">¿Dónde se ve la evolución?</CardTitle>
              <p className="text-sm text-ink-secondary">
                Abrí la carpeta de un paciente para ver mediciones, gráficos y exportar PDFs.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="gradientPrimary"
              icon={<Users className="h-4 w-4" />}
              onClick={() => navigate('/nutrition')}
            >
              Ir a pacientes
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="rounded-xl border border-surface-border/70 bg-surface-elevated/40 p-3 flex items-start gap-3"
              >
                <span className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  {f.icon}
                </span>
                <div>
                  <p className="text-sm font-medium text-ink-primary">{f.label}</p>
                  <p className="mt-0.5 text-xs text-ink-secondary leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
