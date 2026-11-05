import { describe, expect, it } from 'vitest'
import { groupIntoLines, matchPatientByName, parseAnthropometryReport } from './anthropometryReportImport'

/** Renglones como los arma pdf.js del informe de Holway (paciente ficticio). */
const PAGE1 = [
  'Informe de NUTRICIÓN DEPORTIVA',
  'Nombre: Ana Pérez Edad: 28,10',
  'Número de medición: 3 Fecha de medición: 4/9/2026',
  'Valor Diferencias con',
  'Peso (kg) 61,20 50,10 -0,40 0,16',
  'Talla (cm) 165,00',
  'BASICOS',
  'Talla sentado (cm) 86,00 80,00 0,46',
  'Biacromial 36,00 33,00 0,79',
  'Tórax Transverso 26,10 24,00 -0,13',
  'Tórax Anteroposterior 18,60 17,00 0,05',
  'Bi-iliocrestídeo 27,10 25,00 -0,13',
  'DIAMETROS (cm) Humeral (biepicondilar) 6,00 5,50 1,20',
  'Femoral (biepicondilar) 9,00 8,20 0,48',
  'Cabeza 55,00 50,00 -2,16',
  'Brazo Relajado 27,00 24,00 0,20 0,46',
  'Brazo Flexionado en Tensión 28,50 26,00 0,30 0,92',
  'Antebrazo 23,10 21,00 0,00 0,81',
  'Tórax Mesoesternal 86,40 80,00 0,40 0,11',
  'Cintura (mínima) 68,50 63,00 -0,30 0,07',
  'PERIMETROS (cm) Caderas (máxima) 96,20 90,00 -0,70 -0,61',
  'Muslo (superior) 56,40 52,00 0,30 -0,06',
  'Muslo (medial) 51,80 48,00 0,30 0,79',
  'Pantorrilla (máxima) 35,50 33,00 0,20 0,07',
  'Tríceps 14,75 13,00 -0,15 -0,47',
  'Subescapular 10,90 10,00 0,10 -1,23',
  'Supraespinal 8,30 7,50 -1,10 -1,53',
  'Abdominal 15,80 14,00 0,80 -1,51',
  'Muslo (medial) 20,25 19,00 -0,15 -1,89',
  'PLIEGUES CUTANEOS (mm) Pantorrilla 12,20 11,00 -1,70 -2,20',
]
const PAGE2 = [
  'Nombre: Ana Pérez Edad: 28,10',
  'Número de medición: 2 Fecha de medición: 4/9/2026',
  'Peso (kg)',
  'Masa Adiposa 17,000 27,50% 16,800 #¡DIV/0! -1,76 -0,274',
  'Masa Muscular 24,475 40,13% 24,900 #¡DIV/0! 2,55 0,752 1988)',
]

describe('importar informe de composición corporal', () => {
  it('mapea las 25 variables, separando perímetros de pliegues que se llaman igual', () => {
    const r = parseAnthropometryReport([PAGE1, PAGE2])
    expect(r.missing).toEqual([])
    expect(r.values.peso_bruto_kg).toBe(61.2)
    expect(r.values.humeral_biepicondilar_cm).toBe(6)
    expect(r.values.cadera_max_cm).toBe(96.2)
    expect(r.values.muslo_max_cm).toBe(56.4)
    expect(r.values.muslo_medial_cm).toBe(51.8)
    expect(r.values.muslo_medial_mm).toBe(20.25)
    expect(r.values.pantorrilla_max_cm).toBe(35.5)
    expect(r.values.pantorrilla_max_mm).toBe(12.2)
  })

  it('toma fecha, N° de la primera página, nombre y composición (Kerr)', () => {
    const r = parseAnthropometryReport([PAGE1, PAGE2])
    expect(r.measuredAt).toBe('2026-09-04')
    expect(r.measurementNumber).toBe(3)
    expect(r.patientName).toBe('Ana Pérez')
    expect(r.bodyFatPct).toBe(27.5)
    expect(r.muscleMassKg).toBe(24.9)
  })

  it('un PDF que no es el informe no trae medidas', () => {
    const r = parseAnthropometryReport([['Factura B N° 0001-000123', 'Total $ 45.000', 'Peso neto del envío']])
    expect(Object.keys(r.values)).toHaveLength(0)
    expect(r.measuredAt).toBeNull()
  })

  it('arma los renglones por altura y de izquierda a derecha', () => {
    const lines = groupIntoLines([
      { str: '84,70', x: 470, y: 700.5 },
      { str: 'Peso (kg)', x: 256, y: 701 },
      { str: 'Talla (cm)', x: 256, y: 680 },
      { str: '185,00', x: 470, y: 680 },
    ])
    expect(lines).toEqual(['Peso (kg) 84,70', 'Talla (cm) 185,00'])
  })
})

describe('buscar el paciente del informe', () => {
  const list = [
    { id: 'a', full_name: 'Federico Vazquez Crossetto' },
    { id: 'b', full_name: 'Florencia Vega' },
    { id: 'c', full_name: 'Lujan Ayala' },
    { id: 'd', full_name: 'Luján Ayala' },
  ]
  it('encuentra por nombre y apellido aunque falte el segundo apellido', () => {
    expect(matchPatientByName('Federico Crossetto', list)?.id).toBe('a')
  })
  it('no adivina si hay empate o sólo coincide una palabra', () => {
    expect(matchPatientByName('Luján Ayala', list)).toBeNull()
    expect(matchPatientByName('Florencia Pérez', list)).toBeNull()
  })
})
