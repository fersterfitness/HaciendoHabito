import { useMemo, Fragment } from 'react'
import { ClipboardList } from 'lucide-react'
import { Card, CardTitle } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { parseStudentNotesDisplay, type StudentNoteRow } from '@/lib/studentNotesDisplay'

type Props = {
  notes: string
  className?: string
}

/** Agrupa filas `pair` consecutivas en un solo bloque con divisores. */
function batchRows(rows: StudentNoteRow[]): Array<
  | { kind: 'meta'; content: string }
  | { kind: 'free'; content: string }
  | { kind: 'pairs'; pairs: { label: string; value: string }[] }
> {
  const out: Array<
    | { kind: 'meta'; content: string }
    | { kind: 'free'; content: string }
    | { kind: 'pairs'; pairs: { label: string; value: string }[] }
  > = []
  let pairBuf: { label: string; value: string }[] = []

  const flushPairs = () => {
    if (pairBuf.length > 0) {
      out.push({ kind: 'pairs', pairs: pairBuf })
      pairBuf = []
    }
  }

  for (const row of rows) {
    if (row.kind === 'pair') {
      pairBuf.push({ label: row.label, value: row.value })
      continue
    }
    flushPairs()
    if (row.kind === 'meta') out.push({ kind: 'meta', content: row.content })
    else out.push({ kind: 'free', content: row.content })
  }
  flushPairs()
  return out
}

export function StudentNotesCard({ notes, className }: Props) {
  const rows = useMemo(() => parseStudentNotesDisplay(notes), [notes])
  const structured = rows.some((r) => r.kind === 'pair' || r.kind === 'meta')
  const hasOnlyFree = rows.length > 0 && rows.every((r) => r.kind === 'free')
  const batches = useMemo(() => batchRows(rows), [rows])

  if (hasOnlyFree || !structured) {
    return (
      <Card className={className}>
        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
            <ClipboardList className="h-4 w-4" aria-hidden />
          </span>
          <CardTitle className="text-sm mb-0">Observaciones</CardTitle>
        </div>
        <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">{notes.trim()}</p>
      </Card>
    )
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex items-center gap-2 mb-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary shrink-0">
          <ClipboardList className="h-4 w-4" aria-hidden />
        </span>
        <CardTitle className="text-sm mb-0">Observaciones</CardTitle>
      </div>

      <div className="space-y-3">
        {batches.map((batch, i) => (
          <Fragment key={`batch-${i}`}>
            {batch.kind === 'meta' ? (
              <p className="inline-flex max-w-full rounded-lg border border-brand-primary/25 bg-brand-primary/8 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-brand-primary">
                {batch.content}
              </p>
            ) : null}
            {batch.kind === 'free' ? (
              <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">{batch.content}</p>
            ) : null}
            {batch.kind === 'pairs' ? (
              <div className="rounded-xl border border-surface-border bg-surface-elevated/90 divide-y divide-surface-border overflow-hidden">
                {batch.pairs.map((p, j) => (
                  <div
                    key={j}
                    className="grid gap-1.5 px-3 py-2.5 sm:grid-cols-[minmax(7.5rem,11rem)_1fr] sm:gap-4 sm:items-start sm:px-4"
                  >
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{p.label}</dt>
                    <dd className="text-sm text-ink-primary leading-snug break-words">{p.value}</dd>
                  </div>
                ))}
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
    </Card>
  )
}
