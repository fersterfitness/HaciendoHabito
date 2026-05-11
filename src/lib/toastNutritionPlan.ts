import toast from 'react-hot-toast'

/** Toasts de éxito en planificación: `id` estable reemplaza el anterior si se repite en ráfaga. */
export function toastNutritionPlanSuccess(message: string, id: string): void {
  toast.success(message, { id: `nutrition-plan-${id}`, duration: 2600 })
}
