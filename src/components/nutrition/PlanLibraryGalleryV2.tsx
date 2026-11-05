import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { normalizeWeeklyGrid } from '@/lib/nutrition/weeklyPlanGrid'
import { planCoverPhotoId, unsplashUrl } from '@/lib/nutrition/foodPhotos'
import { cn } from '@/lib/utils'
import type { NutritionPlanLibrary } from '@/types/database'

const chipClass = 'inline-flex items-center rounded-md bg-surface-elevated px-1.5 py-0.5 text-3xs font-medium text-ink-secondary'
const iconBtnClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-lg bg-surface-card/90 text-ink-secondary shadow-sm backdrop-blur transition-colors hover:text-ink-primary'

function updatedAgo(iso: string): string {
  try {
    return `Actualizado ${formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es })}`
  } catch {
    return ''
  }
}

/** v2: biblioteca de planes como galería (portada, nombre, objetivo y etiquetas). */
export function PlanLibraryGalleryV2({
  plans,
  activeId,
  onOpen,
  onClone,
  onDelete,
  onCreate,
}: {
  plans: NutritionPlanLibrary[]
  activeId: string | null
  onOpen: (p: NutritionPlanLibrary) => void
  onClone: (p: NutritionPlanLibrary) => void
  onDelete: (id: string) => void
  onCreate: () => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 p-3 min-[520px]:grid-cols-2 sm:p-4 lg:grid-cols-3 2xl:grid-cols-4">
      {plans.map((p) => {
        const grid = normalizeWeeklyGrid(p.grid, p.merge_weekends)
        const meals = grid.mealRows.length
        const tags = (p.tags ?? []).filter(Boolean).slice(0, 3)
        return (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(p)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onOpen(p)
            }}
            className={cn(
              'group flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-surface-card text-left transition-[border-color,box-shadow]',
              'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40',
              activeId === p.id ? 'border-brand-primary/50' : 'border-surface-border hover:border-ink-muted/40',
            )}
          >
            <div className="relative aspect-[2/1] bg-surface-elevated sm:aspect-[16/9]">
              <img
                src={unsplashUrl(planCoverPhotoId(p.id, grid.mealRows), 640, 360)}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden'
                }}
              />
              <div
                className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <button type="button" className={iconBtnClass} title="Clonar" aria-label="Clonar plan" onClick={() => onClone(p)}>
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className={cn(iconBtnClass, 'hover:text-status-expired')}
                  title="Eliminar"
                  aria-label="Eliminar plan"
                  onClick={() => onDelete(p.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3.5">
              <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink-primary">{p.name}</p>
              {p.objective ? <p className="line-clamp-2 text-xs leading-relaxed text-ink-secondary">{p.objective}</p> : null}
              <div className="flex flex-wrap gap-1.5">
                <span className={chipClass}>{meals === 1 ? '1 comida' : `${meals} comidas`}</span>
                <span className={chipClass}>{p.merge_weekends ? 'Lun–vie + finde' : '7 días'}</span>
                {tags.map((t) => (
                  <span key={t} className={chipClass}>
                    {t}
                  </span>
                ))}
              </div>
              <p className="mt-auto pt-1 text-3xs text-ink-muted">{activeId === p.id ? 'Editando ahora' : updatedAgo(p.updated_at)}</p>
            </div>
          </div>
        )
      })}
      <button
        type="button"
        onClick={onCreate}
        className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-surface-border text-sm text-ink-muted transition-colors hover:border-ink-muted/50 hover:text-ink-primary"
      >
        <Plus className="h-5 w-5" aria-hidden />
        Nuevo plan
      </button>
    </div>
  )
}
