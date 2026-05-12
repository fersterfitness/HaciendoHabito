import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {} from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { ArrowLeft, Plus, Save, Trash2, Upload } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { WebIntakeCatalogSettings, WebPlan, WebPlanCatalogSegment } from '@/types/database'
import toast from 'react-hot-toast'
import {
  WEB_INTAKE_CATALOG_BUCKET,
  WEB_INTAKE_CATALOG_IMAGE_MAX_BYTES,
  webIntakeImageExt,
} from '@/lib/webIntakeCatalogAssets'
import { trainerCtaFormAccentClassName } from '@/lib/primaryGradientCtaClasses'
import { cn } from '@/lib/utils'

type EditableWebPlan = Pick<
  WebPlan,
  | 'slug'
  | 'title'
  | 'price_label'
  | 'price_yearly_label'
  | 'short_description'
  | 'intro_text'
  | 'includes_items'
  | 'gifts_items'
  | 'sort_order'
  | 'is_active'
  | 'show_in_public_intake'
  | 'catalog_segment'
  | 'display_badge'
  | 'credential_line_override'
>

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

const FALLBACK_PLANS: EditableWebPlan[] = [
  {
    slug: 'plan-entrenamiento',
    title: 'Primer Plan Entrenamiento',
    price_label: '$60.000',
    price_yearly_label: '$600.000',
    short_description: 'Entrenamiento personalizado con seguimiento mensual.',
    intro_text:
      'Plan avanzado de entrenamiento orientado al rendimiento físico, con enfoque en fuerza, resistencia y recuperación. Seguimiento continuo y ajustes según objetivos.',
    includes_items: [
      'Videollamada de bienvenida gratuita.',
      'Videollamada mensual para ajustes/progreso.',
      'Actualización mensual de tu rutina.',
    ],
    gifts_items: ['Calendario gratis para anotar tus hábitos.', 'Materiales y guías digitales.'],
    sort_order: 1,
    is_active: true,
    show_in_public_intake: true,
    catalog_segment: 'solo',
    display_badge: null,
    credential_line_override: null,
  },
  {
    slug: 'plan-nutricion',
    title: 'Segundo Plan Nutrición',
    price_label: '$80.000',
    price_yearly_label: '$800.000',
    short_description: 'Plan nutricional + seguimiento para sostener hábitos.',
    intro_text:
      'Plan premium de acompañamiento integral en nutrición para establecer y mantener hábitos saludables de forma sostenida, con planificación adaptada a tu contexto.',
    includes_items: [
      'Videollamada de bienvenida gratuita.',
      'Videollamada mensual para seguimiento de progreso.',
      'Planificación nutricional adaptada a tus objetivos.',
    ],
    gifts_items: ['Calendario gratis para anotar tus hábitos.', 'Materiales y guías digitales.'],
    sort_order: 2,
    is_active: true,
    show_in_public_intake: true,
    catalog_segment: 'with_cris',
    display_badge: null,
    credential_line_override: null,
  },
  {
    slug: 'plan-full',
    title: 'Plan Full',
    price_label: '$100.000',
    price_yearly_label: '$1.000.000',
    short_description: 'Combina entrenamiento + nutrición en un plan integral.',
    intro_text:
      'Plan integral que abarca entrenamiento y nutrición en conjunto, orientado a maximizar resultados con acompañamiento completo, estrategia personalizada y seguimiento continuo.',
    includes_items: [
      'Videollamada de bienvenida + evaluación inicial completa.',
      'Videollamada mensual de progreso y ajustes.',
      'Rutina + planificación nutricional personalizada.',
    ],
    gifts_items: ['Calendario gratis para anotar tus hábitos.', 'Materiales y guías digitales.'],
    sort_order: 3,
    is_active: true,
    show_in_public_intake: true,
    catalog_segment: 'full',
    display_badge: null,
    credential_line_override: null,
  },
]

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

