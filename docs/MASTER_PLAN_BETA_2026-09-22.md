# Kusiy — Master Product & Implementation Plan

Revisión: **22 de septiembre de 2026**. Integra Daily Guidance y las decisiones confirmadas del piloto. Sustituye recomendaciones del 17 de septiembre que quedaron desactualizadas.

**Entrega documental, no implementación.** Auditoría estática del árbol de trabajo; no certifica producción ni vuelve a ejecutar los tests de la app. No se modifican código, paquetes, assets, migraciones, servicios o flags. Lo propuesto es trabajo pendiente salvo evidencia explícita.

Este es el **único roadmap**, conservando las 29 secciones y los epics existentes. ROADMAP.md será solamente un índice. Las estimaciones son jornadas de trabajo, no resultados ni fechas garantizadas.

## 1. Executive Summary

### Objetivo confirmado

Unos **20 alumnos de 13–18 años de una misma escuela**, idealmente uno o dos cursos cercanos, deben pasar de sus pendientes a una buena sesión terminada y volver con contexto al día siguiente. Android nativo es principal; iOS/web son secundarios y no bloquean noviembre por paridad visual o publicación en tiendas.

- Onboarding breve: compañero, espacio, rutina y contexto académico mínimo; personalización detallada después.
- Precargar **materias y horarios** de St George’s College, C1, grupos 1/2/3, año 2026. El usuario confirmó que no se precargan temarios.
- Sesión libre sin tarea ni plan artificial; mismo historial y progreso.
- Un recordatorio automático diario como máximo; posponer, ignorar, editar/desactivar. Adicionales solo solicitados o configurados expresamente.
- Check-out opcional de un toque y comentario voluntario. Cierre/recompensa no dependen de responderlo.
- Cualquier modificación del plan académico requiere aceptación del alumno.
- Manual, PDF y foto sostienen la beta. Classroom es investigación paralela con cuentas reales; Gmail fuera.
- Conservar identidad y detalle de ocho espacios existentes; una presentación ligera no sustituye sus diseños por habitaciones genéricas.

### Contrato de Beta — noviembre 2026

Alumno elegible con consentimiento verificado: acceso → onboarding → curso confirmado o materias manuales → clases/obligaciones diferenciadas → carga de tarea y PDF/foto → sesión libre o planificada → material/práctica → cierre sin reflexión obligatoria → historial/progreso → aviso autorizado → regreso otro día con estado intacto.

Agenda, sesión y cierre funcionan sin IA, push o 3D. Persistencia, aislamiento y habilitación de menores son gates obligatorios; no activar flags legales para cumplir fecha.

## 2. Auditoría del producto actual

Lectura del árbol local del 22/09 con cambios anteriores sin commit. Código local no equivale a despliegue vigente. Los 82/107 tests de revisiones anteriores no son resultados de esta auditoría.

| Área | Estado | Evidencia archivo:símbolo | Reutilización / faltante |
|---|---|---|---|
| Resumen | Funcional incompleto | packages/domain/src/presentation.ts:homeSummary, nextStudyAction | Sí; falta checklist y libre. |
| Horarios | Funcional incompleto | packages/domain/src/types.ts:WeeklyBlock; packages/domain/src/planner.ts:availableMinutes | Días y altas por fecha; sin rutina/plantilla. |
| Onboarding | Funcional incompleto | apps/web/src/CompanionSetup.tsx; apps/mobile/src/CompanionSetup.tsx; packages/domain/src/commands.ts:onboarding.complete | Reducir personalización obligatoria; migrar pasos. |
| Espacios | Selector funcional; escena de sesión no integrada | packages/domain/src/study-spaces.ts:studySpaces; packages/domain/src/commands.ts:studySpace.select; apps/web/src/StudySpaces.tsx; apps/mobile/src/StudySpaces.tsx | Ocho renders/selección persistida, focus no monta su GLB. |
| Sesión | Funcional incompleto | apps/web/src/Forms.tsx:focus; apps/mobile/app/index.tsx:focus; packages/domain/src/commands.ts:session.complete | Exige slot aceptado; falta libre/inicio/recuperación. |
| Check-out | Funcional incompleto | packages/domain/src/types.ts:StudySession; apps/web/src/Forms.tsx:reflection | Reflexión obligatoria; registra duración planificada. |
| Check-in | Funcional incompleto, función distinta | packages/domain/src/commands.ts:checkin.save | Retrospectivo; puede marcar pendientes, no usar para bienvenida. |
| Recordatorios | Funcional incompleto | packages/domain/src/reminders.ts:dueReminders | Cuatro fuentes automáticas/explícitas; sustituir política. |
| Push/enlaces | Funcional incompleto | packages/server/src/reminders.ts:createReminderHandler; apps/mobile/app/index.tsx:receive | Deduplicación por dispositivo; destino solo view. |
| Biblioteca | Funcional incompleto | packages/domain/src/types.ts:Material, Quiz, Attempt; packages/server/src/material-process.ts:createMaterialProcessHandler | Pipeline/listas existentes; falta vista unificada y relación con sesión. |
| Agente | Funcional incompleto | packages/server/src/agent.ts:buildStudentAgentContext, studentAgentActionSchema, verifiedAgentContent | Contexto/tools/recibos existentes; ampliar. |
| Voz | Funcional incompleto | apps/web/src/useCompanionVoice.ts; packages/domain/src/voice.ts; packages/world3d/src/speech.ts | Voz local y manos libres por turnos; no audio dúplex al modelo. |
| Persistencia | Funcional incompleto | packages/client/src/index.ts; supabase/migrations/20260905043845_foundation.sql:commit_state, study_sessions, operations | Snapshot versionado y proyecciones JSON reutilizables. |
| Consentimiento | Funcional incompleto | packages/domain/src/consent.ts:prepareConsentRecord; packages/server/src/handler.ts:consent.record | Registro pendiente existe; verificación externa falta. |
| Classroom | Solo planificado | packages/domain/src/extensions.ts:ClassroomProvider | Contrato, sin cuentas escolares validadas. |
| Gmail / Focus Reset | Inexistente como feature | Módulos inspeccionados sin integración/recorrido | Fuera de noviembre. |

No declarar production-ready sin recorrido real, dispositivo y evidencia operativa. Salas, mascotas y editor conservan sus gates; este addendum no certifica su finalización.

## 3. Evaluación de las necesidades y prioridades

**A:** necesaria para contrato confirmado. **B:** útil tras A y su gate. **C:** post-beta. **D:** investigación.

