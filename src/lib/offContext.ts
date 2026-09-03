const STORAGE_Q = 'hh_off_context_question'
const STORAGE_A = 'hh_off_context_answer'

export function readOffContextDraft(): { question: string; answer: string } {
  try {
    return {
      question: localStorage.getItem(STORAGE_Q) ?? '',
      answer: localStorage.getItem(STORAGE_A) ?? '',
    }
  } catch {
    return { question: '', answer: '' }
  }
}

export function saveOffContextDraft(question: string, answer: string): void {
  try {
    localStorage.setItem(STORAGE_Q, question)
    localStorage.setItem(STORAGE_A, answer)
  } catch {
    /* ignore quota / private mode */
  }
}

export function offContextWhatsAppMessage(question: string, answer: string): string {
  const q = question.trim() || '…'
  const a = answer.trim() || '…'
  return [
    '☀️ BUENOS DÍAS PARA TODOS',
    '',
    'Hoy en *SALIENDO DE CONTEXTO* 💬✨ tenemos el siguiente cuestionamiento:',
    '',
    `👉 ${q}`,
    '',
    '🧵 ABRO HILO:',
    a,
    '',
    'Los leo 👀🔥',
  ].join('\n')
}

export function isWednesday(now = new Date()): boolean {
  return now.getDay() === 3
}
