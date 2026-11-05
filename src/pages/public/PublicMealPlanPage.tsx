import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { fetchSharedMealPlan, type SharedMealPlan } from '@/lib/nutrition/sharedMealPlan'
import {
  columnFullLabels,
  columnLabels,
  isNoMealMarker,
  mealContentLines,
  normalizeWeeklyGrid,
} from '@/lib/nutrition/weeklyPlanGrid'
import { parsePlanGeneralNotes } from '@/lib/nutrition/planGeneralNotes'
import { parseInlineMarkdown } from '@/lib/nutrition/inlineMarkdown'
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp'

/**
 * Plan alimentario que abre el paciente desde el link (sin cuenta).
 * Celular primero; en la compu, comidas en dos columnas y las indicaciones al costado.
 * «Descargar PDF» imprime la misma página en A4 vertical con letra normal.
 */

function Md({ text }: { text: string }) {
  return (
    <>
      {parseInlineMarkdown(text).map((s, i) =>
        s.bold ? <b key={i}>{s.text}</b> : s.italic ? <i key={i}>{s.text}</i> : <span key={i}>{s.text}</span>,
      )}
    </>
  )
}

/** Lunes = 0; sábado y domingo caen en la última columna si están juntos. */
function todayColumn(mergeWeekends: boolean): number {
  const dow = (new Date().getDay() + 6) % 7
  return mergeWeekends ? Math.min(dow, 5) : dow
}

type Cell = { kind: 'empty' } | { kind: 'none' } | { kind: 'meal'; lines: string[] }

function readCell(text: string | undefined): Cell {
  const t = (text ?? '').trim()
  if (!t) return { kind: 'empty' }
  if (isNoMealMarker(t)) return { kind: 'none' }
  return { kind: 'meal', lines: mealContentLines(t) }
}

