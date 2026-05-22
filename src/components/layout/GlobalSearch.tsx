import { useEffect, useState, useRef, useCallback, useId } from 'react'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Users, Dumbbell, X, UtensilsCrossed } from 'lucide-react'
import { HeaderSearchIcon } from '@/components/icons/headerAnimateIcons'
import { supabase } from '@/lib/supabase'
import { fetchAccessibleStudents, filterAccessibleStudents } from '@/lib/students/studentAccess'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import { GLOBAL_SEARCH_OPEN_EVENT } from '@/lib/globalSearch'

type Result = {
  id: string
  label: string
  sub: string
  kind: 'student' | 'routine' | 'mealplan'
  href: string
}

const searchInputClass =
  'flex-1 min-h-10 bg-transparent text-sm text-ink-primary placeholder:text-ink-muted outline-none border-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 shadow-none'

const resultIconPodClass =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-surface-border/70 bg-surface-elevated/80 text-ink-muted'

export function GlobalSearch() {
  const navigate = useAppNavigate()
  const { user, profile } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const [inputHovered, setInputHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleId = useId()
  const listboxId = useId()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    function onOpen() {
      setOpen(true)
    }
    window.addEventListener(GLOBAL_SEARCH_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(GLOBAL_SEARCH_OPEN_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActive(0)
      const t = window.setTimeout(() => inputRef.current?.focus(), 50)
      return () => window.clearTimeout(t)
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (!user || !q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    const studentHref = profile?.role === 'nutritionist' ? '/nutrition' : '/students'
    const { data: accessibleStudents } = await fetchAccessibleStudents()
    const students = filterAccessibleStudents(accessibleStudents, { search: q }).slice(0, 5)
    const [{ data: routines }, { data: mealPlans }] = await Promise.all([
      supabase
        .from('routines')
        .select('id, name, status, student_id')
        .eq('owner_id', user.id)
        .ilike('name', `%${q}%`)
        .limit(5),
      supabase
        .from('trainer_student_meal_plans')
        .select('id, title, student_id, student:students(full_name)')
        .eq('owner_id', user.id)
        .ilike('title', `%${q}%`)
        .limit(5),
    ])
    const res: Result[] = [
      ...(students ?? []).map((s) => ({
        id: s.id,
        label: s.full_name,
        sub: `${s.level} · ${s.status}`,
        kind: 'student' as const,
        href: `${studentHref}/${s.id}`,
      })),
      ...(routines ?? []).map((r) => ({
        id: r.id,
        label: r.name,
        sub: `Rutina · ${r.status}`,
        kind: 'routine' as const,
        href: `/routines/${r.id}`,
      })),
      ...(mealPlans ?? []).map((p) => ({
        id: p.id as string,
        label: (p.title as string) || 'Plan de alimentación',
        sub: `Plan · ${((p as { student?: { full_name?: string } | null }).student?.full_name ?? 'Alumno')}`,
        kind: 'mealplan' as const,
        href: `/students/${p.student_id}/meal-plan/${p.id}`,
      })),
    ]
    setResults(res)
    setActive(0)
    setLoading(false)
  }, [user, profile?.role])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => void search(query), 220)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [query, search])

  function go(href: string) {
    navigate(href)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    }
    if (e.key === 'Enter' && results[active]) go(results[active].href)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center px-4 pt-[12vh] print:hidden"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px] dark:bg-black/55"
        aria-label="Cerrar búsqueda"
        onClick={() => setOpen(false)}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-surface-border/90 bg-surface-card shadow-card-md"
      >
        <p id={titleId} className="sr-only">
          Búsqueda global
        </p>

        <div
          className="flex items-center gap-2.5 border-b border-surface-border/80 px-3 py-2.5"
          onMouseEnter={() => setInputHovered(true)}
          onMouseLeave={() => setInputHovered(false)}
        >
          <HeaderSearchIcon animate={inputHovered} className="text-ink-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar alumnos, rutinas, planes…"
            aria-label="Buscar alumnos, rutinas y planes"
            aria-controls={listboxId}
            aria-activedescendant={results[active] ? `search-result-${active}` : undefined}
            autoComplete="off"
            className={searchInputClass}
          />
          {query ? (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => setQuery('')}
              className="rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <kbd className="hidden shrink-0 rounded border border-surface-border/80 bg-surface-elevated/60 px-1.5 py-0.5 text-[10px] font-medium text-ink-muted sm:inline">
            esc
          </kbd>
        </div>

        <div id={listboxId} role="listbox" className="max-h-[min(50vh,22rem)] overflow-y-auto">
          {loading ? (
            <div className="px-4 py-8 text-center text-xs text-ink-muted">Buscando…</div>
          ) : results.length === 0 && query.trim() ? (
            <div className="px-4 py-8 text-center text-xs text-ink-muted">Sin resultados para «{query}»</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-ink-muted">
              Escribí para buscar alumnos, rutinas y planes
            </div>
          ) : (
            <div className="py-1">
              {(['student', 'routine', 'mealplan'] as const).map((k) => {
                const group = results.filter((r) => r.kind === k)
                if (group.length === 0) return null
                const label = k === 'student' ? 'Alumnos' : k === 'routine' ? 'Rutinas' : 'Planes'
                return (
                  <div key={k}>
                    <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                      {label}
                    </p>
                    <ul>
                      {group.map((r) => {
                        const i = results.indexOf(r)
                        const isActive = active === i
                        return (
                          <li key={`${r.kind}-${r.id}`} role="presentation">
                            <button
                              id={`search-result-${i}`}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              onClick={() => go(r.href)}
                              onMouseEnter={() => setActive(i)}
                              className={cn(
                                'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                                isActive
                                  ? 'bg-surface-elevated border-l-2 border-brand-secondary/40'
                                  : 'border-l-2 border-transparent hover:bg-surface-elevated/60',
                              )}
                            >
                              <span className={resultIconPodClass} aria-hidden>
                                {r.kind === 'student' ? (
                                  <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                                ) : r.kind === 'routine' ? (
                                  <Dumbbell className="h-3.5 w-3.5" strokeWidth={1.75} />
                                ) : (
                                  <UtensilsCrossed className="h-3.5 w-3.5" strokeWidth={1.75} />
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-ink-primary">{r.label}</p>
                                <p className="truncate text-[11px] text-ink-muted">{r.sub}</p>
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-surface-border/80 bg-surface-elevated/30 px-3 py-1.5">
          <span className="text-[10px] text-ink-muted">↑↓ navegar</span>
          <span className="text-[10px] text-ink-muted">↵ abrir</span>
          <span className="text-[10px] text-ink-muted">esc cerrar</span>
        </div>
      </div>
    </div>
  )
}
