/** Avisos operativos semanales en Inicio (WhatsApp no permite envío automático al grupo). */
export type TrainerWeeklyReminder = {
  id: string
  title: string
  description: string
  href: string
  /** 0=dom … 5=viernes. null = visible todos los días. */
  highlightOnWeekday: number | null
}

export const TRAINER_WEEKLY_REMINDERS: TrainerWeeklyReminder[] = [
  {
    id: 'checkins-send-friday',
    title: 'ENVIAR CHECK INS TODOS LOS VIERNES',
    description:
      'Abrí Check-ins, generá o copiá los links de los formularios programados y envialos al grupo de WhatsApp con «Grupo WA».',
    href: '/feedback?tab=checkins',
    highlightOnWeekday: 5,
  },
  {
    id: 'checkins-review',
    title: 'CHEQUEAR CHECK INS Y HACER CORRECCIONES',
    description: 'Revisá las respuestas nuevas en Devoluciones y respondé o ajustá rutinas según lo que reporten.',
    href: '/feedback?tab=checkins',
    highlightOnWeekday: null,
  },
  {
    id: 'resources-weekly',
    title: 'ENVIAR MENSAJE DE RECURSOS «AVISO SEMANAL»',
    description: 'Compartí el aviso semanal de recursos o plantillas guardadas con el grupo o alumnos que corresponda.',
    href: '/feedback?tab=recursos',
    highlightOnWeekday: null,
  },
  {
    id: 'routines-review',
    title: 'REVISAR RUTINAS QUE VENCEN ESTA SEMANA',
    description: 'Actualizá o renová planes que están por vencer para que el alumno no quede sin guía.',
    href: '/routines',
    highlightOnWeekday: null,
  },
]

export function isTrainerReminderHighlightedToday(reminder: TrainerWeeklyReminder, now = new Date()): boolean {
  if (reminder.highlightOnWeekday === null) return false
  return now.getDay() === reminder.highlightOnWeekday
}
