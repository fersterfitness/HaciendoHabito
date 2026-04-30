/** Reduce peso/dimensiones para multipart bajo límites del proxy (p. ej. Vercel ~4.5 MB total). */
const MAX_DIMENSION = 2048
const TARGET_MAX_BYTES = 2_800_000

export async function compressImageFileForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  const bitmap = await createImageBitmap(file)
  try {
    const { width, height } = bitmap
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
    const smallEnough = scale >= 1 && file.size <= TARGET_MAX_BYTES
    if (smallEnough) return file

    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)

    let q = 0.85
    let blob: Blob | null = null
    for (let i = 0; i < 6; i++) {
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', q)
      })
      if (!blob) return file
      if (blob.size <= TARGET_MAX_BYTES || q <= 0.55) break
      q -= 0.08
    }
    if (!blob) return file
    const base = file.name.replace(/\.[^/.]+$/, '')
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}
