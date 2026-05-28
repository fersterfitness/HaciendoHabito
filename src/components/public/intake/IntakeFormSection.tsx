import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  intakeFormSectionClass,
  intakeFormSectionDividerClass,
  intakeFormSectionTitleClass,
} from '@/lib/intake/intakeFormUi'

type IntakeFormSectionProps = {
  title?: string
  children: ReactNode
  className?: string
  /** Línea divisoria arriba (agrupa bloques sin caja). */
  divided?: boolean
}

export function IntakeFormSection({ title, children, className, divided }: IntakeFormSectionProps) {
  return (
    <section className={cn(intakeFormSectionClass(), divided && intakeFormSectionDividerClass(), className)}>
      {title ? <h2 className={intakeFormSectionTitleClass()}>{title}</h2> : null}
      <div className="space-y-3">{children}</div>
    </section>
  )
}
