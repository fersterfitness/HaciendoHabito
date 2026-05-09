import { useMemo, Fragment, type ReactNode } from 'react'
import { ClipboardList } from 'lucide-react'
import { Card, CardTitle } from '@/components/ui/Card'
import { trainerCtaAccentTextClassName, trainerCtaTintBgClassName } from '@/lib/primaryGradientCtaClasses'
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
        <div className={cn('border-t border-surface-border/70 pt-3', wrapperClass)}>
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
            <ClipboardList className="h-3.5 w-3.5 shrink-0 text-brand-secondary" aria-hidden />
          ) : (
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl',
                trainerCtaTintBgClassName,
                trainerCtaAccentTextClassName,
              )}
            >
              <ClipboardList className="h-4 w-4" aria-hidden />
            </span>
          )}
          <CardTitle
            className={cn(
              'mb-0',
              variant === 'minimal'
                ? 'text-[11px] font-semibold uppercase tracking-wide text-ink-muted'
                : 'text-sm',
            )}
          >
            Observaciones
          </CardTitle>
        </div>
        <p className={cn(
          variant === 'minimal'
            ? 'text-sm leading-relaxed text-ink-secondary'
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
          <ClipboardList className="h-3.5 w-3.5 shrink-0 text-brand-secondary" aria-hidden />
        ) : (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
              trainerCtaTintBgClassName,
              trainerCtaAccentTextClassName,
            )}
          >
            <ClipboardList className="h-4 w-4" aria-hidden />
          </span>
        )}
        <CardTitle
          className={cn(
            'mb-0',
            variant === 'minimal'
              ? 'text-[11px] font-semibold uppercase tracking-wide text-ink-muted'
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
                  'inline-flex max-w-full px-2 py-1 text-[11px] font-medium leading-snug text-ink-secondary',
                  variant === 'minimal'
                    ? 'border border-surface-border/70'
                    : 'rounded-lg border border-[#ff5508]/25 bg-[#ff5508]/[0.08] text-[#ff5508] dark:text-[#ffa065]',
                )}
              >
                {batch.content}
              </p>
            ) : null}
            {batch.kind === 'free' ? (
              <p className={cn(
                variant === 'minimal'
                  ? 'text-sm leading-relaxed text-ink-secondary'
                  : 'text-sm text-ink-secondary leading-relaxed',
                'whitespace-pre-wrap',
              )}>{batch.content}</p>
            ) : null}
            {batch.kind === 'pairs' ? (
              <div
                className={cn(
                  variant === 'minimal'
                    ? 'divide-y divide-surface-border/70'
                    : 'divide-y divide-surface-border rounded-xl border border-surface-border bg-surface-elevated/90',
                  'overflow-hidden',
                )}
              >
                {batch.pairs.map((p, j) => (
                  <div
                    key={j}
                    className={cn(
                      'grid gap-2 px-3 py-3 sm:grid-cols-[minmax(9rem,14rem)_1fr] sm:gap-6 sm:items-start sm:px-4 lg:grid-cols-[minmax(12rem,18rem)_1fr] lg:px-5',
                      variant === 'minimal' && 'border-0 px-2 sm:px-0 py-3 first:pt-0',
                    )}
                  >
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{p.label}</dt>
                    <dd
                      className={cn(
                        'text-sm leading-snug text-ink-primary',
                        // Evita que fechas ISO cortas “caigan” a la línea siguiente
                        /^\d{4}-\d{2}-\d{2}/.test(p.value) && 'whitespace-nowrap tabular-nums',
                        !/^\d{4}-\d{2}-\d{2}/.test(p.value) && 'break-words',
                      )}
                    >
                      {p.value}
                    </dd>
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
