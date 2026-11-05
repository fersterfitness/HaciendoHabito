/**
 * Fotos automáticas para planes y comidas (v2): se eligen por lo que dice la comida
 * (salmón, ensalada, yogur…) y, si no hay coincidencia, por el tipo de comida.
 * Siempre la misma foto para el mismo plan/comida (elección por semilla, sin azar).
 * Banco curado de Unsplash (permitido en la CSP: images.unsplash.com).
 */

const BREAKFAST = [
  '1482049016688-2d3e1b311543',
  '1484723091739-30a097e8f929',
  '1494390248081-4e521a5940db',
  '1525351484163-7529414344d8',
  '1533089860892-a7c6f0a88666',
  '1541519227354-08fa5d50c44d',
  '1567620905732-2d1ec7ab7445',
]

const SNACK = [
  '1490474418585-ba9bad8fd0ea',
  '1488477181946-6428a0291777',
  '1553530666-ba11a7da3888',
  '1610832958506-aa56368176cf',
  '1505576399279-565b52d4ac71',
]

const MAIN = [
  '1432139555190-58524dae6a55',
  '1467003909585-2f8a72700288',
  '1473093295043-cdd812d0e601',
  '1490645935967-10de6ba17061',
  '1504674900247-0877df9cc836',
  '1512058564366-18510be2db19',
  '1512621776951-a57141f2eefd',
  '1540189549336-e6e99c3679fe',
  '1543339308-43e59d6b73a6',
  '1546069901-ba9599a7e63c',
  '1546793665-c74683f339c1',
  '1547592180-85f173990554',
  '1590301157890-4810ed352733',
  '1598515214211-89d3c73ae83b',
  '1604908176997-125f25cc6f3d',
  '1559847844-5315695dadae',
]

/** Por contenido: palabra clave → fotos posibles. */
const BY_KEYWORD: [RegExp, string[]][] = [
  [/\b(salmon|pescado|merluza|atun|trucha|abadejo)/, ['1467003909585-2f8a72700288', '1519708227418-c8fd9a32b7a2', '1574484284002-952d92456975']],
  [/\b(pollo|pechuga|suprema)/, ['1598515214211-89d3c73ae83b']],
  [/\b(carne|lomo|vacio|bife|cerdo|nalga|peceto|cuadril)/, ['1432139555190-58524dae6a55', '1504674900247-0877df9cc836']],
  [/\b(tofu|seitan)/, ['1604908176997-125f25cc6f3d']],
  [/\b(fideo|pasta|nnoqui|noqui|tallarin|spaghetti|espagueti)/, ['1473093295043-cdd812d0e601', '1621996346565-e3dbc646d9a9']],
  [/\b(arroz|wok|risotto|quinoa)/, ['1512058564366-18510be2db19', '1590301157890-4810ed352733']],
  [/\b(sopa|caldo|crema de)/, ['1476718406336-bb5a9690ee2a']],
  [/\b(wrap|taco|fajita)/, ['1551504734-5ee1c4a1479b']],
  [/\b(ensalada)/, ['1512621776951-a57141f2eefd', '1546793665-c74683f339c1', '1540189549336-e6e99c3679fe', '1515543237350-b3eea1ec8082', '1511690743698-d9d85f2fbf38']],
  [/\b(panqueque|pancake|hotcake)/, ['1567620905732-2d1ec7ab7445']],
  [/\b(huevo|omelette|omelet|revuelto)/, ['1482049016688-2d3e1b311543', '1525351484163-7529414344d8', '1533089860892-a7c6f0a88666']],
  [/\b(yogur|granola)/, ['1488477181946-6428a0291777']],
  [/\b(licuado|batido|smoothie)/, ['1553530666-ba11a7da3888']],
  [/\b(tostada|pan |palta)/, ['1541519227354-08fa5d50c44d', '1525351484163-7529414344d8']],
  [/\b(fruta|manzana|banana|pera|mandarina|kiwi|naranja|frutilla|frutos rojos)/, ['1490474418585-ba9bad8fd0ea', '1610832958506-aa56368176cf']],
  [/\b(cafe|te |mate)/, ['1495474472287-4d71bcdd2085', '1509042239860-f550ce710b93']],
]

function normalize(s: string): string {
  return ` ${s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\*+/g, '').toLowerCase()} `
}

function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pick(list: string[], seed: string): string {
  return list[hash(seed) % list.length]
}

/** Gana lo que aparece primero en el texto («Ensalada con atún» → ensalada; «Salmón con ensalada» → salmón). */
function byKeyword(text: string, seed: string): string | null {
  const t = normalize(text)
  let best: { at: number; ids: string[] } | null = null
  for (const [re, ids] of BY_KEYWORD) {
    const at = t.search(re)
    if (at >= 0 && (!best || at < best.at)) best = { at, ids }
  }
  return best ? pick(best.ids, seed) : null
}

function poolForMeal(label: string): string[] {
  const l = normalize(label)
  if (/desayuno|merienda/.test(l)) return BREAKFAST
  if (/media manana|colacion|snack|pre ?entreno|post ?entreno|intermedia/.test(l)) return SNACK
  return MAIN
}

export function unsplashUrl(id: string, w: number, h: number): string {
  return `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=70`
}

/** Foto de una comida: primero lo que dice el plato principal, después el tipo de comida. */
export function mealPhotoId(label: string, content: string, seed: string): string {
  const first = content.split('\n').find((l) => l.trim()) ?? ''
  return byKeyword(first, seed) ?? byKeyword(content, seed) ?? pick(poolForMeal(label), seed)
}

/** Portada de un plan: la sugiere el almuerzo/cena del primer día; si no hay, una del banco. */
export function planCoverPhotoId(
  seed: string,
  rows: { label: string; columns: string[] }[],
): string {
  const mains = rows.filter((r) => /almuerzo|cena/.test(normalize(r.label)))
  for (const r of [...mains, ...rows]) {
    const text = r.columns.find((c) => c && c.trim()) ?? ''
    const hit = text ? byKeyword(text, seed) : null
    if (hit) return hit
  }
  return pick(MAIN, seed)
}
