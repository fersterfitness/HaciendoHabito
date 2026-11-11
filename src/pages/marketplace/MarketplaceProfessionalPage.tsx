import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { PublicShell, ProfessionalPhoto, VerifiedMark } from '@/components/marketplace/PublicShell'
import { usePublicProfessional } from '@/data/marketplace'
import {
  MARKETPLACE_ROLES,
  durationLabel,
  durationPer,
  formatPrice,
  modalityLabel,
  roleArea,
  roleLabel,
  sportLabel,
  whatsappLink,
  type MarketplacePlan,
  type MarketplaceProfessional,
} from '@/lib/marketplace'
import { cn } from '@/lib/utils'
import { teamTotal, useMarketplaceTeam } from '@/stores/marketplaceTeam'

function PlanCard({ plan, professional }: { plan: MarketplacePlan; professional: MarketplaceProfessional }) {
  const current = useMarketplaceTeam((s) => s.items.find((i) => i.professionalId === professional.id))
  const add = useMarketplaceTeam((s) => s.add)
  const remove = useMarketplaceTeam((s) => s.remove)
  const selected = current?.planId === plan.id
  const soldOut = plan.cupos === 0

  const choose = () =>
    add({
      planId: plan.id,
      professionalId: professional.id,
      slug: professional.slug,
      nombre: professional.nombre,
      rol: professional.rol,
      titulo: plan.titulo,
      precio: plan.precio,
      duracion: plan.duracion,
    })

  return (
    <article
      className={cn(
        'flex flex-col gap-3.5 rounded-xl border bg-surface-card p-5',
        selected ? 'border-ink-primary ring-1 ring-ink-primary' : 'border-surface-border',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">{plan.titulo}</h3>
          <p className="text-body-sm text-ink-muted">
            {[durationLabel(plan.duracion), plan.modalidad === 'online' ? 'Online' : plan.modalidad === 'presencial' ? 'Presencial' : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <p className="text-2xl font-bold tabular-nums">
          {formatPrice(plan.precio)}
          <span className="ml-1 text-sm font-normal text-ink-muted">{durationPer(plan.duracion)}</span>
        </p>
      </div>
      {plan.descripcion ? <p className="text-sm text-ink-secondary">{plan.descripcion}</p> : null}
      {plan.incluye.length ? (
        <ul className="flex flex-col gap-2 text-sm text-ink-secondary">
          {plan.incluye.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-ok-ink" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-3.5">
        {selected ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-status-ok-ink">
              <Check className="h-4 w-4" aria-hidden="true" />
              Ya está en tu equipo
            </span>
            <Button variant="secondary" size="lg" onClick={() => remove(professional.id)}>
              Quitar
            </Button>
          </>
        ) : (
          <>
            <span className="text-body-sm text-ink-muted">
              {soldOut
                ? 'Sin cupos por ahora'
                : plan.cupos != null
                  ? `${plan.cupos === 1 ? 'Queda 1 cupo' : `Quedan ${plan.cupos} cupos`}`
                  : ''}
            </span>
            <Button size="lg" disabled={soldOut} onClick={choose}>
              {current ? 'Cambiar por este plan' : 'Sumar a mi equipo'}
            </Button>
          </>
        )}
      </div>
    </article>
  )
}

function TeamAside() {
  const items = useMarketplaceTeam((s) => s.items)
  const missing = MARKETPLACE_ROLES.filter((r) => !items.some((i) => i.rol === r.value))

  return (
    <aside className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-panel p-5 lg:sticky lg:top-6">
      <h2 className="text-base font-semibold">Tu equipo</h2>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">Todavía no sumaste ningún plan. Elegí uno para empezar.</p>
      ) : (
        items.map((i) => (
          <div key={i.professionalId} className="flex flex-col gap-1 rounded-lg border border-surface-border bg-surface-card p-3.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{roleArea(i.rol)}</span>
            <Link to={`/p/${i.slug}`} className="text-sm font-semibold hover:underline">
              {i.nombre}
            </Link>
            <div className="flex justify-between gap-3 text-sm text-ink-secondary">
              <span className="min-w-0 truncate">{i.titulo}</span>
              <span className="tabular-nums">{formatPrice(i.precio)}</span>
            </div>
          </div>
        ))
      )}
      {missing.slice(0, 2).map((r) => (
        <Link
          key={r.value}
          to={`/profesionales?rol=${r.value}`}
          className="flex min-h-11 flex-col justify-center gap-0.5 rounded-lg border border-dashed border-surface-inputBorder bg-surface-card px-3.5 py-2.5 transition-colors hover:bg-surface-elevated"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{r.area}</span>
          <span className="text-sm font-semibold text-brand-hover">+ Sumar {r.label.toLowerCase()}</span>
        </Link>
      ))}
      {items.length > 0 ? (
        <>
          <div className="flex items-baseline justify-between gap-3 border-t border-surface-border pt-3.5">
            <span className="text-sm text-ink-secondary">Total</span>
            <span className="text-2xl font-bold tabular-nums">{formatPrice(teamTotal(items))}</span>
          </div>
          <Button asChild size="lg" className="w-full">
            <Link to="/equipo">Continuar con mi equipo</Link>
          </Button>
        </>
      ) : null}
    </aside>
  )
}

export function MarketplaceProfessionalPage() {
  const { slug } = useParams()
  const { data, isPending, isError, refetch } = usePublicProfessional(slug)
  const professional = data?.professional

  useEffect(() => {
    document.title = professional ? `${professional.nombre} · Haciéndolo Hábito` : 'Haciéndolo Hábito'
  }, [professional])

  const wa = professional
    ? whatsappLink(professional.whatsapp, `Hola ${professional.nombre.split(' ')[0]}, vi tu perfil en Haciéndolo Hábito y quería consultarte.`)
    : null

  return (
    <PublicShell>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-5 lg:px-6">
        <Link to="/profesionales" className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-ink-secondary hover:text-ink-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a profesionales
        </Link>

        {isPending ? (
          <div className="h-72 animate-pulse rounded-xl bg-surface-elevated/60" aria-label="Cargando" />
        ) : isError ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-surface-border p-6">
            <p className="text-sm text-ink-secondary">No pudimos cargar este perfil. Revisá tu conexión y probá de nuevo.</p>
            <Button variant="secondary" size="lg" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        ) : !professional ? (
          <div className="rounded-xl border border-dashed border-surface-inputBorder p-8 text-center">
            <h1 className="text-lg font-semibold">Este perfil no está disponible</h1>
            <p className="mt-1 text-sm text-ink-muted">Puede que el link esté mal escrito o que el profesional ya no esté publicado.</p>
            <Button asChild size="lg" className="mt-4">
              <Link to="/profesionales">Ver todos los profesionales</Link>
            </Button>
          </div>
        ) : (
          <>
            <section className="flex flex-wrap items-start gap-5">
              <ProfessionalPhoto nombre={professional.nombre} fotoUrl={professional.foto_url} className="h-28 w-28 text-3xl sm:h-36 sm:w-36" />
              <div className="flex min-w-0 flex-1 basis-80 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-3xl font-bold leading-tight tracking-tight">{professional.nombre}</h1>
                  {professional.verificado ? <VerifiedMark withLabel /> : null}
                </div>
                <p className="text-base text-ink-secondary">
                  {[roleLabel(professional.rol), modalityLabel(professional.modalidad), professional.ubicacion].filter(Boolean).join(' · ')}
                </p>
                {professional.deportes.length || professional.especialidades.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {professional.deportes.map((d) => (
                      <span key={d} className="rounded-md hh-pastel bg-pastel-peach px-2.5 py-1 text-body-sm font-semibold text-pastel-peach-ink">
                        {sportLabel(d)}
                      </span>
                    ))}
                    {professional.especialidades.map((e) => (
                      <span key={e} className="rounded-md bg-surface-elevated px-2.5 py-1 text-body-sm font-medium text-ink-secondary">
                        {e}
                      </span>
                    ))}
                  </div>
                ) : null}
                {professional.bio ? (
                  <p className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-ink-secondary">{professional.bio}</p>
                ) : null}
              </div>
              {wa ? (
                <Button asChild variant="secondary" size="lg" icon={<WhatsAppIcon className="h-4 w-4" />}>
                  <a href={wa} target="_blank" rel="noopener noreferrer">
                    Consultar por WhatsApp
                  </a>
                </Button>
              ) : null}
            </section>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <section className="flex flex-col gap-3.5">
                <h2 className="text-xl font-semibold">Planes de {professional.nombre.split(' ')[0]}</h2>
                {data!.plans.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-surface-inputBorder p-6 text-sm text-ink-muted">
                    Por ahora no tiene planes publicados.
                  </p>
                ) : (
                  data!.plans.map((plan) => <PlanCard key={plan.id} plan={plan} professional={professional} />)
                )}
                <p className="text-body-sm text-ink-muted">Los precios los carga y actualiza cada profesional.</p>
              </section>
              <TeamAside />
            </div>
          </>
        )}
      </main>
    </PublicShell>
  )
}
