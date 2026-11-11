/** Partículas que van en minúscula salvo al principio («María de la Paz», «Van Dijk» al inicio). */
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'das', 'do', 'dos', 'di', 'van', 'von'])

/** Primera letra en mayúscula y el resto en minúscula, también en partes con guion o apóstrofo («María-José», «D'Angelo»). */
function capitalize(word: string): string {
  return word
    .toLocaleLowerCase('es')
    .replace(/(^|[-'’])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase('es'))
}

/** Palabra escrita toda en mayúscula o toda en minúscula (las mezcladas, como «McDonald», se respetan). */
function needsFix(word: string): boolean {
  const hasLetter = /\p{L}/u.test(word)
  if (!hasLetter) return false
  const lower = word.toLocaleLowerCase('es')
  const upper = word.toLocaleUpperCase('es')
  // Números romanos («Juan Pablo II») quedan en mayúscula.
  if (word === upper && /^(II|III|IV|VI|VII|VIII|IX|XI|XII)$/.test(word)) return false
  return word === lower || (word === upper && word.length > 1)
}

/**
 * Nombre de persona con el formato de los demás: «TOMAS FERSTER» → «Tomas Ferster»,
 * «bianca anabela trofelli» → «Bianca Anabela Trofelli». Mismo criterio que la función
 * `hh_normalize_person_name` de la base (20261111130000_student_name_case.sql).
 */
export function normalizePersonName(raw: string): string {
  const words = raw.trim().split(/\s+/).filter(Boolean)
  return words
    .map((w, i) => {
      if (!needsFix(w)) return w
      const lower = w.toLocaleLowerCase('es')
      if (i > 0 && PARTICLES.has(lower)) return lower
      return capitalize(w)
    })
    .join(' ')
}
