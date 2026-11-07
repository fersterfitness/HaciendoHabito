import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { CalendarPlus, Check, ChevronRight, FileText, UserPlus, X, type LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const HIDDEN_KEY = 'hh-primeros-pasos-oculto'

type Step = { id: string; icon: LucideIcon; title: string; detail: string; href: string; done: boolean }

async function hasAny(table: 'appointments' | 'nutrition_plan_library', ownerId: string) {
  const { data, error } = await supabase.from(table).select('id').eq('owner_id', ownerId).limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

function readHidden() {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * v2 · Inicio del nutricionista recién llegado: los tres pasos para arrancar, en el orden en que se
 * usan. Cada uno se tilda solo cuando ya existe lo que pide; cuando están los tres, desaparece.
 */
export function GettingStartedV2({ ownerId, hasPatients, onGo }: { ownerId: string; hasPatients: boolean; onGo: (href: string) => void }) {
  const [hidden, setHidden] = useState(readHidden)
  const q = useQuery({
    queryKey: ['v2', 'getting-started', ownerId],
    queryFn: async () => {
      const [appointments, templates] = await Promise.all([hasAny('appointments', ownerId), hasAny('nutrition_plan_library', ownerId)])
      return { appointments, templates }
    },
    enabled: !hidden,
    staleTime: 60_000,
  })

  if (hidden || !q.data) return null

  const steps: Step[] = [
    {
      id: 'paciente',
      icon: UserPlus,
      title: 'Cargá tu primer paciente',
      detail: 'En Pacientes queda su ficha: consultas, mediciones y su plan.',
      href: '/nutrition?nuevo=1',
      done: hasPatients,
    },
    {
      id: 'turno',
      icon: CalendarPlus,
      title: 'Agendá un turno',
      detail: 'Desde Turnos. El día anterior te avisamos acá para mandarle el recordatorio.',
      href: '/appointments',
      done: q.data.appointments,
    },
    {
      id: 'plantilla',
      icon: FileText,
      title: 'Armá una plantilla de plan',
      detail: 'Un plan base que después copiás a cada paciente y ajustás.',
      href: '/nutrition/plans',
      done: q.data.templates,
    },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null
  const nextId = steps.find((s) => !s.done)?.id

  const hide = () => {
    setHidden(true)
    try {
      localStorage.setItem(HIDDEN_KEY, '1')
    } catch {
      /* sin almacenamiento: se oculta hasta recargar */
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      aria-label="Primeros pasos"
      className="rounded-2xl border border-surface-border bg-surface-card px-5 pb-3 pt-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-medium text-ink-primary">Primeros pasos</h2>
          <p className="mt-0.5 text-[13px] text-ink-secondary">
            {doneCount} de {steps.length} listos. Con esto ya podés atender tu primera consulta.
          </p>
        </div>
        <button
          type="button"
          onClick={hide}
          className="-mr-2 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink-primary"
          title="Ocultar primeros pasos"
          aria-label="Ocultar primeros pasos"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-elevated" aria-hidden>
        <motion.div
          className="h-full rounded-full bg-pastel-mint-accent"
          initial={{ width: 0 }}
          animate={{ width: `${(doneCount / steps.length) * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
        />
      </div>

      <ol className="mt-2 divide-y divide-surface-border">
        {steps.map((s, i) => {
          const Icon = s.icon
          return (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
            >
              <button
                type="button"
                disabled={s.done}
                onClick={() => onGo(s.href)}
                className="group flex w-full items-center gap-3 py-3 text-left disabled:cursor-default"
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    s.done ? 'bg-pastel-mint text-pastel-mint-ink' : 'bg-surface-elevated text-ink-secondary',
                  )}
                >
                  {s.done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" strokeWidth={1.75} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[14px]', s.done ? 'text-ink-muted line-through' : 'font-medium text-ink-primary')}>{s.title}</span>
                  {s.done ? null : <span className="mt-0.5 block text-[12.5px] text-ink-secondary">{s.detail}</span>}
                </span>
                {s.done ? null : (
                  <span
                    className={cn(
                      'flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                      s.id === nextId ? 'bg-ink-primary text-surface-base' : 'text-ink-secondary group-hover:text-ink-primary',
                    )}
                  >
                    {s.id === nextId ? 'Empezar' : 'Ir'}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
            </motion.li>
          )
        })}
      </ol>
    </motion.section>
  )
}
