import { useAppNavigate } from '@/hooks/useAppNavigate'
import { ChevronLeft } from 'lucide-react'
import { openGlobalSearch } from '@/lib/globalSearch'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/contexts/ThemeContext'
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount'
import { NotificationBellBadge } from '@/components/notifications/NotificationBellBadge'
import {
  HeaderActionButton,
  HeaderBellIcon,
  HeaderMoonIcon,
  HeaderSearchIcon,
  HeaderSunIcon,
} from '@/components/icons/headerAnimateIcons'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { cn } from '@/lib/utils'
import { AvatarOrInitials } from '@/components/account/AvatarOrInitials'

interface HeaderProps {
  title: string
  showBack?: boolean
  actions?: React.ReactNode
  className?: string
}

export function Header({ title, showBack = false, actions, className }: HeaderProps) {
  const navigate = useAppNavigate()
  const { profile } = useAuthStore()
  const { theme, toggleTheme } = useTheme()
  const unreadCount = useUnreadNotificationCount()

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center h-14 sm:h-16 px-4 lg:px-6 gap-3',
        'border-b border-surface-border/60 bg-surface-base/80 backdrop-blur-xl supports-[backdrop-filter]:bg-surface-base/65',
        className,
      )}
    >
      {showBack && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Volver"
          className={cn(
            'p-2 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated transition-colors',
            appFocusRingClassName,
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-ink-primary sm:text-xl">{title}</h1>

      <div className="flex items-center gap-1.5">
        {actions}

        <button
          type="button"
          onClick={() => openGlobalSearch()}
          className={cn(
            'hidden h-9 w-56 items-center gap-2 rounded-lg border border-surface-border bg-surface-panel px-3 text-sm text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink-secondary md:inline-flex',
            appFocusRingClassName,
          )}
          aria-label="Buscar (Ctrl+K)"
        >
          <HeaderSearchIcon />
          <span className="flex-1 text-left">Buscar…</span>
          <kbd className="rounded border border-surface-border bg-surface-card px-1.5 font-sans text-3xs font-medium text-ink-muted">Ctrl K</kbd>
        </button>
        <HeaderActionButton
          onClick={() => openGlobalSearch()}
          className="hidden sm:inline-flex md:hidden"
          aria-label="Buscar (Ctrl+K)"
          title="Buscar (Ctrl+K)"
          renderIcon={(hovered) => <HeaderSearchIcon animate={hovered} />}
        />

        {/* En el celu el tema está en «Más»: la cabecera queda con lo justo. */}
        <HeaderActionButton
          onClick={toggleTheme}
          className="hidden sm:inline-flex"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          renderIcon={(hovered) =>
            theme === 'dark' ? (
              <HeaderSunIcon animate={hovered} className="text-white" />
            ) : (
              <HeaderMoonIcon animate={hovered} className="text-ink-primary" />
            )
          }
        />

        <HeaderActionButton
          onClick={() => navigate('/notifications')}
          aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
          className="relative overflow-visible"
          renderIcon={(hovered) => <HeaderBellIcon animate={hovered} />}
          badge={<NotificationBellBadge count={unreadCount} className="-top-1 -right-1" />}
        />

        <button
          type="button"
          onClick={() => navigate('/settings')}
          className={cn(
            'ml-1 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full transition-opacity hover:opacity-80',
            appFocusRingClassName,
          )}
          aria-label="Ajustes y perfil"
          title="Ajustes"
        >
          {profile ? (
            <AvatarOrInitials fullName={profile.full_name} avatarUrl={profile.avatar_url} size="md" />
          ) : (
            <span className="text-xs font-bold text-ink-muted">?</span>
          )}
        </button>
      </div>
    </header>
  )
}
