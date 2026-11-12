import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { currentMenuSeason, menuPhotoUrl } from '@/components/nutrition/SeasonalMenusV2'
import { SEASONAL_MENU_TEMPLATES, type SeasonalMenuTemplate } from '@/lib/nutrition/seasonalMenuLibrary'
import { seasonalMenuMeals } from '@/lib/nutrition/seasonalMenuToPlan'

/** v2 · Inicio del nutricionista: un menú de la época a la vista, para usarlo sin ir a buscarlo. */
export function SuggestedMenuCardV2({ onUse, onSeeAll }: { onUse: (menu: SeasonalMenuTemplate) => void; onSeeAll: () => void }) {
  // Uno distinto cada día, entre los de la temporada (sin azar: el mismo durante todo el día).
  const menu = useMemo(() => {
    const season = currentMenuSeason()
    const pool = SEASONAL_MENU_TEMPLATES.filter((m) => m.season === season)
    const list = pool.length ? pool : SEASONAL_MENU_TEMPLATES
    return list[Math.floor(Date.now() / 86_400_000) % list.length]!
  }, [])
  const meals = useMemo(() => seasonalMenuMeals(menu), [menu])

  return (
    <section aria-labelledby="inicio-menu-sugerido" className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
      <div className="relative aspect-[16/9] bg-surface-elevated">
        <img
          src={menuPhotoUrl(menu, meals, 640, 360)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden'
          }}
        />
        <span className="hh-pastel absolute left-3 top-3 rounded-md bg-pastel-butter px-2 py-0.5 text-xs font-medium text-pastel-butter-ink">Menú de la época</span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div>
          <h2 id="inicio-menu-sugerido" className="text-sm font-semibold leading-snug text-ink-primary">
            {menu.title}
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {menu.approximateKcal ? `≈ ${menu.approximateKcal.toLocaleString('es-AR')} kcal por día · ` : ''}
            {meals.length} comidas
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => onUse(menu)}>
            Usar con un paciente
          </Button>
          <Button type="button" size="sm" variant="secondary" icon={<ChevronRight className="h-3.5 w-3.5" />} iconPosition="right" onClick={onSeeAll}>
            Ver todos
          </Button>
        </div>
      </div>
    </section>
  )
}
