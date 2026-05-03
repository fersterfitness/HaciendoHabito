import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { GlobalSearch } from './GlobalSearch'
import { SidebarProvider } from '@/contexts/SidebarContext'

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-surface-base">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 pb-20 lg:pb-0 print:pb-0">
            <Outlet />
          </main>
        </div>
        <MobileNav />
      </div>
      <GlobalSearch />
    </SidebarProvider>
  )
}
