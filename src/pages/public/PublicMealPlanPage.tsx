import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { fetchSharedMealPlan, type SharedMealPlan } from '@/lib/nutrition/sharedMealPlan'
import { mealPhotoId, unsplashUrl } from '@/lib/nutrition/foodPhotos'
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
 * Siempre en claro y en una sola columna al ancho de lectura (estilo Notion): cada comida es una fila con
 * foto, así una comida con más texto no descuadra a las demás. Las indicaciones van abajo, a todo el ancho.
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

/** Separa los párrafos que la nutricionista arma con emojis como viñetas («✅ … ✅ …»). */
function splitBullets(text: string): string[] {
  return (
    text
      // Emojis que llegaron rotos a la base («�» o de uso privado): cuentan como viñeta y no se muestran.
      .split(/[�-]️?/u)
      .flatMap((t) => t.split(/\s+(?=\p{Extended_Pictographic})/u))
      .map((t) => t.trim())
      .filter(Boolean)
  )
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
  const [notesOpen, setNotesOpen] = useState(false)

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
        {cell.kind === 'meal' ? (
          <div className="hhp-cover">
            <img
              src={unsplashUrl(mealPhotoId(r.label, cell.lines.join('\n'), `${r.id}:${di}`), 480, 360)}
              alt=""
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.visibility = 'hidden'
              }}
            />
          </div>
        ) : null}
        <div className="hhp-meal-body">
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
                  <Md text={l} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
    )
  }

  const dayMeals = rows.map((r) => mealCard(r, selected)).filter(Boolean)
  const notesPreamble = notes.preamble.split(/\n{2,}/).flatMap(splitBullets)
  const notesItems = notes.aclaraciones.flatMap(splitBullets)
  const notesLong = [...notesPreamble, ...notesItems].join(' ').length > 520
  // Si el perfil tiene el email como nombre, el botón no lo repite.
  const proFirst = data.professional_name && !data.professional_name.includes('@') ? data.professional_name.trim().split(/\s+/)[0] : ''
  const meta = [
    plan.total_kcal ? `${plan.total_kcal.toLocaleString('es-AR')} kcal por día` : null,
    `${rows.length} comidas por día`,
    next ? `Próxima consulta: ${format(next, "EEEE d 'de' MMMM", { locale: es })}` : null,
    data.professional_name ? `Nutricionista: ${data.professional_name}` : null,
  ].filter(Boolean) as string[]

  return (
    <Shell>
      {/* Pantalla */}
      <div className="hhp-screen">
        <div className="hhp-brand">
          <span className="hhp-logo">
            <i>H</i>
            <span>Haciéndolo Hábito</span>
          </span>
          <div className="hhp-actions">
            <button type="button" className="hhp-btn" onClick={() => window.print()}>
              Descargar PDF
            </button>
            {waDigits ? (
              <a className="hhp-btn hhp-btn-primary" href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer">
                {proFirst ? `Escribir a ${proFirst}` : 'WhatsApp'}
              </a>
            ) : null}
          </div>
        </div>

        <section className="hhp-hero">
          {plan.title ? <div className="hhp-eyebrow">{plan.title}</div> : null}
          <h1>{firstName ? `Plan alimentario de ${firstName}` : 'Tu plan alimentario'}</h1>
          {plan.objective ? <p className="hhp-goal">{plan.objective}</p> : null}
          <ul className="hhp-meta">
            {meta.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>

        <section className="hhp-section">
          <nav className="hhp-days" aria-label="Días de la semana">
            {short.map((d, i) => (
              <button key={d} type="button" className="hhp-day" aria-pressed={i === selected} onClick={() => setDay(i)}>
                {d}
                {i === today ? <span className="hhp-today" aria-label="hoy" /> : null}
              </button>
            ))}
          </nav>
          <div className="hhp-daytitle">
            <h2>{full[selected]}</h2>
            {selected === today ? <span>Hoy</span> : null}
          </div>
          <div className="hhp-meals">
            {dayMeals.length ? dayMeals : <p className="hhp-empty">No hay comidas cargadas para este día.</p>}
          </div>
        </section>

        {hasNotes ? (
          <section className="hhp-section">
            <h2 className="hhp-h2">Indicaciones</h2>
            <div className={notesLong && !notesOpen ? 'hhp-notes hhp-notes-clamp' : 'hhp-notes'}>
              {notesPreamble.map((p, i) => (
                <p key={`p${i}`}>
                  <Md text={p} />
                </p>
              ))}
              {notesItems.length ? (
                <ul>
                  {notesItems.map((a, i) => (
                    <li key={`a${i}`} className={/^\p{Extended_Pictographic}/u.test(a) ? undefined : 'hhp-dot'}>
                      <Md text={a} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {notesLong ? (
              <button type="button" className="hhp-more" onClick={() => setNotesOpen((v) => !v)}>
                {notesOpen ? 'Ver menos' : 'Leer todo'}
              </button>
            ) : null}
          </section>
        ) : null}

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
  --canvas: #FFFFFF; --card: #FFFFFF; --panel: #F7F7F5; --elevated: #F1F1EF; --border: #E9E9E7;
  --ink: #37352F; --ink-2: #4F4D48; --muted: #8A8883; --brand: #46334F; --brand-ink: #FFFFFF; --accent: #E0861A;
  min-height: 100vh; background: var(--canvas); color: var(--ink); color-scheme: light;
  font-family: 'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji';
  font-size: 15px; line-height: 1.55; -webkit-font-smoothing: antialiased;
}
.hhp * { box-sizing: border-box; }
.hhp b { font-weight: 600; color: var(--ink); }
.hhp button, .hhp a { font: inherit; }
.hhp button:focus-visible, .hhp a:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.hhp-inner { max-width: 880px; margin: 0 auto; padding: 20px max(16px, env(safe-area-inset-right)) 48px max(16px, env(safe-area-inset-left)); container-type: inline-size; }
.hhp-screen { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; }
.hhp-state { padding: 18vh 0; text-align: center; color: var(--ink-2); }
.hhp-state h1 { margin: 0 0 6px; font-size: 20px; color: var(--ink); letter-spacing: -0.02em; }
.hhp-state p { margin: 0 auto; max-width: 40ch; }

.hhp-brand { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12.5px; color: var(--muted); }
.hhp-logo { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; color: var(--ink); min-width: 0; }
.hhp-logo i { flex: 0 0 auto; width: 22px; height: 22px; border-radius: 6px; background: var(--brand); color: var(--brand-ink); display: grid; place-items: center; font-style: normal; font-size: 11px; font-weight: 700; }
.hhp-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.hhp-btn { border: 1px solid var(--border); background: var(--card); color: var(--ink); border-radius: 7px; padding: 5px 11px; font-size: 13px; font-weight: 500; cursor: pointer; text-decoration: none; white-space: nowrap; }
.hhp-btn:hover { background: var(--panel); }
.hhp-btn-primary { background: var(--brand); border-color: var(--brand); color: var(--brand-ink); }
.hhp-btn-primary:hover { background: var(--brand); opacity: .92; }

.hhp-hero { min-width: 0; }
.hhp-hero h1 { margin: 0; font-size: clamp(22px, 6.6vw, 28px); line-height: 1.15; letter-spacing: -0.03em; font-weight: 700; text-wrap: balance; overflow-wrap: break-word; }
.hhp-eyebrow { font-size: 12.5px; color: var(--muted); margin-bottom: 4px; }
.hhp-goal { margin: 6px 0 0; color: var(--ink-2); font-size: 14.5px; max-width: 62ch; }
.hhp-meta { margin: 10px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; font-size: 12.5px; color: var(--ink-2); }
.hhp-meta li { background: var(--elevated); border-radius: 6px; padding: 2px 8px; overflow-wrap: anywhere; min-width: 0; }

.hhp-section { display: grid; gap: 12px; min-width: 0; border-top: 1px solid var(--border); padding-top: 16px; }
.hhp-h2, .hhp-daytitle h2 { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -0.02em; }
.hhp-days { position: sticky; top: 0; z-index: 5; background: var(--canvas); display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 5px; overflow-x: auto; scrollbar-width: none; margin: -8px -16px 0; padding: 8px 16px; }
.hhp-days::-webkit-scrollbar { display: none; }
.hhp-day { position: relative; min-width: 0; border: 1px solid var(--border); background: var(--card); color: var(--ink-2); border-radius: 8px; padding: 7px 2px; text-align: center; cursor: pointer; font-weight: 500; font-size: 13.5px; line-height: 1.2; }
.hhp-day:hover { background: var(--panel); }
.hhp-day[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: #fff; }
.hhp-today { position: absolute; top: 5px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
.hhp-daytitle { display: flex; align-items: baseline; gap: 10px; }
.hhp-daytitle span { font-size: 13px; color: var(--muted); }

.hhp-meals { display: grid; gap: 12px; }
.hhp-meal { display: grid; grid-template-columns: 64px minmax(0, 1fr); align-items: start; gap: 12px; padding: 12px; background: var(--card); border: 1px solid var(--border); border-radius: 10px; min-width: 0; box-shadow: 0 1px 2px rgba(15, 15, 15, .04); }
/* Miniatura de tamaño fijo: un texto largo no la estira. */
.hhp-cover { width: 64px; height: 64px; border-radius: 8px; overflow: hidden; background: var(--elevated); }
.hhp-meal-skip { grid-template-columns: minmax(0, 1fr); }
.hhp-cover img { display: block; max-width: none; width: 100%; height: 100%; object-fit: cover; }
.hhp-meal-body { min-width: 0; }
.hhp-meal header { display: flex; flex-direction: column; gap: 1px; margin-bottom: 7px; }
.hhp-meal h4 { margin: 0; font-size: 15.5px; font-weight: 600; letter-spacing: -0.01em; }
.hhp-meal time { font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.hhp-meal ul { margin: 0; padding-left: 16px; list-style: disc; display: grid; gap: 4px; color: var(--ink-2); font-size: 14px; overflow-wrap: anywhere; }
.hhp-meal li::marker { color: var(--muted); }
.hhp-meal-skip { background: var(--panel); box-shadow: none; }
.hhp-meal-skip p, .hhp-empty { margin: 0; color: var(--muted); font-size: 14px; }

.hhp-notes { position: relative; display: grid; gap: 10px; color: var(--ink-2); font-size: 15px; max-width: 70ch; }
.hhp-notes p { margin: 0; white-space: pre-line; }
.hhp-notes ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.hhp-notes .hhp-dot { position: relative; padding-left: 18px; }
.hhp-notes .hhp-dot::before { content: ''; position: absolute; left: 4px; top: .68em; width: 5px; height: 5px; border-radius: 50%; background: var(--muted); }
.hhp-notes-clamp { max-height: 15.5em; overflow: hidden; }
.hhp-notes-clamp::after { content: ""; position: absolute; inset: auto 0 0 0; height: 64px; background: linear-gradient(to bottom, rgba(255,255,255,0), var(--canvas)); }
.hhp-more { justify-self: start; border: 0; background: none; padding: 0; color: var(--ink); font-weight: 500; font-size: 14px; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--border); cursor: pointer; }
.hhp-foot { margin: 0; font-size: 12px; color: var(--muted); border-top: 1px solid var(--border); padding-top: 16px; }

@container (max-width: 400px) {
  .hhp-logo > span { display: none; }
}
@container (min-width: 600px) {
  .hhp-screen { gap: 24px; padding-top: 8px; }
  .hhp-hero h1 { font-size: 32px; }
  .hhp-days { margin-inline: 0; padding-inline: 0; }
  .hhp-meal { grid-template-columns: 148px minmax(0, 1fr); gap: 18px; padding: 14px; }
  .hhp-cover { width: 148px; height: 104px; }
  .hhp-meal-skip { grid-template-columns: minmax(0, 1fr); padding-inline: 16px; }
  .hhp-meal header { flex-direction: row; align-items: baseline; gap: 10px; margin-bottom: 8px; }
  .hhp-meal h4 { font-size: 16px; }
  .hhp-meal time { margin-left: auto; flex: 0 0 auto; background: var(--elevated); border-radius: 5px; padding: 1px 7px; white-space: nowrap; }
  .hhp-meal ul { padding-left: 18px; gap: 5px; font-size: 14.5px; }
  .hhp-day { font-size: 14px; padding-inline: 8px; }
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
