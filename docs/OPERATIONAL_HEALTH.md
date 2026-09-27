# Señales operativas internas

La migración `20260927020000_operational_health.sql` guarda el último latido del worker de materiales y calcula señales sin contenido de alumnos. El worker envía un latido al iniciar y cada minuto, incluso mientras procesa un documento. `pg_cron`, si está disponible, ejecuta el escaneo cada cinco minutos. El panel `/admin` también lo ejecuta al abrir o actualizar **Estado operativo**; requiere allowlist y MFA.

| Señal | Condición | Primera respuesta |
|---|---|---|
| Worker sin latido | Más de 3 minutos desde el último latido registrado | Revisar proceso/servicio y la migración; evitar reencolar masivamente. |
| Material estancado | Fase activa sin actualización en 15 minutos | Abrir **Materiales y recuperación**; comprobar lease y worker. |
| Material fallido | Algún trabajo en fase `FAILED` tras agotar tres intentos de procesamiento | Revisar el error y reintentar con motivo cuando sea seguro. Los rechazos del documento al primer intento y la indexación opcional no disponible permanecen visibles al alumno, pero no abren esta alerta de infraestructura. |
| Borrado pendiente | Objeto marcado para eliminación hace más de una hora | Revisar el worker y permisos de Storage. |
| Push fallido | Cinco o más envíos fallidos en una hora | Revisar credenciales, dispositivos y resultados de Expo. |
| Soporte prioritario | Consulta de seguridad aún no resuelta | Abrir **Ayuda y soporte** y aplicar el procedimiento de contención. |
| Reporte de chat | Reporte pendiente | Abrir **Reportes del chat**; mantener el envío en solo lectura si no hay moderación. |

Los estados se abren y resuelven automáticamente; cada transición queda en un historial sin mensajes ni apuntes. La ausencia inicial de un latido aparece como “sin latido registrado”, no como una prueba de caída: confirmá que el worker se publicó e inició. La pantalla requiere supervisión humana. **Todavía no envía email, push ni avisos fuera del panel**, y no certifica un servicio de guardia permanente.

Antes de producción: desplegar las migraciones y el worker de la misma versión, provocar de forma controlada un latido vencido y un trabajo estancado en staging, comprobar apertura/resolución, configurar un canal externo de alerta aprobado, definir quién lo recibe y ensayar la respuesta. El registro de señales no sustituye Sentry, backups ni restauración.
