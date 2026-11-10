import { useState } from 'react'
import { PillButtonV2 } from '@/components/v2/ui'
import { AnimatePresence, motion } from 'motion/react'
import { format, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, UserX } from 'lucide-react'
import { cn } from '@/lib/utils'

export type UnmarkedAppointment = { id: string; starts_at: string; name: string; title: string | null }

function when(iso: string) {
  const d = new Date(iso)
  const day = isToday(d) ? 'Hoy' : isYesterday(d) ? 'Ayer' : format(d, "EEE d 'de' MMM", { locale: es })
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${format(d, 'HH:mm')}`
}

/**
 * v2 · Agenda: turnos que ya pasaron y siguen como agendados. Un toque para marcar si vino o faltó,
 * así la agenda, el Inicio y el resumen del día quedan al día.
 */
export function UnmarkedAppointmentsV2({
  items,
  onMark,
}: {
  items: UnmarkedAppointment[]
  onMark: (id: string, status: 'completed' | 'no_show') => Promise<void> | void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  if (!items.length) return null

  async function mark(id: string, status: 'completed' | 'no_show') {
    setBusy(id)
    try {
      await onMark(id, status)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-label="Turnos sin marcar" className="rounded-2xl border border-surface-border bg-surface-card px-4 py-3">
      <p className="text-[14px] font-medium text-ink-primary">
        {items.length === 1 ? '1 turno pasado sin marcar' : `${items.length} turnos pasados sin marcar`}
      </p>
      <p className="mt-0.5 text-[12.5px] text-ink-secondary">Marcá si vino o faltó para que la agenda y el resumen del día queden al día.</p>
      <ul className="mt-2 divide-y divide-surface-border">
        <AnimatePresence initial={false}>
          {items.map((a) => (
            <motion.li
              key={a.id}
              layout
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 overflow-hidden py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] text-ink-primary">{a.name}</span>
                <span className="block text-[12px] text-ink-muted">
                  {when(a.starts_at)}
                  {a.title ? ` · ${a.title}` : ''}
                </span>
              </span>
              <span className={cn('flex shrink-0 gap-1.5', busy === a.id && 'pointer-events-none opacity-60')}>
                <PillButtonV2 icon={UserX} onClick={() => void mark(a.id, 'no_show')}>
                  Faltó
                </PillButtonV2>
                <PillButtonV2 icon={Check} primary onClick={() => void mark(a.id, 'completed')}>
                  Vino
                </PillButtonV2>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  )
}
