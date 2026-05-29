import { useState, useEffect, useRef, useCallback } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { BrandLogo } from '@/components/branding/BrandLogo'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Mail, Lock, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ThemeToggleMoonIcon, ThemeToggleSunIcon } from '@/components/ui/ThemeToggleIcons'
import { isPasswordRecoveryPending, setPasswordRecoveryPending } from '@/lib/authRecovery'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type LoginForm = z.infer<typeof loginSchema>

/** Carrusel de fotos del panel izquierdo. Rotación automática + fade cross. */
const HERO_PHOTOS = [
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&q=85', // gym training
  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=900&q=85', // fit running
  'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900&q=85', // healthy food
  'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=900&q=85', // training closeup
]

/**
 * V2 Login — diseño split-screen con card flotante diagonal a la izquierda.
 *
 * Mejoras "modern" aplicadas:
 *  1. Parallax 3D mouse-follow sobre la card izquierda
 *  2. Carrusel de imágenes con fade cross (auto + flechas)
 *  3. Gradient mesh animado de fondo
 *  4. Glow ring en inputs al focus + shine en el botón
 *
 * Sin Google login, sin forgot password, sin redes sociales.
 */
export function LoginPageV2() {
  const { user } = useAuth()
  const navigate = useAppNavigate()
  const { theme, toggleTheme } = useTheme()
  const [showPassword, setShowPassword] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)
  const heroCardRef = useRef<HTMLDivElement>(null)
  const heroInnerRef = useRef<HTMLDivElement>(null)
  const photoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (isPasswordRecoveryPending() && !session) setPasswordRecoveryPending(false)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    if (isPasswordRecoveryPending()) { navigate('/reset-password', { replace: true }); return }
    navigate('/dashboard', { replace: true })
  }, [user, navigate])

  /* ─────────────── Carrusel de fotos ─────────────── */
  const cyclePhoto = useCallback((dir: 1 | -1) => {
    setPhotoIdx((i) => (i + dir + HERO_PHOTOS.length) % HERO_PHOTOS.length)
    // Reiniciar el timer auto al cambiar manualmente
    if (photoTimerRef.current) {
      clearInterval(photoTimerRef.current)
      photoTimerRef.current = setInterval(() => {
        setPhotoIdx((i) => (i + 1) % HERO_PHOTOS.length)
      }, 6000)
    }
  }, [])

  useEffect(() => {
    photoTimerRef.current = setInterval(() => {
      setPhotoIdx((i) => (i + 1) % HERO_PHOTOS.length)
    }, 6000)
    return () => {
      if (photoTimerRef.current) clearInterval(photoTimerRef.current)
    }
  }, [])

  /* ─────────────── Parallax 3D mouse-follow ───────────────
   * El rotateZ queda FIJO en -5deg (mantiene la inclinación diagonal).
   * El parallax solo agrega rotateX/Y sutiles para sensación 3D, sin tocar
   * la inclinación principal — así la card se ve siempre tilteada.
   */
  useEffect(() => {
    const card = heroCardRef.current
    if (!card) return
    let raf = 0
    const handleMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = (e.clientX - cx) / (window.innerWidth / 2)
      const dy = (e.clientY - cy) / (window.innerHeight / 2)
      const clamp = (v: number) => Math.max(-1, Math.min(1, v))
      const tx = clamp(dx)
      const ty = clamp(dy)
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        // Base fijo -5deg + parallax sutil en X/Y (max ~2deg). NO toca rotateZ.
        card.style.transform = `perspective(1800px) rotateZ(-5deg) rotateY(${tx * 2}deg) rotateX(${-ty * 1.5}deg)`
      })
    }
    const handleLeave = () => {
      cancelAnimationFrame(raf)
      card.style.transform = 'perspective(1800px) rotateZ(-5deg) rotateY(0deg) rotateX(0deg)'
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseleave', handleLeave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

  if (user) {
    if (isPasswordRecoveryPending()) return <Navigate to="/reset-password" replace />
    return <Navigate to="/dashboard" replace />
  }

  async function onSubmit(data: LoginForm) {
    await supabase.auth.signOut({ scope: 'local' })
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email.trim().toLowerCase(),
      password: data.password,
    })
    if (error)
      toast.error(
        error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message,
        { position: 'bottom-center' },
      )
  }

  return (
    <div className="loginv2-root relative min-h-screen overflow-hidden bg-zinc-200 dark:bg-zinc-900">
      {/* Keyframes locales — no contaminan el global */}
      <style>{`
        @keyframes loginv2-mesh-a { 0%,100% { transform: translate(-12%, -8%) scale(1) } 50% { transform: translate(8%, 6%) scale(1.18) } }
        @keyframes loginv2-mesh-b { 0%,100% { transform: translate(10%, 12%) scale(1.05) } 50% { transform: translate(-8%, -10%) scale(0.92) } }
        @keyframes loginv2-mesh-c { 0%,100% { transform: translate(0%, -10%) scale(1.1) } 50% { transform: translate(12%, 10%) scale(1) } }
        @keyframes loginv2-fade-up { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes loginv2-shine { 0% { transform: translateX(-120%) skewX(-18deg) } 60%,100% { transform: translateX(220%) skewX(-18deg) } }
        @keyframes loginv2-photo-in { from { opacity: 0; transform: scale(1.04) } to { opacity: 1; transform: scale(1) } }

        .loginv2-fade-up { opacity: 0; animation: loginv2-fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .loginv2-d1 { animation-delay: 80ms }
        .loginv2-d2 { animation-delay: 200ms }
        .loginv2-d3 { animation-delay: 320ms }
        .loginv2-d4 { animation-delay: 440ms }
        .loginv2-d5 { animation-delay: 560ms }
        .loginv2-d6 { animation-delay: 680ms }

        .loginv2-mesh > *:nth-child(1) { animation: loginv2-mesh-a 18s ease-in-out infinite }
        .loginv2-mesh > *:nth-child(2) { animation: loginv2-mesh-b 22s ease-in-out infinite }
        .loginv2-mesh > *:nth-child(3) { animation: loginv2-mesh-c 26s ease-in-out infinite }

        .loginv2-photo { animation: loginv2-photo-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both }

        /* Shine: solo se activa en hover del padre [data-shine] */
        [data-shine] { position: relative; overflow: hidden; isolation: isolate; }
        [data-shine]::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%);
          transform: translateX(-120%) skewX(-18deg);
          pointer-events: none;
          z-index: 1;
        }
        [data-shine]:hover::after { animation: loginv2-shine 0.9s cubic-bezier(0.22, 1, 0.36, 1) }

        /* Focus neutro: border gris y ring suave (sobrescribe border-brand-secondary del componente Input) */
        .loginv2-input-group input {
          transition: box-shadow 0.25s ease, border-color 0.25s ease, transform 0.15s ease;
        }
        .loginv2-input-group input:focus,
        .loginv2-input-group input:focus-visible {
          border-color: rgb(161 161 170) !important; /* zinc-400 */
          box-shadow: 0 0 0 4px rgba(161, 161, 170, 0.18); /* zinc-400 ring */
          outline: none;
        }
        :is(.dark) .loginv2-input-group input:focus,
        :is(.dark) .loginv2-input-group input:focus-visible {
          border-color: rgb(113 113 122) !important; /* zinc-500 */
          box-shadow: 0 0 0 4px rgba(113, 113, 122, 0.22);
        }
        @media (prefers-reduced-motion: reduce) {
          .loginv2-fade-up { animation: none; opacity: 1 }
          .loginv2-mesh > * { animation: none !important }
          .loginv2-photo { animation: none !important }
          [data-shine]:hover::after { animation: none }
        }
      `}</style>

      {/* ─────────────── Gradient mesh animado de fondo ─────────────── */}
      <div className="loginv2-mesh pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-32 -left-24 h-[34rem] w-[34rem] rounded-full bg-brand-primary/[0.18] blur-[140px] will-change-transform" />
        <div className="absolute -bottom-32 -right-24 h-[34rem] w-[34rem] rounded-full bg-brand-primary/[0.14] blur-[140px] will-change-transform" />
        <div className="absolute top-1/3 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-zinc-400/[0.10] blur-[150px] will-change-transform dark:bg-zinc-300/[0.06]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center p-3 sm:p-6 lg:p-8">
        <div className="relative flex w-full max-w-[1180px] flex-col lg:flex-row lg:items-stretch">

          {/* ═══════════════════════════════════════════════════════════
              LEFT — card flotante diagonal con parallax + carrusel
              Wrapper externo: fade-up de entrada (translateY → 0)
              Wrapper interno (heroCardRef): rotateZ + parallax 3D
              ═══════════════════════════════════════════════════════════ */}
          <div className="loginv2-fade-up loginv2-d1 hidden lg:flex lg:flex-col lg:w-[46%] flex-shrink-0 z-20 lg:-mr-14 xl:-mr-20">
          <div
            ref={heroCardRef}
            className="will-change-transform flex-1 flex flex-col"
            style={{
              transform: 'perspective(1800px) rotateZ(-5deg)',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <div
              className={cn(
                'relative flex-1 overflow-hidden rounded-[28px]',
                'shadow-[0_30px_70px_-15px_rgba(0,0,0,0.55),0_18px_40px_-10px_rgba(0,0,0,0.45)]',
                'ring-1 ring-white/10',
              )}
            >
              {/* Carrusel de imágenes — la del índice activo fade-in encima de las anteriores */}
              {HERO_PHOTOS.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className={cn(
                    'absolute inset-0 h-full w-full object-cover transition-opacity duration-1000',
                    i === photoIdx ? 'opacity-100 loginv2-photo' : 'opacity-0',
                  )}
                  draggable={false}
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
              ))}
              {/* Overlays para legibilidad */}
              <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/35 via-transparent to-zinc-950/55" />
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/40 via-transparent to-transparent" />

              {/* Contenido enderezado (compensa la rotación del padre) */}
              <div
                ref={heroInnerRef}
                className="relative z-10 flex h-full flex-col justify-between px-9 py-10 lg:px-11 lg:py-12"
                style={{ transform: 'rotate(5deg)', transformOrigin: 'center' }}
              >
                {/* Top bar: marca + acciones */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-bold tracking-tight text-white">
                    Haciéndolo Hábito
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/v2/form"
                      className={cn(
                        'shrink-0 rounded-full border border-white/90 px-4 py-2',
                        'bg-black/50 text-[11px] font-semibold text-white shadow-[0_2px_12px_rgba(0,0,0,0.35)]',
                        'backdrop-blur-md transition-colors',
                        'hover:border-white hover:bg-black/65',
                      )}
                    >
                      Inscripción
                    </Link>
                  </div>
                </div>

                {/* Bottom: tagline + arrows (funcionales — controlan el carrusel) */}
                <div className="flex items-end justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25 backdrop-blur-sm"
                      aria-hidden
                    >
                      <BrandLogo size="sm" decorative className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-white">
                        Tu plataforma
                      </p>
                      <p className="truncate text-[11px] text-white/65">
                        Entrenamiento &amp; Nutrición
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cyclePhoto(-1)}
                      aria-label="Foto anterior"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/35 text-white/85 transition-colors hover:border-white hover:bg-white/10 hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => cyclePhoto(1)}
                      aria-label="Foto siguiente"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/35 text-white/85 transition-colors hover:border-white hover:bg-white/10 hover:text-white"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Indicador de dots del carrusel (centro inferior, sutil) */}
              <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
                {HERO_PHOTOS.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1 rounded-full transition-all duration-300',
                      i === photoIdx ? 'w-5 bg-white' : 'w-1 bg-white/45',
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              RIGHT — card del formulario
              ═══════════════════════════════════════════════════════════ */}
          <div
            className={cn(
              'loginv2-fade-up loginv2-d2',
              'relative flex flex-1 flex-col',
              'rounded-[28px] bg-white dark:bg-zinc-950',
              'shadow-[0_30px_70px_-15px_rgba(0,0,0,0.4),0_18px_40px_-10px_rgba(0,0,0,0.3)]',
              'ring-1 ring-zinc-900/5 dark:ring-white/10',
              'min-h-[640px]',
              'px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12 lg:pl-32 xl:pl-40',
            )}
          >
            {/* Theme toggle — esquina superior derecha de la card */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border',
                  'border-zinc-200 text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-800',
                  'dark:border-white/10 dark:text-white/55 dark:hover:border-white/25 dark:hover:text-white',
                )}
                title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              >
                {theme === 'dark' ? <ThemeToggleSunIcon /> : <ThemeToggleMoonIcon />}
              </button>
            </div>

            {/* Logo centrado debajo del toggle — solo desktop (en mobile usa el del form) */}
            <div className="hidden justify-center pt-2 lg:flex">
              <BrandLogo
                size="xl"
                decorative
                className="h-40 w-40 drop-shadow-[0_6px_24px_rgba(255,72,0,0.40)] sm:h-48 sm:w-48"
              />
            </div>

            {/* Center: form */}
            <div className="flex flex-1 flex-col justify-center py-10 lg:py-14">
              <div className="mx-auto w-full max-w-sm">
                {/* Mobile logo (en lg desaparece porque el panel izquierdo lo cubre) */}
                <div className="loginv2-fade-up loginv2-d2 mb-6 flex justify-center lg:hidden">
                  <BrandLogo
                    size="xl"
                    className="h-36 w-auto drop-shadow-[0_6px_18px_rgba(255,72,0,0.32)] sm:h-44"
                  />
                </div>

                <h1 className="loginv2-fade-up loginv2-d3 text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-5xl">
                  Bienvenido
                </h1>
                <p className="loginv2-fade-up loginv2-d4 mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Accedé a tu panel de entrenamiento y nutrición
                </p>

                <form onSubmit={handleSubmit(onSubmit)} className="loginv2-input-group mt-8 space-y-4">
                  <div className="loginv2-fade-up loginv2-d5">
                    <Input
                      label="Email"
                      type="email"
                      autoComplete="email"
                      placeholder="tu@email.com"
                      leftIcon={<Mail className="h-4 w-4" />}
                      error={errors.email?.message}
                      {...register('email')}
                    />
                  </div>
                  <div className="loginv2-fade-up loginv2-d5">
                    <Input
                      label="Contraseña"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      leftIcon={<Lock className="h-4 w-4" />}
                      rightIconInteractive
                      rightIcon={
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-white"
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      }
                      error={errors.password?.message}
                      {...register('password')}
                    />
                  </div>

                  <div className="loginv2-fade-up loginv2-d6" data-shine>
                    <Button
                      type="submit"
                      variant="gradientPrimary"
                      className="!mt-6 w-full !h-12"
                      loading={isSubmitting}
                      icon={<ArrowRight className="h-4 w-4" />}
                      iconPosition="right"
                    >
                      Ingresar
                    </Button>
                  </div>
                </form>

                <p className="loginv2-fade-up loginv2-d6 mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  ¿Querés ser parte del equipo?{' '}
                  <Link
                    to="/v2/form"
                    className="font-semibold text-[#c93a00] transition-colors hover:text-[#a02e00] dark:text-brand-primary dark:hover:text-brand-primary/80"
                  >
                    Inscribite
                  </Link>
                </p>
              </div>
            </div>

            <p className="mt-auto pt-4 text-center text-[10px] text-zinc-400 dark:text-zinc-600">
              {new Date().getFullYear()} Haciéndolo Hábito
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
