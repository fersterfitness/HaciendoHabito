import { CardTitle } from '@/components/ui/Card'

const LINES: { html: string }[] = [
  { html: '<strong>Lácteos:</strong> 1 vaso leche (200 ml) ≈ 2 yogures (125 g c/u) ≈ 40 g queso duro.' },
  { html: '<strong>Cereales:</strong> 1 rebanada pan (30–40 g) ≈ ½ taza arroz cocido ≈ ½ taza fideos cocidos ≈ 3–4 galletas tipo agua.' },
  { html: '<strong>Proteínas magras:</strong> 100 g pollo/pescado en crudo ≈ 2 huevos ≈ ½ lata atún drenado ≈ 150 g legumbres cocidas.' },
  { html: '<strong>Verduras libres:</strong> hojas verdes, tomate, pepino, berenjena, zapallitos — priorizar en volumen.' },
  { html: '<strong>Grasas:</strong> 1 cdita aceite (5 ml) ≈ 5–6 nueces/almendras ≈ 1 cdita manteca de maní.' },
]

export function NutritionExchangeReferenceCard() {
  return (
    <div className="space-y-3">
      <CardTitle className="mb-1">Equivalencias e intercambios (referencia)</CardTitle>
      <p className="text-xs text-ink-muted leading-relaxed">
        Guía rápida para armar planes; validar con la guía de alimentos del panel y el contexto del paciente.
      </p>
      <ul className="list-disc list-inside space-y-1.5 text-xs text-ink-secondary leading-relaxed marker:text-ink-muted">
        {LINES.map((line) => (
          <li key={line.html} dangerouslySetInnerHTML={{ __html: line.html }} />
        ))}
      </ul>
    </div>
  )
}
