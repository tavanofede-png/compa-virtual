# Kusiy 1.0 — Master Plan de producción

Contrato aprobado por el responsable del producto el 23 de septiembre de 2026. **No fija fecha de entrega.** El plan anterior se conserva como [referencia histórica](./MASTER_PLAN_BETA_2026-09-22.md); sus fechas, previews como entrega final y postergación de salas/chat no rigen este contrato. Este documento especifica el objetivo; el estado de cada gate requiere evidencia real, no se deduce de su presencia aquí.

## 1. Executive Summary

Kusiy 1.0 estará listo cuando un alumno de 13–18 años autorizado pueda instalar Android desde Play, entrar, estudiar solo o en un encuentro privado, regresar y continuar, y cuando el administrador opere familias, soporte y seguridad desde un panel sin SQL habitual. Argentina, acceso por invitación, primera cohorte de aproximadamente 20 alumnos. Android es principal, web complementaria e iOS posterior. Son obligatorios ocho espacios individuales 3D, seis salas compartidas, encuentros de hasta seis, chat del encuentro, IA académica, voz por frases con Whisper gratuito de Cloudflare y TTS del dispositivo. No hay mensajes privados ni llamadas entre alumnos. El presupuesto previsto es USD 100–300/mes, sin autorizar compras.

## 2. Auditoría del producto actual

El árbol local previo a esta ejecución aprobó typecheck, lint, 108 tests en 17 archivos y build web. Esa evidencia no certifica despliegue, dispositivos ni producción. Existen contratos Supabase, agencia académica, selector de ocho espacios, seis salas y 16 personajes; los espacios individuales aún necesitan integrarse como escenas de estudio y el backend social rechaza menores. No habilitar menores retirando ese rechazo sin autorización familiar y operación social. Voz web y APK local no prueban voz nativa ni distribución Play. Los GLB individuales medidos rondan 19,7–133,9 MiB y las salas reducidas 14,4–45,9 MiB. Registrar nuevas comprobaciones en [GATE0.md](./GATE0.md) y en los gates de este plan.

## 3. Evaluación de necesidades y prioridades

Tres frentes obligatorios avanzan en paralelo tras contratos comunes: valor académico (cuenta, agenda, sesiones, materiales, práctica, IA, progreso), experiencia (compañero, 16 personajes, ocho espacios y seis salas con chat), y producción (permisos, moderación, panel, monitoreo, restauración y Play). Escuela y Classroom son opcionales. No se aprueba un frente por una imagen, un endpoint aislado o mocks.

## 4. Features que cambiaríamos

Unificar estudio libre y planificado; preparar/iniciar/pausar/reanudar/cerrar, con valoración voluntaria. Mantener resumen diario en Inicio y check-in retrospectivo separado. El agente afirma éxito solo con recibo del servidor. Separar dormitorio, espacio individual sin mascota y sala grupal. Mantener una ubicación principal por función. Permisos independientes para servicio, IA, social y avisos. El editor completo queda para ampliación.

## 5. North Star Product Loop

- Individual: Inicio → estudio libre o siguiente bloque → estudiar/practicar → cerrar → historial/recompensa → próximo paso.
- Grupal: Estudiar → Juntos → grupo/invitación → encuentro → trabajo individual acompañado → cierre personal.
- Compañero: texto o voz → respuesta con contexto propio → acción explícita confirmada o propuesta revisable.

Medir sesiones útiles, recuperación, materiales utilizables y continuidad; no aperturas vacías ni exceso de pushes.

## 6. Arquitectura futura

Conservar Next.js, Expo/React Native, Three.js, Supabase y paquetes compartidos. `student_states` sigue agregado académico canónico. Chat, presencia, trabajos y auditoría usan tablas paginadas. Dominio valida reglas; servidor autoriza y transacciona; cliente conserva versión y operaciones pendientes; worker procesa trabajos durables; World3D carga, pausa y libera. La IA no decide permisos, cupos, recompensas ni aceptación de planes.

## 7. Dependency Graph

Contratos, entornos, identidad y autorizaciones habilitan core académico/materiales/IA/voz, runtime 3D/espacios/salas, y social/chat/moderación/panel. La integración Android, seguridad, rendimiento y recuperación unen los tres frentes antes de pruebas cerradas y producción por invitación. Play, dispositivos y revisión legal arrancan en paralelo.

## 8. Epics recomendados

