import { useRef, useState } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Zona para arrastrar (o elegir) el informe PDF de composición corporal. */
export function AnthropometryReportDropZone({
  busy,
  onFile,
  title = 'Importar informe PDF',
  hint,
  error,
  className,
}: {
  busy: boolean
  onFile: (file: File) => void
  title?: string
  hint: string
  error?: string | null
  className?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  return (
    <div className={className}>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onFile(f)
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const f = e.dataTransfer.files?.[0]
          if (f) onFile(f)
        }}
        disabled={busy}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border border-dashed px-4 py-3.5 text-left transition-colors',
          over ? 'border-brand-primary bg-brand-primary/5' : 'border-surface-border hover:border-ink-muted/60 hover:bg-surface-elevated/40',
        )}
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-ink-secondary">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink-primary">{busy ? 'Leyendo el informe…' : title}</span>
          <span className="block text-2xs text-ink-muted">{hint}</span>
        </span>
      </button>
      {error ? (
        <p role="alert" className="mt-2 rounded-xl border border-status-expired/30 bg-status-expired/10 px-3 py-2.5 text-2xs font-medium text-status-expired">
          {error}
        </p>
      ) : null}
    </div>
  )
}
