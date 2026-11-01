import { Link } from 'react-router-dom'
import { Cake, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { copyWhatsAppMessage, normalizePhoneForWhatsApp, shareToWhatsApp, WHATSAPP_DIRECT_PASTE_HINT } from '@/lib/whatsapp'

export type DashboardBirthday = { id: string; full_name: string; phone: string | null; daysUntil: number }

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name

/** Saludo de cumpleaños en nombre de todo el equipo (pedido del entrenador). */
export function birthdayMessage(studentName: string): string {
  return `¡Feliz cumpleaños, ${firstName(studentName)}! 🎂🎉
De parte de todo Haciéndolo Hábito, te saludamos en tu día y te deseamos un año lleno de salud, energía y muchos logros, dentro y fuera del entrenamiento. ¡Que lo disfrutes muchísimo! 💪`
}

const whenLabel = (d: number) => (d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `En ${d} días`)

/** Inicio: cumpleaños de la semana con el saludo listo para copiar o mandar por WhatsApp. */
export function BirthdayGreetings({ birthdays, pathFor }: { birthdays: DashboardBirthday[]; pathFor: (id: string) => string }) {
  if (birthdays.length === 0) return null

  async function copy(b: DashboardBirthday) {
    const ok = await copyWhatsAppMessage(birthdayMessage(b.full_name))
    if (ok) toast.success('Saludo copiado')
    else toast.error('No se pudo copiar')
  }

  async function send(b: DashboardBirthday, digits: string) {
    const res = await shareToWhatsApp({ message: birthdayMessage(b.full_name), phoneDigits: digits })
    if (res.mode === 'clipboard') toast.success(WHATSAPP_DIRECT_PASTE_HINT, { duration: 6000 })
  }

  return (
    <div className="hh-alert rounded-xl">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <span className="hh-alert-icon h-7 w-7 shrink-0" aria-hidden>
          <Cake className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-semibold text-ink-primary">Cumpleaños</span>
        <span className="text-2xs text-ink-muted">saludo listo para mandar</span>
      </div>
      <ul className="space-y-1 border-t border-surface-border/70 px-2 py-2">
        {birthdays.map((b) => {
          const digits = normalizePhoneForWhatsApp(b.phone)
          return (
            <li key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-2xs hover:bg-surface-elevated/60">
              <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                <Link to={pathFor(b.id)} className="block truncate font-medium text-ink-primary hover:underline">
                  {b.full_name}
                </Link>
                <span className={b.daysUntil === 0 ? 'text-3xs font-semibold text-brand-primary' : 'text-3xs text-ink-muted'}>
                  {whenLabel(b.daysUntil)}
                </span>
              </div>
              {digits ? (
                <button type="button" onClick={() => void send(b, digits)} className="hh-row-btn" title="Abre WhatsApp con el saludo">
                  <WhatsAppIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  Saludar
                </button>
              ) : null}
              <button type="button" onClick={() => void copy(b)} className="hh-row-btn">
                <Copy className="h-3 w-3" aria-hidden />
                Copiar saludo
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
