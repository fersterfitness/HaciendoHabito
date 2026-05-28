import type { ReactNode } from 'react'
import { intakeFormSectionClass, intakeFormSectionTitleClass } from '@/lib/intake/intakeFormUi'

type IntakeFormSectionProps = {
  title: string
  children: ReactNode
  className?: string
}

export function IntakeFormSection({ title, children, className }: IntakeFormSectionProps) {
  return (
    <section className={intakeFormSectionClass(className)}>
      <h2 className={intakeFormSectionTitleClass()}>{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
