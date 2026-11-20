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

SQL: `supabase/migrations/20261124120000_peso_por_lado.sql` (lo corre el usuario a mano; solo hace falta para lo que anota el alumno).

- [x] (App 4) Al planificar: marcar si el peso es «Total», «Por lado» o ambos (con barra de 20 kg: 100 kg total = 40 por lado). El kg cargado es siempre el total; la barra se puede cambiar (0 = sin barra).
- [x] (App 4) En el link: mostrar total y/o por lado según lo marcado (también en el PDF).
- [x] (App 4) El alumno indica si lo que anotó es total o por lado (se guarda por serie; el entrenador lo ve en «Anotó el alumno» y la diferencia con lo indicado se calcula en total).

## Tanda 4 — «Ver como profe» y notas para el alumno (necesita SQL)

SQL: `supabase/migrations/20261125120000_notas_para_el_alumno.sql` (lo corre el usuario a mano; solo para las notas).

- [x] (App 5) Vista del entrenador en el link: «Ver como profe» (menú del link en la ficha del alumno, `?vista=profe`). Muestra todo lo cargado, sin chequeo ni avisos, con todo bloqueado; no guarda nada en los datos del alumno.
- [x] (App 5) «Nota para el alumno» por ejercicio: se escribe desde la rutina (cada ejercicio) o desde «Ver como profe». Le aparece al alumno en ese ejercicio (también en las semanas siguientes) hasta que la oculta; si se cambia, vuelve a aparecer.
- [x] (App 8) Entrada en calor con imágenes o videos: YouTube y Vimeo se ven incrustados, fotos y .mp4 directo, el resto como botón.

## Tanda 5 — Finanzas (necesita SQL)

SQL: `supabase/migrations/20261123120000_finanzas_reinicio_dias_pago.sql` (lo corre el usuario a mano).

- [x] Reiniciar los pagos cargados sin tocar los datos de los alumnos (copia en `income_backup_20261119`).
- [x] Cargar el día de pago de los alumnos actuales (lista del documento) y dejar noviembre como pagado; bonificados sin cobro (`students.payment_exempt`, se marca también desde «Día de pago» en el tablero).
- [x] Estados: «Pagó» verde · «Paga hoy» amarillo · «Falta pagar» rojo (pasó la fecha) · «Vencido» violeta (5 días o más). Recordatorios por WhatsApp como hasta ahora.
- [x] Marcar pagó / no pagó con un check (el monto sale del plan), sin cobros duplicados. Editar sigue disponible.
- [x] Formulario nuevo: fecha de pago obligatoria (día 1 a 28 o último día), queda registrada en el alumno (trigger del SQL).
- [?] (Idea futura) Ingreso por profesional del equipo para saber cuánto pagarle a cada uno.

## Tanda 6 — Web / marketplace

- [x] (Web 1) Formulario propio de cada entrenador (preguntas configurables) y botón «Formulario» en la solicitud que manda el link por WhatsApp.
- [x] (Web 2) Casos de éxito: el video se reproduce ahí (YouTube/Instagram) o, si no se puede, foto de portada con «Tocá acá para ver el video del caso».
- [x] (Web 3) En la primera pantalla, junto a «Ver planes», un botón «Ver casos de éxito».
- [x] (Web 4) Etiqueta «Entrenador» de la tarjeta: más contraste.
- [x] (Web 5) Solo el WhatsApp de Tomas Ferster como contacto; el resto de los profesionales sin número por ahora.
- [x] (Web 5) Flujo con otro profesional: Tomas confirma el pago y habilita; al otro profesional le llega «nuevo alumno confirmado». Hecho con supuestos (sin confirmar con el entrenador): en Solicitudes, solo el administrador ve «Pago confirmado»; vale para todo el equipo del envío, pasa las abiertas a «Aceptada» y a cada profesional con cuenta propia le llega una notificación que abre Mi página web. SQL `20261127120000_marketplace_pago_confirmado.sql`.
- [x] (Web 5) Sacar la página web vieja; la nueva es la de «Armá tu equipo».
- [x] (Web 5) Falta la opción de precio «Por sesión».
- [x] (Web 5) El menú de datos y precios del perfil, para cada profesional en su usuario (sin el número por ahora).

Tanda 6 — cómo quedó: SQL `20261126120000_marketplace_formularios.sql` (por sesión + formularios). Pestaña «Formulario» en Mi página web; botón «Formulario» en cada solicitud (manda `/f/<token>` por WhatsApp) y las respuestas se ven desplegando la solicitud. Los videos de YouTube/Instagram/TikTok/Vimeo/Drive se reproducen en la página; si no se puede, botón «Tocá acá para ver el video del caso» (no hizo falta foto de portada). `/form` redirige a `/profesionales` salvo para quien ya estaba inscribiéndose (o `?continuar`).
Después (2026-11-20): «Crear alumno» en una solicitud aceptada abre el alta ya cargada (nombre, email, WhatsApp, notas con plan, objetivo y respuestas, día de pago y cuota si el plan es mensual).

## Notas

- Lo que ya estaba: «Ver como alumno» (vista previa sin guardar) es la base de la Tanda 4.
- Fechas de pago del documento (Tanda 5): Franco Emanuel Chevalley 5 · Yael Domínguez 5 · Braian Ezequiel Etchepare bonificado · Briana Cardozo último día del mes · Lucio Casanave último día (no abonó noviembre) · Agustín Peluffo 10 · Ailin Masdeu 10 · Bianca Anabela Trofelli 1 · Federico Ferster bonificado · Gustavo Cabral 1 · Juliana Caivano 5 · Lujan Ayala 1 · Maria Rosa Villar 1 · Matias Sambran 15 · Santiago Scheifler 10 · Yony Argañaraz 5. Todos abonaron noviembre salvo Lucio.
