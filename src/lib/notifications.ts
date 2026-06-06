import { PAYMENT_METHODS } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import type { Notification, NotificationType } from '@/types/database'

function paymentMethodLabel(method?: string | null): string | undefined {
  if (!method?.trim()) return undefined
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method
}

export type NotifyUserParams = {
  userId: string
  type: NotificationType
  title: string
  body: string
  linkedTable?: string | null
  linkedId?: string | null
}

/** Crea una notificación in-app (RPC notify_user). */
export async function notifyUser(params: NotifyUserParams): Promise<void> {
  const { error } = await supabase.rpc('notify_user', {
    p_user_id: params.userId,
    p_type: params.type,
    p_title: params.title,
    p_body: params.body,
    p_linked_table: params.linkedTable ?? null,
    p_linked_id: params.linkedId ?? null,
  })
  if (error) {
    console.error('[notifyUser]', error.message)
  }
}

/** Ruta al tocar una notificación en la lista. */
export function notificationHref(n: Pick<Notification, 'type' | 'linked_table' | 'linked_id'>): string | null {
  if (n.linked_table === 'students' && n.linked_id) {
    return `/students/${n.linked_id}`
  }
  if (n.linked_table === 'income' && n.linked_id) {
    return `/finances/income/${n.linked_id}/edit`
  }
  if (n.type === 'pago_registrado' || n.type === 'pago_pendiente') {
    return '/finances?tab=income'
  }
  if (n.type === 'form_recibido') {
    return '/students'
  }
  if (n.type === 'intake_acceso_solicitado' || n.linked_table === 'web_intake_access_requests') {
    return '/settings/web-plans#accesos-inscripcion'
  }
  return null
}

/** Elimina una notificación del historial del usuario actual. */
export async function deleteNotification(id: string): Promise<boolean> {
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) {
    console.error('[deleteNotification]', error.message)
    return false
  }
  return true
}

export async function notifyPaymentRegistered(params: {
  userId: string
  amount: number
  studentName?: string | null
  studentId?: string | null
  incomeId?: string | null
  paymentMethod?: string | null
}): Promise<void> {
  const who = params.studentName?.trim() || 'alumno'
  const amountLabel = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(params.amount)
  const methodLabel = paymentMethodLabel(params.paymentMethod)
  const methodSuffix = methodLabel ? ` · ${methodLabel}` : ''

  await notifyUser({
    userId: params.userId,
    type: 'pago_registrado',
    title: `Pago registrado · ${amountLabel}`,
    body: `Cobro de ${who}${methodSuffix}`,
    linkedTable: params.incomeId ? 'income' : params.studentId ? 'students' : null,
    linkedId: params.incomeId ?? params.studentId ?? null,
  })
}
