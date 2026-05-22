import { Outlet, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'

/**
 * Entrada suave del contenido al navegar (solo pathname; no reacciona a ?query).
 * Respeta prefers-reduced-motion.
 */
export function AnimatedOutlet() {
  const { pathname } = useLocation()
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      key={pathname}
      className="flex min-h-0 min-w-0 flex-1 flex-col pt-1 sm:pt-2"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.28,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <Outlet />
    </motion.div>
  )
}
