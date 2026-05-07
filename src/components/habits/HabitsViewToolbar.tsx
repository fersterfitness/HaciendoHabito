import { Expand } from 'lucide-react'
import { useAppNavigate } from '@/hooks/useAppNavigate'

/** Desde la ficha: abrir el mismo panel en `/habits?student=` con más espacio horizontal. */
export function HabitsViewToolbar({ studentId }: { studentId: string }) {
  const navigate = useAppNavigate()
  const pillClass =
    'inline-flex items-center gap-1.5 rounded-md border border-zinc-200/85 bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:bg-zinc-800'

  return (
    <button
      type="button"
      className={pillClass}
      onClick={() => navigate(`/habits?student=${encodeURIComponent(studentId)}`)}
    >
      <Expand className="h-3.5 w-3.5 shrink-0 text-[#ff4800]" aria-hidden />
      Vista amplia
    </button>
  )
}
