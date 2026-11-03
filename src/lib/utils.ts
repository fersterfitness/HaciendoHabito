import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { IS_V2 } from '@/lib/uiVersion'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, fmt = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt, { locale: es })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function daysUntil(date: string | Date): number {
  const d = typeof date === 'string' ? parseISO(date) : date
  return differenceInDays(d, new Date())
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const AVATAR_TONES = [
  'bg-orange-500/[0.12] text-orange-700 dark:text-orange-300',
  'bg-sky-500/[0.12] text-sky-700 dark:text-sky-300',
  'bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300',
  'bg-violet-500/[0.12] text-violet-700 dark:text-violet-300',
  'bg-rose-500/[0.12] text-rose-700 dark:text-rose-300',
  'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  'bg-teal-500/[0.12] text-teal-700 dark:text-teal-300',
  'bg-indigo-500/[0.12] text-indigo-700 dark:text-indigo-300',
] as const

/** v2: los mismos avatares con los colores de la paleta (fondo sólido, texto oscuro en modo oscuro). */
const AVATAR_TONES_V2 = [
  'hh-pastel bg-pastel-rose text-pastel-rose-ink',
  'hh-pastel bg-pastel-lavender text-pastel-lavender-ink',
  'hh-pastel bg-pastel-peach text-pastel-peach-ink',
  'hh-pastel bg-pastel-sky text-pastel-sky-ink',
  'hh-pastel bg-pastel-mint text-pastel-mint-ink',
  'hh-pastel bg-pastel-butter text-pastel-butter-ink',
] as const

/** Color de iniciales por persona: sale del nombre, así cada alumno conserva el suyo. */
export function avatarToneClass(name: string): string {
  let h = 0
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  if (IS_V2) return AVATAR_TONES_V2[h % AVATAR_TONES_V2.length]!
  return AVATAR_TONES[h % AVATAR_TONES.length]
}
