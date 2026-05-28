import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { LayoutGroup, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IntakeProAvatarFocus } from '@/components/public/intake/IntakeProAvatar'

type Props = {
  src: string
  alt: string
  layoutId: string
  layoutGroupId: string
  focus?: IntakeProAvatarFocus
  onClose: () => void
}

const FOCUS_IMG: Record<IntakeProAvatarFocus, string> = {
  standard: 'object-[center_28%]',
  face: 'object-[center_22%]',
  headshot: 'object-top',
}

/** Tarjeta flotante ampliada (no pantalla completa). */
export function IntakeProPhotoLightbox({
  src,
  alt,
  layoutId,
  layoutGroupId,
  focus = 'face',
  onClose,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <LayoutGroup id={layoutGroupId}>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label={alt}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      >
        <motion.div
          className="absolute inset-0 bg-black/30"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
        <motion.div
          className="relative z-[1] w-[min(76vw,220px)] overflow-hidden rounded-2xl bg-zinc-950 shadow-[0_20px_50px_rgba(0,0,0,0.55)] ring-1 ring-white/20"
          initial={{ scale: 0.92, y: 8 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.94, y: 6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          <motion.img
            layoutId={layoutId}
            src={src}
            alt={alt}
            className={cn('aspect-[4/5] w-full object-cover', FOCUS_IMG[focus])}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white/95 backdrop-blur-sm transition-colors hover:bg-black/70"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      </motion.div>
    </LayoutGroup>,
    document.body,
  )
}
