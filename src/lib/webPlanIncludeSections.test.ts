import { describe, expect, it } from 'vitest'
import { alignIncludeSectionsToCatalogSegment, normalizeIncludeSections } from './webPlanIncludeSections'

describe('alignIncludeSectionsToCatalogSegment', () => {
  it('remaps single trainer section to psychologist for psychologist segment', () => {
    const next = alignIncludeSectionsToCatalogSegment(
      [{ professional: 'trainer', items: ['Sesión 1'] }],
      'psychologist',
    )
    expect(next[0]?.professional).toBe('psychologist')
  })
})

describe('normalizeIncludeSections', () => {
  it('aligns parsed sections to catalog segment', () => {
    const next = normalizeIncludeSections(
      [{ professional: 'trainer', items: ['Ítem'] }],
      [],
      'psychologist',
    )
    expect(next[0]?.professional).toBe('psychologist')
  })
})
