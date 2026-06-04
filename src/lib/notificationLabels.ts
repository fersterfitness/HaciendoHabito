import type { NotificationType } from '@/types/database'

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  rutina_por_vencer: 'Rutina por vencer',
  form_recibido: 'Formulario recibido',
  pdf_generado: 'PDF generado',
  consulta_recibida: 'Consulta recibida',
  feedback_enviado: 'Feedback enviado',
  pago_pendiente: 'Pago pendiente',
  pago_registrado: 'Pago registrado',
  intake_acceso_solicitado: 'Acceso inscripción web',
  sistema: 'Sistema',
}
