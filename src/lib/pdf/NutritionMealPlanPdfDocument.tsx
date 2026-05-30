import {
  Defs,
  Document,
  Image,
  LinearGradient,
  Page,
  Rect,
  Stop,
  Svg,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import type { WeeklyPlanGridJson } from '@/lib/nutrition/weeklyPlanGrid'
import { columnLabels } from '@/lib/nutrition/weeklyPlanGrid'
import { parseInlineMarkdown } from '@/lib/nutrition/inlineMarkdown'
import { PDF_BRAND } from '@/lib/pdf/pdfBrandTheme'
import { InstagramIcon, WhatsAppIcon } from '@/lib/pdf/pdfBrandIcons'
import type { SocialIconUrls } from '@/lib/pdf/defaultBrandLogoSrc'

type ProfessionalContact = {
  phone?: string
  email?: string
  instagram?: string
}

/**
 * Cuánto más ancha es la columna combinada «Sáb y Dom» respecto a un día
 * suelto (los días sueltos usan flexGrow: 1). Lleva el doble de contenido
 * (sábado + domingo), así que necesita más aire para no quedar apretada.
 */
const WEEKEND_COL_GROW = 1.8

const styles = StyleSheet.create({
  page: {
    /**
     * `paddingTop`/`paddingBottom` se calculan para dejar 5pt de aire entre las
     * barras decorativas (5pt de alto cada una) y el contenido / footer.
     */
    paddingTop: 10,
    paddingHorizontal: 22,
    paddingBottom: 24,
    fontSize: 8.4,
    fontFamily: 'Helvetica',
    color: PDF_BRAND.body,
    backgroundColor: PDF_BRAND.white,
  },
  /**
   * Banda decorativa de marca: gradient horizontal `secondary → tertiary`
   * (violeta → magenta) que corre de borde a borde. Va arriba y abajo de la
   * página para "enmarcar" sutilmente el documento con los colores de marca.
   * 5pt de alto: visible pero sin robar protagonismo al contenido.
   */
  brandAccentBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 5,
  },
  brandAccentTop: {
    top: 0,
  },
  brandAccentBottom: {
    bottom: 0,
  },
  brandAccentSvg: {
    width: '100%',
    height: '100%',
  },
  /**
   * Cabecera tipo card clara, minimalista. Altura reducida: el logo ya no domina,
   * todo entra en una franja chata para que el contenido (tablas) tenga más aire.
   */
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PDF_BRAND.white,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: PDF_BRAND.border,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 5,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flexShrink: 1,
  },
  /**
   * Logo en tamaño "medallón" (60pt). Con `objectFit: 'cover'` recortamos el
   * padding transparente que trae el PNG fuente y el icono naranja queda nítido
   * dentro del viewport. Si querés agrandarlo, subir width/height a la par.
   */
  heroLogoImg: {
    width: 60,
    height: 60,
    objectFit: 'cover',
  },
  heroLogoMonogram: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.primary,
    letterSpacing: 0.4,
  },
  heroTitle: {
    fontSize: 16.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.heading,
    letterSpacing: 0.2,
  },
  heroSubtitle: {
    fontSize: 8.2,
    color: PDF_BRAND.muted,
    marginTop: 2,
  },
  /**
   * Lado derecho del header: los 3 contactos quedan alineados en UNA SOLA línea
   * horizontal. El gap del contenedor maneja la separación entre cada contacto.
   */
  heroRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexShrink: 0,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  /** Badge circular usado solo cuando se cae al fallback SVG (icono monocromo). */
  contactBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * Icono PNG (WhatsApp/Gmail/Instagram). Se reduce un poquito vs. la versión
   * stack porque ahora viaja en línea con los demás → tamaño más balanceado
   * con el texto y look más minimalista.
   */
  contactBrandIcon: {
    width: 14,
    height: 14,
    objectFit: 'contain',
  },
  contactText: {
    fontSize: 8,
    color: PDF_BRAND.heading,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.1,
  },
  headerGrid: {
    marginTop: 6,
    marginBottom: 8,
    borderWidth: 0.6,
    borderColor: PDF_BRAND.border,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: PDF_BRAND.white,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  headerItem: {
    flexGrow: 1,
    flexBasis: 0,
    paddingRight: 10,
    paddingLeft: 10,
    borderLeftWidth: 0.6,
    borderLeftColor: PDF_BRAND.border,
  },
  headerItemFirst: {
    paddingLeft: 0,
    borderLeftWidth: 0,
  },
  /** Columna ancha para nombres largos (Paciente). */
  headerItemWide: {
    flexGrow: 1.7,
  },
  /** Columna angosta para datos cortos (Edad). */
  headerItemNarrow: {
    flexGrow: 0.65,
  },
  headerLabel: {
    fontSize: 6.4,
    color: PDF_BRAND.muted,
    marginBottom: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Helvetica-Bold',
  },
  headerValue: {
    fontSize: 8.8,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.heading,
  },
  mealBlock: {
    marginBottom: 5,
    borderWidth: 0.6,
    borderColor: PDF_BRAND.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: PDF_BRAND.white,
    position: 'relative',
  },
  /**
   * Tema "secondary" (verde) — usado en bloques de comida pares (idx 0, 2, 4...).
   * El acento, el wash del header y el pill comparten paleta verde.
   */
  mealAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: PDF_BRAND.secondary,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4.5,
    paddingLeft: 12,
    paddingRight: 8,
    backgroundColor: PDF_BRAND.secondaryWash,
    borderBottomWidth: 0.6,
    borderBottomColor: PDF_BRAND.border,
    gap: 8,
  },
  mealTitleText: {
    fontSize: 9.4,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.heading,
    letterSpacing: 0.2,
  },
  /** Pill de hora en tema secondary (violeta). Texto/bg/borde armonizan con `secondary`. */
  mealTimePill: {
    fontSize: 6.4,
    fontFamily: 'Helvetica-Bold',
    color: '#5B21B6',
    backgroundColor: '#F5F3FF',
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: '#DDD6FE',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  /**
   * Tema "tertiary" (magenta/rosa) — overrides aplicados a los bloques impares
   * (idx 1, 3...). Mantiene la misma estructura, solo cambia la paleta.
   */
  mealAccentAlt: {
    backgroundColor: PDF_BRAND.tertiary,
  },
  mealHeaderAlt: {
    backgroundColor: PDF_BRAND.tertiaryWash,
  },
  mealTimePillAlt: {
    color: '#9D174D',
    backgroundColor: '#FDF2F8',
    borderColor: '#FBCFE8',
  },
  colHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F4F6F8',
    borderBottomWidth: 0.4,
    borderBottomColor: PDF_BRAND.border,
  },
  colHeadCell: {
    flexGrow: 1,
    flexBasis: 0,
    paddingVertical: 3,
    paddingHorizontal: 4,
    fontSize: 6.2,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.muted,
    borderRightWidth: 0.4,
    borderRightColor: PDF_BRAND.border,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  /**
   * Altura mínima de cada fila de comidas. Subió de 32 → 46 ahora que el header
   * es ~42pt más bajo, así las tablas aprovechan el espacio vertical liberado
   * y no queda un hueco grande al fondo de la página.
   */
  rowCells: {
    flexDirection: 'row',
    minHeight: 46,
  },
  cell: {
    flexGrow: 1,
    flexBasis: 0,
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 7,
    lineHeight: 1.35,
    color: PDF_BRAND.body,
    borderRightWidth: 0.4,
    borderRightColor: PDF_BRAND.border,
  },
  cellEmpty: {
    color: '#CBD5E1',
  },
  cellBold: {
    fontFamily: 'Helvetica-Bold',
  },
  cellItalic: {
    fontFamily: 'Helvetica-Oblique',
  },
  footer: {
    position: 'absolute',
    left: 22,
    right: 22,
    /**
     * 10pt arriba de la barra inferior (5pt) → 5pt netos de aire visible entre
     * la línea de marca y el texto del footer.
     */
    bottom: 10,
    paddingTop: 4,
    paddingBottom: 2,
    paddingHorizontal: 6,
    borderTopWidth: 0.6,
    borderTopColor: PDF_BRAND.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 6.4,
    color: PDF_BRAND.muted,
    letterSpacing: 0.2,
  },
  footerBrand: {
    fontSize: 6.4,
    color: PDF_BRAND.heading,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.4,
  },
})

