import { beforeEach, vi } from 'vitest'

const store = new Map<string, string>()

const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
  clear: () => {
    store.clear()
  },
}

vi.stubGlobal('localStorage', localStorageMock)

beforeEach(() => {
  store.clear()
})
