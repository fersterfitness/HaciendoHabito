import { cn } from '@/lib/utils'

const SECTION_LINKS: { id: string; label: string }[] = [
  { id: 'nutrition-seccion-control', label: 'Control y gráficos' },
  { id: 'nutrition-seccion-presentacion', label: 'Presentación' },
  { id: 'nutrition-seccion-requerimientos', label: 'Requerimientos' },
  { id: 'nutrition-seccion-pdfs', label: 'PDFs de estudios' },
  { id: 'nutrition-seccion-historia', label: 'Clínica y síntomas' },
  { id: 'nutrition-seccion-anamnesis', label: 'Anamnesis' },
  { id: 'nutrition-seccion-mediciones', label: 'Medición rápida' },
  { id: 'nutrition-seccion-plan', label: 'Plan semanal' },
]

function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function NutritionFolderSectionNav({ className }: { className?: string }) {
  return (
    <nav className={cn(className)} aria-label="Ir a sección de la carpeta">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted mb-2 hidden sm:block">
        Accesos rápidos
      </p>
      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 sm:flex-wrap sm:overflow-visible">
        {SECTION_LINKS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollToSection(id)}
            className={cn(
              'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              'border-surface-border/80 bg-surface-elevated/60 text-ink-secondary',
              'hover:border-emerald-500/35 hover:bg-surface-card hover:text-ink-primary',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  )
}
