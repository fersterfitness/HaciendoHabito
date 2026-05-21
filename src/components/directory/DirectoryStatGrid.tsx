import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Kpi3dIconId } from '@/components/icons/kpi3dIcons'
import { StatCard, type StatCardTone } from '@/components/ui/StatCard'
import type { StatIconVariant } from '@/components/ui/StatIcon'

export type DirectoryStatItem = {
  label: string
  value: number
  icon?: ReactNode
  lucideIcon?: LucideIcon
  kpiFigmaIcon?: Kpi3dIconId
  tone?: StatCardTone
  iconVariant?: StatIconVariant
}

export function DirectoryStatGrid({ items }: { items: DirectoryStatItem[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <StatCard
          key={item.label}
          title={item.label}
          value={item.value}
          icon={item.icon}
          lucideIcon={item.lucideIcon}
          kpiFigmaIcon={item.kpiFigmaIcon}
          iconVariant={item.iconVariant ?? 'flat'}
          tone={item.tone ?? 'neutral'}
          compact
        />
      ))}
    </div>
  )
}
