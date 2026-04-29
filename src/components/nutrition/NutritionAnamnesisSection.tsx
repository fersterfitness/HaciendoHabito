import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { mergeAnamnesisPayload } from '@/lib/nutrition/anamnesisPayload'
import type { NutritionAnamnesisPayloadV1 } from '@/lib/nutrition/anamnesisPayload'
import { createEmptyAnamnesisPayload } from '@/lib/nutrition/anamnesisPayload'
import { NutritionAnamnesisForm } from './NutritionAnamnesisForm'
import toast from 'react-hot-toast'

interface Props {
  studentId: string
}

export function NutritionAnamnesisSection({ studentId }: Props) {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [payload, setPayload] = useState<NutritionAnamnesisPayloadV1>(() => createEmptyAnamnesisPayload())
  const debounced = useRef<number | null>(null)
  const persistRef = useRef<(p: NutritionAnamnesisPayloadV1) => void>(() => {})

  useEffect(() => {
    if (!user || !studentId) return
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('nutrition_anamnesis')
        .select('*')
        .eq('owner_id', user.id)
        .eq('student_id', studentId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        toast.error(error.message)
      }
      const row = data as { payload?: unknown } | null
      setPayload(mergeAnamnesisPayload(row?.payload))
      setLoading(false)
    })()
  }, [user, studentId])

  useEffect(() => {
    persistRef.current = (next: NutritionAnamnesisPayloadV1) => {
      if (!user) return
      if (debounced.current) window.clearTimeout(debounced.current)
      debounced.current = window.setTimeout(async () => {
        setSaving(true)
        const { error } = await supabase.from('nutrition_anamnesis').upsert(
          {
            owner_id: user.id,
            student_id: studentId,
            payload: structuredClone(next) as object,
            schema_version: 1,
          },
          { onConflict: 'owner_id,student_id' }
        )
        setSaving(false)
        if (error) toast.error(error.message)
      }, 900)
    }
  }, [user, studentId])

  const handleChange: Dispatch<SetStateAction<NutritionAnamnesisPayloadV1>> = (updater) => {
    setPayload((prev) => {
      const next =
        typeof updater === 'function'
          ? (updater as (p: NutritionAnamnesisPayloadV1) => NutritionAnamnesisPayloadV1)(prev)
          : updater
      persistRef.current(next)
      return next
    })
  }

  if (loading) {
    return <p className="text-sm text-ink-muted py-4">Cargando anamnesis…</p>
  }

  return (
    <div>
      <NutritionAnamnesisForm value={payload} onChange={handleChange} />
      <p className="text-xs text-ink-muted mt-4">{saving ? 'Guardando cambios…' : 'Los cambios se guardan solo al pausar la edición (≈ 1 s)'}</p>
    </div>
  )
}
