import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, Dumbbell, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

type Result = {
  id: string
  label: string
  sub: string
  icon: 'student' | 'routine'
  href: string
}

export function GlobalSearch() {
  const navigate   = useNavigate()
  const { user }   = useAuthStore()
  const [open,     setOpen]     = useState(false)
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<Result[]>([])
  const [active,   setActive]   = useState(0)
  const [loading,  setLoading]  = useState(false)
  const inputRef   = useRef<HTMLInputElement>(null)
  const debounce   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Open with Cmd+K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Focus input when open
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (!user || !q.trim()) { setResults([]); return }
    setLoading(true)
    const [{ data: students }, { data: routines }] = await Promise.all([
      supabase
        .from('students')
        .select('id, full_name, level, status')
        .eq('owner_id', user.id)
        .ilike('full_name', `%${q}%`)
        .limit(5),
      supabase
        .from('routines')
        .select('id, name, status, student_id')
        .eq('owner_id', user.id)
        .ilike('name', `%${q}%`)
        .limit(5),
    ])
    const res: Result[] = [
      ...(students ?? []).map((s) => ({
        id:    s.id,
        label: s.full_name,
        sub:   `${s.level} · ${s.status}`,
        icon:  'student' as const,
        href:  `/students/${s.id}`,
      })),
      ...(routines ?? []).map((r) => ({
        id:    r.id,
        label: r.name,
        sub:   `Rutina · ${r.status}`,
        icon:  'routine' as const,
        href:  `/routines/${r.id}`,
      })),
    ]
    setResults(res)
    setActive(0)
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => void search(query), 220)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [query, search])

  function go(href: string) {
    navigate(href)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && results[active]) go(results[active].href)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-surface-card border border-surface-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <Search className="h-4 w-4 text-ink-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar alumnos, rutinas..."
            className="flex-1 bg-transparent text-sm text-ink-primary placeholder:text-ink-muted outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-ink-muted hover:text-ink-primary">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-elevated text-ink-muted border border-surface-border">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="px-4 py-6 text-center text-xs text-ink-muted animate-pulse">Buscando...</div>
          ) : results.length === 0 && query.trim() ? (
            <div className="px-4 py-6 text-center text-xs text-ink-muted">Sin resultados para "{query}"</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-ink-muted">
              Escribí para buscar alumnos y rutinas
            </div>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li key={r.id}>
                  <button
                    onClick={() => go(r.href)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                      active === i ? 'bg-surface-elevated' : 'hover:bg-surface-elevated/50',
                    )}
                  >
                    <span className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-xl shrink-0',
                      r.icon === 'student' ? 'bg-brand-primary/10 text-brand-primary' : 'bg-emerald-500/10 text-emerald-400',
                    )}>
                      {r.icon === 'student'
                        ? <Users className="h-4 w-4" />
                        : <Dumbbell className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-primary truncate">{r.label}</p>
                      <p className="text-xs text-ink-muted capitalize">{r.sub}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-surface-border bg-surface-elevated/50">
          <span className="text-[10px] text-ink-muted">↑↓ navegar</span>
          <span className="text-[10px] text-ink-muted">↵ abrir</span>
          <span className="text-[10px] text-ink-muted">esc cerrar</span>
        </div>
      </div>
    </div>
  )
}
