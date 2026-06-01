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
        'border-b bg-surface-base/90 backdrop-blur-md supports-[backdrop-filter]:bg-surface-base/75',
        'border-surface-border/70',
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

      <h1 className="flex-1 text-lg font-semibold tracking-tight text-ink-primary truncate">{title}</h1>

      <div className="flex items-center gap-1.5">
        {actions}

        <HeaderActionButton
          onClick={() => openGlobalSearch()}
          className="hidden sm:inline-flex"
          aria-label="Buscar (Ctrl+K)"
          title="Buscar (Ctrl+K)"
          renderIcon={(hovered) => <HeaderSearchIcon animate={hovered} />}
        />

        <HeaderActionButton
          onClick={toggleTheme}
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
            'flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-surface-border bg-surface-elevated transition-colors hover:border-brand-primary/50 hover:bg-surface-border/50',
            appFocusRingClassName,
          )}
          aria-label="Ajustes y perfil"
          title="Ajustes"
        >
          {profile ? (
            <AvatarOrInitials fullName={profile.full_name} avatarUrl={profile.avatar_url} size="md" rounded="xl" />
          ) : (
            <span className="text-xs font-bold text-ink-muted">?</span>
          )}
        </button>
      </div>
    </header>
  )
}
