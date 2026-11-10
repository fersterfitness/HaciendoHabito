import { describe, expect, it, vi } from 'vitest'
import type { KeyboardEvent } from 'react'
import { onTabListKeyDown, tabIndexFor } from './tabKeyboard'

function setup() {
  document.body.innerHTML = `<div role="tablist">
    <button role="tab">A</button><button role="tab" disabled>B</button><button role="tab">C</button><button role="tab">D</button>
  </div>`
  const list = document.querySelector<HTMLElement>('[role=tablist]')!
  const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role=tab]'))
  const clicks: string[] = []
  tabs.forEach((t) => t.addEventListener('click', () => clicks.push(t.textContent!)))
  const press = (key: string) => {
    const preventDefault = vi.fn()
    onTabListKeyDown({ key, currentTarget: list, preventDefault } as unknown as KeyboardEvent<HTMLElement>)
    return preventDefault
  }
  return { tabs, clicks, press }
}

describe('onTabListKeyDown', () => {
  it('→ salta las deshabilitadas, activa y da la vuelta', () => {
    const { tabs, clicks, press } = setup()
    tabs[0].focus()
    press('ArrowRight')
    expect(document.activeElement).toBe(tabs[2])
    press('ArrowRight')
    press('ArrowRight')
    expect(document.activeElement).toBe(tabs[0])
    expect(clicks).toEqual(['C', 'D', 'A'])
  })

  it('← desde la primera va a la última; Inicio y Fin', () => {
    const { tabs, press } = setup()
    tabs[0].focus()
    press('ArrowLeft')
    expect(document.activeElement).toBe(tabs[3])
    press('Home')
    expect(document.activeElement).toBe(tabs[0])
    press('End')
    expect(document.activeElement).toBe(tabs[3])
  })

  it('ignora otras teclas y el foco fuera de la lista', () => {
    const { clicks, press } = setup()
    expect(press('Enter')).not.toHaveBeenCalled()
    expect(press('ArrowRight')).not.toHaveBeenCalled()
    expect(clicks).toEqual([])
  })
})

describe('tabIndexFor', () => {
  it('solo la elegida, o la primera si no hay ninguna', () => {
    expect(tabIndexFor(true, 2)).toBe(0)
    expect(tabIndexFor(false, 0)).toBe(-1)
    expect(tabIndexFor(false, 0, false)).toBe(0)
    expect(tabIndexFor(false, 1, false)).toBe(-1)
  })
})
