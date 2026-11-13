import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

type Row = { id: string; full_name: string; created_at: string; owner_id: string; owner_name: string }

const SEEN_KEY = 'hh-admin-new-students-seen'
function readSeen(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * v2 · Inicio del administrador: alumnos que ingresaron en los últimos 14 días con OTROS
 * profesionales (20261117120000_marketplace_cases_admin_new_students.sql). Solo nombre, fecha y con
 * quién. Sin altas nuevas, o sin la migración, no se muestra.
 */
export function AdminNewStudentsPanelV2() {
  const [seen, setSeen] = useState(readSeen)
  const q = useQuery({
    queryKey: ['v2', 'admin-recent-students'],
    staleTime: 60_000,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.rpc('admin_recent_students', { p_days: 14 })
      return error || !Array.isArray(data) ? [] : (data as Row[])
    },
  })
  const list = (q.data ?? []).filter((r) => !seen.includes(r.id))
  if (list.length === 0) return null

  function markSeen(ids: string[]) {
    const next = [...seen, ...ids].slice(-500)
    setSeen(next)
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next))
    } catch {
      /* sin storage: vuelven a aparecer al recargar */
    }
  }

  return (
    <section aria-labelledby="altas-otros" className="rounded-2xl border border-surface-border bg-surface-card">
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <UserPlus className="h-4 w-4 text-ink-secondary" aria-hidden />
        <h2 id="altas-otros" className="text-sm font-semibold text-ink-primary">
          {list.length === 1 ? 'Ingresó 1 alumno con otro profesional' : `Ingresaron ${list.length} alumnos con otros profesionales`}
        </h2>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => markSeen(list.map((r) => r.id))}>
          Marcar todos como vistos
        </Button>
      </div>
      <ul className="divide-y divide-surface-border px-4 pb-1">
        {list.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-primary">{r.full_name}</p>
              <p className="text-xs text-ink-secondary">
                Con {r.owner_name} · {format(new Date(r.created_at), "d 'de' MMMM", { locale: es })}
              </p>
            </div>
            <Button size="sm" variant="secondary" icon={<Check className="h-3.5 w-3.5" />} onClick={() => markSeen([r.id])}>
              Visto
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
