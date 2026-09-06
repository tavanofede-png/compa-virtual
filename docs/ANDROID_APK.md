# APK de prueba para Android

El perfil `preview` genera un APK firmado de distribucion interna, con el JavaScript incluido. No necesita Expo Go ni un servidor de desarrollo. Usa datos ficticios locales incluso si existen variables de Supabase en el entorno remoto. El perfil `beta` conserva su configuracion para la integracion real posterior.

## Generar en esta computadora

Con Node.js y las dependencias del proyecto instaladas, abrir `crear-apk-android.cmd` en la raiz del repositorio, o ejecutar `node scripts/build-android.mjs`. El asistente:

1. Abre el inicio de sesion de Expo en el navegador.
2. Crea o vincula el proyecto de la cuenta elegida; guarda su identificador en `apps/mobile/app.json`.
3. Inicia una compilacion Android con `preview`. Si pide una keystore, permitir que EAS genere y gestione una nueva.
4. Espera la compilacion y muestra el enlace de instalacion. Un error detiene el proceso sin anunciar un APK terminado.

No hace falta una cuenta de Google Play para esta prueba. La cuenta de Expo y el acceso a EAS son necesarios. Las contrasenas se introducen en Expo, nunca en el repositorio ni en el chat.

## Instalar y probar

Abrir el enlace final de EAS desde Android, descargar el `.apk` y permitir la instalacion desde ese navegador cuando Android lo solicite. Abrir Compa Virtual y elegir **Explorar con datos ficticios**.

Comprobar habitacion y companero 3D, crear una obligacion, aceptar un plan, completar una sesion, cerrar/abrir la app y verificar la persistencia. Probar tambien sin conexion. Registrar modelo de telefono, version de Android y cualquier cierre o error grafico.

Este APK utiliza los personajes actuales del proyecto. El modelo Harper de Meshy todavia no esta incorporado. La prueba no incluye IA conectada, registro real, procesamiento de archivos ni notificaciones push reales.

## Estado verificado

El 6 de septiembre de 2026 paso la exportacion Android de Metro/Hermes. Esa comprobacion valida el bundle; no equivale a una compilacion nativa, un APK firmado ni una prueba en un telefono. La generacion de EAS y las comprobaciones fisicas siguen pendientes hasta obtener el artefacto.
