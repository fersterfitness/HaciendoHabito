import { cn } from '@/lib/utils'
import { IntakeProAvatar } from '@/components/public/intake/IntakeProAvatar'

export type IntakeTeamHeroMember = {
  id: string
  role: 'trainer' | 'nutritionist' | 'psychologist'
  roleLabel: string
  name: string
  avatarUrl?: string | null
}

type IntakeTeamHeroStripProps = {
  theme?: 'light' | 'dark'
  members: IntakeTeamHeroMember[]
  compact?: boolean
}

export function IntakeTeamHeroStrip({ theme = 'dark', members }: IntakeTeamHeroStripProps) {
  const isDark = theme === 'dark'
  const roleClass = isDark ? 'text-white/45' : 'text-ink-muted'
  const nameClass = isDark ? 'text-white' : 'text-ink-primary'

  if (members.length === 0) return null

  return (
    <section aria-label="Nuestro equipo" className="mb-0">
      <p
        className={cn(
          'mb-3 text-center text-[11px] font-bold uppercase tracking-[0.18em]',
          isDark ? 'text-white/70' : 'text-ink-secondary',
        )}
      >
        Nuestro equipo
      </p>

      <div
        className={cn(
          'mx-auto grid w-full max-w-[22rem] justify-items-center gap-3 sm:gap-4',
          members.length === 1 && 'grid-cols-1',
          members.length === 2 && 'grid-cols-2',
          members.length >= 3 && 'grid-cols-3',
        )}
      >
        {members.map((member, index) => {
          const displayName = member.name.trim()
          return (
            <div key={member.id} className="flex w-full flex-col items-center text-center">
              {/* Foto flotante: solo imagen con rounded-2xl y sombra, sin borde */}
              <div
                className={cn(
                  'w-full overflow-hidden rounded-2xl aspect-[3/4]',
                  isDark
                    ? 'shadow-[0_4px_24px_rgba(0,0,0,0.45)]'
                    : 'shadow-[0_4px_16px_rgba(0,0,0,0.12)]',
                )}
              >
                <IntakeProAvatar
                  theme={theme}
                  label={displayName || member.roleLabel}
                  url={member.avatarUrl}
                  sizeClass="h-full w-full"
                  shape="rounded"
                  focus="standard"
                  imageFit="contain"
                  useOriginalImage
                  noRing
                  priority={index === 0}
                  expandable
                />
              </div>
              <p className={cn('mt-1.5 text-[9px] font-semibold uppercase tracking-[0.1em]', roleClass)}>
                {member.roleLabel}
              </p>
              {displayName ? (
                <p className={cn('mt-0.5 w-full truncate text-[11px] font-semibold leading-snug', nameClass)}>
                  {displayName}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
