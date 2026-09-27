# Revisión familiar en Kusiy

El panel `/admin` muestra solicitudes de autorización familiar y permite registrar una verificación independiente o revocar la autorización. La ruta y la API exigen una sesión de Supabase, el UUID del usuario en `OPERATOR_USER_IDS` y un segundo factor TOTP verificado (`aal2`). Si la lista de operadores está vacía, la API rechaza todas las operaciones del panel.

## Preparación del operador

1. Crear o elegir una cuenta de operador real y obtener su UUID de Auth. No usar la cuenta de un alumno ni una cuenta compartida.
2. Configurar `OPERATOR_USER_IDS` como lista de UUID separados por comas en los secretos de la función `api`. Limitarla a las personas autorizadas.
3. Iniciar sesión en `/admin`, registrar un autenticador TOTP y completar el desafío. La clave TOTP se muestra solo durante el alta; debe guardarse en un autenticador seguro.
4. Hacer una verificación independiente de la identidad y relación del adulto. El nombre escrito por el alumno y un correo verificado no prueban parentesco. Registrar solo una referencia de caso sin documentos personales.
5. Revisar la solicitud y confirmar o revocar. Cada decisión queda registrada en `operator_audit`. La revocación abarca todas las solicitudes vigentes del alumno para la misma versión de política.

## Aceptación separada por el adulto

El contrato técnico incorpora `capability_grants` para **servicio**, **IA** y **social**, separado de la comprobación de parentesco. Una verificación previa no concede ninguno de estos permisos. Los registros históricos tampoco se convierten en permisos nuevos.

Después de verificar a la familia, el operador puede emitir un enlace privado temporal desde la solicitud vigente. Debe compartirlo únicamente con el adulto por el canal verificado. El token tiene 32 bytes aleatorios; en la base se guarda solo su SHA-256. Se muestra al operador una vez, va en el fragmento `#` y la página `/family` retira el fragmento de la barra de dirección al abrirlo. No se guarda en localStorage, analytics ni auditoría. Reemitir un enlace invalida los anteriores. Hay un minuto de cooldown de emisión, vencimiento de siete días y límite de solicitudes por enlace válido.

La página familiar permite aceptar el servicio y elegir IA/social sin opciones preseleccionadas. El adulto confirma haber revisado los documentos correspondientes a la versión. Sus URL quedan fijadas en el enlace y en el recibo de aceptación; modificar las URL del entorno no cambia el documento de una aceptación anterior. Los documentos deben conservarse por versión y cualquier cambio de finalidad requiere una versión nueva.

La aceptación del enlace solo se ejecuta una vez. Los reintentos usan el mismo UUID de operación y devuelven un recibo sin volver a conceder permisos. El recibo incluye el estado actual de los permisos, aunque la operación original fuera una aceptación anterior a una revocación.

El adulto puede revocar IA o social por separado. Revocar el servicio anula todos los permisos y los enlaces de esa autorización, sin borrar los datos. Para conceder nuevamente un permiso opcional se necesita otro enlace; después de revocar el servicio se necesita una nueva solicitud y verificación. Al vencer el enlace, el adulto pide otro mediante el mismo canal verificado.

La API de uso habitual devuelve únicamente el perfil de bienvenida y el compañero cuando falta permiso de servicio a un menor. No incluye datos académicos. La exportación y la eliminación de la propia cuenta permanecen disponibles. La UI web y Android distinguen familia verificada de servicio aceptado. IA, recordatorios y procesamiento de materiales consultan sus permisos; los encuentros siguen restringidos a adultos mientras faltan los gates sociales. Las políticas de datos y el ciclo completo de revocación en clientes/dispositivos todavía deben pasar la auditoría de G1.

## Habilitación pendiente

`FAMILY_PORTAL_ENABLED=false` es el default. Para activarlo hay que configurar `FAMILY_TERMS_URL` y `FAMILY_PRIVACY_URL` HTTPS con documentos aprobados y versionados, además del operador real y su procedimiento verificado. `FAMILY_PORTAL_URL` apunta al portal privado; no es una URL de documentos. La función `family-consent` usa el token privado como autenticación restringida, no el JWT del alumno; los RPC y la tabla de enlaces son accesibles solo por service role. El token no permite leer apuntes ni actuar como alumno u operador.

La revisión jurídica y la operación con familias reales siguen pendientes. `MINOR_BETA_APPROVED` permanece en `false`; no se debe activar para usar el panel como demostración. Sin ese flag, las cuentas menores no pueden presentar nuevas solicitudes ni utilizar el producto. El portal familiar puede habilitarse antes de admitir alumnos únicamente después de aprobar su procedimiento y documentos. El worker de Render necesita recibir el nuevo código antes de permitir procesamiento de materiales de menores.

## Errores y recuperación

- Si falta el UUID en la lista, el servidor responde 403 aunque el usuario tenga TOTP.
- Si la sesión está en `aal1`, completar el desafío TOTP y volver a cargar el panel.
- Si una decisión tiene resultado incierto por red, actualizar la lista antes de reintentar. La verificación y la revocación repetidas no duplican su efecto.
- Si hay solicitudes duplicadas, solo una puede quedar verificada. Revocar una autorización revoca también las demás solicitudes de esa versión para evitar acceso residual.
- Si se pierde el segundo factor, recuperar la cuenta mediante el procedimiento de identidad del operador; no retirar la exigencia de `aal2`.

La primera prueba con cuentas reales debe comprobar que un usuario no autorizado, una sesión sin MFA y un alumno no pueden ver ni modificar solicitudes; también debe comprobar acceso, revocación y recuperación en Android. Ninguna de estas pruebas humanas o de dispositivo está aprobada todavía.
