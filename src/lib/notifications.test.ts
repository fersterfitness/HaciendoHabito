import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { notificationHref } from './notifications'

describe('notificationHref', () => {
  it('el aviso de alumno confirmado lleva al panel de Mi página web', () => {
    expect(notificationHref({ type: 'sistema', linked_table: 'marketplace_requests', linked_id: 'x' })).toBe('/mi-pagina')
  })

  it('no cambia los links que ya existían', () => {
    expect(notificationHref({ type: 'sistema', linked_table: 'students', linked_id: 'a1' })).toBe('/students/a1')
    expect(notificationHref({ type: 'sistema', linked_table: null, linked_id: null })).toBeNull()
  })
})
