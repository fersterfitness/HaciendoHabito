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
import { parsePlanGeneralNotes } from '@/lib/nutrition/planGeneralNotes'
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
  metaBlock: {
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 0.6,
    borderColor: PDF_BRAND.border,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: PDF_BRAND.white,
  },
  metaLabel: {
    fontSize: 6.4,
    color: PDF_BRAND.muted,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Helvetica-Bold',
  },
  metaBody: {
    fontSize: 8,
    color: PDF_BRAND.body,
    lineHeight: 1.35,
  },
  notesList: {
    marginTop: 4,
    gap: 3,
  },
  notesItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  notesBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
    backgroundColor: PDF_BRAND.secondary,
  },
  notesItemText: {
    flex: 1,
    fontSize: 7.6,
    color: PDF_BRAND.body,
    lineHeight: 1.35,
  },
  /** Biblioteca de planes: cabecera más baja para no “quemar” la primera hoja. */
  heroCardCompact: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 3,
  },
  heroLogoImgCompact: {
    width: 42,
    height: 42,
    objectFit: 'cover',
  },
  heroTitleCompact: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.heading,
  },
  heroSubtitleCompact: {
    fontSize: 7.2,
    color: PDF_BRAND.muted,
    marginTop: 1,
  },
  templateInfoStrip: {
    marginBottom: 4,
    borderWidth: 0.6,
    borderColor: PDF_BRAND.border,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: PDF_BRAND.white,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  templateInfoCol: {
    flexGrow: 1,
    flexBasis: 0,
  },
  templateInfoColWide: {
    flexGrow: 1.6,
    flexBasis: 0,
  },
  metaBlockCompact: {
    marginTop: 0,
    marginBottom: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
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
  /** Objetivo del plan (biblioteca / plantilla). */
  objective?: string | null
  /** Notas generales serializadas (preámbulo + aclaraciones). */
  generalNotes?: string | null
  /** Pie de página contextual. */
  footerSourceLabel?: string
  /** `template`: biblioteca sin datos clínicos; cabecera compacta y grilla desde la 1ª hoja. */
  layoutMode?: 'patient' | 'template'
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
  objective,
  generalNotes,
  footerSourceLabel = 'Plan nutricional personalizado · Generado desde la ficha del paciente',
  layoutMode = 'patient',
}: NutritionMealPlanPdfDocumentProps) {
  const days = columnLabels(mergeWeekends)
  const isCompact = variant === 'compact'
  const isTemplate = layoutMode === 'template'
  const parsedNotes = parsePlanGeneralNotes(generalNotes)
  const objectiveText = objective?.trim() ?? ''
  const mealHeaderMinAhead = isTemplate ? 28 : 60

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={isTemplate ? [styles.heroCard, styles.heroCardCompact] : styles.heroCard}>
          <View style={styles.heroLeft}>
            {appLogoUrl ? (
              <Image
                src={appLogoUrl}
                style={isTemplate ? styles.heroLogoImgCompact : styles.heroLogoImg}
              />
            ) : (
              <Text style={styles.heroLogoMonogram}>H</Text>
            )}
            <View>
              <Text style={isTemplate ? styles.heroTitleCompact : styles.heroTitle}>
                Plan de alimentación
              </Text>
              <Text style={isTemplate ? styles.heroSubtitleCompact : styles.heroSubtitle}>
                {isTemplate ? patientName : 'Distribución semanal personalizada'}
              </Text>
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

        {isTemplate ? (
          <>
            {(objectiveText || parsedNotes.preamble || parsedNotes.aclaraciones.length > 0) ? (
              <View style={styles.templateInfoStrip}>
                {objectiveText ? (
                  <View style={styles.templateInfoColWide}>
                    <Text style={styles.metaLabel}>Objetivo del plan</Text>
                    <Text style={styles.metaBody}>{objectiveText}</Text>
                  </View>
                ) : null}
                {parsedNotes.preamble ? (
                  <View style={styles.templateInfoCol}>
                    <Text style={styles.metaLabel}>Notas</Text>
                    <Text style={styles.metaBody}>{parsedNotes.preamble}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {parsedNotes.aclaraciones.length > 0 ? (
              <View style={[styles.metaBlock, styles.metaBlockCompact]}>
                <Text style={styles.metaLabel}>Aclaraciones</Text>
                <View style={styles.notesList}>
                  {parsedNotes.aclaraciones.map((item, i) => (
                    <View key={i} style={styles.notesItem}>
                      <View style={styles.notesBullet} />
                      <Text style={styles.notesItemText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <>
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

            {objectiveText ? (
              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>Objetivo del plan</Text>
                <Text style={styles.metaBody}>{objectiveText}</Text>
              </View>
            ) : null}

            {parsedNotes.preamble || parsedNotes.aclaraciones.length > 0 ? (
              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>Notas generales</Text>
                {parsedNotes.preamble ? <Text style={styles.metaBody}>{parsedNotes.preamble}</Text> : null}
                {parsedNotes.aclaraciones.length > 0 ? (
                  <View style={styles.notesList}>
                    <Text style={[styles.metaLabel, { marginTop: parsedNotes.preamble ? 4 : 0 }]}>Aclaraciones</Text>
                    {parsedNotes.aclaraciones.map((item, i) => (
                      <View key={i} style={styles.notesItem}>
                        <View style={styles.notesBullet} />
                        <Text style={styles.notesItemText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        )}

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
              <View wrap={false} minPresenceAhead={mealHeaderMinAhead}>
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
          <Text style={styles.footerText}>{footerSourceLabel}</Text>
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
