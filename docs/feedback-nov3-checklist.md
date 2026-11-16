# Correcciones del entrenador — nov3 (2026-11-16)

Fuente: `CORRECIONES EN APP-nov3.docx`. Cada punto dice de dónde sale (número del documento o sección) y en qué tanda va.
`[x]` hecho · `[ ]` pendiente · `[?]` hay que confirmar algo con el entrenador antes.

## Tanda 1 — arreglos rápidos (sin SQL)

**Link del alumno**
- [x] (9) Debajo de «Consulta urgente»: «Usalo si hay algo muy urgente o importante: tu entrenador recibe una notificación para leerlo lo antes posible.»
- [x] (10) Arriba a la derecha, en lugar de «Tu espacio de entrenamiento»: «Todo empieza cuando estás HACIÉNDOLO HÁBITO».
- [x] (11) Tarjeta de la izquierda: sacar la foto de la persona, poner el logo y la misma frase.
- [x] (6) «Terminé este entrenamiento» en verde y «No pude entrenar este día» en rojo.
- [x] (15) Circuitos: mostrar arriba la aclaración del circuito que escribe el entrenador (vueltas, pausas, macropausa), no solo «sin pausa entre ellos».
- [x] (3, segunda parte) Colores en los números de las escalas del chequeo (de rojo a verde según convenga).
- [x] (5) Más naranja del logo en el link del alumno (acentos y bordes), sin perder verde = completado y rojo = no completado.

**Editor de rutinas (entrenador)**
- [x] (Rutinas, rosa) Sacar el campo suelto «RPE / RIR» del ejercicio.
- [x] (Rutinas, azul) La tabla por serie (% RM, kg, reps, RPE) disponible para todos los ejercicios, no solo los multiarticulares.
- [x] (Otras cosas) Al crear una rutina, llevar directo a la rutina creada (hoy queda en la pantalla con error).
- [x] (Otras cosas) Sacar «Duración (semanas)» y la fecha de fin al crear la rutina: la cantidad sale de las semanas que se arman.
- [x] (Pagos) Sacar el precio al crear la rutina.
- [x] (Otras cosas) Accesos directos a las pestañas de la ficha (Información, Nutrición, Seguimiento, Progreso) desde el editor de la rutina.

**Menú del entrenador**
- [x] (Estadísticas) Sacar «Estadísticas» del menú: esos datos ya están en el Inicio.

## Tanda 2 — reps en segundos y RPE para el alumno

- [x] (Rutinas + 2) En «Reps» se puede escribir segundos o minutos: `12´´` = 12 segundos, `1´` = 1 minuto. El alumno ve el símbolo tal cual (no «segundos»), y la columna de reps no le pide un número de repeticiones en esos casos.
- [x] (1) El alumno ve el RPE por serie en su tabla de series.

## Tanda 3 — chequeo diario nuevo y obligatorio (necesita SQL)

- [ ] (Cuestionario, 1) Aviso inicial «ATENCIÓN — LECTURA OBLIGATORIA» con el texto del entrenador y botón «Entendí, completar mi chequeo»; la rutina del día queda bloqueada hasta completarlo.
- [x] (3) Sacar «Responder después»: el chequeo es obligatorio para empezar.
- [ ] Preguntas de todos los días:
  - [ ] Energía 1-5.
  - [ ] Sueño 1-5 + horas (No dormí / menos de 5 h / 6-7 h / más de 8 h).
  - [ ] Estrés 1-5.
  - [ ] Dolores 1-5 + tipo: «Dolores normales del entrenamiento», «Dolor no habitual», «No».
  - [ ] Si es dolor no habitual: mapa muscular para marcar dónde + aclaración. Queda ligado a la rutina (para cruzarlo con el volumen) y le llega al entrenador «X tiene un dolor puntual» con botón «Revisar».
  - [ ] Hidratación 1-5.
  - [ ] Ganas de entrenar 1-5.
  - [ ] Recuperación de la sesión anterior 1-5.
  - [ ] Alimentación 1-5; si marca 1 o 2, obligatorio «¿Qué fue lo que más te complicó?» (falta de tiempo, ansiedad o picoteo, comí afuera, no tenía la comida lista, otro con texto).
