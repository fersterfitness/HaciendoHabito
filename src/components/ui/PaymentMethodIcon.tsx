/**
 * Íconos visuales para cada método de pago.
 * - Marcas argentinas (Cuenta DNI, MercadoPago): SVG inline simplificado
 * - Métodos genéricos: íconos Lucide
 */
import { Banknote, CreditCard, ArrowRightLeft, Wallet, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── SVGs de marca ───────────────────────────────────────────── */

function IconMercadoPago({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('shrink-0', className)} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#009EE3" />
      <path
        d="M5.5 12.5c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="15" r="2" fill="white" />
    </svg>
  )
}

function IconCuentaDNI({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 18" fill="none" className={cn('shrink-0', className)} aria-hidden>
      <rect width="28" height="18" rx="3" fill="#003087" />
      <rect x="2" y="2" width="6" height="5" rx="1" fill="#7CB9E8" opacity="0.7" />
      <rect x="10" y="3" width="9" height="1.5" rx="0.75" fill="white" opacity="0.6" />
      <rect x="10" y="6" width="6" height="1.5" rx="0.75" fill="white" opacity="0.4" />
      <rect x="2" y="10" width="24" height="1" rx="0.5" fill="white" opacity="0.2" />
      <text x="14" y="16.5" fill="white" fontSize="5" textAnchor="middle" fontWeight="bold" fontFamily="system-ui,sans-serif" letterSpacing="1">
        DNI
      </text>
    </svg>
  )
}

function IconEfectivoARS({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('shrink-0', className)} aria-hidden>
      <rect x="1" y="5" width="22" height="14" rx="2.5" fill="#16a34a" fillOpacity="0.12" stroke="#16a34a" strokeOpacity="0.4" strokeWidth="1.2" />
      <text x="12" y="16" fill="#16a34a" fontSize="11" textAnchor="middle" fontWeight="700" fontFamily="system-ui,sans-serif">
        $
      </text>
      <circle cx="3.5" cy="7.5" r="1" fill="#16a34a" fillOpacity="0.4" />
      <circle cx="20.5" cy="16.5" r="1" fill="#16a34a" fillOpacity="0.4" />
    </svg>
  )
}

/* ── Mapa método → ícono + color ─────────────────────────────── */

type Method = string

interface MethodMeta {
  icon: React.ReactNode
  color: string   // Tailwind text color para el label
  bg: string      // Tailwind bg para el chip
}

function getMeta(method: Method): MethodMeta {
  switch (method) {
    case 'efectivo_ars':
      return {
        icon: <IconEfectivoARS className="h-5 w-7" />,
        color: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/25',
      }
    case 'efectivo_debito':
      return {
        icon: <Wallet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />,
        color: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/25',
      }
    case 'cuenta_dni':
      return {
        icon: <IconCuentaDNI className="h-4 w-[22px]" />,
        color: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-500/10 border-blue-500/25',
      }
    case 'mercadopago':
      return {
        icon: <IconMercadoPago className="h-4 w-4" />,
        color: 'text-sky-700 dark:text-sky-400',
        bg: 'bg-sky-500/10 border-sky-500/25',
      }
    case 'tarjeta_credito':
      return {
        icon: <CreditCard className="h-3.5 w-3.5 text-violet-500" />,
        color: 'text-violet-700 dark:text-violet-400',
        bg: 'bg-violet-500/10 border-violet-500/25',
      }
    case 'transferencia':
      return {
        icon: <ArrowRightLeft className="h-3.5 w-3.5 text-amber-500" />,
        color: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/25',
      }
    case 'debito':
      return {
        icon: <Banknote className="h-3.5 w-3.5 text-teal-500" />,
        color: 'text-teal-700 dark:text-teal-400',
        bg: 'bg-teal-500/10 border-teal-500/25',
      }
    default:
      return {
        icon: <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />,
        color: 'text-zinc-600 dark:text-zinc-400',
        bg: 'bg-zinc-100 border-zinc-200 dark:bg-zinc-800/60 dark:border-zinc-700',
      }
  }
}

const METHOD_LABEL: Record<string, string> = {
  efectivo_debito: 'Efectivo / Débito',
  efectivo_ars: 'Efectivo',
  cuenta_dni: 'Cuenta DNI',
  mercadopago: 'MercadoPago',
  tarjeta_credito: 'Crédito',
  transferencia: 'Transferencia',
  debito: 'Débito',
  otro: 'Otro',
}

/**
 * Chip compacto: ícono + label para tablas y listas.
 */
export function PaymentMethodBadge({
  method,
  className,
}: {
  method: string
  className?: string
}) {
  const { icon, color, bg } = getMeta(method)
  const label = METHOD_LABEL[method] ?? method.replace(/_/g, ' ')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5',
        bg,
        className,
      )}
      title={label}
    >
      {icon}
      <span className={cn('text-[11px] font-medium leading-none', color)}>{label}</span>
    </span>
  )
}

/**
 * Solo el ícono (sin label), útil en espacios reducidos.
 */
export function PaymentMethodIcon({
  method,
  className,
}: {
  method: string
  className?: string
}) {
  const { icon } = getMeta(method)
  return (
    <span className={cn('inline-flex items-center justify-center', className)} title={METHOD_LABEL[method] ?? method}>
      {icon}
    </span>
  )
}
