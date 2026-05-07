import { useMemo, Fragment, type ReactNode } from 'react'
import { ClipboardList } from 'lucide-react'
import { Card, CardTitle } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { parseStudentNotesDisplay, type StudentNoteRow } from '@/lib/studentNotesDisplay'

type Props = {
  notes: string
  className?: string
  /** Listado plano tipo Gray UI (sin card contenedora). */
  variant?: 'default' | 'minimal'
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

export function StudentNotesCard({ notes, className, variant = 'default' }: Props) {
  const rows = useMemo(() => parseStudentNotesDisplay(notes), [notes])
  const structured = rows.some((r) => r.kind === 'pair' || r.kind === 'meta')
  const hasOnlyFree = rows.length > 0 && rows.every((r) => r.kind === 'free')
  const batches = useMemo(() => batchRows(rows), [rows])

  function Wrapper({ children, wrapperClass }: { children: ReactNode; wrapperClass?: string }) {
    if (variant === 'minimal') {
      return (
        <div className={cn('border-t border-zinc-200/55 pt-4 dark:border-zinc-800/70', wrapperClass)}>
          {children}
        </div>
      )
    }
    return <Card className={wrapperClass}>{children}</Card>
  }

  if (hasOnlyFree || !structured) {
    const inner = (
      <>
        <div className="mb-3 flex items-center gap-2">
          {variant === 'minimal' ? (
            <ClipboardList className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
              <ClipboardList className="h-4 w-4" aria-hidden />
            </span>
          )}
          <CardTitle
            className={cn(
              'mb-0',
              variant === 'minimal'
                ? 'text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400'
                : 'text-sm',
            )}
          >
            Observaciones
          </CardTitle>
        </div>
        <p className={cn(
          variant === 'minimal'
            ? 'text-sm leading-relaxed text-zinc-600 dark:text-zinc-400'
            : 'text-sm text-ink-secondary leading-relaxed',
          'whitespace-pre-wrap',
        )}>{notes.trim()}</p>
      </>
    )

    return <Wrapper wrapperClass={className}>{inner}</Wrapper>
  }

  return (
    <Wrapper wrapperClass={variant === 'default' ? cn('overflow-hidden', className) : className}>
      <div className={variant === 'minimal' ? 'mb-3 flex items-center gap-2' : 'mb-4 flex items-center gap-2'}>
        {variant === 'minimal' ? (
          <ClipboardList className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
            <ClipboardList className="h-4 w-4" aria-hidden />
          </span>
        )}
        <CardTitle
          className={cn(
            'mb-0',
            variant === 'minimal'
              ? 'text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400'
              : 'text-sm',
          )}
        >
          Observaciones
        </CardTitle>
      </div>

      <div className={variant === 'minimal' ? 'space-y-2' : 'space-y-3'}>
        {batches.map((batch, i) => (
          <Fragment key={`batch-${i}`}>
            {batch.kind === 'meta' ? (
              <p
                className={cn(
                  'inline-flex max-w-full px-2 py-1 text-[11px] font-medium leading-snug text-zinc-600 dark:text-zinc-400',
                  variant === 'minimal'
                    ? 'border border-zinc-200/65 dark:border-zinc-700/80'
                    : 'rounded-lg border border-brand-primary/25 bg-brand-primary/8 text-brand-primary',
                )}
              >
                {batch.content}
              </p>
            ) : null}
            {batch.kind === 'free' ? (
              <p className={cn(
                variant === 'minimal'
                  ? 'text-sm leading-relaxed text-zinc-600 dark:text-zinc-400'
                  : 'text-sm text-ink-secondary leading-relaxed',
                'whitespace-pre-wrap',
              )}>{batch.content}</p>
            ) : null}
            {batch.kind === 'pairs' ? (
              <div
                className={cn(
                  variant === 'minimal'
                    ? 'divide-y divide-zinc-200/60 dark:divide-zinc-800'
                    : 'divide-y divide-surface-border rounded-xl border border-surface-border bg-surface-elevated/90',
                  'overflow-hidden',
                )}
              >
                {batch.pairs.map((p, j) => (
                  <div
                    key={j}
                    className={cn(
                      'grid gap-1.5 px-3 py-2.5 sm:grid-cols-[minmax(7.5rem,11rem)_1fr] sm:gap-4 sm:items-start sm:px-4',
                      variant === 'minimal' && 'border-0 px-2 sm:px-0 py-3 first:pt-0',
                    )}
                  >
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{p.label}</dt>
                    <dd className="text-sm leading-snug break-words text-zinc-800 dark:text-zinc-100">{p.value}</dd>
                  </div>
                ))}
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
    </Wrapper>
  )
}
