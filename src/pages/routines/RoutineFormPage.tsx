import { useParams, useSearchParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Header } from '@/components/layout/Header'
import { RoutineFormContent } from '@/components/routines/RoutineFormContent'

/** Alta nueva: usar panel en `/routines?create=1`. Esta página cubre edición y enlaces legacy. */
export function RoutineFormPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useAppNavigate()

  return (
    <div>
      <Header title={id ? 'Editar rutina' : 'Registrar rutina'} showBack />

      <div className="px-4 py-6 lg:px-6">
        <RoutineFormContent
          routineId={id}
          initialStudentId={searchParams.get('student') ?? undefined}
          initialBlueprintId={searchParams.get('blueprint') ?? undefined}
          onCancel={() => navigate(-1)}
          onSuccess={(routineId) => navigate(`/routines/${routineId}`)}
        />
      </div>
    </div>
  )
}
