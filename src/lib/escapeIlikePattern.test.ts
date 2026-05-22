import { describe, expect, it } from 'vitest'
import { escapeIlikePattern } from '@/lib/escapeIlikePattern'

describe('escapeIlikePattern', () => {
  it('escapa % y _', () => {
    expect(escapeIlikePattern('100%_test')).toBe('100\\%\\_test')
  })

  it('escapa backslashes', () => {
    expect(escapeIlikePattern('a\\b')).toBe('a\\\\b')
  })

  it('deja texto normal igual', () => {
    expect(escapeIlikePattern('maria garcia')).toBe('maria garcia')
  })
})
