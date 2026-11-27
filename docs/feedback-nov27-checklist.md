# Correcciones del entrenador — 27/11/2026

Documento: «CORRECIONES EN APP.docx» (un aviso nuevo + respuestas a las 3 preguntas del 25/11 + 2 pedidos con capturas).
`[x]` hecho · `[ ]` pendiente · `[?]` hay que confirmar algo con el entrenador antes.

## Tanda 1 — Avisos y errores del link del alumno

- [x] (A) Semana 2 que «no se desbloquea»: el alumno había hecho todo, pero no tocó «Terminé este entrenamiento» ni eligió el esfuerzo. Hoy la semana bloqueada es un botón apagado: en el celu tocarla no hace nada y la explicación solo sale al pasar el mouse. Además «Guardar y terminar» queda apagado hasta elegir el esfuerzo y no dice por qué. Hacer: que la semana bloqueada se pueda tocar (con candado) y muestre un aviso claro con los días que faltan cerrar y un botón para ir a cada uno; y en el cierre del día, decir que falta elegir el esfuerzo. Hecho: tocar la semana con candado lleva al primer día sin cerrar y muestra «Semana 2 está bloqueada — Revisá que marcaste como terminado cada entrenamiento… Te falta cerrar Día 2 y Día 3», con cómo hacerlo. El mismo aviso aparece solo cuando ya entrenó los días que le faltan pero no tocó «Terminé». El día entrenado sin cerrar queda marcado en naranja, y el cierre dice «Elegí un número del 1 al 10 para poder terminar».
- [x] (1) Pantalla cortada de Santiago Scheifler (captura): con el ejercicio abierto se ve la columna «Indicado» pero no las reps, los kilos ni el tilde; la escala del esfuerzo se corta en el 4 y «Siguiente» queda cortado sin «…». Todo el panel es más ancho que la pantalla. Lo que tiene su rutina: kilos «Total / Por lado», RPE indicado y un circuito después. Reproducir con eso y con la letra agrandada del celu, y corregir. Hecho: reproducido igual que la captura con el CSS anterior al 24/11. La causa era el botón «Siguiente» con el nombre largo del circuito en una sola línea, que estiraba todo el panel. El arreglo del 24/11 ya evitaba que se cortaran los kilos y la escala; ahora además «Siguiente» se corta con «…» y no se sale de la pantalla (probado en 360 y 412 px).

## Tanda 2 — Ver como profe

- [x] (2) Le sirve «Ver como profe»: ver todas las semanas desbloqueadas para explicarle al alumno. Ya funciona así: en «Ver como profe» no hay semanas bloqueadas y no se puede tocar nada.

## Tanda 3 — Registrar pago con el plan web

- [ ] (5) En «Registrar pago», «Tipo de ingreso / plan» tiene que ofrecer los planes existentes de la web, para registrar con su plan a los alumnos que entraron por el formulario anterior. La ficha hoy dice «Sin plan web» (`students.selected_web_plan_slug` vacío). Al elegir un plan web en el pago, que quede como plan del alumno. Más adelante se completa solo, porque el alumno nuevo entra por la web con su plan. Cada profesional carga sus planes (ya se puede en «Mi página») y el alumno, al registrarse, ve qué plan paga.

## Tanda 4 — Progreso del alumno en la ficha

- [ ] (4a) El gráfico de chequeos de la ficha (Energía, Sueño, Estrés, Dolores… en un solo gráfico de líneas) mezcla todo: cada dato en su propio gráfico, separado.
- [ ] (4b) Para el entrenador, una tabla como «Cómo llegás a entrenar, semana a semana» de la app del alumno, pero con todas las semanas.

## Tanda 5 — Macrociclo

- [?] (3) Respuesta del entrenador. Usa el modelo ATR: Acumulación, Transformación/Intensificación, Realización, y él agrega Descarga (varía mucho). En cada etapa: volumen, intensidades, anotaciones y lo que ya tiene. Opcional, solo para hipertrofia: MEV (mínimo de series semanales por grupo muscular para crecer) y MAV (rango óptimo). Primero planifica la línea general de todo el macrociclo y después va mes a mes, ajustando. Quiere las dos vistas: calendario (que se completa con lo que hace el alumno) y línea de tiempo con anotaciones, como guía antes de planificar. Idea: que el alumno lo vea como un mapa de niveles hacia el objetivo, que avanza al completar cada mesociclo. Ya existe un calendario de macrociclo por alumno con fases editables (Adaptación, Acumulación, Intensificación, Peak, Descarga). Falta acordar un boceto antes de programar.
