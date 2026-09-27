# Gate 0 — habilitación técnica y legal

## 1. IA compartida del proyecto

La prueba usa Cloudflare Workers AI con una sola clave de servidor. Los usuarios no cargan claves propias.

| Variable                        | Secreta | Valor                                    |
| ------------------------------- | ------: | ---------------------------------------- |
| `AI_PROVIDER`                   |      No | `cloudflare`                             |
| `CLOUDFLARE_ACCOUNT_ID`         |      No | ID de la cuenta del proyecto             |
| `CLOUDFLARE_API_TOKEN`          |  **Sí** | token limitado a Workers AI              |
| `CLOUDFLARE_AI_MODEL`           |      No | `@cf/zai-org/glm-4.7-flash`              |
| `CLOUDFLARE_AI_EMBEDDING_MODEL` |      No | `@cf/baai/bge-m3`                        |
| `CLOUDFLARE_AI_VISION_MODEL`    |      No | `@cf/meta/llama-3.2-11b-vision-instruct` |
| `AI_VECTOR_DIMENSIONS`          |      No | `1536`                                   |

Guardar la configuración en:

1. `.env` local ignorado por Git.
2. Secretos de la Edge Function de Supabase.
3. Variables secretas del worker de Render.

La clave no puede aparecer en Vercel, `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`, logs, snapshots ni respuestas de la API. El cliente llama únicamente a la función autenticada de Kusiy.

Ejecutar `pnpm ai:check` antes de desplegar. El worker debe arrancar mostrando `"provider":"cloudflare"` sin imprimir credenciales.

## 2. Privacidad y acceso de alumnos

Los defaults de despliegue son:

```dotenv
MINOR_BETA_APPROVED=false
AI_MINOR_DATA_APPROVED=false
DIGITAL_CONSENT_AGE=18
```

Esos valores no se habilitan por una prueba técnica. Para cuentas menores se exige el flujo de consentimiento verificable, revisión de proveedor, políticas, evaluación de seguridad y autorización explícita del piloto. Los adultos pueden probar con datos ficticios.

Cloudflare declara que Workers AI no usa Customer Content para entrenar modelos o mejorar servicios sin consentimiento. La aplicación mantiene igualmente prompts defensivos, aislamiento por usuario, RLS, leases de concurrencia y registro de consumo.

## 3. Supabase y worker

- La Edge Function `api` atiende tutor, extracción, quiz y búsquedas.
- El worker procesa materiales, OCR y embeddings fuera del cliente.
- `SUPABASE_SERVICE_ROLE_KEY` permanece solo en funciones/worker.
- Regenerar el bundle después de cambiar `packages/server`: `pnpm --filter @compa/server bundle`.
- Desplegar `api` y verificar chat real con un adulto de prueba.
- Aceptar una vez la licencia del modelo Llama Vision antes de probar OCR.

## 4. Criterio de aprobación

- `pnpm ai:check`, typecheck, lint, tests y build pasan.
- Chat, extracción, quiz, embeddings y OCR funcionan con datos ficticios.
- Al agotar la cuota gratuita se devuelve un error recuperable y el resto de Kusiy sigue operativo.
- No existe ninguna credencial de IA en bundles web o móvil.
- La beta de menores continúa bloqueada hasta completar el gate legal.