function newPlanDraft(sortOrder: number): EditableWebPlan {
  const slug = `plan-${Date.now().toString(36)}`
  return {
    slug,
    title: 'Nueva oferta',
    price_label: '$—',
    price_yearly_label: null,
    short_description: 'Editá la descripción corta que verán en la tarjeta (8–140 caracteres).',
    intro_text:
      'Detalle que se muestra al tocar «más info». Podés extenderlo hasta 3500 caracteres con el nombre original del servicio y lo que incluye.',
    includes_items: ['Primer ítem del plan (editá o agregá líneas abajo).'],
    gifts_items: ['Bonificación o material de regalo.'],
    sort_order: sortOrder,
    is_active: true,
    show_in_public_intake: true,
    catalog_segment: 'solo',
    display_badge: null,
    credential_line_override: null,
  }
}

export function WebPlansSettingsPage() {
  const navigate = useAppNavigate()
  const role = useAuthStore((s) => s.profile?.role)
  const canManage = role === 'admin' || role === 'trainer' || role === 'nutritionist'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [plans, setPlans] = useState<EditableWebPlan[]>(FALLBACK_PLANS)
  /** Slugs creados en esta sesión y aún no guardados en la base (se pueden borrar). */
  const [draftSlugs, setDraftSlugs] = useState<string[]>([])
  const [soloSegmentImg, setSoloSegmentImg] = useState('')
  const [withCrisSegmentImg, setWithCrisSegmentImg] = useState('')
  const [fullSegmentImg, setFullSegmentImg] = useState('')
  const [intakeSlotsOpen, setIntakeSlotsOpen] = useState(true)
  const [intakeSlotsRemaining, setIntakeSlotsRemaining] = useState('')
  const [intakeSlotsMessage, setIntakeSlotsMessage] = useState('')
  const [testimonialUrlsText, setTestimonialUrlsText] = useState('')
  const [modalityLabelSolo, setModalityLabelSolo] = useState('')
  const [modalityLabelWithCris, setModalityLabelWithCris] = useState('')
  const [modalityLabelFull, setModalityLabelFull] = useState('')
  const [assetsSaving, setAssetsSaving] = useState(false)
  const soloFileRef = useRef<HTMLInputElement>(null)
  const crisFileRef = useRef<HTMLInputElement>(null)
  const fullFileRef = useRef<HTMLInputElement>(null)
  const [soloUploadBusy, setSoloUploadBusy] = useState(false)
  const [crisUploadBusy, setCrisUploadBusy] = useState(false)
  const [fullUploadBusy, setFullUploadBusy] = useState(false)
  const catalogUserId = useAuthStore((s) => s.user?.id)

  useEffect(() => {
    if (!canManage) return
    ;(async () => {
      const { data } = await supabase.from('web_intake_catalog_settings').select('*').eq('id', 1).maybeSingle()
      if (!data) return
      const row = data as WebIntakeCatalogSettings
      setSoloSegmentImg(row.solo_segment_image_url ?? '')
      setWithCrisSegmentImg(row.with_cris_segment_image_url ?? '')
      setFullSegmentImg(row.full_segment_image_url ?? '')
      setTestimonialUrlsText(((row.testimonial_videos ?? []) as string[]).join('\n'))
      if (typeof row.intake_slots_open === 'boolean') setIntakeSlotsOpen(row.intake_slots_open)
      if (row.intake_slots_remaining != null && Number.isFinite(row.intake_slots_remaining)) {
        setIntakeSlotsRemaining(String(row.intake_slots_remaining))
      } else setIntakeSlotsRemaining('')
      setIntakeSlotsMessage(row.intake_slots_public_message ?? '')
      setModalityLabelSolo(row.modality_label_solo ?? '')
      setModalityLabelWithCris(row.modality_label_with_cris ?? '')
      setModalityLabelFull(row.modality_label_full ?? '')
    })()
  }, [canManage])

  async function handleSaveSegmentImages() {
    if (
      soloSegmentImg.length > LIMITS.segmentImgUrl ||
      withCrisSegmentImg.length > LIMITS.segmentImgUrl ||
      fullSegmentImg.length > LIMITS.segmentImgUrl
    ) {
      toast.error(`Las URL no pueden superar ${LIMITS.segmentImgUrl} caracteres.`)
      return
    }
    setAssetsSaving(true)
    try {
      const { error } = await supabase.from('web_intake_catalog_settings').upsert({
        id: 1,
        solo_segment_image_url: soloSegmentImg.trim() ? soloSegmentImg.trim() : null,
        with_cris_segment_image_url: withCrisSegmentImg.trim() ? withCrisSegmentImg.trim() : null,
        full_segment_image_url: fullSegmentImg.trim() ? fullSegmentImg.trim() : null,
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
    const b = modalityLabelWithCris.trim()
    const c = modalityLabelFull.trim()
    if ([a, b, c].some((t) => t.length > LIMITS.modalityLabel)) {
      toast.error(`Cada etiqueta admite hasta ${LIMITS.modalityLabel} caracteres.`)
      return
    }
    setAssetsSaving(true)
    try {
      const { error } = await supabase.from('web_intake_catalog_settings').upsert({
        id: 1,
        modality_label_solo: a || null,
        modality_label_with_cris: b || null,
        modality_label_full: c || null,
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

  async function uploadSegmentHero(field: 'solo' | 'with_cris' | 'full', file: File | null | undefined) {
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
      : field === 'with_cris' ? 'with-cris-line'
      : 'full-line'
    const setBusy =
      field === 'solo' ? setSoloUploadBusy
      : field === 'with_cris' ? setCrisUploadBusy
      : setFullUploadBusy
    const setUrl =
      field === 'solo' ? setSoloSegmentImg
      : field === 'with_cris' ? setWithCrisSegmentImg
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
      setUrl(data.publicUrl)
      toast.success('Imagen subida. Tocá «Guardar fotos del selector» para publicar.')
    } finally {
      setBusy(false)
      if (field === 'solo' && soloFileRef.current) soloFileRef.current.value = ''
      else if (field === 'with_cris' && crisFileRef.current) crisFileRef.current.value = ''
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
        short_description: row.short_description,
        intro_text: row.intro_text,
        includes_items: row.includes_items ?? [],
        gifts_items: row.gifts_items ?? [],
        sort_order: row.sort_order,
        is_active: row.is_active,
        show_in_public_intake: row.show_in_public_intake !== false,
        catalog_segment: (row.catalog_segment ?? 'solo') as WebPlanCatalogSegment,
        display_badge: row.display_badge ?? null,
        credential_line_override: row.credential_line_override ?? null,
      }))
      if (rows.length > 0) {
        setPlans(rows)
        setDraftSlugs([])
      }
    })()
    return () => {
      mounted = false
    }
  }, [canManage])

  const sortedPlans = useMemo(() => [...plans].sort((a, b) => a.sort_order - b.sort_order), [plans])

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
  }

  function removeDraft(slug: string) {
    if (!draftSlugs.includes(slug)) return
    setPlans((prev) => prev.filter((p) => p.slug !== slug))
    setDraftSlugs((ds) => ds.filter((s) => s !== slug))
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
      if (!plan.short_description.trim() || plan.short_description.length > LIMITS.short) return 'La descripción corta supera el límite.'
      if (!plan.intro_text.trim() || plan.intro_text.length > LIMITS.intro) return 'El detalle principal supera el límite.'
      const b = plan.display_badge?.trim()
      if (b && b.length > LIMITS.badge) return `La etiqueta de la oferta («${plan.slug}») supera ${LIMITS.badge} caracteres.`
      const cred = plan.credential_line_override?.trim()
      if (cred && cred.length > LIMITS.credentialLine) {
        return `La línea de credencial libre de la oferta «${plan.slug}» supera ${LIMITS.credentialLine} caracteres.`
      }
      if (plan.includes_items.length === 0 || plan.gifts_items.length === 0) return 'Cada oferta necesita al menos un ítem en Incluye y De regalo.'
      if (plan.includes_items.some((item) => item.length > LIMITS.item) || plan.gifts_items.some((item) => item.length > LIMITS.item)) {
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
      short_description: plan.short_description.trim(),
      intro_text: plan.intro_text.trim(),
      includes_items: plan.includes_items,
      gifts_items: plan.gifts_items,
      sort_order: plan.sort_order,
      is_active: plan.is_active,
      show_in_public_intake: plan.show_in_public_intake !== false,
      catalog_segment: plan.catalog_segment,
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
      short_description: row.short_description,
      intro_text: row.intro_text,
      includes_items: row.includes_items ?? [],
      gifts_items: row.gifts_items ?? [],
      sort_order: row.sort_order,
      is_active: row.is_active,
      show_in_public_intake: row.show_in_public_intake !== false,
      catalog_segment: (row.catalog_segment ?? 'solo') as WebPlanCatalogSegment,
      display_badge: row.display_badge ?? null,
      credential_line_override: row.credential_line_override ?? null,
    }))
    if (rows.length > 0) setPlans(rows)
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

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 lg:px-6">
        <div className="rounded-xl border border-surface-border bg-surface-elevated/40 px-4 py-3">
          <p className="text-sm leading-relaxed text-ink-secondary">
            <span className="font-semibold text-ink-primary">Qué editás acá y qué pasa en /form</span>
            <br />
            Arriba: fotos del selector, <strong className="text-ink-primary">etiquetas de modalidad</strong> (Ferster / Nutrición / Full), cupos y
            testimonios. Abajo: <strong className="text-ink-primary">ofertas</strong> por modalidad — cada fila es una card en el /form con lo que
            incluye, regalos y textos. El visitante elige <strong className="text-ink-primary">Mensual, x3, x6 o Anual</strong> arriba de las cards:{' '}
            <strong className="text-ink-primary">sólo cambia el precio</strong>, no el contenido de la oferta.
          </p>
        </div>

        <SectionCard
          title="1 · Fotos del selector"
          subtitle="Avatares al elegir entrenador o nutricionista. Subí JPG/PNG/WebP (bucket web-intake-catalog) o pegá URL HTTPS."
        >
          <input
            ref={soloFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => void uploadSegmentHero('solo', e.target.files?.length ? e.target.files[0] : undefined)}
          />
          <input
            ref={crisFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => void uploadSegmentHero('with_cris', e.target.files?.length ? e.target.files[0] : undefined)}
          />
          <input
            ref={fullFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => void uploadSegmentHero('full', e.target.files?.length ? e.target.files[0] : undefined)}
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
              loading={crisUploadBusy}
              icon={<Upload className="h-4 w-4" />}
              disabled={!catalogUserId}
              onClick={() => crisFileRef.current?.click()}
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
            value={withCrisSegmentImg}
            maxLength={LIMITS.segmentImgUrl}
            onChange={(e) => setWithCrisSegmentImg(e.target.value)}
          />
          <Input
            label="URL · Full (ambos)"
            placeholder="https://..."
            value={fullSegmentImg}
            maxLength={LIMITS.segmentImgUrl}
            onChange={(e) => setFullSegmentImg(e.target.value)}
          />
          <Button type="button" size="sm" variant="gradientPrimary" onClick={() => void handleSaveSegmentImages()} loading={assetsSaving}>
            Guardar fotos
          </Button>
        </SectionCard>

        <SectionCard
          title="1b · Etiquetas «Modalidad» (paso 1 del /form)"
          subtitle="Textos del desplegable que el visitante ve antes de elegir plan. Vacío = valores por defecto (FERSTER FITNESS / Solo Nutrición / ENTRENO+NUTRICIÓN)."
        >
          <Input
            label="Línea solo entrenamiento (segmento solo)"
            placeholder="Ej. FERSTER FITNESS"
            maxLength={LIMITS.modalityLabel}
            value={modalityLabelSolo}
            onChange={(e) => setModalityLabelSolo(e.target.value)}
          />
          <Input
            label="Solo nutrición (segmento with_cris)"
            placeholder="Ej. Solo Nutrición"
            maxLength={LIMITS.modalityLabel}
            value={modalityLabelWithCris}
            onChange={(e) => setModalityLabelWithCris(e.target.value)}
          />
          <Input
            label="Plan full (segmento full)"
            placeholder="Ej. ENTRENO+NUTRICIÓN"
            maxLength={LIMITS.modalityLabel}
            value={modalityLabelFull}
            onChange={(e) => setModalityLabelFull(e.target.value)}
          />
          <Button type="button" size="sm" variant="gradientPrimary" onClick={() => void handleSaveModalityLabels()} loading={assetsSaving}>
            Guardar etiquetas
          </Button>
        </SectionCard>

        <SectionCard
          title="2 · Cupos"
          subtitle="Misma barra compacta de «Cupos disponibles» que arriba del formulario. Número opcional."
        >
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-secondary">
            <input
              type="checkbox"
              className={cn('h-4 w-4 rounded border-surface-border', trainerCtaFormAccentClassName)}
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
        </SectionCard>

        <SectionCard title="3 · Testimonios en video" subtitle="Una URL por línea. Grilla en /form.">
          <Textarea
            label="URLs"
            rows={5}
            placeholder={'https://...\nhttps://...'}
            value={testimonialUrlsText}
            onChange={(e) => setTestimonialUrlsText(e.target.value)}
          />
          <Button type="button" size="sm" variant="gradientPrimary" onClick={() => void handleSaveTestimonials()} loading={assetsSaving}>
            Guardar testimonios
          </Button>
        </SectionCard>

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
          <Button type="button" size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={addPlan} className="shrink-0">
            Agregar oferta
          </Button>
        </div>

        {loading ? (
          <Card className="p-6 text-sm text-ink-secondary">Cargando ofertas…</Card>
        ) : (
          sortedPlans.map((plan, idx) => (
            <Card key={plan.slug} className="overflow-hidden p-0 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-border bg-surface-elevated/45 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-ink-primary">
                    Oferta {idx + 1}
                    <span className="ml-1.5 font-normal text-ink-secondary">· {plan.title}</span>
                  </h2>
                  <p className="mt-0.5 font-mono text-xs text-ink-muted">{plan.slug}</p>
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
                ) : null}
              </div>

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
                      className={cn('h-4 w-4 rounded border-surface-border', trainerCtaFormAccentClassName)}
                      checked={plan.is_active}
                      onChange={(e) => updatePlan(plan.slug, { is_active: e.target.checked })}
                    />
                    Plan activo (oferta habilitada en la base)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-secondary">
                    <input
                      type="checkbox"
                      className={cn('h-4 w-4 rounded border-surface-border', trainerCtaFormAccentClassName)}
                      checked={plan.show_in_public_intake !== false}
                      onChange={(e) => updatePlan(plan.slug, { show_in_public_intake: e.target.checked })}
                    />
                    Mostrar esta oferta en el /form
                  </label>
                  <p className="text-[11px] leading-snug text-ink-muted -mt-2 pl-7">
                    Desmarcá si no querés que aparezca como card (ej. oferta pausada). En el /form, Mensual / x3 / x6 / Anual sólo cambian los
                    importes; lo que ofrece cada card lo definís en esta oferta (incluye, regalos, textos).
                  </p>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-secondary">Modalidad (igual que el desplegable del /form)</label>
                    <select
                      value={plan.catalog_segment}
                      onChange={(e) =>
                        updatePlan(plan.slug, { catalog_segment: e.target.value as WebPlanCatalogSegment })
                      }
                      className="w-full max-w-md rounded-xl border border-surface-border bg-surface-base px-3 py-2 text-sm text-ink-primary"
                    >
                      <option value="solo">FERSTER FITNESS (solo)</option>
                      <option value="with_cris">Solo Nutrición (with_cris)</option>
                      <option value="full">ENTRENO+NUTRICIÓN (full)</option>
                    </select>
                    <p className="mt-1.5 text-[11px] text-ink-muted">
                      Debe coincidir con la opción del /form (Ferster / Nutrición / Full): sólo se muestran las ofertas de esa modalidad. El orden define el orden de las cards.
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
                    hint={`${(plan.price_yearly_label ?? '').length}/${LIMITS.priceYearly} · En /form, x3 y x6 meses se calculan desde el mensual con descuento referencial (no se editan acá).`}
                    onChange={(e) =>
                      updatePlan(plan.slug, { price_yearly_label: e.target.value.trim() ? e.target.value : null })
                    }
                  />
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
                  <Textarea
                    label="Incluye — una línea por ítem"
                    value={toMultiline(plan.includes_items)}
                    hint="Máx. 180 caracteres por línea."
                    onChange={(e) => updatePlan(plan.slug, { includes_items: parseItems(e.target.value) })}
                  />
                  <Textarea
                    label="De regalo — una línea por ítem"
                    value={toMultiline(plan.gifts_items)}
                    hint="Máx. 180 caracteres por línea."
                    onChange={(e) => updatePlan(plan.slug, { gifts_items: parseItems(e.target.value) })}
                  />
                </FieldGroup>
              </div>
            </Card>
          ))
        )}

        <div className="border-t border-surface-border pt-2">
          <Button
            className="w-full sm:w-auto"
            variant="gradientPrimary"
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
