import { useEffect, useState } from 'react'
import { Save, UserRound } from 'lucide-react'
import { differenceInYears } from 'date-fns'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import { supabase } from '@/lib/supabase'
import { updateAccessibleStudent } from '@/lib/students/studentAccess'
import { personalPatchFromIntakeSnapshot } from '@/lib/students/personalFromIntakeSnapshot'
import type { Student } from '@/types/database'
import toast from 'react-hot-toast'
import {
  parseHeightCmFromInput,
  parseLocaleNumberOrNull,
} from '@/lib/formUtils'

interface Props {
  student: Student
  ownerId: string
  onUpdated: (updated: Student) => void
}

type FormState = {
  full_name: string
  email: string
  phone: string
  birth_date: string
  gender: 'M' | 'F' | 'otro' | ''
  document_id: string
  address: string
  weight_kg: string
  height_cm: string
  notes: string
  plan_end_date: string
}

function fromStudent(s: Student): FormState {
  return {
    full_name: s.full_name,
    email: s.email ?? '',
    phone: s.phone ?? '',
    birth_date: s.birth_date ?? '',
    gender: s.gender ?? '',
    document_id: s.document_id ?? '',
    address: s.address ?? '',
    weight_kg: s.weight_kg != null ? String(s.weight_kg) : '',
    height_cm: s.height_cm != null ? String(s.height_cm) : '',
    notes: s.notes ?? '',
    plan_end_date: s.plan_end_date ?? '',
  }
}

function toNullableWeightKg(value: string): number | null {
  return parseLocaleNumberOrNull(value)
}

function toNullableHeightCm(value: string): number | null {
  if (!value.trim()) return null
  return parseHeightCmFromInput(value)
}

function ageFromBirth(birth: string): string | null {
  if (!birth) return null
  try {
    const years = differenceInYears(new Date(), new Date(birth))
    if (!Number.isFinite(years) || years < 0 || years > 130) return null
    return `${years} años`
  } catch {
    return null
  }
}

