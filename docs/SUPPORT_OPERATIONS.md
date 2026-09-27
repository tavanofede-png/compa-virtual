# Ayuda y soporte: implementación local

Las cuentas conectadas abren **Ajustes → Ayuda y soporte** en web o Android. Pueden crear una consulta, ver su estado y responder. `/help` ofrece instrucciones públicas básicas cuando no se puede ingresar; el formulario de tickets requiere una sesión válida. No se promete atención humana inmediata ni se habilitan adjuntos.

## Datos y acceso

- `20260927010000_support_tickets.sql` agrega tickets, mensajes y auditoría en `private`, con RLS y permisos de ejecución exclusivos para `service_role`.
- La API toma el identificador del token autenticado; nunca acepta `user_id` enviado por el cliente. Las lecturas y respuestas del alumno verifican propiedad en PostgreSQL. El operador requiere allowlist y MFA AAL2 en cada solicitud.
- La operación de crear o responder usa un UUID idempotente. Hay un máximo de cinco tickets y veinte mensajes del alumno por cada 24 horas. El campo de texto se limita a 2.000 caracteres. La categoría Seguridad aparece primero en la cola.
- El soporte permanece disponible si la autorización del servicio está pendiente o fue revocada, para poder tratar problemas de acceso y derechos. Las consultas se incluyen en la exportación de datos y se eliminan al borrar la cuenta.
- No se almacenan adjuntos, contraseñas ni contenido de la app automáticamente. El alumno recibe una indicación de no incluir datos privados de otras personas.

## Operación

1. Entrar a `/admin` con la cuenta incluida en `OPERATOR_USER_IDS` y segundo factor.
2. Revisar la sección **Ayuda y soporte**; atender primero los casos prioritarios.
3. Abrir el ticket, leer el contexto mínimo y cambiar a **En revisión**, **Esperando al alumno** o **Resuelta**. Los dos últimos estados exigen una respuesta visible para el alumno.
4. Confirmar que la respuesta aparece en la cuenta. Si el alumno responde, el ticket vuelve a **Recibida**.
5. Los reportes de chat y situaciones de riesgo conservan su propio flujo de moderación; un ticket de soporte no sustituye bloquear, reportar, contener ni escalar.

El panel y la cuenta cargan las consultas en páginas de 50. Antes de la operación con familias reales hay que definir la retención y configurar alertas de casos urgentes; la cola requiere revisión humana periódica. No hay un canal público de tickets sin autenticación, así que una persona que perdió todo acceso todavía necesita un canal de contacto externo aprobado y publicado.

## Despliegue y verificación pendientes

Aplicar la migración antes de publicar la API y los clientes. La migración, API, web y Android de este corte siguen **solo en local**. Hacer un ensayo con dos cuentas y el operador: apertura, aislamiento, respuesta, exportación y eliminación. Comprobar que la vista no revela datos de otra cuenta y que un token con MFA ausente no accede al panel. Para lanzar a menores se necesitan además procedimiento de soporte, titularidad y revisión legal aprobados.
