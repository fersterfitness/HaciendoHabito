import toast from 'react-hot-toast'
import { Undo2 } from 'lucide-react'

/**
 * v2 · Borrar sin confirmar: el elemento se atenúa al toque y aparece un aviso con «Deshacer».
 * Si no se deshace en `UNDO_MS`, recién ahí se borra de verdad (se llama a `commit`). Se usa desde
 * `ConfirmDialog` para los diálogos de borrado, así sirve para todas las pantallas sin tocarlas.
 */
export const UNDO_MS = 6000

/** Títulos de diálogo que son un borrado («¿Eliminar…?», «¿Borrar…?», «¿Quitar…?»). */
const DELETE_TITLE = /^¿?\s*(eliminar|borrar|quitar)\b\s*(.*?)\??$/i

const PAST: Record<string, [string, string]> = {
  eliminar: ['Se eliminó', 'Se eliminaron'],
  borrar: ['Se borró', 'Se borraron'],
  quitar: ['Se quitó', 'Se quitaron'],
}

export function isDeleteTitle(title: string): boolean {
  return DELETE_TITLE.test(title.trim())
}

/** «¿Eliminar la rutina «X»?» → «Se eliminó la rutina «X»». */
export function undoMessage(title: string): string {
  const m = title.trim().match(DELETE_TITLE)
  if (!m) return 'Listo'
  const [, verb, rest] = m
  const plural = /^\d+\s/.test(rest) && !/^1\s/.test(rest)
  const past = PAST[verb.toLowerCase()][plural ? 1 : 0]
  return rest ? `${past} ${rest}` : past
}

// Safari no enfoca los botones al tocarlos: se recuerda el último elemento tocado.
let lastPointerTarget: Element | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => { lastPointerTarget = e.target as Element | null }, { capture: true, passive: true })
}

/** Fila o tarjeta que contiene el botón que disparó el borrado (para atenuarla mientras tanto). */
function rowOf(el: Element | null): HTMLElement | null {
  return (el?.closest('tr, li, [role="row"], [data-undo-row]') as HTMLElement | null) ?? null
}

export type UndoSession = { settled: boolean; undo: () => void }

export function startUndoableDelete({
  title,
  commit,
  cancel,
}: {
  title: string
  commit: () => void
  cancel: () => void
}): UndoSession {
  const active = document.activeElement
  const row = rowOf(active && active !== document.body ? active : lastPointerTarget)
  row?.classList.add('v2-undo-pending')
  const id = `undo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const session: UndoSession = { settled: false, undo: () => {} }
  const finish = () => {
    session.settled = true
    window.clearTimeout(timer)
    window.removeEventListener('keydown', onKey)
    toast.dismiss(id)
  }
  const undo = () => {
    if (session.settled) return
    finish()
    row?.classList.remove('v2-undo-pending')
    cancel()
  }
  session.undo = undo
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      undo()
    }
  }
  window.addEventListener('keydown', onKey)

  const timer = window.setTimeout(() => {
    if (session.settled) return
    finish()
    commit()
    // Si el borrado falló, la fila sigue: que no quede atenuada para siempre.
    window.setTimeout(() => row?.classList.remove('v2-undo-pending'), 4000)
  }, UNDO_MS)

  toast.custom(
    (t) => (
      <div
        role="status"
        className={`v2-undo-toast pointer-events-auto relative mb-[calc(4.75rem+env(safe-area-inset-bottom))] flex w-[min(92vw,24rem)] items-center gap-3 overflow-hidden rounded-2xl bg-[rgb(23_23_25)] py-2.5 pl-4 pr-2 text-[13px] text-white shadow-[0_12px_32px_-10px_rgb(0_0_0/0.45)] dark:bg-[rgb(240_240_238)] dark:text-[rgb(23_23_25)] lg:mb-0 ${t.visible ? 'v2-undo-in' : 'v2-undo-out'}`}
      >
        <span className="min-w-0 flex-1 truncate">{undoMessage(title)}</span>
        <button
          type="button"
          onClick={undo}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl px-3 font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white dark:text-[rgb(23_23_25)] dark:hover:bg-black/5"
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden />
          Deshacer
        </button>
        <span aria-hidden className="v2-undo-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-current opacity-30" style={{ animationDuration: `${UNDO_MS}ms` }} />
      </div>
    ),
    { id, duration: Infinity, position: 'bottom-center' },
  )

  return session
}
