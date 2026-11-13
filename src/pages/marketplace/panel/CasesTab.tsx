import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Camera, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { SegmentedV2 } from '@/components/v2/ui'
import { CaseCard } from '@/components/marketplace/PublicCases'
import { uploadMarketplacePhoto } from '@/data/marketplace'
import {
  CASES_MIGRATION,
  MAX_CASES,
  cleanVideoUrl,
  useDeleteCase,
  useManagedCases,
  useSaveCase,
  type MarketplaceCaseType,
} from '@/data/marketplaceCases'
import { useAuthStore } from '@/stores/authStore'

const TYPE_HINT: Record<MarketplaceCaseType, string> = {
  foto: 'Un antes y después, una foto con el alumno, una captura de un mensaje.',
  video: 'Pegá el link de YouTube, Instagram, TikTok, Vimeo o Drive. Se abre en ese sitio.',
  mensaje: 'Lo que te dijo un alumno, con sus palabras.',
}

/** Pestaña «Casos de éxito» del perfil: lo que el profesional muestra de su trabajo en la web. */
export function CasesTab({ professionalId, published }: { professionalId: string; published: boolean }) {
  const user = useAuthStore((s) => s.user)
  const q = useManagedCases(professionalId)
  const save = useSaveCase()
  const del = useDeleteCase()
  const [tipo, setTipo] = useState<MarketplaceCaseType>('foto')
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const cases = q.data?.cases ?? []
  const available = q.data?.available ?? true
  const full = cases.length >= MAX_CASES

  async function onPick(file: File | undefined) {
    if (!file || !user) return
    setUploading(true)
    setError('')
    try {
      setPhotoUrl(await uploadMarketplacePhoto(user.id, file))
    } catch (e) {
      setError(e instanceof Error && /imagen|JPG|MB/.test(e.message) ? e.message : 'No se pudo subir la foto. Probá de nuevo.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function add() {
    setError('')
    const video = tipo === 'video' ? cleanVideoUrl(videoUrl) : null
    if (tipo === 'foto' && !photoUrl) return setError('Subí la foto antes de agregar el caso.')
    if (tipo === 'video' && !video) return setError('Pegá un link de YouTube, Instagram, TikTok, Vimeo o Drive.')
    if (tipo === 'mensaje' && texto.trim().length < 3) return setError('Escribí el mensaje.')
    save.mutate(
      {
        id: null,
        professionalId,
        orden: cases.length,
        input: { tipo, titulo: titulo.trim(), texto: texto.trim(), media_url: tipo === 'foto' ? photoUrl : tipo === 'video' ? video : null },
      },
      {
        onSuccess: () => {
          toast.success('Caso agregado')
          setTitulo('')
          setTexto('')
          setPhotoUrl(null)
          setVideoUrl('')
        },
        onError: (e) => setError((e as { message?: string }).message?.includes('mkt_case_limit') ? `Se pueden cargar hasta ${MAX_CASES} casos.` : 'No se pudo guardar. Revisá los datos y probá de nuevo.'),
      },
    )
  }

  if (!available) {
    return <p className="rounded-2xl border border-dashed border-surface-inputBorder p-6 text-sm text-ink-secondary">Para cargar casos de éxito falta correr en Supabase {CASES_MIGRATION}.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface-card p-5 sm:p-6">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-ink-primary">Agregar un caso</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
            Se muestran en el perfil público{published ? '' : ' (cuando el perfil esté publicado)'}. Publicá solo lo que la persona aceptó que se muestre.
          </p>
        </div>
        <SegmentedV2
          value={tipo}
          onChange={(v) => {
            setTipo(v)
            setError('')
          }}
          options={[
            { value: 'foto', label: 'Foto' },
            { value: 'video', label: 'Video' },
            { value: 'mensaje', label: 'Mensaje' },
          ]}
        />
        <p className="-mt-1 text-xs text-ink-muted">{TYPE_HINT[tipo]}</p>

        {tipo === 'foto' ? (
          <div className="flex flex-wrap items-center gap-3">
            {photoUrl ? <img src={photoUrl} alt="" className="h-24 w-20 rounded-xl object-cover" /> : null}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void onPick(e.target.files?.[0])} />
            <Button variant="secondary" loading={uploading} icon={<Camera className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
              {photoUrl ? 'Cambiar foto' : 'Subir foto'}
            </Button>
          </div>
        ) : null}
        {tipo === 'video' ? (
          <Input label="Link del video" placeholder="https://www.instagram.com/reel/…" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
        ) : null}
        <Input label="Título (opcional)" placeholder="Por ejemplo: Lucía, 12 semanas" value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} />
        <Textarea
          label={tipo === 'mensaje' ? 'Mensaje' : 'Descripción (opcional)'}
          rows={3}
          maxLength={800}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        {error ? <p className="text-sm text-status-expired">{error}</p> : null}
        <div>
          <Button icon={<Plus className="h-4 w-4" />} loading={save.isPending} disabled={full || uploading} onClick={add}>
            Agregar caso
          </Button>
          {full ? <p className="mt-2 text-xs text-ink-muted">Llegaste al máximo de {MAX_CASES} casos: borrá alguno para sumar otro.</p> : null}
        </div>
      </section>

      {q.isPending ? null : cases.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-surface-inputBorder p-6 text-sm text-ink-muted">Todavía no hay casos cargados.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <li key={c.id} className="flex flex-col gap-2">
              <CaseCard c={c} />
              <Button
                size="sm"
                variant="ghost"
                className="self-start"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => del.mutate({ id: c.id, professionalId }, { onSuccess: () => toast.success('Caso borrado'), onError: () => toast.error('No se pudo borrar') })}
              >
                Borrar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
