import { describe, expect, it } from 'vitest'
import { movementArt, movementArtwork, routineAthlete } from './exerciseArtwork'

describe('routine athlete artwork', () => {
  it('uses the recorded gender and leaves missing or other values neutral', () => {
    expect(routineAthlete('M')).toBe('male')
    expect(routineAthlete('F')).toBe('female')
    for (const value of [null, undefined, '', 'otro', 'Agustín']) expect(routineAthlete(value)).toBeNull()
  })
  it.each([
    ['Push-ups reactivos', 'pushup'], ['Plancha lateral (actv. glúteo medio)', 'side-plank'],
    ['Press banca', 'bench-press'], ['Flexion a steps reactivas', 'step-pushup'],
    ['Press split dinámico', 'split-press'], ['Plancha abro y cierro', 'plank'],
    ['Flexiones cerradas reactivas', 'close-pushup'], ['Saltos a un pie desde posición de bulgaras', 'bulgarian'],
    ['Rotaciones landmine', 'landmine-rotation'], ['Sentadilla con barra', 'squat'],
    ['Saltos pliométricos combinados 1', 'jump'], ['Sentadilla+gemelos landmine', 'landmine-squat'],
    ['Saltos al cajon', 'box-jump'], ['Ruedita abdominal', 'ab-wheel'],
    ['Autralianas reactivas', 'inverted-row'], ['Pall off+rotación', 'pallof'],
    ['Peso muerto', 'deadlift'], ['Remo rtx explosivo', 'trx-row'],
    ['Peso muerto con hexagonal', 'trap-deadlift'], ['Thruster', 'thruster'], ['Remo en plancha', 'renegade-row'],
  ])('matches %s to its movement rather than its broad muscle group', (name, expected) => {
    expect(movementArt(name)).toBe(expected)
  })
  it('selects the same movement cell in the correct male or female sheet', () => {
    expect(movementArtwork('Press banca', 'male')).toEqual({ movement: 'bench-press', url: '/routine/male-1.webp', position: '100% 0%' })
    expect(movementArtwork('Peso muerto', 'female')).toEqual({ movement: 'deadlift', url: '/routine/female-3.webp', position: '100% 0%' })
    expect(movementArtwork('Ejercicio sin identificar', 'male')).toBeNull()
    expect(movementArtwork('Press banca', null)).toBeNull()
  })
})
