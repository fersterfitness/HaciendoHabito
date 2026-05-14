/**
 * Biblioteca de menús base (invierno / verano) con foco en patologías frecuentes.
 * Son plantillas que el profesional adapta por paciente.
 */

export type MenuSeason = 'invierno' | 'verano' | 'todo-el-anio'

export type DigestiveTolerance = 'baja' | 'media' | 'alta'

export type PathologyTag =
  | 'hashimoto'
  | 'celiaquia'
  | 'colon-irritable'
  | 'sibo'
  | 'gastritis'
  | 'reflujo'
  | 'diabetes'
  | 'hipertension'
  | 'general'

export const PATHOLOGY_LABELS: Record<PathologyTag, string> = {
  hashimoto: 'Hashimoto',
  celiaquia: 'Celiaquía',
  'colon-irritable': 'Colon irritable',
  sibo: 'SIBO',
  gastritis: 'Gastritis',
  reflujo: 'Reflujo',
  diabetes: 'Diabetes',
  hipertension: 'Hipertensión',
  general: 'General (sin patología)',
}

export const TOLERANCE_LABELS: Record<DigestiveTolerance, string> = {
  baja: 'Tolerancia digestiva BAJA (FODMAP bajo, fase aguda)',
  media: 'Tolerancia digestiva MEDIA',
  alta: 'Tolerancia digestiva ALTA (sin restricciones especiales)',
}

export const SEASON_LABELS: Record<MenuSeason, string> = {
  invierno: 'Invierno',
  verano: 'Verano',
  'todo-el-anio': 'Todo el año',
}

export type SeasonalMenuTemplate = {
  id: string
  season: MenuSeason
  title: string
  /** Patologías compatibles (se usa para filtrar). */
  pathologies: PathologyTag[]
  /** Tolerancia digestiva apropiada. */
  tolerance: DigestiveTolerance
  /** Calorías objetivo aproximadas. */
  approximateKcal?: number
  /** Resumen breve para mostrar en lista. */
  summary: string
  /** Contenido completo en Markdown. */
  bodyMd: string
}

