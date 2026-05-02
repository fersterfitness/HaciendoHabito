/**
 * Macros por 100 g de referencia para filas del plan tipo Excel (HC, P, G, kcal).
 */
import { FOOD_CATALOG_ES, type FoodCatalogItemEs } from '@/lib/nutrition/foodCatalogEs'

export type Ref100 = Readonly<{ c: number; p: number; f: number; k: number }>

const ZERO: Ref100 = { c: 0, p: 0, f: 0, k: 0 }

function fr(f: FoodCatalogItemEs): Ref100 {
  return {
    c: f.carbs_g_per_100g,
    p: f.protein_g_per_100g,
    f: f.fat_g_per_100g,
    k: f.energy_kcal_per_100g,
  }
}

function byId(id: string): FoodCatalogItemEs {
  const x = FOOD_CATALOG_ES.find((e) => e.id === id)
  if (!x) throw new Error(`foodCatalogEs missing id: ${id}`)
  return x
}

/** El primer match gana (orden de mayor a menor especificidad). */
const MATCHERS: ReadonlyArray<{ test: RegExp; ref: Ref100 }> = [
  { test: /suprema/i, ref: fr(byId('pollo-pechuga-cocida')) },
  {
    test: /lomo de vaca|colita de cuadril|tapa de nalga|roast\s*beff|roast beef/i,
    ref: fr(byId('carne-vacuna-magrasada')),
  },
  { test: /lomo de cerdo|solomillo/i, ref: fr(byId('cerdo-lomo-magro')) },
  { test: /atún de pescader/i, ref: fr(byId('pescado-blanco')) },
  { test: /lata.*atún|lomitos/i, ref: fr(byId('atun-lata-agua')) },
  { test: /\bsalm[oó]n\b/i, ref: { c: 0, p: 20, f: 13, k: 206 } },
  { test: /clara de huevo/i, ref: fr(byId('clara-huevo')) },
  { test: /yema de huevo/i, ref: { c: 0.7, p: 16.4, f: 27.7, k: 322 } },
  { test: /whey|gentech/i, ref: { c: 5, p: 75, f: 5, k: 380 } },

  { test: /leche zero lactosa|descremada/i, ref: fr(byId('leche-descremada')) },
  { test: /\bleche\b/i, ref: fr(byId('leche-entera')) },

  {
    test: /^ricotta magra|cousine|queso cremoso .*d[ií]a|serenisim.*light|tregar|Tregar/i,
    ref: fr(byId('queso-blanco-descremado')),
  },
  { test: /yogh?urt|\byogur\b/i, ref: fr(byId('yogur-natural')) },
  { test: /queso cremoso.*light|port salut|finlandia|cheddar|cuisin.*co|\bcousine\b/i, ref: fr(byId('queso-cremoso')) },
  { test: /\bqueso cremoso\b|\bricotta\b/i, ref: fr(byId('queso-cremoso')) },
  { test: /jam[oó]n cocido/i, ref: { c: 1, p: 18, f: 3, k: 100 } },

  { test: /^harina|harina de|harina /i, ref: { c: 60, p: 10, f: 3, k: 350 } },
  { test: /\bavena\b/i, ref: fr(byId('avena-hojuela')) },
  { test: /quinoa inflada/i, ref: { c: 70, p: 12, f: 5, k: 380 } },
  { test: /\bquinoa\b(?!.*infl)/i, ref: { c: 64, p: 14, f: 6, k: 368 } },

  { test: /^lentejas\b/i, ref: fr(byId('lentejas-cocidas')) },
  { test: /porotos|jud[ií]as|garbanzos/i, ref: fr(byId('garbanzos-cocidos')) },
  { test: /arvejas|guisantes|chicharos/i, ref: { c: 16, p: 5.4, f: 0.2, k: 81 } },
  { test: /lupines/i, ref: { c: 10, p: 16, f: 2.9, k: 120 } },
  { test: /soja texturizada/i, ref: { c: 30, p: 50, f: 1, k: 320 } },
  { test: /^maní\b|Maní\b|cacahu/i, ref: fr(byId('mani')) },

  { test: /\bpapa\b/i, ref: fr(byId('papa-cocida')) },
  { test: /batata|camote|boniat/i, ref: fr(byId('batata-cocida')) },
  { test: /r[aá]banito|zanahori/i, ref: { c: 4, p: 0.9, f: 0.2, k: 20 } },

  { test: /arroz blanco|yaman[ií]/i, ref: fr(byId('arroz-blanco-cocido')) },
  { test: /arroz integral/i, ref: { c: 23, p: 2.7, f: 0.9, k: 111 } },
  {
    test: /\bfideos|ñoquis|spaghetti|penne|matarazzo|libre de gluten|crepes|^r crepes|ciabatta/i,
    ref: fr(byId('fideos-secos-cocidos')),
  },

  { test: /galletas de arroz|galletitas|mini arrocitas|pan lactal|pan salvado|molino natural/i, ref: fr(byId('pan-miga')) },

  { test: /\baceite\b.*cucharada|cuchara.*aceite|aceite \(\s*cuchara/i, ref: fr(byId('aceite-oliva')) },
  { test: /semillas|lino|ch[ií]a|girasol|amaranto|calabaza|sésamo|sesamo/i, ref: { c: 20, p: 20, f: 45, k: 550 } },
  { test: /nueces mariposa|\bnueces\b/i, ref: fr(byId('nueces')) },
  { test: /casta[ñn]as/i, ref: { c: 28, p: 2.4, f: 0.8, k: 130 } },
  { test: /almendra/i, ref: fr(byId('almendras')) },
  { test: /\bpalta\b|aguacate/i, ref: fr(byId('palta')) },
  { test: /aceitunas/i, ref: { c: 4.2, p: 0.8, f: 10.9, k: 115 } },
  { test: /pasa de uva/i, ref: { c: 64, p: 2.5, f: 0.4, k: 270 } },

  { test: /naranja/i, ref: fr(byId('naranja')) },
  { test: /mandarina/i, ref: { c: 13, p: 0.8, f: 0.3, k: 53 } },
  { test: /manzana/i, ref: fr(byId('manzana')) },
  { test: /frutillas/i, ref: { c: 8, p: 0.7, f: 0.3, k: 32 } },
  { test: /banana/i, ref: fr(byId('banana')) },
  { test: /durazno|\bpera\b/i, ref: { c: 11, p: 0.9, f: 0.2, k: 43 } },
  { test: /ar[aá]ndanos/i, ref: { c: 14, p: 0.7, f: 0.3, k: 57 } },

  { test: /\bdulce de leche\b/i, ref: { c: 54, p: 6.8, f: 8, k: 320 } },
  { test: /\bpolenta\b/i, ref: { c: 78, p: 8, f: 3, k: 360 } },
  { test: /seit[aá]n/i, ref: { c: 14, p: 24, f: 1.9, k: 194 } },
  { test: /crema de man[ií]|nutella|nesquick/i, ref: { c: 20, p: 25, f: 50, k: 600 } },
  { test: /\bcacao\b|diocomere/i, ref: fr(byId('cacao-polvo-desgrasado')) },
  { test: /\bcanela\b/i, ref: { c: 80, p: 4, f: 1.2, k: 247 } },
  { test: /cereales sin az[uú]car/i, ref: { c: 70, p: 10, f: 4, k: 350 } },

  { test: /\bmiel\b/i, ref: fr(byId('miel')) },
  { test: /\bketchup\b/i, ref: { c: 25, p: 1, f: 0.2, k: 100 } },
  { test: /levadura\s*nutrileva/i, ref: { c: 37, p: 50, f: 6, k: 328 } },
  { test: /germ[eé]n de trigo/i, ref: { c: 53, p: 12, f: 2.4, k: 280 } },
  { test: /\bzucchini\b|calabac[ií]n|\bcalabac\b/i, ref: { c: 3.3, p: 1.2, f: 0.2, k: 18 } },
]

function catalogFuzzy(name: string): Ref100 | null {
  const n = name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  let best: FoodCatalogItemEs | undefined
  let bestScore = 0
  const stop = new Set(['de', 'la', 'el', 'y', 'en', 'unidad', 'gramos'])

  const words = n.split(/[\s()/"%.]+/).filter((w) => w.length > 3 && !stop.has(w))
  for (const cat of FOOD_CATALOG_ES) {
    const fn = cat.nombre.toLowerCase()
    let score = 0
    for (const w of words) {
      if (fn.includes(w)) score += 2
    }
    if (fn.length > 6 && (n.includes(fn) || fn.includes(n.slice(0, 14)))) score += 5
    if (score > bestScore) {
      bestScore = score
      best = cat
    }
  }
  if (best && bestScore >= 6) return fr(best)
  return null
}

export function resolveRefForPlanningRow(name: string): Ref100 {
  const trimmed = name.trim()
  if (!trimmed) return ZERO

  for (const { test, ref } of MATCHERS) {
    if (test.test(trimmed)) return ref
  }

  return catalogFuzzy(trimmed) ?? ZERO
}
