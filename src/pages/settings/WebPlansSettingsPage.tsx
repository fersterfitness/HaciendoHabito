import { useEffect, useMemo, useRef, useState } from 'react'
import {} from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { ArrowLeft, Plus, Save, Trash2, Upload } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormSection } from '@/components/ui/FormSection'
import { Input, Textarea } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { WebPlan, WebPlanCatalogSegment } from '@/types/database'
import toast from 'react-hot-toast'
import {
  WEB_INTAKE_CATALOG_BUCKET,
  WEB_INTAKE_CATALOG_IMAGE_MAX_BYTES,
  webIntakeImageExt,
} from '@/lib/webIntakeCatalogAssets'

type EditableWebPlan = Pick<
  WebPlan,
  | 'slug'
  | 'title'
  | 'price_label'
  | 'short_description'
  | 'intro_text'
  | 'includes_items'
  | 'gifts_items'
  | 'sort_order'
  | 'is_active'
  | 'catalog_segment'
  | 'display_badge'
>

const LIMITS = {
  title: 120,
  price: 24,
  short: 140,
  intro: 3500,
  badge: 48,
  item: 180,
  segmentImgUrl: 600,
  testimonialUrl: 900,
} as const

const FALLBACK_PLANS: EditableWebPlan[] = [
  {
    slug: 'plan-entrenamiento',
    title: 'Primer Plan Entrenamiento',
    price_label: '$60.000',
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
    catalog_segment: 'solo',
    display_badge: null,
  },
  {
    slug: 'plan-nutricion',
    title: 'Segundo Plan Nutrición',
    price_label: '$80.000',
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
    catalog_segment: 'solo',
    display_badge: null,
  },
  {
    slug: 'plan-full',
    title: 'Plan Full',
    price_label: '$100.000',
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
    catalog_segment: 'solo',
    display_badge: null,
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

function newPlanDraft(sortOrder: number): EditableWebPlan {
  const slug = `plan-${Date.now().toString(36)}`
  return {
    slug,
    title: 'Nuevo plan',
    price_label: '$—',
    short_description: 'Editá la descripción corta que verán en la tarjeta (8–140 caracteres).',
    intro_text:
      'Detalle que se muestra al tocar «más info». Podés extenderlo hasta 3500 caracteres con el nombre original del servicio y lo que incluye.',
    includes_items: ['Primer ítem del plan (editá o agregá líneas abajo).'],
    gifts_items: ['Bonificación o material de regalo.'],
    sort_order: sortOrder,
    is_active: true,
    catalog_segment: 'solo',
    display_badge: null,
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
  const [testimonialUrlsText, setTestimonialUrlsText] = useState('')
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
      setSoloSegmentImg(data.solo_segment_image_url ?? '')
      setWithCrisSegmentImg(data.with_cris_segment_image_url ?? '')
      setFullSegmentImg((data as Record<string, unknown>).full_segment_image_url as string ?? '')
      setTestimonialUrlsText(((data.testimonial_videos as string[] | null) ?? []).join('\n'))
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
    const slug = field === 'solo' ? 'solo-line' : field === 'with_cris' ? 'with-cris-line' : 'full-line'
    const setBusy = field === 'solo' ? setSoloUploadBusy : field === 'with_cris' ? setCrisUploadBusy : setFullUploadBusy
    const setUrl = field === 'solo' ? setSoloSegmentImg : field === 'with_cris' ? setWithCrisSegmentImg : setFullSegmentImg
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
        short_description: row.short_description,
        intro_text: row.intro_text,
        includes_items: row.includes_items ?? [],
        gifts_items: row.gifts_items ?? [],
        sort_order: row.sort_order,
        is_active: row.is_active,
        catalog_segment: (row.catalog_segment ?? 'solo') as WebPlanCatalogSegment,
        display_badge: row.display_badge ?? null,
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
    let t = sanitizeSlugRaw(row.slug).replace(/^-+|-+$/g, '')
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
      toast.error('Ese slug ya lo usa otro plan.')
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
      if (!SLUG_RE.test(plan.slug.trim())) return 'Revisá el slug de cada plan (minúsculas, números y guiones).'
      const s = plan.slug.trim()
      if (seen.has(s)) return `Slug duplicado: ${s}`
      seen.add(s)
      if (!plan.title.trim() || plan.title.length > LIMITS.title) return 'Revisá el título de los planes.'
      if (!plan.price_label.trim() || plan.price_label.length > LIMITS.price) return 'Revisá el precio de los planes.'
      if (!plan.short_description.trim() || plan.short_description.length > LIMITS.short) return 'La descripción corta supera el límite.'
      if (!plan.intro_text.trim() || plan.intro_text.length > LIMITS.intro) return 'El detalle principal supera el límite.'
      const b = plan.display_badge?.trim()
      if (b && b.length > LIMITS.badge) return `La etiqueta del plan («${plan.slug}») supera ${LIMITS.badge} caracteres.`
      if (plan.includes_items.length === 0 || plan.gifts_items.length === 0) return 'Cada plan necesita al menos un ítem en Incluye y De regalo.'
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
      short_description: plan.short_description.trim(),
      intro_text: plan.intro_text.trim(),
      includes_items: plan.includes_items,
      gifts_items: plan.gifts_items,
      sort_order: plan.sort_order,
      is_active: plan.is_active,
      catalog_segment: plan.catalog_segment,
      display_badge: plan.display_badge?.trim() ? plan.display_badge.trim().slice(0, LIMITS.badge) : null,
    }))
    const { error } = await supabase.from('web_plans').upsert(payload, { onConflict: 'slug' })
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setDraftSlugs([])
    toast.success('Planes web actualizados')
    const { data } = await supabase.from('web_plans').select('*').order('sort_order')
    const rows = ((data as WebPlan[]) ?? []).map((row) => ({
      slug: row.slug,
      title: row.title,
      price_label: row.price_label,
      short_description: row.short_description,
      intro_text: row.intro_text,
      includes_items: row.includes_items ?? [],
      gifts_items: row.gifts_items ?? [],
      sort_order: row.sort_order,
      is_active: row.is_active,
      catalog_segment: (row.catalog_segment ?? 'solo') as WebPlanCatalogSegment,
      display_badge: row.display_badge ?? null,
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

      <div className="px-4 lg:px-6 py-6 space-y-4">
        <Card className="p-4 space-y-4">
          <FormSection title="Fotos del selector de profesional (/form)">
            <p className="text-xs text-ink-secondary">
              Podés <strong>subir</strong> una imagen por línea (se guarda en Storage y escribe la URL pública debajo). También pegás cualquier HTTPS.
              Migración necesaria para subir desde acá: bucket `web-intake-catalog` en Supabase.
            </p>
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
                type="button" size="sm" variant="outline"
                loading={soloUploadBusy} icon={<Upload className="h-4 w-4" />}
                disabled={!catalogUserId} onClick={() => soloFileRef.current?.click()}
              >
                Subir · Entrenador
              </Button>
              <Button
                type="button" size="sm" variant="outline"
                loading={crisUploadBusy} icon={<Upload className="h-4 w-4" />}
                disabled={!catalogUserId} onClick={() => crisFileRef.current?.click()}
              >
                Subir · Nutricionista
              </Button>
              <Button
                type="button" size="sm" variant="outline"
                loading={fullUploadBusy} icon={<Upload className="h-4 w-4" />}
                disabled={!catalogUserId} onClick={() => fullFileRef.current?.click()}
              >
                Subir · Full
              </Button>
            </div>
            <Input
              label="URL imagen · Entrenador (Tomás Ferster)"
              placeholder="https://..."
              value={soloSegmentImg}
              maxLength={LIMITS.segmentImgUrl}
              onChange={(e) => setSoloSegmentImg(e.target.value)}
            />
            <Input
              label="URL imagen · Nutricionista (Cristian Crossetto)"
              placeholder="https://..."
              value={withCrisSegmentImg}
              maxLength={LIMITS.segmentImgUrl}
              onChange={(e) => setWithCrisSegmentImg(e.target.value)}
            />
            <Input
              label="URL imagen · Full (Tomás + Cristian)"
              placeholder="https://..."
              value={fullSegmentImg}
              maxLength={LIMITS.segmentImgUrl}
              onChange={(e) => setFullSegmentImg(e.target.value)}
            />
            <Button type="button" size="sm" onClick={() => void handleSaveSegmentImages()} loading={assetsSaving}>
              Guardar fotos del selector
            </Button>
          </FormSection>
          <FormSection title="Videos testimonios (/form)">
            <p className="text-xs text-ink-secondary">
              Pegá una URL por línea (YouTube/Vimeo o link directo `.mp4`). Se mostrará una grilla de videos en el formulario público.
            </p>
            <Textarea
              label="URLs (una por línea)"
              rows={5}
              placeholder={'https://...\nhttps://...'}
              value={testimonialUrlsText}
              onChange={(e) => setTestimonialUrlsText(e.target.value)}
            />
            <Button type="button" size="sm" onClick={() => void handleSaveTestimonials()} loading={assetsSaving}>
              Guardar testimonios
            </Button>
          </FormSection>
          <hr className="border-surface-border" />
          <div>
            <p className="text-xs text-ink-secondary mb-4">
              Límites: título {LIMITS.title}, precio {LIMITS.price}, descripción corta {LIMITS.short}, detalle {LIMITS.intro},
              etiqueta opcional de card {LIMITS.badge}, ítem de lista {LIMITS.item}. Podés dar de alta nuevos planes; el slug
              del borrador sólo editable hasta el primer guardado.
            </p>
            <Button type="button" size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={addPlan}>
              Agregar plan
            </Button>
          </div>
        </Card>

        {loading ? (
          <Card className="p-6 text-sm text-ink-secondary">Cargando planes...</Card>
        ) : (
          sortedPlans.map((plan, idx) => (
            <Card key={plan.slug} className="p-4">
              <FormSection title={`Plan ${idx + 1}`}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-[200px] flex-1">
                    <Input
                      label="Slug (URL / identificador)"
                      value={plan.slug}
                      disabled={!draftSlugs.includes(plan.slug)}
                      hint={
                        draftSlugs.includes(plan.slug)
                          ? 'Editable solo en borrador nuevo. Ej. plan-consulta-nutricion'
                          : 'Guardado en la base — no editable acá.'
                      }
                      onChange={(e) => {
                        if (draftSlugs.includes(plan.slug)) onDraftSlugChange(plan.slug, e.target.value)
                      }}
                      onBlur={() => finalizeDraftSlug(plan.slug)}
                      className="font-mono text-xs"
                    />
                  </div>
                  {draftSlugs.includes(plan.slug) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-status-expired border-status-expired/40"
                      icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => removeDraft(plan.slug)}
                    >
                      Quitar borrador
                    </Button>
                  ) : null}
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 pb-4 text-sm text-ink-secondary">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-surface-border accent-brand-primary"
                    checked={plan.is_active}
                    onChange={(e) => updatePlan(plan.slug, { is_active: e.target.checked })}
                  />
                  Visible en el formulario web (plan activo)
                </label>
                <label className="block text-xs font-medium text-ink-secondary mb-1">Catálogo público</label>
                <select
                  value={plan.catalog_segment}
                  onChange={(e) =>
                    updatePlan(plan.slug, { catalog_segment: e.target.value as WebPlanCatalogSegment })
                  }
                  className="mb-4 w-full max-w-xs rounded-xl border border-surface-border bg-surface-base px-3 py-2 text-sm text-ink-primary"
                >
                  <option value="solo">Solo tu línea / tu foto</option>
                  <option value="with_cris">Planes conjunto · Cristian Vázquez</option>
                </select>
                <Input
                  label="Etiqueta en la card (opcional)"
                  value={plan.display_badge ?? ''}
                  placeholder="Ej. Nutrición, Consulta inicial…"
                  maxLength={LIMITS.badge}
                  hint={`Vacío → se deduce por el slug conocido (${(plan.display_badge ?? '').length}/${LIMITS.badge})`}
                  onChange={(e) => updatePlan(plan.slug, { display_badge: e.target.value || null })}
                />
                <Input
                  label="Título"
                  value={plan.title}
                  maxLength={LIMITS.title}
                  hint={`${plan.title.length}/${LIMITS.title}`}
                  onChange={(e) => updatePlan(plan.slug, { title: e.target.value })}
                />
                <Input
                  label="Precio"
                  value={plan.price_label}
                  maxLength={LIMITS.price}
                  hint={`${plan.price_label.length}/${LIMITS.price}`}
                  onChange={(e) => updatePlan(plan.slug, { price_label: e.target.value })}
                />
                <Textarea
                  label="Descripción corta (card)"
                  value={plan.short_description}
                  maxLength={LIMITS.short}
                  hint={`${plan.short_description.length}/${LIMITS.short}`}
                  onChange={(e) => updatePlan(plan.slug, { short_description: e.target.value })}
                />
                <Textarea
                  label="Detalle principal"
                  value={plan.intro_text}
                  maxLength={LIMITS.intro}
                  hint={`${plan.intro_text.length}/${LIMITS.intro}`}
                  onChange={(e) => updatePlan(plan.slug, { intro_text: e.target.value })}
                />
                <Textarea
                  label="Incluye (una línea por ítem)"
                  value={toMultiline(plan.includes_items)}
                  hint="Cada línea: máximo 180 caracteres."
                  onChange={(e) => updatePlan(plan.slug, { includes_items: parseItems(e.target.value) })}
                />
                <Textarea
                  label="De regalo (una línea por ítem)"
                  value={toMultiline(plan.gifts_items)}
                  hint="Cada línea: máximo 180 caracteres."
                  onChange={(e) => updatePlan(plan.slug, { gifts_items: parseItems(e.target.value) })}
                />
              </FormSection>
            </Card>
          ))
        )}

        <Button icon={<Save className="h-4 w-4" />} onClick={handleSave} loading={saving}>
          Guardar planes
        </Button>
      </div>
    </div>
  )
}
