import {} from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Bell, ChevronLeft, Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/contexts/ThemeContext'
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
        'border-b border-surface-border/70 bg-surface-base/90 backdrop-blur-md supports-[backdrop-filter]:bg-surface-base/75',
        className,
      )}
    >
      {showBack && (
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      <h1 className="flex-1 text-lg font-semibold text-ink-primary truncate">{title}</h1>

      <div className="flex items-center gap-1">
        {actions}

        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-surface-elevated text-ink-secondary hover:text-ink-primary hover:bg-surface-border/60 transition-colors"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2.5 rounded-xl bg-surface-elevated text-ink-secondary hover:text-ink-primary hover:bg-surface-border/60 transition-colors"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-primary rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="ml-1 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-surface-border bg-surface-elevated transition-colors hover:bg-surface-border/50"
          title="Perfil"
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
