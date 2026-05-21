import { useEffect, useState, useRef, useCallback, useId } from 'react'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Search, Users, Dumbbell, X, UtensilsCrossed } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchAccessibleStudents, filterAccessibleStudents } from '@/lib/students/studentAccess'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { GLOBAL_SEARCH_OPEN_EVENT } from '@/lib/globalSearch'

type Result = {
  id: string
  label: string
  sub: string
  kind: 'student' | 'routine' | 'mealplan'
  href: string
}

export function GlobalSearch() {
  const navigate = useAppNavigate()
  const { user, profile } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
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
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4 print:hidden"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
        aria-label="Cerrar búsqueda"
        onClick={() => setOpen(false)}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg bg-surface-card border border-surface-border rounded-2xl shadow-lg dark:shadow-xl overflow-hidden"
      >
        <p id={titleId} className="sr-only">
          Búsqueda global
        </p>

        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <Search className="h-4 w-4 text-ink-muted shrink-0" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar alumnos, rutinas, planes..."
            aria-label="Buscar alumnos, rutinas y planes"
            aria-controls={listboxId}
            aria-activedescendant={results[active] ? `search-result-${active}` : undefined}
            autoComplete="off"
            className={cn(
              'flex-1 min-h-10 rounded-lg bg-transparent text-sm text-ink-primary placeholder:text-ink-muted',
              appFocusRingClassName,
            )}
          />
          {query && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => setQuery('')}
              className={cn(
                'rounded-lg p-1.5 text-ink-muted transition-colors hover:text-ink-primary',
                appFocusRingClassName,
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-elevated text-ink-muted border border-surface-border">
            ESC
          </kbd>
        </div>

        <div id={listboxId} role="listbox" className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="px-4 py-6 text-center text-xs text-ink-muted animate-pulse">Buscando…</div>
          ) : results.length === 0 && query.trim() ? (
            <div className="px-4 py-6 text-center text-xs text-ink-muted">Sin resultados para «{query}»</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-ink-muted">
              Escribí para buscar alumnos, rutinas y planes
            </div>
          ) : (
            <div>
              {(['student', 'routine', 'mealplan'] as const).map((k) => {
                const group = results.filter((r) => r.kind === k)
                if (group.length === 0) return null
                const label = k === 'student' ? 'Alumnos' : k === 'routine' ? 'Rutinas' : 'Planes'
                return (
                  <div key={k} className="py-1">
                    <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                      {label}
                    </p>
                    <ul>
                      {group.map((r) => {
                        const i = results.indexOf(r)
                        return (
                          <li key={`${r.kind}-${r.id}`} role="presentation">
                            <button
                              id={`search-result-${i}`}
                              type="button"
                              role="option"
                              aria-selected={active === i}
                              onClick={() => go(r.href)}
                              onMouseEnter={() => setActive(i)}
                              className={cn(
                                'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                                appFocusRingClassName,
                                active === i ? 'bg-surface-elevated' : 'hover:bg-surface-elevated/50',
                              )}
                            >
                              <span
                                className={cn(
                                  'flex h-8 w-8 items-center justify-center rounded-xl shrink-0',
                                  r.kind === 'student' && 'bg-brand-primary/10 text-brand-primary',
                                  r.kind === 'routine' && 'bg-brand-primary/10 text-brand-primary',
                                  r.kind === 'mealplan' && 'bg-brand-tertiary/10 text-brand-tertiary',
                                )}
                                aria-hidden
                              >
                                {r.kind === 'student' ? (
                                  <Users className="h-4 w-4" />
                                ) : r.kind === 'routine' ? (
                                  <Dumbbell className="h-4 w-4" />
                                ) : (
                                  <UtensilsCrossed className="h-4 w-4" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-ink-primary truncate">{r.label}</p>
                                <p className="text-xs text-ink-muted">{r.sub}</p>
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

        <div className="flex items-center gap-3 px-4 py-2 border-t border-surface-border bg-surface-elevated/50">
          <span className="text-[10px] text-ink-muted">↑↓ navegar</span>
          <span className="text-[10px] text-ink-muted">↵ abrir</span>
          <span className="text-[10px] text-ink-muted">esc cerrar</span>
        </div>
      </div>
    </div>
  )
}
