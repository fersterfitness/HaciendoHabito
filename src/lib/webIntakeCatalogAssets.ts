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

const SUPABASE_PUBLIC_OBJECT_RE =
  /^(https:\/\/[^/]+)\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i

/**
 * URL optimizada para avatares en /form: resize en servidor (2× retina) sin servir el hero completo.
 * Si la URL no es de Supabase Storage, se devuelve tal cual.
 */
export function webIntakeCatalogDisplayUrl(
  url: string | null | undefined,
  /** Tamaño CSS en px (ej. 56 para `h-14`). Se pide el doble al CDN. */
  cssPx = 56,
): string | null {
  const raw = url?.trim()
  if (!raw) return null
  const match = raw.match(SUPABASE_PUBLIC_OBJECT_RE)
  if (!match) return raw
  const [, host, bucket, objectPath] = match
  const px = Math.min(512, Math.max(64, Math.round(cssPx * 2)))
  const q = new URLSearchParams({
    width: String(px),
    height: String(px),
    resize: 'cover',
    quality: '90',
  })
  return `${host}/storage/v1/render/image/public/${bucket}/${objectPath}?${q}`
}
