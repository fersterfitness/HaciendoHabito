import { Header } from '@/components/layout/Header'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { trainerCtaAccentTextClassName, trainerCtaTintBgClassName } from '@/lib/primaryGradientCtaClasses'
import { cn } from '@/lib/utils'
import { LineChart } from 'lucide-react'
import { useAppNavigate } from '@/hooks/useAppNavigate'

export function NutritionEvolutionPage() {
  const navigate = useAppNavigate()
  return (
    <div>
      <Header title="Evolución nutricional" />
      <div className="px-4 lg:px-6 py-6 space-y-4 max-w-2xl">
        <Card>
          <div className="flex items-start gap-3">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', trainerCtaTintBgClassName)}>
              <LineChart className={cn('h-4 w-4', trainerCtaAccentTextClassName)} aria-hidden />
            </div>
            <div>
              <CardTitle className="mb-1">Gráficos por paciente</CardTitle>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Abrí la carpeta de un paciente: allí tenés el <strong className="text-ink-primary">programa de antropometría</strong> (como el Excel),
                la tabla <strong className="text-ink-primary">«Presentación»</strong> con diferencias vs. el control anterior, el{' '}
                <strong className="text-ink-primary">PDF de presentación</strong>, los <strong className="text-ink-primary">gráficos</strong>, el{' '}
                <strong className="text-ink-primary">PDF evolución</strong> entre los dos últimos controles, calculadora de energía, equivalencias y recordatorio de próxima consulta.
              </p>
              <Button type="button" size="sm" variant="gradientPrimary" className="mt-4" onClick={() => navigate('/nutrition')}>
                Ir a pacientes
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
