# Extensión Classroom — posterior a esta versión

El contrato ClassroomProvider está definido en packages/domain/src/extensions.ts. No hay conexión activa ni botones inactivos en la beta.

## Flujo previsto

OAuth independiente de Supabase Auth, con state validado, PKCE cuando corresponda y scopes mínimos. Guardar credenciales cifradas exclusivamente en el servidor. Cada vínculo pertenece al alumno autenticado y puede revocarse.

La sincronización se identifica por cuenta, curso y externalId. No debe crear duplicados por reintentos. Una obligación importada conserva procedencia, enlace y fecha local original; el alumno puede corregir una propuesta sin perder la referencia externa.

## Push y polling

Registrar y renovar watches antes del vencimiento. Validar el origen de los mensajes entrantes. Los avisos disparan sincronización; no se consideran el contenido definitivo del curso. Mantener polling con cursores para recursos sin avisos suficientes y recuperar períodos sin conexión.

## Conflictos

Separar campos importados de ajustes del alumno. No sobrescribir una fecha corregida sin mostrar el cambio. El borrado externo no elimina silenciosamente el historial completado. Desconectar revoca credenciales y detiene sincronizaciones; no se implementa el proveedor hasta revisar permisos y pruebas con una cuenta educativa real.
