import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Copy, History, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { confirmDialog } from '@/components/ui/dialogs'
import { useActiveStudents } from '@/data/finance'
import {
  applyPriceIncrease,
  previewPriceIncrease,
  PRICE_INCREASE_SQL_HINT,
  savePriceIncreaseSettings,
  usePriceIncreaseLog,
  usePriceIncreaseSettings,
  useWebPlanPrices,
} from '@/data/priceIncrease'
import {
  firstOfNextMonth,
  longDayMonth,
  NOTICE_DAYS_BEFORE,
  priceIncreaseNoticeMessage,
  priceIncreaseStage,
  type PriceIncreaseSettings,
} from '@/lib/finance/priceIncrease'
import { controlMdClassName } from '@/lib/formControlClasses'
import { cn, formatCurrency } from '@/lib/utils'

const fmtDate = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`

/**
 * Finanzas: aumento periódico (ej. 3% cada 3 meses) de las cuotas de los alumnos y de los precios
 * de la web. 15 días antes sale el aviso para copiar al grupo; en la fecha, se aplica con un botón.
 */
export function PriceIncreasePanel() {
  const settingsQuery = usePriceIncreaseSettings()
  const studentsQuery = useActiveStudents()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<PriceIncreaseSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState(false)
  const webPlansQuery = useWebPlanPrices(open)
  const logQuery = usePriceIncreaseLog(open)

  // Desde el aviso de Inicio (/finances#aumentos): abrir y llevar hasta acá.
  const hasDraft = draft != null
  useEffect(() => {
    if (!hasDraft || window.location.hash !== '#aumentos') return
    setOpen(true)
    window.setTimeout(() => document.getElementById('aumentos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }, [hasDraft])

  useEffect(() => {
    if (settingsQuery.data && !draft) {
      const s = settingsQuery.data.settings
      setDraft({ ...s, next_date: s.next_date ?? firstOfNextMonth(new Date()) })
    }
  }, [settingsQuery.data, draft])

  const saved = settingsQuery.data?.settings
  const ready = settingsQuery.data?.ready ?? true
  const stage = priceIncreaseStage(saved?.next_date ?? null, new Date())
  const changes = useMemo(
    () => (draft ? previewPriceIncrease(draft, studentsQuery.data ?? [], webPlansQuery.data ?? []) : []),
    [draft, studentsQuery.data, webPlansQuery.data],
  )

  if (!draft) return null

  const set = (patch: Partial<PriceIncreaseSettings>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const activePlans = (webPlansQuery.data ?? []).filter((p) => p.is_active)
  const planChecked = (slug: string) => !draft.web_plan_slugs || draft.web_plan_slugs.includes(slug)

  async function save() {
    if (!draft) return
    if (!(draft.percent > 0 && draft.percent <= 100)) {
      toast.error('El porcentaje tiene que estar entre 0,1 y 100')
      return
    }
    setSaving(true)
    const err = await savePriceIncreaseSettings(draft)
    setSaving(false)
    if (err) toast.error(err)
    else toast.success('Aumento programado')
  }

  async function copyNotice() {
    if (!draft?.next_date) return
    try {
      await navigator.clipboard.writeText(priceIncreaseNoticeMessage(draft.next_date))
      toast.success('Mensaje copiado: pegalo en el grupo')
      if (saved?.next_date === draft.next_date) await savePriceIncreaseSettings({ ...saved, notice_copied_for: draft.next_date })
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  async function apply() {
    if (!draft) return
    if (!changes.length) {
      toast.error('No hay cuotas ni precios para aumentar')
      return
    }
    const ok = await confirmDialog({
      title: `¿Aplicar el aumento del ${String(draft.percent).replace('.', ',')}%?`,
      description: `Se actualizan ${changes.length} precio${changes.length === 1 ? '' : 's'} (cuotas y web). Queda en el historial y el próximo aumento se programa ${draft.every_months} mes${draft.every_months === 1 ? '' : 'es'} después.`,
      confirmLabel: 'Aplicar aumento',
    })
    if (!ok) return
    setApplying(true)
    const err = await applyPriceIncrease(draft, changes)
    setApplying(false)
    if (err) toast.error(err)
    else toast.success('Aumento aplicado')
    setDraft(null)
  }

  return (
    <section id="aumentos" className="overflow-hidden rounded-2xl border border-surface-border/90 bg-surface-card shadow-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <span className="rounded-lg bg-brand-primary/10 p-2 text-brand-primary" aria-hidden>
          <TrendingUp className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink-primary">Aumentos programados</span>
          <span className="block text-2xs text-ink-muted">
            {saved && settingsQuery.data?.saved && saved.next_date
              ? `${String(saved.percent).replace('.', ',')}% cada ${saved.every_months} meses · próximo: ${fmtDate(saved.next_date)}`
              : 'Subí cuotas y precios de la web un % cada tantos meses, con aviso al grupo 15 días antes.'}
          </span>
        </span>
        {stage.stage === 'due' ? (
          <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-3xs font-semibold text-rose-700 dark:text-rose-300">Toca aplicar</span>
        ) : stage.stage === 'notice' ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-3xs font-semibold text-amber-700 dark:text-amber-300">Avisar al grupo</span>
        ) : null}
        <ChevronDown className={cn('h-4 w-4 text-ink-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-surface-border/70 p-4">
          {!ready ? <p className="hh-alert hh-alert-warning rounded-xl px-3 py-2 text-xs text-ink-secondary">{PRICE_INCREASE_SQL_HINT}</p> : null}

          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-ink-secondary">
              Aumento (%)
              <input
                type="number"
                min={0.1}
                max={100}
                step={0.5}
                value={draft.percent}
                onChange={(e) => set({ percent: Number(e.target.value) })}
                className={cn(controlMdClassName, 'mt-1 w-full tabular-nums')}
              />
            </label>
            <label className="text-xs font-medium text-ink-secondary">
              Cada (meses)
              <input
                type="number"
                min={1}
                max={24}
                value={draft.every_months}
                onChange={(e) => set({ every_months: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                className={cn(controlMdClassName, 'mt-1 w-full tabular-nums')}
              />
            </label>
            <label className="text-xs font-medium text-ink-secondary">
              Próximo aumento
              <input
                type="date"
                value={draft.next_date ?? ''}
                onChange={(e) => set({ next_date: e.target.value || null })}
                className={cn(controlMdClassName, 'mt-1 w-full')}
              />
            </label>
            <label className="text-xs font-medium text-ink-secondary">
              Redondear a
              <select value={draft.round_to} onChange={(e) => set({ round_to: Number(e.target.value) })} className={cn(controlMdClassName, 'mt-1 w-full')}>
                {[1, 10, 100, 500, 1000].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'Sin redondeo' : `$${n.toLocaleString('es-AR')}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-ink-secondary">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={draft.apply_students} onChange={(e) => set({ apply_students: e.target.checked })} className="h-4 w-4 accent-brand-primary" />
              Cuota mensual de los alumnos
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={draft.apply_web_plans} onChange={(e) => set({ apply_web_plans: e.target.checked })} className="h-4 w-4 accent-brand-primary" />
              Precios de la web (planes)
            </label>
          </div>

          {draft.apply_web_plans && activePlans.length ? (
            <div className="flex flex-wrap gap-1.5">
              {activePlans.map((p) => (
                <label
                  key={p.slug}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-2xs',
                    planChecked(p.slug) ? 'border-brand-primary/40 bg-brand-primary/5 text-ink-primary' : 'border-surface-border text-ink-muted',
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-brand-primary"
                    checked={planChecked(p.slug)}
                    onChange={(e) => {
                      const all = activePlans.map((x) => x.slug)
                      const current = draft.web_plan_slugs ?? all
                      const next = e.target.checked ? [...new Set([...current, p.slug])] : current.filter((s) => s !== p.slug)
                      set({ web_plan_slugs: next.length === all.length ? null : next })
                    }}
                  />
                  {p.title} · {p.price_label}
                </label>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={saving} onClick={() => void save()}>
              Guardar programación
            </Button>
          </div>

          {draft.next_date ? (
            <div className="space-y-2 rounded-xl border border-surface-border/80 bg-surface-elevated/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-ink-primary">
                  Aviso para el grupo · {NOTICE_DAYS_BEFORE} días antes del {longDayMonth(draft.next_date)}
                </p>
                <Button size="sm" variant="secondary" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => void copyNotice()}>
                  Copiar mensaje
                </Button>
              </div>
              <p className="whitespace-pre-line text-2xs leading-relaxed text-ink-secondary">{priceIncreaseNoticeMessage(draft.next_date)}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-ink-primary">
                Vista previa · {changes.length} precio{changes.length === 1 ? '' : 's'}
              </p>
              <Button size="sm" variant={stage.stage === 'due' ? 'primary' : 'secondary'} loading={applying} disabled={!ready || !changes.length} onClick={() => void apply()}>
                Aplicar aumento ahora
              </Button>
            </div>
            {changes.length ? (
              <ul className="max-h-56 divide-y divide-surface-border/60 overflow-y-auto rounded-xl border border-surface-border/70 text-2xs">
                {changes.map((c) => (
                  <li key={`${c.kind}-${c.id}`} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="w-10 shrink-0 text-3xs font-semibold uppercase text-ink-muted">{c.kind === 'student' ? 'Cuota' : 'Web'}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-primary">{c.name}</span>
                    <span className="shrink-0 tabular-nums text-ink-muted">{c.kind === 'student' ? formatCurrency(c.from) : c.from}</span>
                    <span className="text-ink-muted">→</span>
                    <span className="shrink-0 font-semibold tabular-nums text-ink-primary">{c.kind === 'student' ? formatCurrency(c.to) : c.to}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-2xs text-ink-muted">Cargá la cuota mensual en la ficha de cada alumno (Pagos) para que entre en el aumento.</p>
            )}
          </div>

          {logQuery.data?.length ? (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-primary">
                <History className="h-3.5 w-3.5 text-ink-muted" /> Aumentos aplicados
              </p>
              <ul className="space-y-1 text-2xs text-ink-secondary">
                {logQuery.data.map((l) => (
                  <li key={l.id}>
                    <span className="tabular-nums">{fmtDate(l.applied_at.slice(0, 10))}</span> · {String(l.percent).replace('.', ',')}% ·{' '}
                    {l.details.length} precio{l.details.length === 1 ? '' : 's'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
