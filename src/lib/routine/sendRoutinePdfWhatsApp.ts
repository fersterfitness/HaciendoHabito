import { supabase } from '@/lib/supabase'
import {
  buildRoutinePdfShareWaUrl,
  openWhatsAppUrl,
} from '@/lib/whatsapp'
import toast from 'react-hot-toast'

export async function sendRoutinePdfViaWhatsApp(params: {
  studentPhone: string | null | undefined
  studentName: string
  routineName: string
  filePath: string
  extraNote?: string | null
}): Promise<boolean> {
  const { data: signed, error } = await supabase.storage
    .from('routine-pdfs')
    .createSignedUrl(params.filePath, 60 * 60 * 24 * 7)

  if (error || !signed?.signedUrl) {
    toast.error('No se pudo obtener el enlace del PDF')
    return false
  }

  const url = buildRoutinePdfShareWaUrl({
    phoneRaw: params.studentPhone,
    studentName: params.studentName,
    routineName: params.routineName,
    pdfUrl: signed.signedUrl,
    extraNote: params.extraNote,
  })

  if (!url) {
    toast.error('El alumno no tiene un teléfono válido para WhatsApp (+54…)')
    return false
  }

  openWhatsAppUrl(url)
  toast.success('Abriendo WhatsApp para enviar la rutina')
  return true
}
