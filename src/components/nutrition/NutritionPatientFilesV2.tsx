import { useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ExternalLink, FileText, Loader2, Sparkles, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { v2TabClass, v2TabCountClass, v2TabListClass } from '@/components/v2/tabStyle'
import { cn } from '@/lib/utils'
import { shortDocumentTitle } from '@/lib/nutrition/documentTitle'
import type { NutritionDocumentCategory, NutritionPatientDocument } from '@/types/database'

const KINDS: { key: NutritionDocumentCategory; label: string; plural: string }[] = [
  { key: 'antropometria', label: 'Antropometría', plural: 'Antropometrías' },
  { key: 'anamnesis', label: 'Anamnesis', plural: 'Anamnesis' },
  { key: 'laboratorio', label: 'Laboratorio', plural: 'Laboratorios' },
]

type Filter = 'all' | NutritionDocumentCategory


/**
 * v2: una sola forma de subir (arrastrar o elegir, indicando qué es) y la lista agrupada por mes.
 */
export function NutritionPatientFilesV2({
  documents,
  onUpload,
  onOpen,
  onDelete,
  deletingId,
  onCompare,
  patientName,
}: {
  patientName: string
  documents: NutritionPatientDocument[]
  onUpload: (category: NutritionDocumentCategory, files: FileList | null) => Promise<void>
  onOpen: (path: string) => void
  onDelete: (doc: NutritionPatientDocument) => void
  deletingId: string | null
  onCompare: () => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [kind, setKind] = useState<NutritionDocumentCategory>('antropometria')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      await onUpload(kind, files)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: documents.length, antropometria: 0, anamnesis: 0, laboratorio: 0 }
    for (const d of documents) c[d.category] += 1
    return c
  }, [documents])

  const groups = useMemo(() => {
    const list = (filter === 'all' ? documents : documents.filter((d) => d.category === filter))
      .slice()
      .sort((a, b) => b.document_date.localeCompare(a.document_date) || (b.uploaded_at ?? '').localeCompare(a.uploaded_at ?? ''))
    const out: { month: string; docs: NutritionPatientDocument[] }[] = []
    for (const d of list) {
      const month = d.document_date.slice(0, 7)
      const g = out[out.length - 1]
      if (g && g.month === month) g.docs.push(d)
      else out.push({ month, docs: [d] })
    }
    return out
  }, [documents, filter])

  return (
    <Card padding="lg">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Archivos del paciente</CardTitle>
          <p className="mt-1 text-sm text-ink-muted">Informes de antropometría, anamnesis y estudios en PDF.</p>
        </div>
        <Button size="sm" variant="secondary" icon={<Sparkles className="h-4 w-4" />} onClick={onCompare}>
          Comparar 2 PDFs
        </Button>
      </div>

      {/* Subida: se elige qué es y se arrastra o se busca el archivo. */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void upload(e.dataTransfer.files)
        }}
        className={cn(
          'rounded-2xl border border-dashed px-4 py-5 transition-colors sm:px-6',
          dragging ? 'border-ink-primary bg-surface-elevated' : 'border-surface-border bg-surface-panel',
        )}
      >
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-card text-ink-secondary shadow-[0_0_0_1px_rgb(var(--surface-border))]">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-ink-primary">{dragging ? 'Soltá para subir' : 'Arrastrá PDFs acá o elegilos'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-ink-muted">Guardar como</span>
              <div role="radiogroup" aria-label="Tipo de archivo" className="inline-flex rounded-lg bg-surface-elevated/80 p-0.5">
                {KINDS.map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    role="radio"
                    aria-checked={kind === k.key}
                    onClick={() => setKind(k.key)}
                    className={cn(
                      'h-7 rounded-md px-2.5 text-[12px] font-medium transition-colors',
                      kind === k.key ? 'bg-surface-card text-ink-primary shadow-sm' : 'text-ink-secondary hover:text-ink-primary',
                    )}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button size="sm" type="button" loading={uploading} onClick={() => inputRef.current?.click()}>
            Elegir PDF
          </Button>
          <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
        </div>
      </div>

      {documents.length ? (
        <div className={cn(v2TabListClass, 'mt-6 flex-wrap')}>
          {([{ key: 'all', plural: 'Todos' }, ...KINDS] as { key: Filter; plural: string }[]).map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={v2TabClass(filter === f.key, 'sm')}>
              {f.plural}
              <span className={v2TabCountClass(filter === f.key)}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        {groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            {documents.length ? 'No hay archivos de este tipo.' : 'Todavía no hay archivos. El primero se sube desde el recuadro de arriba.'}
          </p>
        ) : (
          groups.map((g) => (
            <section key={g.month} className="mb-4 last:mb-0">
              <p className="mb-1 px-1 text-[11px] font-semibold text-ink-muted first-letter:uppercase">
                {format(parseISO(`${g.month}-01`), 'MMMM yyyy', { locale: es })}
              </p>
              <ul className="divide-y divide-surface-border/70">
                {g.docs.map((doc) => {
                  const k = KINDS.find((x) => x.key === doc.category)
                  return (
                    <li key={doc.id} className="group flex items-center gap-3 rounded-xl px-1 py-2.5 transition-colors hover:bg-surface-panel">
                      <button type="button" onClick={() => onOpen(doc.file_path)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <span className="relative inline-flex h-10 w-9 shrink-0 items-end justify-center rounded-md border border-surface-border bg-surface-card pb-1">
                          <FileText className="absolute left-1/2 top-1.5 h-3.5 w-3.5 -translate-x-1/2 text-ink-muted" />
                          <span className="text-[8px] font-bold tracking-wide text-ink-muted">PDF</span>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium text-ink-primary group-hover:underline group-hover:underline-offset-2" title={doc.title}>{shortDocumentTitle(doc.title, patientName)}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-muted">
                            <span className="rounded-md bg-surface-elevated px-1.5 py-px text-[11px] font-medium text-ink-secondary">{k?.label ?? doc.category}</span>
                            {format(parseISO(doc.uploaded_at ?? doc.document_date), "d MMM yyyy", { locale: es })}
                          </span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
                        <button
                          type="button"
                          onClick={() => onOpen(doc.file_path)}
                          aria-label={`Abrir ${doc.title}`}
                          title="Abrir"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-elevated hover:text-ink-primary"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(doc)}
                          disabled={deletingId === doc.id}
                          aria-label={`Eliminar ${doc.title}`}
                          title="Eliminar"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-status-expired/10 hover:text-status-expired disabled:opacity-50"
                        >
                          {deletingId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </Card>
  )
}
