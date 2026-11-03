import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Bell, ChevronsUpDown, LogOut, Moon, Search, Settings, Sun, Undo2 } from 'lucide-react'
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount'
import { AvatarOrInitials } from '@/components/account/AvatarOrInitials'
import { Popover } from '@/components/ui/Popover'
import { getNavSections, isNavPathActive } from '@/config/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { openGlobalSearch } from '@/lib/globalSearch'
import { prefetchRouteChunkByHref } from '@/lib/prefetchRouteChunks'
import { supabase } from '@/lib/supabase'
import { leaveV2 } from '@/lib/uiVersion'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import type { AppRole } from '@/types/database'

const ROLE_LABEL: Partial<Record<AppRole, string>> = {
  admin: 'Administración',
  trainer: 'Entrenador',
  nutritionist: 'Nutricionista',
  psychologist: 'Psicología',
  student: 'Alumno',
}

const itemClass = (active: boolean) =>
  cn(
    'group flex h-8 items-center gap-2.5 rounded-full px-2.5 text-[13px] transition-colors',
    active
      ? 'bg-[rgb(var(--v2-sidebar-active))] font-medium text-ink-primary shadow-[0_1px_2px_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.03)]'
      : 'text-ink-secondary hover:bg-[rgb(var(--v2-sidebar-active))]/60 hover:text-ink-primary',
  )

/** Marca de la v2: el mismo dibujo del logo, en negro liso y del tamaño de los íconos. */
function BrandMarkV2() {
  return (
    <svg viewBox="113 188 374 380" className="h-6 w-6 shrink-0" aria-hidden>
      <rect x="113" y="188" width="374" height="380" rx="84" className="fill-ink-primary" />
      <path d="M188 325 262 248V368H300L188 498Z M412 248V425L340 498V368H300Z" className="fill-surface-base" />
    </svg>
  )
}

/** Barra lateral de la v2: apoyada en el lienzo gris, la sección activa es una «pastilla» blanca. */
export function SidebarV2() {
  const { profile, reset } = useAuthStore()
  const { pathname } = useLocation()
  const navigate = useAppNavigate()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const sections = getNavSections(profile?.role)
  const unread = useUnreadNotificationCount()

  // «/» abre la búsqueda (salvo que se esté escribiendo en un campo).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault()
      openGlobalSearch()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function logout() {
    setMenuOpen(false)
    await supabase.auth.signOut()
    reset()
    navigate('/login')
    toast.success('Sesión cerrada', { position: 'bottom-center' })
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-[13.5rem] shrink-0 flex-col px-3 pb-3 pt-4 lg:flex print:hidden" aria-label="Navegación principal">
      <NavLink to="/dashboard" className="mb-4 flex h-8 items-center gap-2 rounded-lg px-1.5">
        <BrandMarkV2 />
        <span className="min-w-0 truncate text-[13.5px] font-medium tracking-[-0.01em] text-ink-primary">Haciéndolo Hábito</span>
      </NavLink>

      <button
        type="button"
        onClick={() => openGlobalSearch()}
        className="mb-4 flex h-8 items-center gap-2 rounded-lg bg-[rgb(var(--v2-sidebar-active))] px-2.5 text-[13px] text-ink-muted shadow-[0_1px_2px_rgb(0_0_0/0.05),0_0_0_1px_rgb(0_0_0/0.03)] transition-colors hover:text-ink-secondary"
      >
        <Search className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        <span className="flex-1 text-left">Buscar</span>
        <kbd className="flex h-5 min-w-5 items-center justify-center rounded bg-surface-elevated px-1 font-sans text-[11px] text-ink-muted">/</kbd>
      </button>

      <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 scrollbar-hide">
        {sections.map((section, i) => (
          <div key={section.title} className="flex flex-col gap-px">
            {i > 0 ? <p className="mb-1 px-2.5 text-[11px] text-ink-muted">{section.title}</p> : null}
            {i === 0 ? (
              <NavLink to="/notifications" className={({ isActive }) => itemClass(isActive)}>
                {({ isActive }) => (
                  <>
                    <Bell
                      className={cn('h-4 w-4 shrink-0', isActive ? 'text-ink-primary' : 'text-ink-muted group-hover:text-ink-secondary')}
                      strokeWidth={1.6}
                    />
                    <span className="flex-1 truncate">Notificaciones</span>
                    {unread > 0 ? (
                      <span className="text-[11px] font-medium tabular-nums text-ink-muted">{unread > 99 ? '99+' : unread}</span>
                    ) : null}
                  </>
                )}
              </NavLink>
            ) : null}
            {section.items.map((item) => {
              const active = isNavPathActive(pathname, item)
              const Icon = item.icon
              return (
                <NavLink
                  key={`${item.href}-${item.label}`}
                  to={item.href}
                  className={itemClass(active)}
                  aria-current={active ? 'page' : undefined}
                  onMouseEnter={() => prefetchRouteChunkByHref(item.href)}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-ink-primary' : 'text-ink-muted group-hover:text-ink-secondary')} strokeWidth={1.6} />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      <p className="mb-1 mt-3 px-2.5 text-[11px] text-ink-muted">Cuenta</p>
      <Popover
        open={menuOpen}
        onOpenChange={setMenuOpen}
        side="top"
        align="start"
        className="w-[13.5rem] p-1"
        trigger={(t) => (
          <button
            {...t}
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-[rgb(var(--v2-sidebar-active))]/60"
          >
            <AvatarOrInitials fullName={profile?.full_name ?? '?'} avatarUrl={profile?.avatar_url ?? null} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink-primary">{profile?.full_name ?? 'Mi cuenta'}</span>
              <span className="block truncate text-[11px] text-ink-muted">{(profile?.role && ROLE_LABEL[profile.role]) || 'Cuenta'}</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
          </button>
        )}
      >
        <MenuButton
          icon={Settings}
          onClick={() => {
            setMenuOpen(false)
            navigate('/settings')
          }}
        >
          Configuración
        </MenuButton>
        <MenuButton icon={theme === 'dark' ? Sun : Moon} onClick={toggleTheme}>
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </MenuButton>
        <div className="my-1 h-px bg-surface-border" />
        <MenuButton icon={Undo2} onClick={leaveV2}>
          Volver a la versión actual
        </MenuButton>
        <MenuButton icon={LogOut} onClick={() => void logout()}>
          Cerrar sesión
        </MenuButton>
      </Popover>
    </aside>
  )
}

function MenuButton({ icon: Icon, onClick, children }: { icon: typeof Settings; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-ink-primary transition-colors hover:bg-surface-elevated"
    >
      <Icon className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
      {children}
    </button>
  )
}
