import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LayoutTemplate, Share2, ClipboardCheck, Rows3 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/contexts/ThemeContext'
import { Header } from '@/components/layout/Header'
import { ThemeToggleMoonIcon, ThemeToggleSunIcon } from '@/components/ui/ThemeToggleIcons'
import { cn } from '@/lib/utils'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { FormSection } from '@/components/ui/FormSection'
import { Card } from '@/components/ui/Card'
import { SettingsProfilePhotoSection } from '@/pages/settings/SettingsProfilePhotoSection'
import toast from 'react-hot-toast'
import type { AppRole } from '@/types/database'

const schema = z.object({
  full_name: z.string().min(2, 'Mínimo 2 caracteres'),
  phone: z.string().optional().or(z.literal('')),
  bio: z.string().optional().or(z.literal('')),
  role: z.enum(['trainer', 'nutritionist', 'admin']),
})

type FormValues = z.infer<typeof schema>

export function SettingsPage() {
  const { profile, setProfile } = useAuthStore()
  const { theme, toggleTheme, density, setDensity } = useTheme()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name,
        phone: profile.phone ?? '',
        bio: profile.bio ?? '',
        role:
          profile.role === 'admin'
            ? 'admin'
            : profile.role === 'nutritionist'
            ? 'nutritionist'
            : 'trainer',
      })
    }
  }, [profile, reset])

  async function onSubmit(values: FormValues) {
    if (!profile) return
    const isAdminProfile = profile.role === 'admin'
    const nextRole: AppRole = isAdminProfile
      ? 'admin'
      : values.role === 'nutritionist'
      ? 'nutritionist'
      : 'trainer'
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: values.full_name,
        phone: values.phone || null,
        bio: values.bio || null,
        role: nextRole,
      })
      .eq('id', profile.id)
      .select()
      .single()
    if (error) { toast.error(error.message) }
    else { setProfile(data); toast.success('Perfil actualizado') }
  }

  return (
    <div>
      <Header title="Configuración" />
      <div className="page-shell-x page-shell-y max-w-lg space-y-6">

        {/* Apariencia */}
        <Card>
          <FormSection title="Apariencia">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-ink-primary">Tema</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {theme === 'dark' ? 'Modo oscuro activo' : 'Modo claro activo'}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-border bg-surface-elevated hover:bg-surface-border/60 transition-colors text-sm font-medium text-ink-secondary',
                  appFocusRingClassName,
                )}
              >
                {theme === 'dark' ? (
                  <>
                    <ThemeToggleSunIcon /> Claro
                  </>
                ) : (
                  <>
                    <ThemeToggleMoonIcon /> Oscuro
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between py-1 pt-4 border-t border-surface-border/60">
              <div>
                <p className="text-sm font-medium text-ink-primary">Densidad de la interfaz</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {density === 'compact'
                    ? 'Más filas visibles en tablas y listados'
                    : 'Espaciado cómodo (recomendado)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-border bg-surface-elevated hover:bg-surface-border/60 transition-colors text-sm font-medium text-ink-secondary',
                  appFocusRingClassName,
                )}
              >
                <Rows3 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                {density === 'compact' ? 'Cómoda' : 'Compacta'}
              </button>
            </div>
          </FormSection>
        </Card>

        {(profile?.role === 'trainer' || profile?.role === 'admin') && (
        <Card>
          <FormSection title="Comunicación con alumnos">
            <p className="text-sm text-ink-secondary mb-3">
              Recursos para compartir por WhatsApp y formularios de check-in con link público (sin que el alumno entre a la app).
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild variant="secondary" icon={<Share2 className="h-4 w-4" />}>
                <Link to="/feedback?tab=recursos">Recursos y WhatsApp</Link>
              </Button>
              <Button asChild variant="secondary" icon={<ClipboardCheck className="h-4 w-4" />}>
                <Link to="/feedback?tab=checkins">Check-ins</Link>
              </Button>
            </div>
            <details className="mt-4 rounded-xl border border-surface-border bg-surface-elevated/30 px-3 py-2">
              <summary className="text-xs font-medium text-ink-secondary cursor-pointer select-none">
                Cómo probar esto (y qué tenés que tener en Supabase)
              </summary>
              <ol className="mt-2 text-[11px] text-ink-muted list-decimal pl-4 space-y-1.5 leading-relaxed max-w-prose">
                <li>
                  En tu proyecto Supabase, aplicá las migraciones del repo: al menos{' '}
                  <code className="text-[10px] bg-surface-base px-1 rounded">20260529120000_trainer_resources_and_check_ins.sql</code> y{' '}
                  <code className="text-[10px] bg-surface-base px-1 rounded">20260529140000_trainer_message_templates.sql</code> y{' '}
                  <code className="text-[10px] bg-surface-base px-1 rounded">20260529160000_trainer_sends_rpc_check_in_hardening.sql</code> y{' '}
                  <code className="text-[10px] bg-surface-base px-1 rounded">20260529180000_check_in_email_and_send_schedules.sql</code>,{' '}
                  <code className="text-[10px] bg-surface-base px-1 rounded">20260530140000_check_in_fix_rate_limit_and_shared_link.sql</code> y{' '}
                  <code className="text-[10px] bg-surface-base px-1 rounded">20260530150000_security_hardening_rls.sql</code> y{' '}
                  <code className="text-[10px] bg-surface-base px-1 rounded">20260530160000_intake_rate_limit_postgres.sql</code>. Sin
                  eso, fallan tablas o RPC de check-in.
                </li>
                <li>
                  <strong className="text-ink-secondary">Recursos (Consulta semanal → Recursos):</strong> creá un recurso con URL, marcá alumnos activos con
                  teléfono válido, probá «Copiar mensaje» y «WhatsApp». Con «Registrar al abrir WhatsApp» activado, el historial debe sumar una fila
                  por alumno; si repetís el mismo alumno y recurso dentro de 60 minutos, no duplica (manual muestra aviso informativo).
                </li>
                <li>
                  <strong className="text-ink-secondary">Plantillas:</strong> guardá una plantilla, elegila en el desplegable y verificá que el
                  texto vaya arriba del mensaje al copiar o abrir WhatsApp.
                </li>
                <li>
                  <strong className="text-ink-secondary">Check-ins (Consulta semanal → Check-ins):</strong> creá un formulario, guardá, generá links para alumnos,
                  abrí el link en otra ventana o navegador (ruta <code className="text-[10px] bg-surface-base px-1 rounded">/form/check-in/…</code>
                  ), enviá respuestas y confirmá que aparecen en la app y en export CSV si hay datos. No compartas esos links en público: equivalen a
                  acceso a nombre del alumno.
                </li>
              </ol>
            </details>
          </FormSection>
        </Card>
        )}

        <Card>
          <FormSection title="Planes Web">
            <p className="text-sm text-ink-secondary">
              Catálogo del formulario público: Planes Más Completos, Entrenamiento Individual, Nutrición y Psicólogo Deportivo. Fotos del equipo,
              ofertas y textos sin tocar código.
            </p>
            <Button asChild variant="secondary" icon={<LayoutTemplate className="h-4 w-4" />}>
              <Link to="/settings/web-plans">Gestionar Planes Web</Link>
            </Button>
          </FormSection>
        </Card>

        {/* Perfil */}
        <Card>
          {profile && (
            <FormSection title="Tu cuenta">
              <SettingsProfilePhotoSection profile={profile} onUpdated={(p) => setProfile(p)} />
            </FormSection>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className={cn(profile ? 'space-y-6 mt-8 border-t border-surface-border pt-8' : 'space-y-6')}>
            <FormSection title="Datos de perfil">
              <Input label="Nombre completo" required error={errors.full_name?.message} {...register('full_name')} />
              <Input label="Teléfono" type="tel" {...register('phone')} />
              <Input label="Bio / Descripción" {...register('bio')} />
              <Select
                label="Perfil profesional"
                options={[
                  { value: 'trainer', label: 'Entrenador' },
                  { value: 'nutritionist', label: 'Nutricionista' },
                  ...(profile?.role === 'admin' ? [{ value: 'admin', label: 'Admin' }] : []),
                ]}
                hint={profile?.role === 'admin'
                  ? 'El perfil Admin mantiene acceso total y no se puede degradar desde esta pantalla.'
                  : 'Cambia módulos visibles y color principal de la app.'}
                error={errors.role?.message}
                disabled={profile?.role === 'admin'}
                {...register('role')}
              />
            </FormSection>
            <Button type="submit" variant="gradientSecondary" loading={isSubmitting}>
              Guardar cambios
            </Button>
          </form>
        </Card>

      </div>
    </div>
  )
}
