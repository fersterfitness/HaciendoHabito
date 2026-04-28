import { Header } from '@/components/layout/Header'
import { Card, CardTitle } from '@/components/ui/Card'
import { Library } from 'lucide-react'

export function NutritionTemplatesPage() {
  return (
    <div>
      <Header title="Plantillas nutricionales" />
      <div className="px-4 lg:px-6 py-6 space-y-4">
        <Card>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center">
              <Library className="h-4 w-4 text-brand-primary" />
            </div>
            <div>
              <CardTitle className="mb-1">Biblioteca de textos y planes</CardTitle>
              <p className="text-sm text-ink-secondary">
                Próximo paso: plantillas reutilizables para recomendaciones, devoluciones y bloques de plan.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
