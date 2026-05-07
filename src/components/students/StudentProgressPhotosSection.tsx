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
    <div className="border-t border-zinc-200/55 pt-6 dark:border-zinc-800/70 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Camera className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              Progreso en fotografía
            </h3>
          </div>
          <p className="mt-2 max-w-[640px] text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Fotos opcionales por mes para seguimiento visual (no reemplazan evaluación profesional).
            Las sube el equipo o podés cargarlas si acordamos seguimiento con imágenes.
          </p>
        </div>
      </div>

      {canManage ? (
        <div className="flex flex-wrap items-end gap-3 border-b border-zinc-200/45 border-dashed pb-4 dark:border-zinc-700/65">
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
            className="border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800/45"
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
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{formatYmLabel(ym)}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {rows.map((ph) => {
                  const url = studentBucketPublicUrl(ph.storage_path)
                  return (
                    <figure
                      key={ph.id}
                      className="relative group aspect-[3/4] overflow-hidden rounded border border-zinc-200/55 bg-zinc-100/20 dark:border-zinc-800/65 dark:bg-zinc-950/40"
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