| Necesidad nueva | Estado actual | Epic | Nov 2026 / Post-beta | Dependencias | Recomendación |
|---|---|---|---|---|---|
| Loading ropa | Feedback incompleto | B | B / noviembre | Carga cancelable | Último look válido, loader diferido. |
| Espacio en onboarding | Selector persistido | A+B | A presentación; B 3D | Catálogo/runtime | Ocho previews, sin espera obligatoria. |
| Semana/finde | Base por día | A | A / noviembre | Horarios/timezone | Presets y excepciones, no segundo calendario. |
| Daily checklist | Resumen parcial | A | A / noviembre | Datos reales | Inicio, sin popup. |
| Colegio/año/división | Año, sin plantilla | A+0 | A / noviembre | PDF/confirmación | Tres grupos privados/editables. |
| Estudiar/conversar | Accesos existentes | A+J | A / noviembre | Destinos actuales | Sin pantalla de elección ni duplicación. |
| Check-out | Reflexión obligatoria | A+C+E | A / noviembre | Sesión/prácticas | Opcional, señales objetivas primero. |
| Biblioteca 3D | Render/master | B | A preview; B interacción | StudyZone/rendimiento | Reutilizar espacio existente. |
| Biblioteca académica | Materiales/prácticas | A | A base / C avanzada | Pipeline/permisos | Filtros/título/estados, sin repositorio paralelo. |
| Juegos concentración | Inexistente | E | D / C producto | Evidencia/accesibilidad | Fuera de noviembre, sin claims. |
| Notificación→sesión | Enlace a Inicio | A+J+0 | A / noviembre | Preparación/intents | Un aviso, destino revalidado. |
| Classroom | Contrato | F | D paralelo / C runtime | Escuela/OAuth | Experimento readonly no crítico. |
| Gmail | Inexistente | F | D por evidencia | Necesidad exclusiva | Fuera; no solicitar correo. |

Sesión libre es parte de A. Los tres grupos comparten 13 materias, pero cambia su distribución semanal; el PDF no presenta tres temarios curriculares.

### Alcance previo que sigue vigente

Daily Guidance amplía el plan; no borra los frentes anteriores. La selección de ocho espacios, la voz y las herramientas del agente ya tienen código local y sustituyen las conclusiones antiguas que los trataban como ausentes.

| Frente previo | Decisión consolidada |
|---|---|
| Sesión de estudio | Epic A ahora incluye libre/planificada, recuperación y cierre opcional. |
| Espacios personales | Ocho previews en noviembre; interacción por ambiente cuando pase su validación. Dormitorio independiente. |
| Editor de habitaciones | Epic H conserva StudyZone permanente, ghost, snap, apoyos, circulación y layouts. Fuera del trabajo crítico de Daily Guidance. |
| Música y ambiente | Epic D opcional, contenido propio o con licencia; no Spotify/Apple Music como dependencia. |
| Aprendizaje adaptativo | Señales objetivas y Leitner existentes ahora; dominio por concepto solo con taxonomía y evaluación posterior. |
| Progreso | Monedas gastables y XP acumulado existentes; no tercera economía ni logros persistidos nuevos por defecto. |
| Mascotas | Miel actual en dormitorio si pasa rendimiento; expansión de especies/comportamientos conserva su propio gate. No añadir pelo para ocultar problemas anatómicos. |
| Estudio con amigos | Salas/código se conservan; acceso de menores requiere habilitación específica, no se deduce del piloto escolar. |
| Google | Classroom readonly en paralelo con escuela real; Calendar externo posterior; Gmail fuera. |
| Compañero | Chat, voz y herramientas existentes más contexto/preparación; iniciativa controlada y nunca modificaciones de plan sin aceptar. |

## 4. Features que cambiarías

Separar **Tu día** (entrada), **Cómo te fue** (sesión) y **Revisar mi día** (check-in retrospectivo). Permitir libre/plan en un mismo estudio. Sustituir avisos legacy: una fecha de entrega no equivale a pedir push.

Curso como importación explícita/corregible, no deducción por colegio. Escena separada de lógica académica. El LLM explica; no autoriza cambios o recompensas.

## 5. North Star Product Loop

Rutina/entrada voluntaria → Inicio contextual → sesión preparada/libre → estudio/práctica → finalizar → historial/recompensa confirmada/siguiente paso.

Notificación concreta abre preparación tras auth/revalidación, sin intercalar resumen. Conversación desde acceso existente. **Un toque** desde Inicio cargado para sesión preparada; libre con preparación compacta. Espacio/método/ambiente recordados no son pantallas obligatorias.

## 6. Arquitectura futura

Mantener Next.js, Expo, Three.js y domain/client/server/world3d. Sin microservicio por feature.

- Dominio: horario efectivo, resumen, candidato y elegibilidad determinísticos.
- API: mismos comandos, versiones/idempotencia, usuario derivado de auth y recibos reales.
- Sesión individual: activa recuperable y registros finales en Snapshot; sesiones grupales separadas.
- Materiales: pipeline actual; metadata no equivale a lectura del contenido.
- Presentación: cinco destinos, componentes por plataforma, escena desacoplada.
- Entrega push/métricas fuera del Snapshot; ninguna escritura por segundo.

## 7. Dependency Graph

Plantilla/contratos → normalización/comandos → onboarding/Inicio → sesión/cierre → intención/aviso → Android real → piloto.

En paralelo: materiales, presentación, consentimiento y escuela. Classroom/Gmail/juegos/editor fuera de ruta crítica. No enviar avisos antes de preparación/recuperación ni activar plantilla sin comprobar cada celda.

## 8. Epics recomendados

| Epic existente | Trabajo integrado | Prioridad |
|---|---|---|
| 0 Habilitación/menores | Consentimiento, servicios, push, APK, aislamiento | A |
| A Contrato de Estudio | Curso, rutina, onboarding, día, sesiones, biblioteca, cierre/enlaces | A |
| B Mundo estable | Dormitorio vs estudio, ocho previews, runtime/loaders | A presentación / B 3D |
| C Progresión | Libre y cierre idempotente sin reflexión obligatoria | A |
| D Ambiente | Preferencias/audio propio después de A | B |
| E Aprendizaje | Señales existentes; investigación Focus Reset | A señales / C motor / D juegos |
| F Google | Cuentas y readonly | D paralelo / C |
| G Estudio con amigos | Gates actuales; escuela común no autoriza social | Post-beta menores |
| H Mundo construible | StudyZone permanente, editor/ghost/snap/layouts previos | Post-beta |
| I Mascotas | Dormitorio; sin mascotas en espacios individuales | Gate actual |
| J Compañero proactivo | Contexto, preparar por pedido, aviso determinístico | A base / C ampliación |
| K Identidad técnica | Conservar nombre/enlaces; sin rename de paquetes | Posterior |

En C, XP representa acumulado de vida y las compras descuentan monedas; cerrar una sesión no crea una economía adicional. En G, conservar sesiones/grupos privados y sus salas sin activar descubrimiento por colegio ni modificar la habilitación de menores. En I, separar Miel ya integrado de nuevas especies o nuevas acciones aún no validadas. En H, cada distribución guarda sus apoyos y conserva al menos una StudyZone; mover/reemplazar debe validar antes de aplicar.

