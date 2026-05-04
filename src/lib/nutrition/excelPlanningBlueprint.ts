/**
 * Plantilla alineada a la hoja «PLAN ALIMENTACIÓN» del Excel del proyecto HH.
 */

export interface PlanningBlueprintRowDef {
  name: string
  hint?: string
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
      'Cantidad en gramos (cocción en carnes / pescado; lácteos en ml donde indica). En carnes usamos referencias en plato (no cucharadas).',
    rows: [
      { name: 'Suprema', hint: 'Pechuga cocida orientativa ~150–220 g por filete grande (según tamaño).' },
      { name: 'Lomo de vaca', hint: 'Medallón cocido ~120–180 g; bife ancho ~180–250 g; churrasco grande ~200–280 g (ejemplos orientativos).' },
      { name: 'Lomo de cerdo (solomillo)', hint: 'Filete cocido orientativo ~140–200 g según grosor.' },
      { name: 'Colita de cuadril', hint: 'Bife o tiras cocidas orientativo ~150–220 g porción.' },
      { name: 'Tapa de nalga', hint: 'Milanesa / bifes orientativos ~120–200 g por unidad según corte.' },
      { name: 'Roast beff', hint: 'Fiambre en fetas: ~25–40 g por feta fina; asado en porción ~150–250 g.' },
      { name: 'Atún de pescadería', hint: 'Lomito fresco cocido orientativo ~120–200 g porción.' },
      { name: 'Salmón', hint: 'Porción cocida orientativa ~120–200 g filete (variable).' },
      { name: 'Lata 180 gr de atún en lomitos (unidad)', hint: 'Equivalente orientativo ~130 g escurrido; ajustá gramos si usás otro tamaño.' },
      { name: 'Clara de huevo (unidad)', hint: '~33 g por clara grande.' },
      { name: 'Yema de huevo (unidad)', hint: '~17 g por yema grande.' },
      { name: 'Whey protein "Gentech 7900"' },
      { name: 'Leche descremada % (ml)', hint: '1 ml ≈ 1 g para el cálculo.' },
      { name: 'Leche Zero lactosa "La Serenísima" (ml)', hint: '1 ml ≈ 1 g.' },
      { name: 'Queso cremoso %' },
      { name: 'Queso cremoso light port salut %' },
      { name: 'Ricotta magra' },
      { name: 'Queso untable Ricotta "Tregar" (cucharada sopera)', hint: '~15 g por cucharada sopera (orientativo).' },
      { name: 'Yogurt %' },
      { name: 'Jamón cocido sin glutten dia por ciento 200gr (por feta)' },
      { name: 'Queso cremoso ligth por salut "Día %"' },
      { name: 'Queso untable descremado "Cousine & co."' },
      { name: 'Queso cremoso "La Serenisima" light por salut' },
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
    quantityColumnHint: 'Cantidad en gramos (crudo / producto)',
    rows: [
      { name: 'Pan lactal % (unidad)', hint: '~25–35 g por ficha según marca.' },
      { name: 'Galletas de arroz tipo "Arrocitas" (unidad)', hint: '~5–10 g por unidad según tamaño.' },
      { name: 'Galletas de arroz tipo "Cerealitas" (unidad)' },
      { name: 'Galletas de Arroz orgánicas "Dos Hermanos" (unidad)' },
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
      { name: 'Nueces mariposa (unidad)', hint: '~5–10 g por media nuez.' },
      { name: 'Almendras (unidad)', hint: '~1,2–1,5 g por almendra.' },
      { name: 'Castañas (unidad)', hint: '~10 g por castaña cocida orientativa.' },
      { name: 'Palta (unidad)', hint: 'Mediana sin carozo ~135 g pulpa (orientativo).' },
      { name: 'Aceite (cuchara sopera)', hint: '~12–15 g por cucharada sopera.' },
      { name: 'Aceitunas sin carozo (unidad)', hint: '~3–5 g por unidad.' },
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
