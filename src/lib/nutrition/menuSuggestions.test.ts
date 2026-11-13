import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/students/studentAccess', () => ({ fetchAccessibleStudents: vi.fn() }))

import { bestMenuFor, mostUsedMenus, pathologyTagsFromText } from '@/lib/nutrition/menuSuggestions'
import type { SeasonalMenuTemplate } from '@/lib/nutrition/seasonalMenuLibrary'

const menu = (id: string, over: Partial<SeasonalMenuTemplate>): SeasonalMenuTemplate => ({
  id,
  season: 'todo-el-anio',
  title: id,
  pathologies: ['general'],
  tolerance: 'alta',
  summary: '',
  bodyMd: '',
  ...over,
})

describe('pathologyTagsFromText', () => {
  it('reconoce patologías escritas a mano, con o sin acentos', () => {
    expect(pathologyTagsFromText('Diabetes tipo 2 e hipertensión')).toEqual(['diabetes', 'hipertension'])
    expect(pathologyTagsFromText('Celíaca, colon irritable')).toEqual(['celiaquia', 'colon-irritable'])
    expect(pathologyTagsFromText('Tiroiditis de Hashimoto. Reflujo nocturno')).toEqual(['hashimoto', 'reflujo'])
  })

  it('no cuenta lo que el paciente niega', () => {
    expect(pathologyTagsFromText('No tengo diabetes')).toEqual([])
    expect(pathologyTagsFromText('Sin gastritis ni reflujo')).toEqual([])
    expect(pathologyTagsFromText('No fumo. Gastritis crónica')).toEqual(['gastritis'])
  })

  it('vacío o sin nada reconocible', () => {
    expect(pathologyTagsFromText('')).toEqual([])
    expect(pathologyTagsFromText(null)).toEqual([])
    expect(pathologyTagsFromText('Ninguna')).toEqual([])
  })
})

describe('bestMenuFor', () => {
  const menus = [
    menu('a', { pathologies: ['diabetes'], season: 'invierno' }),
    menu('b', { pathologies: ['diabetes'], season: 'verano' }),
    menu('c', { pathologies: ['diabetes', 'hipertension'], season: 'invierno' }),
    menu('d', { pathologies: ['general'] }),
  ]

  it('gana el que tiene más patologías en común', () => {
    expect(bestMenuFor(menus, ['diabetes', 'hipertension'], 'verano')?.menu.id).toBe('c')
  })

  it('a igualdad, el de la época', () => {
    expect(bestMenuFor(menus, ['diabetes'], 'verano')?.menu.id).toBe('b')
  })

  it('sin coincidencias no recomienda nada', () => {
    expect(bestMenuFor(menus, ['sibo'], 'verano')).toBeNull()
  })
})

describe('mostUsedMenus', () => {
  it('ordena por veces usadas y deja afuera los que nunca se usaron', () => {
    const menus = [menu('a', {}), menu('b', {}), menu('c', {})]
    const top = mostUsedMenus(menus, { a: { n: 1, last: 1 }, c: { n: 4, last: 2 } })
    expect(top.map((x) => x.menu.id)).toEqual(['c', 'a'])
  })
})
