import { describe, expect, it } from 'vitest'
import { isDeleteTitle, undoMessage } from './undoableDelete'

describe('undoableDelete', () => {
  it('reconoce los diálogos de borrado', () => {
    expect(isDeleteTitle('¿Eliminar la rutina «Fuerza»?')).toBe(true)
    expect(isDeleteTitle('¿Borrar 3 bloques del calendario?')).toBe(true)
    expect(isDeleteTitle('¿Quitar este recordatorio?')).toBe(true)
    expect(isDeleteTitle('¿Aplicar la plantilla semanal?')).toBe(false)
    expect(isDeleteTitle('¿Restaurar rutina?')).toBe(false)
  })

  it('arma el aviso en pasado', () => {
    expect(undoMessage('¿Eliminar la rutina «Fuerza»?')).toBe('Se eliminó la rutina «Fuerza»')
    expect(undoMessage('¿Borrar 3 bloques del calendario?')).toBe('Se borraron 3 bloques del calendario')
    expect(undoMessage('¿Quitar este recordatorio?')).toBe('Se quitó este recordatorio')
    expect(undoMessage('¿Eliminar?')).toBe('Se eliminó')
  })
})