export interface NutritionMealPlanPdfDocumentProps {
  patientName: string
  genderLabel: string
  ageText: string | null
  weightKgText: string | null
  totalKcalLabel: string | null
  nextConsultLabel: string | null
  mergeWeekends: boolean
  grid: WeeklyPlanGridJson
  variant?: 'compact' | 'detailed'
  professionalName?: string | null
  professionalContact?: ProfessionalContact
  appLogoUrl?: string | null
  /** Iconos PNG oficiales (WhatsApp/Instagram/Gmail) servidos desde `public/`. */
  socialIcons?: SocialIconUrls
}

export function NutritionMealPlanPdfDocument({
  patientName,
  genderLabel,
  ageText,
  weightKgText,
  totalKcalLabel,
  mergeWeekends,
  grid,
  variant = 'detailed',
  professionalContact,
  appLogoUrl,
  socialIcons,
}: NutritionMealPlanPdfDocumentProps) {
  const days = columnLabels(mergeWeekends)
  const isCompact = variant === 'compact'

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            {appLogoUrl ? (
              <Image src={appLogoUrl} style={styles.heroLogoImg} />
            ) : (
              <Text style={styles.heroLogoMonogram}>H</Text>
            )}
            <View>
              <Text style={styles.heroTitle}>Plan de alimentación</Text>
              <Text style={styles.heroSubtitle}>Distribución semanal personalizada</Text>
            </View>
          </View>

          <View style={styles.heroRight}>
            {professionalContact?.phone ? (
              <View style={styles.contactRow}>
                {socialIcons?.whatsapp ? (
                  <Image src={socialIcons.whatsapp} style={styles.contactBrandIcon} />
                ) : (
                  <View style={[styles.contactBadge, { backgroundColor: '#25D366' }]}>
                    <WhatsAppIcon size={10} color="#FFFFFF" />
                  </View>
                )}
                <Text style={styles.contactText}>{professionalContact.phone}</Text>
              </View>
            ) : null}
            {professionalContact?.email ? (
              <View style={styles.contactRow}>
                {socialIcons?.gmail ? (
                  <Image src={socialIcons.gmail} style={styles.contactBrandIcon} />
                ) : (
                  <View style={[styles.contactBadge, { backgroundColor: '#EA4335' }]}>
                    <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' }}>M</Text>
                  </View>
                )}
                <Text style={styles.contactText}>{professionalContact.email}</Text>
              </View>
            ) : null}
            {professionalContact?.instagram ? (
              <View style={styles.contactRow}>
                {socialIcons?.instagram ? (
                  <Image src={socialIcons.instagram} style={styles.contactBrandIcon} />
                ) : (
                  <View style={[styles.contactBadge, { backgroundColor: '#E1306C' }]}>
                    <InstagramIcon size={10} color="#FFFFFF" bgColor="#E1306C" />
                  </View>
                )}
                <Text style={styles.contactText}>{professionalContact.instagram}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.headerGrid}>
          <View style={styles.headerRow}>
            <View style={[styles.headerItem, styles.headerItemFirst, styles.headerItemWide]}>
              <Text style={styles.headerLabel}>Nombre</Text>
              <Text style={styles.headerValue}>{patientName}</Text>
            </View>
            <View style={styles.headerItem}>
              <Text style={styles.headerLabel}>Sexo</Text>
              <Text style={styles.headerValue}>{genderLabel}</Text>
            </View>
            <View style={[styles.headerItem, styles.headerItemNarrow]}>
              <Text style={styles.headerLabel}>Edad</Text>
              <Text style={styles.headerValue}>{ageText ?? '—'}</Text>
            </View>
            <View style={styles.headerItem}>
              <Text style={styles.headerLabel}>Peso actual</Text>
              <Text style={styles.headerValue}>{weightKgText ?? '—'}</Text>
            </View>
            <View style={styles.headerItem}>
              <Text style={styles.headerLabel}>Valor calórico</Text>
              <Text style={styles.headerValue}>{totalKcalLabel ?? 'Consensuado'}</Text>
            </View>
          </View>
        </View>

        {grid.mealRows.map((meal, idx) => {
          const time = meal.approxTime?.trim()
          // Alternancia secondary (verde) / tertiary (ámbar) por bloque de comida.
          const isAlt = idx % 2 === 1
          return (
            <View key={meal.id} style={styles.mealBlock}>
              <View style={isAlt ? [styles.mealAccent, styles.mealAccentAlt] : styles.mealAccent} />
              {/*
                Header (título + horarios de columna) se mantiene unido y nunca
                queda huérfano al pie de página (minPresenceAhead). El bloque
                de celdas de abajo SÍ puede partirse entre páginas, así un menú
                con mucho texto fluye a la página siguiente en vez de cortarse.
              */}
              <View wrap={false} minPresenceAhead={60}>
                <View style={isAlt ? [styles.mealHeader, styles.mealHeaderAlt] : styles.mealHeader}>
                  <Text style={styles.mealTitleText}>{meal.label}</Text>
                  {time ? (
                    <Text style={isAlt ? [styles.mealTimePill, styles.mealTimePillAlt] : styles.mealTimePill}>
                      {time}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.colHeaderRow}>
                  {days.map((d, i) => {
                    const isLast = i === days.length - 1
                    // La columna combinada Sáb+Dom lleva el doble de texto → más ancha.
                    const wide = isLast && mergeWeekends ? { flexGrow: WEEKEND_COL_GROW } : {}
                    return (
                      <Text
                        key={i}
                        style={[styles.colHeadCell, isLast ? { borderRightWidth: 0 } : {}, wide]}
                      >
                        {d}
                      </Text>
                    )
                  })}
                </View>
              </View>
              <View style={isCompact ? [styles.rowCells, { minHeight: 34 }] : styles.rowCells}>
                {meal.columns.map((txt, ci) => {
                  const text = txt?.trim() || ''
                  const isEmpty = text.length === 0
                  const isLast = ci === meal.columns.length - 1
                  const baseStyle = isCompact
                    ? [styles.cell, { fontSize: 6.2, lineHeight: 1.25, paddingVertical: 3 }]
                    : [styles.cell]
                  // Columna Sáb+Dom más ancha (debe coincidir con el header).
                  const lastCell = isLast
                    ? [{ borderRightWidth: 0, ...(mergeWeekends ? { flexGrow: WEEKEND_COL_GROW } : {}) }]
                    : []
                  const emptyStyle = isEmpty ? [styles.cellEmpty] : []
                  return (
                    <Text key={ci} style={[...baseStyle, ...lastCell, ...emptyStyle]}>
                      {isEmpty
                        ? '—'
                        : parseInlineMarkdown(text).map((seg, si) => (
                            <Text
                              key={si}
                              style={[
                                seg.bold ? styles.cellBold : {},
                                seg.italic ? styles.cellItalic : {},
                              ]}
                            >
                              {seg.text}
                            </Text>
                          ))}
                    </Text>
                  )
                })}
              </View>
            </View>
          )
        })}

        {/*
          Banda decorativa SUPERIOR: gradient violeta → magenta de borde a borde.
          Renderizada al final del flujo (pero `position: absolute` la lleva al
          top de la página) y `fixed` la repite en cada página si el contenido
          desborda. Aporta vida cromática sin competir con la información.
        */}
        <View style={[styles.brandAccentBar, styles.brandAccentTop]} fixed>
          <Svg style={styles.brandAccentSvg}>
            <Defs>
              <LinearGradient id="brandAccentTop" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={PDF_BRAND.secondary} stopOpacity={1} />
                <Stop offset="1" stopColor={PDF_BRAND.tertiary} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#brandAccentTop)" />
          </Svg>
        </View>
        {/* Banda decorativa INFERIOR: gradient invertido (magenta → violeta) → efecto "marco". */}
        <View style={[styles.brandAccentBar, styles.brandAccentBottom]} fixed>
          <Svg style={styles.brandAccentSvg}>
            <Defs>
              <LinearGradient id="brandAccentBottom" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={PDF_BRAND.tertiary} stopOpacity={1} />
                <Stop offset="1" stopColor={PDF_BRAND.secondary} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#brandAccentBottom)" />
          </Svg>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Plan nutricional personalizado · Generado desde la ficha del paciente
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
          <Text style={styles.footerBrand}>HACIÉNDOLO HÁBITO</Text>
        </View>
      </Page>
    </Document>
  )
}