export const SEASONAL_MENU_TEMPLATES: SeasonalMenuTemplate[] = [
  // ───────────── INVIERNO ─────────────
  {
    id: 'invierno-base-digestivo',
    season: 'invierno',
    title: 'Invierno · base tolerancia digestiva moderada',
    pathologies: ['gastritis', 'colon-irritable', 'general'],
    tolerance: 'media',
    approximateKcal: 1620,
    summary: 'Platos calientes, pocas frituras, fibra progresiva. Base equilibrada.',
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

### Notas clínicas
- **Celiaquía**: reemplazar avena por mezcla certificada sin TACC.
- **Hashimoto**: sin cambios estructurales obligatorios; modular yodo según criterio.
- **SIBO**: reducir avena/fructanos según fase activa.
`,
  },
  {
    id: 'invierno-hashimoto',
    season: 'invierno',
    title: 'Invierno · Hashimoto (antiinflamatorio)',
    pathologies: ['hashimoto', 'general'],
    tolerance: 'media',
    approximateKcal: 1700,
    summary: 'Selenio + zinc + omega 3. Sin gluten preventivo, lácteos modulados.',
    bodyMd: `### Objetivo
Apoyar función tiroidea: nutrientes clave (selenio, zinc, omega 3, hierro), evitar exceso de yodo procesado y reducir disparadores inflamatorios.

### Desayuno (~430 kcal)
- Tortilla de **2 huevos** + espinaca salteada **1 plato chico**.
- **2 nueces de Brasil** (selenio).
- Té verde sin azúcar.

### Media mañana (~150 kcal)
- 1 fruta + **1 cucharada de chía** hidratada en agua.

### Almuerzo (~580 kcal)
- Salmón al horno **130 g** (omega 3) con limón.
- Quinoa **½ taza cocida** (≈100 g) + brócoli al vapor **1 taza**.
- Aceite de oliva **1 cucharadita**.

### Merienda (~200 kcal)
- Yogur natural **170 g** + **1 cucharada de semillas de calabaza** (zinc).

### Cena (~340 kcal)
- Pollo al horno **100 g** + ensalada de zanahoria, remolacha rallada y rúcula con limón.
- Aceite de oliva **1 cucharadita**.

### Notas clínicas
- Si autoinmunidad activa: probar 4–6 semanas **sin gluten** y reevaluar síntomas + TPO.
- Evitar soja excesiva (interfiere con absorción de levotiroxina si se toma cerca).
- Tomar levotiroxina **30 min antes** del desayuno.
`,
  },
  {
    id: 'invierno-sibo-fodmap',
    season: 'invierno',
    title: 'Invierno · SIBO fase activa (FODMAP bajo)',
    pathologies: ['sibo', 'colon-irritable'],
    tolerance: 'baja',
    approximateKcal: 1500,
    summary: 'Bajo en FODMAP: sin cebolla/ajo, sin trigo, sin lactosa, sin manzana/pera.',
    bodyMd: `### Objetivo
Reducir distensión y carga fermentable durante fase activa de SIBO. **Duración orientativa: 2–6 semanas**, luego reintroducción.

### Desayuno (~370 kcal)
- Avena sin gluten **30 g** cocida en agua o leche **sin lactosa** o de almendras sin endulzar.
- Banana firme **½ unidad** (no madura).
- Té de jengibre.

### Almuerzo (~520 kcal)
- Pollo al horno **130 g** condimentado con aceite de oliva infusionado en ajo (sin trozos) **1 cdta**.
- Arroz blanco **½ taza cocido** + zucchini salteado **1 taza** + zanahoria al vapor.
- Ensalada de pepino y lechuga.

### Merienda (~180 kcal)
- Yogur sin lactosa **170 g** + **5–6 almendras peladas**.

### Cena (~430 kcal)
- Pescado blanco **120 g** al horno con **aceitunas y limón**.
- Papa hervida **1 mediana** + espinaca cocida **1 taza**.

### Evitar (en fase activa)
- Cebolla, ajo (en trozos), puerro, trigo, centeno, manzana, pera, mango, miel, lácteos con lactosa, legumbres, brócoli/coliflor en exceso.

### Notas clínicas
- Suplementar **vitamina D** si hay deficiencia.
- Evaluar protocolo herbal/atb según indicación gastroenterólogo.
`,
  },
  {
    id: 'invierno-celiaquia',
    season: 'invierno',
    title: 'Invierno · Celiaquía (TACC libre estricto)',
    pathologies: ['celiaquia'],
    tolerance: 'media',
    approximateKcal: 1750,
    summary: 'Cereales sin TACC certificados, lectura de etiquetas obligatoria.',
    bodyMd: `### Objetivo
Eliminar trigo/avena/cebada/centeno y prevenir contaminación cruzada.

### Desayuno (~420 kcal)
- Pan de arroz/maíz **2 rebanadas** (≈60 g) con queso untable **1 cucharada** + tomate.
- Té o café con leche.

### Almuerzo (~580 kcal)
- Milanesa de carne con harina de garbanzo **150 g** + puré de papa y zanahoria **1 taza**.
- Ensalada mixta (lechuga, tomate, huevo) con aceite de oliva.

### Merienda (~280 kcal)
- Yogur **170 g** + granola sin TACC certificada **2 cucharadas** + frutas frescas.

### Cena (~470 kcal)
- Tarta de zapallo y queso con masa de polenta **1 porción mediana**.
- Ensalada verde.

### Notas clínicas
- Verificar **logo "sin TACC" oficial** (ANMAT) en cada producto envasado.
- En restaurante: pedir cocción separada y aceite limpio.
- Suplementar **B12** y **hierro** si analítica lo justifica.
`,
  },

  // ───────────── VERANO ─────────────
  {
    id: 'verano-base-hidratacion',
    season: 'verano',
    title: 'Verano · base hidratación y platos frescos',
    pathologies: ['general'],
    tolerance: 'alta',
    approximateKcal: 1650,
    summary: 'Platos frescos, hidratación, proteína repartida.',
    bodyMd: `### Objetivo
Platos frescos, hidratación y proteína repartida. **Ajustar por paciente y patología.**

### Desayuno (~380 kcal)
- Smoothie con yogur **170 g** + frutas frescas **1 taza** (frutilla, durazno) + chía **1 cucharadita**.
- Tostadas integrales **2 rebanadas** con palta **¼ unidad**.

### Almuerzo (~560 kcal)
- Ensalada completa: pollo grillado **120 g** + arroz integral **½ taza** + tomate, pepino, zanahoria, hojas verdes.
- Aceite de oliva **1 cucharadita** + limón.

### Merienda (~200 kcal)
- Fruta de estación **1 unidad** + **15 almendras o nueces** (20 g).

### Cena (~510 kcal)
- Tortilla de zucchini al horno **1 porción mediana** (≈250 g).
- Ensalada de remolacha y zanahoria rallada con queso fresco **30 g**.

### Hidratación
- 2–3 L de agua/día (más si hay actividad o mucho calor).
- Tés fríos, agua con frutas (sin azúcar agregada).
`,
  },
  {
    id: 'verano-sibo',
    season: 'verano',
    title: 'Verano · SIBO/IBS — frío y bajo FODMAP',
    pathologies: ['sibo', 'colon-irritable'],
    tolerance: 'baja',
    approximateKcal: 1550,
    summary: 'Ensaladas seguras (lechuga, pepino, zanahoria), sin cebolla/ajo, sin frutas altas en fructanos.',
    bodyMd: `### Objetivo
Adaptar el bajo-FODMAP a verano sin cocción excesiva.

### Desayuno (~360 kcal)
- Yogur sin lactosa **170 g** + arándanos **¼ taza** + **1 cucharadita de chía**.
- Té de jengibre frío.

### Almuerzo (~550 kcal)
- Pollo grillado **130 g** sobre lechuga, pepino, zanahoria rallada, tomate cherry **6 unidades**.
- Quinoa **½ taza cocida** fría.
- Aceite de oliva infusionado **1 cdta** + limón.

### Merienda (~180 kcal)
- Banana firme **½** + **5 nueces**.

### Cena (~460 kcal)
- Atún en agua **120 g** con papa hervida fría **1 mediana** y huevo **1 unidad**.
- Lechuga y pepino.

### Evitar
- Cebolla, ajo (en trozos), sandía, mango, manzana, pera, lácteos con lactosa, legumbres.
`,
  },
  {
    id: 'verano-hashimoto',
    season: 'verano',
    title: 'Verano · Hashimoto antiinflamatorio',
    pathologies: ['hashimoto'],
    tolerance: 'media',
    approximateKcal: 1700,
    summary: 'Ensaladas con pescado azul, frutos rojos y semillas. Bajo en azúcares simples.',
    bodyMd: `### Objetivo
Sostener nutrientes tiroideos en versión fresca.

### Desayuno (~410 kcal)
- Bowl: yogur natural **170 g** + frutos rojos **½ taza** + chía + **2 nueces de Brasil**.
- Té verde frío.

### Almuerzo (~570 kcal)
- Ensalada con sardinas o salmón en lata **120 g**, espinaca, palta **¼**, zanahoria.
- Quinoa **½ taza** cocida fría.
- Limón + aceite de oliva.

### Merienda (~200 kcal)
- Fruta + **1 cucharada de semillas de calabaza** (zinc).

### Cena (~520 kcal)
- Tortilla al horno con espinaca y queso **1 porción**.
- Ensalada de remolacha + rúcula + nueces.

### Notas
- 2 nueces de Brasil/día = dosis de selenio adecuada (no más).
- Reducir ultraprocesados con yodo agregado.
`,
  },
  {
    id: 'verano-gastritis',
    season: 'verano',
    title: 'Verano · gastritis / reflujo (antiinflamatorio gástrico)',
    pathologies: ['gastritis', 'reflujo'],
    tolerance: 'media',
    approximateKcal: 1600,
    summary: 'Sin frituras, sin café fuerte, sin cítricos en exceso, comidas frecuentes y pequeñas.',
    bodyMd: `### Objetivo
Bajar irritación gástrica con porciones moderadas y cocciones suaves.

### Desayuno (~370 kcal)
- Avena cocida **40 g** con leche o bebida vegetal sin azúcar + banana madura **½**.
- Té de manzanilla o tilo (no negro/café fuerte).

### Media mañana (~150 kcal)
- Pera o manzana cocida **1 unidad** + **5 almendras**.

### Almuerzo (~520 kcal)
- Pollo o pavita al horno **130 g** + arroz blanco **½ taza** + zapallo cocido **1 taza**.
- Hojas tiernas (lechuga mantecosa).

### Merienda (~180 kcal)
- Yogur natural **170 g** + galletas de arroz **2 unidades**.

### Cena (~380 kcal)
- Pescado blanco **120 g** al horno + puré de papa con un toque de aceite de oliva.
- Calabacín hervido.

### Evitar
- Cítricos en exceso, café fuerte, alcohol, picante, frituras, tomate crudo en grandes cantidades, gaseosas.

### Notas
- 5–6 comidas chicas mejor que 3 grandes.
- No acostarse hasta 2 h después de cenar.
`,
  },
  {
    id: 'verano-diabetes',
    season: 'verano',
    title: 'Verano · diabetes 2 / resistencia a la insulina',
    pathologies: ['diabetes'],
    tolerance: 'alta',
    approximateKcal: 1650,
    summary: 'IG bajo, fibra alta, proteína repartida, sin azúcares simples.',
    bodyMd: `### Objetivo
Estabilizar glucemia con hidratos de bajo índice glucémico, fibra y proteína en cada comida.

### Desayuno (~380 kcal)
- Yogur natural sin azúcar **170 g** + **2 cucharadas de avena** + **1 cucharada de chía** + frutillas **½ taza**.

### Almuerzo (~560 kcal)
- Pechuga de pollo grillada **130 g** + lentejas **½ taza cocidas** + ensalada de hojas, tomate, zanahoria.
- Aceite de oliva **1 cdta**.

### Merienda (~200 kcal)
- Tostada integral **1 rebanada** con palta **¼** + huevo duro **1 unidad**.

### Cena (~510 kcal)
- Pescado al horno **130 g** + zapallo asado **1 taza** + verdes salteados.

### Hidratación
- Agua sin endulzar, té/mate sin azúcar.

### Notas
- Evitar jugos de fruta y gaseosas (incluso "light" en exceso).
- Movimiento posprandial: 10–15 min de caminata después de comer baja la glucemia.
`,
  },

  // ───────────── TODO EL AÑO ─────────────
  {
    id: 'general-hipertension',
    season: 'todo-el-anio',
    title: 'Todo el año · hipertensión (DASH adaptado)',
    pathologies: ['hipertension'],
    tolerance: 'alta',
    approximateKcal: 1700,
    summary: 'Bajo sodio, alto potasio (frutas/verduras), lácteos descremados, granos integrales.',
    bodyMd: `### Objetivo
Bajar consumo de sodio (<2300 mg/día), aumentar potasio, magnesio y calcio.

### Desayuno (~400 kcal)
- Avena **40 g** + bebida vegetal o leche descremada + banana **1 unidad**.
- 1 puñado de nueces sin sal.

### Almuerzo (~570 kcal)
- Pollo o pescado **130 g** + arroz integral **½ taza** + ensalada (hojas, tomate, pepino, palta).

### Merienda (~220 kcal)
- Yogur descremado **170 g** + frutos rojos.

### Cena (~510 kcal)
- Tortilla de espinaca y queso bajo en sodio **1 porción**.
- Ensalada de zanahoria, remolacha y semillas.

### Reducir
- Embutidos, fiambres, quesos duros, pan industrial salado, snacks, sopas en sobre.
- Reemplazar sal por hierbas (orégano, perejil, romero, ajo en polvo natural).
`,
  },
]
