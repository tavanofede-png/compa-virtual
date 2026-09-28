# Android: APK interno y preparación de Play

Estado al 27/09/2026: el primer APK interno terminó en EAS como `FINISHED`: [Kusiy 0.1.0, build 1](https://expo.dev/accounts/fedetavano/projects/kusiy/builds/ac99f47a-935c-45dc-b62f-05e9dd5649a0). El proyecto está vinculado a `@fedetavano/kusiy`, ID `da66e377-a1a6-4d4f-845f-85fbc7cceba6`, y su clave Android fue generada y almacenada por EAS. La copia local está en `C:/Users/tavan/Documents/Codex/KusiyBuilds/kusiy-0.1.0-preview-1.apk`. El titular lo instaló en un Motorola Edge 30 con Android 14: las capturas muestran imágenes recortadas, una fuente demasiado fina y un fallo de carga de la habitación. Este resultado no aprueba G9. No se publicó en Play.

## Corrección 0.1.1

El APK corregido terminó en EAS como `SUCCEEDED`: [Kusiy 0.1.1, build 2](https://expo.dev/accounts/fedetavano/projects/kusiy/builds/7e22fb18-3990-4c3a-840d-9eef9f9dbe0b) ([descarga directa del APK](https://expo.dev/artifacts/eas/zif1U3gkIQsB-emFlMUe7nPe1beX8TGlgU2yYJ47y8I.apk)). Es una actualización interna instalable sobre el primer APK. Gradle, firma y carga del artefacto completaron correctamente. La validación de la interfaz y del render 3D en el Motorola Edge 30 con Android 14 sigue pendiente; esta compilación no aprueba G9 por sí sola.

- La verificación SHA-256 de escenas pasaba un `ArrayBuffer` a `ExpoCrypto.digest`. La implementación Android del SDK 57 acepta `TypedArray`; ahora recibe una vista `Uint8Array` sin copiar los bytes. El modelo publicado de Invernadero respondió HTTP 200, con sus 73.063.380 bytes y hash correcto; el mensaje anterior de conexión ocultaba el error local.
- Las imágenes nativas añadían las dimensiones originales del asset antes de aplicar estilos. `width: 100%` con `aspectRatio` conservaba ese alto original. Un contenedor dimensiona ahora la vista y la imagen interior tiene ancho y alto explícitos; personajes, ropa, dormitorios, espacios y salas mantienen sus proporciones sin recorte.
- Outfit se cargaba como TTF variable. SDK 57 requiere caras estáticas para una selección de pesos fiable en Android. Se generaron Regular, Medium, SemiBold, Bold y ExtraBold a partir del mismo maestro; la UI selecciona la cara correspondiente.
- El lienzo del espacio individual tiene altura definida. Cambiar de pantalla restablece la posición del scroll. El error original de carga 3D ya no se sustituye por una atribución genérica a la conexión.
- Cuatro pruebas de la caché verifican el contrato de datos Android, reutilización, corrupción, descarga parcial y cancelación. Typecheck móvil, lint y exportación Android aprobados. Estas comprobaciones no acreditan el render en un teléfono; debe repetirse el recorrido en el Edge 30 con el nuevo binario.
- `preview` incrementa `versionCode` para permitir una actualización con la misma identidad y firma. OTA continúa pendiente.

## Cierre del render reportado en 0.1.1

En el Motorola Edge 30 con Android 14, el titular reportó que 0.1.1 termina la carga de la habitación y cierra la app al comenzar la vista 3D. No hay todavía un log nativo que distinga agotamiento de memoria de un fallo del renderizador. Invernadero es una escena exigente: 73.063.380 bytes, 1.916.602 vértices de GLB y 897.732 triángulos. Los 128 GB del teléfono son capacidad de almacenamiento, distinta de la RAM y memoria de GPU usadas durante el render.

La dirección confirmada es conservar **el GLB original, la resolución seleccionada, el antialias y las sombras**. No se incorpora la variante geométrica experimental. La carga ahora decodifica primero la habitación y después el personaje, la ropa y la mascota. Antes de montar el lienzo deja un intervalo breve para que el runtime libere datos temporales de lectura. Ninguna de estas medidas elimina geometría visible. Se prepara una marca local de fase para que, si Android vuelve a terminar el proceso, la siguiente apertura muestre Inicio con la imagen del cuarto y un reintento explícito, evitando un ciclo de cierres. La causa requiere un registro nativo del Edge 30 o una prueba física instrumentada; ningún test de JavaScript prueba que el render ya esté resuelto.

El [APK interno 0.1.2, build 3](https://expo.dev/accounts/fedetavano/projects/kusiy/builds/b222ec7c-5637-40b9-a1a1-f95f1f67c4b5) terminó como `FINISHED` y se puede [instalar desde EAS](https://expo.dev/artifacts/eas/09k__I61_UPgoaJLoPUgCF_MOc3pXs4VLS_rUnTAk8E.apk). La copia local está en `C:/Users/tavan/Documents/Codex/KusiyBuilds/kusiy-0.1.2-preview-3.apk`; el [recibo del artefacto](./releases/android-preview-0.1.2.json) registra su SHA-256, tamaño y continuidad del certificado de firma v2 con el primer APK. No se hizo una verificación criptográfica completa con `apksigner`. `pnpm android:preflight`, exportación Android, typecheck y lint pasaron; seis pruebas específicas de escenas y movimiento pasaron. Falta volver a intentar la vista 3D en el Edge 30. Si se repite el cierre, activar **Depuración USB** (no la superposición de registro), conectar el teléfono a la PC y capturar `logcat` para separar un error de memoria de uno de OpenGL/Expo.

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
