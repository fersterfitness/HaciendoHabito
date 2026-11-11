import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, ExternalLink, Link2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { copyWhatsAppMessage } from '@/lib/whatsapp'
import { ensureRoutineShareToken, findRoutineShareToken, ROUTINE_SHARE_CHANGED, sharedRoutineUrl } from '@/lib/routine/sharedRoutine'

/** The student's stable public link stays visible above every tab in their profile. */
export function StudentRoutineLinkCard({ studentId }: { studentId: string }) {
  const ownerId = useAuthStore((s) => s.user?.id)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)
  const load = useCallback(async () => {
    const version = ++request.current
    if (!ownerId) { setLoading(false); return }
    setError(null)
    try {
      const next = await findRoutineShareToken(ownerId, studentId)
      if (version === request.current) setToken(next)
    } catch (e) {
      if (version === request.current) {
        setToken(null)
        setError(e instanceof Error ? e.message : 'No se pudo cargar el enlace')
      }
    } finally {
      if (version === request.current) setLoading(false)
    }
  }, [ownerId, studentId])

  useEffect(() => {
    setToken(null)
    setLoading(true)
    void load()
    const refresh = () => { void load() }
    window.addEventListener(ROUTINE_SHARE_CHANGED, refresh)
    window.addEventListener('focus', refresh)
    return () => {
      request.current++
      window.removeEventListener(ROUTINE_SHARE_CHANGED, refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [load])

  async function create() {
    if (!ownerId) return
    setCreating(true)
    try {
      await ensureRoutineShareToken(ownerId, studentId)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear el enlace')
    } finally { setCreating(false) }
  }

  const url = token ? sharedRoutineUrl(token) : null
  return (
    <section aria-label="Enlace de la rutina del alumno" className="rounded-2xl border border-surface-border bg-surface-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-ink-primary"><Link2 className="h-5 w-5" aria-hidden /></span>
          <div>
            <h2 className="text-sm font-semibold text-ink-primary">Rutina del alumno · enlace web</h2>
            <p className="mt-0.5 text-xs text-ink-muted">El mismo enlace, siempre actualizado.</p>
          </div>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-ink-muted" aria-label="Cargando enlace" /> : url ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="primary" size="sm"><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" aria-hidden /> Ver como alumno</a></Button>
            <Button type="button" variant="secondary" size="sm" icon={<Copy className="h-3.5 w-3.5" aria-hidden />} onClick={() => void copyWhatsAppMessage(url).then((ok) => ok ? toast.success('Enlace copiado') : toast.error('No se pudo copiar. Seleccioná el enlace y copialo.'))}>Copiar enlace</Button>
          </div>
        ) : error ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>Reintentar</Button>
        ) : (
          <Button type="button" variant="secondary" size="sm" loading={creating} disabled={!ownerId} onClick={() => void create()}>Crear enlace del alumno</Button>
        )}
      </div>
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 block break-all rounded-lg bg-surface-elevated px-3 py-2 text-xs text-ink-secondary underline-offset-4 hover:underline">{url}</a> : null}
      {error ? <p role="alert" className="mt-2 text-xs text-status-expired">{error}</p> : null}
      <p className="mt-2 text-2xs leading-relaxed text-ink-muted">No vence por fecha. Generar un enlace nuevo invalida el anterior.</p>
    </section>
  )
}
