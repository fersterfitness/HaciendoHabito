import { Button } from '@/components/ui/Button'
import { useEffect, useState, useRef, useCallback, useId } from 'react'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Users, Dumbbell, X, UtensilsCrossed, UserPlus, Wallet, MessageSquare, CalendarPlus, ArrowRight, Bell, Moon, Settings, Sparkles, Sun, Undo2, type LucideIcon } from 'lucide-react'
import { HeaderSearchIcon } from '@/components/icons/headerAnimateIcons'
import { supabase } from '@/lib/supabase'
import { fetchAccessibleStudents, filterAccessibleStudents } from '@/lib/students/studentAccess'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import { GLOBAL_SEARCH_OPEN_EVENT } from '@/lib/globalSearch'
import { escapeIlikePattern } from '@/lib/escapeIlikePattern'
import { studentTrainerTags } from '@/lib/students/studentTrainerPrefs'
import { getNavSections } from '@/config/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { IS_V2, enterV2, leaveV2 } from '@/lib/uiVersion'
import { GO_HINT_BY_HREF, goKeysFor, isTypingTarget } from '@/lib/shortcutsV2'
import type { AppRole } from '@/types/database'

type Kind = 'recent' | 'action' | 'command' | 'nav' | 'student' | 'routine' | 'mealplan'

type Result = {
  id: string
  label: string
  sub: string
  kind: Kind
  href: string
  icon?: LucideIcon
  /** Comandos que no navegan (cambiar tema, versión). */
  run?: () => void
  /** Atajo de teclado que se muestra a la derecha. */
  hint?: string
}

const GROUPS: { kind: Kind; label: string }[] = [
  { kind: 'recent', label: 'Recientes' },
  { kind: 'action', label: 'Acciones' },
  { kind: 'command', label: 'Comandos' },
  { kind: 'nav', label: 'Ir a' },
  { kind: 'student', label: 'Alumnos' },
  { kind: 'routine', label: 'Rutinas' },
  { kind: 'mealplan', label: 'Planes' },
]

/** Atajos «G y una letra» para ir a cada sección (también se muestran en el buscador). */
const HREF_HINT = GO_HINT_BY_HREF

// ── Recientes: lo último que se abrió desde el buscador (solo en este navegador). ──
const RECENT_KEY = 'hh-search-recent'
type Recent = Pick<Result, 'id' | 'label' | 'sub' | 'href'> & { from: Kind }
function readRecent(): Recent[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as Recent[]
    return Array.isArray(v) ? v.slice(0, 4) : []
  } catch {
    return []
  }
}
function pushRecent(r: Result) {
  if (r.kind !== 'student' && r.kind !== 'routine' && r.kind !== 'mealplan' && r.kind !== 'recent') return
  try {
    const item: Recent = { id: r.id, label: r.label, sub: r.sub, href: r.href, from: r.kind === 'recent' ? 'student' : r.kind }
    const next = [item, ...readRecent().filter((x) => x.href !== r.href)].slice(0, 4)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* sin storage */
  }
}
const recentIcon = (k: Kind) => (k === 'routine' ? Dumbbell : k === 'mealplan' ? UtensilsCrossed : Users)

/** Secciones del menú como destinos («Ir a Finanzas»). */
function navResults(q: string, role?: string | null): Result[] {
  const n = norm(q.trim())
  if (!n) return []
  const items = [
    ...getNavSections((role ?? undefined) as AppRole | undefined).flatMap((sec) => sec.items.map((it) => ({ ...it, section: sec.title }))),
    { label: 'Notificaciones', href: '/notifications', icon: Bell, section: 'Cuenta' },
    { label: 'Configuración', href: '/settings', icon: Settings, section: 'Cuenta' },
  ]
  const seen = new Set<string>()
  return items
    .filter((it) => {
      if (seen.has(it.href)) return false
      seen.add(it.href)
      return norm(`${it.label} ${it.section}`).includes(n)
    })
    .slice(0, 4)
    .map((it) => ({ id: `nav-${it.href}`, label: it.label, sub: it.section, href: it.href, icon: it.icon, kind: 'nav' as const, hint: HREF_HINT[it.href] }))
}

type Action = Omit<Result, 'kind' | 'sub'> & { sub: string; icon: LucideIcon; keywords: string; when: (role?: string | null) => boolean }

const trains = (role?: string | null) => role === 'admin' || role === 'trainer' || !role
const handlesMoney = (role?: string | null) => role === 'admin' || role === 'trainer' || role === 'nutritionist' || !role

