import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, MapPin, Plus, Video } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { PublicShell, ProfessionalPhoto, RoleIcon, RoleTile, TeamBar, VerifiedMark } from '@/components/marketplace/PublicShell'
import { usePublicProfessional } from '@/data/marketplace'
import { usePublicCases } from '@/data/marketplaceCases'
import { PublicCases } from '@/components/marketplace/PublicCases'
import {
  MARKETPLACE_ROLES,
  ROLE_TONE,
  durationLabel,
  durationPer,
  formatPrice,
  modalityLabel,
  roleLabel,
  sportLabel,
  whatsappLink,
  type MarketplacePlan,
  type MarketplaceProfessional,
} from '@/lib/marketplace'
import { cn } from '@/lib/utils'
import { teamTotal, useMarketplaceTeam } from '@/stores/marketplaceTeam'

const chipClass = 'rounded-md bg-surface-elevated px-2 py-1 text-xs font-medium text-ink-secondary'

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
        'flex flex-col gap-4 rounded-2xl border bg-surface-card p-5',
        selected ? 'border-ink-primary' : 'border-surface-border',
        soldOut && !selected && 'opacity-70',
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={chipClass}>{durationLabel(plan.duracion)}</span>
          {plan.modalidad ? <span className={chipClass}>{plan.modalidad === 'online' ? 'Online' : 'Presencial'}</span> : null}
          {selected ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-status-ok/15 px-2 py-1 text-xs font-semibold text-status-ok-ink">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              En tu equipo
            </span>
          ) : soldOut ? (
            <span className={chipClass}>Sin cupos</span>
          ) : plan.cupos != null ? (
            <span className="hh-pastel rounded-md bg-pastel-butter px-2 py-1 text-xs font-semibold text-pastel-butter-ink">
              {plan.cupos === 1 ? 'Queda 1 cupo' : `Quedan ${plan.cupos} cupos`}
            </span>
          ) : null}
        </div>
        <h3 className="text-lg font-semibold tracking-tight">{plan.titulo}</h3>
        <p className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tabular-nums tracking-tight">{formatPrice(plan.precio)}</span>
          <span className="text-sm text-ink-muted">{durationPer(plan.duracion)}</span>
        </p>
      </div>
      {plan.descripcion ? <p className="text-sm text-ink-secondary">{plan.descripcion}</p> : null}
      {plan.incluye.length ? (
        <ul className="flex flex-col gap-2 border-t border-surface-border pt-4 text-sm text-ink-secondary">
          {plan.incluye.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-ok-ink" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-auto pt-1">
        {selected ? (
          <Button variant="secondary" size="lg" className="w-full" onClick={() => remove(professional.id)}>
            Quitar de mi equipo
          </Button>
        ) : (
          <Button size="lg" className="w-full" disabled={soldOut} onClick={choose}>
            {soldOut ? 'Sin cupos por ahora' : current ? 'Cambiar por este plan' : 'Sumar a mi equipo'}
          </Button>
        )}
      </div>
    </article>
  )
}

/** Un casillero por área: el plan elegido o el acceso para ir a buscar a ese profesional. */
function TeamAside() {
  const items = useMarketplaceTeam((s) => s.items)

  return (
    <aside className="flex flex-col gap-2.5 rounded-2xl bg-surface-panel p-4 lg:sticky lg:top-20">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-base font-semibold tracking-tight">Tu equipo</h2>
        <span className="text-body-sm text-ink-muted">
          {items.length} de {MARKETPLACE_ROLES.length}
        </span>
      </div>
      {MARKETPLACE_ROLES.map((r) => {
        const item = items.find((i) => i.rol === r.value)
        if (!item) {
          return (
            <Link
              key={r.value}
              to={`/profesionales?rol=${r.value}`}
              className="flex min-h-14 items-center gap-3 rounded-xl border border-dashed border-surface-inputBorder px-3 py-2 text-ink-secondary transition-colors hover:bg-surface-card hover:text-ink-primary"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
                <RoleIcon rol={r.value} className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm font-medium">Sumar {r.label.toLowerCase()}</span>
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Link>
          )
        }
        return (
          <Link
            key={r.value}
            to={`/p/${item.slug}`}
            className="flex min-h-14 items-center gap-3 rounded-xl bg-surface-card px-3 py-2 transition-colors hover:bg-surface-elevated"
          >
            <RoleTile rol={r.value} className="h-9 w-9 rounded-lg" iconClassName="h-4 w-4" />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">{item.nombre}</span>
              <span className="truncate text-xs text-ink-muted">{item.titulo}</span>
            </span>
            <span className="text-sm font-medium tabular-nums">{formatPrice(item.precio)}</span>
          </Link>
        )
      })}
      {items.length > 0 ? (
        <>
          <div className="flex items-baseline justify-between gap-3 px-1 pt-2">
            <span className="text-sm text-ink-secondary">Total</span>
            <span className="text-2xl font-semibold tabular-nums tracking-tight">{formatPrice(teamTotal(items))}</span>
          </div>
          <Button asChild size="lg" className="w-full" icon={<ArrowRight className="h-4 w-4" />} iconPosition="right">
            <Link to="/equipo">Continuar con mi equipo</Link>
          </Button>
        </>
      ) : (
        <p className="px-1 pt-1 text-body-sm text-ink-muted">Elegí un plan para empezar a armarlo.</p>
      )}
    </aside>
  )
}

export function MarketplaceProfessionalPage() {
  const { slug } = useParams()
  const { data, isPending, isError, refetch } = usePublicProfessional(slug)
  const professional = data?.professional
  const cases = usePublicCases(professional?.id).data ?? []
  const plans = data?.plans ?? []

  useEffect(() => {
    document.title = professional ? `${professional.nombre} · Haciéndolo Hábito` : 'Haciéndolo Hábito'
  }, [professional])

  const firstName = professional?.nombre.split(' ')[0] ?? ''
  const wa = professional
    ? whatsappLink(professional.whatsapp, `Hola ${firstName}, vi tu perfil en Haciéndolo Hábito y quería consultarte.`)
    : null
  const mode = professional ? modalityLabel(professional.modalidad) : ''
  const cheapest = plans.length ? Math.min(...plans.map((p) => p.precio)) : null

  return (
    <PublicShell>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-4 lg:px-6 lg:py-6">
        <Link to="/profesionales" className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-ink-secondary hover:text-ink-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Profesionales
        </Link>

        {isPending ? (
          <div className="h-80 animate-pulse rounded-2xl bg-surface-elevated/60" aria-label="Cargando" />
        ) : isError ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl bg-surface-panel p-6">
            <p className="text-sm text-ink-secondary">No pudimos cargar este perfil. Revisá tu conexión y probá de nuevo.</p>
            <Button variant="secondary" size="lg" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        ) : !professional ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-surface-inputBorder px-6 py-14 text-center">
            <h1 className="text-xl font-semibold tracking-tight">Este perfil no está disponible</h1>
            <p className="text-sm text-ink-muted">Puede que el link esté mal escrito o que el profesional ya no esté publicado.</p>
            <Button asChild size="lg" className="mt-3">
              <Link to="/profesionales">Ver todos los profesionales</Link>
            </Button>
          </div>
        ) : (
          <>
            <section className="grid gap-5 rounded-2xl bg-surface-panel p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-7 sm:p-6">
              <ProfessionalPhoto
                nombre={professional.nombre}
                fotoUrl={professional.foto_url}
                rol={professional.rol}
                className="aspect-square w-full rounded-2xl text-6xl sm:w-56 lg:w-64"
              />
              <div className="flex min-w-0 flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('hh-pastel inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold', ROLE_TONE[professional.rol])}>
                    <RoleIcon rol={professional.rol} className="h-3.5 w-3.5" />
                    {roleLabel(professional.rol)}
                  </span>
                  {professional.verificado ? <VerifiedMark withLabel /> : null}
                </div>
                <h1 className="text-4xl font-semibold leading-none tracking-tight lg:text-5xl">{professional.nombre}</h1>
                {mode || professional.ubicacion ? (
                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-secondary">
                    {professional.ubicacion ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                        {professional.ubicacion}
                      </span>
                    ) : null}
                    {mode ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Video className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                        {mode}
                      </span>
                    ) : null}
                  </p>
                ) : null}
                {professional.bio ? (
                  <p className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-ink-secondary">{professional.bio}</p>
                ) : null}
                {professional.deportes.length || professional.especialidades.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {[...professional.especialidades, ...professional.deportes.map(sportLabel)].map((t) => (
                      <span key={t} className="rounded-md bg-surface-card px-2.5 py-1 text-body-sm font-medium text-ink-secondary">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-2">
                  {wa ? (
                    <Button asChild variant="secondary" size="lg" icon={<WhatsAppIcon className="h-4 w-4" />}>
                      <a href={wa} target="_blank" rel="noopener noreferrer">
                        Consultar por WhatsApp
                      </a>
                    </Button>
                  ) : null}
                  {cheapest != null ? (
                    <p className="text-sm text-ink-muted">
                      Planes desde <span className="font-semibold tabular-nums text-ink-primary">{formatPrice(cheapest)}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <section className="flex flex-col gap-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight">Planes de {firstName}</h2>
                  {plans.length > 1 ? <span className="text-sm text-ink-muted">Elegí uno</span> : null}
                </div>
                {plans.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-surface-inputBorder p-6 text-sm text-ink-muted">
                    Por ahora no tiene planes publicados.{wa ? ' Podés consultarle por WhatsApp.' : ''}
                  </p>
                ) : (
                  <div className={cn('grid gap-4', plans.length > 1 && 'sm:grid-cols-2')}>
                    {plans.map((plan) => (
                      <PlanCard key={plan.id} plan={plan} professional={professional} />
                    ))}
                  </div>
                )}
                <p className="text-body-sm text-ink-muted">Los precios los carga y actualiza cada profesional.</p>
              </section>
              <TeamAside />
            </div>
            <PublicCases cases={cases} firstName={firstName} />
          </>
        )}
      </main>
      <TeamBar className="lg:hidden" />
    </PublicShell>
  )
}
