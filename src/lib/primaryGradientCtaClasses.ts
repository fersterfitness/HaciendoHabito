import { cn } from '@/lib/utils'

/** Estilo compartido del CTA naranja (degradé horizontal): Nuevo alumno, Nueva rutina, Nuevo plan, etc. */
export const primaryGradientCtaClassName = cn(
  'inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold text-white',
  'bg-gradient-to-r from-[#ff8f5c] from-0% via-[#ff5508] via-50% to-[#b32700] to-100%',
  'shadow-sm shadow-black/10 outline-none transition-[filter,box-shadow] duration-200',
  'hover:from-[#ffa06e] hover:via-[#ff6014] hover:to-[#c03100]',
  'hover:shadow-md hover:shadow-black/15',
  'active:brightness-[0.97]',
  'dark:from-[#ff9050] dark:via-[#f04a00] dark:to-[#9c2200] dark:shadow-black/50',
  'dark:hover:from-[#ffa065] dark:hover:via-[#ff5c14] dark:hover:to-[#af2800]',
  'focus-visible:ring-2 focus-visible:ring-[#ff4800]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface-base))]',
  'dark:focus-visible:ring-offset-zinc-900',
)