| Epic               | Entrega aprobable                                            |
| ------------------ | ------------------------------------------------------------ |
| E1 Base            | Entornos reproducibles, contratos y deuda inventariada       |
| E2 Académico       | Estudio libre/planificado, rutina, progreso y Daily Guidance |
| E3 Cuenta          | Auth, autorización familiar, revocación y ciclo de datos     |
| E4 Materiales      | Biblioteca y procesamiento durable/recuperable               |
| E5 IA/práctica     | Herramientas reales, memoria privada y evaluación            |
| E6 Voz             | Whisper gratuito y diálogo por frases en Android             |
| E7 Runtime 3D      | Manifiestos, perfiles, caché, cancelación y liberación       |
| E8 Espacios        | Ocho escenas con StudyZone e interacción                     |
| E9 Encuentros      | Grupos, invitaciones, cupos, host y timer                    |
| E10 Salas          | Seis escenas con seis avatares y ropa guardada               |
| E11 Chat/seguridad | Chat, reportes, bloqueo, moderación y panel                  |
| E12 Avisos         | Rutina → push → sesión revalidada                            |
| E13 Operación      | CI, alertas, backups, restore, versiones y rollback          |
| E14 Release        | QA, tres gamas Android y Google Play                         |

Cada epic incluye permisos, persistencia, error, recuperación, tests y soporte.

## 9. Roadmap completo

Base verificable → recorrido académico → materiales/IA/voz/avisos → ocho espacios → encuentros y seis salas → chat/operación → integración y gates → pruebas internas y cerradas → Play → cohortes invitadas. Los tracks se solapan cuando comparten contratos ya fijados. No convertir un fallback en entrega aprobada.

## 10. Modelo de datos

Agregar `AcademicContext`, `StudyRoutine`, `PreparedStudySession`, `ActiveStudySession`, `StudySession`, `SessionFeedback`, `NotificationIntent`, `FamilyAuthorization`, `CapabilityGrant`, `GroupChatMessage`, `SafetyReport`, `UserBlock`, `ModerationAction`, `AssetManifest`, `SceneQualityProfile`, `ClientCompatibility`, `SupportTicket` y `OperationalIncident` conforme avance cada epic. Mantener `Repository`, `Snapshot`, `Companion`, IDs y comandos idempotentes. Migraciones aditivas. Sesiones históricas conservan duración planificada sin atribuirles tiempo real. Posición, ruta, animación y countdown no se persisten.

### Plantilla escolar opcional verificada

La fuente histórica fue **horarios año 1.pdf**, una página, St George’s College C1 2026, SHA-256 `c046355cab4371fe607d30b23c61c0acf6d1bbe177bcc9cef90a48b9187b49ef`. Los tres grupos comparten 13 materias; cambia el horario, no se infieren tres temarios. Sin deducir sede, alumnos, docentes ni feriados. La importación muestra preview y diferencias, se acepta explícitamente, es idempotente y nunca borra tareas, materiales o historial. `Science` no se subdivide por aulas; las letras A/C/F/L de tutoría no equivalen a grupos numéricos.

Periodos locales: P1 08:15–09:05, P2 09:05–09:55, P3 10:10–11:00, P4 11:00–11:50, P5 12:10–13:00, P6 13:55–14:45, P7 14:45–15:35, P8 15:35–16:20. Inicio 08:00–08:15; recreos 09:55–10:10 y 11:50–12:10; almuerzo 13:00–13:55. Inicio: lunes Flag; martes/miércoles/viernes Tutorial Period; jueves Assembly. Jueves P1 Tutoring; viernes P8 Wellbeing Projects. PE común lunes P7–P8 y miércoles P6–P8.

| C1 Grupo 1 | P1       | P2        | P3        | P4        | P5      | P6      | P7      | P8                 |
| ---------- | -------- | --------- | --------- | --------- | ------- | ------- | ------- | ------------------ |
| Lunes      | English  | English   | Maths     | Maths     | D.Tech  | D.Tech  | PE      | PE                 |
| Martes     | Art      | Art       | Geography | Geography | SEL     | History | History | Maths              |
| Miércoles  | Spanish  | Science   | Science   | English   | English | PE      | PE      | PE                 |
| Jueves     | Tutoring | Theatre   | Theatre   | History   | Spanish | Music   | Music   | Science            |
| Viernes    | Mandarin | Geography | Maths     | Science   | English | Spanish | Spanish | Wellbeing Projects |

