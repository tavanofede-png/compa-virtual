# Android: APK interno y preparación de Play

Estado al 27/09/2026: la app resuelve `com.kusiy.estudio` para Android e iOS y acepta enlaces `kusiy://` y `compavirtual://`. El enlace antiguo sigue usándose para las redirecciones de Auth y avisos ya emitidos. `runtimeVersion` sigue la versión nativa de la app; los perfiles EAS separan `preview` (APK interno) y `beta` (distribución de tienda). Todavía **no hay APK firmado ni proyecto EAS vinculado**. La CLI devolvió `Not logged in`; tampoco hay Android SDK/JDK configurado en esta computadora para una compilación nativa local.

## Comprobaciones completadas

- `pnpm android:preflight`: pasó para configuración local, paquete, esquemas, runtime y perfiles. Con `--eas` falla correctamente hasta que Expo asigne un `projectId`.
- Typecheck y lint del monorepo: pasaron.
- Exportación Android de Metro/Hermes: pasó; bundle `.hbc` de aproximadamente 8,9 MB. La exportación comprueba JavaScript y recursos, no compila módulos nativos ni firma un APK.
- El gate de configuración también corre en CI para impedir que una variable local antigua vuelva a cambiar el paquete de Android.

## Primer APK interno

1. Iniciar sesión en una cuenta Expo/EAS que vaya a ser propietaria permanente del proyecto. El titular debe completar el acceso en el navegador; no enviar claves por chat ni guardarlas en el repositorio.
2. Desde la raíz del repositorio ejecutar `pnpm android:preflight` y luego `node scripts/build-android.mjs` (o abrir `crear-apk-android.cmd`). El asistente inicia sesión, vincula el proyecto EAS, vuelve a comprobar el `projectId` y solicita el build `preview` para Android.
3. Si EAS solicita la primera clave de firma, dejar que la genere y la conserve en esa cuenta. Registrar propietario, URL del build, ID y huella del artefacto. Sin acceso a esa cuenta y clave no se puede gestionar una actualización compatible.
4. Descargar el APK desde el enlace de EAS e instalarlo en los tres perfiles de teléfono previstos. Hasta tener la revisión de menores, usar cuentas adultas/internas o la demostración.

El perfil `preview` carga la configuración pública de Supabase y genera un APK autónomo. No exige Expo Go. El worker de materiales sigue dependiendo de la computadora operada localmente; si se apaga, los trabajos esperan. `EXPO_PUBLIC_*` contiene únicamente valores publicables; claves de servicio e IA permanecen en servidor.

## Distribución posterior

El perfil `beta` está preparado para un AAB de Play, pero **no se ha ejecutado**. Antes de subir el primer AAB hay que comprobar la ficha de Play, Data Safety, firma, compatibilidad nativa, enlaces, recuperación de cuenta y requisitos de pruebas de la cuenta. Las pruebas físicas, el consentimiento familiar y los gates legales siguen pendientes. Ninguna exportación JS o APK interno los sustituye.
