import { cn } from '@/lib/utils'

export function incomeStatusPhrase(status: string): string {
  switch (status) {
    case 'cobrado':
      return 'Cobrado'
    case 'pendiente':
      return 'Pendiente'
    case 'cancelado':
      return 'Cancelado'
    default:
      return status
  }
}

export function incomeLedgerStatusClass(status: string): string {
  switch (status) {
    case 'cobrado':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'pendiente':
      return 'text-status-expiring'
    case 'anulado':
      return 'text-zinc-500 line-through dark:text-zinc-500'
    default:
      return 'text-zinc-500'
  }
}
