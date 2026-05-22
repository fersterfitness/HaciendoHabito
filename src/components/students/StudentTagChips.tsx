import { Tag } from 'lucide-react'
import { studentTrainerTags } from '@/lib/students/studentTrainerPrefs'
import { cn } from '@/lib/utils'
import type { Student } from '@/types/database'

export function StudentTagChips({
  student,
  maxVisible = 3,
  onTagClick,
  className,
}: {
  student: Pick<Student, 'trainer_tags'>
  maxVisible?: number
  /** Al hacer clic, filtra el directorio por esa etiqueta (no propaga al row). */
  onTagClick?: (tag: string) => void
  className?: string
}) {
  const tags = studentTrainerTags(student)
  if (tags.length === 0) return null

  const visible = tags.slice(0, maxVisible)
  const extra = tags.length - visible.length

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1', className)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {visible.map((t) => {
        const chip = (
          <span className="truncate">{t}</span>
        )
        const classNames = cn(
          'inline-flex h-5 max-w-[8rem] items-center gap-0.5 rounded-md border px-1.5 text-[10px] font-medium',
          'border-surface-border/70 bg-surface-elevated/50 text-ink-secondary',
          onTagClick &&
            'cursor-pointer transition-colors hover:border-brand-secondary/40 hover:text-brand-secondary',
        )

        if (onTagClick) {
          return (
            <button
              key={t}
              type="button"
              title={`Filtrar por ${t}`}
              onClick={() => onTagClick(t)}
              className={classNames}
            >
              <Tag className="h-2.5 w-2.5 shrink-0 opacity-60" aria-hidden />
              {chip}
            </button>
          )
        }

        return (
          <span key={t} className={classNames}>
            {chip}
          </span>
        )
      })}
      {extra > 0 ? <span className="text-[10px] tabular-nums text-ink-muted">+{extra}</span> : null}
    </div>
  )
}
