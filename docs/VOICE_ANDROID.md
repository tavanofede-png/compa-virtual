# E6 · Conversación por voz nativa

Estado al 26/09/2026: implementación local, sin despliegue ni certificación física. G4 continúa pendiente.

## Recorrido implementado

«Iniciar llamada» comprueba disponibilidad y solicita permiso de micrófono. Expo Audio captura PCM en memoria, sin crear archivos. La detección de energía conserva el comienzo de la frase y la envía al detectar 1,15 segundos de pausa, o unos 20 segundos continuos. Convierte la frecuencia real del hardware a mono PCM16 de 16 kHz.

La función autenticada `voice` valida el WAV, calcula duración desde los bytes y reserva cuota antes de llamar a `@cf/openai/whisper-large-v3-turbo`. La transcripción se envía al mismo `repo.ai("chat")` del chat manual, conservando comandos, permisos y recibos. El mensaje aparece mientras el agente procesa. Estados: escuchando, transcribiendo, pensando, hablando y reconectando.

La respuesta usa `expo-speech`, el perfil del personaje y las voces españolas instaladas. Espera la finalización real de TTS antes de volver a escuchar. La señal `speaking` activa el sistema existente de boca/expresión y vuelve a neutral al terminar. «Interrumpir y hablar» corta TTS y retoma la escucha. La navegación solicitada al agente se abre después de la respuesta hablada.

Es conversación por frases, en medio dúplex: el micrófono está apagado durante transcripción, generación y reproducción. No hay audio dúplex directo con el modelo ni interrupción acústica automática. Una pausa de escucha de 75 segundos termina la captura; cinco segundos sin buffers pausa la llamada. Colgar, cambiar de cuenta, cerrar el chat o enviar la app al fondo libera el micrófono, descarta PCM, cancela transcripción y detiene TTS. No se reactiva solo al volver.

Si falla el agente, conserva la transcripción en el campo de texto para reintentar con el mecanismo idempotente existente. No reenvía audio automáticamente ante una respuesta perdida. Una acción recibida por el servidor puede finalizar después de colgar: colgar no revierte una modificación académica aceptada.

## Cuota y activación

Cloudflare documenta 10.000 neuronas gratuitas diarias para toda la cuenta, renovadas a las 00:00 UTC; Whisper utiliza 46,63 neuronas por minuto de audio. Verificados en [tarifas oficiales](https://developers.cloudflare.com/workers-ai/platform/pricing/) y [modelo Whisper](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/).

Reserva transaccional por cuenta, duración redondeada y margen de coste. Máximo de 25 segundos por WAV y 600 segundos diarios por alumno de audio enviado, incluidos intentos fallidos. Identificador y SHA-256 impiden procesar dos veces una intervención. No devuelve reservas inciertas: un timeout pudo consumir cuota remota.

El contador local **no conoce automáticamente el consumo externo** de Workers AI. Para pruebas internas, el panel MFA permite registrar una comprobación manual del plan **Free** y del saldo global observado, con procedencia. Caduca en cinco minutos y asigna el 80% del saldo; una nueva comprobación no aumenta el saldo local del mismo día. Sin verificación vigente no envía audio. No modifica facturación ni usa un fallback pago.

Esta herramienta no certifica el control productivo de cuota. Falta integrar/comprobar una fuente automática del consumo compartido y verificar el plan Free real. Una cuenta Free exclusiva para voz también requiere comprobar configuración y consumo. G4 permanece pendiente.

Variables de servidor:

- `VOICE_ENABLED=false` por defecto.
- `VOICE_STUDENT_DAILY_SECONDS=600`; no admite más de 600.
- `CLOUDFLARE_VOICE_ACCOUNT_ID` y `CLOUDFLARE_VOICE_API_TOKEN` opcionales; vacíos usan las credenciales existentes. Si se elige una cuenta exclusiva, configurar ambos. Nunca entregar al cliente.
- `VOICE_MINOR_DATA_APPROVED=false`: aprobación específica de Cloudflare audio. También exige `MINOR_BETA_APPROVED` y autorización familiar vigente de servicio/IA. La aprobación de otro proveedor no habilita Whisper.

Sin micrófono o cuota conserva texto y lectura por voz del dispositivo.

## Publicación

Migración `20260926041800_voice_quota.sql`: tablas RLS solo para servicio, reserva, comprobación y purga. **No aplicar indiscriminadamente las migraciones locales anteriores:** E4 exige actualizar API y worker de Render de forma coordinada.

Después de resolver E4: aplicar migraciones compatibles, regenerar bundles y publicar `api`, `reminders` y `voice`. El cron `reminders` purga metadata de voz de más de 30 días y auditoría de cuota de más de 90; comprobar ejecución remota. Exportación paginada de historial propio y borrado mediante FK. Las tablas de voz no almacenan audio/transcripciones; el texto enviado al agente conserva la retención de chat. La retención del proveedor requiere revisión externa.

`expo-audio@57.0.4` y su plugin requieren **nuevo binario Android**, con permiso de micrófono y sin grabación/reproducción en background. No distribuir por OTA a un runtime sin este módulo. Credenciales solo en Edge, nunca en `EXPO_PUBLIC_*`.

## Evidencia y pendientes

Typecheck, lint, bundles Edge, build web y exportación del bundle Android aprobados. 37 pruebas específicas de voz/cliente/base pasaron: duración no falsificable, pausa, formato real, permiso familiar, revocación durante inferencia, reserva, duplicados, cuota, rechazo sin proveedor y ausencia de fallback pago. PostgreSQL/PGlite verifica funciones/RLS locales, sin certificar concurrencia remota ni Cloudflare real.

Para G4 falta nuevo binario firmado y pruebas de ruido, pausas, audio focus, auriculares, eco, revocación y background en tres gamas Android; Whisper real en Free, cuota global automática comprobada, latencia p95 y cron remoto. La detección por energía no está certificada como resistente a ruido. No se certificó iOS. Pruebas físicas/piloto al final, según lo acordado.

Fuentes: [Expo Audio SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/audio/), [autenticación Edge](https://supabase.com/docs/guides/functions/auth). Siguiente implementación: E7, perfiles y optimización 3D conservando detalle/composición.
