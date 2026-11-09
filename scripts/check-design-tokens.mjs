#!/usr/bin/env node
/* global process, console, URL */
/**
 * Control de consistencia visual: cuenta en src/**\/*.tsx los valores que esquivan el sistema de
 * diseño (tamaños de letra a medida, colores hex o de la paleta cruda, botones a mano, foco anulado)
 * y falla si alguno crece respecto de scripts/design-tokens-baseline.json. No exige bajarlos de golpe:
 * cuando una limpieza los reduce, `node scripts/check-design-tokens.mjs --update` fija el nuevo piso.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const BASELINE = join(ROOT, 'scripts', 'design-tokens-baseline.json')

const RULES = {
  'text-px': { re: /\btext-\[\d+(?:\.\d+)?px\]/g, hint: 'tamaño de letra a medida: usar la escala (text-3xs … text-xl)' },
  'hex-class': { re: /\[#[0-9a-fA-F]{3,8}\]/g, hint: 'color hex en una clase: usar un token (status-ok, status-warn…)' },
  'raw-palette': {
    re: /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide)-(?:zinc|emerald|amber|rose|red|green|sky|violet|slate|gray|neutral|stone|blue|orange|yellow|purple|indigo|teal|lime|cyan|pink|fuchsia)-\d{2,3}\b/g,
    hint: 'color de la paleta de Tailwind: usar un token de la app',
  },
  'raw-button': { re: /<button\b/g, hint: 'botón a mano: usar <Button> o <IconButton>' },
  // Mira las 3 líneas siguientes: las clases suelen venir partidas en varias líneas de cn(...).
  'outline-none-no-focus': {
    window: (lines, i) => /\boutline-none\b/.test(lines[i]) && !/focus(-visible|-within)?:|hh-focus|appFocusRing/.test(lines.slice(i, i + 4).join(' ')),
    hint: 'outline-none sin foco de reemplazo',
  },
  'transition-all': { re: /\btransition-all\b/g, hint: 'transition-all: nombrar las propiedades' },
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.tsx') && !name.startsWith('__tmp')) out.push(p)
  }
  return out
}

function count() {
  const totals = Object.fromEntries(Object.keys(RULES).map((k) => [k, 0]))
  const byFile = {}
  for (const file of walk(SRC)) {
    const text = readFileSync(file, 'utf8')
    const rel = relative(ROOT, file).replaceAll('\\', '/')
    for (const [id, rule] of Object.entries(RULES)) {
      const lines = text.split('\n')
      const n = rule.re ? (text.match(rule.re) ?? []).length : lines.filter((_, i) => rule.window(lines, i)).length
      if (!n) continue
      totals[id] += n
      ;(byFile[id] ??= []).push([rel, n])
    }
  }
  return { totals, byFile }
}

const { totals, byFile } = count()

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, JSON.stringify(totals, null, 2) + '\n')
  console.log('Piso actualizado:', totals)
  process.exit(0)
}

let baseline = {}
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
} catch {
  console.error('Falta scripts/design-tokens-baseline.json: correr con --update.')
  process.exit(1)
}

let failed = false
for (const [id, n] of Object.entries(totals)) {
  const base = baseline[id] ?? 0
  const mark = n > base ? 'SUBIÓ' : n < base ? 'bajó' : 'igual'
  console.log(`${id.padEnd(22)} ${String(n).padStart(5)}  (piso ${base}, ${mark})`)
  if (n > base) {
    failed = true
    const top = (byFile[id] ?? []).sort((a, b) => b[1] - a[1]).slice(0, 5)
    console.log(`  ${RULES[id].hint}. Archivos con más casos:`)
    for (const [f, c] of top) console.log(`    ${f}: ${c}`)
  }
}
if (failed) {
  console.error('\nHay valores nuevos fuera del sistema de diseño. Usá los tokens o, si bajaste otros, --update.')
  process.exit(1)
}
if (Object.entries(totals).some(([id, n]) => n < (baseline[id] ?? 0))) console.log('\nBajaron casos: correr con --update para fijar el nuevo piso.')
