import { Svg, Path, Circle } from '@react-pdf/renderer'

type IconProps = { size?: number; color?: string }

type InstagramIconProps = IconProps & { bgColor?: string }

/** Logo WhatsApp (silueta oficial). Renderiza en blanco para usar sobre badge color marca. */
export function WhatsAppIcon({ size = 10, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"
        fill={color}
      />
    </Svg>
  )
}

/** Sobre estilo Gmail (M central). Ícono blanco para badge color marca. */
export function GmailIcon({ size = 10, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457"
        fill={color}
      />
    </Svg>
  )
}

/**
 * Cámara estilo Instagram con silueta filled.
 * Cuerpo blanco con lente (cutout circular del color de fondo) y flash arriba a la derecha.
 */
export function InstagramIcon({ size = 10, color = '#FFFFFF', bgColor = '#E1306C' }: InstagramIconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M7 2.5h10a4.5 4.5 0 0 1 4.5 4.5v10a4.5 4.5 0 0 1-4.5 4.5H7A4.5 4.5 0 0 1 2.5 17V7A4.5 4.5 0 0 1 7 2.5z"
        fill={color}
      />
      <Circle cx="12" cy="12" r="3.6" fill={bgColor} />
      <Circle cx="12" cy="12" r="3.6" fill="none" stroke={color} strokeWidth={1.4} />
      <Circle cx="17.2" cy="6.8" r="1.15" fill={bgColor} />
    </Svg>
  )
}
