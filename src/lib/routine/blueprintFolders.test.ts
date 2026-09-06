import { describe, expect, it } from 'vitest'
import {
  blueprintLibraryRoutineId,
  withBlueprintMeta,
} from './blueprintFolders'

describe('blueprintFolders library meta', () => {
  it('stores and reads library_routine_id', () => {
    const payload = withBlueprintMeta({ v: 1, blocks: [] }, { library_routine_id: 'abc' })
    expect(blueprintLibraryRoutineId({ payload })).toBe('abc')
  })

  it('clears library_routine_id when set to null', () => {
    const payload = withBlueprintMeta(
      { v: 1, blocks: [], library_routine_id: 'abc' },
      { library_routine_id: null },
    )
    expect(blueprintLibraryRoutineId({ payload })).toBeNull()
  })
})
