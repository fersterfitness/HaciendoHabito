import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {} from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ChevronUp, GripVertical, Plus, Save, Trash2, Upload } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type {
  WebIntakeCatalogSettings,
  WebPlan,
  WebPlanCatalogSegment,
  WebPlanIncludeSection,
} from '@/types/database'
import { WebPlanIncludesSectionsEditor } from '@/components/webPlans/WebPlanIncludesSectionsEditor'
import {
  flattenIncludeSections,
  normalizeIncludeSections,
  parseIncludeSectionsJson,
  totalIncludeItemCount,
} from '@/lib/webPlanIncludeSections'
import toast from 'react-hot-toast'
import {
  WEB_INTAKE_CATALOG_BUCKET,
  WEB_INTAKE_CATALOG_IMAGE_MAX_BYTES,
  webIntakeImageExt,
} from '@/lib/webIntakeCatalogAssets'
import { webPlansFormCheckboxAccentClassName } from '@/lib/primaryGradientCtaClasses'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { cn } from '@/lib/utils'
import {
  CANONICAL_WEB_PLAN_SLUGS,
  isCanonicalWebPlanSlug,
  mergeWebPlansForManagement,
  type CanonicalEditableWebPlan,
} from '@/lib/webPlansCanonicalCatalog'
import { normalizeWebPlanCatalogSegment } from '@/lib/webPlansCatalogSegment'
import {
  applyPlanSortOrderBySegment,
  segmentRankInVisibleList,
  slugOrdersEqual,
} from '@/lib/webPlansSortOrder'

type EditableWebPlan = Pick<
  WebPlan,
  | 'slug'
  | 'title'
  | 'price_label'
  | 'price_yearly_label'
  | 'price_3m_label'
  | 'price_6m_label'
  | 'short_description'
  | 'intro_text'
  | 'includes_items'
  | 'includes_sections'
  | 'gifts_items'
  | 'sort_order'
  | 'is_active'
  | 'show_in_public_intake'
  | 'catalog_segment'
  | 'display_badge'
  | 'credential_line_override'
> &
  Pick<CanonicalEditableWebPlan, 'isCatalogCanonical'>

const LIMITS = {
  title: 120,
  price: 24,
  priceYearly: 28,
  short: 140,
  intro: 3500,
  badge: 48,
  item: 180,
  credentialLine: 420,
  segmentImgUrl: 600,
  testimonialUrl: 900,
  slotsMsg: 280,
  modalityLabel: 80,
} as const

function toMultiline(items: string[]) {
  return items.join('\n')
}

function parseItems(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Ofertas que en la práctica son la misma oferta base con duración (3/6 meses).
 * En /form suelen verse como precios dentro de una card; acá las ocultamos por defecto para alinear Planes Web con el catálogo.
 */
function isDurationVariantWebOffer(plan: EditableWebPlan): boolean {
  const title = plan.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (/\b(3|6|12)\s*mes(es)?\b/.test(title)) return true
  if (/\b(3|6)\s*m\b/.test(title)) return true
  const slug = plan.slug.toLowerCase()
  if (/(?:^|-)(3m|6m|12m|3-meses|6-meses|12-meses)(?:-|$)/.test(slug)) return true
  return false
}

function sortedPlansList(plans: EditableWebPlan[]): EditableWebPlan[] {
  return [...plans].sort((a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug))
}

function visibleOfferSlugs(plans: EditableWebPlan[], showDurationVariantRows: boolean): string[] {
  const sorted = sortedPlansList(plans)
  const visible = showDurationVariantRows ? sorted : sorted.filter((p) => !isDurationVariantWebOffer(p))
  return visible.map((p) => p.slug)
}

/**
 * Acento por segmento (sólido, sin opacidad). Un color distinto por tipo para
 * poder distinguirlos de un vistazo. La paleta de marca solo aporta dos tonos
 * realmente diferenciables (naranja y rosa), así que esos dos van a Entreno y
 * Trío, y los otros tres usan hues sólidos (verde nutrición, violeta psico,
 * celeste plan full). El borde izquierdo y el badge del segmento comparten color.
 */
function segmentBrandBorderClass(seg: WebPlanCatalogSegment): string {
  switch (seg) {
    case 'solo':
      return 'border-l-brand-secondary'
    case 'with_nutritionist':
      return 'border-l-emerald-500'
    case 'psychologist':
      return 'border-l-violet-500'
    case 'full_trio':
      return 'border-l-brand-tertiary'
    case 'full':
      return 'border-l-sky-500'
    default:
      return 'border-l-brand-secondary'
  }
}

function segmentBrandBadgeClass(seg: WebPlanCatalogSegment): string {
  switch (seg) {
    case 'solo':
      return 'bg-brand-secondary text-white'
    case 'with_nutritionist':
      return 'bg-emerald-500 text-white'
    case 'psychologist':
      return 'bg-violet-500 text-white'
    case 'full_trio':
      return 'bg-brand-tertiary text-white'
    case 'full':
      return 'bg-sky-500 text-white'
    default:
      return 'bg-brand-secondary text-white'
  }
}

/** Borde de marca sólido (sin halo translúcido), uniforme para todas las cards. */
function segmentOfferCardClass(seg: WebPlanCatalogSegment): string {
  return cn('border-l-[5px]', segmentBrandBorderClass(seg))
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden p-0 shadow-sm">
      <div className="border-b border-surface-border bg-surface-elevated/45 px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold tracking-tight text-ink-primary">{title}</h2>
        {subtitle ? (
          <p className="mt-1 max-w-prose text-xs leading-snug text-ink-secondary">{subtitle}</p>
        ) : null}
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </Card>
  )
}

function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card/60 p-4 dark:bg-surface-card/40">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-muted">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function SubsectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{children}</p>
}

function newPlanDraft(sortOrder: number): EditableWebPlan {
  const slug = `plan-${Date.now().toString(36)}`
  return {
    slug,
    title: 'Nueva oferta',
    price_label: '$—',
    price_yearly_label: null,
    price_3m_label: null,
    price_6m_label: null,
    short_description: 'Editá la descripción corta que verán en la tarjeta (8–140 caracteres).',
    intro_text:
      'Detalle que se muestra al tocar «más info». Podés extenderlo hasta 3500 caracteres con el nombre original del servicio y lo que incluye.',
    includes_items: ['Primer ítem del plan (editá o agregá líneas abajo).'],
    includes_sections: [{ professional: 'trainer', items: ['Primer ítem del plan (editá o agregá líneas abajo).'] }],
    gifts_items: ['Bonificación o material de regalo.'],
    sort_order: sortOrder,
    is_active: true,
    show_in_public_intake: true,
    catalog_segment: 'solo',
    display_badge: null,
    credential_line_override: null,
    isCatalogCanonical: false,
  }
}

