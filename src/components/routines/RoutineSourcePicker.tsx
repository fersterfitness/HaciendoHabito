import { useMemo, useState } from 'react'
import { Check, ChevronRight, Library, Search, UserRound } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

export type RoutineSourceOption = {
  id: string
  name: string
  student_id: string | null
  student_name: string | null
  /** Alumno eliminado: la rutina quedó sin student_id pero con su nombre. */
  former_student_name?: string | null
  start_date?: string | null
  created_at: string
}

const LIBRARY_KEY = '__library__'

/**
 * Selector de rutina agrupado por alumno, con buscador.
 * Cada alumno es un grupo plegable con sus rutinas de la más nueva a la más vieja;
 * las preestablecidas (sin alumno) van al final.
 */
export function RoutineSourcePicker({
  routines,
  value,
  onChange,
  includeLibrary = true,
  emptyLabel,
  className,
}: {
  routines: RoutineSourceOption[]
  value: string
  onChange: (routineId: string) => void
  includeLibrary?: boolean
  /** Si viene, muestra una opción para limpiar la selección (p. ej. «No copiar»). */
  emptyLabel?: string
  className?: string
}) {
  const [query, setQuery] = useState('')
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set())

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const map = new Map<string, { key: string; label: string; items: RoutineSourceOption[] }>()
    for (const r of routines) {
      const former = !r.student_id ? r.former_student_name?.trim() : ''
      if (!r.student_id && !former && !includeLibrary) continue
      const key = r.student_id ?? (former ? `former:${former}` : LIBRARY_KEY)
      const label = r.student_id
        ? r.student_name?.trim() || 'Sin nombre'
        : former
          ? `${former} (eliminado)`
          : 'Preestablecidas'
      if (q && !label.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) continue
      if (!map.has(key)) map.set(key, { key, label, items: [] })
      map.get(key)!.items.push(r)
    }
    for (const g of map.values()) g.items.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return [...map.values()].sort((a, b) =>
      a.key === LIBRARY_KEY ? 1 : b.key === LIBRARY_KEY ? -1 : a.label.localeCompare(b.label, 'es'),
    )
  }, [routines, query, includeLibrary])

  const selected = routines.find((r) => r.id === value) ?? null
  const searching = query.trim().length > 0

  function toggle(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className={cn('rounded-xl border border-surface-border bg-surface-card', className)}>
      <div className="flex items-center gap-2 border-b border-surface-border px-3 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar alumno o rutina…"
          className="w-full bg-transparent text-sm text-ink-primary outline-none placeholder:text-ink-muted"
        />
      </div>

      {selected ? (
        <div className="flex items-center gap-2 border-b border-surface-border bg-brand-primary/8 px-3 py-2 text-xs">
          <Check className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
          <span className="min-w-0 flex-1 truncate text-ink-primary">
            <strong>{selected.name}</strong>
            {selected.student_name || selected.former_student_name
              ? ` · ${selected.student_name || selected.former_student_name}`
              : ''}
          </span>
          {emptyLabel ? (
            <button
              type="button"
              onClick={() => onChange('')}
              className="shrink-0 text-[11px] font-medium text-ink-muted hover:text-ink-primary"
            >
              {emptyLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="max-h-72 overflow-y-auto py-1">
        {groups.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-ink-muted">Sin resultados</p>
        ) : (
          groups.map((g) => {
            const isOpen = searching || openGroups.has(g.key) || g.items.some((r) => r.id === value)
            return (
              <div key={g.key}>
                <button
                  type="button"
                  onClick={() => toggle(g.key)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-elevated/50"
                >
                  <ChevronRight
                    className={cn('h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform', isOpen && 'rotate-90')}
                  />
                  {g.key === LIBRARY_KEY ? (
                    <Library className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
                  ) : (
                    <UserRound className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-primary">{g.label}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">{g.items.length}</span>
                </button>
                {isOpen ? (
                  <ul className="pb-1">
                    {g.items.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => onChange(r.id)}
                          className={cn(
                            'flex w-full items-center gap-2 py-1.5 pl-10 pr-3 text-left text-xs hover:bg-surface-elevated/50',
                            r.id === value ? 'text-brand-primary' : 'text-ink-secondary',
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{r.name}</span>
                          {r.start_date ? (
                            <span className="shrink-0 tabular-nums text-[10px] text-ink-muted">{formatDate(r.start_date)}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
