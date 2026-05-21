import type { Student } from '@/types/database'

type PersonalSnapshot = {
  document_id?: string | null
  gender?: string | null
  gender_other?: string | null
  address?: string | null
  weight_kg?: number | string | null
  height_cm?: number | string | null
}

function readSnapshot(raw: unknown): PersonalSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  return raw as PersonalSnapshot
}

function snapshotFromStudent(student: Student): PersonalSnapshot | null {
  const ni = student.intake_nutrition as { personal_snapshot?: unknown } | null
  const fi = student.intake_ferster as { personal_snapshot?: unknown } | null
  return readSnapshot(ni?.personal_snapshot) ?? readSnapshot(fi?.personal_snapshot)
}

function parseNum(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Campos personales faltantes en la fila, recuperables del JSON del /form. */
export function personalPatchFromIntakeSnapshot(student: Student): Partial<Student> | null {
  const snap = snapshotFromStudent(student)
  if (!snap) return null

  const patch: Partial<Student> = {}
  if (!student.document_id?.trim() && snap.document_id?.trim()) {
    patch.document_id = snap.document_id.trim()
  }
  if (!student.gender && snap.gender && ['M', 'F', 'otro'].includes(snap.gender)) {
    patch.gender = snap.gender as Student['gender']
  }
  if (!student.address?.trim() && snap.address?.trim()) {
    patch.address = snap.address.trim()
  }
  const w = parseNum(snap.weight_kg)
  if (student.weight_kg == null && w != null) patch.weight_kg = w
  const h = parseNum(snap.height_cm)
  if (student.height_cm == null && h != null) patch.height_cm = Math.round(h)

  return Object.keys(patch).length > 0 ? patch : null
}

export function hasIntakePersonalSnapshot(student: Student): boolean {
  return personalPatchFromIntakeSnapshot(student) != null
}
