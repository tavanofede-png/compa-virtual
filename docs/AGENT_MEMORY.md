# Agente académico: contexto privado y memoria editable

Estado al 26 de septiembre de 2026: continuación local de E5. No certifica llamadas al modelo real, aislamiento transversal de servicios ni funcionamiento en Android físico. La versión pública conserva el despliegue E3; esta API local depende además de la actualización coordinada de materiales v2.

## Contexto de una consulta

El servidor obtiene únicamente el agregado de la cuenta autenticada. El agente conserva acceso contextual a materias, horarios, actividades, planes, materiales y señales de sesiones; recibe un resumen, nunca una copia ilimitada de la cuenta.

- Se priorizan tareas y recuerdos que coinciden con la consulta. La selección textual es determinística; no usa otra llamada de IA ni embeddings para recuerdos.
- Hasta 30 actividades, 12 recuerdos, 60 materias y 80 bloques. El presupuesto de contexto reduce listas si el resumen supera aproximadamente 24.000 caracteres. La cuenta original permanece intacta.
- Hasta dos planes, con próximos 20 bloques cada uno y diez obligaciones todavía sin ubicar. No se interpreta la ausencia de un registro como inexistencia.
- Los recuerdos se abrevian a 800 caracteres y las descripciones a 300; se marca `content_truncated`. El historial enviado incluye hasta doce intervenciones de 1.000 caracteres, sin recibos ni efectos de operaciones.
- El modelo recibe contadores de registros incluidos/totales y sabe que el resumen es incompleto. Debe aclarar una identidad ambigua en lugar de inventar IDs.
- La rutina diaria y el estado de la sesión activa están presentes. No se envía el ID de instalación que controla la sesión.
- Los originales y sus rutas privadas no forman parte del contexto. El contenido del material solo entra mediante fragmentos recuperados y citas verificadas.
- La información social se limita a estados, cantidades, horarios y tipo de sala. No se envían nombres de participantes/grupos, autores de invitaciones, objetivos ni títulos de encuentros. Tampoco se envía texto de notificaciones, que podría contener datos de terceros.

Los textos del alumno y los fragmentos siguen siendo datos no confiables. Acotar el contexto no constituye por sí solo una defensa completa contra prompt injection ni demuestra calidad pedagógica.

## Memoria

Los nuevos recuerdos registran origen (`MANUAL` o `COMPANION`), fechas y último editor. Un recuerdo solicitado en la conversación guarda el ID de la intervención propia que lo originó. Ese ID lo asigna el servidor; un comando manual no puede falsificarlo.

Web y Android muestran la procedencia. Mientras el mensaje continúe dentro del historial reciente, se puede consultar el pedido original. Después de treinta días el recuerdo mantiene su origen, pero no conserva una copia oculta del mensaje vencido.

Editar conserva el origen y marca que el alumno lo corrigió. Borrar retira el recuerdo de futuras selecciones; no borra el historial reciente, que se gestiona por separado. La exportación del agregado incluye esta metadata y la eliminación de cuenta elimina el agregado. Los recuerdos históricos sin procedencia siguen editables y se identifican como tales; no se les inventa un origen.

Se permiten hasta cien recuerdos nuevos. Una colección heredada mayor no se recorta automáticamente: permite editar o borrar hasta reducirla. El recuerdo conserva como máximo 4.000 caracteres, aunque la consulta use un extracto menor.

## Acciones y rutina

Las herramientas siguen usando los mismos comandos de dominio que la UI: materias, actividades, horarios, propuesta de plan, personalización disponible, recuerdos y avisos. Los recibos se entregan después del commit versionado. El modelo no puede aceptar planes, cerrar sesiones, gastar monedas, otorgar permisos ni ejecutar SQL.

`set_study_routine` configura o desactiva el único aviso diario cuando el alumno lo solicita. Respeta descanso y No molestar; no fabrica siete recordatorios semanales. `set_notification_preferences` preserva la rutina existente al cambiar otros ajustes. La entrega push sigue dependiendo del scheduler y de las pruebas Android pendientes.

Al regresar una respuesta de chat, la API vuelve a comprobar la autorización de IA antes de aplicar las acciones. Esta comprobación no sustituye el gate G1: queda pendiente verificar la revocación transversal y las carreras con servicios/directos a tablas.

## Verificación pendiente

Los tests locales cubren selección relevante sin mutación, presupuesto, exclusión de terceros, procedencia no falsificable, edición/eliminación, colecciones históricas y rutina sin pushes duplicados. No verifican interpretación semántica del proveedor real.

Antes de aprobar E5 faltan evaluación pedagógica en español, pedidos ambiguos, propuestas que exigen aceptación, contenido hostil en materiales/historial, control de autorizaciones durante una consulta y recibos reales con varias cuentas. Estas pruebas y los dispositivos se mantienen en la revisión final acordada; E5 sigue en curso.
