import type { MuscleId } from './trainingVolume'

/**
 * Músculo(s) de una molestia del check-in, a partir de lo que escribió el alumno («me molesta el
 * hombro derecho», «dolor lumbar»). Es texto libre: si no se reconoce ninguna zona, devuelve [].
 * Las articulaciones van al músculo que más se entrena alrededor (rodilla → cuádriceps).
 */
const RULES: { re: RegExp; muscle: MuscleId }[] = [
  { re: /deltoides? post|hombro post|posterior del hombro/, muscle: 'deltoide_post' },
  { re: /isquio|femoral|posterior del muslo|parte de atras del muslo/, muscle: 'femoral' },
  { re: /cuadri|rodilla|patel|rotula|muslo/, muscle: 'cuadriceps' },
  { re: /glute|nalga|cola\b|cadera/, muscle: 'gluteo' },
  { re: /aductor|ingle|entrepierna/, muscle: 'aductores' },
  { re: /pecho|pector/, muscle: 'pecho' },
  { re: /hombro|deltoid|manguito/, muscle: 'deltoides' },
  { re: /trapecio|cuello|cervical/, muscle: 'trapecio' },
  { re: /espalda|lumbar|dorsal|columna|cintura/, muscle: 'espalda' },
  { re: /bicep/, muscle: 'biceps' },
  { re: /tricep|codo/, muscle: 'triceps' },
  { re: /gemelo|pantorrilla|soleo|tobillo|aquiles/, muscle: 'gemelos' },
  { re: /abdom|panza|oblicuo/, muscle: 'abdominales' },
]

export function painMuscles(note: string): MuscleId[] {
  const t = note
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  const out: MuscleId[] = []
  for (const r of RULES) {
    if (!r.re.test(t) || out.includes(r.muscle)) continue
    // «hombro posterior» ya es deltoide posterior: no sumar también el deltoides.
    if (r.muscle === 'deltoides' && out.includes('deltoide_post')) continue
    // «posterior del muslo» es femoral, no cuádriceps.
    if (r.muscle === 'cuadriceps' && out.includes('femoral') && !/cuadri|rodilla|patel|rotula/.test(t)) continue
    out.push(r.muscle)
  }
  return out
}
