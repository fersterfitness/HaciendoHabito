import { useNavigate } from 'react-router-dom'
import { Bell, ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { getInitials } from '@/lib/utils'

interface HeaderProps {
  title: string
  showBack?: boolean
  actions?: React.ReactNode
}

export function Header({ title, showBack = false, actions }: HeaderProps) {
  const navigate = useNavigate()
  const { profile, user } = useAuthStore()
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
    <header className="sticky top-0 z-30 flex items-center h-14 px-4 lg:px-6 bg-surface-card border-b border-surface-border gap-3">
      {showBack && (
        <button
          onClick={() => navigate(-1)}
          className="p-1 rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      <h1 className="flex-1 text-base font-semibold text-ink-primary truncate">{title}</h1>

      <div className="flex items-center gap-2">
        {actions}

        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated transition-colors"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-primary rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => navigate('/profile')}
          className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center"
        >
          <span className="text-white text-xs font-bold">
            {profile ? getInitials(profile.full_name) : '?'}
          </span>
        </button>
      </div>
    </header>
  )
}
