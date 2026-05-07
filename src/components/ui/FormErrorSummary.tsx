import { useEffect, useMemo, useState } from 'react'
import type { FieldErrors } from 'react-hook-form'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

function flattenErrors(errors: FieldErrors): string[] {
  const out: string[] = []
  function walk(obj: unknown) {
    if (!obj || typeof obj !== 'object') return
    const rec = obj as Record<string, unknown>
    for (const v of Object.values(rec)) {
      if (!v) continue
      if (typeof v === 'object' && v && 'message' in (v as Record<string, unknown>)) {
        const msg = (v as { message?: unknown }).message
        if (typeof msg === 'string' && msg.trim()) out.push(msg.trim())
      }
      walk(v)
    }
  }
  walk(errors)
  return out
}

export function FormErrorSummary({
  errors,
  className,
  title = 'Revisá estos campos',
}: {
  errors: FieldErrors
  className?: string
  title?: string
}) {
  const messages = useMemo(() => flattenErrors(errors), [errors])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(messages.length > 0)
  }, [messages.length])

  if (!visible || messages.length === 0) return null

  return (
    <div
      role="alert"
      className={cn(
        'rounded-2xl border border-status-expired/30 bg-status-expired/10 px-4 py-3 text-sm',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-status-expired mt-0.5" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold text-ink-primary">{title}</p>
          <ul className="mt-1 space-y-0.5 text-[12px] text-ink-secondary">
            {Array.from(new Set(messages)).slice(0, 5).map((m) => (
              <li key={m} className="leading-snug">
                {m}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