export function WebPlansSettingsPage() {
  const navigate = useAppNavigate()
  const role = useAuthStore((s) => s.profile?.role)
  const canManage = role === 'admin' || role === 'trainer' || role === 'nutritionist'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null)
  const [draggingPlanSlug, setDraggingPlanSlug] = useState<string | null>(null)
  const [dragOverPlanSlug, setDragOverPlanSlug] = useState<string | null>(null)
  /** Ofertas con formulario expandido; por defecto todas contraídas para reordenar más rápido. */
  const [expandedOfferSlugs, setExpandedOfferSlugs] = useState<Set<string>>(() => new Set())
  const [plans, setPlans] = useState<EditableWebPlan[]>(() => mergeWebPlansForManagement([]))
  /** Slugs creados en esta sesión y aún no guardados en la base (se pueden borrar). */
  const [draftSlugs, setDraftSlugs] = useState<string[]>([])
  const [pendingScrollSlug, setPendingScrollSlug] = useState<string | null>(null)
  const [soloSegmentImg, setSoloSegmentImg] = useState('')
  const [withNutritionistSegmentImg, setWithNutritionistSegmentImg] = useState('')
  const [fullSegmentImg, setFullSegmentImg] = useState('')
  const [psychologistSegmentImg, setPsychologistSegmentImg] = useState('')
  const [intakeSlotsOpen, setIntakeSlotsOpen] = useState(true)
  const [intakeSlotsRemaining, setIntakeSlotsRemaining] = useState('')
  const [intakeSlotsMessage, setIntakeSlotsMessage] = useState('')
  const [testimonialUrlsText, setTestimonialUrlsText] = useState('')
  const [modalityLabelSolo, setModalityLabelSolo] = useState('')
  const [modalityLabelWithNutritionist, setModalityLabelWithNutritionist] = useState('')
  const [modalityLabelFull, setModalityLabelFull] = useState('')
  const [modalityLabelPsychologist, setModalityLabelPsychologist] = useState('')
  const [modalityLabelFullTrio, setModalityLabelFullTrio] = useState('')
  const [assetsSaving, setAssetsSaving] = useState(false)
  const [sortOrderSaving, setSortOrderSaving] = useState(false)
  const sortPersistTimer = useRef<number | null>(null)
  const plansForSortPersistRef = useRef(plans)
  plansForSortPersistRef.current = plans
  const soloFileRef = useRef<HTMLInputElement>(null)
  const nutritionSegmentFileRef = useRef<HTMLInputElement>(null)
  const fullFileRef = useRef<HTMLInputElement>(null)
  const psychologistFileRef = useRef<HTMLInputElement>(null)
  const [soloUploadBusy, setSoloUploadBusy] = useState(false)
  const [nutritionSegmentUploadBusy, setNutritionSegmentUploadBusy] = useState(false)
  const [fullUploadBusy, setFullUploadBusy] = useState(false)
  const [psychologistUploadBusy, setPsychologistUploadBusy] = useState(false)
  const catalogUserId = useAuthStore((s) => s.user?.id)
  /** Si es false (defecto), no listamos filas que parecen solo variantes 3/6 meses (iguales al catálogo web resumido). */
  const [showDurationVariantRows, setShowDurationVariantRows] = useState(false)

  useEffect(() => {
    if (!canManage) return
    ;(async () => {
      const { data } = await supabase.from('web_intake_catalog_settings').select('*').eq('id', 1).maybeSingle()
      if (!data) return
      const row = data as WebIntakeCatalogSettings
      setSoloSegmentImg(row.solo_segment_image_url ?? '')
      setWithNutritionistSegmentImg(row.with_nutritionist_segment_image_url ?? '')
      setFullSegmentImg(row.full_segment_image_url ?? '')
      setPsychologistSegmentImg(row.psychologist_segment_image_url ?? '')
      setTestimonialUrlsText(((row.testimonial_videos ?? []) as string[]).join('\n'))
      if (typeof row.intake_slots_open === 'boolean') setIntakeSlotsOpen(row.intake_slots_open)
      if (row.intake_slots_remaining != null && Number.isFinite(row.intake_slots_remaining)) {
        setIntakeSlotsRemaining(String(row.intake_slots_remaining))
      } else setIntakeSlotsRemaining('')
      setIntakeSlotsMessage(row.intake_slots_public_message ?? '')
      setModalityLabelSolo(row.modality_label_solo ?? '')
      setModalityLabelWithNutritionist(row.modality_label_with_nutritionist ?? '')
      setModalityLabelFull(row.modality_label_full ?? '')
      setModalityLabelPsychologist(row.modality_label_psychologist ?? '')
      setModalityLabelFullTrio(row.modality_label_full_trio ?? '')
    })()
  }, [canManage])

  async function handleSaveSegmentImages() {
    if (
      soloSegmentImg.length > LIMITS.segmentImgUrl ||
      withNutritionistSegmentImg.length > LIMITS.segmentImgUrl ||
      fullSegmentImg.length > LIMITS.segmentImgUrl ||
      psychologistSegmentImg.length > LIMITS.segmentImgUrl
    ) {
      toast.error(`Las URL no pueden superar ${LIMITS.segmentImgUrl} caracteres.`)
      return
    }
    setAssetsSaving(true)
    try {
      const { error } = await supabase.from('web_intake_catalog_settings').upsert({
        id: 1,
        solo_segment_image_url: soloSegmentImg.trim() ? soloSegmentImg.trim() : null,
        with_nutritionist_segment_image_url: withNutritionistSegmentImg.trim() ? withNutritionistSegmentImg.trim() : null,
        full_segment_image_url: fullSegmentImg.trim() ? fullSegmentImg.trim() : null,
        psychologist_segment_image_url: psychologistSegmentImg.trim() ? psychologistSegmentImg.trim() : null,
      })
      if (error) {
        toast.error(error.message.includes('does not exist') ? 'Ejecutá la migración SQL (web_intake_catalog_settings).' : error.message)
        return
      }
      toast.success('Imágenes del selector guardadas')
    } finally {
      setAssetsSaving(false)
    }
  }

  async function handleSaveTestimonials() {
    const urls = testimonialUrlsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    if (urls.some((u) => u.length > LIMITS.testimonialUrl)) {
      toast.error(`Cada URL debe tener ≤ ${LIMITS.testimonialUrl} caracteres.`)
      return
    }

    setAssetsSaving(true)
    try {
      const { error } = await supabase.from('web_intake_catalog_settings').upsert({
        id: 1,
        testimonial_videos: urls,
      })
      if (error) {
        toast.error(error.message.includes('testimonial_videos') ? 'Ejecutá la migración SQL de videos testimonios.' : error.message)
        return
      }
      toast.success('Testimonios guardados')
    } finally {
      setAssetsSaving(false)
    }
  }

  async function handleSaveModalityLabels() {
    const a = modalityLabelSolo.trim()
    const b = modalityLabelWithNutritionist.trim()
    const c = modalityLabelFull.trim()
    const d = modalityLabelPsychologist.trim()
    const e = modalityLabelFullTrio.trim()
    if ([a, b, c, d, e].some((t) => t.length > LIMITS.modalityLabel)) {
      toast.error(`Cada etiqueta admite hasta ${LIMITS.modalityLabel} caracteres.`)
      return
    }
    setAssetsSaving(true)
    try {
      const { error } = await supabase.from('web_intake_catalog_settings').upsert({
        id: 1,
        modality_label_solo: a || null,
        modality_label_with_nutritionist: b || null,
        modality_label_full: c || null,
        modality_label_psychologist: d || null,
        modality_label_full_trio: e || null,
      })
      if (error) {
        toast.error(
          error.message.includes('modality_label')
            ? 'Ejecutá la migración SQL (modality_label_* en web_intake_catalog_settings).'
            : error.message,
        )
        return
      }
      toast.success('Etiquetas de modalidad guardadas')
    } finally {
      setAssetsSaving(false)
    }
  }

  async function handleSaveIntakeSlots() {
    let remaining: number | null = null
    const trimmed = intakeSlotsRemaining.trim()
    if (trimmed) {
      const n = Number.parseInt(trimmed, 10)
      if (!Number.isFinite(n) || n < 0) {
        toast.error('Cupos restantes: número entero ≥ 0 o vacío.')
        return
      }
      remaining = n
    }
    const msg = intakeSlotsMessage.trim()
    if (msg.length > LIMITS.slotsMsg) {
      toast.error(`El mensaje de cupos no puede superar ${LIMITS.slotsMsg} caracteres.`)
      return
    }
    setAssetsSaving(true)
    try {
      const { error } = await supabase.from('web_intake_catalog_settings').upsert({
        id: 1,
        intake_slots_open: intakeSlotsOpen,
        intake_slots_remaining: remaining,
        intake_slots_public_message: msg ? msg : null,
      })
      if (error) {
        toast.error(
          error.message.includes('intake_slots') ? 'Ejecutá la migración SQL de cupos (web_intake_catalog_settings).' : error.message,
        )
        return
      }
      toast.success('Estado de cupos guardado')
    } finally {
      setAssetsSaving(false)
    }
  }

  async function uploadSegmentHero(
    field: 'solo' | 'with_nutritionist' | 'full' | 'psychologist',
    file: File | null | undefined,
  ) {
    if (!file || !catalogUserId) return
    if (file.size > WEB_INTAKE_CATALOG_IMAGE_MAX_BYTES) {
      toast.error('La imagen debe pesar menos de 5 MB')
      return
    }
    const ext = webIntakeImageExt(file)
    if (!ext) {
      toast.error('Usá JPG, PNG o WebP')
      return
    }
    const slug =
      field === 'solo' ? 'solo-line'
      : field === 'with_nutritionist' ? 'with-nutritionist-line'
      : field === 'psychologist' ? 'psychologist-line'
      : 'full-line'
    const setBusy =
      field === 'solo' ? setSoloUploadBusy
      : field === 'with_nutritionist' ? setNutritionSegmentUploadBusy
      : field === 'psychologist' ? setPsychologistUploadBusy
      : setFullUploadBusy
    const setUrl =
      field === 'solo' ? setSoloSegmentImg
      : field === 'with_nutritionist' ? setWithNutritionistSegmentImg
      : field === 'psychologist' ? setPsychologistSegmentImg
      : setFullSegmentImg
    const path = `${catalogUserId}/segment-${slug}.${ext}`
    setBusy(true)
    try {
      const { error: upErr } = await supabase.storage.from(WEB_INTAKE_CATALOG_BUCKET).upload(path, file, {
        upsert: true,
        cacheControl: '3600',
        contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      })
      if (upErr) {
        const msg =
          upErr.message.toLowerCase().includes('bucket') || upErr.message.includes('404')
            ? 'Verificá la migración del bucket «web-intake-catalog».'
            : upErr.message
        toast.error(msg)
        return
      }
      const { data } = supabase.storage.from(WEB_INTAKE_CATALOG_BUCKET).getPublicUrl(path)
      // Cache-bust: misma ruta pero URL única en cada upload para evitar CDN stale
      setUrl(`${data.publicUrl}?t=${Date.now()}`)
      toast.success('Imagen subida. Tocá «Guardar fotos del selector» para publicar.')
    } finally {
      setBusy(false)
      if (field === 'solo' && soloFileRef.current) soloFileRef.current.value = ''
      else if (field === 'with_nutritionist' && nutritionSegmentFileRef.current) nutritionSegmentFileRef.current.value = ''
      else if (field === 'psychologist' && psychologistFileRef.current) psychologistFileRef.current.value = ''
      else if (field === 'full' && fullFileRef.current) fullFileRef.current.value = ''
    }
  }

  useEffect(() => {
    if (!canManage) return
    let mounted = true
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase.from('web_plans').select('*').order('sort_order')
      setLoading(false)
      if (error) {
        toast.error(error.message)
        return
      }
      if (!mounted) return
      const rows = ((data as WebPlan[]) ?? []).map((row) => ({
        slug: row.slug,
        title: row.title,
        price_label: row.price_label,
        price_yearly_label: row.price_yearly_label ?? null,
        price_3m_label: row.price_3m_label ?? null,
        price_6m_label: row.price_6m_label ?? null,
        short_description: row.short_description,
        intro_text: row.intro_text,
        includes_items: row.includes_items ?? [],
        includes_sections: normalizeIncludeSections(
          parseIncludeSectionsJson(row.includes_sections),
          row.includes_items ?? [],
          normalizeWebPlanCatalogSegment(row.catalog_segment),
      ),
      gifts_items: row.gifts_items ?? [],
      sort_order: row.sort_order,
      is_active: row.is_active,
      show_in_public_intake: row.show_in_public_intake !== false,
      catalog_segment: normalizeWebPlanCatalogSegment(row.catalog_segment),
        display_badge: row.display_badge ?? null,
        credential_line_override: row.credential_line_override ?? null,
      }))
      const merged = mergeWebPlansForManagement(
        rows.map((r) => ({ ...r, isCatalogCanonical: isCanonicalWebPlanSlug(r.slug) })),
      )
      setPlans(merged)
      setDraftSlugs([])
    })()
    return () => {
      mounted = false
    }
  }, [canManage])

  function toggleOfferExpanded(slug: string) {
    setExpandedOfferSlugs((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug)),
    [plans],
  )

  const settingsPlansList = useMemo(() => {
    if (showDurationVariantRows) return sortedPlans
    return sortedPlans.filter((p) => !isDurationVariantWebOffer(p))
  }, [sortedPlans, showDurationVariantRows])

  const visibleSlugOrder = useMemo(
    () => visibleOfferSlugs(plans, showDurationVariantRows),
    [plans, showDurationVariantRows],
  )

  const plansBySlug = useMemo(() => new Map(plans.map((p) => [p.slug, p])), [plans])

  /** Orden 1, 2, 3… dentro de cada modalidad (lo que ve /form en esa pestaña). */
  const segmentRankBySlug = useMemo(() => {
    const ranks = new Map<string, number>()
    for (const slug of visibleSlugOrder) {
      const rank = segmentRankInVisibleList(visibleSlugOrder, plansBySlug, slug)
      if (rank > 0) ranks.set(slug, rank)
    }
    return ranks
  }, [visibleSlugOrder, plansBySlug])

  const hiddenVariantCount = useMemo(
    () => sortedPlans.filter((p) => isDurationVariantWebOffer(p)).length,
    [sortedPlans],
  )

  async function persistSortOrder() {
    const nextPlans = plansForSortPersistRef.current
    const toSave = nextPlans.filter((p) => !draftSlugs.includes(p.slug))
    if (toSave.length === 0) {
      toast.error('Guardá primero las ofertas nuevas antes de reordenarlas.')
      return
    }
    setSortOrderSaving(true)
    try {
      const results = await Promise.all(
        toSave.map((plan) =>
          supabase.from('web_plans').update({ sort_order: plan.sort_order }).eq('slug', plan.slug),
        ),
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) {
        toast.error(failed.error.message)
        return
      }
      toast.success('Orden guardado')
    } finally {
      setSortOrderSaving(false)
    }
  }

  function schedulePersistSortOrder() {
    if (sortPersistTimer.current) window.clearTimeout(sortPersistTimer.current)
    sortPersistTimer.current = window.setTimeout(() => {
      void persistSortOrder()
    }, 500)
  }

  function commitVisibleOrder(mutateVisibleSlugs: (visibleSlugs: string[]) => string[]) {
    setPlans((prev) => {
      const visible = visibleOfferSlugs(prev, showDurationVariantRows)
      const orderedVisible = mutateVisibleSlugs(visible)
      if (slugOrdersEqual(orderedVisible, visible)) return prev
      const next = applyPlanSortOrderBySegment(prev, orderedVisible)
      plansForSortPersistRef.current = next
      schedulePersistSortOrder()
      return next
    })
  }

  /** Orden en lista → sort_order global (1, 2, 3…); en /form cada modalidad respeta ese orden relativo. */
  function moveSortedPlan(slug: string, delta: -1 | 1) {
    commitVisibleOrder((slugs) => {
      const i = slugs.indexOf(slug)
      const j = i + delta
      if (i < 0 || j < 0 || j >= slugs.length) return slugs
      const nextSlugs = [...slugs]
      const [item] = nextSlugs.splice(i, 1)
      nextSlugs.splice(j, 0, item!)
      return nextSlugs
    })
  }

  function reorderPlanDrop(draggedSlug: string, targetSlug: string, insertBefore: boolean) {
    if (draggedSlug === targetSlug) return
    commitVisibleOrder((slugs) => {
      const rest = slugs.filter((s) => s !== draggedSlug)
      let insertIdx = rest.indexOf(targetSlug)
      if (insertIdx < 0) return slugs
      if (!insertBefore) insertIdx += 1
      rest.splice(insertIdx, 0, draggedSlug)
      return rest
    })
  }

  function updatePlan(slug: string, patch: Partial<EditableWebPlan>) {
    setPlans((prev) => prev.map((p) => (p.slug === slug ? { ...p, ...patch } : p)))
  }

  function sanitizeSlugRaw(raw: string): string {
    return raw.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+/, '').slice(0, 56)
  }

  /** Edición de slug sólo borradores: actualiza texto y entrada en draftSlugs. */
  function onDraftSlugChange(prevSlug: string, raw: string) {
    const t = sanitizeSlugRaw(raw)
    setDraftSlugs((ds) => ds.map((s) => (s === prevSlug ? (t || s) : s)))
    setPlans((prev) => prev.map((p) => (p.slug === prevSlug ? { ...p, slug: t || prevSlug } : p)))
  }

  /** Borradores: al salir del campo se normaliza y valida unicidad. */
  function finalizeDraftSlug(prevKey: string) {
    if (!draftSlugs.includes(prevKey)) return
    const row = plans.find((p) => p.slug === prevKey)
    if (!row) return
    const t = sanitizeSlugRaw(row.slug).replace(/^-+|-+$/g, '')
    if (!t) {
      const fallback = `plan-${Date.now().toString(36)}`
      setDraftSlugs((ds) => ds.map((s) => (s === prevKey ? fallback : s)))
      setPlans((prev) => prev.map((p) => (p.slug === prevKey ? { ...p, slug: fallback } : p)))
      return
    }
    if (!SLUG_RE.test(t)) {
      toast.error('Slug inválido: sólo minúsculas, números y guiones.')
      return
    }
    if (plans.some((p) => p.slug !== prevKey && p.slug === t)) {
      toast.error('Ese slug ya lo usa otra oferta.')
      return
    }
    setDraftSlugs((ds) => ds.map((s) => (s === prevKey ? t : s)))
    setPlans((prev) => prev.map((p) => (p.slug === prevKey ? { ...p, slug: t } : p)))
  }

  function addPlan() {
    const nextOrder = sortedPlans.reduce((m, p) => Math.max(m, p.sort_order), 0) + 1
    const row = newPlanDraft(nextOrder)
    setPlans((prev) => [...prev, row])
    setDraftSlugs((ds) => [...ds, row.slug])
    setExpandedOfferSlugs((prev) => new Set(prev).add(row.slug))
    setPendingScrollSlug(row.slug)
  }

  useEffect(() => {
    if (!pendingScrollSlug) return
    const el = document.getElementById(`offer-card-${pendingScrollSlug}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setPendingScrollSlug(null)
    }
  }, [pendingScrollSlug, plans])

  function removeDraft(slug: string) {
    if (!draftSlugs.includes(slug)) return
    setPlans((prev) => prev.filter((p) => p.slug !== slug))
    setDraftSlugs((ds) => ds.filter((s) => s !== slug))
    setExpandedOfferSlugs((prev) => {
      if (!prev.has(slug)) return prev
      const next = new Set(prev)
      next.delete(slug)
      return next
    })
  }

  async function handleDeletePlan(slug: string) {
    if (draftSlugs.includes(slug)) {
      removeDraft(slug)
      return
    }
    if (isCanonicalWebPlanSlug(slug)) {
      toast.error('Esta oferta forma parte del catálogo base de /form (7 planes). Podés editarla, no borrarla.')
      return
    }
    const ok = window.confirm(
      `¿Borrar la oferta «${slug}» de la base? No se puede deshacer. Si un alumno tenía este plan asignado, quedará sin plan (la referencia se limpia).`,
    )
    if (!ok) return
    setDeletingSlug(slug)
    try {
      const { error } = await supabase.from('web_plans').delete().eq('slug', slug)
      if (error) {
        toast.error(error.message)
        return
      }
      setPlans((prev) => prev.filter((p) => p.slug !== slug))
      toast.success('Oferta eliminada')
      setExpandedOfferSlugs((prev) => {
        if (!prev.has(slug)) return prev
        const next = new Set(prev)
        next.delete(slug)
        return next
      })
    } finally {
      setDeletingSlug(null)
    }
  }

  function validate() {
    const seen = new Set<string>()
    for (const plan of plans) {
      if (!SLUG_RE.test(plan.slug.trim())) return 'Revisá el slug de cada oferta (minúsculas, números y guiones).'
      const s = plan.slug.trim()
      if (seen.has(s)) return `Slug duplicado: ${s}`
      seen.add(s)
      if (!plan.title.trim() || plan.title.length > LIMITS.title) return 'Revisá el título de las ofertas.'
      if (!plan.price_label.trim() || plan.price_label.length > LIMITS.price) return 'Revisá el precio mensual de las ofertas.'
      const pyl = plan.price_yearly_label?.trim()
      if (pyl && pyl.length > LIMITS.priceYearly) {
        return 'Revisá el precio anual opcional de las ofertas.'
      }
      const p3 = plan.price_3m_label?.trim()
      if (p3 && p3.length > LIMITS.price) return 'Revisá el precio opcional x3 (mismo límite que el mensual).'
      const p6 = plan.price_6m_label?.trim()
      if (p6 && p6.length > LIMITS.price) return 'Revisá el precio opcional x6 (mismo límite que el mensual).'
      if (!plan.short_description.trim() || plan.short_description.length > LIMITS.short) return 'La descripción corta supera el límite.'
      if (!plan.intro_text.trim() || plan.intro_text.length > LIMITS.intro) return 'El detalle principal supera el límite.'
      const b = plan.display_badge?.trim()
      if (b && b.length > LIMITS.badge) return `La etiqueta de la oferta («${plan.slug}») supera ${LIMITS.badge} caracteres.`
      const cred = plan.credential_line_override?.trim()
      if (cred && cred.length > LIMITS.credentialLine) {
        return `La línea de credencial libre de la oferta «${plan.slug}» supera ${LIMITS.credentialLine} caracteres.`
      }
      const includeCount = totalIncludeItemCount(plan.includes_sections)
      if (includeCount === 0 || plan.gifts_items.length === 0) {
        return 'Cada oferta necesita al menos un ítem en Incluye (por profesional) y De regalo.'
      }
      if (includeCount > 16) return 'Máximo 16 ítems en total en «Incluye» (sumando todas las secciones).'
      const flatIncludes = flattenIncludeSections(plan.includes_sections)
      if (flatIncludes.some((item) => item.length > LIMITS.item) || plan.gifts_items.some((item) => item.length > LIMITS.item)) {
        return 'Hay ítems muy largos; límite 180 caracteres por línea.'
      }
    }
    return null
  }

  async function handleSave() {
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }
    setSaving(true)
    const payload = plans.map((plan) => ({
      slug: plan.slug,
      title: plan.title.trim(),
      price_label: plan.price_label.trim(),
      price_yearly_label: plan.price_yearly_label?.trim() ? plan.price_yearly_label.trim().slice(0, LIMITS.priceYearly) : null,
      price_3m_label: plan.price_3m_label?.trim() ? plan.price_3m_label.trim().slice(0, LIMITS.price) : null,
      price_6m_label: plan.price_6m_label?.trim() ? plan.price_6m_label.trim().slice(0, LIMITS.price) : null,
      short_description: plan.short_description.trim(),
      intro_text: plan.intro_text.trim(),
      includes_sections: plan.includes_sections,
      includes_items: flattenIncludeSections(plan.includes_sections),
      gifts_items: plan.gifts_items,
      sort_order: plan.sort_order,
      is_active: plan.is_active,
      show_in_public_intake: plan.show_in_public_intake !== false,
      catalog_segment: normalizeWebPlanCatalogSegment(plan.catalog_segment),
      display_badge: plan.display_badge?.trim() ? plan.display_badge.trim().slice(0, LIMITS.badge) : null,
      credential_line_override: plan.credential_line_override?.trim()
        ? plan.credential_line_override.trim().slice(0, LIMITS.credentialLine)
        : null,
    }))
    const { error } = await supabase.from('web_plans').upsert(payload, { onConflict: 'slug' })
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setDraftSlugs([])
    toast.success('Ofertas web actualizadas')
    const { data } = await supabase.from('web_plans').select('*').order('sort_order')
    const rows = ((data as WebPlan[]) ?? []).map((row) => ({
      slug: row.slug,
      title: row.title,
      price_label: row.price_label,
      price_yearly_label: row.price_yearly_label ?? null,
      price_3m_label: row.price_3m_label ?? null,
      price_6m_label: row.price_6m_label ?? null,
      short_description: row.short_description,
      intro_text: row.intro_text,
      includes_items: row.includes_items ?? [],
      includes_sections: normalizeIncludeSections(
        parseIncludeSectionsJson(row.includes_sections),
        row.includes_items ?? [],
        normalizeWebPlanCatalogSegment(row.catalog_segment),
      ),
      gifts_items: row.gifts_items ?? [],
      sort_order: row.sort_order,
      is_active: row.is_active,
      show_in_public_intake: row.show_in_public_intake !== false,
      catalog_segment: normalizeWebPlanCatalogSegment(row.catalog_segment),
      display_badge: row.display_badge ?? null,
      credential_line_override: row.credential_line_override ?? null,
      isCatalogCanonical: isCanonicalWebPlanSlug(row.slug),
    }))
    setPlans(mergeWebPlansForManagement(rows))
  }

  if (!canManage) {
    return (
      <div>
        <Header title="Planes Web" showBack />
        <div className="px-4 lg:px-6 py-6">
          <Card className="p-6 text-sm text-ink-secondary">No tenés permisos para editar los planes web.</Card>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header
        title="Planes Web"
        showBack
        actions={<Button size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/settings')}>Configuración</Button>}
      />

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 lg:px-6">
        <div className="space-y-4 rounded-xl border border-surface-border bg-surface-elevated/40 px-4 py-4 sm:px-5">
          <div>
            <p className="text-sm font-semibold text-ink-primary">Cómo se arma el formulario público (/form)</p>
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-ink-secondary marker:text-ink-muted">
              <li>
                <span className="font-medium text-ink-primary">Antes de elegir plan:</span> se muestran las fotos del equipo y 5 modalidades en este orden: Entrenamiento, Nutrición, Psicólogo Deportivo, Trío completo y Planes Más Completos.
              </li>
              <li>
                <span className="font-medium text-ink-primary">Trío completo (full_trio):</span> entreno + nutrición + psicólogo en una sola modalidad. Asigná segmento <code className="font-mono text-[10px]">full_trio</code> a esas ofertas.
              </li>
              <li>
                <span className="font-medium text-ink-primary">Planes Más Completos (full):</span> ofertas con segmento <code className="font-mono text-[10px]">full</code> (entreno + nutrición o entreno + psicólogo, sin los tres juntos).
              </li>
              <li>
                <span className="font-medium text-ink-primary">Entrenamiento Individual (solo):</span> ofertas con segmento <code className="font-mono text-[10px]">solo</code>, activas y con «Mostrar en /form».
              </li>
              <li>
                <span className="font-medium text-ink-primary">Nutrición (with_nutritionist):</span> ofertas con segmento <code className="font-mono text-[10px]">with_nutritionist</code>, activas y con «Mostrar en /form».
              </li>
              <li>
                <span className="font-medium text-ink-primary">Psicólogo Deportivo (psychologist):</span> muestra «Próximamente» en el /form. Cuando haya ofertas creadas con este segmento y activadas, se mostrarán automáticamente.
              </li>
              <li>
                El visitante elige <span className="font-medium text-ink-primary">Mensual, x3, x6 o Anual</span> para ver los precios correspondientes — no cambia el contenido de las ofertas.
              </li>
            </ul>
          </div>
          <div className="rounded-lg border border-surface-border bg-surface-card/50 px-3 py-2.5 text-xs leading-relaxed text-ink-secondary">
            <span className="font-semibold text-ink-primary">Tip:</span> para que una oferta aparezca en el /form debe estar activa <strong>y</strong> con «Mostrar en /form» activado. Para mostrar precios x3/x6 en una sola fila, usá «Precios por plazo (opcional)» en cada oferta.
          </div>
          <p className="text-xs text-ink-muted">
            <a href="#web-plans-ofertas" className="font-medium text-ink-primary underline decoration-ink-primary/30 underline-offset-2 hover:decoration-ink-primary">
              Ir a ofertas en base de datos
            </a>
            {' · '}
            Orden abajo: primero lo visual del selector, después cupos y videos, al final las ofertas guardadas.
          </p>
        </div>

        <SectionCard
          title="Selector del /form: fotos y modalidad"
          subtitle="Lo que el visitante ve al elegir entrenador, nutricionista y la primera lista desplegable."
        >
          <div className="space-y-5">
            <div className="space-y-4">
              <SubsectionTitle>Fotos del equipo</SubsectionTitle>
              <p className="text-xs text-ink-muted">Bucket web-intake-catalog. Subí JPG/PNG/WebP o pegá URL HTTPS.</p>
              <input
                ref={soloFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void uploadSegmentHero('solo', e.target.files?.length ? e.target.files[0] : undefined)}
              />
              <input
                ref={nutritionSegmentFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void uploadSegmentHero('with_nutritionist', e.target.files?.length ? e.target.files[0] : undefined)}
              />
              <input
                ref={fullFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void uploadSegmentHero('full', e.target.files?.length ? e.target.files[0] : undefined)}
              />
              <input
                ref={psychologistFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void uploadSegmentHero('psychologist', e.target.files?.length ? e.target.files[0] : undefined)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={soloUploadBusy}
                  icon={<Upload className="h-4 w-4" />}
                  disabled={!catalogUserId}
                  onClick={() => soloFileRef.current?.click()}
                >
                  Subir · Entrenador
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={nutritionSegmentUploadBusy}
                  icon={<Upload className="h-4 w-4" />}
                  disabled={!catalogUserId}
                  onClick={() => nutritionSegmentFileRef.current?.click()}
                >
                  Subir · Nutricionista
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={fullUploadBusy}
                  icon={<Upload className="h-4 w-4" />}
                  disabled={!catalogUserId}
                  onClick={() => fullFileRef.current?.click()}
                >
                  Subir · Full
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={psychologistUploadBusy}
                  icon={<Upload className="h-4 w-4" />}
                  disabled={!catalogUserId}
                  onClick={() => psychologistFileRef.current?.click()}
                >
                  Subir · Psicólogo
                </Button>
              </div>
              <Input
                label="URL · Entrenador"
                placeholder="https://..."
                value={soloSegmentImg}
                maxLength={LIMITS.segmentImgUrl}
                onChange={(e) => setSoloSegmentImg(e.target.value)}
              />
              <Input
                label="URL · Nutricionista"
                placeholder="https://..."
                value={withNutritionistSegmentImg}
                maxLength={LIMITS.segmentImgUrl}
                onChange={(e) => setWithNutritionistSegmentImg(e.target.value)}
              />
              <Input
                label="URL · Full (ambos)"
                placeholder="https://..."
                value={fullSegmentImg}
                maxLength={LIMITS.segmentImgUrl}
                onChange={(e) => setFullSegmentImg(e.target.value)}
              />
              <Input
                label="URL · Psicólogo (bloques «Incluye»)"
                placeholder="https://..."
                value={psychologistSegmentImg}
                maxLength={LIMITS.segmentImgUrl}
                onChange={(e) => setPsychologistSegmentImg(e.target.value)}
              />
              <Button type="button" size="sm" variant="gradientSecondary" onClick={() => void handleSaveSegmentImages()} loading={assetsSaving}>
                Guardar fotos
              </Button>
            </div>

            <div className="h-px w-full bg-surface-border" aria-hidden />

            <div className="space-y-4">
              <SubsectionTitle>Nombres del desplegable «Modalidad»</SubsectionTitle>
              <p className="text-xs text-ink-muted">
                Si dejás un campo vacío, el /form usa el texto por defecto de cada modalidad.
              </p>
              <Input
                label="1 · Entrenamiento (segmento solo)"
                placeholder="Ej. ENTRENAMIENTO"
                maxLength={LIMITS.modalityLabel}
                value={modalityLabelSolo}
                onChange={(e) => setModalityLabelSolo(e.target.value)}
              />
              <Input
                label="2 · Nutrición (segmento with_nutritionist)"
                placeholder="Ej. NUTRICIÓN"
                maxLength={LIMITS.modalityLabel}
                value={modalityLabelWithNutritionist}
                onChange={(e) => setModalityLabelWithNutritionist(e.target.value)}
              />
              <Input
                label="3 · Psicólogo Deportivo (segmento psychologist)"
                placeholder="Ej. PSICÓLOGO DEPORTIVO"
                maxLength={LIMITS.modalityLabel}
                value={modalityLabelPsychologist}
                onChange={(e) => setModalityLabelPsychologist(e.target.value)}
              />
              <Input
                label="4 · Trío completo (segmento full_trio)"
                placeholder="Ej. ENTRENO + NUTRICIÓN + PSICÓLOGO"
                maxLength={LIMITS.modalityLabel}
                value={modalityLabelFullTrio}
                onChange={(e) => setModalityLabelFullTrio(e.target.value)}
              />
              <Input
                label="5 · Planes Más Completos (segmento full)"
                placeholder="Ej. PLANES MÁS COMPLETOS"
                maxLength={LIMITS.modalityLabel}
                value={modalityLabelFull}
                onChange={(e) => setModalityLabelFull(e.target.value)}
              />
              <Button type="button" size="sm" variant="gradientSecondary" onClick={() => void handleSaveModalityLabels()} loading={assetsSaving}>
                Guardar etiquetas
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Cupos y testimonios"
          subtitle="Barra de cupos arriba del /form y grilla de videos debajo del selector."
        >
          <div className="space-y-5">
            <div className="space-y-4">
              <SubsectionTitle>Cupos</SubsectionTitle>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-secondary">
                <input
                  type="checkbox"
                  className={cn('h-4 w-4 rounded border-surface-border', webPlansFormCheckboxAccentClassName)}
                  checked={intakeSlotsOpen}
                  onChange={(e) => setIntakeSlotsOpen(e.target.checked)}
                />
                Aceptamos consultas nuevas
              </label>
              <Input
                label="Cupos restantes (opcional)"
                placeholder="Vacío = no mostrar número"
                value={intakeSlotsRemaining}
                onChange={(e) => setIntakeSlotsRemaining(e.target.value.replace(/\D/g, ''))}
              />
              <Textarea
                label="Mensaje (una línea ideal)"
                placeholder='Ej. "Hay lugar para nuevas consultas."'
                rows={2}
                maxLength={LIMITS.slotsMsg}
                value={intakeSlotsMessage}
                hint={`${intakeSlotsMessage.length}/${LIMITS.slotsMsg}`}
                onChange={(e) => setIntakeSlotsMessage(e.target.value)}
              />
              <Button type="button" size="sm" variant="secondary" onClick={() => void handleSaveIntakeSlots()} loading={assetsSaving}>
                Guardar cupos
              </Button>
            </div>

            <div className="h-px w-full bg-surface-border" aria-hidden />

            <div className="space-y-4">
              <SubsectionTitle>Testimonios en video</SubsectionTitle>
              <p className="text-xs text-ink-muted">Una URL por línea.</p>
              <Textarea
                label="URLs"
                rows={5}
                placeholder={'https://...\nhttps://...'}
                value={testimonialUrlsText}
                onChange={(e) => setTestimonialUrlsText(e.target.value)}
              />
              <Button type="button" size="sm" variant="gradientSecondary" onClick={() => void handleSaveTestimonials()} loading={assetsSaving}>
                Guardar testimonios
              </Button>
            </div>
          </div>
        </SectionCard>

        <div id="web-plans-ofertas" className="scroll-mt-24 space-y-3">
          <h2 className="text-base font-semibold tracking-tight text-ink-primary">
            Catálogo de ofertas ({CANONICAL_WEB_PLAN_SLUGS.length} planes base + extras)
          </h2>
          <p className="max-w-prose text-sm leading-relaxed text-ink-secondary">
            El badge <strong className="text-ink-primary">Orden</strong> es por modalidad (p. ej. los dos de Entrenamiento pueden ser Orden 1 y Orden 2 aunque en la lista global estén en la posición 3 y 4). Esa lista global define el orden relativo en /form. Arrastrá o Subir/Bajar y se guarda solo. También podés usar{' '}
            <strong className="text-ink-primary">Guardar ofertas</strong> para el resto de campos en{' '}
            <code className="rounded bg-surface-elevated px-1 py-0.5 font-mono text-xs">web_plans</code>. Las filas marcadas «Catálogo /form» no se pueden
            borrar.
            {hiddenVariantCount > 0 ? (
              <>
                {' '}
                Por defecto <strong className="text-ink-primary">no listamos</strong> ofertas que parecen solo variantes de duración (p. ej. título con «3
                meses» o «6 meses»), para que esta pantalla coincida con el catálogo resumido de la web; las filas siguen en la base y se guardan con el resto.
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-secondary">
            <span className="font-medium text-ink-primary">Leyenda de color:</span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-base/50 px-2 py-0.5 text-ink-secondary">
              <span className="h-2 w-2 rounded-sm bg-brand-secondary" aria-hidden />
              Entrenamiento (solo)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-base/50 px-2 py-0.5 text-ink-secondary">
              <span className="h-2 w-2 rounded-sm bg-emerald-500" aria-hidden />
              Nutrición
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-base/50 px-2 py-0.5 text-ink-secondary">
              <span className="h-2 w-2 rounded-sm bg-violet-500" aria-hidden />
              Psicólogo
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-base/50 px-2 py-0.5 text-ink-secondary">
              <span className="h-2 w-2 rounded-sm bg-brand-tertiary" aria-hidden />
              Trío (full_trio)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-base/50 px-2 py-0.5 text-ink-secondary">
              <span className="h-2 w-2 rounded-sm bg-sky-500" aria-hidden />
              Plan full
            </span>
            <span className="text-ink-muted basis-full sm:basis-auto">
              · Por defecto las cards van <strong className="text-ink-secondary">contraídas</strong> para reordenar rápido. Arrastrá{' '}
              <span className="font-medium text-ink-secondary">⋮⋮</span> o Subir/Bajar: el orden se guarda solo (toast «Orden guardado»). «Guardar ofertas» sigue siendo para textos y precios.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {hiddenVariantCount > 0 ? (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-surface-border bg-surface-base/50 px-3 py-2 text-xs text-ink-secondary hover:bg-surface-elevated/60">
                <input
                  type="checkbox"
                  className={cn('h-4 w-4 rounded border-surface-border', webPlansFormCheckboxAccentClassName)}
                  checked={showDurationVariantRows}
                  onChange={(e) => setShowDurationVariantRows(e.target.checked)}
                />
                <span>
                  Mostrar variantes de duración en esta lista ({hiddenVariantCount} fila{hiddenVariantCount === 1 ? '' : 's'})
                </span>
              </label>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-surface-border bg-surface-elevated/35 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <details className="min-w-0 text-sm">
            <summary className="cursor-pointer font-medium text-ink-primary hover:underline">
              Límites de caracteres y reglas del slug
            </summary>
            <p className="mt-2 max-w-prose text-xs leading-relaxed text-ink-secondary">
              Título {LIMITS.title}, precio {LIMITS.price}, anual {LIMITS.priceYearly} (opcional), descripción corta {LIMITS.short},
              detalle {LIMITS.intro}, etiqueta {LIMITS.badge}, credencial {LIMITS.credentialLine}, ítem {LIMITS.item}. En planes
              nuevos el slug solo se edita hasta el primer «Guardar ofertas».
            </p>
          </details>
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-xs"
              disabled={settingsPlansList.length === 0}
              onClick={() => setExpandedOfferSlugs(new Set(settingsPlansList.map((p) => p.slug)))}
            >
              Abrir todas
            </Button>
            <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={() => setExpandedOfferSlugs(new Set())}>
              Cerrar todas
            </Button>
            <Button type="button" size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={addPlan}>
              Agregar oferta
            </Button>
          </div>
        </div>

        {loading ? (
          <Card className="p-6 text-sm text-ink-secondary">Cargando ofertas…</Card>
        ) : (
          settingsPlansList.map((plan, idx) => {
            const segmentRank = segmentRankBySlug.get(plan.slug) ?? 0
            const listPosition = visibleSlugOrder.indexOf(plan.slug) + 1
            const isExpanded = expandedOfferSlugs.has(plan.slug)
            return (
            <div
              key={plan.slug}
              id={`offer-card-${plan.slug}`}
              className={cn(
                'scroll-mt-24 rounded-2xl transition-[opacity,box-shadow]',
                draggingPlanSlug === plan.slug && 'opacity-55',
                dragOverPlanSlug === plan.slug &&
                  draggingPlanSlug &&
                  draggingPlanSlug !== plan.slug &&
                  'shadow-[inset_0_0_0_2px_rgba(99,102,241,0.55)] dark:shadow-[inset_0_0_0_2px_rgba(129,140,248,0.45)]',
              )}
              onDragOver={(e) => {
                if (!draggingPlanSlug || draggingPlanSlug === plan.slug) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDragOverPlanSlug(plan.slug)
              }}
              onDragLeave={(e) => {
                if (!draggingPlanSlug) return
                const el = e.currentTarget
                const rel = e.relatedTarget as Node | null
                if (rel && el.contains(rel)) return
                setDragOverPlanSlug((cur) => (cur === plan.slug ? null : cur))
              }}
              onDrop={(e) => {
                e.preventDefault()
                const from = draggingPlanSlug ?? e.dataTransfer.getData('text/plain')
                if (!from || from === plan.slug) {
                  setDraggingPlanSlug(null)
                  setDragOverPlanSlug(null)
                  return
                }
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                const insertBefore = e.clientY < rect.top + rect.height / 2
                reorderPlanDrop(from, plan.slug, insertBefore)
                setDraggingPlanSlug(null)
                setDragOverPlanSlug(null)
              }}
              role="group"
              aria-label={`Oferta ${plan.title}`}
            >
            <Card
              className={cn('overflow-hidden p-0 shadow-sm', segmentOfferCardClass(plan.catalog_segment))}
            >
              <div
                className={cn(
                  'flex flex-wrap items-start gap-2 sm:gap-3 justify-between px-4 sm:px-5',
                  isExpanded ? 'border-b border-surface-border py-3' : 'py-2.5',
                )}
              >
                <div
                  draggable
                  onDragStart={(e) => {
                    setDraggingPlanSlug(plan.slug)
                    e.dataTransfer.setData('text/plain', plan.slug)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    setDraggingPlanSlug(null)
                    setDragOverPlanSlug(null)
                  }}
                  className={cn(
                    'mt-0.5 shrink-0 rounded-lg border border-surface-border/70 bg-surface-base/50 p-1.5 text-ink-muted',
                    'cursor-grab touch-none hover:bg-surface-elevated hover:text-ink-secondary active:cursor-grabbing',
                    appFocusRingClassName,
                  )}
                  title="Arrastrá y soltá sobre otra oferta para reordenar (mitad superior = antes, mitad inferior = después). El orden se guarda automáticamente."
                  aria-label="Arrastrar para reordenar ofertas"
                >
                  <GripVertical className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={cn('font-semibold text-ink-primary', isExpanded ? 'text-base' : 'text-sm leading-snug')}>
                      Oferta {idx + 1}
                      <span className="ml-1.5 font-normal text-ink-secondary">· {plan.title}</span>
                    </h2>
                    <span
                      className="shrink-0 rounded-md border border-surface-border/80 bg-surface-base/70 px-2 py-0.5 font-mono text-[10px] font-medium text-ink-muted"
                      title={
                        segmentRank > 0
                          ? `Posición ${segmentRank} en su modalidad en /form · fila ${listPosition > 0 ? listPosition : plan.sort_order} en esta lista`
                          : `Lista global posición ${plan.sort_order}`
                      }
                    >
                      Orden {segmentRank > 0 ? segmentRank : '—'}
                      <span className="ml-1 font-sans normal-case tracking-normal text-ink-muted">
                        · {plan.catalog_segment === 'solo'
                          ? 'Entreno'
                          : plan.catalog_segment === 'with_nutritionist'
                            ? 'Nutri'
                            : plan.catalog_segment === 'psychologist'
                              ? 'Psico'
                              : plan.catalog_segment === 'full_trio'
                                ? 'Trío'
                                : 'Full'}
                      </span>
                    </span>
                    {plan.isCatalogCanonical ? (
                      <span className="shrink-0 rounded-md border border-brand-primary/35 bg-brand-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-primary">
                        Catálogo /form
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        segmentBrandBadgeClass(plan.catalog_segment),
                      )}
                    >
                      {plan.catalog_segment === 'solo'
                        ? 'Ferster'
                        : plan.catalog_segment === 'with_nutritionist'
                          ? 'Nutrición'
                          : plan.catalog_segment === 'psychologist'
                            ? 'Psicólogo'
                            : plan.catalog_segment === 'full_trio'
                              ? 'Trío completo'
                              : 'Plan full'}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 text-xs h-8 px-2.5"
                    icon={isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    iconPosition="left"
                    onClick={() => toggleOfferExpanded(plan.slug)}
                  >
                    {isExpanded ? 'Ocultar' : 'Detalle'}
                  </Button>
                  <div className="flex items-center gap-0.5 rounded-lg border border-surface-border/80 bg-surface-base/50 p-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 p-0"
                      title="Subir en la lista"
                      aria-label="Subir oferta en la lista"
                      disabled={idx === 0}
                      icon={<ArrowUp className="h-4 w-4" />}
                      onClick={() => moveSortedPlan(plan.slug, -1)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 p-0"
                      title="Bajar en la lista"
                      aria-label="Bajar oferta en la lista"
                      disabled={idx >= settingsPlansList.length - 1}
                      icon={<ArrowDown className="h-4 w-4" />}
                      onClick={() => moveSortedPlan(plan.slug, 1)}
                    />
                  </div>
                  {draftSlugs.includes(plan.slug) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-status-expired/40 text-status-expired"
                      icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => removeDraft(plan.slug)}
                    >
                      Quitar borrador
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 shrink-0 border-status-expired/40 p-0 text-status-expired"
                      icon={<Trash2 className="h-4 w-4" />}
                      loading={deletingSlug === plan.slug}
                      disabled={deletingSlug !== null && deletingSlug !== plan.slug}
                      onClick={() => void handleDeletePlan(plan.slug)}
                      title="Eliminar de la base"
                      aria-label="Eliminar de la base"
                    />
                  )}
                </div>
              </div>

              {isExpanded ? (
              <div className="space-y-5 p-4 sm:p-5">
                <FieldGroup title="Identificación y modalidad">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-[min(100%,260px)] flex-1">
                      <Input
                        label="Slug (identificador en URL)"
                        value={plan.slug}
                        disabled={!draftSlugs.includes(plan.slug)}
                        hint={draftSlugs.includes(plan.slug) ? 'Solo en borrador nuevo' : 'Fijado al guardar'}
                        onChange={(e) => {
                          if (draftSlugs.includes(plan.slug)) onDraftSlugChange(plan.slug, e.target.value)
                        }}
                        onBlur={() => finalizeDraftSlug(plan.slug)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-secondary">
                    <input
                      type="checkbox"
                      className={cn('h-4 w-4 rounded border-surface-border', webPlansFormCheckboxAccentClassName)}
                      checked={plan.is_active}
                      onChange={(e) => updatePlan(plan.slug, { is_active: e.target.checked })}
                    />
                    Plan activo (oferta habilitada en la base)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-secondary">
                    <input
                      type="checkbox"
                      className={cn('h-4 w-4 rounded border-surface-border', webPlansFormCheckboxAccentClassName)}
                      checked={plan.show_in_public_intake !== false}
                      onChange={(e) => updatePlan(plan.slug, { show_in_public_intake: e.target.checked })}
                    />
                    Mostrar esta oferta en el /form
                  </label>
                  <p className="text-[11px] leading-snug text-ink-muted -mt-2 pl-7">
                    Si desmarcás «Mostrar en /form», esa oferta no aparece como card. Mensual / x3 / x6 / Anual solo cambian precios en pantalla.
                  </p>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-secondary">Segmento (modalidad de la oferta)</label>
                    <select
                      value={plan.catalog_segment}
                      onChange={(e) =>
                        updatePlan(plan.slug, { catalog_segment: e.target.value as WebPlanCatalogSegment })
                      }
                      className="w-full max-w-md rounded-xl border border-surface-border bg-surface-base px-3 py-2 text-sm text-ink-primary"
                    >
                      <option value="full_trio">TRÍO COMPLETO — Entreno + Nutrición + Psicólogo (full_trio)</option>
                      <option value="full">PLANES MÁS COMPLETOS (full)</option>
                      <option value="solo">ENTRENAMIENTO INDIVIDUAL (solo)</option>
                      <option value="with_nutritionist">NUTRICIÓN (with_nutritionist)</option>
                      <option value="psychologist">PSICÓLOGO DEPORTIVO (psychologist)</option>
                    </select>
                    <p className="mt-1.5 text-[11px] text-ink-muted">
                      <strong className="text-ink-secondary">Trío (full_trio)</strong>: modalidad propia con los tres profesionales.{' '}
                      <strong className="text-ink-secondary">Planes Más Completos (full)</strong>: entreno + nutrición o entreno + psicólogo.{' '}
                      <strong className="text-ink-secondary">Entrenamiento / Nutrición / Psicólogo</strong>: modalidades individuales.
                    </p>
                  </div>
                </FieldGroup>

                <FieldGroup title="Card de la oferta (badge y credencial)">
                  <Input
                    label="Etiqueta en la card (opcional)"
                    value={plan.display_badge ?? ''}
                    placeholder="Ej. Plan deportista"
                    maxLength={LIMITS.badge}
                    hint={`${(plan.display_badge ?? '').length}/${LIMITS.badge}`}
                    onChange={(e) => updatePlan(plan.slug, { display_badge: e.target.value || null })}
                  />
                  <Textarea
                    label="Credencial / subtítulo (opcional)"
                    placeholder="Si está vacío, se usa el texto por defecto del segmento al abrir el detalle."
                    rows={3}
                    maxLength={LIMITS.credentialLine}
                    value={plan.credential_line_override ?? ''}
                    hint={`${(plan.credential_line_override ?? '').length}/${LIMITS.credentialLine}`}
                    onChange={(e) => updatePlan(plan.slug, { credential_line_override: e.target.value || null })}
                  />
                </FieldGroup>

                <FieldGroup title="Título y precios (base para el toggle de plazos en /form)">
                  <Input
                    label="Título"
                    value={plan.title}
                    maxLength={LIMITS.title}
                    hint={`${plan.title.length}/${LIMITS.title} · Nombre de la oferta en la card.`}
                    onChange={(e) => updatePlan(plan.slug, { title: e.target.value })}
                  />
                  <Input
                    label="Precio mensual"
                    value={plan.price_label}
                    maxLength={LIMITS.price}
                    hint={`${plan.price_label.length}/${LIMITS.price} · Base para calcular x3, x6 y anual sugerido en el /form.`}
                    onChange={(e) => updatePlan(plan.slug, { price_label: e.target.value })}
                  />
                  <Input
                    label="Precio anual (opcional)"
                    value={plan.price_yearly_label ?? ''}
                    placeholder="Vacío → se muestra 10× el mensual"
                    maxLength={LIMITS.priceYearly}
                    hint={`${(plan.price_yearly_label ?? '').length}/${LIMITS.priceYearly} · En /form, si no cargás x3/x6 abajo, se calculan desde el mensual con descuento referencial.`}
                    onChange={(e) =>
                      updatePlan(plan.slug, { price_yearly_label: e.target.value.trim() ? e.target.value : null })
                    }
                  />
                  <div className="rounded-lg border border-surface-border/80 bg-surface-elevated/30 px-3 py-3 space-y-3">
                    <SubsectionTitle>Precios por plazo (opcional)</SubsectionTitle>
                    <p className="text-[11px] leading-snug text-ink-muted">
                      Una sola fila de oferta puede mostrar precios distintos al cambiar Mensual / x3 / x6 en el /form. Si dejás vacío, x3 y x6 se
                      calculan desde el precio mensual (salvo filas promo dedicadas).
                    </p>
                    <Input
                      label="Precio x3 meses (opcional)"
                      value={plan.price_3m_label ?? ''}
                      placeholder="Ej. $150.000"
                      maxLength={LIMITS.price}
                      hint={`${(plan.price_3m_label ?? '').length}/${LIMITS.price}`}
                      onChange={(e) =>
                        updatePlan(plan.slug, { price_3m_label: e.target.value.trim() ? e.target.value : null })
                      }
                    />
                    <Input
                      label="Precio x6 meses (opcional)"
                      value={plan.price_6m_label ?? ''}
                      placeholder="Ej. $280.000"
                      maxLength={LIMITS.price}
                      hint={`${(plan.price_6m_label ?? '').length}/${LIMITS.price}`}
                      onChange={(e) =>
                        updatePlan(plan.slug, { price_6m_label: e.target.value.trim() ? e.target.value : null })
                      }
                    />
                  </div>
                </FieldGroup>

                <FieldGroup title="Textos largos (card, detalle, listas)">
                  <Textarea
                    label="Descripción corta (vista en card)"
                    value={plan.short_description}
                    maxLength={LIMITS.short}
                    hint={`${plan.short_description.length}/${LIMITS.short}`}
                    onChange={(e) => updatePlan(plan.slug, { short_description: e.target.value })}
                  />
                  <Textarea
                    label="Detalle al ampliar la oferta"
                    value={plan.intro_text}
                    maxLength={LIMITS.intro}
                    hint={`${plan.intro_text.length}/${LIMITS.intro}`}
                    onChange={(e) => updatePlan(plan.slug, { intro_text: e.target.value })}
                  />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-muted mb-2">
                      Incluye — por profesional
                    </p>
                    <WebPlanIncludesSectionsEditor
                      sections={plan.includes_sections}
                      itemMaxLength={LIMITS.item}
                      onChange={(includes_sections: WebPlanIncludeSection[]) => {
                        updatePlan(plan.slug, {
                          includes_sections,
                          includes_items: flattenIncludeSections(includes_sections),
                        })
                      }}
                    />
                  </div>
                  <Textarea
                    label="De regalo — una línea por ítem"
                    value={toMultiline(plan.gifts_items)}
                    hint="Máx. 180 caracteres por línea."
                    onChange={(e) => updatePlan(plan.slug, { gifts_items: parseItems(e.target.value) })}
                  />
                </FieldGroup>
              </div>
              ) : null}
            </Card>
            </div>
            )
          })
        )}

        <div className="border-t border-surface-border pt-2">
          <Button
            className="w-full sm:w-auto"
            variant="gradientSecondary"
            icon={<Save className="h-4 w-4" />}
            onClick={handleSave}
            loading={saving}
          >
            Guardar ofertas
          </Button>
        </div>
      </div>
    </div>
  )
}