export function PublicMealPlanPage() {
  const { token = '' } = useParams()
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ok'; data: SharedMealPlan | null }>({
    status: 'loading',
  })
  const [day, setDay] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    fetchSharedMealPlan(token)
      .then((data) => alive && setState({ status: 'ok', data }))
      .catch(() => alive && setState({ status: 'error' }))
    return () => {
      alive = false
    }
  }, [token])

  const data = state.status === 'ok' ? state.data : null
  const plan = data?.plan ?? null
  const merge = plan?.merge_weekends ?? true
  const grid = useMemo(() => (plan ? normalizeWeeklyGrid(plan.grid, merge) : null), [plan, merge])
  const notes = useMemo(() => parsePlanGeneralNotes(plan?.notes), [plan?.notes])
  const today = todayColumn(merge)
  const selected = day ?? today
  const firstName = data?.patient_first_name?.trim() ?? ''
  const waDigits = normalizePhoneForWhatsApp(data?.professional_phone)

  useEffect(() => {
    document.title = firstName ? `Plan alimentario de ${firstName}` : 'Plan alimentario'
  }, [firstName])

  if (state.status === 'loading') {
    return (
      <Shell>
        <p className="hhp-state">Cargando tu plan…</p>
      </Shell>
    )
  }
  if (state.status === 'error' || !data) {
    return (
      <Shell>
        <div className="hhp-state">
          <h1>Este link no funciona</h1>
          <p>Puede que tu nutricionista haya generado uno nuevo. Pedile el link actualizado.</p>
        </div>
      </Shell>
    )
  }
  if (!plan || !grid || grid.mealRows.length === 0) {
    return (
      <Shell>
        <div className="hhp-state">
          <h1>Tu plan todavía no está cargado</h1>
          <p>Cuando tu nutricionista lo arme, lo vas a ver en este mismo link.</p>
        </div>
      </Shell>
    )
  }

  const full = columnFullLabels(merge)
  const short = columnLabels(merge)
  const rows = grid.mealRows
  const next = plan.next_consultation_date ? new Date(plan.next_consultation_date + 'T12:00:00') : null
  const facts = [
    plan.total_kcal ? { label: 'Energía', value: plan.total_kcal.toLocaleString('es-AR'), unit: 'kcal/día' } : null,
    { label: 'Comidas', value: String(rows.length), unit: 'por día' },
    next ? { label: 'Próxima consulta', value: format(next, 'd MMM', { locale: es }), unit: '' } : null,
  ].filter(Boolean) as { label: string; value: string; unit: string }[]
  const updated = plan.updated_at ? format(new Date(plan.updated_at), "d 'de' MMMM", { locale: es }) : null
  const hasNotes = notes.preamble.trim() !== '' || notes.aclaraciones.length > 0

  const mealCard = (r: (typeof rows)[number], di: number) => {
    const cell = readCell(r.columns[di])
    if (cell.kind === 'empty') return null
    return (
      <article key={r.id} className={cell.kind === 'none' ? 'hhp-meal hhp-meal-skip' : 'hhp-meal'}>
        <header>
          <h4>{r.label}</h4>
          {r.approxTime ? <time>{r.approxTime}</time> : null}
        </header>
        {cell.kind === 'none' ? (
          <p>Sin comida este día.</p>
        ) : (
          <ul>
            {cell.lines.map((l, i) => (
              <li key={i}>
                <span>
                  <Md text={l} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>
    )
  }

  const dayMeals = rows.map((r) => mealCard(r, selected)).filter(Boolean)

  return (
    <Shell>
      {/* Pantalla */}
      <div className="hhp-screen">
        <div className="hhp-brand">
          <span className="hhp-logo">
            <i>H</i>Haciéndolo Hábito
          </span>
          {data.professional_name ? <span>{data.professional_name}</span> : null}
        </div>

        <section className="hhp-hero">
          <div>
            {plan.title ? <div className="hhp-eyebrow">{plan.title}</div> : null}
            <h1>{firstName ? `Plan alimentario de ${firstName}` : 'Tu plan alimentario'}</h1>
            {plan.objective ? <p className="hhp-goal">{plan.objective}</p> : null}
          </div>
          <dl className="hhp-facts" style={{ gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))` }}>
            {facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>
                  {f.value} {f.unit ? <small>{f.unit}</small> : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <nav className="hhp-days" aria-label="Días de la semana">
          {short.map((d, i) => (
            <button key={d} type="button" className="hhp-day" aria-pressed={i === selected} onClick={() => setDay(i)}>
              <span>{d}</span>
              {i === today ? <span className="hhp-today">Hoy</span> : null}
            </button>
          ))}
        </nav>

        <div className="hhp-main">
          <div className="hhp-daytitle">
            <h2>{full[selected]}</h2>
            {selected === today ? <span>Hoy</span> : null}
          </div>
          <div className="hhp-meals">
            {dayMeals.length ? dayMeals : <p className="hhp-empty">No hay comidas cargadas para este día.</p>}
          </div>
        </div>

        <aside className="hhp-side">
          {next ? (
            <div className="hhp-box hhp-next">
              <div className="hhp-cal">
                <span>{format(next, 'EEE', { locale: es })}</span>
                <b>{format(next, 'd')}</b>
              </div>
              <p>
                <b>Próxima consulta</b>
                {format(next, "EEEE d 'de' MMMM", { locale: es })}
              </p>
            </div>
          ) : null}
          {notes.preamble.trim() ? (
            <div className="hhp-box">
              <h3>Indicaciones generales</h3>
              {notes.preamble
                .split(/\n{2,}/)
                .filter((p) => p.trim())
                .map((p, i) => (
                  <p key={i}>
                    <Md text={p.trim()} />
                  </p>
                ))}
            </div>
          ) : null}
          {notes.aclaraciones.length ? (
            <div className="hhp-box">
              <h3>Aclaraciones</h3>
              <ol>
                {notes.aclaraciones.map((a, i) => (
                  <li key={i}>
                    <Md text={a} />
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <div className="hhp-actions">
            <button type="button" className="hhp-btn hhp-btn-primary" onClick={() => window.print()}>
              Descargar PDF
            </button>
            {waDigits ? (
              <a className="hhp-btn" href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer">
                Escribir a {data.professional_name?.split(' ')[0] ?? 'tu nutricionista'}
              </a>
            ) : null}
          </div>
        </aside>

        <p className="hhp-foot">
          {updated ? `Plan actualizado el ${updated}. ` : ''}Si tu nutricionista lo cambia, este link muestra la versión nueva.
        </p>
      </div>

      {/* Impresión: A4 vertical, todos los días */}
      <div className="hhp-print" aria-hidden>
        <header className="hhp-p-head">
          <div>
            <h1>{firstName ? `Plan alimentario · ${firstName}` : 'Plan alimentario'}</h1>
            <p>
              {[plan.title, data.professional_name].filter(Boolean).join(' · ')}
            </p>
          </div>
          <dl>
            {facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>
                  {f.value} {f.unit}
                </dd>
              </div>
            ))}
          </dl>
        </header>
        {plan.objective ? <p className="hhp-p-goal">{plan.objective}</p> : null}
        {full.map((d, di) => (
          <section key={d} className="hhp-p-day">
            <h2>{d}</h2>
            <dl>
              {rows.map((r) => {
                const c = readCell(r.columns[di])
                if (c.kind === 'empty') return null
                return (
                  <div key={r.id} className="hhp-p-row">
                    <dt>
                      {r.label}
                      {r.approxTime ? <small>{r.approxTime}</small> : null}
                    </dt>
                    <dd>
                      {c.kind === 'none'
                        ? '—'
                        : c.lines.map((l, i) => (
                            <span key={i}>
                              {i ? ' · ' : ''}
                              <Md text={l} />
                            </span>
                          ))}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </section>
        ))}
        {hasNotes ? (
          <section className="hhp-p-notes">
            {notes.preamble.trim() ? (
              <div>
                <h3>Indicaciones generales</h3>
                <p>
                  <Md text={notes.preamble.trim()} />
                </p>
              </div>
            ) : null}
            {notes.aclaraciones.length ? (
              <div>
                <h3>Aclaraciones</h3>
                <ol>
                  {notes.aclaraciones.map((a, i) => (
                    <li key={i}>
                      <Md text={a} />
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="hhp">
      <style>{CSS}</style>
      <div className="hhp-inner">{children}</div>
    </div>
  )
}

/** Estilos propios de la página pública (no depende del tema ni de la versión que tenga guardada quien la abre). */
const CSS = `
.hhp {
  --canvas: #F0EDF2; --card: #FFFFFF; --panel: #FAF8FB; --elevated: #F3F0F5; --border: #E9E5EC;
  --ink: #2E2136; --ink-2: #564860; --muted: #827A8E; --brand: #46334F; --brand-ink: #FFFFFF; --accent-ink: #A05200;
  min-height: 100vh; background: var(--canvas); color: var(--ink);
  font-family: 'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  .hhp {
    --canvas: #100C14; --card: #1A141F; --panel: #201926; --elevated: #2A2231; --border: #302738;
    --ink: #F5F1F7; --ink-2: #D0C8D6; --muted: #9890A2; --brand: #F2921D; --brand-ink: #1E1424; --accent-ink: #F5B061;
    color-scheme: dark;
  }
}
.hhp * { box-sizing: border-box; }
.hhp b { font-weight: 600; color: var(--ink); }
.hhp button, .hhp a { font: inherit; }
.hhp button:focus-visible, .hhp a:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.hhp-inner { max-width: 1120px; margin: 0 auto; padding: 20px max(16px, env(safe-area-inset-right)) 40px max(16px, env(safe-area-inset-left)); container-type: inline-size; }
.hhp-screen { display: grid; gap: 18px; }
.hhp-state { padding: 18vh 0; text-align: center; color: var(--ink-2); }
.hhp-state h1 { margin: 0 0 6px; font-size: 20px; color: var(--ink); letter-spacing: -0.02em; }
.hhp-state p { margin: 0 auto; max-width: 40ch; }

.hhp-brand { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--muted); }
.hhp-logo { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; color: var(--ink); }
.hhp-logo i { width: 22px; height: 22px; border-radius: 7px; background: var(--brand); color: var(--brand-ink); display: grid; place-items: center; font-style: normal; font-size: 11px; font-weight: 700; }

.hhp-hero { display: grid; gap: 14px; }
.hhp-hero h1 { margin: 0; font-size: 26px; line-height: 1.15; letter-spacing: -0.03em; font-weight: 600; text-wrap: balance; }
.hhp-eyebrow { font-size: 12.5px; color: var(--muted); font-weight: 500; margin-bottom: 4px; }
.hhp-goal { margin: 8px 0 0; color: var(--ink-2); font-size: 14.5px; max-width: 60ch; }
.hhp-facts { margin: 0; display: grid; border: 1px solid var(--border); border-radius: 18px; background: var(--card); overflow: hidden; }
.hhp-facts div { padding: 10px 12px; min-width: 0; }
.hhp-facts div + div { border-left: 1px solid var(--border); }
.hhp-facts dt { font-size: 11.5px; color: var(--muted); }
.hhp-facts dd { margin: 2px 0 0; font-size: 15px; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.hhp-facts small { font-size: 12px; font-weight: 500; color: var(--muted); letter-spacing: 0; }

.hhp-days { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin-inline: -16px; padding-inline: 16px; }
.hhp-days::-webkit-scrollbar { display: none; }
.hhp-day { flex: 0 0 auto; border: 1px solid var(--border); background: var(--card); color: var(--ink); border-radius: 14px; padding: 9px 14px; min-width: 58px; text-align: center; cursor: pointer; font-weight: 600; font-size: 14px; }
.hhp-day[aria-pressed="true"] { background: var(--brand); border-color: var(--brand); color: var(--brand-ink); }
.hhp-today { display: block; font-size: 10px; font-weight: 600; color: var(--accent-ink); }
.hhp-day[aria-pressed="true"] .hhp-today { color: inherit; opacity: .85; }

.hhp-main { display: grid; gap: 10px; align-content: start; min-width: 0; }
.hhp-daytitle { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.hhp-daytitle h2 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
.hhp-daytitle span { font-size: 12.5px; color: var(--muted); }
.hhp-meals { display: grid; gap: 10px; }
.hhp-meal { background: var(--card); border: 1px solid var(--border); border-radius: 18px; padding: 14px 16px 15px; min-width: 0; }
.hhp-meal header { display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; }
.hhp-meal h4 { margin: 0; font-size: 15.5px; font-weight: 600; letter-spacing: -0.01em; }
.hhp-meal time { margin-left: auto; font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.hhp-meal ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 7px; }
.hhp-meal li { display: grid; grid-template-columns: 6px minmax(0, 1fr); gap: 10px; align-items: baseline; color: var(--ink-2); font-size: 14.5px; overflow-wrap: anywhere; }
.hhp-meal li::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: var(--muted); opacity: .6; transform: translateY(-2px); }
.hhp-meal-skip { background: var(--panel); }
.hhp-meal-skip p, .hhp-empty { margin: 0; color: var(--muted); font-size: 14px; }

.hhp-side { display: grid; gap: 12px; align-content: start; }
.hhp-box { background: var(--card); border: 1px solid var(--border); border-radius: 18px; padding: 16px; }
.hhp-box h3 { margin: 0 0 8px; font-size: 14.5px; font-weight: 600; }
.hhp-box p { margin: 0; color: var(--ink-2); font-size: 14px; white-space: pre-line; }
.hhp-box p + p { margin-top: 8px; }
.hhp-box ol { margin: 0; padding-left: 18px; display: grid; gap: 7px; color: var(--ink-2); font-size: 14px; }
.hhp-next { display: flex; gap: 12px; align-items: center; }
.hhp-cal { flex: 0 0 auto; width: 46px; border-radius: 12px; border: 1px solid var(--border); text-align: center; overflow: hidden; }
.hhp-cal span { display: block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; background: var(--elevated); color: var(--ink-2); padding: 2px 0; }
.hhp-cal b { display: block; font-size: 18px; padding: 3px 0 4px; font-variant-numeric: tabular-nums; }
.hhp-next p b { display: block; font-size: 14.5px; }
.hhp-next p::first-letter { text-transform: uppercase; }
.hhp-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.hhp-btn { border: 1px solid var(--border); background: var(--card); color: var(--ink); border-radius: 999px; padding: 9px 16px; font-size: 13.5px; font-weight: 500; cursor: pointer; text-decoration: none; }
.hhp-btn-primary { background: var(--brand); border-color: var(--brand); color: var(--brand-ink); }
.hhp-foot { margin: 0; font-size: 12px; color: var(--muted); text-align: center; }

@container (min-width: 760px) {
  .hhp-screen { grid-template-columns: minmax(0, 1fr) 300px; column-gap: 32px; row-gap: 24px; padding-top: 16px; }
  .hhp-brand, .hhp-hero, .hhp-days, .hhp-foot { grid-column: 1 / -1; }
  .hhp-hero { grid-template-columns: minmax(0, 1fr) minmax(0, 420px); gap: 28px; align-items: end; }
  .hhp-hero h1 { font-size: 32px; }
  .hhp-days { margin-inline: 0; padding-inline: 0; }
  .hhp-day { min-width: 84px; padding-block: 11px; }
  .hhp-meals { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
}

.hhp-print { display: none; }
@media print {
  @page { size: A4 portrait; margin: 14mm 14mm 16mm; }
  .hhp { background: #fff; color: #2E2136; min-height: 0; font-size: 10.5pt; }
  .hhp-inner { padding: 0; max-width: none; }
  .hhp-screen { display: none; }
  .hhp-print { display: block; color: #2E2136; }
  .hhp-print b { color: #2E2136; }
  .hhp-p-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; border-bottom: 1.5px solid #2E2136; padding-bottom: 8px; }
  .hhp-p-head h1 { margin: 0; font-size: 18pt; letter-spacing: -0.02em; }
  .hhp-p-head p { margin: 2px 0 0; color: #6B6078; font-size: 9.5pt; }
  .hhp-p-head dl { margin: 0; display: flex; gap: 14px; text-align: right; font-size: 8.5pt; }
  .hhp-p-head dt { color: #6B6078; } .hhp-p-head dd { margin: 0; font-weight: 600; font-size: 10pt; }
  .hhp-p-goal { margin: 8px 0 0; font-size: 10pt; color: #3E3248; }
  .hhp-p-day { break-inside: avoid; margin-top: 14px; }
  .hhp-p-day h2 { margin: 0 0 4px; font-size: 12pt; }
  .hhp-p-day dl { margin: 0; }
  .hhp-p-row { display: grid; grid-template-columns: 30mm minmax(0, 1fr); gap: 10px; padding: 5px 0; border-top: 1px solid #E2DCE6; line-height: 1.45; }
  .hhp-p-row dt { font-weight: 600; } .hhp-p-row dt small { display: block; font-weight: 400; color: #6B6078; font-size: 8.5pt; }
  .hhp-p-row dd { margin: 0; color: #3E3248; }
  .hhp-p-notes { break-inside: avoid; margin-top: 16px; padding-top: 8px; border-top: 1.5px solid #2E2136; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 9.5pt; }
  .hhp-p-notes h3 { margin: 0 0 4px; font-size: 10.5pt; }
  .hhp-p-notes p { margin: 0; white-space: pre-line; }
  .hhp-p-notes ol { margin: 0; padding-left: 16px; }
}
`
