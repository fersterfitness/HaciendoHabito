import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { intakeFormFieldLabelClass, intakeFormInputClass } from '@/lib/intake/intakeFormUi'

const GENDER_OPTIONS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'otro', label: 'Otro' },
] as const

type IntakeGenderFieldProps = {
  register: UseFormRegister<{ gender: string; gender_other?: string }>
  gender: string
  errors: Pick<FieldErrors<{ gender?: string; gender_other?: string }>, 'gender' | 'gender_other'>
  inputClass?: (err?: string) => string
}

export function IntakeGenderField({
  register,
  gender,
  errors,
  inputClass = intakeFormInputClass,
}: IntakeGenderFieldProps) {
  return (
    <div>
      <span className={intakeFormFieldLabelClass()}>
        Género <span className="normal-case tracking-normal text-brand-tertiary">*</span>
      </span>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {GENDER_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              'inline-flex min-h-[2.75rem] cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-xs font-semibold transition-all sm:text-sm',
              gender === opt.value
                ? 'border-brand-secondary/45 bg-brand-secondary/12 text-brand-secondary ring-1 ring-brand-secondary/25'
                : 'border-surface-inputBorder bg-surface-input text-ink-secondary hover:border-brand-secondary/30 hover:text-ink-primary',
            )}
          >
            <input type="radio" value={opt.value} className="sr-only" {...register('gender')} />
            {opt.label}
          </label>
        ))}
      </div>
      {gender === 'otro' ? (
        <div className="mt-2">
          <input
            type="text"
            placeholder="Especificar"
            className={inputClass(errors.gender_other?.message)}
            {...register('gender_other')}
          />
          {errors.gender_other?.message ? (
            <p className="mt-1 text-xs text-status-expired">{errors.gender_other.message}</p>
          ) : null}
        </div>
      ) : null}
      {errors.gender?.message ? (
        <p className="mt-1 text-xs text-status-expired">{errors.gender.message}</p>
      ) : null}
    </div>
  )
}
