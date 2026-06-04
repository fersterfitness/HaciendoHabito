/** Contacto Tomás Ferster — inscripción web pública. */
export const TRAINER_CONTACT_WHATSAPP_DIGITS = '5491133305248'

export const TRAINER_CONTACT_WHATSAPP_DISPLAY = '+54 9 11 3330 5248'

export const TRAINER_CONTACT_EMAIL = 'Fersterfitness@gmail.com'

export function buildTrainerContactWhatsAppUrl(message?: string): string {
  const base = `https://wa.me/${TRAINER_CONTACT_WHATSAPP_DIGITS}`
  if (!message?.trim()) return base
  return `${base}?text=${encodeURIComponent(message.trim())}`
}

export function whatsAppInterestMessage(planName: string): string {
  return `Hola Tomi, estoy interesado/a en el plan ${planName.trim()}. Quiero coordinar el pago y el acceso al formulario.`
}
