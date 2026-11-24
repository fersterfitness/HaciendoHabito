import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { controlSmClassName } from '@/lib/formControlClasses'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/marketplace'
import { incomeTotals, parsePct, pctLabel, shiftMonth, splitAmount, type IncomeRow } from '@/lib/marketplaceIncome'
import { useMarketplaceIncome, useSetCommission } from '@/data/marketplaceIncome'

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Feedback nov24 (R1): lo que entró por la web en el mes, por profesional, y cuánto le toca a cada uno.
 * Solo para el administrador; el porcentaje se cambia acá y vale para los pagos que confirme desde ahora.
 */
export function MarketplaceIncomePanel() {
  const [month, setMonth] = useState(currentMonth)
  const q = useMarketplaceIncome(month, true)
  const rows = q.data ?? []
  const totals = incomeTotals(rows)
  const label = format(new Date(`${month}-15T12:00:00`), "MMMM yyyy", { locale: es })

  return (
    <section aria-labelledby="ingresos-web" className="rounded-2xl border border-surface-border bg-surface-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="ingresos-web" className="text-sm font-semibold text-ink-primary">Ingresos por profesional</h2>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="iconSm" aria-label="Mes anterior" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-28 text-center text-sm capitalize text-ink-secondary">{label}</span>
          <Button variant="ghost" size="iconSm" aria-label="Mes siguiente" disabled={month >= currentMonth()} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Pagos que confirmaste en el mes. «Tu parte» es el porcentaje de cada profesional (por defecto 20 %); si lo cambiás, vale para los próximos pagos.
      </p>

      {q.isError ? (
        <p className="mt-3 text-sm text-status-expired">{q.error instanceof Error ? q.error.message : 'No se pudieron cargar los ingresos.'}</p>
      ) : q.isPending ? (
        <p className="mt-3 text-sm text-ink-muted">Cargando…</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {[
              { k: 'Cobrado', v: totals.cobrado },
              { k: 'Tu parte', v: totals.admin },
              { k: 'Profesionales', v: totals.professionals },
            ].map((t) => (
              <div key={t.k} className="rounded-xl bg-surface-elevated/70 px-3 py-2.5">
                <dt className="text-xs text-ink-muted">{t.k}</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-ink-primary">{formatPrice(t.v)}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-3 divide-y divide-surface-border">
            {rows.map((r) => (
              <IncomeLine key={r.professional_id} row={r} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function IncomeLine({ row: r }: { row: IncomeRow }) {
  const setPct = useSetCommission()
  const [draft, setDraft] = useState(String(r.comision_pct).replace('.', ','))
  const share = splitAmount(r.cobrado, r.cobrado ? (r.para_admin / r.cobrado) * 100 : r.comision_pct)

  function save() {
    const pct = parsePct(draft)
    if (pct === null) {
      toast.error('El porcentaje va de 0 a 100.')
      setDraft(String(r.comision_pct).replace('.', ','))
      return
    }
    if (pct === r.comision_pct) return
    setPct.mutate(
      { professionalId: r.professional_id, pct },
      {
        onSuccess: () => toast.success(`Desde ahora te queda el ${pctLabel(pct)} de ${r.nombre.split(' ')[0]}`),
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : 'No se pudo guardar')
          setDraft(String(r.comision_pct).replace('.', ','))
        },
      },
    )
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-primary">{r.nombre}</p>
        <p className="text-xs text-ink-muted">
          {r.cantidad === 0
            ? 'Sin pagos este mes'
            : `${r.cantidad} ${r.cantidad === 1 ? 'pago' : 'pagos'} · ${formatPrice(r.cobrado)} · al profesional ${formatPrice(share.professional)} · a vos ${formatPrice(share.admin)}`}
        </p>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
        Tu parte
        <input
          inputMode="decimal"
          className={cn(controlSmClassName, 'w-16 px-2 text-right tabular-nums')}
          value={draft}
          disabled={setPct.isPending}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          aria-label={`Porcentaje tuyo de ${r.nombre}`}
        />
        %
      </label>
    </li>
  )
}
