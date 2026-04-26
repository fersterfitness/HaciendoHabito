import { Construction } from 'lucide-react'
import { Header } from '@/components/layout/Header'

interface PlaceholderPageProps {
  title: string
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div>
      <Header title={title} />
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-elevated flex items-center justify-center text-brand-primary mb-4">
          <Construction className="h-8 w-8" />
        </div>
        <h3 className="text-base font-semibold text-ink-primary mb-1">En construcción</h3>
        <p className="text-sm text-ink-secondary max-w-xs">
          Este módulo está en desarrollo. Pronto estará disponible.
        </p>
      </div>
    </div>
  )
}
