import { pdf } from '@react-pdf/renderer'
import { createElement, type ReactElement } from 'react'
import { supabase } from '@/lib/supabase'
import { RoutinePdfDocument } from './RoutinePdfDocument'
import type { BlockFull, RoutineFull } from './RoutinePdfDocument'

/** Evita que el botón quede cargando para siempre si el layout del PDF se trabó. */
const PDF_TO_BLOB_TIMEOUT_MS = 180_000

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(onTimeout()), ms)
    promise.then(
      (v) => {
        window.clearTimeout(t)
        resolve(v)
      },
      (e) => {
        window.clearTimeout(t)
        reject(e)
      },
    )
  })
}

export async function generateRoutinePdf(routineId: string, pdfId: string): Promise<void> {
  // 1. Marcar como en proceso
  await supabase
    .from('routine_pdfs')
    .update({ status: 'en_proceso', error_message: null })
    .eq('id', pdfId)

  try {
    // 2. Cargar rutina con alumno
    const { data: routine, error: routineError } = await supabase
      .from('routines')
      .select('*, student:students(*)')
      .eq('id', routineId)
      .single()

    if (routineError || !routine) throw new Error(routineError?.message ?? 'Rutina no encontrada')

    const ownerId = (routine as { owner_id?: string }).owner_id
    if (!ownerId) throw new Error('Rutina sin owner_id')

    // 3. Cargar bloques → días → ejercicios
    const { data: blocks, error: blocksError } = await supabase
      .from('routine_blocks')
      .select(`
        *,
        days:routine_days(
          *,
          exercises:routine_exercises(
            *,
            exercise:exercise_library(*)
          )
        )
      `)
      .eq('routine_id', routineId)
      .order('sort_order')

    if (blocksError) throw new Error(blocksError.message)

    const studentId = (routine as { student_id?: string }).student_id
    const rmByExerciseId: Record<string, number> = {}
    if (studentId) {
      const { data: rmRows } = await supabase
        .from('student_rm_records')
        .select('exercise_id, rm_kg, tested_at')
        .eq('student_id', studentId)
        .order('tested_at', { ascending: false })
      for (const row of rmRows ?? []) {
        const r = row as { exercise_id: string; rm_kg: number }
        if (!(r.exercise_id in rmByExerciseId)) rmByExerciseId[r.exercise_id] = r.rm_kg
      }
    }

    // Ordenar días y ejercicios por sort_order
    const sortedBlocks = (blocks ?? []).map((block) => ({
      ...block,
      days: [...(block.days ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((day) => ({
        ...day,
        exercises: [...(day.exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      })),
    }))

    // Deja que el navegador pinte el estado "en proceso" antes del layout (muy pesado en el hilo principal).
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve())
      })
    })

    // 4. Generar el blob del PDF
    const doc = createElement(RoutinePdfDocument, {
      routine: routine as unknown as RoutineFull,
      blocks: sortedBlocks as unknown as BlockFull[],
      generatedAt: new Date(),
      rmByExerciseId: Object.keys(rmByExerciseId).length ? rmByExerciseId : undefined,
    })

    const blob = await withTimeout(
      pdf(doc as ReactElement).toBlob(),
      PDF_TO_BLOB_TIMEOUT_MS,
      () =>
        new Error(
          'La generación del PDF superó 3 minutos (a veces pasa con rutinas enormes en el navegador). Probá cerrar otras pestañas y generar de nuevo; si sigue igual, avisá a soporte.',
        ),
    )
    const sizeKb = Math.round(blob.size / 1024)

    // 5. Subir a Supabase Storage
    // Política típica: primer segmento del path = auth.uid() (ver ARCHITECTURE.md → routine-pdfs).
    const fileName = `${ownerId}/${routineId}/${pdfId}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('routine-pdfs')
      .upload(fileName, blob, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('[PDF] Storage upload error full:', JSON.stringify(uploadError))
      throw new Error(uploadError.message)
    }

    // 6. Actualizar registro con estado generado
    await supabase
      .from('routine_pdfs')
      .update({
        status: 'generado',
        file_path: fileName,
        file_size_kb: sizeKb,
        generated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', pdfId)

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[PDF] generateRoutinePdf failed:', err)

    // Guardar error en el registro
    await supabase
      .from('routine_pdfs')
      .update({ status: 'error', error_message: message })
      .eq('id', pdfId)

    throw err
  }
}
