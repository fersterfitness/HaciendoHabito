import type { PlanningWorkbookStateV1 } from '@/lib/nutrition/planningWorkbookTypes'

const COLS = ['Super hábit', 'Déficit', 'Recomposición', 'Longevidad'] as const

/** Fila «ajuste» desde la plantilla editable; el resto es referencia tipo planilla (guía general). */
const STATIC_ROWS: { label: string; cells: [string, string, string, string] }[] = [
  {
    label: 'Proteínas',
    cells: [
      'Menor valor a ~1,6–1,8 / 2,0 × g/kg',
      'Alta: ~1,8–2,2 / 2,5 × g/kg en casos extremos',
      'Moderados/altos ~1,8–2,2 × g/kg',
      '~1,6–1,8 × g/kg',
    ],
  },
  {
    label: 'Grasas',
    cells: [
      'Valores normales ~0,8–1,0 × g/kg',
      'Valores normales ~0,8–1,0 × g/kg',
      'Valores normales ~0,8–1,0 × g/kg',
      'Valores normales ~0,8–1,0 × g/kg',
    ],
  },
  {
    label: 'Carbohidratos',
    cells: [
      'Alto ~4–6 × g/kg',
      'Medio ~3–6 × g/kg (según etapa)',
      'Moderado ~3–4 × g/kg',
      'Lo que resta según objetivo',
    ],
  },
  {
    label: '% energía (orient.)',
    cells: [
      'P ~20–25 % · G ~25–30 % · C ~50–55 %',
      'P ~30–35 % · G ~25 % · C ~40–45 %',
      'P ~30–35 % · G ~25 % · C ~40–45 %',
      'P ~20–30 % · G ~30 % · C ~50 %',
    ],
  },
]

export function ObjectivesGuideMatrixTable({ og }: { og: PlanningWorkbookStateV1['objectivesGuide'] }) {
  const ajusteCells: [string, string, string, string] = [
    og.superavitCal,
    og.deficitCal,
    og.recomposicion,
    og.longevidad,
  ]

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-surface-border">
      <table className="w-full min-w-[640px] border-collapse text-left text-xs">
        <caption className="border-b border-surface-border bg-surface-muted/40 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-ink-muted">
          Guía (no es específico: puede variar según deporte y contexto)
        </caption>
        <thead>
          <tr className="border-b border-surface-border bg-surface-muted/25">
            <th className="w-[8.5rem] px-2 py-2 font-semibold text-ink-muted" scope="col" />
            {COLS.map((c) => (
              <th key={c} className="px-2 py-2 font-semibold text-ink-primary border-l border-surface-border/70" scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-surface-border/80 bg-surface-card">
            <th scope="row" className="px-2 py-2 align-top font-semibold text-ink-secondary border-r border-surface-border/60">
              Ajuste calórico
            </th>
            {ajusteCells.map((cell, i) => (
              <td key={i} className="px-2 py-2 align-top text-ink-secondary border-l border-surface-border/50 whitespace-pre-wrap">
                {cell}
              </td>
            ))}
          </tr>
          {STATIC_ROWS.map((row) => (
            <tr key={row.label} className="border-b border-surface-border/80 last:border-b-0 bg-surface-card">
              <th
                scope="row"
                className="px-2 py-2 align-top font-semibold text-ink-secondary border-r border-surface-border/60 whitespace-nowrap"
              >
                {row.label}
              </th>
              {row.cells.map((cell, i) => (
                <td key={i} className="px-2 py-2 align-top text-ink-secondary border-l border-surface-border/50 leading-snug">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-surface-border/70 px-3 py-2 text-[10px] text-ink-muted leading-relaxed bg-surface-muted/15">
        La fila «Ajuste calórico» usa los textos guardados en tu libro; las filas inferiores son una guía general tipo planilla.
      </p>
    </div>
  )
}
