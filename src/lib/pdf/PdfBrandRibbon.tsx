import type { ReactNode } from 'react'
import { Image, StyleSheet, Text, View } from '@react-pdf/renderer'
import { PDF_BRAND } from '@/lib/pdf/pdfBrandTheme'

const ribbon = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: PDF_BRAND.primary,
  },
  accent: {
    width: 3,
    height: 36,
    backgroundColor: PDF_BRAND.primary,
    borderRadius: 2,
    marginRight: 10,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
    objectFit: 'contain',
  },
  logoFallback: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: PDF_BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoFallbackDark: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: PDF_BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  logoDark: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginRight: 14,
    objectFit: 'contain',
  },
  logoMonogram: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.white,
  },
  logoMonogramDark: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.white,
    letterSpacing: 0.4,
  },
  textCol: { flex: 1 },
  kicker: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.dark,
  },
  subtitle: {
    fontSize: 8.5,
    color: PDF_BRAND.body,
    marginTop: 2,
    lineHeight: 1.4,
  },
  /** Cabecera oscura compacta (plan alimentación landscape). Tono slate-700 con bajo contraste. */
  rowDark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: PDF_BRAND.primary,
  },
  titleOnDark: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.white,
    letterSpacing: 0.3,
  },
  subtitleOnDark: {
    fontSize: 8.4,
    color: '#CBD5E1',
    marginTop: 1.5,
  },
  kickerOnDark: {
    fontSize: 6.8,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
})

export type PdfBrandRibbonProps = {
  title: string
  subtitle?: string
  kicker?: string
  brandLogoSrc?: string | null
  variant?: 'light' | 'dark'
  rightSlot?: ReactNode
}

export function PdfBrandRibbon({
  title,
  subtitle,
  kicker = 'Haciéndolo Hábito · Ferster Fitness',
  brandLogoSrc,
  variant = 'light',
  rightSlot,
}: PdfBrandRibbonProps) {
  const logo = brandLogoSrc ? (
    <Image src={brandLogoSrc} style={ribbon.logo} />
  ) : (
    <View style={ribbon.logoFallback}>
      <Text style={ribbon.logoMonogram}>HH</Text>
    </View>
  )

  const logoDark = brandLogoSrc ? (
    <Image src={brandLogoSrc} style={ribbon.logoDark} />
  ) : (
    <View style={ribbon.logoFallbackDark}>
      <Text style={ribbon.logoMonogramDark}>HH</Text>
    </View>
  )

  if (variant === 'dark') {
    return (
      <View style={ribbon.rowDark}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          {logoDark}
          <View>
            <Text style={ribbon.kickerOnDark}>{kicker}</Text>
            <Text style={ribbon.titleOnDark}>{title}</Text>
            {subtitle ? <Text style={ribbon.subtitleOnDark}>{subtitle}</Text> : null}
          </View>
        </View>
        {rightSlot ? <View>{rightSlot}</View> : null}
      </View>
    )
  }

  return (
    <View style={ribbon.row}>
      <View style={ribbon.accent} />
      {logo}
      <View style={ribbon.textCol}>
        <Text style={ribbon.kicker}>{kicker}</Text>
        <Text style={ribbon.title}>{title}</Text>
        {subtitle ? <Text style={ribbon.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  )
}
