import { pdf } from '@react-pdf/renderer'
import { createElement } from 'react'
import { supabase } from '@/lib/supabase'
import { RoutinePdfDocument } from './RoutinePdfDocument'
import type { BlockFull, RoutineFull } from './RoutinePdfDocument'

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

    // Ordenar días y ejercicios por sort_order
    const sortedBlocks = (blocks ?? []).map((block) => ({
      ...block,
      days: [...(block.days ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((day) => ({
        ...day,
        exercises: [...(day.exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      })),
    }))

    // 4. Generar el blob del PDF
    const doc = createElement(RoutinePdfDocument, {
      routine: routine as unknown as RoutineFull,
      blocks: sortedBlocks as unknown as BlockFull[],
      generatedAt: new Date(),
    })

    const blob = await pdf(doc).toBlob()
    const sizeKb = Math.round(blob.size / 1024)

    // 5. Subir a Supabase Storage
    const fileName = `${routineId}/${pdfId}.pdf`
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

    // Guardar error en el registro
    await supabase
      .from('routine_pdfs')
      .update({ status: 'error', error_message: message })
      .eq('id', pdfId)

    throw err
  }
}
