import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/supabasePublic', () => ({ supabasePublic: {} }))
vi.mock('@/data/marketplaceForms', () => ({ fetchRequestForm: vi.fn(), submitRequestForm: vi.fn() }))

import { fetchRequestForm, submitRequestForm } from '@/data/marketplaceForms'
import { MarketplaceRequestFormPage } from './MarketplaceRequestFormPage'
import { keepsLegacyIntake } from '@/pages/public/legacyIntakeGate'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  vi.mocked(fetchRequestForm).mockResolvedValue({
    profesional_nombre: 'Lucía Méndez',
    profesional_rol: 'psicologo',
    profesional_foto: null,
    plan_titulo: 'Psicología deportiva',
    cliente_nombre: 'Juan Pérez',
    enviado_at: null,
    questions: [
      { id: 'edad', texto: 'Edad', tipo: 'corta', opciones: [], obligatoria: true },
      { id: 'dep', texto: '¿Competís?', tipo: 'si_no', opciones: [], obligatoria: false },
    ],
  })
  vi.mocked(submitRequestForm).mockResolvedValue()
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.clearAllMocks()
})

async function render() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/f/tok123']}>
          <Routes>
            <Route path="/f/:token" element={<MarketplaceRequestFormPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })
  // Hasta que la consulta resuelve (sale el título o el aviso).
  for (let i = 0; i < 20 && !host.querySelector('h1'); i++) await act(async () => new Promise((r) => setTimeout(r, 10)))
}

function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
}

describe('formulario del profesional para el cliente (feedback nov19, tanda 6)', () => {
  it('pide las obligatorias y el día de pago, y envía las respuestas', async () => {
    await render()
    expect(host.querySelector('h1')?.textContent).toBe('Formulario de Lucía Méndez')
    const form = host.querySelector('form')!
    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(submitRequestForm).not.toHaveBeenCalled()
    expect(host.textContent).toContain('Completá esta pregunta.')
    expect(host.textContent).toContain('Elegí qué día del mes vas a pagar.')

    await act(async () => setValue(host.querySelector('input:not([type])') as HTMLInputElement, '28'))
    await act(async () => (host.querySelector('input[type="radio"][value="Sí"]') as HTMLInputElement).click())
    await act(async () => setValue(host.querySelector('select')!, 'ultimo'))
    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(submitRequestForm).toHaveBeenCalledWith(
      'tok123',
      [
        { pregunta: 'Edad', respuesta: '28' },
        { pregunta: '¿Competís?', respuesta: 'Sí' },
      ],
      'ultimo',
    )
    expect(host.textContent).toContain('¡Listo, Juan!')
    expect(host.textContent).toContain('el último día del mes')
  })

  it('un link que no existe avisa en lugar de mostrar el formulario', async () => {
    vi.mocked(fetchRequestForm).mockResolvedValue(null)
    await render()
    expect(host.textContent).toContain('Este formulario no está disponible')
  })
})

describe('página vieja /form (feedback nov19, tanda 6)', () => {
  it('solo sigue para quien ya estaba inscribiéndose', () => {
    localStorage.clear()
    sessionStorage.clear()
    expect(keepsLegacyIntake('')).toBe(false)
    expect(keepsLegacyIntake('?continuar')).toBe(true)
    localStorage.setItem('hh_intake_access_token', 't')
    localStorage.setItem('hh_intake_access_plan', 'p')
    expect(keepsLegacyIntake('')).toBe(true)
    localStorage.clear()
  })
})
