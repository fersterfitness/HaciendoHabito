import { controlMdClassName } from '@/lib/formControlClasses'
import { useEffect, useMemo, useState } from 'react'
import { Search, Snowflake, Sun, Calendar, Flame, Wheat, Copy, ChevronRight } from 'lucide-react'
import { DirectoryPageShell } from '@/components/directory/DirectoryPageShell'
import { Header } from '@/components/layout/Header'
import { IS_V2 } from '@/lib/uiVersion'
import { AiMarkdown } from '@/components/nutrition/AnthropometryAiMarkdown'
import { MenuPatientPicker, SeasonalMenusV2 } from '@/components/nutrition/SeasonalMenusV2'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { CustomMenuEditor } from '@/components/nutrition/CustomMenuEditor'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  CUSTOM_MENUS_SQL_HINT,
  deleteCustomMenu,
  draftFromMenu,
  emptyMenuDraft,
  isCustomMenuId,
  listCustomMenus,
  saveCustomMenu,
  type MenuDraft,
} from '@/lib/nutrition/customMenus'
import { useAuthStore } from '@/stores/authStore'
import { nutritionShellClass } from '@/lib/nutrition/nutritionAreaUi'
import { NutritionLibraryTabs } from '@/components/nutrition/NutritionLibraryTabs'
import { Card, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  SEASONAL_MENU_TEMPLATES,
  PATHOLOGY_LABELS,
  TOLERANCE_LABELS,
  SEASON_LABELS,
  type MenuSeason,
  type DigestiveTolerance,
  type PathologyTag,
  type SeasonalMenuTemplate,
} from '@/lib/nutrition/seasonalMenuLibrary'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type SeasonFilter = MenuSeason | 'todas'
type PathologyFilter = PathologyTag | 'todas'
type ToleranceFilter = DigestiveTolerance | 'todas'

const SEASON_FILTERS: { id: SeasonFilter; label: string; icon: React.ReactNode }[] = [
  { id: 'todas', label: 'Todas', icon: <Calendar className="h-3.5 w-3.5" /> },
  { id: 'invierno', label: 'Invierno', icon: <Snowflake className="h-3.5 w-3.5" /> },
  { id: 'verano', label: 'Verano', icon: <Sun className="h-3.5 w-3.5" /> },
  { id: 'todo-el-anio', label: 'Todo el año', icon: <Calendar className="h-3.5 w-3.5" /> },
]

