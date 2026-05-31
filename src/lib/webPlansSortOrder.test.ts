import { describe, expect, it } from 'vitest'
import {
  applyPlanSortOrderBySegment,
  segmentRankInVisibleList,
  slugOrdersEqual,
} from './webPlansSortOrder'

describe('applyPlanSortOrderBySegment', () => {
  it('assigns global list order from visible slug sequence', () => {
    const plans = [
      { slug: 'plan-nutricion', catalog_segment: 'with_nutritionist', sort_order: 99 },
      { slug: 'ferster-habitos-sedentario', catalog_segment: 'solo', sort_order: 99 },
      { slug: 'ferster-habitos-avanzado', catalog_segment: 'solo', sort_order: 99 },
    ]
    const next = applyPlanSortOrderBySegment(plans, [
      'ferster-habitos-sedentario',
      'plan-nutricion',
      'ferster-habitos-avanzado',
    ])
    const sed = next.find((p) => p.slug === 'ferster-habitos-sedentario')!
    const nut = next.find((p) => p.slug === 'plan-nutricion')!
    const ava = next.find((p) => p.slug === 'ferster-habitos-avanzado')!
    expect(sed.sort_order).toBe(1)
    expect(nut.sort_order).toBe(2)
    expect(ava.sort_order).toBe(3)
  })
})

describe('segmentRankInVisibleList', () => {
  it('counts rank within segment only', () => {
    const bySlug = new Map([
      ['a', { catalog_segment: 'solo' }],
      ['b', { catalog_segment: 'with_nutritionist' }],
      ['c', { catalog_segment: 'solo' }],
    ])
    expect(segmentRankInVisibleList(['a', 'b', 'c'], bySlug, 'a')).toBe(1)
    expect(segmentRankInVisibleList(['a', 'b', 'c'], bySlug, 'c')).toBe(2)
    expect(segmentRankInVisibleList(['a', 'b', 'c'], bySlug, 'b')).toBe(1)
  })
})

describe('slugOrdersEqual', () => {
  it('compares slug sequences', () => {
    expect(slugOrdersEqual(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(slugOrdersEqual(['a', 'b'], ['b', 'a'])).toBe(false)
  })
})
