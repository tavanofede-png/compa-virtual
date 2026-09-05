# Arquitectura

## Componentes

- Next.js 16 con exportación estática. Datos privados cargados tras autenticar. No SSR ni Server Actions.
- Expo 57 / React Native 0.86, una app nativa para Android e iOS con Expo Router.
- Supabase Auth, Postgres, Storage privado, Edge Functions y pgmq.
- Worker Node 24 en contenedor, procesamiento secuencial de documentos.
- OpenAI Responses mediante AIProvider. OCR y embeddings se ejecutan fuera del cliente.
- Expo Push y un programador de recordatorios separado del worker.

## Transacción por alumno

La primera implementación emplea un agregado JSON versionado por alumno como estado canónico, con proyecciones relacionales dentro de la misma transacción. Es una decisión explícita para el piloto: simplifica la sincronización atómica del ciclo entero y permite validar las reglas compartidas antes de descomponer comandos.

La API autentica el JWT con Supabase, lee el agregado del usuario, valida la orden, calcula el siguiente estado y llama a commit_state con service role. La función toma un bloqueo por usuario, valida versión e ID de operación, actualiza proyecciones y añade el movimiento de monedas. Los clientes no tienen permiso de escritura sobre estas tablas.

Este diseño reescribe las proyecciones del agregado en cada transición. Es adecuado como punto de partida de una beta pequeña, pero requiere medición de tamaño/latencia y migración a comandos SQL por entidad antes de crecer significativamente. No se presenta como una arquitectura de alta escala ya probada.

## Materiales

Reserva de ruta firmada → subida directa a Storage → verificación de tamaño → cola durable → extracción/OCR → fragmentos con referencias → embeddings de 1536 dimensiones → pgvector y texto completo. La búsqueda impone user_id en el servidor. Los archivos cifrados, ilegibles o excesivos fallan de forma visible.

El worker mantiene la visibilidad del mensaje mientras trabaja, reintenta hasta tres lecturas para errores transitorios y confirma mensajes terminados. Un material READY no se procesa otra vez por una entrega duplicada. Reinicios del contenedor dejan el mensaje pendiente para recuperación.

## Offline

Web: shell estático en Service Worker y snapshot por cuenta en almacenamiento local. Nativo: SQLite para snapshots y SecureStore para tokens. Se permite consultar; las mutaciones necesitan confirmación del servidor. No hay cola invisible de cambios de IA.

## Publicación

Sites aloja únicamente el export web. Supabase y Render tienen despliegues independientes. La configuración pública queda incrustada al compilar; los secretos jamás se incluyen en el export. Las apps requieren EAS y firma de cada plataforma.
