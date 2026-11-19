import { MessageSquareQuote, Play } from 'lucide-react'
import { caseVideoEmbed, videoSiteLabel, type MarketplaceCase } from '@/data/marketplaceCases'
import { cn } from '@/lib/utils'

/**
 * Video del caso (feedback nov19, tanda 6): se reproduce ahí mismo (YouTube, Instagram, TikTok, Vimeo, Drive).
 * Si el link no se puede incrustar, un botón bien visible lo abre en su sitio.
 */
function CaseVideo({ url, title }: { url: string; title: string }) {
  const embed = caseVideoEmbed(url)
  if (embed)
    return (
      <iframe
        src={embed.src}
        title={title}
        loading="lazy"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className={cn('w-full border-0 bg-surface-inverse', embed.vertical ? 'aspect-[9/14]' : 'aspect-video')}
      />
    )
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="hh-focus group flex aspect-video w-full flex-col items-center justify-center gap-3 bg-surface-inverse p-4 text-center text-surface-base"
    >
      <span className="flex h-16 w-16 items-center justify-center hh-pastel hh-pastel-solid rounded-full bg-pastel-butter text-ink-primary shadow-lg transition-transform group-hover:scale-105" aria-hidden>
        <Play className="ml-1 h-7 w-7" fill="currentColor" />
      </span>
      <span className="text-base font-semibold">Tocá acá para ver el video del caso</span>
      <span className="text-xs opacity-70">Se abre en {videoSiteLabel(url)}</span>
    </a>
  )
}

/** Una tarjeta de caso de éxito: foto, video (se reproduce ahí) o mensaje. */
export function CaseCard({ c }: { c: MarketplaceCase }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
      {c.tipo === 'foto' && c.media_url ? (
        <img src={c.media_url} alt={c.titulo || 'Caso de éxito'} loading="lazy" className="aspect-[4/5] w-full bg-surface-elevated object-cover" />
      ) : null}
      {c.tipo === 'video' && c.media_url ? <CaseVideo url={c.media_url} title={c.titulo || 'Video del caso'} /> : null}
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
    <section id="casos" className="flex scroll-mt-20 flex-col gap-4" aria-labelledby="casos-de-exito">
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
