import { useEffect, useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowDown, ArrowUp, ArrowUpRight, Check, Columns3, Minus, X } from 'lucide-react'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import { Popover } from '@/components/ui/Popover'
import { Skeleton } from '@/components/ui/Skeleton'
import { NUTRITION_CONTROL_OVERDUE_DAYS } from '@/lib/dashboard/nutritionistOps'
import { cn } from '@/lib/utils'
import type { NutritionAttendanceStatus, NutritionPatientFollowup } from '@/types/database'
import { ATTENDANCE_LABELS, formatNextConsult, type NutritionFollowupRow } from './NutritionPatientDirectory'

/**
 * Pacientes en tabla (v2, desde tablet) sobre TanStack Table: columnas ordenables y ocultables,
 * selección con acciones en lote, fechas que se editan al tocarlas y la tendencia de peso.
 * El color queda para lo que pide atención.
 */

const DAY = 86_400_000
const VISIBILITY_KEY = 'hh-patients-table-columns'

function daysSince(iso: string | null | undefined) {
  if (!iso) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - parseISO(iso).getTime()) / DAY)
}

const shortDate = (iso: string) => format(parseISO(iso), 'd MMM yy', { locale: es })

function agoText(days: number) {
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 60) return `hace ${days} días`
  return `hace ${Math.round(days / 30)} meses`
}

const nf = (n: number, d = 1) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d })

/** Fecha que se ve como texto y se vuelve campo al tocarla. */
function DateCell({
  value,
  sub,
  alert,
  label,
  onChange,
}: {
  value: string | null
  sub?: string | null
  alert?: boolean
  label: string
  onChange: (next: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        aria-label={label}
        defaultValue={value ?? ''}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape' || e.key === 'Enter') setEditing(false)
        }}
        onChange={(e) => onChange(e.target.value || null)}
        onBlur={() => setEditing(false)}
        className="h-8 w-[9.5rem] rounded-lg border border-surface-inputBorder bg-surface-input px-2 text-[13px] text-ink-primary"
      />
    )
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
      title={`Cambiar ${label.toLowerCase()}`}
      className="-mx-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-elevated"
    >
      {value ? (
        <span className="block text-[13px] tabular-nums text-ink-primary">{shortDate(value)}</span>
      ) : (
        // Vacío: un guion; «Agregar» aparece recién al pasar por la fila.
        <span className="block text-[13px] text-ink-muted">
          <span className="group-hover:hidden group-focus-within:hidden">—</span>
          <span className="hidden group-hover:inline group-focus-within:inline">Agregar</span>
        </span>
      )}
      {sub ? <span className={cn('block text-[12px]', alert ? 'text-status-expired' : 'text-ink-muted')}>{sub}</span> : null}
    </button>
  )
}

function StatusChip({ row }: { row: NutritionFollowupRow }) {
  const next = formatNextConsult(row.followup?.next_consultation_date ?? null)
  const [text, cls] =
    next.tone === 'past'
      ? ['Atrasado', 'bg-status-expired/10 text-status-expired']
      : next.tone === 'soon'
        ? ['Esta semana', 'bg-surface-elevated text-ink-primary']
        : next.tone === 'far'
          ? ['Con turno', 'bg-surface-elevated text-ink-secondary']
          : ['Sin turno', 'text-ink-muted']
  return <span className={cn('inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium', cls)}>{text}</span>
}

/**
 * Tablet en vertical (menos de lg): se ocultan Estado (lo mismo que dice Próximo turno) y Última consulta,
 * así entran turno, control y peso sin desplazar la tabla.
 */
const NARROW_HIDDEN = new Set(['status', 'last'])

/** Línea suave entre columnas de datos (no junto al tilde ni a la flecha de abrir). */
const COLUMN_DIVIDER = (id: string) => (id === 'select' || id === 'name' || id === 'open' ? null : 'border-l border-surface-border/70')

function Checkbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className={cn(
        'inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-colors',
        checked || indeterminate
          ? 'border-ink-primary bg-ink-primary text-surface-card'
          : 'border-surface-inputBorder bg-surface-card text-transparent hover:border-ink-muted',
      )}
    >
      {indeterminate ? <Minus className="h-3 w-3" strokeWidth={3} /> : <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  )
}

