import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { BrandLogo } from '@/components/branding/BrandLogo'

export function NotFoundPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-12 bg-surface-base text-center gap-6">
      <BrandLogo size="sm" decorative />
      <div className="space-y-2 max-w-sm">
        <h1 className="text-2xl font-semibold text-ink-primary">Página no encontrada</h1>
        <p className="text-sm text-ink-secondary leading-relaxed">
          El enlace no existe o cambió de lugar. Volvé al inicio o usá el menú de la app.
        </p>
      </div>
      <Button asChild variant="gradientPrimary">
        <Link to="/dashboard">Ir al inicio</Link>
      </Button>
    </div>
  )
}
