import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  Users,
  Dumbbell,
  FileText,
  MessageSquare,
  BookOpen,
  Wallet,
  Settings,
  LogOut,
  Salad,
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  LineChart,
  CalendarClock,
  Library,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useSidebar } from '@/contexts/SidebarContext'
import { useTheme } from '@/contexts/ThemeContext'
import { getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { AppRole } from '@/types/database'

// ─── Colors ──────────────────────────────────────────────────────────────────
const SIDEBAR_BG = '#0d0f14'
// ACTIVE_BG and active text color are resolved at runtime via CSS variables
// so the notch always matches the content area regardless of theme.
const ACTIVE_BG  = 'rgb(var(--surface-base))'
const NOTCH_R    = 14

// ─── Nav groups ──────────────────────────────────────────────────────────────
const homeItem = { label: 'Inicio', href: '/dashboard', icon: Home }
const appointmentsItem = { label: 'Turnos', href: '/appointments', icon: CalendarClock }

const navItems = [
  { label: 'Alumnos',      href: '/students',      icon: Users },
  { label: 'Rutinas',      href: '/routines',      icon: Dumbbell },
  { label: 'PDFs Rutina',  href: '/routine-pdfs',  icon: FileText },
  { label: 'Hábitos',       href: '/habits',        icon: CalendarCheck },
  { label: 'Devoluciones', href: '/feedback',      icon: MessageSquare },
  { label: 'Ejercicios',   href: '/exercises',     icon: BookOpen },
]

const financeItems = [
  { label: 'Finanzas', href: '/finances', icon: Wallet },
]

const nutritionItems = [
  { label: 'Nutrición',      href: '/nutrition',      icon: Salad, exactMatch: true },
  { label: 'Evolución',      href: '/nutrition/evolution', icon: LineChart },
  { label: 'Plantillas',     href: '/nutrition/templates', icon: Library },
  { label: 'PDFs Nutrición', href: '/nutrition-pdfs', icon: FileText },
]

function canSeeTraining(role: AppRole | undefined) {
  return role === 'admin' || role === 'trainer'
}

function canSeeNutrition(role: AppRole | undefined) {
  return role === 'admin' || role === 'nutritionist'
}

function roleLabel(role: AppRole | undefined) {
  if (role === 'nutritionist') return 'Nutricionista'
  if (role === 'trainer') return 'Entrenador'
  if (role === 'admin') return 'Admin'
  if (role === 'student') return 'Alumno'
  return 'Sin perfil'
}

// ─── Concave notch ───────────────────────────────────────────────────────────
function Notch({ side, visible }: { side: 'above' | 'below'; visible: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        right: 0,
        ...(side === 'above' ? { bottom: '100%' } : { top: '100%' }),
        width: NOTCH_R,
        height: NOTCH_R,
        background: visible ? ACTIVE_BG : 'transparent',
        zIndex: 2,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 150ms ease-out',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: SIDEBAR_BG,
          borderRadius: side === 'above' ? `0 0 ${NOTCH_R}px 0` : `0 ${NOTCH_R}px 0 0`,
        }}
      />
    </div>
  )
}

