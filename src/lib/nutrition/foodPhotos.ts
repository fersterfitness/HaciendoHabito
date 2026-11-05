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
  '1494597564530-871f2b93ac55',
  '1495214783159-3503fd1b572d',
  '1506084868230-bb9d95c24759',
  '1528207776546-365bb710ee93',
  '1562376552-0d160a2f238d',
  '1571748982800-fa51082c2224',
  '1588137378633-dea1336ce1e2',
  '1505576633757-0ac1084af824',
]

const SNACK = [
  '1490474418585-ba9bad8fd0ea',
  '1488477181946-6428a0291777',
  '1553530666-ba11a7da3888',
  '1610832958506-aa56368176cf',
  '1505576399279-565b52d4ac71',
  '1505252585461-04db1eb84625',
  '1519996529931-28324d5a630e',
  '1568702846914-96b305d2aaeb',
  '1571771894821-ce9b6c11b08e',
  '1508061253366-f7da158b6d46',
  '1544787219-7f47ccb76574',
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
  '1484980972926-edee96e0960d',
  '1485921325833-c519f76c4927',
  '1505253716362-afaea1d3d1af',
  '1505253758473-96b7015fcd40',
  '1514516345957-556ca7d90a29',
  '1516100882582-96c3a05fe590',
  '1532550907401-a500c9a57435',
  '1540420773420-3366772f4999',
  '1546964124-0cce460f38ef',
  '1547496502-affa22d38842',
  '1551183053-bf91a1d81141',
  '1580476262798-bddd9f4b7369',
  '1589302168068-964664d93dc0',
  '1603105037880-880cd4edfb0d',
  '1603133872878-684f208fb84b',
  '1607532941433-304659e8198a',
  '1623428187969-5da2dcea5ebf',
  '1606728035253-49e8a23146de',
]

/** Por contenido: palabra clave → fotos posibles. */
const BY_KEYWORD: [RegExp, string[]][] = [
  [/\b(salmon|pescado|merluza|atun|trucha|abadejo|lenguado|brotola)/, ['1467003909585-2f8a72700288', '1519708227418-c8fd9a32b7a2', '1574484284002-952d92456975', '1485921325833-c519f76c4927', '1580476262798-bddd9f4b7369', '1611171711912-e3f6b536f532']],
  [/\b(pollo|pechuga|suprema|pata muslo)/, ['1598515214211-89d3c73ae83b', '1532550907401-a500c9a57435', '1606728035253-49e8a23146de']],
  [/\b(albondiga|hamburguesa casera)/, ['1529042410759-befb1204b468']],
  [/\b(carne|lomo|vacio|bife|cerdo|nalga|peceto|cuadril|entrana|bola de lomo)/, ['1432139555190-58524dae6a55', '1504674900247-0877df9cc836', '1546964124-0cce460f38ef', '1558030006-450675393462']],
  [/\b(tofu|seitan)/, ['1604908176997-125f25cc6f3d']],
  [/\b(fideo|pasta|noqui|tallarin|spaghetti|espagueti|tirabuzon|mostachol|penne|raviol)/, ['1473093295043-cdd812d0e601', '1621996346565-e3dbc646d9a9', '1516100882582-96c3a05fe590', '1551183053-bf91a1d81141', '1555949258-eb67b1ef0ceb', '1563379926898-05f4575a45d8']],
  [/\b(arroz|wok|risotto|quinoa)/, ['1512058564366-18510be2db19', '1590301157890-4810ed352733', '1589302168068-964664d93dc0', '1603133872878-684f208fb84b', '1536304993881-ff6e9eefa2a6']],
  [/\b(sopa|caldo|crema de|guiso)/, ['1476718406336-bb5a9690ee2a', '1603105037880-880cd4edfb0d', '1594756202469-9ff9799b2e4e']],
  [/\b(wrap|fajita)/, ['1551504734-5ee1c4a1479b', '1626700051175-6818013e1d4f']],
  [/\b(taco)/, ['1565299585323-38d6b0865b47', '1551504734-5ee1c4a1479b']],
  [/\b(pizza|pizzeta)/, ['1574071318508-1cdbab80d002']],
  [/\b(sandwich|sanguche|tostado)/, ['1553909489-cd47e0907980', '1528735602780-2552fd46c7af']],
  [/\b(ensalada de frutas|macedonia)/, ['1519996529931-28324d5a630e', '1490474418585-ba9bad8fd0ea']],
  [/\b(ensalada)/, ['1512621776951-a57141f2eefd', '1546793665-c74683f339c1', '1540189549336-e6e99c3679fe', '1515543237350-b3eea1ec8082', '1511690743698-d9d85f2fbf38', '1505253716362-afaea1d3d1af', '1514516345957-556ca7d90a29', '1540420773420-3366772f4999', '1607532941433-304659e8198a']],
  [/\b(panqueque|pancake|hotcake)/, ['1567620905732-2d1ec7ab7445', '1506084868230-bb9d95c24759', '1528207776546-365bb710ee93']],
  [/\b(waffle|wafle)/, ['1562376552-0d160a2f238d']],
  [/\b(avena|porridge|overnight)/, ['1571748982800-fa51082c2224', '1494597564530-871f2b93ac55']],
  [/\b(huevo|omelette|omelet|revuelto)/, ['1482049016688-2d3e1b311543', '1525351484163-7529414344d8', '1533089860892-a7c6f0a88666']],
  [/\b(yogur|granola)/, ['1488477181946-6428a0291777', '1494597564530-871f2b93ac55']],
  [/\b(licuado|batido|smoothie)/, ['1553530666-ba11a7da3888', '1505252585461-04db1eb84625']],
  [/\b(palta)/, ['1588137378633-dea1336ce1e2', '1541519227354-08fa5d50c44d']],
  [/\b(tostada|pan )/, ['1541519227354-08fa5d50c44d', '1525351484163-7529414344d8', '1588137378633-dea1336ce1e2']],
  [/\b(almendra|nuez|nueces|frutos secos|mani |castana)/, ['1508061253366-f7da158b6d46']],
  [/\b(manzana)/, ['1568702846914-96b305d2aaeb']],
  [/\b(banana)/, ['1571771894821-ce9b6c11b08e']],
  [/\b(fruta|pera|mandarina|kiwi|naranja|frutilla|frutos rojos)/, ['1490474418585-ba9bad8fd0ea', '1610832958506-aa56368176cf', '1519996529931-28324d5a630e']],
  [/\b(mate|yerba)/, ['1585744259332-111384f5def9', '1609541994821-d909982e2f1b', '1662628325105-abdc437c2903', '1687920492018-e21cad9023d9', '1784475844948-e9abada34215']],
  [/\b(te |infusion)/, ['1564890369478-c89ca6d9cde9', '1544787219-7f47ccb76574']],
  [/\b(cafe)/, ['1495474472287-4d71bcdd2085', '1509042239860-f550ce710b93']],
  [/\b(leche)/, ['1550583724-b2692b85b150']],
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
