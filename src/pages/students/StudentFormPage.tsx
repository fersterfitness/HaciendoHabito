import { useParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Header } from '@/components/layout/Header'
import { useAuthStore } from '@/stores/authStore'
import { StudentFormContent } from '@/components/students/StudentFormContent'

/** Alta: usar modal en la lista (`/students?create=1`). Esta página cubre solo edición. */
export function StudentFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useAppNavigate()
  const role = useAuthStore((state) => state.profile?.role)
  const entitySingular = role === 'nutritionist' ? 'paciente' : 'alumno'

  return (
    <div>
      <Header title={`Editar ${entitySingular}`} showBack />

      <div className="max-w-2xl px-4 py-6 lg:px-6">
        <StudentFormContent
          studentId={id}
          onCancel={() => navigate(-1)}
          onSuccess={(studentId) => navigate(`/students/${studentId}`)}
        />
      </div>
    </div>
  )
}
