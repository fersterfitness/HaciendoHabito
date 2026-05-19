import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Bell, ChevronLeft, Search } from 'lucide-react'
import { openGlobalSearch } from '@/lib/globalSearch'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/contexts/ThemeContext'
import { trainerCtaSolidBgClassName } from '@/lib/primaryGradientCtaClasses'
import { ThemeToggleMoonIcon, ThemeToggleSunIcon } from '@/components/ui/ThemeToggleIcons'
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
  const { profile, user } = useAuthStore()
  const { theme, toggleTheme } = useTheme()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .then(({ count }) => setUnreadCount(count ?? 0))

    const channel = supabase
      .channel('notifications-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false)
            .then(({ count }) => setUnreadCount(count ?? 0))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center h-14 sm:h-16 px-4 lg:px-6 gap-3',
        'border-b bg-surface-base/90 backdrop-blur-md supports-[backdrop-filter]:bg-surface-base/75',
        profile?.role === 'nutritionist'
          ? 'border-emerald-500/25 dark:border-emerald-400/20'
          : 'border-surface-border/70',
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

      <div className="flex items-center gap-1">
        {actions}

        <button
          type="button"
          onClick={() => openGlobalSearch()}
          className={cn(
            'hidden sm:inline-flex p-2.5 rounded-xl bg-surface-elevated text-ink-secondary hover:text-ink-primary hover:bg-surface-border/60 transition-colors',
            appFocusRingClassName,
          )}
          aria-label="Buscar (Ctrl+K)"
          title="Buscar (Ctrl+K)"
        >
          <Search className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className={cn(
            'p-2.5 rounded-xl bg-surface-elevated text-ink-secondary hover:text-ink-primary hover:bg-surface-border/60 transition-colors',
            appFocusRingClassName,
          )}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? <ThemeToggleSunIcon /> : <ThemeToggleMoonIcon />}
        </button>

        <button
          type="button"
          onClick={() => navigate('/notifications')}
          aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
          className={cn(
            'relative p-2.5 rounded-xl bg-surface-elevated text-ink-secondary hover:text-ink-primary hover:bg-surface-border/60 transition-colors',
            appFocusRingClassName,
          )}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white',
                trainerCtaSolidBgClassName,
              )}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => navigate('/settings')}
          className={cn(
            'ml-1 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-surface-border bg-surface-elevated transition-colors hover:bg-surface-border/50',
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