## 9. Roadmap completo

| Paso | Resultado | Dependencia/gate |
|---|---|---|
| R0 | Plan/grillas y baseline técnica previa al código | Esta entrega es documental; baseline ejecutable pendiente |
| R1 | Modelo/plantilla/rutina/sesión API probados | Compatibilidad snapshots/clientes |
| R2 | Onboarding, curso, calendario y Tu día | Apply atómico, plan protegido |
| R3 | Libre/plan, biblioteca, cierre/recuperación | Android/web; cerrar una vez |
| R4 | Aviso, snooze y apertura preparada | R3 + Android físico |
| R5 | Agente ampliado y espacio en sesión | Tools verificadas y fallback |
| R6 | Cohorte técnica → ~20 alumnos elegibles | Consentimiento, dispositivos, soporte |
| Opcional | Audio propio y más escenas interactivas | Después de A, sin bloquear estudio |
| Post-beta/2027 | Biblioteca avanzada, conceptos, editor/social por gates | Evidencia del piloto |
| Paralelo | Classroom y evidencia Focus Reset | Sin bloquear noviembre |

Reservar dos semanas previas a apertura para correcciones/dispositivos. Si no hay margen retirar opcionales B/C, nunca permisos, persistencia o sesión libre.

Reingreso post-beta: E requiere casos pedagógicos y datos suficientes; F, cuentas y autorización escolar; G, moderación/privacidad y prueba adulta; H, espacio y editor con StudyZone comprobada; I, especie anatómicamente correcta y acciones seguras en Android; J ampliado, valor observado y opt-out; K, beta estable y compatibilidad de enlaces/builds. Cada frente entra por su propia evidencia; no adelanta automáticamente los demás.

## 10. Modelo de datos

### Contratos mínimos

| Interfaz | Cambio decidido |
|---|---|
| SchoolCourseTemplate | Catálogo estático versionado: institución, C1/grupo/ciclo, hash, materias/semana; sin alumnos/docentes. |
| AcademicContext | Selección privada, versión/confirmación y mapping a materias propias; opcional fuera del piloto. |
| Subject / WeeklyBlock | Origen de plantilla/clave estable, aliases explícitos; materia opcional, tipo clase/recreo/almuerzo/común. |
| StudyRoutine | Hora/activación semana/finde, overrides por día y referencias a ventanas AVAILABLE confirmadas. |
| ScheduleException | Fecha y IDs recurrentes omitidos; altas por fecha reutilizan WeeklyBlock.exception_date. |
| StudySessionDraft | Preparación derivada: origen, objetivo/materia, minutos, método, material/práctica y preferencias. |
| ActiveStudySession | Una activa/cuenta; ID estable, running/paused, inicio, intervalo abierto/segundos acumulados y referencias. |
| StudySession | Final libre/plan; slot/item opcionales, materia/objetivo, duración prevista/registrada y su base, método, fechas/prácticas/feedback. |
| SessionFeedback | EASY/OK/HARD/VERY_HARD, comentario y objetivo logrado opcionales; nunca condición de cierre. |
| NotificationIntent | ID, rutina/explícito, fechas local/UTC/expiración, destino propio, snooze/dismiss; push transporta IDs. |
| StudyPreferences | Foco/habitación y preferencias recordadas. activeStudySpaceId sigue canónico. |
| DailyGuidance | Vista derivada; persistir solo fecha local de exposición/dismiss, no duplicar pendientes diarios. |

### Compatibilidad

- Nuevos campos opcionales y normalización común en Repository/servidor. Historial final en sessions, activo separado.
- Proyección study_sessions JSON ampliable sin tabla especial para libres.
- Históricos conservan duración planificada y duration_basis=legacy_planned. Nuevos guardan segundos registrados; no inventar duración real histórica.
- Slot/item nulos para libre; materia opcional en repaso general. Sin materias/tareas de relleno.
- Planner descuenta esfuerzo solo por vínculo explícito al ítem; misma materia no completa tareas.
- Onboarding con ID de paso/versión; convertir índices previos preservando perfil/personaje/ropa/cuarto. Cuentas completas no repiten.
- exception_date hoy solo agrega; la nueva excepción debe cancelar recurrencia para feriados/vacaciones.
- Plantilla compartida nunca concede acceso a cuentas de compañeros.

Conservar Profile, Companion, inventario, monedas/XP, mascotas y sus preferencias dentro de sus contratos actuales. Grupos/sesiones compartidas y sus tablas permanecen fuera del Snapshot individual. Cámara, ghost, rutas y countdown son estado de presentación, no registros continuos. ConceptMastery/LearningObservation, CompanionSuggestion, RoomLayout/PlacedObject y AcademicIntegration/ExternalAssignment se incorporarán en sus epics si su evidencia justifica persistencia; no se crean ahora por anticipación. AmbiencePreset comienza con preferencias y referencias a audio existente, sin un nuevo servicio.

### Fuente escolar y límites

**horarios año 1.pdf**, una página, St George’s College, C1, 2026. SHA-256: c046355cab4371fe607d30b23c61c0acf6d1bbe177bcc9cef90a48b9187b49ef.

Se compararon texto y página renderizada para resolver celdas combinadas. Sin deducir sede, temarios, feriados o alumnos. Etiquetas iniciales: **C1 · Grupo 1/2/3**. Las letras A/C/F/L en tutoría/Wellbeing son otra agrupación, no se asignan por grupo numérico.

13 materias originales: English, Spanish, Maths, Science, Geography, History, D.Tech, Art, Theatre, Music, Mandarin, PE, SEL. Preservar nombre con traducción auxiliar inequívoca/aliases explícitos. Science no se separa en Biología/Física/Química por aulas Bio/Phy/Che. SEL conserva sigla hasta dato oficial.

Tutoring, Wellbeing Projects, Flag, Assembly y Tutorial Period son actividades escolares, no tareas ni materias nuevas. No almacenar iniciales docentes.

### Periodos

| Periodo | Hora local |
|---|---|
| P1 | 08:15–09:05 |
| P2 | 09:05–09:55 |
| P3 | 10:10–11:00 |
| P4 | 11:00–11:50 |
| P5 | 12:10–13:00 |
| P6 | 13:55–14:45 |
| P7 | 14:45–15:35 |
| P8 | 15:35–16:20 |

Todos los días: inicio 08:00–08:15; recreos 09:55–10:10 y 11:50–12:10; almuerzo 13:00–13:55. Inicio: lunes Flag; martes/miércoles/viernes Tutorial Period; jueves Assembly. Jueves P1 Tutoring; viernes P8 Wellbeing Projects. PE común lunes P7–P8 y miércoles P6–P8.

