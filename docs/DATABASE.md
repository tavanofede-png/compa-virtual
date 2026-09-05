# Datos y autorización

## Fuentes de verdad

student_states: user_id, version, state, updated_at. No accesible directamente por clientes.
operations: clave única (user_id, operation_id), versión aplicada.
point_transactions: libro de movimientos append-only para el cliente, con razón y fecha.

## Proyecciones del agregado

profiles, companions, subjects, weekly_schedule_items, academic_items, study_plans, study_sessions, daily_checkins, study_materials, quiz_sets, quiz_attempts, academic_memories, conversation_messages y notifications.

Cada proyección tiene clave compuesta (user_id, id), JSON de la entidad y updated_at. academic_items y study_materials incluyen subject_id generado y FK compuesta que impide referenciar una materia ajena. Las vistas companion_rooms, study_plan_items, quiz_answers y academic_item_sources usan security_invoker.

El inventario, preferencias, rachas, bonos de corrección y revisiones Leitner permanecen en el agregado. Las preguntas y respuestas correctas se conservan en quiz_sets sin SELECT para clientes; publicSnapshot retira las soluciones. Los intentos contienen el feedback ya mostrado.

## Tablas operativas

- study_material_chunks: dueño, material, ordinal, etiqueta, contenido, vector y tsvector.
- material_jobs: estado, intentos, error recuperable y última actualización.
- devices: tokens Expo, plataforma y habilitación.
- push_deliveries: deduplicación por dispositivo, fecha local y tipo, tickets y receipts.
- consents: versión documental, base aplicable, evidencia y verificación.
- ai_usage: propósito, modelo, tokens y costo cuando se configura una tarifa.
- account_controls: cierre de acceso durante una eliminación.
- learning_methods: catálogo versionado compartido.
- private.ai_leases: una operación IA concurrente por alumno.

## Permisos

RLS está activa en todas las tablas expuestas. Los alumnos solo leen sus proyecciones permitidas y sus archivos. No pueden ejecutar commit_state, search_materials, funciones del worker, colas ni limpieza. Solo service_role ejecuta estas operaciones.

Las URLs de archivos se firman por 60 segundos. Las rutas se construyen con el UUID autenticado y un UUID de material. Una extensión y MIME compatibles se verifican antes de subir; el worker verifica firmas y límites reales.

## Retención y borrado

Chat de 30 días mediante purge_chat_history. La configuración del cron es parte obligatoria del despliegue. El borrado de material elimina archivo, fragmentos por FK y prácticas derivadas; el borrado de cuenta elimina archivos antes del usuario Auth y cascada de tablas. Durante un borrado en curso se bloquean otras operaciones. Un fallo de limpieza exige reintentar; no se reporta éxito antes de finalizar.

## Migraciones

La migración inicial fue creada con Supabase CLI. seed.sql se genera desde el catálogo TypeScript mediante pnpm seed:generate. schedule.sql se aplica después de configurar Vault. No ejecutar sobre un proyecto ajeno.
