import { forwardRef, type ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Apple,
  ChartColumn,
  Dumbbell,
  Flame,
  HeartPulse,
  Moon,
  Target,
  Trophy,
  User,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { BRAND_LOGO_COMPACT_PATH } from '@/lib/brandLogo'
import { parseInlineMarkdown } from '@/lib/nutrition/inlineMarkdown'
import {
  REPORT_GOALS,
  nfReport,
  somatotypeName,
  type AnthropometryReportData,
  type ChangeTone,
  type ReportRow,
  type ReportValue,
} from '@/lib/nutrition/anthropometryReport'

/**
 * Lámina «Evaluación antropométrica» con el estilo de la v2 en claro: tarjetas blancas con borde fino,
 * texto en la gama ciruela y color solo para los cambios. Medida fija (1440 px) y colores propios,
 * sin tokens del tema: tiene que verse igual en pantalla, en la imagen y en el HTML descargado.
 */

export const REPORT_SHEET_WIDTH = 1440

/** Valores de la v2 en modo claro (index.css, html.ui-v2). */
const C = {
  ink: '#2e2136',
  secondary: '#564860',
  muted: '#827a8e',
  border: '#e9e5ec',
  panel: '#faf8fb',
  elevated: '#f3f0f5',
  good: '#3f8f62',
  bad: '#c4553f',
  alert: '#a0701a',
}

const TONE_COLOR: Record<ChangeTone, string> = { good: C.good, bad: C.bad, neutral: C.muted, same: C.muted }

const GOAL_ICON: Record<string, LucideIcon> = {
  muscle: Dumbbell,
  habits: Apple,
  composition: ChartColumn,
  health: HeartPulse,
  fat: Flame,
  performance: Trophy,
  energy: Zap,
  rest: Moon,
}

export interface ZoneSummary {
  good: number
  bad: number
  alert: number
}

export interface AnthropometryReportSheetProps {
  data: AnthropometryReportData
  reading: string
  objective: string
  goals: string[]
  /** Cuerpo de frente ya pintado (data URL). null = sin cuerpo (falta el sexo). */
  bodySrc: string | null
  zoneSummary: ZoneSummary | null
}

const card = { border: `1px solid ${C.border}`, borderRadius: 16, background: '#fff' } as const

function Delta({ v, decimals = 2, unit = '' }: { v: ReportValue; decimals?: number; unit?: string }) {
  if (v.delta == null) return null
  const same = v.tone === 'same'
  return (
    <span style={{ color: TONE_COLOR[v.tone], fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
      {same ? 'sin cambio' : `${v.delta > 0 ? '+' : '−'}${nfReport(Math.abs(v.delta), decimals)}${unit ? ` ${unit}` : ''}`}
    </span>
  )
}

function Card({ title, unit, children, style }: { title: string; unit?: string; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ ...card, padding: '18px 20px 10px', ...style }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: C.ink }}>
        {title}
        {unit ? <span style={{ fontWeight: 400, color: C.muted }}> · {unit}</span> : null}
      </h3>
      {children}
    </section>
  )
}

function Line({ label, value, delta, sub, strong }: { label: string; value: ReactNode; delta?: ReactNode; sub?: string | null; strong?: boolean }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: delta === undefined ? '1fr auto' : '1fr auto 82px',
        alignItems: 'baseline',
        gap: 10,
        padding: '8px 0',
        borderTop: `1px solid ${C.border}`,
        fontSize: 16,
      }}
    >
      <span style={{ color: strong ? C.ink : C.secondary, fontWeight: strong ? 600 : 400 }}>
        {label}
        {sub ? <span style={{ display: 'block', fontSize: 13, color: C.muted }}>{sub}</span> : null}
      </span>
      <span style={{ color: C.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</span>
      {delta === undefined ? null : <span style={{ textAlign: 'right' }}>{delta}</span>}
    </div>
  )
}

function Rows({ rows, withDelta }: { rows: ReportRow[]; withDelta: boolean }) {
  if (!rows.length) return <p style={{ margin: '6px 0 10px', fontSize: 15, color: C.muted }}>Sin datos en este control</p>
  return (
    <div>
      {rows.map((r) => (
        <Line key={r.key} label={r.label} value={nfReport(r.value, r.decimals)} delta={withDelta ? <Delta v={r} /> : undefined} />
      ))}
    </div>
  )
}

