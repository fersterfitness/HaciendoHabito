import { useCountUp, type UseCountUpOptions } from '@/hooks/useCountUp'

/**
 * Número animado de 0 al valor. Va en su propio componente para que la animación (un render por
 * cuadro) re-renderice solo el número y no toda la pantalla con sus gráficos.
 */
export function CountUp({
  value,
  format = (n) => String(n),
  ...options
}: { value: number; format?: (n: number) => string } & UseCountUpOptions) {
  const animated = useCountUp(Math.round(value), options)
  return <>{format(animated)}</>
}
