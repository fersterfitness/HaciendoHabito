import type { Dispatch, SetStateAction } from 'react'
import type { NutritionAnamnesisPayloadV1 } from '@/lib/nutrition/anamnesisPayload'
import { FOOD_FREQUENCY_ITEMS } from '@/lib/nutrition/anamnesisPayload'

const FIELD =
  'mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary placeholder:text-ink-muted px-3 py-2.5 text-sm focus:outline-none focus:border-brand-primary'
const LABEL = 'block text-xs text-ink-secondary font-medium mb-2'

interface Props {
  value: NutritionAnamnesisPayloadV1
  onChange: Dispatch<SetStateAction<NutritionAnamnesisPayloadV1>>
}

function SectionTitle({ children }: { children: string }) {
  return <h4 className="text-sm font-semibold text-brand-primary border-b border-surface-border pb-2 mb-3">{children}</h4>
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return <div className="grid md:grid-cols-2 gap-3">{children}</div>
}

export function NutritionAnamnesisForm({ value, onChange }: Props) {
  const patch = (partial: Partial<NutritionAnamnesisPayloadV1>) => {
    onChange((prev) => ({ ...prev, ...partial }))
  }

  const setFoodFreq = (
    food: string,
    key: 'tipo' | 'frecuencia' | 'cantidad',
    v: string
  ) => {
    onChange((prev) => ({
      ...prev,
      foodFrequency: prev.foodFrequency.map((row) =>
        row.food === food ? { ...row, [key]: v } : row
      ),
    }))
  }

  const setHabito = (kind: 'habitosBuenos' | 'habitosMalos', idx: number, txt: string) => {
    onChange((prev) => {
      const arr = [...prev[kind]]
      arr[idx] = txt
      return { ...prev, [kind]: arr as NutritionAnamnesisPayloadV1[typeof kind] }
    })
  }

  const radioActividad =
    value.actividadFisicaAfirmativo === ''
      ? 'na'
      : value.actividadFisicaAfirmativo === 'si'
      ? 'si'
      : 'no'

  return (
    <div className="space-y-8">
      <p className="text-sm text-ink-muted leading-relaxed border-l-4 border-brand-primary/30 pl-4">
        Completá el cuestionario para complementar la consulta inicial. Coincide con el formato de planificación nutricional
        habitual.
      </p>

      <div>
        <SectionTitle>Motivo de consulta</SectionTitle>
        <label className={LABEL}>Motivo de consulta</label>
        <textarea
          value={value.motivoConsulta}
          rows={3}
          onChange={(e) => patch({ motivoConsulta: e.target.value })}
          className={`${FIELD} min-h-[5rem]`}
          placeholder="Objetivos, molestias, solicitud médica..."
        />
      </div>

      <div>
        <SectionTitle>Datos generales</SectionTitle>
        <TwoCol>
          <div>
            <label className={LABEL}>Profesión / ocupación</label>
            <input
              value={value.profesionOcupacion}
              onChange={(e) => patch({ profesionOcupacion: e.target.value })}
              className={FIELD}
            />
          </div>
          <div>
            <label className={LABEL}>Horario de trabajo</label>
            <input value={value.horarioTrabajo} onChange={(e) => patch({ horarioTrabajo: e.target.value })} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>Estado civil</label>
            <input value={value.estadoCivil} onChange={(e) => patch({ estadoCivil: e.target.value })} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>Composición familiar (convivientes)</label>
            <input
              value={value.composicionFamiliar}
              onChange={(e) => patch({ composicionFamiliar: e.target.value })}
              className={FIELD}
            />
          </div>
          <div className="md:col-span-2">
            <label className={LABEL}>Hobbies</label>
            <input value={value.hobbies} onChange={(e) => patch({ hobbies: e.target.value })} className={FIELD} />
          </div>
        </TwoCol>
      </div>

      <div>
        <SectionTitle>Datos antropométricos (orientativos si el paciente auto-completa)</SectionTitle>
        <TwoCol>
          <div>
            <label className={LABEL}>Circunferencia de cintura (cm)</label>
            <input value={value.cinturaCm} onChange={(e) => patch({ cinturaCm: e.target.value })} className={FIELD} placeholder="Ej: 82" />
          </div>
          <div>
            <label className={LABEL}>Circunferencia de cadera (cm)</label>
            <input value={value.caderaCm} onChange={(e) => patch({ caderaCm: e.target.value })} className={FIELD} placeholder="Ej: 98" />
          </div>
          <div className="md:col-span-2">
            <label className={LABEL}>Brazo (circunferencia en punto medio entre hombro y codo)</label>
            <input value={value.brazoCircunferencia} onChange={(e) => patch({ brazoCircunferencia: e.target.value })} className={FIELD} />
          </div>
        </TwoCol>
      </div>

      <div>
        <SectionTitle>Salud</SectionTitle>
        <label className={LABEL}>Patologías presentes</label>
        <textarea value={value.patologias} onChange={(e) => patch({ patologias: e.target.value })} rows={2} className={FIELD} />
        <div className="mt-3">
          <label className={LABEL}>Medicación</label>
          <textarea value={value.medicacion} onChange={(e) => patch({ medicacion: e.target.value })} rows={2} className={FIELD} />
        </div>
        <div className="mt-3">
          <label className={LABEL}>Suplementación</label>
          <textarea value={value.suplementacion} onChange={(e) => patch({ suplementacion: e.target.value })} rows={2} className={FIELD} />
        </div>
        <div className="mt-3">
          <label className={LABEL}>Sintomatología</label>
          <textarea value={value.sintomatologia} onChange={(e) => patch({ sintomatologia: e.target.value })} rows={2} className={FIELD} />
        </div>
        <div className="mt-3">
          <label className={LABEL}>Antecedentes familiares relevantes</label>
          <textarea
            value={value.antecedentesFamiliares}
            onChange={(e) => patch({ antecedentesFamiliares: e.target.value })}
            rows={2}
            className={FIELD}
          />
        </div>
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Tabaquismo (sí/no)</label>
            <input value={value.tabaquismoSiNo} onChange={(e) => patch({ tabaquismoSiNo: e.target.value })} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>Estudios de laboratorio (observaciones)</label>
            <input value={value.otrosEstudios} onChange={(e) => patch({ otrosEstudios: e.target.value })} className={FIELD} />
          </div>
        </div>
      </div>

      <div>
        <SectionTitle>Actividad física</SectionTitle>
        <div className="flex gap-6 mb-4">
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              name="act"
              checked={radioActividad === 'si'}
              onChange={() => patch({ actividadFisicaAfirmativo: 'si' })}
              className="accent-brand-primary"
            />
            Sí
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              name="act"
              checked={radioActividad === 'no'}
              onChange={() => patch({ actividadFisicaAfirmativo: 'no' })}
              className="accent-brand-primary"
            />
            No
          </label>
        </div>
        {value.actividadFisicaAfirmativo === 'si' && (
          <>
            <label className={LABEL}>¿Cuál prácticas?</label>
            <input value={value.actividadFisicaCual} onChange={(e) => patch({ actividadFisicaCual: e.target.value })} className={FIELD + ' mb-3'} />
            <TwoCol>
              <div>
                <label className={LABEL}>Hace cuánto</label>
                <input value={value.actividadHaceCuanto} onChange={(e) => patch({ actividadHaceCuanto: e.target.value })} className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Frecuencia</label>
                <input value={value.actividadFrecuencia} onChange={(e) => patch({ actividadFrecuencia: e.target.value })} className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Duración</label>
                <input value={value.actividadDuracion} onChange={(e) => patch({ actividadDuracion: e.target.value })} className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Intensidad</label>
                <input value={value.actividadIntensidad} onChange={(e) => patch({ actividadIntensidad: e.target.value })} className={FIELD} />
              </div>
            </TwoCol>
          </>
        )}
      </div>

      <div>
        <SectionTitle>Hábitos alimentarios</SectionTitle>
        <TwoCol>
          <div>
            <label className={LABEL}>Horario de la primera ingesta</label>
            <input
              value={value.horarioPrimeraIngesta}
              onChange={(e) => patch({ horarioPrimeraIngesta: e.target.value })}
              className={FIELD}
            />
          </div>
          <div>
            <label className={LABEL}>¿Cuántas comidas por día?</label>
            <input value={value.comidasAlDia} onChange={(e) => patch({ comidasAlDia: e.target.value })} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>Comida que salteás con más frecuencia</label>
            <input value={value.comidasQueSaltea} onChange={(e) => patch({ comidasQueSaltea: e.target.value })} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>Horario última ingesta</label>
            <input value={value.horarioUltimaIngesta} onChange={(e) => patch({ horarioUltimaIngesta: e.target.value })} className={FIELD} />
          </div>
        </TwoCol>
        <div className="mt-3">
          <label className={LABEL}>Intolerancias digestivas</label>
          <textarea value={value.intolerancias} onChange={(e) => patch({ intolerancias: e.target.value })} rows={2} className={FIELD} />
        </div>
        <div className="mt-3">
          <label className={LABEL}>7 preparaciones que más cocinás/comprás/consumís</label>
          <textarea
            value={value.sietePreparacionesMasComunes}
            onChange={(e) => patch({ sietePreparacionesMasComunes: e.target.value })}
            rows={3}
            className={FIELD}
          />
        </div>
      </div>

      <div>
        <SectionTitle>Registro alimentario 24 horas</SectionTitle>
        <label className={LABEL}>Desayuno</label>
        <textarea value={value.registro24hDesayuno} onChange={(e) => patch({ registro24hDesayuno: e.target.value })} rows={2} className={FIELD + ' mb-3'} />
        <label className={LABEL}>Almuerzo</label>
        <textarea value={value.registro24hAlmuerzo} onChange={(e) => patch({ registro24hAlmuerzo: e.target.value })} rows={2} className={FIELD + ' mb-3'} />
        <label className={LABEL}>Merienda</label>
        <textarea value={value.registro24hMerienda} onChange={(e) => patch({ registro24hMerienda: e.target.value })} rows={2} className={FIELD + ' mb-3'} />
        <label className={LABEL}>Cena</label>
        <textarea value={value.registro24hCena} onChange={(e) => patch({ registro24hCena: e.target.value })} rows={2} className={FIELD + ' mb-3'} />
        <label className={LABEL}>Colaciones</label>
        <textarea value={value.registro24hColaciones} onChange={(e) => patch({ registro24hColaciones: e.target.value })} rows={2} className={FIELD} />
      </div>

      <div>
        <SectionTitle>Frecuencia alimentaria (tipo · frecuencia · cantidad · X si no consumes)</SectionTitle>
        <div className="overflow-auto max-h-[22rem] rounded-xl border border-surface-border shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="bg-surface-elevated sticky top-0 z-10 shadow-sm">
              <tr className="text-left text-ink-secondary">
                <th className="px-3 py-2 border-b border-surface-border w-[28%]">Alimento</th>
                <th className="px-3 py-2 border-b border-surface-border w-[22%]">Tipo</th>
                <th className="px-3 py-2 border-b border-surface-border w-[22%]">Frecuencia</th>
                <th className="px-3 py-2 border-b border-surface-border w-[22%]">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {FOOD_FREQUENCY_ITEMS.map((food) => {
                const row = value.foodFrequency.find((r) => r.food === food) ?? {
                  food,
                  tipo: '',
                  frecuencia: '',
                  cantidad: '',
                }
                return (
                  <tr key={food} className="border-b border-surface-border/70 hover:bg-surface-elevated/50">
                    <td className="px-3 py-1.5 text-ink-primary align-middle">{food}</td>
                    <td className="px-3 py-1">
                      <input
                        value={row.tipo}
                        onChange={(e) => setFoodFreq(food, 'tipo', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 px-1 py-0.5 rounded max-w-none"
                      />
                    </td>
                    <td className="px-3 py-1">
                      <input
                        value={row.frecuencia}
                        onChange={(e) => setFoodFreq(food, 'frecuencia', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 px-1 py-0.5 rounded max-w-none"
                      />
                    </td>
                    <td className="px-3 py-1">
                      <input
                        value={row.cantidad}
                        onChange={(e) => setFoodFreq(food, 'cantidad', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 px-1 py-0.5 rounded max-w-none"
                      />
                    </td>
                  </tr>
                )
              })}
              {value.foodFrequency
                .filter((row) => !(FOOD_FREQUENCY_ITEMS as readonly string[]).includes(row.food))
                .map((row, i) => (
                  <tr key={`extra-${row.food}-${i}`} className="border-b border-surface-border/70 bg-brand-primary/5">
                    <td className="px-3 py-1.5">{row.food}</td>
                    <td className="px-3 py-1">
                      <input
                        value={row.tipo}
                        onChange={(e) => setFoodFreq(row.food, 'tipo', e.target.value)}
                        className="w-full bg-transparent border-none px-1"
                      />
                    </td>
                    <td className="px-3 py-1">
                      <input
                        value={row.frecuencia}
                        onChange={(e) => setFoodFreq(row.food, 'frecuencia', e.target.value)}
                        className="w-full bg-transparent border-none px-1"
                      />
                    </td>
                    <td className="px-3 py-1">
                      <input
                        value={row.cantidad}
                        onChange={(e) => setFoodFreq(row.food, 'cantidad', e.target.value)}
                        className="w-full bg-transparent border-none px-1"
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <label className={LABEL}>Frutas y verduras más frecuentes</label>
        <textarea value={value.frutasVerdurasPreferidas} onChange={(e) => patch({ frutasVerdurasPreferidas: e.target.value })} rows={2} className={FIELD} />
        <label className={LABEL}>Otros alimentos relevantes</label>
        <textarea value={value.otrosAlimentosRelevantes} onChange={(e) => patch({ otrosAlimentosRelevantes: e.target.value })} rows={2} className={FIELD} />
      </div>

      <div>
        <SectionTitle>Hábitos percibidos (3 buenos / 3 malos)</SectionTitle>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Buenos hábitos</label>
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                value={value.habitosBuenos[i]}
                onChange={(e) => setHabito('habitosBuenos', i, e.target.value)}
                className={FIELD + ' mb-2'}
                placeholder={`Ej.${i === 2 ? '.' : '..'} (${i + 1}/3)`}
              />
            ))}
          </div>
          <div>
            <label className={LABEL}>Hábitos a mejorar</label>
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                value={value.habitosMalos[i]}
                onChange={(e) => setHabito('habitosMalos', i, e.target.value)}
                className={FIELD + ' mb-2'}
              />
            ))}
          </div>
        </div>
      </div>

      <div>
        <SectionTitle>Plan energético (referencia manual)</SectionTitle>
        <label className={LABEL}>Objetivo energético / método (opcional)</label>
        <input
          value={value.resultadoEnergeticoMeta}
          onChange={(e) => patch({ resultadoEnergeticoMeta: e.target.value })}
          className={FIELD}
          placeholder="Ej: 2150 kcal/día GET estimado..."
        />
      </div>

      <div>
        <SectionTitle>Aclaraciones finales</SectionTitle>
        <textarea value={value.aclaracionesFinales} onChange={(e) => patch({ aclaracionesFinales: e.target.value })} rows={3} className={FIELD} />
      </div>
    </div>
  )
}
