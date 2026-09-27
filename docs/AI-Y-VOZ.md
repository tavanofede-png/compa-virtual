# IA y voz de Kusiy

## Proveedor compartido para la prueba

Kusiy usa `AI_PROVIDER=cloudflare` como configuración de prueba. Existe una sola credencial del proyecto y todas las llamadas pasan por la Edge Function autenticada o por el worker de materiales. El navegador y la app móvil nunca reciben el token ni solicitan claves a los usuarios.

Workers AI incluye una asignación gratuita diaria de 10.000 neuronas. Al agotarse, Kusiy informa que la capacidad gratuita terminó por ese día y mantiene disponibles las funciones no relacionadas con IA.

Modelos configurados:

- Texto y JSON estructurado: `@cf/zai-org/glm-4.7-flash`.
- Embeddings multilingües: `@cf/baai/bge-m3`; el adaptador completa con ceros hasta las 1.536 dimensiones del índice actual de Supabase.
- OCR de imágenes: `@cf/meta/llama-3.2-11b-vision-instruct`.

OpenAI continúa disponible como alternativa estable para producción mediante `AI_PROVIDER=openai`; no hace falta cambiar los controladores ni el frontend.

## Configuración de la única clave

1. Crear un token de API de Cloudflare limitado a Workers AI y copiar el Account ID.
2. Completar en un `.env` local ignorado por Git:

   ```dotenv
   AI_PROVIDER=cloudflare
   CLOUDFLARE_ACCOUNT_ID=...
   CLOUDFLARE_API_TOKEN=...
   ```

3. Ejecutar `pnpm ai:check`. El comando valida nombres y nunca imprime el token.
4. Guardar los mismos valores como secretos de Supabase Edge Functions y variables secretas del worker de Render. Agregar también los modelos y `AI_VECTOR_DIMENSIONS=1536` definidos en `.env.example`.
5. Para habilitar OCR, aceptar una vez la licencia del modelo Llama Vision desde la cuenta de Cloudflare.
6. Regenerar y desplegar la función con `pnpm --filter @compa/server bundle` y `supabase functions deploy api`.

No se configura ninguna variable `NEXT_PUBLIC_*` ni `EXPO_PUBLIC_*` con credenciales de IA.

## Privacidad y menores

Cloudflare declara que no usa el contenido del cliente de Workers AI para entrenar modelos ni mejorar sus servicios sin consentimiento explícito. Aun así, la beta de alumnos continúa cerrada por defecto: `MINOR_BETA_APPROVED=false` y `AI_MINOR_DATA_APPROVED=false`. La prueba gratuita debe usar adultos y datos ficticios hasta completar consentimiento, revisión contractual y evaluación pedagógica.

## Voz

La continuación nativa de E6 está preparada solo en local y documentada en [VOICE_ANDROID.md](./VOICE_ANDROID.md): PCM → Whisper autenticado → agente → TTS. Requiere nuevo binario y cuota verificada; no habilita un proveedor pago ni acredita todavía G4. La llamada web descrita abajo sigue usando reconocimiento del navegador.

- La lectura en voz alta usa Web Speech en web y `expo-speech` en Android/iOS, sin costo por reproducción.
- Cada personaje conserva su perfil de ritmo, tono y selección de voz instalada.
- La boca del GLB se anima durante la reproducción cuando existe una malla o material `mouth`, `smile` o `lip`.
- El dictado web depende del reconocimiento de voz del navegador. El audio no se envía a Workers AI.

### Llamada continua gratuita

La web ofrece un modo de llamada sin costo adicional construido sobre las capacidades del dispositivo. Mientras la llamada está activa:

1. El navegador escucha una intervención.
2. Al detectar una pausa, envía la transcripción al chat existente.
3. Cloudflare Workers AI genera la respuesta de texto.
4. El dispositivo la reproduce con voz y anima la boca del personaje.
5. Al terminar, el micrófono vuelve a escuchar automáticamente.

El usuario puede interrumpir la reproducción y hablar, y puede cortar la llamada en cualquier momento. Este modo es conversación por turnos con manos libres; no transmite audio de forma dúplex ni mantiene una conexión de audio directa con el modelo. Si el navegador no ofrece reconocimiento de voz, permanecen disponibles el texto y el dictado manual.

## Agente operativo y memoria de la app

Cada turno autenticado recibe un contexto académico generado en el servidor con el perfil mínimo necesario, materias, horarios, actividades, planes, sesiones, check-ins, metadata de materiales, resultados de práctica, recuerdos editables, avisos, recordatorios y reuniones grupales accesibles para la cuenta. Los archivos completos no se copian al prompt: sus fragmentos se recuperan mediante búsqueda semántica y las referencias se validan antes de responder.

El modelo puede proponer hasta seis acciones estructuradas. El servidor las valida y ejecuta mediante los mismos comandos versionados e idempotentes que usa la interfaz. La respuesta guarda recibos `COMPLETED` o `NEEDS_INPUT`; el frontend los muestra y solo anuncia como realizada una acción que el servidor aplicó.

Acciones habilitadas:

- crear materias, actividades y bloques semanales;
- actualizar una actividad mediante un ID propio de la cuenta;
- proponer un plan para revisión;
- guardar preferencias, temas y progreso en la memoria editable;
- programar o desactivar recordatorios puntuales y semanales;
- ajustar preferencias de notificaciones;
- abrir una sección principal de la app.

El agente no puede aceptar planes, completar actividades, gastar monedas, comprar objetos, eliminar datos ni cambiar privacidad o consentimiento. Los recordatorios se entregan con el proceso existente de notificaciones, respetan zona horaria, descanso, horas silenciosas y fines de semana, y requieren que el dispositivo móvil haya habilitado las notificaciones.

### Opción de baja latencia para producción

Una experiencia de audio a audio realmente simultánea, con detección de turnos e interrupciones nativas, puede incorporarse con OpenAI Realtime por WebRTC. La clave estándar debe permanecer en el servidor y el navegador debe recibir un secreto efímero para crear la sesión. El modelo `gpt-realtime` no ofrece nivel gratuito, por lo que esta variante requiere presupuesto de API y queda fuera de la prueba gratuita actual.

- [Guía oficial de Realtime](https://developers.openai.com/es-419/api/docs/guides/realtime)
- [Conexión WebRTC para clientes de navegador](https://developers.openai.com/es-419/api/docs/guides/voice-webrtc)
- [Modelo y precios de gpt-realtime](https://developers.openai.com/api/docs/models/gpt-realtime)

## Validación

- Ejecutar `pnpm ai:check`, `pnpm test` y `pnpm typecheck`.
- Probar chat, extracción, quiz, embeddings y OCR con datos ficticios.
- Confirmar que una respuesta 429 no bloquea agenda, salas, personalización ni estudio manual.
- Verificar voz en Android e iOS físicos.

Fuentes oficiales:

- [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Workers AI data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/)
- [OpenAI-compatible endpoints](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/)
- [Workers AI JSON mode](https://developers.cloudflare.com/workers-ai/features/json-mode/)
- [Expo Speech](https://docs.expo.dev/versions/latest/sdk/speech/)
