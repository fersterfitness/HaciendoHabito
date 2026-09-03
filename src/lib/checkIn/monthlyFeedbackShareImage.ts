import { BRAND_LOGO_PATH } from '@/lib/brandLogo'
import { BRAND_COLORS } from '@/theme/brandColors'

const W = 1080
const H = 1350

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full.trim()
}

export function monthlyFeedbackShareFilename(studentName: string): string {
  const slug = firstName(studentName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'alumno'
  return `feedback-${slug}.png`
}

export async function renderMonthlyFeedbackSharePng(params: {
  studentName: string
  quote: string
}): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear el canvas')

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#1a0b06')
  bg.addColorStop(0.45, '#2a1208')
  bg.addColorStop(1, BRAND_COLORS.primary)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.beginPath()
  ctx.arc(W * 0.85, H * 0.12, 280, 0, Math.PI * 2)
  ctx.fill()

  const logo = await loadImage(BRAND_LOGO_PATH)
  if (logo) {
    const lw = 160
    const lh = (logo.height / logo.width) * lw
    ctx.drawImage(logo, (W - lw) / 2, 72, lw, lh)
  }

  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '600 28px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('HACIÉNDOLO HÁBITO', W / 2, 280)

  const quote = params.quote.trim()
  const maxWidth = W - 160
  const quoteTop = 360
  const quoteMaxH = 620
  let fontSize = 54
  let lines: string[] = []
  for (; fontSize >= 28; fontSize -= 2) {
    ctx.font = `italic ${fontSize}px Georgia, "Times New Roman", serif`
    lines = wrapLines(ctx, `“${quote}”`, maxWidth)
    if (lines.length * fontSize * 1.28 <= quoteMaxH) break
  }
  ctx.fillStyle = '#fff7f2'
  ctx.textAlign = 'center'
  ctx.font = `italic ${fontSize}px Georgia, "Times New Roman", serif`
  const lineH = fontSize * 1.28
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, quoteTop + i * lineH)
  })

  const nameY = Math.min(quoteTop + lines.length * lineH + 64, H - 220)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 36px Inter, system-ui, sans-serif'
  ctx.fillText(params.studentName.trim(), W / 2, nameY)

  const ctaY = H - 120
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 34px Inter, system-ui, sans-serif'
  const first = firstName(params.studentName).toUpperCase()
  ctx.fillText(`YA ${first} ESTÁ HACIÉNDOLO HÁBITO`, W / 2, ctaY)
  ctx.font = '600 26px Inter, system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.fillText('¿Qué esperás para generar los tuyos?', W / 2, ctaY + 44)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('No se pudo generar la imagen')
  return blob
}

export async function downloadMonthlyFeedbackShareImage(params: {
  studentName: string
  quote: string
}): Promise<void> {
  const blob = await renderMonthlyFeedbackSharePng(params)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = monthlyFeedbackShareFilename(params.studentName)
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