/** Lo de todos los días, a un Ctrl K: aparece con el buscador vacío y se filtra al escribir. */
const ACTIONS: Action[] = [
  { id: 'new-student', label: 'Nuevo alumno', sub: 'Cargar un alumno', href: '/students/new', icon: UserPlus, keywords: 'alta alumno agregar crear', when: trains },
  { id: 'new-routine', label: 'Nueva rutina', sub: 'Armar una rutina', href: '/routines/new', icon: Dumbbell, keywords: 'rutina crear armar entrenamiento', when: trains },
  { id: 'new-income', label: 'Registrar cobro', sub: 'Finanzas · ingreso', href: '/finances/income/new', icon: Wallet, keywords: 'cobro pago abono ingreso cuota', when: handlesMoney },
  { id: 'check-ins', label: 'Mandar feedback semanal', sub: 'Consulta semanal · Enviar', href: '/check-ins', icon: MessageSquare, keywords: 'feedback consulta semanal formulario enviar', when: trains },
  { id: 'appointments', label: 'Agendar turno', sub: 'Turnos', href: '/appointments', icon: CalendarPlus, keywords: 'turno cita agenda reunion calendario', when: (r) => r !== 'nutritionist' },
  { id: 'nutri-appointments', label: 'Agendar turno', sub: 'Turnos', href: '/nutrition/appointments', icon: CalendarPlus, keywords: 'turno cita agenda consulta calendario', when: (r) => r === 'nutritionist' },
]

