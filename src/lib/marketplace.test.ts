import { describe, expect, it } from 'vitest'
import { defaultMarketplaceRole, formatPrice, marketplaceSlug, modalityLabel, whatsappDigits, whatsappLink } from './marketplace'

describe('marketplaceSlug', () => {
  it('saca acentos, espacios y símbolos', () => {
    expect(marketplaceSlug('Tomás Ferster')).toBe('tomas-ferster')
    expect(marketplaceSlug('  Lucía  Méndez (nutri) ')).toBe('lucia-mendez-nutri')
  })
  it('respeta el máximo de 60 caracteres', () => {
    expect(marketplaceSlug('a'.repeat(90))).toHaveLength(60)
  })
})

describe('whatsapp', () => {
  it('deja solo los dígitos', () => {
    expect(whatsappDigits('+54 11 5905-9170')).toBe('541159059170')
  })
  it('sin número suficiente no arma link', () => {
    expect(whatsappDigits('123')).toBeNull()
    expect(whatsappLink('')).toBeNull()
  })
  it('arma el link con el mensaje codificado', () => {
    expect(whatsappLink('11 5905 9170', 'Hola, ¿cómo va?')).toBe('https://wa.me/1159059170?text=Hola%2C%20%C2%BFc%C3%B3mo%20va%3F')
  })
})

describe('textos', () => {
  it('precio en pesos sin decimales', () => {
    expect(formatPrice(50000)).toBe('$50.000')
  })
  it('modalidad', () => {
    expect(modalityLabel(['online', 'presencial'])).toBe('Online y presencial')
    expect(modalityLabel(['presencial'])).toBe('Presencial')
    expect(modalityLabel([])).toBe('')
  })
  it('rol sugerido según la cuenta', () => {
    expect(defaultMarketplaceRole('nutritionist')).toBe('nutricionista')
    expect(defaultMarketplaceRole('psychologist')).toBe('psicologo')
    expect(defaultMarketplaceRole('admin')).toBe('entrenador')
  })
})
