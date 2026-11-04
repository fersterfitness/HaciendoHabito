import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/stores/authStore'
import { SHORTCUTS_HELP_EVENT, goKeysFor, isTypingTarget } from '@/lib/shortcutsV2'

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-surface-border bg-surface-elevated px-1.5 font-sans text-[12px] font-medium text-ink-secondary">
      {children}
    </kbd>
  )
}

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <li className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-[13px] text-ink-primary">{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {keys.map((k, i) => (
          <Kbd key={i}>{k}</Kbd>
        ))}
      </span>
    </li>
  )
}

/** Guía de atajos (v2): se abre con «?» o desde el menú de la cuenta. */
export function ShortcutsHelpV2() {
  const [open, setOpen] = useState(false)
  const role = useAuthStore((s) => s.profile?.role)
  const trains = role === 'admin' || role === 'trainer' || !role

  useEffect(() => {
    function onOpen() {
      setOpen(true)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return
      if (document.querySelector('[aria-modal="true"]')) return
      e.preventDefault()
      setOpen(true)
    }
    window.addEventListener(SHORTCUTS_HELP_EVENT, onOpen)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener(SHORTCUTS_HELP_EVENT, onOpen)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  if (role === 'student') return null

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Atajos de teclado" size="md">
      <div className="grid gap-6 sm:grid-cols-2">
        <section>
          <h3 className="mb-1 text-[12px] font-medium text-ink-muted">Ir a</h3>
          <ul className="divide-y divide-surface-border/60">
            {goKeysFor(role).map((g) => (
              <Row key={g.key} keys={['G', g.key.toUpperCase()]} label={g.label} />
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-1 text-[12px] font-medium text-ink-muted">Acciones</h3>
          <ul className="divide-y divide-surface-border/60">
            <Row keys={['/']} label="Buscar" />
            <Row keys={['Ctrl', 'K']} label="Buscar escribiendo" />
            {trains ? <Row keys={['N']} label="Nuevo alumno" /> : null}
            <Row keys={['?']} label="Esta guía" />
            <Row keys={['Esc']} label="Cerrar ventanas y menús" />
          </ul>
          <p className="mt-4 text-[12px] leading-relaxed text-ink-muted">Primero G y después la letra. No funcionan mientras escribís en un campo.</p>
        </section>
      </div>
    </Modal>
  )
}
