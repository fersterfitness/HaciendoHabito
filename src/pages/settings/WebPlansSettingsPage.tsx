import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormSection } from '@/components/ui/FormSection'
import { Input, Textarea } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { WebPlan } from '@/types/database'
import toast from 'react-hot-toast'

type EditableWebPlan = Pick<
  WebPlan,
  'slug' | 'title' | 'price_label' | 'short_description' | 'intro_text' | 'includes_items' | 'gifts_items' | 'sort_order' | 'is_active'
>

const LIMITS = {
  title: 60,
  price: 24,
  short: 140,
  intro: 700,
  item: 180,
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

export function WebPlansSettingsPage() {
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.profile?.role)
  const canManage = role === 'admin' || role === 'trainer' || role === 'nutritionist'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [plans, setPlans] = useState<EditableWebPlan[]>(FALLBACK_PLANS)

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
      }))
      if (rows.length > 0) setPlans(rows)
    })()
    return () => {
      mounted = false
    }
  }, [canManage])

  const sortedPlans = useMemo(() => [...plans].sort((a, b) => a.sort_order - b.sort_order), [plans])

  function updatePlan(slug: string, patch: Partial<EditableWebPlan>) {
    setPlans((prev) => prev.map((p) => (p.slug === slug ? { ...p, ...patch } : p)))
  }

  function validate() {
    for (const plan of plans) {
      if (!plan.title.trim() || plan.title.length > LIMITS.title) return 'Revisá el título de los planes.'
      if (!plan.price_label.trim() || plan.price_label.length > LIMITS.price) return 'Revisá el precio de los planes.'
      if (!plan.short_description.trim() || plan.short_description.length > LIMITS.short) return 'La descripción corta supera el límite.'
      if (!plan.intro_text.trim() || plan.intro_text.length > LIMITS.intro) return 'El detalle principal supera el límite.'
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
    }))
    const { error } = await supabase.from('web_plans').upsert(payload, { onConflict: 'slug' })
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Planes web actualizados')
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
        <Card className="p-4">
          <p className="text-xs text-ink-secondary">
            Límites para evitar que se rompan las cards: título {LIMITS.title}, precio {LIMITS.price}, descripción corta {LIMITS.short}, detalle {LIMITS.intro} e ítems de lista {LIMITS.item} caracteres.
          </p>
        </Card>

        {loading ? (
          <Card className="p-6 text-sm text-ink-secondary">Cargando planes...</Card>
        ) : (
          sortedPlans.map((plan, idx) => (
            <Card key={plan.slug} className="p-4">
              <FormSection title={`Plan ${idx + 1}`}>
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
