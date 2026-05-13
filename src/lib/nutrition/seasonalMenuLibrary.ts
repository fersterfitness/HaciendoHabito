/**
 * Plantillas iniciales de menús (invierno / verano) con foco en patologías frecuentes.
 * Son bases para que el profesional adapte por paciente; se pueden ampliar o migrar a base de datos.
 */

export type MenuSeason = 'invierno' | 'verano'

export type SeasonalMenuTemplate = {
  id: string
  season: MenuSeason
  title: string
  /** Etiquetas para filtrar (Hashimoto, celiaquía, SIBO, etc.). */
  tags: string[]
  /** Contenido en Markdown simple. */
  bodyMd: string
}

export const SEASONAL_MENU_TEMPLATES: SeasonalMenuTemplate[] = [
  {
    id: 'invierno-base-digestivo',
    season: 'invierno',
    title: 'Invierno · base tolerancia digestiva moderada',
    tags: ['invierno', 'gastritis leve', 'colon irritable', 'porciones'],
    bodyMd: `### Objetivo
Base equilibrada con platos calientes, pocas frituras y fibra progresiva. **Ajustar por paciente.**

### Desayuno (~420 kcal)
- Avena **40 g** (4 cucharadas soperas rasas) cocida en agua o leche sin lactosa según tolerancia.
- Semillas de lino molido **1 cucharadita** (≈5 g).
- Fruta cocida manzana/pera **½ unidad mediana** o banana **½ unidad**.
- Infusión digestiva (tilo, menta) sin azúcar.

### Almuerzo (~550 kcal)
- Caldo de verduras **1 taza** (250 ml).
- Pollo al horno **120–150 g** (pieza del tamaño de la palma sin dedos) + papa **1 mediana** (≈150 g) o zapallo **1 taza** (150 g).
- Ensalada de hojas verdes **1 plato chico** con aceite de oliva **1 cucharadita**.

### Merienda (~200 kcal)
- Yogur natural o sin lactosa **170 g** (1 pote chico) o alternativa vegetal con **proteína similar**.
- **10–12 almendras** (15 g).

### Cena (~450 kcal)
- Pescado blanco **120 g** + puré de zapallo o calabaza **1 taza**.
- Verdura al vapor **1 taza**.

### Notas clínicas (marcar según caso)
- **Celiaquía**: reemplazar avena por mezcla certificada sin TACC; verificar rotulación de todos los alimentos.
- **Hashimoto**: sin cambios estructurales obligatorios; modular yodo/ultraprocesados según criterio profesional.
- **SIBO / FODMAP**: reducir avena/fructanos según fase; usar alternativas permitidas en la fase activa.
`,
  },
  {
    id: 'verano-base-hidratacion',
    season: 'verano',
    title: 'Verano · hidratación y platos frescos',
    tags: ['verano', 'SIBO', 'intolerancias', 'porciones'],
    bodyMd: `### Objetivo
Platos frescos, hidratación y proteína repartida. **Ajustar por paciente y patología.**

### Desayuno (~380 kcal)
- Licuado: yogurt o bebida vegetal **200 ml** + frutos rojos **½ taza** + avena sin TACC si aplica **30 g** (3 cucharadas soperas).
- **1 huevo duro** o **60 g** de queso fresco descremado (si tolera lácteos).

### Almuerzo (~520 kcal)
- Ensalada templada: atún natural **1 lata chica drenada** (≈120 g) o legumbres **¾ taza** cocidas.
- Fideos de arroz o integral según tolerancia **½ taza** cocida + tomate cherry **8 unidades** + aceite de oliva **1 cucharada**.

### Merienda (~180 kcal)
- Batido proteico casero (proteína en polvo según marca) **1 medida** + agua **200 ml** — *validar producto con el paciente*.

### Cena (~420 kcal)
- Brócoli y zanahoria al vapor **1½ tazas** + milanesa de soja o pollo **120 g** (tamaño palma).
- Sandía o melón **1 taza** (150 g) si tolera FODMAP.

### Notas
- **Celiaquía**: certificar TACC en fiambres, condimentos y bebidas.
- **Gastritis**: evitar cítricos muy ácidos y alcohol; priorizar texturas suaves.
`,
  },
  {
    id: 'invierno-low-lactosa',
    season: 'invierno',
    title: 'Invierno · baja lactosa + fibra suave',
    tags: ['lactosa', 'IBS', 'FODMAP suave'],
    bodyMd: `### Estructura diaria (referencia)
- **Desayuno**: tostadas sin TACC **2 rodajas** + palta **¼** + huevo **1** + bebida vegetal enriquecida **200 ml**.
- **Almuerzo**: carne magra **130 g** + arroz blanco **¾ taza** cocida + zanahoria y calabacín **1 taza**.
- **Merienda**: fruta tolerada **1 unidad pequeña** + nueces **4 mitades** (15 g).
- **Cena**: sopa de verduras **1 taza** + ricota sin lactosa o tofu **100 g**.

> Modular FODMAP según fase terapéutica y síntomas.
`,
  },
]

export function menusBySeason(season: MenuSeason) {
  return SEASONAL_MENU_TEMPLATES.filter((m) => m.season === season)
}
