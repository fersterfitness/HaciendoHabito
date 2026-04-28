import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuthStore } from '@/stores/authStore'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const role = useAuthStore((state) => state.profile?.role)
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('hh-theme') as Theme | null
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(theme)
    localStorage.setItem('hh-theme', theme)
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    root.removeAttribute('data-role-theme')
    if (role === 'nutritionist') {
      root.setAttribute('data-role-theme', 'nutritionist')
    }
  }, [role])

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
