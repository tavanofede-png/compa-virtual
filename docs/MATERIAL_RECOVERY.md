# Materiales: procesamiento durable v2

Estado al 26 de septiembre de 2026: implementación local, migración preparada y bundles Edge generados. **Esta versión no está activada en Supabase/Render/Vercel.** Requiere una actualización coordinada del worker; desplegar únicamente la migración interrumpe el consumidor anterior. Las pruebas físicas y con archivos de alumnos quedan para la revisión final acordada.

## Qué cambia

- Carga privada y confirmación separadas. Una subida interrumpida se muestra como `UPLOADING`; volver a subir el mismo archivo recupera su recibo. No se presenta como un trabajo eternamente en cola.
- Límite de 25 MB, 100 páginas por PDF, 36 megapíxeles por imagen, 50 archivos y 250 MiB por cuenta por defecto (`MATERIAL_STORAGE_QUOTA_MIB`). Validación de extensión/MIME, firma, tamaño y formato real. El servidor comprueba que el objeto haya terminado de subirse.
- Extracción nativa de PDF/DOCX/TXT sin un proveedor de IA configurado. El worker puede arrancar sin clave de IA. OCR e indexación son fases independientes, sujetas a autorización y disponibilidad.
- Checkpoints de páginas y lotes de embeddings. Reintentar evita repetir OCR ya guardado y solicita únicamente los vectores faltantes. El texto se guarda antes de indexar.
- Estado de texto completo/parcial independiente de búsqueda avanzada. La lectura de texto es paginada. El agente recibe la limitación del texto parcial y puede utilizar búsqueda textual si falla la consulta vectorial.
- Cancelar conserva el original y el texto existente. El reintento reutiliza lo recuperable. Los resultados de generaciones canceladas, vencidas o reemplazadas no se aceptan.
- Eliminación transaccional del agregado, derivados y mensajes con citas; remoción de Storage con cola de limpieza durable si falla. El worker reintenta la limpieza. El cierre de una cuenta conserva su procedimiento de eliminación de todos los objetos.
- Web abre la pestaña original dentro del gesto del usuario antes de solicitar la URL firmada; evita el bloqueo de ventanas por esperar la respuesta de red. La URL se emite por API autenticada tras comprobar propiedad y permisos.
- Panel MFA: trabajos paginados, fases, intentos, progreso, posibles huérfanos y limpieza pendiente. Reintentos con motivo y recibo idempotente. No se muestra contenido de apuntes ni originales.

## Contratos y control del trabajo

`material_jobs` conserva una fila por cuenta/material. La v2 añade `generation`, `lease_token`, `lease_expires_at`, `queue_message_id`, fase, progreso, disponibilidad de texto y estado de indexación.

Una generación es una ejecución solicitada explícitamente. Cada claim usa una nueva lease, incluso en un reintento automático de la misma generación. Las escrituras comprueban **ambas identidades y su vigencia** dentro de una transacción corta, con el mismo orden de locks que `commit_state`. No se mantiene una transacción abierta durante PDF/OCR/IA.

- Lease: 120 segundos, heartbeat cada 30 segundos, visibilidad renovada de la cola.
- Máximo de tres claims por generación; un tercer intento que muere sin cerrar también se vuelve fallo recuperable al siguiente claim.
- Reintento automático con espera de 30/60 segundos y checkpoints. Un error documental definitivo detiene los reintentos automáticos.
- Límite por claim: 20 minutos; apagar el proceso libera ejecución local y deja recuperar la lease vencida. El resultado tardío de una llamada externa no se guarda después de cancelar.
- El heartbeat actualiza solo el trabajo. La versión académica cambia en hitos, no cada segundo ni en cada página.
- Falta de IA, permiso de IA o presupuesto no elimina texto nativo ni original. Mantiene una explicación y permite reintentar cuando corresponda. No cambia de proveedor automáticamente.
- Lectura/cancelación/reintentos de materiales requieren autorización del servicio. Enviar contenido a OCR/embeddings exige además autorización de IA y habilitación del proveedor para menores. Se revalidan antes de cada llamada; una petición ya enviada no puede retirarse del proveedor.

`read_material_job_v2`, `material_job_event`, `material_enqueue_v2`, `material_cancel_v2`, `material_delete_v2` y `operator_retry_material` son RPC privadas para `service_role`. Checkpoints, limpieza y auditoría técnica tienen RLS y ningún acceso directo anónimo/autenticado. La API deriva el propietario del JWT; el panel añade allowlist y MFA. No se envían tokens de lease al alumno.

Los ordinales de los chunks dependen de la página/sección. Una página que se recupera mediante OCR no desplaza las referencias de otras páginas; los chunks existentes conservan su ID cuando se actualiza su contenido. La exportación propia incluye texto/checkpoints y excluye embeddings.

Referencia de transporte: [PGMQ de Supabase](https://supabase.com/docs/guides/queues/pgmq). Las comprobaciones PostgreSQL locales prueban transacciones, RLS y fencing; el transporte PGMQ real sigue pendiente.

## Actualización coordinada

1. Conservar artefactos de la versión actual y comprobar acceso real a Render y Supabase. Preparar un entorno separado para la comprobación remota.
2. Pausar el consumidor anterior. No ejecutar dos versiones contra la misma cola.
3. Aplicar `20260926031249_material_recovery.sql`. La lectura/fin antiguos quedan deliberadamente inactivos; los clientes antiguos pueden seguir encolando por el wrapper compatible.
4. Publicar los bundles de `api` y `material-process`, y el worker v2. Las funciones familiares/reminders no cambian su comportamiento en esta fase.
5. Al arrancar, el worker convierte mensajes heredados a generaciones v2 bajo lock. La cola debe recuperar también originales pendientes de remoción.
6. Publicar web y un binario/actualización Android compatibles. Verificar que el servidor actualizado ofrece las nuevas acciones antes de distribuir el cliente.
7. Ejecutar la matriz remota de aprobación y registrar la versión concreta. Tener código local y HTTP 200 no aprueba E4/G3.

Si falla la actualización, pausar el consumidor y aplicar una corrección compatible hacia adelante. No volver a arrancar el worker antiguo esperando que escriba sobre trabajos v2. La migración no se revierte con borrado de tablas/checkpoints.

## Pendiente de aprobación

PDF nativo y escaneado, imagen real, original antes/después de fallo, texto parcial, cancelar durante OCR/indexación, reiniciar worker en mitad de una página/lote, resultado tardío, agotamiento de intentos, reintento operativo, eliminación con Storage caído, aislamiento de dos cuentas y revocación familiar. Falta además ejecutar estos recorridos en Android y demostrar que el worker remoto opera esta misma versión.

G1 todavía necesita la auditoría transversal de accesos directos a Storage/tablas y clientes que permanecen abiertos. No se afirma que esta fase haya certificado todo el sistema de permisos ni la operación productiva.
