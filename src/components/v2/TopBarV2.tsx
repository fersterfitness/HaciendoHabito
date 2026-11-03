import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { getNavSections, isNavPathActive } from '@/config/navigation'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount'
import { openGlobalSearch } from '@/lib/globalSearch'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

function useCurrentNav() {
  const { pathname } = useLocation()
  const role = useAuthStore((s) => s.profile?.role)
  for (const section of getNavSections(role)) {
    const item = section.items.find((i) => isNavPathActive(pathname, i))
    if (item) return { section: section.title, item }
  }
  return null
}

function RoundIconButton({ label, onClick, children, className }: { label: string; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface-elevated hover:text-ink-primary',
        className,
      )}
    >
      {children}
    </button>
  )
}

/**
 * Barra superior de la v2: ruta («Entrenamiento › Asesorías») a la izquierda, acciones de la
 * pantalla y campana a la derecha. Reemplaza a la cabecera vieja en todas las pantallas.
 */
export function TopBarV2({
  title,
  showBack,
  actions,
  className,
}: {
  title: string
  showBack?: boolean
  actions?: ReactNode
  className?: string
}) {
  const navigate = useAppNavigate()
  const unread = useUnreadNotificationCount()
  const nav = useCurrentNav()
  const Icon = nav?.item.icon
  const sameAsItem = nav && nav.item.label === title

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-surface-border bg-surface-base/90 px-4 backdrop-blur-xl lg:h-[52px] lg:px-6',
        className,
      )}
    >
      {showBack ? (
        <RoundIconButton label="Volver" onClick={() => navigate(-1)} className="-ml-2">
          <ChevronLeft className="h-[18px] w-[18px]" />
        </RoundIconButton>
      ) : null}
      <nav aria-label="Ubicación" className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
        {nav ? (
          <>
            <span className="hidden shrink-0 text-ink-muted sm:inline">{nav.section}</span>
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-ink-muted/70 sm:block" aria-hidden />
            {!sameAsItem ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate(nav.item.href)}
                  className="hidden shrink-0 text-ink-muted transition-colors hover:text-ink-primary sm:inline"
                >
                  {nav.item.label}
                </button>
                <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-ink-muted/70 sm:block" aria-hidden />
              </>
            ) : null}
          </>
        ) : null}
        <h1 className="flex min-w-0 items-center gap-2 font-medium text-ink-primary">
          {Icon && sameAsItem ? <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden /> : null}
          <span className="truncate">{title}</span>
        </h1>
      </nav>
      <div className="flex shrink-0 items-center gap-1.5">
        {actions}
        <RoundIconButton label="Buscar (Ctrl+K)" onClick={() => openGlobalSearch()} className="lg:hidden">
          <Search className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </RoundIconButton>
        <RoundIconButton label={unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'} onClick={() => navigate('/notifications')} className="lg:hidden">
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
          {unread > 0 ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-pastel-rose-ink ring-2 ring-surface-base" /> : null}
        </RoundIconButton>
      </div>
    </header>
  )
}
