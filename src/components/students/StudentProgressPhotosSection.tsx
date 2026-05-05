import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import type { StudentProgressPhoto } from '@/types/database'
import {
  STUDENT_AVATAR_BUCKET,
  STUDENT_AVATAR_MAX_BYTES,
  studentBucketPublicUrl,
} from '@/lib/studentAvatar'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const ACCEPT = 'image/jpeg,image/png,image/webp'

function extFromFile(file: File): string | null {
  const raw = file.name.split('.').pop()?.toLowerCase()
  if (raw === 'jpg' || raw === 'jpeg' || raw === 'png' || raw === 'webp') return raw === 'jpeg' ? 'jpg' : raw
  const t = file.type
  if (t === 'image/jpeg') return 'jpg'
  if (t === 'image/png') return 'png'
  if (t === 'image/webp') return 'webp'
  return null
}

function ymNow(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatYmLabel(ym: string): string {
  const [y, mo] = ym.split('-')
  if (!y || !mo) return ym
  try {
    const d = new Date(Number(y), Number(mo) - 1, 1)
    return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  } catch {
    return ym
  }
}

type Props = {
  studentId: string
  /** Entrenador/admin dueño del alumno: puede subir y borrar */
  canManage: boolean
}

export function StudentProgressPhotosSection({ studentId, canManage }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<StudentProgressPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [month, setMonth] = useState(() => ymNow())
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('student_progress_photos')
      .select('*')
      .eq('student_id', studentId)
      .order('year_month', { ascending: false })
      .order('created_at', { ascending: false })

    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setPhotos((data ?? []) as StudentProgressPhoto[])
  }, [studentId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const byMonth = useMemo(() => {
    const m = new Map<string, StudentProgressPhoto[]>()
    for (const p of photos) {
      const list = m.get(p.year_month) ?? []
      list.push(p)
      m.set(p.year_month, list)
    }
    return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [photos])

  async function uploadOne(file: File) {
    if (!canManage) return
    if (file.size > STUDENT_AVATAR_MAX_BYTES) {
      toast.error('Cada imagen debe pesar como máximo 5 MB')
      return
    }
    const ext = extFromFile(file)
    if (!ext) {
      toast.error('Usá JPG, PNG o WebP')
      return
    }

    const ym = month.trim()
    if (!/^\d{4}-\d{2}$/.test(ym)) {
      toast.error('Mes inválido')
      return
    }

    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id
    if (!uid) return

    const id = crypto.randomUUID()
    const path = `${studentId}/progress/${ym}/${id}.${ext}`

    setUploading(true)
    try {
      const { error: upErr } = await supabase.storage.from(STUDENT_AVATAR_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (upErr) {
        toast.error(upErr.message)
        return
      }
      const { data: row, error: insErr } = await supabase
        .from('student_progress_photos')
        .insert({
          owner_id: uid,
          student_id: studentId,
          year_month: ym,
          storage_path: path,
          note: null,
        })
        .select('*')
        .single()

      if (insErr) {
        await supabase.storage.from(STUDENT_AVATAR_BUCKET).remove([path])
        toast.error(insErr.message)
        return
      }
      setPhotos((prev) => [row as StudentProgressPhoto, ...prev])
      toast.success('Foto guardada')
    } finally {
      setUploading(false)
    }
  }

  async function removePhoto(photo: StudentProgressPhoto) {
    if (!canManage) return
    setDeletingId(photo.id)
    try {
      const { error: rmErr } = await supabase.storage.from(STUDENT_AVATAR_BUCKET).remove([photo.storage_path])
      if (rmErr) console.warn(rmErr.message)
      const { error: delErr } = await supabase.from('student_progress_photos').delete().eq('id', photo.id)
      if (delErr) {
        toast.error(delErr.message)
        return
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
      toast.success('Foto eliminada')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-brand-primary shrink-0" aria-hidden />
            <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wide">Progreso en fotografía</h3>
          </div>
          <p className="text-[11px] text-ink-muted mt-1.5 leading-relaxed max-w-[640px]">
            Fotos opcionales por mes para seguimiento visual (no reemplazan evaluación profesional).
            Las sube el equipo o podés cargarlas si acordamos seguimiento con imágenes.
          </p>
        </div>
      </div>

      {canManage ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-surface-border bg-surface-muted/20 px-3 py-3">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted shrink-0">
            Mes
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 block h-9 rounded-lg border border-surface-border bg-surface-input px-2 text-sm text-ink-primary"
            />
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void uploadOne(f)
            }}
          />
          <Button
            type="button"
            size="sm"
            loading={uploading}
            disabled={uploading}
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Seleccionar foto
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-6 text-ink-muted">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        </div>
      ) : byMonth.length === 0 ? (
        <p className="text-sm text-ink-muted py-2">Aún no hay fotos cargadas por mes.</p>
      ) : (
        <div className="space-y-6">
          {byMonth.map(([ym, rows]) => (
            <div key={ym}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-2">{formatYmLabel(ym)}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {rows.map((ph) => {
                  const url = studentBucketPublicUrl(ph.storage_path)
                  return (
                    <figure
                      key={ph.id}
                      className="relative group rounded-xl border border-surface-border overflow-hidden bg-surface-muted/40 aspect-[3/4]"
                    >
                      {url ? (
                        <img src={url} alt={`Progreso ${ym}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-ink-muted">Sin vista previa</div>
                      )}
                      {canManage ? (
                        <button
                          type="button"
                          title="Eliminar"
                          aria-label="Eliminar foto"
                          disabled={deletingId === ph.id}
                          className={cn(
                            'absolute top-2 right-2 p-1.5 rounded-lg bg-black/55 text-white opacity-90 hover:bg-status-expired',
                            'transition-opacity opacity-100',
                          )}
                          onClick={() => void removePhoto(ph)}
                        >
                          {deletingId === ph.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          )}
                        </button>
                      ) : null}
                    </figure>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