const COLUMN_LABEL: Record<string, string> = {
  status: 'Estado',
  next: 'Próximo turno',
  last: 'Última consulta',
  control: 'Último control',
  weight: 'Peso',
}

function readVisibility(): VisibilityState {
  try {
    const raw = localStorage.getItem(VISIBILITY_KEY)
    return raw ? (JSON.parse(raw) as VisibilityState) : {}
  } catch {
    return {}
  }
}

interface Props {
  rows: NutritionFollowupRow[]
  selectedPatientId?: string | null
  onOpen: (id: string) => void
  onUpdateFollowup: (studentId: string, patch: Partial<NutritionPatientFollowup>) => void
  onAvatarChange: (studentId: string, avatarPath: string | null) => void
  className?: string
}

export function NutritionPatientTable({ rows, selectedPatientId = null, onOpen, onUpdateFollowup, onAvatarChange, className }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(readVisibility)
  const [columnsOpen, setColumnsOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(VISIBILITY_KEY, JSON.stringify(columnVisibility))
    } catch {
      /* sin almacenamiento: vale para esta sesión */
    }
  }, [columnVisibility])

  // Si un filtro saca filas de la vista, dejan de estar seleccionadas.
  useEffect(() => {
    const ids = new Set(rows.map((r) => r.id))
    setRowSelection((sel) => Object.fromEntries(Object.entries(sel).filter(([id]) => ids.has(id))))
  }, [rows])

  const columns = useMemo<ColumnDef<NutritionFollowupRow>[]>(
    () => [
      {
        id: 'select',
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            label="Seleccionar todos"
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={() => table.toggleAllRowsSelected(!table.getIsAllRowsSelected())}
          />
        ),
        cell: ({ row }) => <Checkbox label={`Seleccionar a ${row.original.full_name}`} checked={row.getIsSelected()} onChange={() => row.toggleSelected()} />,
      },
      {
        id: 'name',
        header: 'Paciente',
        enableHiding: false,
        accessorFn: (r) => r.full_name,
        sortingFn: (a, b) => a.original.full_name.localeCompare(b.original.full_name, 'es'),
        sortDescFirst: false,
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="flex min-w-0 items-center gap-3">
              <StudentAvatar
                studentId={r.id}
                fullName={r.full_name}
                avatarPath={r.avatar_path}
                size="sm"
                stopRowNavigation
                onPathChange={(path) => onAvatarChange(r.id, path)}
              />
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-ink-primary">{r.full_name}</p>
                {r.selectedWebPlanLabel ? <p className="text-[12px] text-ink-muted">{r.selectedWebPlanLabel}</p> : null}
              </div>
            </div>
          )
        },
      },
      {
        id: 'status',
        header: 'Estado',
        accessorFn: (r) => {
          const tone = formatNextConsult(r.followup?.next_consultation_date ?? null).tone
          return { past: 0, soon: 1, far: 2, none: 3 }[tone]
        },
        cell: ({ row }) => <StatusChip row={row.original} />,
      },
      {
        id: 'next',
        header: 'Próximo turno',
        accessorFn: (r) => r.followup?.next_consultation_date ?? undefined,
        sortingFn: 'basic',
        sortUndefined: 'last',
        cell: ({ row }) => {
          const r = row.original
          const next = formatNextConsult(r.followup?.next_consultation_date ?? null)
          return (
            <DateCell
              label="Próximo turno"
              value={r.followup?.next_consultation_date ?? null}
              sub={next.tone === 'none' ? null : next.sub}
              alert={next.tone === 'past'}
              onChange={(v) => onUpdateFollowup(r.id, { next_consultation_date: v })}
            />
          )
        },
      },
      {
        id: 'last',
        header: 'Última consulta',
        accessorFn: (r) => r.followup?.last_consultation_date ?? undefined,
        sortingFn: 'basic',
        sortUndefined: 'last',
        cell: ({ row }) => {
          const r = row.original
          const days = daysSince(r.followup?.last_consultation_date)
          const att = r.followup?.attendance_status
          return (
            <DateCell
              label="Última consulta"
              value={r.followup?.last_consultation_date ?? null}
              sub={days != null ? `${agoText(days)}${att && att !== 'ST' ? ` · ${ATTENDANCE_LABELS[att].toLowerCase()}` : ''}` : null}
              onChange={(v) => onUpdateFollowup(r.id, { last_consultation_date: v })}
            />
          )
        },
      },
      {
        id: 'control',
        header: 'Último control',
        accessorFn: (r) => r.lastControl?.date ?? undefined,
        sortingFn: 'basic',
        sortUndefined: 'last',
        cell: ({ row }) => {
          const c = row.original.lastControl
          if (!c) return <span className="text-[13px] text-ink-muted">Sin controles</span>
          const days = daysSince(c.date) ?? 0
          return (
            <>
              <span className="block text-[13px] tabular-nums text-ink-primary">{shortDate(c.date)}</span>
              <span className={cn('block text-[12px]', days > NUTRITION_CONTROL_OVERDUE_DAYS ? 'text-status-expired' : 'text-ink-muted')}>{agoText(days)}</span>
            </>
          )
        },
      },
      {
        id: 'weight',
        header: 'Peso',
        accessorFn: (r) => r.lastControl?.weight ?? undefined,
        sortingFn: 'basic',
        sortUndefined: 'last',
        cell: ({ row }) => {
          const c = row.original.lastControl
          if (c?.weight == null) return <span className="text-[13px] text-ink-muted">—</span>
          return (
            <div>
              <span className="block text-[13px] tabular-nums text-ink-primary">{nf(c.weight)} kg</span>
              {c.weightDelta != null ? (
                <span className="block text-[12px] tabular-nums text-ink-muted">
                  {c.weightDelta > 0 ? '+' : c.weightDelta < 0 ? '−' : '±'}
                  {nf(Math.abs(c.weightDelta))} kg
                </span>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'open',
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">Abrir</span>,
        cell: () => (
          <ArrowUpRight
            className="ml-auto h-4 w-4 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            strokeWidth={1.6}
            aria-hidden
          />
        ),
      },
    ],
    [onAvatarChange, onUpdateFollowup],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, rowSelection, columnVisibility },
    getRowId: (r) => r.id,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    sortDescFirst: false,
  })

  const selected = table.getSelectedRowModel().rows
  const setAttendance = (status: NutritionAttendanceStatus) => {
    for (const r of selected) onUpdateFollowup(r.original.id, { attendance_status: status })
    setRowSelection({})
  }

  return (
    <div className={cn('relative', className)}>
      <div className="mb-2 flex items-center justify-end gap-3 px-0.5">
        <Popover
          open={columnsOpen}
          onOpenChange={setColumnsOpen}
          align="end"
          className="w-52 p-1"
          trigger={(t) => (
            <button
              {...t}
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium text-ink-secondary transition-colors hover:bg-surface-elevated hover:text-ink-primary"
            >
              <Columns3 className="h-3.5 w-3.5" strokeWidth={1.8} />
              Columnas
            </button>
          )}
        >
          {table
            .getAllLeafColumns()
            .filter((c) => c.getCanHide())
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => c.toggleVisibility()}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-ink-primary hover:bg-surface-elevated"
              >
                <Check className={cn('h-3.5 w-3.5', c.getIsVisible() ? 'text-ink-primary' : 'text-transparent')} />
                {COLUMN_LABEL[c.id] ?? c.id}
              </button>
            ))}
        </Popover>
      </div>

      {/* Las celdas no parten el texto: si no entra, la tabla se desplaza a lo ancho. */}
      <div className="overflow-clip rounded-2xl border border-surface-border bg-surface-card shadow-[0_1px_2px_rgb(46_33_54/0.04),0_12px_32px_-16px_rgb(46_33_54/0.18)] dark:border-white/[0.07] dark:bg-surface-panel dark:shadow-[0_16px_40px_-16px_rgb(0_0_0/0.7)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse lg:min-w-[760px] whitespace-nowrap text-left">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => {
                    const sorted = h.column.getIsSorted()
                    const Arrow = sorted === 'desc' ? ArrowDown : ArrowUp
                    return (
                      <th
                        key={h.id}
                        scope="col"
                        aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                        className={cn(
                          'sticky top-0 z-[1] whitespace-nowrap border-b border-surface-border bg-surface-panel px-3 dark:bg-surface-elevated py-2.5 text-[12px] font-medium text-ink-muted first:rounded-tl-2xl last:rounded-tr-2xl',
                          h.column.id === 'select' && 'w-10 pl-4 pr-1',
                          h.column.id === 'open' && 'w-10',
                          COLUMN_DIVIDER(h.column.id),
                          NARROW_HIDDEN.has(h.column.id) && 'max-lg:hidden',
                        )}
                      >
                        {h.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={h.column.getToggleSortingHandler()}
                            className={cn('group/sort inline-flex items-center gap-1 transition-colors hover:text-ink-primary', sorted && 'text-ink-primary')}
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            <Arrow className={cn('h-3 w-3 transition-opacity', sorted ? 'opacity-100' : 'opacity-0 group-hover/sort:opacity-40')} aria-hidden />
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const isOpen = row.original.id === selectedPatientId
                return (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    aria-selected={row.getIsSelected()}
                    onClick={() => onOpen(row.original.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(row.original.id)
                    }}
                    className={cn(
                      'group cursor-pointer border-b border-surface-border/70 transition-colors last:border-b-0',
                      'hover:bg-surface-panel focus-visible:bg-surface-panel focus-visible:outline-none dark:hover:bg-surface-elevated/60 dark:focus-visible:bg-surface-elevated/60',
                      (isOpen || row.getIsSelected()) && 'bg-surface-elevated/70 hover:bg-surface-elevated/70 dark:bg-surface-elevated dark:hover:bg-surface-elevated',
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          'px-3 py-2',
                          cell.column.id === 'select' && 'pl-4 pr-1',
                          cell.column.id === 'open' && 'text-right',
                          COLUMN_DIVIDER(cell.column.id),
                          NARROW_HIDDEN.has(cell.column.id) && 'max-lg:hidden',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Acciones en lote */}
      {selected.length ? (
        <div className="pointer-events-none sticky bottom-4 z-[2] mt-3 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-surface-border bg-surface-card py-1 pl-4 pr-1 shadow-[var(--shadow-lg)]">
            <span className="mr-2 text-[13px] font-medium text-ink-primary">
              {selected.length} {selected.length === 1 ? 'seleccionado' : 'seleccionados'}
            </span>
            <button type="button" onClick={() => setAttendance('P')} className="h-8 rounded-full px-3 text-[13px] text-ink-primary hover:bg-surface-elevated">
              Asistió
            </button>
            <button type="button" onClick={() => setAttendance('A')} className="h-8 rounded-full px-3 text-[13px] text-ink-primary hover:bg-surface-elevated">
              No asistió
            </button>
            <button
              type="button"
              onClick={() => setRowSelection({})}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-elevated hover:text-ink-primary"
              aria-label="Quitar selección"
              title="Quitar selección"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Carga de la tabla: mismas columnas y alturas, para que no salte al aparecer (en el celu, filas de lista). */
export function NutritionPatientTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Cargando pacientes">
      <div className="mb-2 flex h-8 items-center justify-end px-0.5">
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
        <div className="flex items-center gap-6 border-b border-surface-border px-4 py-3 max-sm:hidden">
          <Skeleton className="h-[18px] w-[18px] rounded-[5px]" />
          {['w-16', 'w-12', 'w-20', 'w-20', 'w-20', 'w-10'].map((w, i) => (
            <Skeleton key={i} className={cn('h-2.5', w, i === 0 ? 'mr-24' : 'mr-10', i >= 4 && 'max-lg:hidden')} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-surface-border/70 px-4 py-3 last:border-b-0">
            <Skeleton className="h-[18px] w-[18px] shrink-0 rounded-[5px] max-sm:hidden" />
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="w-40 space-y-1.5 sm:w-48">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2.5 w-2/3" />
            </div>
            <div className="ml-auto flex items-center gap-10 max-sm:hidden sm:ml-6">
              <Skeleton className="h-6 w-20 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-2.5 w-12" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-2.5 w-14" />
              </div>
              <div className="space-y-1.5 max-lg:hidden">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-2.5 w-14" />
              </div>
              <Skeleton className="h-5 w-24 max-lg:hidden" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
