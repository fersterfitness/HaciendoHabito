// Aplica el tema guardado antes de pintar (evita el destello oscuro en modo claro).
// Archivo aparte porque la CSP no permite scripts inline.
;(function () {
  var t = null
  try {
    t = localStorage.getItem('hh-theme')
  } catch (e) {}
  if (t !== 'dark' && t !== 'light') {
    t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  document.documentElement.classList.remove('dark', 'light')
  document.documentElement.classList.add(t)
})()
