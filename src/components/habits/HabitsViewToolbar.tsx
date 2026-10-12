import { Expand } from 'lucide-react'
import { useAppNavigate } from '@/hooks/useAppNavigate'

/** Desde la ficha: abrir el mismo panel en `/habits?student=` con más espacio horizontal. */
export function HabitsViewToolbar({ studentId }: { studentId: string }) {
  const navigate = useAppNavigate()
  const pillClass =
    'inline-flex items-center gap-1.5 rounded-md border border-surface-border/85 bg-white/90 px-2.5 py-1.5 text-2xs font-medium text-ink-primary shadow-sm transition-colors hover:bg-surface-elevated/60 dark:bg-zinc-900/80 '

  return (
    <button
      type="button"
      className={pillClass}
      onClick={() => navigate(`/habits?student=${encodeURIComponent(studentId)}`)}
    >
      <Expand className="h-3.5 w-3.5 shrink-0 text-brand-primary" aria-hidden />
      Vista amplia
    </button>
  )
}
