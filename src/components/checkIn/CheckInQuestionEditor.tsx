import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import {
  CHOICE_COLOR_PRESETS,
  type CheckInOption,
  type CheckInQuestion,
  type CheckInQuestionType,
} from '@/lib/checkIn/questions'

const rowClass =
  'flex flex-col gap-2.5 rounded-2xl border border-surface-border/70 bg-surface-card/70 p-3 shadow-sm transition-colors hover:border-brand-secondary/30'

const selectClass =
  'text-xs rounded-xl border border-surface-border/80 bg-surface-input px-2.5 py-2 outline-none transition-colors focus:border-brand-secondary/50 focus:ring-2 focus:ring-brand-secondary/20'

export function CheckInQuestionEditor({
  question,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  question: CheckInQuestion
  index: number
  total: number
  onChange: (patch: Partial<CheckInQuestion>) => void
  onRemove: () => void
  onMove: (dir: 'up' | 'down') => void
}) {
  function setType(type: CheckInQuestionType) {
    if (type === 'choice') {
      const options =
        question.options?.length
          ? question.options
          : [
              { id: 'a', label: 'Opción A', color: '#22c55e' },
              { id: 'b', label: 'Opción B', color: '#f59e0b' },
              { id: 'c', label: 'Opción C', color: '#f43f5e' },
            ]
      onChange({ type, options, allowNote: true })
      return
    }
    onChange({ type, options: undefined })
  }

  function updateOption(id: string, patch: Partial<CheckInOption>) {
    onChange({
      options: (question.options ?? []).map((o) => (o.id === id ? { ...o, ...patch } : o)),
    })
  }

  function addOption() {
    const n = (question.options?.length ?? 0) + 1
    const color = CHOICE_COLOR_PRESETS[(n - 1) % CHOICE_COLOR_PRESETS.length]?.hex ?? '#f59e0b'
    onChange({
      options: [...(question.options ?? []), { id: crypto.randomUUID(), label: `Opción ${n}`, color }],
    })
  }

  return (
    <div className={rowClass}>
      <div className="flex flex-col sm:flex-row gap-2 items-start">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-secondary/12 text-[10px] font-semibold text-brand-secondary tabular-nums">
          {index + 1}
        </span>
        <Input
          className="flex-1 text-sm"
          value={question.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Texto de la pregunta"
        />
        <select
          className={selectClass}
          value={question.type}
          onChange={(e) => setType(e.target.value as CheckInQuestionType)}
        >
          <option value="text">Texto libre</option>
          <option value="scale">Escala 1–5</option>
          <option value="choice">Opciones (una sola)</option>
        </select>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="rounded-lg p-1.5 text-ink-muted hover:text-ink-primary disabled:opacity-30"
            disabled={index === 0}
            onClick={() => onMove('up')}
            title="Subir pregunta"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-ink-muted hover:text-ink-primary disabled:opacity-30"
            disabled={index === total - 1}
            onClick={() => onMove('down')}
            title="Bajar pregunta"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-status-expired/10 hover:text-status-expired"
            onClick={onRemove}
            title="Quitar pregunta"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {question.type === 'choice' ? (
        <div className="ml-0 sm:ml-8 space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-secondary">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={question.allowNote !== false}
                onChange={(e) => onChange({ allowNote: e.target.checked })}
                className="rounded border-surface-border accent-brand-secondary"
              />
              Permitir aclaración
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={question.visibleIfGender === 'F'}
                onChange={(e) => onChange({ visibleIfGender: e.target.checked ? 'F' : undefined })}
                className="rounded border-surface-border accent-brand-secondary"
              />
              Solo sexo femenino
            </label>
          </div>
          {(question.options ?? []).map((opt, oi) => (
            <div key={opt.id} className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-ink-muted w-4">{oi + 1}</span>
              <input
                className="flex-1 min-w-[10rem] rounded-lg border border-surface-border bg-surface-input px-2 py-1.5 text-xs"
                value={opt.label}
                onChange={(e) => updateOption(opt.id, { label: e.target.value })}
                placeholder="Texto de la opción"
              />
              <div className="flex items-center gap-1">
                {CHOICE_COLOR_PRESETS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => updateOption(opt.id, { color: c.hex })}
                    className={cn(
                      'h-5 w-5 rounded-full border border-black/10 transition-transform',
                      opt.color === c.hex && 'ring-2 ring-ink-primary/40 ring-offset-1 ring-offset-surface-card scale-110',
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
              <select
                className={selectClass}
                value={opt.extra ?? 'none'}
                onChange={(e) =>
                  updateOption(opt.id, { extra: e.target.value === 'number' || e.target.value === 'date' ? e.target.value : 'none' })
                }
              >
                <option value="none">Sin extra</option>
                <option value="number">Pide número</option>
                <option value="date">Pide fecha</option>
              </select>
              <button
                type="button"
                className="text-[10px] text-ink-muted hover:text-status-expired"
                onClick={() =>
                  onChange({ options: (question.options ?? []).filter((o) => o.id !== opt.id) })
                }
              >
                Quitar
              </button>
            </div>
          ))}
          <button type="button" className="text-[11px] font-medium text-brand-secondary hover:underline" onClick={addOption}>
            + Opción
          </button>
        </div>
      ) : null}
    </div>
  )
}
