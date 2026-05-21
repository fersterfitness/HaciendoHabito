import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'dark' | 'light'
export type UiDensity = 'comfortable' | 'compact'

interface ThemeContextValue {
  theme: Theme
  density: UiDensity
  toggleTheme: () => void
  setTheme: (t: Theme) => void
  setDensity: (d: UiDensity) => void
  toggleDensity: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  density: 'comfortable',
  toggleTheme: () => {},
  setTheme: () => {},
  setDensity: () => {},
  toggleDensity: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('hh-theme') as Theme | null
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [density, setDensityState] = useState<UiDensity>(() => {
    const stored = localStorage.getItem('hh-density') as UiDensity | null
    return stored === 'compact' ? 'compact' : 'comfortable'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-density', density)
    localStorage.setItem('hh-density', density)
  }, [density])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(theme)
    localStorage.setItem('hh-theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  function setDensity(d: UiDensity) {
    setDensityState(d)
  }

  function toggleDensity() {
    setDensityState((prev) => (prev === 'comfortable' ? 'compact' : 'comfortable'))
  }

  return (
    <ThemeContext.Provider value={{ theme, density, toggleTheme, setTheme, setDensity, toggleDensity }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
