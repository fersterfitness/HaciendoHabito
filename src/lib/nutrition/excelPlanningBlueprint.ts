/**
 * Plantilla alineada a la hoja «PLAN ALIMENTACIÓN» del Excel del proyecto HH.
 */

export interface PlanningBlueprintRowDef {
  name: string
  hint?: string
  /** Nueva plantilla: cómo muestra Cantidad para el alumno/PDF por defecto. */
  qtyPresentation?: 'grams' | 'units' | 'volume'
  /** Ej. «2» (uds.) o «200» (ml) según modo. */
  unitsLabel?: string
}

export interface PlanningSectionBlueprintDef {
  key: string
  title: string
  quantityColumnHint: string
  rows: PlanningBlueprintRowDef[]
}

export const EXCEL_PLANNING_BLUEPRINT: PlanningSectionBlueprintDef[] = [
  {
    key: 'carnes',
    title: 'CARNES / PESCADO / HUEVO / LACTEOS / JAMÓN',
    quantityColumnHint:
      'Carnes y pescado: gramos después de cocer. Huevos claras/yema/entero, jamón y quesos tipo fiambre: cantidad por unidades (claras, huevos enteros, fetas); los gramos orientativos quedan en la fila o en la columna total. Leche y yogures en ml o unidad según marca.',
    rows: [
      { name: 'Suprema', hint: 'Pechuga cocida orientativa ~150–220 g por filete grande (según tamaño).' },
      { name: 'Lomo de vaca', hint: 'Medallón cocido ~120–180 g; bife ancho ~180–250 g; churrasco grande ~200–280 g (ejemplos orientativos).' },
      { name: 'Lomo de cerdo (solomillo)', hint: 'Filete cocido orientativo ~140–200 g según grosor.' },
      { name: 'Colita de cuadril', hint: 'Bife o tiras cocidas orientativo ~150–220 g porción.' },
      { name: 'Tapa de nalga', hint: 'Milanesa / bifes orientativos ~120–200 g por unidad según corte.' },
      { name: 'Roast beff', hint: 'Fiambre en fetas: ~25–40 g por feta fina; asado en porción ~150–250 g.' },
      { name: 'Atún de pescadería', hint: 'Lomito fresco cocido orientativo ~120–200 g porción.' },
      { name: 'Salmón', hint: 'Porción cocida orientativa ~120–200 g filete (variable).' },
      {
        name: 'Lata 180 gr de atún en lomitos (unidad)',
        hint: 'Equivalente orientativo ~130 g escurrido; ajustá gramos si usás otro tamaño.',
        qtyPresentation: 'units',
      },
      { name: 'Clara de huevo (unidad)', hint: '~33 g por clara grande.', qtyPresentation: 'units' },
      { name: 'Yema de huevo (unidad)', hint: '~17 g por yema grande.', qtyPresentation: 'units' },
      { name: 'Whey protein "Gentech 7900"' },
      { name: 'Leche descremada % (ml)', hint: '1 ml ≈ 1 g para el cálculo.', qtyPresentation: 'volume' },
      { name: 'Leche Zero lactosa "La Serenísima" (ml)', hint: '1 ml ≈ 1 g.', qtyPresentation: 'volume' },
      { name: 'Queso cremoso %', qtyPresentation: 'units', hint: 'Mejor como fetas o porción; usar gramos sólo cuando el formato sea especial.' },
      { name: 'Queso cremoso light port salut %', qtyPresentation: 'units', hint: 'Unidad habitual = feta típica; gramos sólo orientativos para la sumatoria.' },
      { name: 'Ricotta magra', hint: 'También se puede cargar como cucharadas soperas (~30–40 g c/u).' },
      { name: 'Queso untable Ricotta "Tregar" (cucharada sopera)', hint: '~15 g por cucharada sopera (orientativo).' },
      { name: 'Yogurt firme o bebible (envase habitual)', hint: 'Podés cargar ml (etiqueta) o unidades de pote (~125–170 g).' },
      { name: 'Yogur griego natural batido tipo "Milbona"' },
      { name: 'Yogurt % referencia habitual', hint: 'Ver carbos en etiqueta por 100 g; podés cargar gramos netos.' },
      {
        name: 'Jamón cocido sin glutten dia por ciento 200gr (por feta)',
        hint: '~25–40 g por feta según espesor; sumá cantidad de fetas.',
        qtyPresentation: 'units',
      },
      { name: 'Queso cremoso ligth por salut "Día %"', qtyPresentation: 'units', hint: 'Contá feta o porción; referencia típica ~20–35 g por rodaja.' },
      {
        name: 'Queso untable descremado "Cousine & co."',
        hint: 'Cucharada sopera ~15–20 g; mejor para el alumno cargar cucharadas o gramos etiqueta.',
      },
      {
        name: 'Queso cremoso "La Serenisima" light por salut',
        qtyPresentation: 'units',
        hint: 'Por feta o taco chico típico; gramos equivalen entre paréntesis en la recomendación.',
      },
      {
        name: 'Queso duro rallado tipo reggianito/parmesano',
        hint: 'Rallado sopero ~8–15 g.',
      },
      {
        name: 'Leche de almendra / sin lactosa alta proteína (ml)',
        hint: '1 ml ≈ 1 g cuando la etiqueta no indica volumen específico.',
      },
      {
        name: 'Huevo mediano entero (unidad)',
        hint: '~48–56 g huevo pesado sin cáscara; mejor leer como «1 huevo», «3 claras», etc.',
        qtyPresentation: 'units',
      },
    ],
  },
  {
    key: 'harinas',
    title: 'HARINAS / CEREALES / PSEUDOCEREALES',
    quantityColumnHint: 'Cantidad en gramos (crudo)',
    rows: [
      { name: 'Harina de trigo sarraceno' },
      { name: 'Harina de trigo integral' },
      { name: 'Avena' },
      { name: 'Harina de arroz' },
      { name: 'Harina de garbanzos' },
      { name: 'Harina de almendras' },
      { name: 'Harina de soja' },
      { name: 'Harina de algarroba' },
      { name: 'Quinoa' },
      { name: 'Quinoa inflada' },
      { name: 'Harina de lentejas' },
    ],
  },
  {
    key: 'legumbres',
    title: 'LEGUMBRES',
    quantityColumnHint: 'Cantidad en gramos (cocido)',
    rows: [
      { name: 'Lentejas' },
      { name: 'Porotos/frijoles/judías' },
      { name: 'Garbanzos' },
      { name: 'Arvejas/guisantes/chicharos' },
      { name: 'Lupines' },
      { name: 'Soja texturizada' },
      { name: 'Maní' },
    ],
  },
  {
    key: 'tuberculos',
    title: 'TUBÉRCULOS',
    quantityColumnHint: 'Cantidad en gramos (cocido)',
    rows: [
      { name: 'Papa' },
      { name: 'Batata/camote' },
      { name: 'Rábanitos' },
      { name: 'Zanahoria' },
      { name: 'Boniato' },
    ],
  },
  {
    key: 'hortalizas',
    title: 'HORTALIZAS · GRUPOS A Y B',
    quantityColumnHint:
      'Cargá gramos cocidos; el PDF también detalla hort. A/B por ítems. Referencia rápida en estas filas.',
    rows: [
      {
        name: 'HORTALIZAS A · ítems (referencia rápida)',
        hint:
          'Acelga, achicoria, apio, berenjena, berro, brócoli, coliflor, escarola, espárragos, espinaca, hinojo, hongos, lechuga, pepino, puerro, rabanito, radicheta, repollo, repollitos de Bruselas, tomate, zapallito.',
      },
      {
        name: 'HORTALIZAS B · ítems (referencia rápida)',
        hint:
          'Alcaucil (alcachofa), arvejas frescas, brotes de soja, calabaza, cebolla, cebolla de verdeo, chauchas, nabo, palmitos, remolacha, zanahoria, zapallo.',
      },
      {
        name: 'Porción de ensalada o verduras en plato (peso habitual)',
        hint: 'Gramos después de lavar/listas o tras cocinar, como acordemos con la persona.',
      },
    ],
  },
  {
    key: 'pastas',
    title: 'PASTAS / ARROZ',
    quantityColumnHint: 'Cantidad en gramos (cocido)',
    rows: [
      { name: 'Fideos %' },
      { name: 'Fideos integrales %' },
      { name: 'Fideos de arroz %' },
      { name: 'Fideos de arvejas %' },
      { name: 'Arroz blanco %' },
      { name: 'Arroz integral %' },
      { name: 'Arroz yamaní' },
      { name: 'Ñoquis %' },
      { name: 'Fideos 3 vegetales %' },
    ],
  },
  {
    key: 'pan',
    title: 'PAN / GALLETAS / GALLETITAS',
    quantityColumnHint:
      'Preferí unidades cuando el alumno cuenta rebanadas o fichas; los gr equivalen típicamente al peso etiqueta de la marca que use.',
    rows: [
      { name: 'Pan lactal % (unidad)', hint: '~25–38 g por ficha según marca.', qtyPresentation: 'units' },
      {
        name: 'Galletas de arroz tipo "Arrocitas" (unidad)',
        hint: '~5–10 g por unidad según tamaño.',
        qtyPresentation: 'units',
      },
      { name: 'Galletas de arroz tipo "Cerealitas" (unidad)', qtyPresentation: 'units' },
      { name: 'Galletas de Arroz orgánicas "Dos Hermanos" (unidad)', qtyPresentation: 'units' },
      { name: 'Pan salvado' },
    ],
  },
  {
    key: 'semillas',
    title: 'SEMILLAS / FRUTOS SECOS / ACEITES / PALTA',
    quantityColumnHint: 'Cantidad en gramos (crudo)',
    rows: [
      { name: 'Semillas de lino' },
      { name: 'Semillas de chía' },
      { name: 'Semillas de girasol' },
      { name: 'Semillas de amaranto' },
      { name: 'Semillas de calabaza' },
      { name: 'Semillas de sésamo' },
      { name: 'Nueces mariposa (unidad)', hint: '~5–10 g por media nuez.', qtyPresentation: 'units' },
      { name: 'Almendras (unidad)', hint: '~1,2–1,5 g por almendra.', qtyPresentation: 'units' },
      { name: 'Castañas (unidad)', hint: '~10 g por castaña cocida orientativa.', qtyPresentation: 'units' },
      { name: 'Palta (unidad)', hint: 'Mediana sin carozo ~135 g pulpa (orientativo).', qtyPresentation: 'units' },
      { name: 'Aceite (cuchara sopera)', hint: '~12–15 g por cucharada sopera.' },
      { name: 'Aceitunas sin carozo (unidad)', hint: '~3–5 g por unidad.', qtyPresentation: 'units' },
      { name: 'Pasa de uva (sopera)', hint: '~12 g por sopera rasada orientativa.' },
    ],
  },
  {
    key: 'frutas',
    title: 'FRUTAS',
    quantityColumnHint: 'Gramos total (pasá unidades a gramos cuando indica «unidad»)',
    rows: [
      { name: 'Naranja mediana (unidad)', hint: '~140 g orientativo.' },
      { name: 'Mandarina mediana (unidad)', hint: '~90 g orientativo.' },
      { name: 'Manzana mediana (unidad)', hint: '~150 g orientativo.' },
      { name: 'Frutillas (gramos)' },
      { name: 'Banana mediana (unidad)', hint: '~110–120 g sin cáscara.' },
      { name: 'Durazno (unidad)', hint: '~150 g orientativo.' },
      { name: 'Pera (unidad)', hint: '~150 g orientativo.' },
      { name: 'Arándanos (gramos)' },
    ],
  },
  {
    key: 'otros',
    title: 'OTROS',
    quantityColumnHint: 'Cantidad en gramos salvo donde indica cucharada / unidad',
    rows: [
      { name: 'Dulce de leche "La Serenísima" (cucharada sopera)', hint: '~20 g orientativo.' },
      { name: 'Polenta %' },
      { name: 'Seitán' },
      { name: 'Crema de maní (cucharada sopera)', hint: '~16 g orientativo.' },
      { name: 'Levadura de cerveza "Nutrileva" (cucharada sopera)' },
      { name: 'Germén de trigo' },
      { name: 'Fideos Spaghettis libre de gluten "Matarazzo"' },
      { name: 'Zucchini (unidad)', hint: '~200 g zucchini mediano orientativo.' },
      { name: 'Queso Finlandia Cheddar "La Serenisima" (cuchara té)' },
      { name: 'Ketchup "La Campagnola" (cucharada sopera)' },
      { name: 'Galletitas de avena y pasas "Molino natural" (unidad)' },
      { name: 'Cacao 100% puro "Diocomere" (cucharada sopera)' },
      { name: 'Miel' },
      { name: 'nesquick (gr)' },
      { name: 'NUTELLA' },
      { name: 'CANELA' },
      { name: 'cereales sin azúcar' },
    ],
  },
  {
    key: 'sintacc',
    title: 'Alimentos sin TACC',
    quantityColumnHint: 'Cantidad en gramos salvo donde indica unidad / cucharada',
    rows: [
      { name: 'Galletas de arroz finas hierbas "Mini arrocitas" (unidad)' },
      { name: 'Fideos Penne Rigate Libre de Gluten Matarazzo' },
      { name: 'Pan Ciabatta Libre de Gluten Manjar (unidad)' },
      { name: 'r Crepes 3 Cereales Libre de Gluten (cucharada sopera)' },
    ],
  },
]
