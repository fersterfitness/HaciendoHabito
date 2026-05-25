import { useEffect, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { StudentFormContent } from '@/components/students/StudentFormContent'
import { cn } from '@/lib/utils'
import { modalPanelMotionVariants } from '@/lib/modalPanelMotion'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  onCreated: (studentId: string) => void
}

const PANEL_EASE = [0.16, 1, 0.3, 1] as const

/**
 * Mismo tono que tarjetas e inputs (`surface-card`), no `surface-panel`:
 * en dark el panel suele ser más claro (52,52,58) y choca con los campos (32,32,37).
 */
const modalPanelBg: CSSProperties = {
  backgroundColor: 'rgb(var(--surface-card) / 1)',
}

/**
 * Hijo `motion` + estilo sólido: la animación solo usa `x` (nunca opacity en el panel).
 * Backdrop y panel son hermanos bajo AnimatePresence para que cierren bien.
 */
export function NewStudentModal({ open, title, onClose, onCreated }: Props) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const overlayDur = reduceMotion ? 0.15 : 1.1
  const slideVariants = modalPanelMotionVariants(reduceMotion)

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="nsm-backdrop"
            className="fixed inset-0 z-[10050] bg-zinc-900/35 backdrop-blur-[2px] dark:bg-zinc-950/55"
            aria-hidden
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: overlayDur,
              ease: PANEL_EASE,
            }}
          />
          <motion.div
            key="nsm-panel"
            role="dialog"
            aria-modal
            aria-labelledby="new-student-modal-title"
            className={cn(
              'fixed z-[10051] flex flex-col overflow-hidden rounded-2xl',
              'border border-zinc-200/90 dark:border-zinc-600/55',
              'shadow-[0_16px_48px_-10px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_52px_-16px_rgba(0,0,0,0.5)]',
              'inset-3 sm:inset-auto',
              'sm:left-auto sm:right-5 sm:top-5 sm:bottom-5 sm:h-[calc(100dvh-2.5rem)] sm:w-full sm:max-w-6xl',
              'lg:right-6 lg:top-6 lg:bottom-6',
              'isolate mix-blend-normal',
            )}
            style={modalPanelBg}
            variants={slideVariants}
            initial="hidden"
            animate="visible"
            exit="leave"
          >
            <div
              className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200/75 dark:border-zinc-600/45 px-6 py-5 sm:px-10 sm:py-6"
              style={modalPanelBg}
            >
              <h2
                id="new-student-modal-title"
                className="pt-0.5 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-7 sm:px-10 sm:py-9"
              style={modalPanelBg}
            >
              <StudentFormContent
                variant="modal"
                onCancel={onClose}
                onSuccess={(id) => {
                  onCreated(id)
                  onClose()
                }}
              />
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
