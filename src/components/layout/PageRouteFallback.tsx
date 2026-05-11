import { CardSkeleton } from '@/components/ui/Skeleton'

/** Mientras carga un chunk de ruta (`React.lazy`). */
export function PageRouteFallback() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8 lg:px-6" aria-busy="true" aria-label="Cargando página">
      <div className="mb-6 h-9 max-w-xs animate-pulse rounded-lg bg-surface-elevated" />
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton rows={4} />
        <CardSkeleton rows={3} />
      </div>
    </div>
  )
}
