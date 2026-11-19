# Correcciones del entrenador — nov19 (2026-11-19)

Fuente: `CORRECIONES EN APP.docx` (escritorio). Cada punto dice de dónde sale y en qué tanda va.
`[x]` hecho · `[ ]` pendiente · `[?]` hay que confirmar algo con el entrenador antes.

## Tanda 1 — link del alumno (sin SQL)

- [x] (App 1) «Tu progreso» y «Tu ciclo» abiertos de entrada, sin tener que tocarlos.
- [x] (App 2) Gráfico del ciclo: rueda de 28 días con las fases (menstruación, folicular, ovulación, lútea) y el día en que está.
- [x] (App 6) En el ejercicio abierto, un botón «Volver» con texto en lugar de la flechita.
- [x] (App 7) Circuitos: se abren juntos en una misma pantalla, y «Siguiente» avisa «Circuito: A + B + C» en lugar de un ejercicio suelto.
- [x] (App 9) Al entrar: si dejó un día con series hechas sin tocar «Terminé», lo lleva a ese día para cerrarlo; si no, al día y la semana que le tocan.
- [x] (App 9) Semanas como niveles: se desbloquean al cerrar todos los días de la anterior. Las semanas de adelante quedan bloqueadas (no se pueden completar por error).
- [x] (App 3, parte del link) La semana actual sale del avance del alumno (primera semana con días sin cerrar), no de las fechas del bloque.

## Tanda 2 — vencimientos y calendario (entrenador)

- [x] (App 3) Las rutinas no se marcan «Vencida» por fecha: el aviso de «última semana / terminé la rutina» lo da el alumno desde el link. Los «Vencida» del Inicio eran tareas viejas de «Termina pronto» (sacadas en nov3) que quedaron colgadas: ya no vuelven, y la etiqueta de las tareas atrasadas dice «Atrasada». Los avisos de semana y el monitor siguen el avance del alumno, no las fechas.
- [x] (App 3) Aviso nuevo: «X no completa datos hace N días» (7 días o más sin series ni días cerrados), con WhatsApp para escribirle.
- [x] (App 3) El calendario se completa con las fechas en que el alumno entrena (punto en cada día: cerró, anotó series o no pudo); bloques, intensificación y descarga los sigue indicando el entrenador.

## Tanda 3 — peso por lado o total

- [ ] (App 4) Al planificar: marcar si el peso es «Total», «Por lado» o ambos (con barra de 20 kg: 100 kg total = 40 por lado).
- [ ] (App 4) En el link: mostrar total y/o por lado según lo marcado.
- [ ] (App 4) El alumno indica si lo que anotó es total o por lado (necesita SQL para guardarlo por serie).

## Tanda 4 — «Ver como profe» y notas para el alumno (necesita SQL)

- [ ] (App 5) Vista del entrenador en el link: ver todo lo que cargó el alumno sin poder pisar sus datos ni completar cuestionarios.
- [ ] (App 5) «Nota para el alumno» por ejercicio: la deja el entrenador al revisar una semana y le aparece al alumno la próxima vez que hace ese día. El alumno la puede ocultar.
- [ ] (App 8) Entrada en calor con imágenes o videos (links en el texto se muestran como video/foto).

## Tanda 5 — Finanzas (necesita SQL)

SQL: `supabase/migrations/20261123120000_finanzas_reinicio_dias_pago.sql` (lo corre el usuario a mano).

- [x] Reiniciar los pagos cargados sin tocar los datos de los alumnos (copia en `income_backup_20261119`).
- [x] Cargar el día de pago de los alumnos actuales (lista del documento) y dejar noviembre como pagado; bonificados sin cobro (`students.payment_exempt`, se marca también desde «Día de pago» en el tablero).
- [x] Estados: «Pagó» verde · «Paga hoy» amarillo · «Falta pagar» rojo (pasó la fecha) · «Vencido» violeta (5 días o más). Recordatorios por WhatsApp como hasta ahora.
- [x] Marcar pagó / no pagó con un check (el monto sale del plan), sin cobros duplicados. Editar sigue disponible.
- [x] Formulario nuevo: fecha de pago obligatoria (día 1 a 28 o último día), queda registrada en el alumno (trigger del SQL).
- [?] (Idea futura) Ingreso por profesional del equipo para saber cuánto pagarle a cada uno.

## Tanda 6 — Web / marketplace

- [ ] (Web 1) Formulario propio de cada entrenador (preguntas configurables) y botón «Formulario» en la solicitud que manda el link por WhatsApp.
- [ ] (Web 2) Casos de éxito: el video se reproduce ahí (YouTube/Instagram) o, si no se puede, foto de portada con «Tocá acá para ver el video del caso».
- [ ] (Web 3) En la primera pantalla, junto a «Ver planes», un botón «Ver casos de éxito».
- [ ] (Web 4) Etiqueta «Entrenador» de la tarjeta: más contraste.
- [ ] (Web 5) Solo el WhatsApp de Tomas Ferster como contacto; el resto de los profesionales sin número por ahora.
- [?] (Web 5) Flujo con otro profesional: Tomas confirma el pago y habilita; al otro profesional le llega «nuevo alumno confirmado». Los usuarios de otros profesionales todavía no existen.
- [ ] (Web 5) Sacar la página web vieja; la nueva es la de «Armá tu equipo».
- [ ] (Web 5) Falta la opción de precio «Por sesión».
- [ ] (Web 5) El menú de datos y precios del perfil, para cada profesional en su usuario (sin el número por ahora).

## Notas

- Lo que ya estaba: «Ver como alumno» (vista previa sin guardar) es la base de la Tanda 4.
- Fechas de pago del documento (Tanda 5): Franco Emanuel Chevalley 5 · Yael Domínguez 5 · Braian Ezequiel Etchepare bonificado · Briana Cardozo último día del mes · Lucio Casanave último día (no abonó noviembre) · Agustín Peluffo 10 · Ailin Masdeu 10 · Bianca Anabela Trofelli 1 · Federico Ferster bonificado · Gustavo Cabral 1 · Juliana Caivano 5 · Lujan Ayala 1 · Maria Rosa Villar 1 · Matias Sambran 15 · Santiago Scheifler 10 · Yony Argañaraz 5. Todos abonaron noviembre salvo Lucio.
