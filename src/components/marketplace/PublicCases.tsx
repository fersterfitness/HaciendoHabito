import { MessageSquareQuote, Play } from 'lucide-react'
import { videoSiteLabel, type MarketplaceCase } from '@/data/marketplaceCases'

/** Una tarjeta de caso de éxito: foto, video (se abre en su sitio) o mensaje. */
export function CaseCard({ c }: { c: MarketplaceCase }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
      {c.tipo === 'foto' && c.media_url ? (
        <img src={c.media_url} alt={c.titulo || 'Caso de éxito'} loading="lazy" className="aspect-[4/5] w-full bg-surface-elevated object-cover" />
      ) : null}
      {c.tipo === 'video' && c.media_url ? (
        <a
          href={c.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="hh-focus flex aspect-video w-full flex-col items-center justify-center gap-2 bg-surface-inverse text-surface-base"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-base/15" aria-hidden>
            <Play className="h-5 w-5" fill="currentColor" />
          </span>
          <span className="text-sm font-medium">Ver video en {videoSiteLabel(c.media_url)}</span>
        </a>
      ) : null}
      {c.titulo || c.texto ? (
        <div className="flex flex-1 flex-col gap-1.5 p-4">
          {c.tipo === 'mensaje' ? <MessageSquareQuote className="h-5 w-5 text-ink-muted" aria-hidden /> : null}
          {c.titulo ? <h3 className="text-sm font-semibold text-ink-primary">{c.titulo}</h3> : null}
          {c.texto ? <p className="whitespace-pre-line text-sm leading-relaxed text-ink-secondary">{c.tipo === 'mensaje' ? `«${c.texto}»` : c.texto}</p> : null}
        </div>
      ) : null}
    </article>
  )
}

/** Sección «Casos de éxito» del perfil público. Sin casos no se muestra. */
export function PublicCases({ cases, firstName }: { cases: MarketplaceCase[]; firstName: string }) {
  if (cases.length === 0) return null
  return (
    <section className="flex flex-col gap-4" aria-labelledby="casos-de-exito">
      <div>
        <h2 id="casos-de-exito" className="text-2xl font-semibold tracking-tight">
          Casos de éxito
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">Personas reales que trabajaron con {firstName}.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cases.map((c) => (
          <CaseCard key={c.id} c={c} />
        ))}
      </div>
    </section>
  )
}
