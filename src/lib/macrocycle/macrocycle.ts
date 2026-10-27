/** Calendario anual del macrociclo: grilla de semanas, carriles de barras y movimiento de bloques. */

import { addDays, differenceInCalendarDays, format, getISOWeek, parseISO } from 'date-fns'

export const BLOCK_TYPES = [
  { id: 'adaptacion', label: 'Adaptación', color: '#38bdf8' },
  { id: 'desarrollo', label: 'Desarrollo', color: '#a78bfa' },
  { id: 'intensificacion', label: 'Intensificación', color: '#fb923c' },
  { id: 'realizacion', label: 'Realización', color: '#f43f5e' },
  { id: 'descarga', label: 'Descarga', color: '#34d399' },
  { id: 'transicion', label: 'Transición', color: '#94a3b8' },
] as const

export type BlockTypeId = (typeof BLOCK_TYPES)[number]['id']

export const BLOCK_COLOR_PRESETS = ['#a78bfa', '#c084fc', '#f0abfc', '#fb923c', '#f43f5e', '#34d399', '#38bdf8', '#facc15', '#94a3b8']

const DEFAULT_COLOR = '#a78bfa'

export function blockColor(type: string | null | undefined, custom: string | null | undefined): string {
  if (custom && /^#[0-9a-f]{6}$/i.test(custom)) return custom
  return BLOCK_TYPES.find((t) => t.id === type)?.color ?? DEFAULT_COLOR
}

export function blockTypeLabel(type: string | null | undefined): string | null {
  return BLOCK_TYPES.find((t) => t.id === type)?.label ?? null
}

export const ymd = (d: Date) => format(d, 'yyyy-MM-dd')

export type CalendarWeek = {
  /** Lunes de la semana. */
  start: string
  days: string[]
  isoWeek: number
  /** Mes (0–11) al que pertenece la semana (el del jueves). */
  month: number
  year: number
}

/** Semanas (lunes a domingo) que cubren el año completo. */
export function yearWeeks(year: number): CalendarWeek[] {
  const jan1 = new Date(year, 0, 1)
  const dow = jan1.getDay()
  let cursor = addDays(jan1, dow === 0 ? -6 : 1 - dow)
  const dec31 = new Date(year, 11, 31)
  const out: CalendarWeek[] = []
  while (cursor <= dec31) {
    const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(cursor, i)))
    const thursday = addDays(cursor, 3)
    out.push({ start: days[0]!, days, isoWeek: getISOWeek(cursor), month: thursday.getMonth(), year: thursday.getFullYear() })
    cursor = addDays(cursor, 7)
  }
  return out
}

/** Días entre el inicio de la grilla y una fecha (puede ser negativo). */
export function dayOffset(gridStart: string, date: string): number {
  return differenceInCalendarDays(parseISO(date), parseISO(gridStart))
}

export type MacroBlock = {
  id: string
  name: string
  start: string
  end: string
  type: string | null
  color: string
}

/** Carriles: cada bloque va en el primer carril donde no se pisa con otro. */
export function assignLanes<T extends { id: string; start: string; end: string }>(blocks: T[]): Map<string, number> {
  const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
  const laneEnds: string[] = []
  const out = new Map<string, number>()
  for (const b of sorted) {
    let lane = laneEnds.findIndex((end) => end < b.start)
    if (lane < 0) {
      lane = laneEnds.length
      laneEnds.push(b.end)
    } else {
      laneEnds[lane] = b.end
    }
    out.set(b.id, lane)
  }
  return out
}

/** Bloques que se pisan en fechas con otro (aviso). */
export function overlappingIds<T extends { id: string; start: string; end: string }>(blocks: T[]): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i]!
      const b = blocks[j]!
      if (a.start <= b.end && b.start <= a.end) {
        out.add(a.id)
        out.add(b.id)
      }
    }
  }
  return out
}

export function shiftYmd(date: string | null | undefined, days: number): string | null {
  if (!date) return null
  return ymd(addDays(parseISO(date), days))
}

export type DatePatch = { id: string; start_date: string | null; end_date: string | null }

/** Mover un bloque: corre la rutina y todas sus semanas la misma cantidad de días. */
export function shiftRoutineDates(
  routine: { id: string; start_date: string; end_date: string },
  weeks: { id: string; start_date: string | null; end_date: string | null }[],
  days: number,
): { routine: DatePatch; weeks: DatePatch[] } {
  return {
    routine: { id: routine.id, start_date: shiftYmd(routine.start_date, days), end_date: shiftYmd(routine.end_date, days) },
    weeks: weeks.map((w) => ({ id: w.id, start_date: shiftYmd(w.start_date, days), end_date: shiftYmd(w.end_date, days) })),
  }
}

/** Inicio de cada semana de la rutina: su fecha, o inicio de la rutina + 7 × posición. */
export function weekStartDates(
  routineStart: string,
  weeks: { id: string; sort_order: number; start_date: string | null }[],
): Map<string, string> {
  const sorted = [...weeks].sort((a, b) => a.sort_order - b.sort_order)
  const out = new Map<string, string>()
  sorted.forEach((w, i) => out.set(w.id, w.start_date ?? shiftYmd(routineStart, i * 7)!))
  return out
}

export function durationWeeks(start: string, end: string): number {
  return Math.max(1, Math.round((dayOffset(start, end) + 1) / 7))
}

export function fmtShort(date: string): string {
  const [, m, d] = date.split('-')
  return `${d}/${m}`
}
