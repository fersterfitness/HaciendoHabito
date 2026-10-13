import { Apple, ClipboardList, UtensilsCrossed } from 'lucide-react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useAuthStore } from '@/stores/authStore'
import { NAV_TRAINER_MEAL_PLAN_TABS } from '@/config/navigation'

const ICONS = {
  '/meal-plans': UtensilsCrossed,
  '/nutrition/planning': ClipboardList,
  '/nutrition/foods': Apple,
} as const

export function TrainerMealPlansSectionNav() {
  const role = useAuthStore((s) => s.profile?.role)
  if (role !== 'trainer' && role !== 'admin') return null

  return (
    <SegmentedControl
      ariaLabel="Planes de alimentación"
      fullWidth
      className="mb-4 max-w-2xl"
      items={NAV_TRAINER_MEAL_PLAN_TABS.map(({ href, label }) => ({
        id: href,
        to: href,
        end: href === '/meal-plans',
        label,
        icon: ICONS[href],
      }))}
    />
  )
}