| C1 Grupo 2 | P1       | P2      | P3        | P4        | P5      | P6        | P7      | P8                 |
| ---------- | -------- | ------- | --------- | --------- | ------- | --------- | ------- | ------------------ |
| Lunes      | Spanish  | Spanish | Geography | Geography | History | English   | PE      | PE                 |
| Martes     | Science  | Theatre | Theatre   | Spanish   | SEL     | Geography | Maths   | English            |
| Miércoles  | Maths    | Maths   | History   | History   | English | PE        | PE      | PE                 |
| Jueves     | Tutoring | Art     | Art       | Music     | Music   | Science   | English | English            |
| Viernes    | Spanish  | Maths   | Mandarin  | D.Tech    | D.Tech  | Science   | Science | Wellbeing Projects |

| C1 Grupo 3 | P1       | P2      | P3      | P4        | P5        | P6        | P7      | P8                 |
| ---------- | -------- | ------- | ------- | --------- | --------- | --------- | ------- | ------------------ |
| Lunes      | English  | English | D.Tech  | D.Tech    | Science   | History   | PE      | PE                 |
| Martes     | English  | Spanish | Spanish | Maths     | SEL       | Geography | Science | Science            |
| Miércoles  | Spanish  | Spanish | Art     | Art       | Science   | PE        | PE      | PE                 |
| Jueves     | Tutoring | Music   | Music   | Theatre   | Theatre   | English   | Maths   | Maths              |
| Viernes    | English  | History | History | Geography | Geography | Mandarin  | Maths   | Wellbeing Projects |

Control: 40 periodos y 1.975 minutos por grupo; P8 dura 45 minutos. IDs estables `st-georges-c1-2026-g1/g2/g3`, versión 1. No prolongar automáticamente a otro ciclo. Desvincular conserva materias en uso, tareas y materiales, con preview de futuros bloques y plan sujeto a aceptación.

## 11. Cambios de backend

Sesiones: una activa confirmada por cuenta; otro dispositivo ve el estado o toma control explícitamente. Preparar, iniciar, pausar, continuar y completar son comandos versionados. El cierre/recompensa es idempotente; valoración omitida o difícil no altera monedas. Cierre offline queda pendiente sin anunciar premio. Materiales: endpoints encolan y worker procesa con checkpoints, lease, timeout, reintentos, cancelación y detección de huérfanos; archivo original siempre accesible al propietario. Límites actuales 25 MB/100 páginas. Encuentros: membresía, seis plazas incluidas reservas, asientos, host y timer autoritativos; presencia efímera separada de participación. No premiar ingreso ni completar estudio al cerrar la sala.

## 12. Cambios web

Conservar landing, acceso, recuperación y enlaces. Panel con usuarios, familias, cohortes, autorizaciones, suspensión, reportes, evidencia restringida, ocultación de mensajes, cierre de encuentros, trabajos fallidos, salud, versiones, tickets e incidentes. MFA y roles aplicados por servidor; registrar acciones. Ayuda, privacidad y solicitud de eliminación públicas.

## 13. Cambios mobile

Navegación Inicio, Agenda, Estudiar, Logros, Compa; onboarding breve; credenciales seguras y caché separada por cuenta. Recuperar sesión, operación pendiente y destino tras cerrar proceso. Acciones académicas fuera del lienzo 3D. Perfiles development/staging/production y builds firmados AAB. Antes de la primera carga Play fijar `com.kusiy.estudio` y esquema `kusiy`; conservar `compavirtual` como alias. No renombrar `@compa/*` cosméticamente.

## 14. Cambios 3D

Montar Biblioteca, Terraza, Pérgola, Café, Minimalista, Tecnológico, Pabellón y Ático como GLB reales en estudio, con cámara, personaje/ropa, StudyZone, asiento/aproximación y objetos coherentes; sin mascotas. Montar Living, Estudio, Biblioteca, Proyectos, Patio y Terraza de aprendizaje con hasta seis avatares autorizados. Sin paseo libre multijugador simulado. Publicar variantes MASTER/RUNTIME/REDUCED y fallback 2D con checksums. Los tres Android de prueba deben ejecutar los 14 en algún perfil 3D aprobado; 2D permite estudiar pero no aprueba la escena.

## 15. AI architecture