function Markdown({ text }: { text: string }) {
  return (
    <>
      {parseInlineMarkdown(text).map((s, i) =>
        s.bold ? (
          <strong key={i} style={{ color: C.ink, fontWeight: 600 }}>
            {s.text}
          </strong>
        ) : s.italic ? (
          <em key={i}>{s.text}</em>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  )
}

function Kpi({ label, value, unit, extra, delta }: { label: string; value: string; unit?: string; extra?: string; delta?: ReactNode }) {
  return (
    <div style={{ ...card, padding: '16px 20px' }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.muted }}>{label}</p>
      <p style={{ margin: '6px 0 0', display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 34, fontWeight: 600, color: C.ink, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {unit ? <span style={{ fontSize: 16, color: C.muted }}>{unit}</span> : null}
        {extra ? <span style={{ fontSize: 16, color: C.secondary, marginLeft: 6 }}>{extra}</span> : null}
      </p>
      <p style={{ margin: '4px 0 0', minHeight: 20 }}>{delta}</p>
    </div>
  )
}

const fmtDate = (iso: string) => format(parseISO(iso), "d 'de' MMMM yyyy", { locale: es })
const dot = (color: string) => <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block' }} />

export const AnthropometryReportSheet = forwardRef<HTMLDivElement, AnthropometryReportSheetProps>(function AnthropometryReportSheet(
  { data: d, reading, objective, goals, bodySrc, zoneSummary },
  ref,
) {
  const withDelta = !d.isFirst
  const stage = d.isFirst ? 'Evaluación inicial' : d.measurementNumber != null ? `Control N° ${d.measurementNumber}` : 'Control'
  const goalItems = goals.map((id) => REPORT_GOALS.find((g) => g.id === id)).filter((g): g is NonNullable<typeof g> => g != null)
  const pctText = (v: ReportValue) => (v.value != null ? `${nfReport(v.value)} %` : undefined)

  return (
    <div
      ref={ref}
      style={{
        width: REPORT_SHEET_WIDTH,
        padding: '40px 48px 44px',
        background: '#fff',
        color: C.secondary,
        fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
        boxSizing: 'border-box',
        lineHeight: 1.4,
      }}
    >
      {/* Encabezado */}
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.muted }}>
            {stage} · {fmtDate(d.measuredAt)}
          </p>
          <h1 style={{ margin: '6px 0 0', fontSize: 40, lineHeight: 1.1, fontWeight: 600, letterSpacing: '-0.025em', color: C.ink }}>
            Evaluación antropométrica
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 22, color: C.secondary }}>{d.patientName}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={BRAND_LOGO_COMPACT_PATH} alt="" width={44} height={44} style={{ borderRadius: 10, display: 'block' }} />
          <div style={{ lineHeight: 1.15 }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: C.ink }}>Haciéndolo Hábito</p>
            <p style={{ margin: 0, fontSize: 13, color: C.muted }}>Nutrición · Entrenamiento · Hábitos</p>
          </div>
        </div>
      </header>

      {/* Números principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginTop: 28 }}>
        <Kpi label="Peso" value={nfReport(d.weight.value)} unit="kg" delta={withDelta ? <Delta v={d.weight} unit="kg" /> : null} />
        <Kpi label="Masa grasa" value={nfReport(d.fatKg.value)} unit="kg" extra={pctText(d.fatPct)} delta={withDelta ? <Delta v={d.fatKg} unit="kg" /> : null} />
        <Kpi
          label="Masa muscular"
          value={nfReport(d.muscleKg.value)}
          unit="kg"
          extra={pctText(d.musclePct)}
          delta={withDelta ? <Delta v={d.muscleKg} unit="kg" /> : null}
        />
        <Kpi label="IMC" value={nfReport(d.bmi.value)} unit="kg/m²" delta={withDelta ? <Delta v={d.bmi} /> : null} />
        <Kpi label="Suma de 6 pliegues" value={nfReport(d.sum6.value)} unit="mm" delta={withDelta ? <Delta v={d.sum6} unit="mm" /> : null} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr 1fr 1fr', gap: 16, marginTop: 16, alignItems: 'start' }}>
        {/* Cuerpo y datos básicos */}
        <section style={{ ...card, overflow: 'hidden' }}>
          <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.panel, padding: '16px 0' }}>
            {bodySrc ? <img src={bodySrc} alt="" style={{ height: '100%', width: 'auto', display: 'block' }} /> : <User size={150} strokeWidth={1} color="#d6d0dc" />}
          </div>
          {zoneSummary && withDelta ? (
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '4px 14px', padding: '10px 14px 0', fontSize: 13, color: C.secondary }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{dot(C.good)} {zoneSummary.good} mejoraron</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{dot(C.bad)} {zoneSummary.bad} empeoraron</span>
              {zoneSummary.alert ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{dot('#f0c070')} {zoneSummary.alert} a revisar</span>
              ) : null}
            </div>
          ) : null}
          <div style={{ padding: '8px 20px 10px' }}>
            <Line label="Edad" value={d.age != null ? `${d.age} años` : '—'} />
            <Line label="Talla" value={d.height != null ? `${nfReport(d.height, 1)} cm` : '—'} />
            <Line label="Talla sentada" value={d.sittingHeight != null ? `${nfReport(d.sittingHeight, 1)} cm` : '—'} />
          </div>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <Card title="Pliegues cutáneos" unit="mm">
            <Rows rows={d.skinfolds} withDelta={withDelta} />
            <Line label="Suma total" value={nfReport(d.sum6.value)} delta={withDelta ? <Delta v={d.sum6} /> : undefined} strong />
          </Card>
        </div>

        <Card title="Perímetros" unit="cm">
          <Rows rows={d.perimeters} withDelta={withDelta} />
        </Card>

        <div style={{ display: 'grid', gap: 16 }}>
          <Card title="Índices y relaciones">
            <Line label="Cintura / cadera" value={nfReport(d.waistHip.value)} delta={withDelta ? <Delta v={d.waistHip} /> : undefined} />
            <Line label="Cintura / talla" value={nfReport(d.waistHeight.value)} delta={withDelta ? <Delta v={d.waistHeight} /> : undefined} />
            <Line
              label="Somatotipo"
              delta={withDelta ? null : undefined}
              sub={d.somatotype ? somatotypeName(d.somatotype) : 'Faltan datos para calcularlo'}
              value={d.somatotype ? `${nfReport(d.somatotype.endo, 1)} · ${nfReport(d.somatotype.meso, 1)} · ${nfReport(d.somatotype.ecto, 1)}` : '—'}
            />
          </Card>
          <Card title="Diámetros" unit="cm">
            <Rows rows={d.diameters} withDelta={false} />
          </Card>
        </div>
      </div>

      {withDelta && d.previousMeasuredAt ? (
        <p style={{ margin: '12px 2px 0', fontSize: 14, color: C.muted }}>
          Cambios respecto del control{d.previousNumber != null ? ` N° ${d.previousNumber}` : ''} del {fmtDate(d.previousMeasuredAt)}.{' '}
          <span style={{ color: C.good }}>Verde</span>: va en la dirección buscada. <span style={{ color: C.bad }}>Rojo</span>: en la contraria. Gris: se
          informa sin juicio.
        </p>
      ) : null}

      {/* Lectura y objetivo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 16, marginTop: 16, alignItems: 'stretch' }}>
        <section style={{ ...card, padding: '22px 26px 24px' }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: C.ink }}>Lectura de la evaluación</h3>
          <div style={{ marginTop: 12, display: 'grid', gap: 10, fontSize: 18, lineHeight: 1.55 }}>
            {reading
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
              .map((l, i) => (
                <p key={i} style={{ margin: 0 }}>
                  <Markdown text={l} />
                </p>
              ))}
          </div>
        </section>
        <section style={{ ...card, padding: '22px 26px 24px', background: C.panel }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: C.ink }}>Objetivo</h3>
          <p style={{ margin: '12px 0 0', fontSize: 18, lineHeight: 1.55 }}>
            <Markdown text={objective} />
          </p>
          {goalItems.length ? (
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: `repeat(${goalItems.length}, 1fr)`, gap: 10 }}>
              {goalItems.map((g) => {
                const Icon = GOAL_ICON[g.id] ?? Target
                return (
                  <div
                    key={g.id}
                    style={{
                      ...card,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '14px 14px 16px',
                    }}
                  >
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: C.elevated,
                        color: C.ink,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={19} strokeWidth={1.8} />
                    </span>
                    <span style={{ fontSize: 15, lineHeight: 1.3, color: C.ink }}>{g.label}</span>
                  </div>
                )
              })}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
})
