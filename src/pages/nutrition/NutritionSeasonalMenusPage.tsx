import { useMemo, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardTitle } from '@/components/ui/Card'
import { SEASONAL_MENU_TEMPLATES, type MenuSeason } from '@/lib/nutrition/seasonalMenuLibrary'
import { cn } from '@/lib/utils'

function tabBtn(active: boolean) {
  return cn(
    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
    active ? 'bg-brand-primary text-white' : 'bg-surface-elevated text-ink-secondary hover:text-ink-primary',
  )
}

export function NutritionSeasonalMenusPage() {
  const [season, setSeason] = useState<MenuSeason>('invierno')
  const [tagQ, setTagQ] = useState('')

  const filtered = useMemo(() => {
    const q = tagQ.trim().toLowerCase()
    return SEASONAL_MENU_TEMPLATES.filter((m) => {
      if (m.season !== season) return false
      if (!q) return true
      return m.tags.some((t) => t.toLowerCase().includes(q)) || m.title.toLowerCase().includes(q)
    })
  }, [season, tagQ])

  return (
    <div>
      <Header title="Menús estacionales (plantillas)" />
      <div className="px-4 lg:px-6 py-6 space-y-5 max-w-3xl">
        <Card>
          <CardTitle className="mb-2">Biblioteca base</CardTitle>
          <p className="text-sm text-ink-secondary leading-relaxed">
            Modelos de invierno y verano con porciones orientativas y etiquetas por patologías frecuentes. Copiá el texto al plan
            del paciente y adaptalo en la grilla semanal o en notas. Podés ampliar esta biblioteca en código (
            <code className="text-[11px]">seasonalMenuLibrary.ts</code>) o pedir persistencia en base de datos.
          </p>
        </Card>

        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" className={tabBtn(season === 'invierno')} onClick={() => setSeason('invierno')}>
            Invierno
          </button>
          <button type="button" className={tabBtn(season === 'verano')} onClick={() => setSeason('verano')}>
            Verano
          </button>
          <input
            type="search"
            placeholder="Filtrar por etiqueta (ej. celiaquía, SIBO)…"
            value={tagQ}
            onChange={(e) => setTagQ(e.target.value)}
            className="ml-auto min-w-[200px] flex-1 max-w-md rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-4">
          {filtered.map((m) => (
            <Card key={m.id}>
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <CardTitle className="text-base">{m.title}</CardTitle>
                <div className="flex flex-wrap gap-1">
                  {m.tags.map((t) => (
                    <span key={t} className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md bg-surface-elevated text-ink-muted">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <pre className="text-xs text-ink-secondary whitespace-pre-wrap font-sans leading-relaxed border-t border-surface-border pt-3">
                {m.bodyMd}
              </pre>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-sm text-ink-muted">No hay plantillas con ese filtro.</p>}
        </div>
      </div>
    </div>
  )
}
