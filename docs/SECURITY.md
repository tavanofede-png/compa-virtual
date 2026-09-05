# Seguridad

## Fronteras

El navegador y las apps son clientes no confiables. El usuario se obtiene de auth.getUser, nunca de un user_id enviado en el payload. Los comandos tienen validación Zod, versión y operationId. La service role existe solo en Edge Functions y worker.

Postgres aplica RLS en proyecciones, Storage y chunks. Las funciones SECURITY DEFINER fijan search_path vacío y revocan EXECUTE público. Las claves correctas de quizzes están excluidas de todos los snapshots de cliente.

La escritura del agregado y el libro de monedas se ejecutan bajo un bloqueo por alumno. Los IDs de operación evitan una segunda aplicación; la respuesta relee el estado confirmado. El cálculo de puntos no depende de un saldo enviado por el cliente.

## Archivos

Buckets privados. Subidas firmadas en rutas aleatorias bajo el dueño autenticado. Hasta 25 MB; PDF hasta 100 páginas; DOCX limita cantidad y tamaño expandido de entradas; imágenes limitan píxeles. PDF.js no ejecuta acciones del documento. El OCR no sigue instrucciones escolares como comandos.

Eliminar un material limpia el archivo y las referencias derivadas. El worker vuelve a verificar existencia de cuenta durante el procesamiento por lotes. Una llamada externa ya iniciada puede terminar; store:false evita crear un historial persistente de respuestas, pero no sustituye las condiciones del proveedor.

## Sesiones y dispositivos

Web usa Auth PKCE y almacenamiento por cuenta. Móvil usa SecureStore con fragmentos para tokens y SQLite para consultas. Salir elimina el snapshot local y revoca el token de push registrado en ese cliente; no se deja un recordatorio destinado al usuario anterior.

El permiso nativo se solicita mediante una acción explícita. Tokens revocados se deshabilitan al procesar receipts. Un fallo de red ambiguo de Expo se marca UNKNOWN y no se reenvía ciegamente: exactamente una entrega visible no puede garantizarse por un servicio externo sin idempotencia de envío.

## Operación

- Rotar secretos desde el proveedor, nunca publicarlos en Git, logs o variables públicas.
- Configurar SMTP, límites de autenticación, CAPTCHA si el riesgo de abuso real lo requiere y dominios permitidos.
- Mantener revisión de dependencias y pruebas de dos cuentas en el proyecto real.
- No registrar contenido escolar, tokens de dispositivo ni claves en logs técnicos.
- Verificar backups, restauración y retención antes de operar con alumnos.
- Configurar cron y alertas para errores de worker/funciones y documentos atascados.

## Límites de validación

Las pruebas locales de PostgreSQL cubren reglas y permisos SQL reales, pero los esquemas Auth/Storage y el transporte de colas son fixtures. Deben repetirse con Supabase real, dos cuentas, archivos privados, workers reiniciados y llamadas de IA con referencias.