La unión de bloques ocupa 08:00–16:20; recreos/almuerzo no se ofrecen como estudio. No añadir otro evento de asistencia superpuesto.

### C1 · Grupo 1

| Día | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 |
|---|---|---|---|---|---|---|---|---|
| Lunes | English | English | Maths | Maths | D.Tech | D.Tech | PE | PE |
| Martes | Art | Art | Geography | Geography | SEL | History | History | Maths |
| Miércoles | Spanish | Science | Science | English | English | PE | PE | PE |
| Jueves | Tutoring | Theatre | Theatre | History | Spanish | Music | Music | Science |
| Viernes | Mandarin | Geography | Maths | Science | English | Spanish | Spanish | Wellbeing Projects |

### C1 · Grupo 2

| Día | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 |
|---|---|---|---|---|---|---|---|---|
| Lunes | Spanish | Spanish | Geography | Geography | History | English | PE | PE |
| Martes | Science | Theatre | Theatre | Spanish | SEL | Geography | Maths | English |
| Miércoles | Maths | Maths | History | History | English | PE | PE | PE |
| Jueves | Tutoring | Art | Art | Music | Music | Science | English | English |
| Viernes | Spanish | Maths | Mandarin | D.Tech | D.Tech | Science | Science | Wellbeing Projects |

### C1 · Grupo 3

| Día | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 |
|---|---|---|---|---|---|---|---|---|
| Lunes | English | English | D.Tech | D.Tech | Science | History | PE | PE |
| Martes | English | Spanish | Spanish | Maths | SEL | Geography | Science | Science |
| Miércoles | Spanish | Spanish | Art | Art | Science | PE | PE | PE |
| Jueves | Tutoring | Music | Music | Theatre | Theatre | English | Maths | Maths |
| Viernes | English | History | History | Geography | Geography | Mandarin | Maths | Wellbeing Projects |

**Controles:** 40 periodos y 1.975 minutos por grupo. P8 dura 45 min, no 50. Cada grupo: 5 English, 4 Spanish, 4 Maths, 4 Science, 3 Geography, 3 History, 2 D.Tech, 2 Art, 2 Theatre, 2 Music, 1 Mandarin, 5 PE, 1 SEL, 1 Tutoring y 1 Wellbeing. Incluyendo inicio/recreos/almuerzo: 60 segmentos y 2.500 minutos semanales. Agrupar clases contiguas visualmente no absorbe recreos.

### Aplicación y cambio

1. Grupo → preview materias/semana → **Usar este horario**; corrección antes/después y alternativa manual.
2. Operación atómica/versionada con claves de origen estables. Repetir o usar dos dispositivos no duplica.
3. Reutilizar materias por identidad/alias explícito; ambigüedad resuelta en preview, sin fuzzy merge destructivo.
4. Cambio de grupo con diff; conserva materias/tareas/apuntes/sesiones/ediciones propias. Reemplaza solo bloques de plantilla autorizados.
5. Conflictos con plan aceptado generan propuesta. Mantener plan hasta aceptación y no sugerir como válido un bloque ahora incompatible.
6. Plantilla 2026 no se prolonga automáticamente a 2027. Feriados/suspensiones requieren excepción confirmada.
7. IDs estables st-georges-c1-2026-g1/g2/g3, versión 1; etiquetas oficiales corregibles sin cambiar IDs.
8. **Desvincular colegio/curso:** preview y confirmación propios, sin eliminar cuenta. Por defecto conserva las materias y convierte el horario en bloques manuales, retirando identificadores escolares del contexto activo; puede elegir quitar solo futuros bloques procedentes de la plantilla. Conserva tareas, materiales, sesiones y cambios manuales. Las materias en uso nunca se borran en cascada. Ofrecer replanificación ante conflictos, siempre con aceptación separada. El catálogo genérico permanece; las métricas no registran identidad escolar.

## 11. Cambios de backend

### Comandos

- academicContext.preview/apply/clear: plantilla resuelta en servidor, diff/aplicación o desvinculación atómica. JSON del cliente no prueba oficialidad. clear exige la decisión explícita de conservar como manual o quitar futuros bloques de plantilla.
- studyRoutine.save y schedule.exception.save: mismo resolutor de horarios para planner/reminders.
- session.prepare: lectura sin escritura. session.start/pause/resume/complete/cancel: sesión individual. Cierre legacy por slot conservado, con identidad/recompensa compartida.
- session.feedback: corrección de valoración después de cerrar sin premio nuevo; cierre también admite feedback opcional.
- reminder.snooze/dismiss y ajustes por canal actual; sin Edge Function por feature.

### Persistencia

Una sesión activa/cuenta; segunda apertura continúa la misma o requiere cerrar/cancelar. Finalización repetida, incluso con otro operation ID, devuelve cierre existente sin monedas nuevas.

Snapshot/commit_state/ledger canónicos. Normalización sin borrar keys nuevas con clientes antiguos. Migraciones aditivas solo para intents/claims de avisos, referencia desde push_deliveries, actividad de dispositivo y métricas mínimas. Sesiones siguen JSON.

Grants explícitos, RLS y tests por propietario. Procesos internos sin escritura pública. Export/delete cubren nuevos datos. No panel escolar ni acceso de docentes por seleccionar curso.

### Materiales

Pipeline actual para PDF texto/escaneado y JPG/PNG. Estados claros, reintento seguro, URL firmada renovable, errores ilegible/cifrado. Sesión puede seguir con original o sin archivo mientras procesa. No citar texto todavía no extraído.

## 12. Cambios web

- Cinco destinos: Inicio/Tu día; Estudiar/libre/preparada/biblioteca/espacios; Compa/chat/personalización. Un acceso por función.
- Reemplazar focus acoplado a PlanSlot por sesión común con preparación/timer/método/material/cierre.
- Agenda distingue clases, obligaciones y sesiones con etiqueta/icono además de color. Curso no crea tareas falsas.
- Biblioteca por título, materia/tipo/estado; originales y prácticas con IDs existentes. Sin repositorio ni búsqueda semántica global nueva.
- Enlace ?view=study&intent=<id> tras login; conservar room/today/mobile-preview. Enlace no inicia timer.
- Voz/chat se mantienen; Web Push no bloquea beta, avisos in-app y enlaces HTTPS sí.

## 13. Cambios mobile

- Android usa mismos tipos/comandos. Sesión a pantalla completa; hojas para elecciones breves.
- Controles de al menos 48 px, teclado, lector de pantalla, áreas seguras y texto ampliado.
- Mantener scheme compavirtual://; interpretar intención, esperar auth/snapshot y consumir response una sola vez.
- Push validado con build interno y Android físico; no Expo Go/marco web como certificado. [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/).
- Background pausa el 3D, no supone que dejó de estudiar. Timer por timestamps/transiciones, sin escritura por tick.
- Borrador local/operación pendiente por cuenta sin red; estado visible, premio/celebración tras servidor.
- iOS: build/smoke cuando haya equipo; TestFlight/paridad visual no bloquean noviembre.

