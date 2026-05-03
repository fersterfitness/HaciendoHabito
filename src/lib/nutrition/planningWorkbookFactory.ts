import { EXCEL_PLANNING_BLUEPRINT } from '@/lib/nutrition/excelPlanningBlueprint'
import { resolveRefForPlanningRow } from '@/lib/nutrition/planningRefResolve'
import { DEFAULT_MEAL_DISTRIBUTION, type PlanningWorkbookStateV1 } from '@/lib/nutrition/planningWorkbookTypes'

export function createInitialPlanningWorkbook(): PlanningWorkbookStateV1 {
  return {
    version: 1,
    macroGuide: {
      proteinPerKgHint: '1,6–2,2 g/kg peso corporal',
      carbPerKgHint: '3–6 g/kg peso corporal',
      fatPerKgHint: '0,8–1,0 g/kg peso corporal',
      contextNote:
        'Son estimaciones: el contexto, el volumen de entrenamiento y la etapa modifican estos rangos.',
    },
    objectivesGuide: {
      superavitCal: 'Superávit: +200–300 kcal sobre mantenimiento (orientativo).',
      deficitCal: 'Déficit: −200–500 kcal según momento y deporte (orientativo).',
      recomposicion: 'Recomposición: ajustes mínimos alrededor del mantenimiento.',
      longevidad: 'Otros objetivos (salud, longevidad, rendimiento específico): ajustá con profesional.',
      proteinasPorObjetivo:
        'Proteínas: menor ronda ~1,6–1,8 g/kg hasta ~2 g/kg · cargas más altas 1,8–2,2 g/kg hasta 2,5 g/kg solo en casos puntuales · moderados/altos habitualmente ~1,8–2,2 g/kg.',
      grasasPorObjetivo: 'Grasas: habitualmente ~0,8–1,0 g/kg en la mayoría de enfoques (orientativo).',
      carbosPorObjetivo:
        'Carbohidratos: rangos típicos en superávit más alto ~4–6 g/kg · en déficit medio ~3–6 g/kg según etapa · recomposición moderada ~3–4 g/kg.',
      pctDistribicion:
        '% de kcal (referencia muy variable): ejemplo superávit P ~20–25% · G ~25–30% · C ~50–55%. Déficit / recomposición a veces ~P 30–35% · G ~25% · C ~40–45%.',
    },
    person: {
      tdeeMale: '',
      tdeeFemale: '',
      sex: '',
      weightKg: '',
    },
    personReferenceStudentId: null,
    objectives: '',
    proposedKcal: '',
    macroInputs: {
      proteinGPerKg: '1.8',
      carbGPerKg: '4',
      fatGPerKg: '0.9',
    },
    libraryQtyDraft: {},
    libraryFoodRefsById: {},
    mealDistribution: { ...DEFAULT_MEAL_DISTRIBUTION },
    sections: EXCEL_PLANNING_BLUEPRINT.map((sec) => ({
      key: sec.key,
      title: sec.title,
      quantityColumnHint: sec.quantityColumnHint,
      rows: sec.rows.map((r, ri) => {
        const ref = resolveRefForPlanningRow(r.name)
        return {
          id: `${sec.key}-${ri}`,
          name: r.name,
          hint: r.hint,
          qtyG: '',
          refCarbs: ref.c.toString(),
          refProt: ref.p.toString(),
          refFat: ref.f.toString(),
          refKcal: ref.k.toString(),
        }
      }),
    })),
  }
}
