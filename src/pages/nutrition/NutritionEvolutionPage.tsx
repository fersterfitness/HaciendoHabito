import { Header } from '@/components/layout/Header'
import { Card, CardTitle } from '@/components/ui/Card'
import { trainerCtaAccentTextClassName, trainerCtaTintBgClassName } from '@/lib/primaryGradientCtaClasses'
import { cn } from '@/lib/utils'
import { LineChart } from 'lucide-react'

export function NutritionEvolutionPage() {
  return (
    <div>
      <Header title="Evolución nutricional" />
      <div className="px-4 lg:px-6 py-6 space-y-4">
        <Card>
          <div className="flex items-start gap-3">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', trainerCtaTintBgClassName)}>
              <LineChart className={cn('h-4 w-4', trainerCtaAccentTextClassName)} aria-hidden />
            </div>
            <div>
              <CardTitle className="mb-1">Panel de evolución</CardTitle>
              <p className="text-sm text-ink-secondary">
                Acá vamos a mostrar tendencias de peso, masa muscular, % grasa, perímetros y pliegues por paciente.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
