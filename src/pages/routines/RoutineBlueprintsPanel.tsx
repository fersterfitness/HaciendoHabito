import { useEffect, useState, useCallback } from 'react'
import { Link} from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { ArrowRight, Library, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import type { RoutineBlueprint } from '@/types/database'
import toast from 'react-hot-toast'

/** Lista de plantillas guardadas desde el detalle de rutina (pestaña dentro de Rutinas). */
export function RoutineBlueprintsPanel() {
  const navigate = useAppNavigate()
  const { user } = useAuthStore()
  const [items, setItems] = useState<RoutineBlueprint[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('routine_blueprints')
      .select('*')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setItems((data as RoutineBlueprint[]) ?? [])
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await supabase.from('routine_blueprints').delete().eq('id', deleteId)
    setDeleting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Plantilla eliminada')
    setDeleteId(null)
    void load()
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-sm text-ink-secondary leading-relaxed max-w-[52rem]">
          Guardá plantillas desde el detalle de una rutina (botón <strong className="text-ink-primary">Plantilla</strong>). Al{' '}
          <Link to="/routines/new" className="text-brand-primary font-medium hover:underline">
            crear una rutina nueva
          </Link>
          , elegí una entrada del <strong className="text-ink-primary">diccionario</strong> para copiar bloques, días y ejercicios.
        </p>
        <Button
          size="sm"
          className="shrink-0"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => navigate('/routines/new')}
        >
          Nueva rutina con plantilla
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Library className="h-8 w-8" />}
          title="Sin plantillas guardadas"
          description='Creá una rutina, cargá ejercicios y tocá "Plantilla" en la barra superior para guardarla acá.'
          action={{
            label: 'Ir a mis rutinas',
            onClick: () => navigate('/routines'),
            icon: <Plus className="h-4 w-4" />,
          }}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((bp) => (
            <li
              key={bp.id}
              className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface-card px-4 py-3"
            >
              <Library className="h-4 w-4 text-brand-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-primary">{bp.name}</p>
                {bp.description && (
                  <p className="text-xs text-ink-secondary mt-1 whitespace-pre-wrap">{bp.description}</p>
                )}
                <p className="text-[10px] text-ink-muted mt-2">
                  Actualizada {new Date(bp.updated_at).toLocaleString('es-AR')}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link
                  to={`/routines/new?blueprint=${bp.id}`}
                  className="p-2 rounded-lg text-ink-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-colors"
                  title="Crear rutina con esta plantilla"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => setDeleteId(bp.id)}
                  className="p-2 rounded-lg text-ink-muted hover:text-status-expired hover:bg-status-expired/10 transition-colors"
                  title="Eliminar plantilla"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="¿Eliminar plantilla?"
        description="No afecta rutinas ya creadas. Solo se borra esta entrada del diccionario."
        confirmLabel="Eliminar"
        loading={deleting}
      />
    </>
  )
}