Contexto selectivo del alumno: materias, horarios, calendario, materiales, sesiones y preferencias, con memoria editable y origen. Herramientas usan los mismos comandos que la UI; solicitudes explícitas de materia/tarea se ejecutan con recibo del servidor. Planes requieren aceptación; datos ambiguos se aclaran. No enviar datos de otros alumnos, secretos ni roles administrativos al modelo. Contenido del usuario/materiales nunca es instrucción privilegiada. Adaptador actual de texto permanece; OpenAI queda opcional, sin cambio automático de proveedor, gasto o política.

Voz: micrófono → pausa/frase → Whisper `@cf/openai/whisper-large-v3-turbo` por proxy autenticado → agente → TTS del dispositivo → volver a escuchar. No se anuncia como dúplex nativo. Estado escuchando/transcribiendo/pensando/hablando/reconectando; interrupción y micrófono apagado en background. No almacenar audio. Cuota gratuita compartida: reserva, límite inicial de diez minutos/alumno/día y tope global; sin facturación ni fallback pago. Agotamiento conserva texto y lectura por voz.

## 16. Integraciones externas

Presupuesto de planificación, no compra: Supabase USD 45–60, worker USD 25–50, web/correo/backups/monitoreo USD 20–55, IA/OCR USD 0–60, builds USD 0–25, margen USD 10–50. Alertas al 70% y 90%; nunca detener guardado académico por generación visual. Classroom readonly y paralelo solo con escuela/cuentas/OAuth/consentimiento reales; Gmail fuera. Agenda propia sin Google Calendar.

## 17. UX flows

Invitación → verificación → edad/autorización → compañero → espacio → año/materias → rutina breve → Inicio. Ropa/dormitorio/decoración después. Estudio libre permite objetivo y materia opcional, default editable 25 minutos; foco o habitación visible con última preferencia. Valoración final de un toque o salto. Un aviso automático diario como máximo, activado expresamente y posponible 15/30/60 minutos; otros avisos solo por solicitud o actividad configurada. El toque revalida cuenta, permiso y destino.

## 18. Assets necesarios

Manifiestos/checksums/variantes de ocho espacios y seis salas, cámaras, StudyZones, asientos y obstáculos; 16 personajes y ropa guardada; expresiones/habla; previews y arte Play real; licencias de modelos, fuentes, imágenes y audio. Conservar maestros detallados y revisar dormitorios/mascotas existentes sin regeneración masiva. El [manifiesto de fuentes individuales](../design/personal-spaces-v1/data/asset-manifest.json) se genera con `pnpm assets:study-manifest` y deja explícito que todavía faltan variantes runtime y certificación Android.

## 19. Performance budgets

Objetivos iniciales: una escena activa; hasta 30 FPS, p95 cercano a 33 ms; caché 3D default 250 MiB; carga caliente ≤3 s, primera individual ≤8 s y sala con seis ≤15 s en red 20 Mbps; sin crecimiento sostenido tras 20 entradas/salidas; API no generativa p95 ≤1 s, chat ≤2 s, primera voz ≤6 s. Medir MiB, triángulos, draw calls, RAM/PSS, frame time y temperatura en Android bajo/medio/actual. Reducir por medición y memoria, no solo user-agent.

## 20. Privacy & security

Verificación del adulto por contacto independiente desde panel; email verificado no prueba parentesco. Evidencia mínima, permisos versionados por finalidad, revocación efectiva sin acceso automático a apuntes/conversaciones del alumno. Chat plano del encuentro ≤1.000 caracteres, sin archivos/enlaces clicables; filtros, rate limits, reportar, bloquear y salir. Bloqueo oculta contenido e impide invitaciones/copresencia; no expulsa unilateralmente. Alto riesgo retenido para revisión. Fallo de protección deja chat en solo lectura. Chat disponible todo el día, revisión humana diaria y alertas prioritarias; no prometer respuesta humana inmediata 24 horas. Retenciones iniciales para revisión legal: chat/conversación 30 días, reportes 90, logs 30. Sin contenido académico, audio o mensajes en analytics.

## 21. Testing

Unitarias de reglas, permisos, rutina y recompensas; integración con comandos/materiales/IA/push; RLS de dos usuarios, anónimo, menor revocado y admin; concurrencia de plaza/asiento/host/cierre/bloqueo; 20 cuentas en 6+6+6+2; Realtime con reconexión/cursor; IA adversarial/ambigüedades; voz con ruido, eco, cuota y background; 14 escenas/ropa/liberación; 360/390/430 px, TalkBack y texto ampliado; worker caído, restore, upgrade y redes inestables. Tres Android físicos de distintas gamas son obligatorios.

