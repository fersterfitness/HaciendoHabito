import { createContext, useContext, useState } from 'react'

const STORAGE_KEY = 'hh-sidebar-expanded'

interface SidebarContextValue {
  /** Barra lateral abierta con nombres (preferencia guardada por dispositivo). */
  expanded: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

function readExpanded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(readExpanded)

  function toggle() {
    setExpanded((v) => {
      const next = !v
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* sin storage: queda solo para esta sesión */
      }
      return next
    })
  }

  return <SidebarContext.Provider value={{ expanded, toggle }}>{children}</SidebarContext.Provider>
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used inside SidebarProvider')
  return ctx
}