## 14. Cambios 3D

- Dormitorio con mascota/descanso vs espacio individual con compañero/StudyZone sin mascota; selecciones independientes.
- Presentación sceneKind bedroom/study, studySpaceId, capacidad preview/interactive. Nunca dormitorio recoloreado como sustituto.
- Ocho previews inmediatas; un GLB activo, cancelación/liberación. Biblioteca primero interactiva, después QA por espacio.
- Escena de estudio requiere spawn/asiento/mesa/aproximación válidos; no copiar anchors de dormitorio.
- Ante fallo/peso: render fiel y presentación del compañero separada del material; no movimiento sobre decorado sin mapa. Estudio no espera.
- Loader de ropa después de 300 ms; último look válido, descarte de respuestas viejas, error/reintento. Sin progreso ficticio.
- Maestros detallados intactos; optimización posterior comparada con vistas principales.

## 15. AI architecture

Mantener proveedor configurable/clave única de servidor existentes; no cambiar proveedor ni tratar voz como inexistente.

- Determinístico: contexto, elegibilidad, prioridad temporal, conflictos/candidato.
- Adaptación básica: errores/repasos por materia/tema y dificultad adicional; sin dominio inventado.
- LLM: explicar/conversar y traducir pedidos a herramientas; no aceptar planes ni decidir pushes/premios.

Contexto incluye curso confirmado, horario efectivo, rutina, sesión, pendientes y señales pertinentes. Colegio/códigos docentes/grupos pastorales fuera del prompt por defecto. Materiales/recuerdos son datos, no instrucciones.

Herramientas: preparar sesión, consultar material, guardar rutina solicitada, snooze/desactivar. Cambiar curso/replanificar produce propuesta. El agente no concluye que estudió por conversar ni cierra sesiones para cobrar.

“Repasar Biología 20 minutos”: preparación sin tarea. Si no existe materia, conservar objetivo y permitir asociación o repaso sin materia; no mapear automáticamente a Science.

Mantener envío inmediato/pensando/error recuperable, retrieval selectivo y recibos antes de anunciar éxito. Sin LLM por cron ni copiar todos los apuntes por turno. Voz comparte permisos.

Antes de habilitar IA a alumnos, ejecutar chat/extracción/quiz con proveedor y modelo reales usando datos ficticios según [PEDAGOGICAL_EVALS.md](PEDAGOGICAL_EVALS.md). Registrar modelo, prompt, fecha y evaluación humana. Ampliar casos para sesión libre, materia inexistente, creación solicitada, fuente en cola y propuesta que no puede aceptarse sola. Los mocks y las pruebas de permisos no sustituyen esta evaluación; si falla, conservar estudio manual y desactivar la capacidad concreta.

## 16. Integraciones externas

### Classroom

| Etiqueta | Estado/decisión |
|---|---|
| confirmed | Scopes readonly separados para cursos/trabajo propio/materiales. CourseWork tiene deadlines opcionales expresados en UTC. |
| confirmed | Workspace for Education requiere configuración administrativa para acceso de apps de menores. |
| assumption | Escuela podría facilitar cuentas; el PDF no prueba uso de Classroom o autorización OAuth. |
| proposal | Experimento readonly con importación revisable/origen/clave externa; sin modificar Classroom. |
| unknown | Cuentas, administrador/OU, Cloud project, scopes aprobados y permisos de adjuntos. |

