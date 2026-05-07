/** Bucket público: fotos línea «solo / conjunto» del formulario /form. Migración SQL: web_intake_catalog_bucket. */
export const WEB_INTAKE_CATALOG_BUCKET = 'web-intake-catalog'
export const WEB_INTAKE_CATALOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024

const EXT_RE = /\.(jpg|jpeg|png|webp)$/i

/** Retorna «jpg», «jpeg», «png» o «webp» según archivo; null si inválido. */
export function webIntakeImageExt(file: File): string | null {
  const mime = file.type?.toLowerCase() ?? ''
  if (mime === 'image/jpeg' || /\.jpe?g$/i.test(file.name ?? '')) return 'jpg'
  if (mime === 'image/png' || /\.png$/i.test(file.name ?? '')) return 'png'
  if (mime === 'image/webp' || /\.webp$/i.test(file.name ?? '')) return 'webp'
  const m = (file.name ?? '').match(EXT_RE)
  if (m) {
    const e = m[1].toLowerCase()
    if (e === 'jpeg' || e === 'jpg') return 'jpg'
    if (e === 'png') return 'png'
    if (e === 'webp') return 'webp'
  }
  return null
}