function isPathActive(pathname: string, href: string, exactMatch?: boolean) {
  if (exactMatch) return pathname === href
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

// ─── Sidebar item ─────────────────────────────────────────────────────────────
function SidebarItem({
  label,
  href,
  icon: Icon,
  collapsed,
  exactMatch,
}: {
  label: string
  href: string
  icon: React.ElementType
  collapsed: boolean
  exactMatch?: boolean
}) {
  const { pathname } = useLocation()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const isActive = isPathActive(pathname, href, exactMatch)

  // In light mode the active item sits on a white bg → dark ink.
  // In dark mode it sits on the dark surface-base → light ink.
  const activeTextColor = isDark ? 'rgb(var(--ink-primary))' : '#0d0f14'

  return (
    <div style={{ position: 'relative', marginBottom: 2, zIndex: isActive ? 10 : 1 }}>
      <Notch side="above" visible={isActive} />

      <NavLink
        to={href}
        title={collapsed ? label : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 40,
          marginLeft: 8,
          marginRight: 0,
          paddingLeft: collapsed ? 0 : 10,
          paddingRight: collapsed ? 0 : 10,
          justifyContent: collapsed ? 'center' : undefined,
          borderTopLeftRadius: 12,
          borderBottomLeftRadius: 12,
          borderTopRightRadius: isActive ? 0 : 12,
          borderBottomRightRadius: isActive ? 0 : 12,
          background: isActive ? ACTIVE_BG : 'transparent',
          position: 'relative',
          zIndex: 1,
          color: isActive ? activeTextColor : 'rgba(255,255,255,0.55)',
          textDecoration: 'none',
          transition: 'color 150ms',
        }}
        className={cn(
          'group',
          !isActive && 'hover:!bg-white/[0.07] hover:!text-white/80',
        )}
      >
        {/* Icon wrapper */}
        <span
          className="flex items-center justify-center shrink-0 rounded-lg transition-colors"
          style={{
            width: 28,
            height: 28,
            background: isActive ? 'rgb(var(--brand-primary) / 0.12)' : 'transparent',
          }}
        >
          <Icon
            style={{
              width: 15,
              height: 15,
              color: isActive ? 'rgb(var(--brand-primary))' : 'inherit',
              transition: 'color 150ms',
            }}
          />
        </span>

        {!collapsed && (
          <span
            className="ml-2.5 mr-3 text-[13px] truncate flex-1 select-none"
            style={{ fontWeight: isActive ? 600 : 500 }}
          >
            {label}
          </span>
        )}
      </NavLink>

      <Notch side="below" visible={isActive} />
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────
function SidebarSection({ label }: { label: string }) {
  return (
    <div className="px-4 pt-5 pb-1.5">
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{label}</p>
    </div>
  )
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────
export function Sidebar() {
  const { collapsed, toggle } = useSidebar()
  const { profile, reset } = useAuthStore()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const role = profile?.role
  const showTraining = canSeeTraining(role)
  const showNutrition = canSeeNutrition(role)

  async function handleLogout() {
    await supabase.auth.signOut()
    reset()
    navigate('/login')
    toast.success('Sesión cerrada')
  }

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col shrink-0 h-screen sticky top-0 transition-all duration-200',
        collapsed ? 'w-[62px]' : 'w-[196px]',
      )}
      style={{
        background: SIDEBAR_BG,
        borderRight: theme === 'dark'
          ? '1px solid rgba(255,255,255,0.06)'
          : 'none',
      }}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex items-center shrink-0 border-b',
          collapsed ? 'justify-center h-14 px-0' : 'gap-3 px-4 py-4',
        )}
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <img
          src="/logo_mark_original_white_transparent.png"
          alt="HH"
          className={cn(
            'object-contain shrink-0 rounded-xl',
            collapsed ? 'w-9 h-9' : 'w-14 h-14',
          )}
        />
        {!collapsed && (
          <p className="text-[11px] font-extrabold text-white leading-snug tracking-wide uppercase ml-1 mr-4">
            Haciéndolo<br />Hábito
          </p>
        )}
      </div>

      {/* Nav */}
      <nav
        className={cn(
          'flex-1 py-3 overflow-y-auto overflow-x-visible scrollbar-hide',
          collapsed ? 'px-0' : 'px-0',
        )}
        style={{ paddingTop: NOTCH_R, paddingBottom: NOTCH_R }}
      >
        <SidebarItem key={homeItem.href} {...homeItem} collapsed={collapsed} />
        <SidebarItem key={appointmentsItem.href} {...appointmentsItem} collapsed={collapsed} />

        {(showTraining || showNutrition) && (
          <div className="my-3 mx-3" style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
        )}

        {showTraining && navItems.map((item) => (
          <SidebarItem key={item.href} {...item} collapsed={collapsed} />
        ))}

        {showTraining && (
          <>
            {!collapsed && <SidebarSection label="Finanzas" />}
            {collapsed && (
              <div className="my-3 mx-3" style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
            )}
            {financeItems.map((item) => (
              <SidebarItem key={item.href} {...item} collapsed={collapsed} />
            ))}
          </>
        )}

        {showNutrition && (
          <>
            {!collapsed && <SidebarSection label="Nutrición" />}
            {collapsed && (
              <div className="my-3 mx-3" style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
            )}
            {nutritionItems.map((item) => (
              <SidebarItem key={item.href} {...item} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div
        className="shrink-0 pb-3 pt-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Settings */}
        <SidebarItem
          label="Configuración"
          href="/settings"
          icon={Settings}
          collapsed={collapsed}
        />

        {/* User row */}
        <div
          className={cn(
            'flex items-center rounded-xl mt-1 group cursor-default transition-colors hover:bg-white/[0.07]',
            collapsed ? 'justify-center py-2.5 mx-1' : 'gap-2.5 py-2.5 mx-2 px-2',
          )}
          title={collapsed ? (profile?.full_name ?? '') : undefined}
        >
          <div className="w-7 h-7 rounded-lg bg-brand-primary flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold">
              {profile ? getInitials(profile.full_name) : '?'}
            </span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-white truncate leading-none">
                  {profile?.full_name ?? 'Cargando...'}
                </p>
                <p className="text-[10px] text-white/40 capitalize leading-none mt-0.5">
                  {roleLabel(profile?.role)}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="text-white/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                title="Cerrar sesión"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {collapsed && (
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full rounded-xl py-2 text-white/30 hover:text-red-400 hover:bg-white/[0.07] transition-all duration-150 mt-1"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          title={collapsed ? 'Expandir' : 'Colapsar'}
          className={cn(
            'flex items-center w-full rounded-xl py-2 mt-1 text-white/25 hover:text-white/50 hover:bg-white/[0.07] transition-all duration-150',
            collapsed ? 'justify-center' : 'px-2 gap-2',
          )}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          {!collapsed && <span className="text-[11px]">Colapsar</span>}
        </button>
      </div>
    </aside>
  )
}
