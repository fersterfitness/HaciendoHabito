import { MobileNav } from '@/components/layout/MobileNav'
import { GlobalSearch } from '@/components/layout/GlobalSearch'
import { AnimatedOutlet } from '@/components/layout/AnimatedOutlet'
import { SidebarProvider } from '@/contexts/SidebarContext'
import { SidebarV2 } from './SidebarV2'

/**
 * Marco de la v2: lienzo gris con la barra lateral y el contenido en un panel blanco con borde,
 * que es el que scrollea (en el celu, pantalla completa con la barra inferior de siempre).
 */
export function AppLayoutV2() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[rgb(var(--v2-canvas))]">
        <SidebarV2 />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:py-2 lg:pr-2">
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-surface-base pb-[calc(5rem+env(safe-area-inset-bottom))] lg:h-[calc(100vh-1rem)] lg:flex-none lg:overflow-y-auto lg:rounded-xl lg:border lg:border-surface-border lg:pb-0 lg:shadow-[0_1px_3px_rgb(0_0_0/0.04)] print:h-auto print:overflow-visible print:border-0 print:pb-0 print:shadow-none">
            <AnimatedOutlet />
          </main>
        </div>
        <MobileNav />
      </div>
      <GlobalSearch />
    </SidebarProvider>
  )
}
