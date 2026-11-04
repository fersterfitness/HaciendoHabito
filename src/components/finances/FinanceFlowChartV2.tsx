import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { ChartAreaGradient, ChartTooltip, chartActiveDot, chartAxis, chartCursor, chartGrid, compactCurrency } from '@/components/charts/chartKit'
import { SegmentedV2 } from '@/components/v2/ui'
import { cn, formatCurrency } from '@/lib/utils'
import type { Expense, Income } from '@/types/database'

const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const C_IN = '#8080FF'
const C_OUT = '#FF00FF'

type Range = '6' | '12'

/**
 * v2 · Flujo de caja: ingresos cobrados contra gastos por mes, en áreas suaves.
 * Arriba, el balance del mes en curso y cuánto cambió contra el mes anterior.
 */
export function FinanceFlowChartV2({ incomes, expenses }: { incomes: Income[]; expenses: Expense[] }) {
  const [range, setRange] = useState<Range>('6')

  const data = useMemo(() => {
    const n = Number(range)
    const base = new Date()
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() - (n - 1) + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const ingresos = incomes.filter((x) => x.status === 'cobrado' && x.income_date.startsWith(key)).reduce((s, x) => s + x.amount, 0)
      const gastos = expenses.filter((x) => x.expense_date.startsWith(key)).reduce((s, x) => s + x.amount, 0)
      return { mes: MES[d.getMonth()], ingresos, gastos, balance: ingresos - gastos }
    })
  }, [incomes, expenses, range])

  const current = data[data.length - 1]
  const previous = data[data.length - 2]
  // En plata y no en %: el % no se entiende cuando el balance cambia de signo (daba «200%»).
  const delta = current && previous ? current.balance - previous.balance : null
  const up = delta != null && delta >= 0
  const now = new Date()
  const prevName = MES_LARGO[(now.getMonth() + 11) % 12]

  return (
    <section className="rounded-[1.25rem] border border-surface-border bg-surface-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-ink-muted">Balance de {MES_LARGO[now.getMonth()]}</p>
          <div className="mt-1 flex items-baseline gap-2.5">
            <p className="text-[26px] font-medium tabular-nums tracking-[-0.02em] text-ink-primary">{formatCurrency(current?.balance ?? 0)}</p>
            {delta != null && delta !== 0 ? (
              <span
                className={cn(
                  'hh-pastel inline-flex h-6 items-center gap-0.5 rounded-full px-2 text-[12px] font-medium tabular-nums',
                  up ? 'bg-pastel-mint text-pastel-mint-ink' : 'bg-pastel-rose text-pastel-rose-ink',
                )}
              >
                {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {formatCurrency(Math.abs(delta))}
                <span className="ml-1 font-normal opacity-75">vs {prevName}</span>
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex gap-4 text-[12px] text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: C_IN }} /> Ingresos {formatCurrency(current?.ingresos ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: C_OUT }} /> Gastos {formatCurrency(current?.gastos ?? 0)}
            </span>
          </div>
        </div>
        <SegmentedV2
          value={range}
          onChange={(v) => setRange(v as Range)}
          options={[
            { value: '6', label: '6 meses' },
            { value: '12', label: '12 meses' },
          ]}
        />
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <ChartAreaGradient id="flow-in" color={C_IN} opacity={0.35} />
          <ChartAreaGradient id="flow-out" color={C_OUT} opacity={0.18} />
          <CartesianGrid {...chartGrid} />
          <XAxis dataKey="mes" {...chartAxis} />
          <YAxis {...chartAxis} width={44} tickFormatter={(v: number) => (v === 0 ? '' : compactCurrency(v))} />
          <Tooltip
            cursor={chartCursor}
            wrapperStyle={{ outline: 'none' }}
            content={
              <ChartTooltip
                formatValue={(v) => formatCurrency(v)}
                footer={(p) => {
                  const row = p[0]?.payload as { balance?: number } | undefined
                  return `Balance ${formatCurrency(row?.balance ?? 0)}`
                }}
              />
            }
          />
          <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke={C_IN} strokeWidth={2.25} fill="url(#flow-in)" activeDot={chartActiveDot(C_IN)} />
          <Area type="monotone" dataKey="gastos" name="Gastos" stroke={C_OUT} strokeWidth={1.75} strokeDasharray="5 4" fill="url(#flow-out)" activeDot={chartActiveDot(C_OUT)} />
        </AreaChart>
      </ResponsiveContainer>
    </section>
  )
}
