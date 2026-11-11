import { useState, type ReactNode } from 'react'
import {
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Columns2,
  ClipboardList,
  Copy,
  FileText,
  Library,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Table2,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { IS_V2 } from '@/lib/uiVersion'
import { Popover } from '@/components/ui/Popover'
import { Spinner } from '@/components/ui/Spinner'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { TRAINER_CONTACT_WHATSAPP_DISPLAY } from '@/lib/trainerContact'
import { cn } from '@/lib/utils'

const ghostBtn =
  'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-surface-elevated hover:text-ink-primary disabled:opacity-50'

type Props = {
  isLibrary: boolean
  hasBlocks: boolean
  hasStudent: boolean
  completed: boolean
  exportingProgressLog: boolean
  sendingWa: boolean
  canSendWa: boolean
  generatingPdf: boolean
  onGuide: () => void
  onVolume: () => void
  /** v2 · Pantalla dividida con otra rutina del alumno. */
  canCompare?: boolean
  comparing?: boolean
  onCompare?: () => void
  onMacro: () => void
  onProgressLog: () => void
  onToggleCompleted: () => void
  onEdit: () => void
  onDuplicate: () => void
  onAssign: () => void
  onSaveVariant: () => void
  onWhatsApp: () => void
  onPdf: () => void
  onDelete: () => void
}

/**
 * Acciones de la cabecera de la rutina. Lo de todos los días queda a la vista (guía, volumen,
 * calendario, realizada, WhatsApp, PDF); lo ocasional va a «Más» para que no se amontone ni se corte en el celu.
 */
export function RoutineHeaderActions(p: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  function run(fn: () => void) {
    setMenuOpen(false)
    fn()
  }

  return (
    <div className="flex items-center gap-1">
      <div className={IS_V2 ? 'hidden' : 'hidden items-center gap-0.5 sm:flex'}>
        <button type="button" onClick={p.onGuide} disabled={!p.hasBlocks} className={ghostBtn} title="Guía semanal de progresión (solo entrenador)">
          <Table2 className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Guía semanal</span>
        </button>
        <button type="button" onClick={p.onVolume} disabled={!p.hasBlocks} className={ghostBtn} title="Volumen semanal por músculo (solo entrenador)">
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Volumen</span>
        </button>
        {p.hasStudent ? (
          <button type="button" onClick={p.onMacro} className={ghostBtn} title="Calendario anual del macrociclo del alumno (solo entrenador)">
            <CalendarRange className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Calendario</span>
          </button>
        ) : null}
        <span className="mx-1 h-5 w-px bg-surface-border" aria-hidden />
      </div>

      {IS_V2 ? (
        <button
          type="button"
          onClick={p.onVolume}
          disabled={!p.hasBlocks}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-surface-elevated px-2.5 py-1.5 text-xs font-medium text-ink-primary transition-colors hover:bg-surface-border/60 disabled:opacity-50"
          title={p.hasBlocks ? 'Volumen semanal: series por músculo y mapa del cuerpo' : 'Cargá semanas para ver el volumen'}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Volumen</span>
        </button>
      ) : null}

      {IS_V2 && p.canCompare && p.onCompare ? (
        <button
          type="button"
          onClick={p.onCompare}
          aria-pressed={!!p.comparing}
          className={cn(
            'hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors lg:flex',
            p.comparing ? 'bg-ink-primary text-surface-card' : 'bg-surface-elevated text-ink-primary hover:bg-surface-border/60',
          )}
          title={p.comparing ? 'Cerrar la comparación' : 'Ver otra rutina del alumno al lado, para armar esta mirando la anterior'}
        >
          <Columns2 className="h-3.5 w-3.5" />
          <span>Comparar</span>
        </button>
      ) : null}

      {p.isLibrary ? (
        <button
          type="button"
          onClick={p.onAssign}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-primary/12 px-2.5 py-1.5 text-xs font-medium text-brand-primary transition-colors hover:bg-brand-primary/20"
          title="Asignar esta preestablecida a un alumno"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Asignar a un alumno</span>
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={p.onToggleCompleted}
            className={cn(
              'hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors sm:flex',
              p.completed
                ? 'bg-surface-elevated text-ink-secondary hover:text-ink-primary'
                : 'bg-surface-elevated text-ink-primary hover:bg-surface-border/60 [&_svg]:text-emerald-600 dark:[&_svg]:text-emerald-400',
            )}
            title={p.completed ? 'Reactivar: volver a rutinas activas' : 'Marcar como realizada y mover al historial del alumno'}
          >
            {p.completed ? <RefreshCw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">{p.completed ? 'Reactivar' : 'Rutina realizada'}</span>
          </button>
          <button
            type="button"
            onClick={p.onWhatsApp}
            disabled={p.sendingWa || !p.canSendWa}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 bg-surface-elevated text-ink-primary hover:bg-surface-border/60 [&_svg]:text-emerald-600 dark:[&_svg]:text-emerald-400"
            title={
              IS_V2
                ? 'Le llega el link de la rutina para verla en el celu, sin cuenta, con el feedback de la semana.'
                : `Enviar rutina por WhatsApp (${TRAINER_CONTACT_WHATSAPP_DISPLAY})`
            }
          >
            {p.sendingWa ? <Spinner className="h-3.5 w-3.5" /> : <WhatsAppIcon className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">{p.sendingWa ? 'Enviando…' : 'WhatsApp'}</span>
          </button>
          <button
            type="button"
            onClick={p.onPdf}
            disabled={p.generatingPdf}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
              p.generatingPdf ? 'bg-brand-primary/12 text-brand-primary' : 'bg-surface-elevated text-ink-secondary hover:text-ink-primary',
            )}
            title="Generar PDF"
          >
            {p.generatingPdf ? <Spinner className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">{p.generatingPdf ? 'Generando…' : 'PDF'}</span>
          </button>
        </>
      )}

      <Popover
        open={menuOpen}
        onOpenChange={setMenuOpen}
        align="end"
        className="w-56"
        trigger={({ ref, onClick, ...a11y }) => (
          <button ref={ref} type="button" onClick={onClick} className={ghostBtn} title="Más acciones" aria-label="Más acciones" {...a11y}>
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      >
        <div className="py-1">
          <div className={IS_V2 ? undefined : 'sm:hidden'}>
            <MenuItem icon={<Table2 />} disabled={!p.hasBlocks} onClick={() => run(p.onGuide)}>Guía semanal</MenuItem>
            {IS_V2 ? null : (
              <MenuItem icon={<BarChart3 />} disabled={!p.hasBlocks} onClick={() => run(p.onVolume)}>Volumen</MenuItem>
            )}
            {p.hasStudent ? <MenuItem icon={<CalendarRange />} onClick={() => run(p.onMacro)}>Calendario</MenuItem> : null}
            {!p.isLibrary ? (
              <div className={IS_V2 ? 'sm:hidden' : undefined}>
                <MenuItem icon={p.completed ? <RefreshCw /> : <CheckCircle2 />} onClick={() => run(p.onToggleCompleted)}>
                  {p.completed ? 'Reactivar rutina' : 'Marcar rutina realizada'}
                </MenuItem>
              </div>
            ) : null}
            <MenuDivider />
          </div>
          {!p.isLibrary ? (
            <MenuItem
              icon={p.exportingProgressLog ? <Spinner /> : <ClipboardList />}
              disabled={p.exportingProgressLog || !p.hasBlocks}
              onClick={() => run(p.onProgressLog)}
              hint="PDF para anotar pesos y sensaciones"
            >
              Registro de progreso
            </MenuItem>
          ) : null}
          <MenuItem icon={<Pencil />} onClick={() => run(p.onEdit)}>Editar datos</MenuItem>
          {!p.isLibrary ? (
            <>
              <MenuItem icon={<Copy />} onClick={() => run(p.onDuplicate)}>Duplicar rutina</MenuItem>
              <MenuItem icon={<Library />} onClick={() => run(p.onSaveVariant)}>Guardar como variante</MenuItem>
            </>
          ) : null}
          <MenuDivider />
          <MenuItem icon={<Trash2 />} danger onClick={() => run(p.onDelete)}>Eliminar rutina</MenuItem>
        </div>
      </Popover>
    </div>
  )
}

function MenuItem({
  icon,
  children,
  hint,
  danger,
  disabled,
  onClick,
}: {
  icon: ReactNode
  children: ReactNode
  hint?: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-2.5 px-3 py-2 text-left text-xs transition-colors disabled:opacity-50 [&_svg]:mt-px [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0',
        danger ? 'text-status-expired hover:bg-status-expired/10' : 'text-ink-primary hover:bg-surface-elevated',
      )}
    >
      <span className={danger ? undefined : 'text-ink-muted'}>{icon}</span>
      <span className="min-w-0">
        <span className="block font-medium">{children}</span>
        {hint ? <span className="block text-3xs text-ink-muted">{hint}</span> : null}
      </span>
    </button>
  )
}

function MenuDivider() {
  return <div className="my-1 h-px bg-surface-border/70" aria-hidden />
}