export function NutritionPatientPersonalDataSection({ student, ownerId, onUpdated }: Props) {
  const [form, setForm] = useState<FormState>(() => fromStudent(student))
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const intakePersonalPatch = personalPatchFromIntakeSnapshot(student)
  const canImportFromIntake = intakePersonalPatch != null

  useEffect(() => {
    setForm(fromStudent(student))
    setDirty(false)
  }, [student])

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  async function importFromIntakeSnapshot() {
    const patch = personalPatchFromIntakeSnapshot(student)
    if (!patch) return
    setImporting(true)
    const { data, error } = await updateAccessibleStudent(student.id, patch).select('*').single()
    setImporting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    const next = data as Student
    setForm(fromStudent(next))
    setDirty(false)
    onUpdated(next)
    toast.success('Datos personales completados desde el registro web')
  }

  async function save() {
    if (!form.full_name.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }
    setSaving(true)
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      birth_date: form.birth_date || null,
      gender: (form.gender || null) as Student['gender'],
      document_id: form.document_id.trim() || null,
      address: form.address.trim() || null,
      weight_kg: toNullableWeightKg(form.weight_kg),
      height_cm: toNullableHeightCm(form.height_cm),
      notes: form.notes.trim() || null,
      plan_end_date: form.plan_end_date || null,
    }
    const { data, error } = await updateAccessibleStudent(student.id, payload).select('*').single()
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setDirty(false)
    onUpdated(data as Student)
    toast.success('Datos del paciente actualizados')
  }

  const age = ageFromBirth(form.birth_date)
  const hasWebIntake =
    Boolean(student.intake_nutrition && Object.keys(student.intake_nutrition).length > 2) ||
    Boolean(student.intake_ferster && Object.keys(student.intake_ferster).length > 2)
  const missingPersonalFromForm =
    hasWebIntake &&
    !canImportFromIntake &&
    (!form.document_id.trim() ||
      !form.gender ||
      !form.address.trim() ||
      !form.weight_kg.trim() ||
      !form.height_cm.trim())

  return (
    <div className="space-y-6">
      {missingPersonalFromForm ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-ink-secondary leading-relaxed">
          Parte de lo que completaste en el registro web está en las secciones de abajo (
          <strong className="font-semibold text-ink-primary">Cuestionario nutricional del registro</strong>
          {student.intake_ferster ? (
            <>
              {' '}
              y <strong className="font-semibold text-ink-primary">Cuestionario de registro</strong>
            </>
          ) : null}
          ). Podés copiar DNI, sexo, peso y altura a los campos editables de arriba cuando quieras.
        </p>
      ) : null}
      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-brand-primary/15 text-brand-primary dark:text-brand-primary">
              <UserRound className="h-4 w-4" />
            </span>
            <CardTitle>Datos personales</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canImportFromIntake ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={importing}
                disabled={importing || saving}
                onClick={importFromIntakeSnapshot}
              >
                Completar desde registro
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant={dirty ? 'gradientSecondary' : 'secondary'}
              icon={<Save className="h-4 w-4" />}
              loading={saving}
              disabled={!dirty || importing}
              onClick={save}
            >
              {dirty ? 'Guardar cambios' : 'Guardado'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 pb-5 border-b border-surface-border/60">
          <StudentAvatar
            studentId={student.id}
            fullName={student.full_name}
            avatarPath={student.avatar_path}
            size="lg"
            allowRemove
            onPathChange={(nextPath) => onUpdated({ ...student, avatar_path: nextPath })}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-primary truncate">
              {form.full_name || 'Sin nombre'}
            </p>
            <p className="text-xs text-ink-muted">
              Click en la foto para subir o cambiar la imagen del paciente
            </p>
            {age ? (
              <p className="text-xs text-ink-secondary mt-1">{age}</p>
            ) : null}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nombre completo" required>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => patch('full_name', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => patch('email', e.target.value)}
              placeholder="paciente@email.com"
              className={inputClass}
            />
          </Field>

          <Field label="Teléfono">
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => patch('phone', e.target.value)}
              placeholder="+54 11 1234 5678"
              className={inputClass}
            />
          </Field>
          <Field label="Documento (DNI)">
            <input
              type="text"
              value={form.document_id}
              onChange={(e) => patch('document_id', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label={age ? `Fecha de nacimiento (${age})` : 'Fecha de nacimiento'}>
            <input
              type="date"
              value={form.birth_date}
              onChange={(e) => patch('birth_date', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Sexo / género">
            <select
              value={form.gender}
              onChange={(e) => patch('gender', e.target.value as FormState['gender'])}
              className={inputClass}
            >
              <option value="">Sin especificar</option>
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
              <option value="otro">Otro / prefiero no decir</option>
            </select>
          </Field>

          <Field label="Dirección" className="sm:col-span-2">
            <input
              type="text"
              value={form.address}
              onChange={(e) => patch('address', e.target.value)}
              placeholder="Calle, número, ciudad"
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-4">Datos antropométricos básicos</CardTitle>
        <p className="text-xs text-ink-muted mb-4">
          Para cálculos rápidos cuando todavía no hay programa de antropometría completo cargado.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Peso actual (kg)">
            <input
              type="text"
              inputMode="decimal"
              value={form.weight_kg}
              onChange={(e) => patch('weight_kg', e.target.value)}
              placeholder="Ej: 67,5"
              className={inputClass}
            />
          </Field>
          <Field label="Altura (cm)">
            <input
              type="text"
              inputMode="decimal"
              value={form.height_cm}
              onChange={(e) => patch('height_cm', e.target.value)}
              placeholder="Ej: 175 o 1,75 m"
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-4">Plan y notas</CardTitle>
        <div className="grid gap-4">
          <Field label="Vencimiento del plan activo">
            <input
              type="date"
              value={form.plan_end_date}
              onChange={(e) => patch('plan_end_date', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Notas internas (no visibles al paciente)">
            <textarea
              value={form.notes}
              onChange={(e) => patch('notes', e.target.value)}
              rows={5}
              placeholder="Comentarios clínicos, antecedentes relevantes, recordatorios..."
              className={inputClass}
            />
          </Field>
        </div>
      </Card>
    </div>
  )
}

const inputClass =
  'mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2.5 text-sm focus:outline-none focus:border-brand-primary'

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={'text-xs text-ink-secondary' + (className ? ' ' + className : '')}>
      <span className="flex items-center gap-1">
        {label}
        {required ? <span className="text-status-expired">*</span> : null}
      </span>
      {children}
    </label>
  )
}