- [ ] Preguntas solo al cerrar la semana:
  - [ ] Pasos diarios promedio (menos de 5.000 / 5.000-7.500 / 7.500-10.000 / 10.000-12.000 / más de 12.000).
  - [ ] Ciclo menstrual, solo mujeres (Ya lo registré / No, con fecha / Tomo anticonceptivas / Menopausia).
- [ ] (Cuestionario) Se elimina el cuestionario semanal aparte: todo sale del chequeo diario.

## Tanda 4 — avisos del alumno al entrenador (necesita SQL)

- [ ] (7) Primer día de la última semana: botón llamativo y obligatorio, antes del chequeo, «Avisar al entrenador que es mi última semana de rutina».
- [ ] (7) Último día de la última semana: botón obligatorio «Avisar al entrenador que terminé hoy mi rutina».
- [ ] (13) Último día de cada semana: «Terminé mi semana X», que le avisa al entrenador que tiene que darle la devolución (los lunes).
- [ ] (12) Al terminar la rutina, feedback general OBLIGATORIO (testimonio para Instagram), y le llega al entrenador.
- [ ] (Notificaciones) Sacar «Termina en X días, armá la que sigue»: el aviso pasa a ser el del alumno.
- [ ] (Menú «este menú me gustó») Las tarjetas de Alumnos («Última semana», «Mes cerrado») toman esos avisos en lugar de fechas.

## Tanda 5 — notas propias del alumno (necesita SQL)

- [ ] (4) En cada ejercicio, una nota personal que el alumno se deja a sí mismo («Tomi me dijo que saque pecho») y ve cada vez que entra. Distinta de la nota «para tu entrenador».

## Tanda 6 — progreso del alumno y del entrenador

- [ ] (8) «Tu progreso» del alumno: promedios semanales del chequeo (sueño, energía, estrés…), días entrenados vs. no entrenados, si mejoró el rendimiento (sin mostrar los pesos), con gráficos de color simples y motivadores.
- [ ] (Progreso) En la ficha del alumno, pestaña «Progreso» nueva con todo lo que responde en la app: gráficos y aclaraciones, por día, semana, mes y año.
- [ ] (Progreso) «Seguimiento» como submenú dentro de Progreso, separado de los gráficos del chequeo.
- [ ] (Progreso) Sacar la pestaña «Hábitos» de la ficha.
- [ ] (Progreso) Sacar del menú «Consultas semanales» (Enviar, Respuestas y Formularios dejan de existir).
- [?] (Progreso) «Recursos»: ¿dónde va exactamente? El texto dice «al lado, donde antes estaba Hábitos».

## Tanda 7 — entrenador: Comparar, vista previa, Inicio y Finanzas

- [ ] (Otras cosas) «Comparar» también compara el volumen.
- [ ] (Otras cosas) Ver la rutina del alumno como entrenador sin tocar sus datos: vista previa sin chequeo obligatorio y sin guardar nada, para grabar el video explicativo.
- [?] (Notificaciones) Reordenar las pestañas de «Para hoy»: propuesta del entrenador Feedback/Progresos, Cobros, Avisos (¿cumpleaños?), Consultas urgentes.
- [ ] (Finanzas, Pagos) Simplificar: cada alumno tiene una fecha de pago fija (editable); con eso salen los avisos de vencido, vence hoy y pagó; se registran los pagos; el precio sale de los planes de la web; sacar datos repetidos.

## Notas

- (5) Más naranja en la app del alumno (bordes, acentos), manteniendo verde para lo completado y rojo para lo no completado. Ojo: el 2026-11-14 quedó decidido que solo el logo va en naranja en la app del entrenador; esto es solo para el link del alumno.
