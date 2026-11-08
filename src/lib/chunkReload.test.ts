import { describe, expect, it } from 'vitest'
import { isChunkLoadError } from './chunkReload'

describe('isChunkLoadError', () => {
  it('reconoce los errores de código que no se pudo bajar', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: http://localhost:5174/src/pages/x.tsx'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/a.css'))).toBe(true)
  })
  it('no confunde otros errores', () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined (reading 'map')"))).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
  })
})
