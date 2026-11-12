import type { FieldErrors, UseFormRegisterReturn } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { intakeFormFieldLabelClass, intakeFormInputClass } from '@/lib/intake/intakeFormUi'

const GENDER_OPTIONS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'otro', label: 'Otro' },
] as const

type IntakeGenderFieldProps = {
  /** El `register` de cualquier formulario que tenga `gender` y `gender_other`. */
  register: (name: 'gender' | 'gender_other') => UseFormRegisterReturn
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
        Género <span className="normal-case tracking-normal text-ink-muted">*</span>
      </span>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {GENDER_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              'inline-flex min-h-[2.75rem] cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-body-sm font-medium transition-[border-color,box-shadow,color] sm:text-sm',
              'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink-primary/50',
              gender === opt.value
                ? 'border-ink-primary bg-surface-input text-ink-primary shadow-[0_0_0_1px_rgb(var(--ink-primary))]'
                : 'border-surface-inputBorder bg-surface-input text-ink-secondary hover:border-ink-muted/60 hover:text-ink-primary',
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
