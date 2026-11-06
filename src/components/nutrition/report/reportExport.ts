/**
 * Salidas de la lámina: archivo HTML autónomo (imágenes y fuente adentro) e imagen PNG.
 */

const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Geist:wght@400..800&display=swap'

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(blob)
  })
}

async function urlToDataUrl(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo leer ${url}`)
  return blobToDataUrl(await res.blob())
}

let fontCss: Promise<string> | null = null

/**
 * @font-face de Geist (solo el juego latino) con el archivo de la fuente embebido. Sirve para que la
 * imagen salga con la misma letra y para que el HTML se vea bien sin conexión. Si falla, queda vacío
 * y se usa la letra del sistema.
 */
export function embeddedFontCss(): Promise<string> {
  fontCss ??= (async () => {
    const css = await (await fetch(FONT_CSS_URL)).text()
    const blocks = css.split('/* ').filter((b) => b.startsWith('latin */'))
    const out: string[] = []
    for (const b of blocks) {
      const face = b.slice(b.indexOf('@font-face'))
      const url = face.match(/url\(([^)]+)\)/)?.[1]
      if (!url) continue
      out.push(face.replace(url, await urlToDataUrl(url)))
    }
    return out.join('\n')
  })().catch(() => {
    fontCss = null
    return ''
  })
  return fontCss
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

/** Página HTML completa con la lámina; en pantallas angostas se achica para entrar a lo ancho. */
export async function buildStandaloneHtml(sheet: HTMLElement, title: string, width: number): Promise<string> {
  const node = sheet.cloneNode(true) as HTMLElement
  for (const img of Array.from(node.querySelectorAll('img'))) {
    const src = img.getAttribute('src')
    if (src && !src.startsWith('data:')) img.setAttribute('src', await urlToDataUrl(new URL(src, window.location.href).href))
  }
  const font = await embeddedFontCss()
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${font}
html, body { margin: 0; background: #f0edf2; }
body { padding: 24px 16px; }
.hoja { width: ${width}px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(46, 33, 54, 0.06), 0 8px 24px rgba(46, 33, 54, 0.08); }
@media print { html, body { background: #fff; padding: 0; } .hoja { box-shadow: none; border-radius: 0; } }
</style>
</head>
<body>
<div class="hoja">${node.outerHTML}</div>
<script>
(function () {
  var hoja = document.querySelector('.hoja');
  function ajustar() { hoja.style.zoom = Math.min(1, (window.innerWidth - 32) / ${width}); }
  ajustar();
  window.addEventListener('resize', ajustar);
})();
</script>
</body>
</html>
`
}

export function downloadFile(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
}

export async function sheetToPng(sheet: HTMLElement): Promise<string> {
  const { toPng } = await import('html-to-image')
  return toPng(sheet, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true, fontEmbedCSS: await embeddedFontCss() })
}
