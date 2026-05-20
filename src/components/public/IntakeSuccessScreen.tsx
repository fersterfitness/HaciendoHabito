import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  planName?: string | null
  className?: string
}

function playSuccessHaptic() {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  navigator.vibrate([45, 35, 45])
}

export function IntakeSuccessScreen({ planName, className }: Props) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion) return
    playSuccessHaptic()
  }, [reduceMotion])

  const spring = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 22 }

  const fadeUpDelay = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const, delay },
        }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center p-8 sm:p-14 text-center', className)}
    >
      <motion.div
        className="relative mb-6 flex h-[4.5rem] w-[4.5rem] items-center justify-center"
        initial={reduceMotion ? false : { scale: 0.55, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring}
      >
        {!reduceMotion ? (
          <motion.span
            className="absolute inset-0 rounded-full bg-emerald-500/20"
            initial={{ scale: 0.8, opacity: 0.6 }}
            animate={{ scale: 1.35, opacity: 0 }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
            aria-hidden
          />
        ) : null}
        <div
          className={cn(
            'relative flex h-full w-full items-center justify-center rounded-full',
            'bg-emerald-500/15 ring-4 ring-emerald-500/20',
            'dark:bg-emerald-500/12 dark:ring-emerald-400/15',
          )}
        >
          <motion.div
            initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduceMotion ? { duration: 0 } : { ...spring, delay: 0.08 }}
          >
            <CheckCircle2
              className="h-10 w-10 text-emerald-600 dark:text-emerald-400"
              strokeWidth={2.25}
              aria-hidden
            />
          </motion.div>
        </div>
      </motion.div>

      <motion.h1
        className="text-2xl font-bold text-ink-primary tracking-tight mb-2"
        {...fadeUpDelay(0.12)}
      >
        ¡Listo, ya estás inscripto!
      </motion.h1>

      <motion.p
        className="text-ink-secondary text-sm max-w-sm leading-relaxed"
        {...fadeUpDelay(0.2)}
      >
        {planName ? (
          <>
            Registramos tu interés en <span className="font-medium text-ink-primary">{planName}</span>.
            {' '}El equipo de Haciéndolo hábito te va a contactar por mail o WhatsApp en las próximas horas.
          </>
        ) : (
          <>
            Recibimos tus datos correctamente. El equipo de Haciéndolo hábito se va a comunicar con vos a la brevedad.
          </>
        )}
      </motion.p>

      <motion.p
        className="text-ink-muted text-xs mt-6 max-w-xs leading-relaxed"
        {...fadeUpDelay(0.28)}
      >
        Podés cerrar esta pestaña. Si no recibís noticias en 48 h, revisá la carpeta de spam.
      </motion.p>
    </div>
  )
}