const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function matchingActions(q: string, role?: string | null): Result[] {
  const n = norm(q.trim())
  return ACTIONS.filter((a) => a.when(role) && (!n || norm(`${a.label} ${a.keywords}`).includes(n)))
    .slice(0, n ? 3 : 6)
    .map((a) => ({ id: a.id, label: a.label, sub: a.sub, href: a.href, icon: a.icon, kind: 'action' as const, hint: a.id === 'new-student' && IS_V2 ? 'N' : undefined }))
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
  const { theme, toggleTheme } = useTheme()

  /** Comandos (no navegan): tema y versión de la interfaz. */
  const commandResults = useCallback(
    (q: string): Result[] => {
      const n = norm(q.trim())
      const all: (Result & { keywords: string })[] = [
        {
          id: 'cmd-theme',
          label: theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
          sub: 'Apariencia',
          href: '',
          icon: theme === 'dark' ? Sun : Moon,
          kind: 'command',
          run: toggleTheme,
          keywords: 'tema oscuro claro noche dia apariencia dark light',
        },
        IS_V2
          ? { id: 'cmd-v1', label: 'Volver a la versión actual', sub: 'Interfaz', href: '', icon: Undo2, kind: 'command', run: leaveV2, keywords: 'version vieja anterior actual v1 diseño' }
          : { id: 'cmd-v2', label: 'Probar la versión nueva', sub: 'Interfaz', href: '', icon: Sparkles, kind: 'command', run: enterV2, keywords: 'version nueva v2 diseño' },
      ]
      return all.filter((c) => n && norm(`${c.label} ${c.keywords}`).includes(n)).map((c) => ({ id: c.id, label: c.label, sub: c.sub, href: c.href, icon: c.icon, kind: c.kind, run: c.run }))
    },
    [theme, toggleTheme],
  )

  /** Con el buscador vacío: lo último que abriste + las acciones de siempre. */
  const idleResults = useCallback(
    (): Result[] => [
      ...readRecent().map((r) => ({ ...r, kind: 'recent' as const, icon: recentIcon(r.from) })),
      ...matchingActions('', profile?.role),
    ],
    [profile?.role],
  )

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
      setResults(idleResults())
      setActive(0)
      const t = window.setTimeout(() => inputRef.current?.focus(), 50)
      return () => window.clearTimeout(t)
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(idleResults())
      return
    }
    const actions = [...matchingActions(q, profile?.role), ...commandResults(q), ...navResults(q, profile?.role)]
    if (!user) {
      setResults(actions)
      return
    }
    setLoading(true)
    const isNutritionist = profile?.role === 'nutritionist'
    const studentHref = isNutritionist ? '/nutrition' : '/students'
    const trimmed = q.trim()
    const ilike = `%${escapeIlikePattern(trimmed)}%`
    const { data: accessibleStudents } = await fetchAccessibleStudents()
    const students = filterAccessibleStudents(accessibleStudents, { search: trimmed }).slice(0, 5)
    const accessibleIds = accessibleStudents.map((s) => s.id)

    const routinesPromise =
      accessibleIds.length > 0
        ? supabase
            .from('routines')
            .select('id, name, status, student_id')
            .in('student_id', accessibleIds)
            .ilike('name', ilike)
            .limit(5)
        : Promise.resolve({
            data: [] as { id: string; name: string; status: string; student_id: string }[],
            error: null,
          })

    const mealPlansPromise =
      accessibleIds.length > 0
        ? supabase
            .from('trainer_student_meal_plans')
            .select('id, title, student_id, student:students(full_name)')
            .in('student_id', accessibleIds)
            .ilike('title', ilike)
            .limit(5)
        : Promise.resolve({ data: [] as { id: string; title: string | null; student_id: string; student?: { full_name?: string } | null }[], error: null })

    const [{ data: routines }, { data: mealPlans }] = await Promise.all([
      routinesPromise,
      mealPlansPromise,
    ])
    const res: Result[] = [
      ...actions,
      ...(students ?? []).map((s) => {
        const tagHint = studentTrainerTags(s).slice(0, 2).join(', ')
        const subParts = [s.level, s.status, tagHint].filter(Boolean)
        return {
          id: s.id,
          label: s.full_name,
          sub: subParts.join(' · '),
          kind: 'student' as const,
          href: `${studentHref}/${s.id}`,
        }
      }),
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
        href: isNutritionist
          ? `${studentHref}/${p.student_id}`
          : `/students/${p.student_id}/meal-plan/${p.id}`,
      })),
    ]
    setResults(res)
    setActive(0)
    setLoading(false)
  }, [user, profile?.role, commandResults, idleResults])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => void search(query), 220)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [query, search])

  function go(r: Result) {
    setOpen(false)
    if (r.run) {
      r.run()
      return
    }
    pushRecent(r)
    navigate(r.href)
  }

  // v2 · atajos de teclado: «N» nuevo alumno, «G» y una letra para ir a cada sección.
  useEffect(() => {
    if (!IS_V2) return
    let pendingG = 0
    const goKeys = goKeysFor(profile?.role)
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target) || document.querySelector('[aria-modal="true"]')) return
      const k = e.key.toLowerCase()
      if (pendingG && Date.now() - pendingG < 1200) {
        pendingG = 0
        const href = goKeys.find((g) => g.key === k)?.href
        if (href) {
          e.preventDefault()
          navigate(href)
        }
        return
      }
      if (k === 'g') {
        pendingG = Date.now()
        return
      }
      if (k === 'n' && trains(profile?.role)) {
        e.preventDefault()
        navigate('/students/new')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navigate, profile?.role])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    }
    if (e.key === 'Enter' && results[active]) go(results[active])
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
            placeholder="Buscá o elegí una acción…"
            aria-label="Buscar alumnos, rutinas y planes"
            aria-controls={listboxId}
            aria-activedescendant={results[active] ? `search-result-${active}` : undefined}
            autoComplete="off"
            className={searchInputClass}
          />
          {query ? (
            <Button
              variant="ghost"
              size="iconSm"
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => setQuery('')}
              className="text-ink-muted">
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <kbd className="hidden shrink-0 rounded border border-surface-border/80 bg-surface-elevated/60 px-1.5 py-0.5 text-3xs font-medium text-ink-muted sm:inline">
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
              {GROUPS.map(({ kind: k, label }) => {
                const group = results.filter((r) => r.kind === k)
                if (group.length === 0) return null
                return (
                  <div key={k}>
                    <p className="px-3 pb-0.5 pt-2 text-3xs font-semibold text-ink-muted">
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
                              onClick={() => go(r)}
                              onMouseEnter={() => setActive(i)}
                              className={cn(
                                'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                                isActive ? 'bg-surface-elevated' : 'hover:bg-surface-elevated/60',
                              )}
                            >
                              <span className={resultIconPodClass} aria-hidden>
                                {r.icon ? (
                                  <r.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                                ) : r.kind === 'student' || r.kind === 'recent' ? (
                                  <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                                ) : r.kind === 'routine' ? (
                                  <Dumbbell className="h-3.5 w-3.5" strokeWidth={1.75} />
                                ) : (
                                  <UtensilsCrossed className="h-3.5 w-3.5" strokeWidth={1.75} />
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-ink-primary">{r.label}</p>
                                <p className="truncate text-2xs text-ink-muted">{r.sub}</p>
                              </div>
                              {r.hint ? (
                                <kbd className="hidden shrink-0 rounded border border-surface-border/80 bg-surface-elevated/60 px-1.5 py-0.5 text-3xs font-medium text-ink-muted sm:inline">
                                  {r.hint}
                                </kbd>
                              ) : null}
                              {isActive && (r.kind === 'action' || r.kind === 'nav' || r.kind === 'command') ? (
                                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
                              ) : null}
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
          <span className="text-3xs text-ink-muted">↑↓ navegar</span>
          <span className="text-3xs text-ink-muted">↵ abrir</span>
          <span className="text-3xs text-ink-muted">esc cerrar</span>
          {IS_V2 ? <span className="ml-auto hidden text-3xs text-ink-muted sm:inline">N nuevo alumno · G + letra para ir</span> : null}
        </div>
      </div>
    </div>
  )
}
