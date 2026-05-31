/** Notas generales del plan: texto libre + sección «Aclaraciones» como lista. */

export interface ParsedPlanGeneralNotes {
  preamble: string
  aclaraciones: string[]
}

const ACLARACIONES_HEADER = /^\s*(?:\*\*)?\s*aclaraciones\s*:?\s*(?:\*\*)?\s*$/i

const BULLET_PREFIX = /^\s*(?:\[\s*[xX]?\s*\]|\[\]|[-–—•*]|\d+[.)])\s+/

function stripBullet(line: string): string {
  return line.replace(BULLET_PREFIX, '').trim()
}

function lineLooksLikeBullet(line: string): boolean {
  return BULLET_PREFIX.test(line)
}

/** Convierte el texto guardado en preámbulo + ítems de aclaraciones. */
export function parsePlanGeneralNotes(raw: string | null | undefined): ParsedPlanGeneralNotes {
  const text = (raw ?? '').trim()
  if (!text) return { preamble: '', aclaraciones: [] }

  const lines = text.split(/\r?\n/)
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (ACLARACIONES_HEADER.test(lines[i].trim())) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    const bulletish = lines.some((l) => lineLooksLikeBullet(l))
    const items = lines.map(stripBullet).filter(Boolean)
    if (bulletish && items.length > 0) {
      return { preamble: '', aclaraciones: items }
    }
    return { preamble: text, aclaraciones: [] }
  }

  const preamble = lines.slice(0, headerIdx).join('\n').trim()
  const bodyLines = lines.slice(headerIdx + 1)

  const items: string[] = []
  let current = ''
  for (const line of bodyLines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (current) {
        items.push(stripBullet(current))
        current = ''
      }
      continue
    }
    if (lineLooksLikeBullet(trimmed)) {
      if (current) items.push(stripBullet(current))
      current = trimmed
    } else if (current) {
      current += ` ${trimmed}`
    } else {
      current = trimmed
    }
  }
  if (current) items.push(stripBullet(current))

  if (items.length === 0) {
    const body = bodyLines.join('\n').trim()
    if (!body) return { preamble, aclaraciones: [] }
    if (body.includes('\n\n')) {
      return {
        preamble,
        aclaraciones: body
          .split(/\n\s*\n/)
          .map((p) => stripBullet(p.replace(/\n/g, ' ').trim()))
          .filter(Boolean),
      }
    }
    return { preamble, aclaraciones: [stripBullet(body)] }
  }

  return { preamble, aclaraciones: items }
}

/** Serializa para `nutrition_plan_library.notes` (compatible con texto plano / PDF). */
export function serializePlanGeneralNotes(parsed: ParsedPlanGeneralNotes): string {
  const preamble = parsed.preamble.trim()
  const items = parsed.aclaraciones.map((s) => s.trim()).filter(Boolean)
  const parts: string[] = []
  if (preamble) parts.push(preamble)
  if (items.length > 0) {
    parts.push('Aclaraciones:', ...items.map((i) => `- ${i}`))
  }
  return parts.join('\n\n').trim()
}