Fuentes oficiales consultadas: [scopes](https://developers.google.com/workspace/classroom/guides/auth), [CourseWork](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork), [administrador](https://developers.google.com/workspace/classroom/guides/key-concepts/admin-actions), [materiales](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWorkMaterials/list).

Scopes candidatos: classroom.courses.readonly, classroom.coursework.me.readonly y classroom.courseworkmaterials.readonly. Otros solo por endpoint probado; sin roster/emails de compañeros/escritura. Adjuntos Drive requieren permiso propio; enlace no garantiza lectura. Preservar ausencia de deadline y convertir UTC correctamente.

### Gmail, Calendar e infraestructura

Gmail fuera salvo evidencia de información académica importante exclusiva del correo no resoluble mejor. Calendar externo no es requisito de la grilla propia de Kusiy.

Vercel/Supabase/worker/EAS se conservan; baseline técnica verifica estado remoto, no lo asume por docs. Nuevas tablas con grants/RLS explícitos; revisar cambios de exposición de Data API antes de noviembre. [Supabase changelog](https://supabase.com/changelog), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). No activar integraciones en esta entrega.

## 17. UX flows

### Onboarding

Tras acceso/edad/consentimiento: compañero → espacio → rutina/contexto mínimo → Inicio. Rutina/contexto comparten pantalla resumida con edición progresiva. Colegio piloto, grupo, revisión y confirmación; alternativa “Mi horario es otro”.

Ropa/dormitorio reciben defaults existentes compatibles, editables después. Sin pasos obligatorios mascota/música/decoración. Omitir rutina deja avisos apagados, no configuración falsamente aceptada.

### Tu día

Máximo tres pendientes con materia/motivo/fecha y “Ver agenda”. Minutos del plan aceptado separados de sugeridos. Procedencia manual/plantilla/importado/propuesta IA visible; inferencias no se vuelven tareas.

Timezone del perfil define día. Resumen siempre accesible, destaque máximo diario y actualización inline sin popup. Ya estudió: avance real. Sin pendientes: libre o cargar actividad. Mantener saludo sin manito y controles depurados.

### Preparación y sesión

Prioridad: continuar activa; bloque válido de hoy; Leitner vencido; obligación próxima como propuesta libre; libre. Obligaciones ordenadas por fecha, prioridad, dificultad, ID estable. No mover plan aceptado.

Preparación: materia/objetivo, minutos, método/material. Heredar método del bloque; libre usa último compatible o recuperación activa. Default 25 minutos, editable 1–180; pedido explícito prevalece. Espacio/modo bajo “Cambiar”.

Timer orientativo por intervalos menos pausas; continúa con pantalla bloqueada hasta objetivo previsto. A cero deja de acumular indefinidamente: extender explícitamente, cerrar o pausar. Mide tiempo registrado, no atención; tras interrupción mostrar intervalo y permitir corregir tiempo incierto.

Foco inicial, habitación elegible/recordada. Abrir práctica conserva session_id, timer y regreso. IA, GLB o archivo en cola no bloquean empezar.

### Cierre y señales

Finalizar registra sesión; Fácil/Bien/Me costó/Muy difícil y comentario opcionales antes/después. Omitir significa null, no “Bien”.

Mantener +10 por sesión libre/plan completada una vez por ID con inicio/cierre válido; no depende de reflexión, tiempo mínimo nuevo ni resultado perfecto. Cancelar no cobra ni descuenta. Cliente muestra delta confirmado. No introducir límite económico oculto; evaluar balance/abusos en piloto antes de cambiar reglas.

Prácticas relacionan session_id; errores por pregunta/tema complementan dificultad. “Me costó” sin práctica sugiere repasar objetivo, no inventa errores. Libre no completa slots/tareas por coincidencia de materia; replanificación siempre propuesta.

### Rutina y avisos

- Propuesta visible: entre semana a las 17:30 con ventana de 60 min; fin de semana a las 10:30 con ventana de 90 min. Ambos permanecen apagados hasta confirmar. No guardar disponibilidad ni activar aviso sin confirmar. Overrides por día desde horarios.
- Timezone del perfil canónica, propuesta Buenos Aires; cambiarla recalcula futuro, no historial. Zona escolar también visible/corregible antes de aplicar plantilla.
- Máximo un evento rutinario por usuario/fecha local. Solo habilitado, con propuesta útil y sin sesión ya estudiada en su ventana habitual. Activa/sueño/silencio/clase/ocupación/día desactivado suprimen aviso; contexto queda en Inicio.
- Elegibilidad hora habitual hasta +30 min; cron tardío no descarga atrasados. Vencimientos sin push salvo configuración explícita.
- Un intent/notificación interna y push al dispositivo principal: default último habilitado/activo, editable. No push por cada dispositivo.
- Claim usuario/fecha antes de envío; timeout ambiguo no reenvía ciegamente.
- Posponer 15/30/60 min u hora válida, pedido explícito; reemplaza anterior. Incompatibilidad con silencio/ocupación se explica y ofrece alternativa. Ignorar descarta el día sin penalidad.
- Migrar política: quitar automáticos slots/vencimientos/check-in; conservar explícitos. Si origen legacy desconocido, revisar ajustes inline sin bloquear estudio, no presumir solicitud.
- Tap recupera intención propia/recalcula. Caducado/completado/plan cambiado: explicación breve y siguiente preparación válida; nunca ejecutar automáticamente. Rutina expira al fin del día local.

## 18. Assets necesarios

Reutilizar renders/personajes/tipografía/iconos/dormitorio, añadiendo solo estados UI faltantes. Sin catálogo nuevo para Daily Guidance.

Escena interactiva requiere manifest, escala/encuadre, StudyZone/anchors y presupuesto medido. Conservar fuentes previas. Audio opcional solo con licencia documentada; no ofrecer presets vacíos.

## 19. Performance budgets

Objetivos por medir, no resultados de esta revisión.

| Área | Gate |
|---|---|
| Inicio | Datos/acción antes de escena, sin bloqueo IA |
| Preparada | Un toque; preparación ≤2 s p95 con estado actualizado/red estable |
| 3D | Objetivo 30 FPS; p95 ≤33 ms en gama media/actual |
| Android bajo | Foco/render ligero útil sin cierres por memoria |
| Background | Mixers/render detenidos, timer timestamps, sin escrituras por tick |
| Cambio espacio | Un GLB activo; 10 cambios sin crecimiento sostenido de memoria |
| API/Snapshot | Medir bytes/latencia con piloto antes de refactor |
| Recomendación | Sin llamada LLM por apertura/cron |

Registrar modelo/RAM/Android/build/red/pasos. Memoria/carga fría por equipo. Variante técnica ligera conserva identidad; no altera maestros.

## 20. Privacy & security

- Colegio/grupo privados; sin discovery social ni listas de compañeros.
- Catálogo sin docentes/alumnos; PDF no publicado íntegro ni enviado al LLM.
- Consentimiento/flags fail-closed. Registro pendiente no prueba identidad parental; verificar por vía independiente.
- IDs propios por auth; enlace no da permiso. RLS/grants probados con dos cuentas/anónimo.
- Export incluye contexto/rutina/ediciones/sesiones/feedback. Delete incluye intents/entregas/eventos; no borra catálogo genérico.
- Push genérico por defecto en pantalla bloqueada; detalles in-app. Sin apuntes/reflexión/chat en métricas/logs.
- Eventos mínimos, retención de 30 días y acceso interno/consentimiento; sin publicidad ni grabación de pantalla.
- Focus Reset en investigación sin beneficios clínicos/pedagógicos afirmados.

La habilitación conserva las condiciones de [GATE0.md](GATE0.md): revisión de proveedor/modelo y contrato para datos de menores, consentimiento verificable, evaluación pedagógica y autorización del piloto. MINOR_BETA_APPROVED y AI_MINOR_DATA_APPROVED son controles técnicos, no evidencia contractual. Si se usa la vía OpenAI/ZDR, OPENAI_ZDR_VERIFIED exige respaldo del proveedor: store:false no prueba Zero Data Retention. Verificar retención, tratamiento y transferencias de los proveedores efectivamente desplegados; no asumir OpenAI cuando la configuración usa Cloudflare.

[PRIVACY-DRAFT.md](PRIVACY-DRAFT.md) sigue siendo borrador hasta revisión: completar titular, contacto/canal de derechos, consentimiento, conservación y transferencias internacionales. Verificar borrado de originales, URLs/objetos huérfanos e índices, además de filas. No habilitar grupos de menores mediante el consentimiento académico genérico. Estos son gates del proyecto; su cumplimiento no se afirma en esta auditoría documental.

## 21. Testing

### Dominio y datos

- Grillas: 13 materias/40 periodos/1.975 min, 60 segmentos/2.500 min; P8 de 45 min, celdas dobles/recreos correctos.
- Apply/repetir/cambiar con aliases/datos previos/dos dispositivos; sin duplicar/borrar/aceptar planes.
- Desvincular curso conservando horario manual o quitando bloques futuros; sin pérdida de tareas/apuntes/historial ni modificación automática de planes.
- Semana/finde/excepciones, medianoche, cambio timezone, DST en zona de prueba, silencio cruzado y jornada escolar.
- Libre sin tarea/materia opcional y objetivo dictado; sin ítems artificiales.
- Inicio simultáneo, pausa/reanudar, app cerrada/red perdida, práctica durante sesión y duración legacy/registrada.
- Cierre/feedback tardío sin premio doble; omitir/valorar/comentar mantiene premio. Libre no completa tarea ajena.
- Proyecciones/ledger/normalización con clientes viejos; export/delete/accesos cruzados.

### Experiencia y dispositivo

- Onboarding nuevo/legacy/completo, curso corregible, entrada sin decoración/avisos.
- Inicio vacío/activa/día terminado/vencimiento; sin popup/CTA duplicada.
- Tap frío/caliente/login, intent consumido/ajeno/caducado, tarea hecha/plan sustituido.
- PDF/foto listo/fallido/ilegible/cifrado, URL vencida/reintento, propiedad correcta.
- Agente prepara/propone sin saltar aceptación; PDF no da instrucciones; éxito solo con recibos.
- Evals pedagógicos con modelo real y datos ficticios, revisión de chat/extracción/quiz y evidencia según PEDAGOGICAL_EVALS.md.
- Ocho espacios/foco, ropa rápida/lenta/error/race; pausa escena y sin mascota en estudio.
- Android bajo/medio/actual; 360/390/430 px, teclado, áreas seguras, texto ampliado y lector. Browser no sustituye APK.

Typecheck/lint/tests dominio/API/DB/builds y E2E con cuentas ficticias acceso→curso→sesión→cierre→día siguiente. No tests cosméticos que reflejen implementación.

## 22. Gates de validación

| Feature noviembre | PASS | FAIL: corregir | FAIL sostenido: simplificar |
|---|---|---|---|
| Acceso/menores | Consentimiento verificable/aislamiento | Operación/permiso | Solo adultos de prueba |
| Plantilla | Grillas exactas, apply editable/idempotente | Celda/merge/origen | Tabla revisada y carga manual, no error importado |
| Onboarding | Estudio sin personalización, recovery | Pasos/pérdida | Defaults editables |
| Tu día/estudiar-chat | Datos reales/accesos únicos | CTA falsa/repetida | Lista + libre + chat actual |
| Rutina | Respeta escuela/sueño/fecha | Solapamiento/activación implícita | Manual, automatismo defectuoso apagado |
| Sesión | Libre/plan cierran una vez | Dependencia slot/pérdida/duplicación | UI mínima; persistencia no se elimina |
| Check-out | Omitir no afecta cierre/premio | Reflexión exigida | Quitar pregunta, mantener señales |
| Biblioteca | Archivo propio/estados/reintento | Cola/permisos/texto | Original/manual, sin fingir procesamiento |
| Aviso→sesión | ≤1 diario y Android correcto | Duplicación/silencio/enlace | Sin push, tarjeta; gate push no aprobado |
| Espacio | Selección independiente/fiel | Dormitorio/mascota erróneo/bloqueo | Render aprobado y foco |
| Loader B | Sin flicker, último look válido | Vacío/race | Render/reintento |
| IA | Contexto/tools verificados | Invención/no solicitado | Tool defectuosa apagada, estudio manual |
| Android | Útil en tres gamas | Cierre/teclado/fuga | Perfil ligero, no recortar permisos/datos |

Fallback no es PASS de feature retirada. Registrar recorte y alternativa en contrato; no presentar funciones desactivadas como terminadas.

### Gates transversales conservados

| Gate | PASS con evidencia | FAIL y alternativa |
|---|---|---|
| 0 Operación | APK instala; adulto de prueba completa el recorrido dos días; PDF/foto procesa; cron/intent funciona sin duplicar; secretos ausentes de bundles | Corregir operaciones y mantener cuentas ficticias; un despliegue exitoso no basta. |
| Legal/alumnos | Consentimiento verificado, proveedor/retención/transferencias revisados, política/canal de derechos y habilitación del piloto | Solo pruebas adultas; mover cohorte si persiste. No bajar controles para cumplir noviembre. |
| IA pedagógica | Chat/extract/quiz pasan casos con modelo real y datos ficticios, incluida autonomía y citas | Corregir capacidad; si persiste, apagar IA generativa afectada y conservar estudio/manual. |
| Dormitorio/mascota | Cuarto + compañero + Miel estable en Android objetivo sin degradar el estudio; acciones/colisiones comprobadas | Perfil reducido o mascota quieta; después opción de ocultar. Si no alcanza, render fiel. No certificar mascota viva por mostrar un modelo. |
| Social/Meet | Prueba privada adulta, permisos/invitaciones y salas estables; menores además con aprobación específica y moderación | Mantener deshabilitado para menores. No activar COLLABORATION_ENABLED para la cohorte por tener tablas o modelos. |
| Classroom | Escuela/cuentas/admin y OAuth autorizados; lectura de curso, material y tarea reales, importación revisable sin duplicados | Manual/PDF/foto; trabajo paralelo o pospuesto. |
| Audio | Licencia documentada, play/pause/volúmenes y silencio funcionan durante sesión | Solo foreground si falla background; retirar audio opcional si persiste. |
| Editor H | StudyZone válida antes/después; ghost + snap + icono/mensaje verde/rojo; apoyos/rutas y deshacer sin corrupción | Corregir colocación; conservar distribución válida y posponer editor, no guardar escenas inutilizables. |
| Expansión I | Anatomía fiel de cada especie, contactos y navegación sin atravesar muebles, recursos liberados y prueba Android | Revisar modelo/mapas/animaciones antes de ampliar catálogo visible. Sin suplir anatomía con pelo. |
| E/J ampliados | Casos pedagógicos aprobados, observaciones objetivas, sugerencias útiles y opt-out; no claims de dominio sin evidencia | Conservar heurísticas actuales y sugerencias determinísticas; sin pushes de engagement. |

## 23. Riesgos

| Riesgo | Resolución |
|---|---|
| Horario como temario | Solo materias/clases, temas del alumno |
| Grupos 1/2/3 vs A/C/F/L | IDs independientes, tutoría común |
| Horario viejo | Ciclo/versión/revisión y diff |
| Avisos sumados a legacy | Sustituir política/tests negativos |
| Premios duplicados | Una activa/ID/ledger/cierre servidor |
| Tiempo como atención | Etiqueta registrado/corrección/basis |
| Escenas pesadas | Preview/carga selectiva/fallback |
| IA lenta | Resumen determinístico/retrieval selectivo |
| Importación cambia plan | Conflicto/propuesta/aceptación |
| Consentimiento tarda | Adultos ficticios, gate para alumnos |
| Identificación escolar | Datos privados mínimos, sin uso social |

## 24. Qué NO construir todavía

Gmail; Classroom sin cuentas; sincronización Calendar; temarios inventados; arcade/claims; nueva economía/castigos; editor/producción nueva de muebles dentro de Daily Guidance; proveedor IA nuevo/voz dúplex de pago; rename técnico; ranking/discovery escolar; acceso automático de docentes a datos privados.

Conservar especificaciones previas de mascotas/salas/StudyZone/ghost/snap para sus epics sin confundirlas con este cierre.

## 25. Estimación

| Paquete | Jornadas | Resultado |
|---|---:|---|
| Baseline/fixtures escuela | 2–3 | Evidencia/catálogo |
| Modelo/compatibilidad/API | 4–6 | Dominio probado |
| Onboarding/calendario/Inicio | 4–6 | Clientes coherentes |
| Sesión/biblioteca/cierre | 5–8 | Libre/plan recuperables |
| Avisos/deep links | 3–5 | Intent/claim/snooze/Android |
| Agente | 2–3 | Tools/contexto |
| Previews/fallback/loaders | 2–3 | Ocho identidades sin bloqueo |
| QA integrada/dispositivos | 5–8 | Evidencia/release candidate |

**Base 27–42 jornadas**, sin paralelismo ni espera legal/escolar/equipos. Ocho GLB interactivos completos, audio nuevo y Classroom no están absorbidos; estimarlos al pasar gate dentro de este documento. No prometer fecha dividiendo entre agentes.

### Estimaciones anteriores de frentes opcionales y posteriores

Se conservan como referencia histórica del plan del 17/09, en **sesiones de trabajo asistido de 2–4 horas**, no jornadas. No sumarlas al subtotal anterior ni usarlas como presupuesto vigente: hay código nuevo y alcance que requieren una nueva estimación al reingresar.

| Epic | Rango histórico | Condición para reestimar |
|---|---:|---|
| D Audio mínimo | 14–23 sesiones | Licencias, foreground Android y alcance de presets. |
| E Heurísticas | 12–20 | Taxonomía/casos pedagógicos y evidencia del piloto. |
| F Classroom | 16–28 | Cuentas, OAuth y permisos reales; esperas escolares aparte. |
| G Social menores | 12–22 | Legal/moderación y salas en equipos reales; código existente no cierra el gate. |
| H Destino + colocador | 24–40 | Reauditar editor/layouts y assets actuales; arte detallado aparte. |
| I Mascota viva | 16–30 | Reestimar por especie/animación/mapa; el antiguo supuesto de fur queda descartado. |
| J Proactividad ampliada | 10–18 | Descontar contexto/tools/avisos básicos incluidos ahora; evaluar nuevas sugerencias. |
| K Identidad de código | 6–10 | EAS, bundle IDs, scheme y enlaces heredados. |

La estimación de Daily Guidance incluye pruebas de las funciones modificadas; no equivale a certificar toda la producción artística o integración social anterior. Separar esfuerzo de ingeniería, revisión artística, evaluación pedagógica y espera legal/dispositivos al comprometer cada paquete.

## 26. Ruta crítica

Contrato/plantilla → modelo → sesión/cierre → Android → aviso/recuperación → QA/consentimiento → piloto.

Materiales/consentimiento en paralelo. IA caída admite manual; ownership/consentimiento fallido no autoriza alumnos. No bloquean Classroom/Gmail/editor/audio/GLB completo/tiendas. Sí bloquea anunciar capacidad inexistente.

## 27. Trabajo paralelizable

| Frente | Paralelo con | Contrato |
|---|---|---|
| Plantillas | Sesiones/UI | IDs/procedencia/grillas §10 |
| API | Clientes | Draft/activo/final/confirmaciones |
| Android/web | Entre sí tras tipos | Mismos comandos/errores |
| Notificaciones | Biblioteca/3D | Envío después de R3 |
| Materiales/IA | Plantillas/UI | Permisos/fuentes |
| Espacios | Dominio/backend | Identidad/anchors propios |
| Escuela/consentimiento | Todo | Evidencia, no inferir flags |

Integración verifica estado/CTAs sin duplicar. Ningún frente cambia unilateralmente plan aceptado o permisos.

## 28. Orden final recomendado

1. Fixtures escolares y baseline real.
2. Normalización/contratos curso-rutina-sesión.
3. Importación/onboarding/Inicio.
4. Libre/plan, materiales y cierre opcional.
5. Política avisos y enlaces Android.
6. Contexto/tools y espacio durante estudio.
7. QA tres gamas/correcciones.
8. Piloto elegible; observar dos semanas antes de ampliar.

### Métricas de utilidad

Eventos no derivables: impresión de resumen, preparación abierta/origen y abandono. Sesiones/prácticas/cierres desde datos canónicos; eventos sin textos/colegio.

Medir pasos/tiempo hasta empezar; libres/planificadas completadas por semana; aviso→sesión útil, snooze/optout/duplicados; recuperación sin pérdida; sugerencias basadas en señales utilizadas y archivos recuperados. No optimizar pushes/aperturas/minutos atrapados.

## 29. Plan ejecutable

### Paquetes y terminado

- **A1 Curso:** tres grupos exactos/13 materias, preview/apply/procedencia/cambio reversible/plan protegido.
- **A2 Rutina/día:** resolutor/excepciones/presets/resumen y libre/preparada.
- **A3 Sesión:** inicio/pausa/reanudar/cierre/recuperación, método/material/práctica y feedback opcional.
- **A4 Biblioteca:** búsqueda/filtros/estados actuales sin duplicar archivos/quizzes.
- **A5/J1 Avisos:** un evento rutinario, configuración explícita/snooze/dismiss/intent propio/Android.
- **J2 Agente:** contexto/herramientas/recibos y aceptación de propuestas.
- **B1 Visual:** ocho selecciones persistidas/fieles; biblioteca interactiva primero bajo gate.
- **C1 Progreso:** historial una vez, duración honesta y +10 por cierre; omitir feedback sin efecto.
- **0/QA:** APK, cuentas ficticias, consentimiento independiente, tres gamas y evidencia.

### Rollout

Backend compatible/migraciones aditivas en prueba → clientes internos/QA → cohorte. Mantener endpoints/snapshots legacy. Rollback desactiva nuevas entradas/envíos y vuelve a cliente estable sin borrar datos; no migración destructiva.

Marcar implementado solo con código/pruebas/gate. Esta edición documental no equivale a implementación. Mantener ROADMAP.md como índice y actualizar las 29 secciones cuando cambie evidencia.

### Pendientes externos

- Modelos Android, participantes, fecha apertura y soporte.
- Nombre oficial/sede/grupos, vigencia y calendario de excepciones; plantilla especificada como St George’s College · C1 · Grupo 1/2/3 · 2026 y revisión del alumno.
- Consentimiento/contratos/proveedor para alumnos; bloquea habilitación, no desarrollo con datos ficticios.
- Cuentas/administrador Workspace para experimento, sin bloquear beta.

### Defaults reversibles cerrados

Buenos Aires propuesto; nombres originales/aliases explícitos; sin docentes; sesión libre de 25 min si no se especifica; foco inicial; biblioteca si omite espacio; rutina apagada hasta confirmar; sugerencia entre semana 17:30 y fin de semana 10:30; checkout opcional; chat existente; cambios de plan aceptados.

Las decisiones del usuario prevalecen sobre recomendaciones antiguas. No reabrir por conveniencia técnica; registrar evidencia nueva en esta fuente única.