export function NutritionSeasonalMenusPage() {
  const [season, setSeason] = useState<SeasonFilter>('todas')
  const [pathology, setPathology] = useState<PathologyFilter>('todas')
  const [tolerance, setTolerance] = useState<ToleranceFilter>('todas')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [useMenu, setUseMenu] = useState<SeasonalMenuTemplate | null>(null)
  const navigate = useAppNavigate()
  const { user, profile } = useAuthStore()
  const isNutritionist = profile?.role === 'nutritionist'
  // v2: menús propios del profesional, además de los que trae la app.
  const [customMenus, setCustomMenus] = useState<SeasonalMenuTemplate[]>([])
  const [customAvailable, setCustomAvailable] = useState(true)
  const [editing, setEditing] = useState<MenuDraft | null>(null)
  const [savingMenu, setSavingMenu] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SeasonalMenuTemplate | null>(null)

  useEffect(() => {
    if (!IS_V2 || !user) return
    let cancelled = false
    void listCustomMenus(user.id).then(({ menus, available }) => {
      if (cancelled) return
      setCustomMenus(menus)
      setCustomAvailable(available)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const allMenus = useMemo(() => [...customMenus, ...SEASONAL_MENU_TEMPLATES], [customMenus])

  function startEditing(draft: MenuDraft) {
    if (!customAvailable) {
      toast.error(CUSTOM_MENUS_SQL_HINT)
      return
    }
    setOpenId(null)
    setEditing(draft)
  }

  async function saveMenu(menu: Omit<SeasonalMenuTemplate, 'id'> & { id?: string }) {
    if (!user) return
    setSavingMenu(true)
    const { menu: saved, error } = await saveCustomMenu(user.id, menu)
    setSavingMenu(false)
    if (!saved) {
      toast.error(error ?? 'No se pudo guardar el menú')
      return
    }
    setCustomMenus((prev) => [saved, ...prev.filter((m) => m.id !== saved.id)])
    setEditing(null)
    toast.success(menu.id ? 'Menú actualizado' : 'Menú guardado en tu biblioteca')
  }

  async function removeMenu(menu: SeasonalMenuTemplate) {
    if (!user) return
    const error = await deleteCustomMenu(user.id, menu.id)
    if (error) {
      toast.error(error)
      return
    }
    setCustomMenus((prev) => prev.filter((m) => m.id !== menu.id))
    setOpenId(null)
    toast.success('Menú borrado')
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allMenus.filter((m) => {
      if (season !== 'todas' && m.season !== season) return false
      if (pathology !== 'todas' && !m.pathologies.includes(pathology)) return false
      if (tolerance !== 'todas' && m.tolerance !== tolerance) return false
      if (q) {
        const hay =
          m.title.toLowerCase().includes(q) ||
          m.summary.toLowerCase().includes(q) ||
          m.pathologies.some((p) => PATHOLOGY_LABELS[p].toLowerCase().includes(q))
        if (!hay) return false
      }
      return true
    })
  }, [allMenus, season, pathology, tolerance, search])

  const opened = useMemo(() => filtered.find((m) => m.id === openId) ?? null, [filtered, openId])

  function copyToClipboard(template: SeasonalMenuTemplate) {
    void navigator.clipboard
      .writeText(`# ${template.title}\n\n${template.bodyMd}`)
      .then(() => toast.success('Menú copiado al portapapeles'))
      .catch(() => toast.error('No se pudo copiar al portapapeles'))
  }

  function resetFilters() {
    setSeason('todas')
    setPathology('todas')
    setTolerance('todas')
    setSearch('')
  }

  const hasActiveFilters =
    season !== 'todas' || pathology !== 'todas' || tolerance !== 'todas' || search.trim().length > 0

  return (
    <div>
      <Header title={IS_V2 ? (isNutritionist ? 'Menús' : 'Alimentos y menús') : 'Biblioteca'} />
      <DirectoryPageShell className={nutritionShellClass}>
        <NutritionLibraryTabs />
        {IS_V2 ? (
          <SeasonalMenusV2
            all={allMenus}
            filtered={filtered}
            season={season}
            onSeason={setSeason}
            pathology={pathology}
            onPathology={setPathology}
            tolerance={tolerance}
            onTolerance={setTolerance}
            search={search}
            onSearch={setSearch}
            hasActiveFilters={hasActiveFilters}
            onReset={resetFilters}
            onOpen={setOpenId}
            onCopy={copyToClipboard}
            onUse={setUseMenu}
            onNew={() => startEditing(emptyMenuDraft())}
          />
        ) : (
          <>
        <Card>
          <CardTitle className="mb-2">Biblioteca de menús</CardTitle>
          <p className="text-sm text-ink-secondary leading-relaxed">
            Plantillas con porciones, gramaje y medidas caseras. Filtrá por temporada, patología y tolerancia
            digestiva. Copiá el menú al portapapeles y adaptalo en el plan del paciente.
          </p>
        </Card>

        {/* Filtros */}
        <Card>
          <div className="space-y-4">
            <div>
              <p className="text-3xs font-semibold text-ink-muted mb-2">
                Temporada
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SEASON_FILTERS.map((f) => (
                  <FilterChip
                    key={f.id}
                    active={season === f.id}
                    onClick={() => setSeason(f.id)}
                    icon={f.icon}
                  >
                    {f.label}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-3xs font-semibold text-ink-muted mb-2 flex items-center gap-1.5">
                  <Wheat className="h-3 w-3" /> Patología
                </p>
                <select
                  value={pathology}
                  onChange={(e) => setPathology(e.target.value as PathologyFilter)}
                  className={cn(controlMdClassName, 'w-full cursor-pointer')}
                >
                  <option value="todas">Todas las patologías</option>
                  {(Object.keys(PATHOLOGY_LABELS) as PathologyTag[]).map((p) => (
                    <option key={p} value={p}>
                      {PATHOLOGY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-3xs font-semibold text-ink-muted mb-2 flex items-center gap-1.5">
                  <Flame className="h-3 w-3" /> Tolerancia digestiva
                </p>
                <select
                  value={tolerance}
                  onChange={(e) => setTolerance(e.target.value as ToleranceFilter)}
                  className={cn(controlMdClassName, 'w-full cursor-pointer')}
                >
                  <option value="todas">Cualquier tolerancia</option>
                  {(Object.keys(TOLERANCE_LABELS) as DigestiveTolerance[]).map((t) => (
                    <option key={t} value={t}>
                      {TOLERANCE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Buscar por nombre, patología o palabra clave..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>
              {hasActiveFilters ? (
                <Button type="button" size="sm" variant="ghost" onClick={resetFilters}>
                  Limpiar filtros
                </Button>
              ) : null}
            </div>
          </div>
        </Card>

        <p className="text-xs text-ink-muted">
          {filtered.length === SEASONAL_MENU_TEMPLATES.length
            ? `${filtered.length} menú${filtered.length === 1 ? '' : 's'} disponible${filtered.length === 1 ? '' : 's'}`
            : `${filtered.length} de ${SEASONAL_MENU_TEMPLATES.length} menús`}
        </p>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Wheat className="h-8 w-8" />}
            title="Sin menús con esos filtros"
            description="Probá quitar algún filtro o usar otra combinación."
          />
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((m) => (
              <Card key={m.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <SeasonBadge season={m.season} />
                  <ToleranceBadge tolerance={m.tolerance} />
                </div>

                <CardTitle className="text-base mb-1.5 leading-tight">{m.title}</CardTitle>
                <p className="text-xs text-ink-secondary mb-3 leading-relaxed">{m.summary}</p>

                {m.approximateKcal ? (
                  <p className="text-2xs text-ink-muted mb-3">
                    <span className="font-medium">~{m.approximateKcal} kcal/día</span>
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-1 mb-4">
                  {m.pathologies.map((p) => (
                    <span
                      key={p}
                      className={IS_V2 ? 'inline-flex items-center rounded-md bg-surface-elevated px-1.5 py-0.5 text-3xs text-ink-secondary' : 'inline-flex items-center text-3xs px-1.5 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary dark:text-brand-primary border border-brand-primary/15'}
                    >
                      {PATHOLOGY_LABELS[p]}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    icon={<ChevronRight className="h-3.5 w-3.5" />}
                    iconPosition="right"
                    onClick={() => setOpenId(m.id)}
                  >
                    Ver detalle
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={<Copy className="h-3.5 w-3.5" />}
                    onClick={() => copyToClipboard(m)}
                  >
                    Copiar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
          </>
        )}

        {opened ? (
          <MenuDetailModal
            template={opened}
            onClose={() => setOpenId(null)}
            onCopy={copyToClipboard}
            onUse={
              IS_V2
                ? (t) => {
                    setOpenId(null)
                    setUseMenu(t)
                  }
                : undefined
            }
            onEdit={IS_V2 ? (t) => startEditing(draftFromMenu(t, !isCustomMenuId(t.id))) : undefined}
            onDelete={IS_V2 && isCustomMenuId(opened.id) ? setDeleteTarget : undefined}
          />
        ) : null}
        <ConfirmDialog
          open={deleteTarget != null}
          requireConfirm
          title="Borrar menú"
          description={deleteTarget ? `«${deleteTarget.title}» se borra de tu biblioteca. Los planes que ya armaste con él no cambian.` : undefined}
          confirmLabel="Borrar"
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            const target = deleteTarget
            setDeleteTarget(null)
            if (target) void removeMenu(target)
          }}
        />
        {IS_V2 ? <CustomMenuEditor initial={editing} saving={savingMenu} onClose={() => setEditing(null)} onSave={(m) => void saveMenu(m)} /> : null}
        {IS_V2 ? (
          <MenuPatientPicker
            menu={useMenu}
            onClose={() => setUseMenu(null)}
            onPick={(studentId) => {
              const id = useMenu?.id
              setUseMenu(null)
              if (id) navigate(`/nutrition/${studentId}?tab=plan&menu=${encodeURIComponent(id)}`)
            }}
          />
        ) : null}
      </DirectoryPageShell>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-brand-secondary bg-brand-secondary/10 text-brand-secondary'
          : 'border-surface-border/70 text-ink-muted hover:border-surface-border hover:text-ink-secondary',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function SeasonBadge({ season }: { season: MenuSeason }) {
  const icon =
    season === 'invierno' ? <Snowflake className="h-3 w-3" /> :
    season === 'verano' ? <Sun className="h-3 w-3" /> :
    <Calendar className="h-3 w-3" />

  const color = IS_V2
    ? cn('hh-pastel border-transparent', season === 'invierno' ? 'bg-pastel-lavender text-pastel-lavender-ink' : season === 'verano' ? 'bg-pastel-butter text-pastel-butter-ink' : 'bg-pastel-mint text-pastel-mint-ink')
    : season === 'invierno'
      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/15'
      : season === 'verano'
        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/15'
        : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/15'

  return (
    <span className={cn('inline-flex items-center gap-1 text-3xs px-2 py-0.5 rounded-md border', color)}>
      {icon} {SEASON_LABELS[season]}
    </span>
  )
}

function ToleranceBadge({ tolerance }: { tolerance: DigestiveTolerance }) {
  const map: Record<DigestiveTolerance, { label: string; color: string }> = {
    baja: { label: 'Tol. BAJA', color: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/15' },
    media: { label: 'Tol. MEDIA', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/15' },
    alta: { label: 'Tol. ALTA', color: 'bg-brand-primary/10 text-brand-primary dark:text-brand-primary border-brand-primary/15' },
  }
  const item = map[tolerance]
  if (IS_V2) {
    const tone = tolerance === 'baja' ? 'bg-pastel-rose text-pastel-rose-ink' : tolerance === 'media' ? 'bg-pastel-butter text-pastel-butter-ink' : 'bg-pastel-mint text-pastel-mint-ink'
    return <span className={cn('hh-pastel rounded-md px-2 py-0.5 text-3xs', tone)}>Tolerancia {tolerance}</span>
  }
  return (
    <span className={cn('text-3xs px-2 py-0.5 rounded-md border', item.color)}>
      {item.label}
    </span>
  )
}

function MenuDetailModal({
  template,
  onClose,
  onCopy,
  onUse,
  onEdit,
  onDelete,
}: {
  template: SeasonalMenuTemplate
  onClose: () => void
  onCopy: (m: SeasonalMenuTemplate) => void
  onUse?: (m: SeasonalMenuTemplate) => void
  /** Editar un menú propio, o duplicar uno de la app para adaptarlo. */
  onEdit?: (m: SeasonalMenuTemplate) => void
  onDelete?: (m: SeasonalMenuTemplate) => void
}) {
  return (
    <div
      className="fixed inset-0 z-40 bg-ink-primary/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-card w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-surface-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-surface-card/95 backdrop-blur-md border-b border-surface-border px-5 py-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <p className="text-xs text-ink-muted">{SEASON_LABELS[template.season]}</p>
            <h3 className="text-base font-semibold text-ink-primary">{template.title}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onUse ? (
              <Button type="button" size="sm" onClick={() => onUse(template)}>
                Usar con un paciente
              </Button>
            ) : null}
            {onEdit ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => onEdit(template)}>
                {isCustomMenuId(template.id) ? 'Editar' : 'Duplicar y editar'}
              </Button>
            ) : null}
            {onDelete ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(template)}>
                Borrar
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="secondary" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => onCopy(template)}>
              Copiar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="flex flex-wrap gap-1.5 mb-4">
            <ToleranceBadge tolerance={template.tolerance} />
            {template.pathologies.map((p) => (
              <span
                key={p}
                className={IS_V2 ? 'inline-flex items-center rounded-md bg-surface-elevated px-2 py-0.5 text-3xs text-ink-secondary' : 'inline-flex items-center text-3xs px-2 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary dark:text-brand-primary border border-brand-primary/15'}
              >
                {PATHOLOGY_LABELS[p]}
              </span>
            ))}
            {template.approximateKcal ? (
              <span className="text-3xs px-2 py-0.5 rounded-md bg-surface-elevated text-ink-muted">
                ~{template.approximateKcal} kcal
              </span>
            ) : null}
          </div>

          <div className="space-y-2">
            <AiMarkdown text={template.bodyMd} />
          </div>
        </div>
      </div>
    </div>
  )
}
