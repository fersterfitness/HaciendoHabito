import { BookOpen, Layers, Boxes, Library } from 'lucide-react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

export function ExercisesSectionNav() {
  return (
    <SegmentedControl
      ariaLabel="Sección base de datos"
      fullWidth
      className="max-w-2xl"
      items={[
        { id: 'catalog', to: '/exercises', end: true, label: 'Catálogo', icon: BookOpen },
        { id: 'methods', to: '/exercises/methods', label: 'Métodos', icon: Layers },
        { id: 'presets', to: '/exercises/presets', label: 'Circuitos', icon: Boxes },
        { id: 'blueprints', to: '/exercises/blueprints', label: 'Preestablecidas', title: 'Rutinas preestablecidas', icon: Library },
      ]}
    />
  )
}
