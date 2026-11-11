/** Stable positions in the photographic contact sheets (3 × 3 each). */
export const MOVEMENT_ART = [
  'pushup', 'side-plank', 'bench-press', 'step-pushup', 'split-press', 'plank', 'close-pushup', 'overhead-press', 'curl',
  'bulgarian', 'landmine-rotation', 'squat', 'jump', 'landmine-squat', 'box-jump', 'ab-wheel', 'hip-thrust', 'lunge',
  'inverted-row', 'pallof', 'deadlift', 'trx-row', 'trap-deadlift', 'thruster', 'renegade-row', 'row', 'running',
] as const

export type MovementArt = typeof MOVEMENT_ART[number]
export type Athlete = 'male' | 'female'

export function routineAthlete(gender: string | null | undefined): Athlete | null {
  const value = gender?.trim().toLowerCase()
  if (value === 'm' || value === 'masculino' || value === 'male') return 'male'
  if (value === 'f' || value === 'femenino' || value === 'female') return 'female'
  return null
}

/** Specific variants must precede their broader exercise families. Unknowns stay neutral. */
export function movementArt(name: string | null | undefined): MovementArt | null {
  const n = (name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/remo.*plancha|renegade/.test(n)) return 'renegade-row'
  if (/hexagonal|trap.?bar/.test(n)) return 'trap-deadlift'
  if (/landmine/.test(n) && /rotacion|giro/.test(n)) return 'landmine-rotation'
  if (/landmine/.test(n) && /sentadilla|squat|gemelo/.test(n)) return 'landmine-squat'
  if (/pall\s*o[f]+/.test(n)) return 'pallof'
  if (/autraliana|australiana|inverted.?row/.test(n)) return 'inverted-row'
  if (/remo/.test(n) && /trx|rtx|suspension/.test(n)) return 'trx-row'
  if (/thruster/.test(n)) return 'thruster'
  if (/press/.test(n) && /split/.test(n)) return 'split-press'
  if (/press.*banca|bench.?press/.test(n)) return 'bench-press'
  if (/flexion|push.?up/.test(n) && /step|inclinad|elevad/.test(n)) return 'step-pushup'
  if (/flexion|push.?up/.test(n) && /cerrad|diamante|close/.test(n)) return 'close-pushup'
  if (/flexion|push.?up/.test(n)) return 'pushup'
  if (/plancha.*lateral|side.?plank/.test(n)) return 'side-plank'
  if (/plancha|plank/.test(n)) return 'plank'
  if (/ruedita|rueda.*abdominal|ab.?wheel/.test(n)) return 'ab-wheel'
  if (/bulgara|bulgarian/.test(n)) return 'bulgarian'
  if (/salto.*cajon|box.?jump/.test(n)) return 'box-jump'
  if (/salto|pliometr|squat.?jump/.test(n)) return 'jump'
  if (/peso.?muerto|deadlift|\brdl\b/.test(n)) return 'deadlift'
  if (/sentadilla|squat/.test(n)) return 'squat'
  if (/hip.?thrust/.test(n)) return 'hip-thrust'
  if (/estocada|zancada|lunge/.test(n)) return 'lunge'
  if (/remo|dumbbell.?row/.test(n)) return 'row'
  if (/press.*militar|overhead.?press|press.*hombro/.test(n)) return 'overhead-press'
  if (/curl.*bicep|bicep.*curl/.test(n)) return 'curl'
  if (/carrera|trote|running|skipping/.test(n)) return 'running'
  return null
}

export function movementArtwork(name: string | null | undefined, athlete: Athlete | null) {
  const movement = movementArt(name)
  if (!athlete || !movement) return null
  const index = MOVEMENT_ART.indexOf(movement)
  const cell = index % 9
  return {
    movement,
    url: `/routine/${athlete}-${Math.floor(index / 9) + 1}.webp`,
    position: `${(cell % 3) * 50}% ${Math.floor(cell / 3) * 50}%`,
  }
}
