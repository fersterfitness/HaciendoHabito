import { useEffect, useRef, useState } from 'react'
import { Button } from './Button'
import { ConfirmDialog } from './ConfirmDialog'
import { Modal } from './Modal'
import { cn } from '@/lib/utils'

/**
 * Reemplazo de window.confirm / window.prompt con diálogos de la app.
 * Uso: `if (!(await confirmDialog({ title: '¿Eliminar?' }))) return`
 *      `const name = await promptDialog({ title: 'Nombre' })` → string | null
 * Requiere <DialogHost /> montado una vez (App).
 */

type ConfirmRequest = {
  kind: 'confirm'
  title: string
  description?: string
  confirmLabel?: string
  variant?: 'danger' | 'warning'
  resolve: (ok: boolean) => void
}

type PromptRequest = {
  kind: 'prompt'
  title: string
  description?: string
  label?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  resolve: (value: string | null) => void
}

type DialogRequest = ConfirmRequest | PromptRequest

let push: ((r: DialogRequest) => void) | null = null

export function confirmDialog(opts: Omit<ConfirmRequest, 'kind' | 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) {
      resolve(window.confirm(opts.title))
      return
    }
    push({ kind: 'confirm', ...opts, resolve })
  })
}

export function promptDialog(opts: Omit<PromptRequest, 'kind' | 'resolve'>): Promise<string | null> {
  return new Promise((resolve) => {
    if (!push) {
      resolve(window.prompt(opts.title, opts.defaultValue ?? ''))
      return
    }
    push({ kind: 'prompt', ...opts, resolve })
  })
}

export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([])
  const current = queue[0] ?? null

  useEffect(() => {
    push = (r) => setQueue((q) => [...q, r])
    return () => {
      push = null
    }
  }, [])

  function done() {
    setQueue((q) => q.slice(1))
  }

  if (!current) return null

  if (current.kind === 'confirm') {
    return (
      <ConfirmDialog
        open
        title={current.title}
        description={current.description}
        confirmLabel={current.confirmLabel ?? 'Confirmar'}
        variant={current.variant ?? 'danger'}
        onClose={() => {
          current.resolve(false)
          done()
        }}
        onConfirm={() => {
          current.resolve(true)
          done()
        }}
      />
    )
  }

  return (
    <PromptModal
      key={queue.length}
      request={current}
      onDone={(value) => {
        current.resolve(value)
        done()
      }}
    />
  )
}

function PromptModal({ request, onDone }: { request: PromptRequest; onDone: (value: string | null) => void }) {
  const [value, setValue] = useState(request.defaultValue ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.select(), 30)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <Modal
      open
      onClose={() => onDone(null)}
      size="sm"
      title={request.title}
      description={request.description}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={() => onDone(null)}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={!value.trim()} onClick={() => onDone(value)}>
            {request.confirmLabel ?? 'Guardar'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim()) onDone(value)
        }}
      >
        {request.label ? (
          <label className="mb-1.5 block text-xs font-medium text-ink-secondary">{request.label}</label>
        ) : null}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={request.placeholder}
          className={cn(
            'h-10 w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 text-sm text-ink-primary shadow-xs',
            'placeholder:text-ink-muted transition-[border-color,box-shadow] duration-200',
            'focus:outline-none focus-visible:border-brand-primary/70 focus-visible:ring-4 focus-visible:ring-brand-primary/15',
          )}
        />
      </form>
    </Modal>
  )
}
