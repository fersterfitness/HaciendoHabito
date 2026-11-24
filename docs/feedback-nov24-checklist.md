# Correcciones del entrenador — 24/11/2026

Documento: «CORRECIONES EN APP.docx» (12 puntos + respuestas a las preguntas del 21/11).
`[x]` hecho · `[ ]` pendiente · `[?]` hay que confirmar algo con el entrenador antes.

## Tanda 1 — Errores (lo que hoy funciona mal)

- [ ] (1) Ejercicio abierto en el celu: a algunos alumnos se les corta a la derecha (no ven reps/kilos ni la escala 1–10) y tienen que rotar la pantalla. Con una rutina de prueba en 360 px se ve bien: depende del contenido de la rutina de ese alumno. Falta el link de un alumno al que le pase para reproducirlo. Mientras tanto se limitó el ancho del panel del ejercicio a la pantalla (CSS al final de public-routine.css).
- [x] (2) Ficha de Bianca: «Pago pendiente» aunque ya pagó. La tarjeta lee el estado del plan asignado (`student_plan_assignments`), que no se entera de los cobros de Finanzas. Tiene que mostrar lo mismo que Finanzas. Hecho: la tarjeta usa el cobro del mes de Finanzas («Pagó el mes», «Paga el 10», «Falta pagar», «Pago vencido», «Bonificado»); el plan asignado queda solo para quien no tiene día de pago ni cobros.
- [x] (3) Finanzas: Lucio figura «Al día» aunque no pagó noviembre. «Al día» quiere decir «todavía no llegó su día de pago» (paga el 30), pero se lee como «pagó». Hecho: ahora dice «Paga el 10» o «Paga el último día» y el filtro se llama «Todavía no pagan». Corregir ya se podía: «Pagó» registra el cobro y, si se marcó por error, se deshace desde la misma fila.

## Tanda 2 — Notas para el alumno

- [ ] (4) Varias notas por ejercicio (hoy hay una sola) y que el alumno marque «Lo vi» en cada una.
- [ ] (6) Nota de una semana: si se carga en la semana 2, aparece solo en la semana 2 (hoy aparece en todas).
- [ ] (7) Nota general del bloque o circuito, además de las de cada ejercicio.

## Tanda 3 — Tareas propias del entrenador

- [ ] (5) En el Inicio, un lugar para anotarse tareas propias, generales o de un alumno («revisar calendario de Ailu»), con check. Separadas de los avisos y de «Para hoy».

## Tanda 4 — Rutinas

- [ ] (9) La rutina nueva arranca con fecha de hoy; cuando el alumno marca que terminó su primer día, las fechas y el calendario se corren a ese día.
- [ ] (11) Armar la rutina siguiente sin activarla: la actual sigue activa para que el alumno termine de cargar, y la nueva queda guardada para después.
- [ ] (10) El alumno puede ver el historial de sus rutinas anteriores.

## Tanda 5 — Ver la rutina como el alumno

- [?] (8) Ya existe «Ver como alumno» en la rutina (vista previa sin chequeo y sin guardar nada) y «Ver como profe» (lo que cargó, sin tocar). La captura es de la app del alumno con su cuenta (pantalla de compu con «Hola, Franco»). Confirmar si le alcanza con la vista previa o necesita entrar a la app del alumno sin tocar nada.

## Tanda 6 — Macrociclo

- [?] (12) Planificar el macrociclo entero (por ejemplo, hasta la competencia de Ailin el 13/11/2027) con mesociclos y microciclos, anotaciones y objetivos por etapa, sin tener que asignar rutinas. Es una función nueva grande: conviene acordar primero un boceto de la pantalla.

## Tanda 7 — Marketplace (respuestas del 21/11)

- [ ] (R1) Ingresos por profesional: por defecto 80 % para el profesional y 20 % para Tomás, configurable por profesional (puede variar).
- [ ] (R2) «Pago confirmado»: además de la notificación en la app, mandar WhatsApp al otro profesional.
- [x] (R3) WhatsApp de Tomás 11 3330 5248: confirmado, no hay que cambiar nada.
- [x] (R4) Cuota de Agustín Peluffo $45.000: confirmada.
