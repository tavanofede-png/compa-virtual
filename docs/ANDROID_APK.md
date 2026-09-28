# Android: APK interno y preparación de Play

Estado al 27/09/2026: el primer APK interno terminó en EAS como `FINISHED`: [instalar Kusiy 0.1.0, build 1](https://expo.dev/accounts/fedetavano/projects/kusiy/builds/ac99f47a-935c-45dc-b62f-05e9dd5649a0). El proyecto está vinculado a `@fedetavano/kusiy`, ID `da66e377-a1a6-4d4f-845f-85fbc7cceba6`, y su clave Android fue generada y almacenada por EAS. La copia local está en `C:/Users/tavan/Documents/Codex/KusiyBuilds/kusiy-0.1.0-preview-1.apk`. No se instaló en un teléfono ni se publicó en Play.

La inspección del artefacto confirma `com.kusiy.estudio`, versión `0.1.0`, `versionCode` 1, mínimo API 24 y target API 36. Los enlaces `kusiy://` y `compavirtual://` siguen presentes; el enlace antiguo continúa en las redirecciones de Auth y avisos ya emitidos. El APK pesa 181.433.743 bytes (aproximadamente 173 MiB), contiene las cuatro arquitecturas Android, no es depurable y no declara `SYSTEM_ALERT_WINDOW`. Se detectó firma v2 y se extrajo su certificado; esto no sustituye una comprobación criptográfica con `apksigner` ni las pruebas físicas. El recibo [android-preview-0.1.0.json](./releases/android-preview-0.1.0.json) registra los hashes.

## Comprobaciones completadas

- `pnpm android:preflight` y `node scripts/verify-android-config.mjs --eas`: pasaron para configuración local, paquete, esquemas, runtime, perfiles y proyecto vinculado.
- Typecheck y lint del monorepo: pasaron.
- Exportación Android de Metro/Hermes: pasó; bundle `.hbc` de aproximadamente 8,9 MB. La exportación comprueba JavaScript y recursos, no compila módulos nativos ni firma un APK.
- `expo prebuild --platform android --no-install --clean`: generó el proyecto nativo sin error. `build.gradle` contiene `applicationId com.kusiy.estudio` y el manifiesto registra ambos esquemas y los permisos de micrófono/notificaciones. El permiso de superposición `SYSTEM_ALERT_WINDOW` queda marcado para eliminarse del manifiesto final. El directorio generado está ignorado; EAS volverá a generarlo desde la configuración versionada.
- El gate de configuración también corre en CI para impedir que una variable local antigua vuelva a cambiar el paquete de Android.
- `.easignore` conserva fuentes, modelos de avatar/vestuario, metadatos de atlas y manifiestos móviles. Excluye renders, maestros y bytes de escenas descargadas por la caché. El asistente usa `EAS_NO_VCS` con raíz explícita del monorepo para evitar clonar el historial Git de más de 1 GB. El segundo paquete se comprimió a 69,9 MB.
- El primer build remoto falló por excluir los metadatos de atlas compartidos; el paquete corregido completó JavaScript, Prebuild, Gradle y el artefacto de release en EAS. Expo Doctor señaló 19 dependencias desfasadas respecto de las versiones recomendadas; hay que reconciliarlas antes de la beta.

## Primer APK interno

1. Iniciar sesión en una cuenta Expo/EAS que vaya a ser propietaria permanente del proyecto. El titular debe completar el acceso en el navegador; no enviar claves por chat ni guardarlas en el repositorio.
2. Desde la raíz del repositorio ejecutar `pnpm android:preflight` y luego `node scripts/build-android.mjs` (o abrir `crear-apk-android.cmd`). El asistente reutiliza la sesión y el proyecto vinculados; si faltan, solicita el acceso del titular y la vinculación. Vuelve a comprobar el `projectId` y solicita el build `preview` para Android.
3. Si EAS solicita la primera clave de firma, dejar que la genere y la conserve en esa cuenta. Registrar propietario, URL del build, ID y huella del artefacto. Sin acceso a esa cuenta y clave no se puede gestionar una actualización compatible.
4. Descargar el APK desde el enlace de EAS e instalarlo en los tres perfiles de teléfono previstos. Hasta tener la revisión de menores, usar cuentas adultas/internas o la demostración.

El perfil `preview` carga la configuración pública de Supabase y genera un APK autónomo. No exige Expo Go. El worker de materiales sigue dependiendo de la computadora operada localmente; si se apaga, los trabajos esperan. `EXPO_PUBLIC_*` contiene únicamente valores publicables; claves de servicio e IA permanecen en servidor.

La política `runtimeVersion` y los canales `preview`/`beta` están declarados, pero **OTA aún no está habilitado**: falta instalar y configurar `expo-updates`. Este primer APK se publica como binario interno completo. Una actualización nativa requiere otro APK hasta completar esa integración.

## Distribución posterior

El perfil `beta` está preparado para un AAB de Play, pero **no se ha ejecutado**. Antes de subir el primer AAB hay que comprobar la ficha de Play, Data Safety, firma, compatibilidad nativa, enlaces, recuperación de cuenta y requisitos de pruebas de la cuenta. Las pruebas físicas, el consentimiento familiar y los gates legales siguen pendientes. Ninguna exportación JS o APK interno los sustituye.