## 22. Gates de validación

| Gate             | Evidencia necesaria                              |
| ---------------- | ------------------------------------------------ |
| G0 Base          | Builds reproducibles y staging aislado           |
| G1 Cuenta        | Registro, familia, revocación y aislamiento      |
| G2 Académico     | Libre/planificado, práctica y cierre recuperable |
| G3 Materiales/IA | Procesamiento, herramientas y evaluación         |
| G4 Voz           | Manos libres Android, permisos y cuota           |
| G5 Espacios      | Ocho escenas 3D certificadas                     |
| G6 Social        | Plazas/host/seis avatares/progreso individual    |
| G7 Chat          | Reportar/bloquear/moderar/contener               |
| G8 Operación     | Alertas, restore, rollback, soporte              |
| G9 Android       | Tres gamas, instalación y actualización Play     |
| G10 Legal/Store  | Documentos, proveedores y Play aprobados         |
| G11 Producción   | Recorridos reales y salud observada              |

Un fallo mantiene el gate pendiente y activa contención; no se etiqueta como entrega terminada.

## 23. Riesgos

Assets pesados: benchmark temprano y perfiles. Moderador único: retención, alertas y contención. Cuota de voz: límite global y texto disponible. Consentimiento: verificación independiente. Duplicaciones: transacciones/idempotencia. Clientes viejos: compatibilidad/versión mínima. Worker: checkpoints/leases. Archivos: backup Storage separado. Play/legal: pista externa sin promesa de fecha. Entorno local y remoto: inventario de versiones.

## 24. Qué NO construir todavía

Editor completo, nuevas familias de mascotas, matchmaking público, mensajes privados/llamadas alumno-alumno, paseo libre multijugador, Gmail, Classroom obligatorio, pagos/ads, arcade, claims clínicos, iOS como gate Android, voz premium o clonada. El editor posterior conserva StudyZone permanente, ghost preview, snap, verde/rojo accesible, apoyos, rutas, deshacer y distribuciones.

## 25. Estimación

Estimación de planificación: 208–352 sesiones de agente de 2–4 horas distribuidas en E1–E14, con incertidumbre alta en permisos/familias, voz, 3D, social y Play. No constituye compromiso temporal. Registrar por epic trabajo, evidencia, dependencia externa y estado. Esperas de proveedor/Play, revisión jurídica, familias y operación humana quedan fuera.

## 26. Ruta crítica

Base/identidad → cuenta autorizada y estudio recuperable → materiales/IA → runtime 3D → ocho espacios/seis salas → chat/moderación → seguridad/rendimiento/restore → Android firmado/Play → cohorte. Medir temprano la escena y sala más pesadas y voz Android.

## 27. Trabajo paralelizable

Académico, IA/materiales, 3D, social, operación y QA/legal/store comparten contratos de sesión, permisos, manifiestos y versiones. Integrar contratos antes de ramas dependientes; migraciones y agregado académico tienen un responsable único de integración.

## 28. Orden final recomendado

Local/development/staging/production separados, flags de servidor y compatibilidad con versión anterior durante rollout. Sentry JS/nativo sin replay ni contenido, logs estructurados y alertas accionables. Backup diario de base y objetos por separado, copias externas cifradas 30 días; RPO inicial 24 h y objetivo RTO 8 h desde activar recuperación, sujetos a demostración. Restore aislado verifica revocaciones/borrados y no repite premios. Rollback por artefacto/OTA/manifest compatible; Android detiene rollout y corrige hacia delante. Play interno → cerrado → producción invitada, con firma, target SDK, 16 KB, Data Safety, privacidad y requisitos de testers verificados.

## 29. Plan ejecutable

Este archivo es la fuente del contrato; [ROADMAP.md](./ROADMAP.md) es índice y [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md) registra evidencia y pendientes. Cada epic entrega código/migraciones, pruebas de permisos/error/recuperación, evidencia Android cuando corresponda, telemetría y soporte. Estados permitidos: pendiente, en curso, bloqueado por dependencia externa, aprobado con evidencia. Pendientes externos: identidad legal, revisión profesional, procedimiento familiar, condiciones de proveedores, dominio/correo, tres teléfonos, cuenta Play/firma, familias/testers y operación de reportes. **KUSIY PRODUCTION READY** requiere G0–G11 aprobados y un alumno autorizado y administrador completando recorridos reales sin SQL habitual.
