import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { GlobalSearch } from './GlobalSearch'
import { AnimatedOutlet } from '@/components/layout/AnimatedOutlet'
import { SidebarProvider } from '@/contexts/SidebarContext'

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-surface-base">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 flex flex-col min-h-0 lg:p-3 xl:p-4 print:p-0">
            <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-x-hidden overflow-y-auto rounded-none border-0 bg-transparent pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 print:pb-0 lg:rounded-2xl lg:border lg:border-surface-border/80 lg:bg-surface-card/40 dark:lg:bg-surface-card/25 lg:shadow-panel print:border-0 print:bg-transparent print:shadow-none">
              <AnimatedOutlet />
            </main>
          </div>
        </div>
        <MobileNav />
      </div>
      <GlobalSearch />
    </SidebarProvider>
  )
}
