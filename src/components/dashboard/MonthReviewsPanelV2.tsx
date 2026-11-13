import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Download, EyeOff, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { fetchRecentMonthReviews, type MonthReview } from '@/lib/routine/studentAppExtras'

const HIDDEN_KEY = 'hh-month-reviews-hidden'
function readHidden(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * v2 · Inicio del entrenador: devoluciones que los alumnos dejan al cerrar su mes de rutina.
 * Cada una se descarga como imagen para compartir. Solo se ofrece la descarga si el alumno aceptó
 * que se comparta.
 */
export function MonthReviewsPanelV2({ ownerId }: { ownerId: string }) {
  const [hidden, setHidden] = useState(readHidden)
  const q = useQuery({ queryKey: ['v2', 'month-reviews', ownerId], queryFn: () => fetchRecentMonthReviews(ownerId), staleTime: 60_000 })
  const list = (q.data ?? []).filter((r) => !hidden.includes(r.routine_id))
  if (list.length === 0) return null

  function hide(id: string) {
    const next = [...hidden, id].slice(-200)
    setHidden(next)
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next))
    } catch {
      /* sin storage: vuelve a aparecer al recargar */
    }
  }

  return (
    <section aria-labelledby="devoluciones-mes" className="rounded-2xl border border-surface-border bg-surface-card">
      <h2 id="devoluciones-mes" className="px-4 pt-3.5 text-sm font-semibold text-ink-primary">
        Devoluciones de fin de mes
      </h2>
      <ul className="divide-y divide-surface-border px-4 pb-1">
        {list.map((r) => (
          <ReviewRow key={r.routine_id} review={r} onHide={() => hide(r.routine_id)} />
        ))}
      </ul>
    </section>
  )
}

function ReviewRow({ review: r, onHide }: { review: MonthReview; onHide: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const first = r.student_name.trim().split(/\s+/)[0] ?? 'Alumno'

  async function download() {
    if (!cardRef.current) return
    setBusy(true)
    try {
      const { toPng } = await import('html-to-image')
      const href = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })
      const a = document.createElement('a')
      a.href = href
      a.download = `devolucion-${first.toLowerCase()}.png`
      a.click()
    } catch {
      toast.error('No se pudo generar la imagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-3 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-sm font-semibold text-ink-primary">{r.student_name}</p>
        <p className="text-xs text-ink-muted">
          {r.routine_name ? `${r.routine_name} · ` : ''}
          {format(new Date(r.created_at), "d 'de' MMMM", { locale: es })}
        </p>
        <span className={r.share_ok ? 'ml-auto rounded-full bg-status-ok/15 px-2 py-0.5 text-2xs font-medium text-status-ok-ink' : 'ml-auto rounded-full bg-surface-elevated px-2 py-0.5 text-2xs font-medium text-ink-secondary'}>
          {r.share_ok ? 'Aceptó que se comparta' : 'No autorizó compartirla'}
        </span>
      </div>

      {/* La tarjeta que se descarga: colores fijos (naranja y negro del proyecto) para que salga igual en claro y oscuro. */}
      <div ref={cardRef} className="rounded-2xl p-6" style={{ background: '#111111', color: '#FFFFFF' }}>
        {r.rating ? (
          <div className="mb-3 flex gap-1" style={{ color: '#FF7A1A' }} aria-label={`${r.rating} de 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className="h-4 w-4" fill={n <= r.rating! ? 'currentColor' : 'none'} />
            ))}
          </div>
        ) : null}
        <p className="whitespace-pre-line text-base leading-relaxed">«{r.review}»</p>
        <p className="mt-4 text-sm font-semibold">{first}</p>
        <p className="mt-0.5 text-xs" style={{ color: '#FF7A1A' }}>
          A seguir haciéndolo hábito.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {r.share_ok ? (
          <Button size="sm" loading={busy} icon={<Download className="h-3.5 w-3.5" />} onClick={() => void download()}>
            Descargar imagen
          </Button>
        ) : null}
        <Button size="sm" variant="secondary" icon={<EyeOff className="h-3.5 w-3.5" />} onClick={onHide}>
          Ocultar
        </Button>
      </div>
    </li>
  )
}
