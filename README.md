# Compa Virtual

Compañero de estudio para secundaria argentina. Monorepo con web Next.js, apps nativas Expo, backend Supabase y worker de documentos.

La escena actual usa **compañeros adolescentes y una habitación 3D interactiva**. Ver [catálogo, modelos y controles](docs/WORLD_3D.md). Sustituye la dirección inicial de criaturas en pixel art.

**Estado de entrega:** Supabase dedicado conectado a web y móvil, con esquema, RLS, datos iniciales, Storage privado y las funciones `api` y `reminders` desplegadas. Todavía faltan la credencial de IA, el worker de materiales, el programador de recordatorios, la compilación firmada y la validación en teléfonos antes de autorizar la beta para alumnos. Ver [VALIDATION.md](docs/VALIDATION.md).

## Abrir el proyecto

Requiere Node.js 24 y pnpm 10.33.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

La web abre en el puerto 3000. **Explorar con datos ficticios** habilita un recorrido local persistente, con agenda, planificador, sesiones, un quiz de ejemplo, monedas, memoria y personalización. La demo no llama a IA, no crea cuentas reales y no sube archivos. Sus datos no se sincronizan con una cuenta.

## Archivos 3D grandes

El repositorio incluye los modelos y los archivos editables de Blender, sin requerir Git LFS. El modelo maestro de la pérgola supera el límite individual de GitHub y se guarda como `pergola.glb.gz`, comprimido sin pérdida. `pnpm install` lo restaura automáticamente; si la instalación omite scripts, ejecutar `pnpm assets:restore` antes de abrir la revisión de espacios personales. La restauración comprueba tamaño y SHA-256, y no sobrescribe un modelo local modificado.

Después de modificar ese modelo, ejecutar `pnpm assets:pack-large` para actualizar el archivo comprimido y su manifiesto antes del commit.

## Estructura

| Carpeta          | Responsabilidad                                                                      |
| ---------------- | ------------------------------------------------------------------------------------ |
| apps/web         | Web estática, navegación con parámetros, formularios y caché de consulta             |
| apps/mobile      | React Native / Expo Router, SecureStore, SQLite y notificaciones                     |
| apps/worker      | PDF, DOCX, TXT, imágenes, OCR, fragmentos y embeddings                               |
| packages/domain  | Tipos, validaciones, planificador, pedagogía, gamificación y catálogo de apariencias |
| packages/world3d | Geometría, materiales y escenas compartidas de adolescentes y habitación             |
| packages/client  | Repositorio Supabase, control de versión, subida privada y demo explícita            |
| packages/server  | API autenticada, adaptador OpenAI y recordatorios                                    |
| packages/assets  | Atlas originales y metadatos compartidos                                             |
| supabase         | Migraciones, semillas, funciones empaquetadas y programador                          |
| tests            | Reglas de dominio, PostgreSQL/RLS, documentos y contrato del proveedor               |

## Conectar servicios

1. Crear un proyecto Supabase dedicado; no reutilizar un proyecto ajeno.
2. Aplicar las migraciones con Supabase CLI y ejecutar `supabase/seed.sql`.
3. Copiar los ejemplos de entorno a archivos locales ignorados por Git. La clave pública de Supabase puede ir en web/móvil. **La service role y OpenAI solo van en el servidor/worker.**
4. Ejecutar `pnpm --filter @compa/server bundle` y desplegar las funciones `api` y `reminders`. `verify_jwt=false` evita depender del verificador legado: la API verifica cada JWT mediante `auth.getUser`; los recordatorios exigen `CRON_SECRET`.
5. Configurar los secretos de las funciones y el worker. Ajustar las URLs de redirección de Auth para web y `compavirtual://`. Configurar correo transaccional antes del registro público.
6. Desplegar `render.yaml`. El worker procesa un documento por vez. Verificar el tamaño real de instancia en Render antes de aceptar el despliegue.
7. Crear los secretos de Vault indicados en `supabase/schedule.sql` y ejecutar ese archivo una vez. La retención requiere el programador activo.
8. Configurar variables públicas y compilar de nuevo: Next exporta valores al momento del build.

## Apps nativas

Para crear un **APK Android de prueba**, abrir `crear-apk-android.cmd` en Windows o ejecutar `node scripts/build-android.mjs`. El asistente vincula Expo y compila el perfil `preview` conectado al proyecto de Supabase. Ver [instalación y alcance de la prueba](docs/ANDROID_APK.md).

```sh
pnpm mobile
# Dentro de apps/mobile, después de vincular la cuenta Expo:
eas build --profile development --platform all
eas build --profile beta --platform all
eas submit --profile beta --platform all
```

Los comandos EAS requieren el proyecto, las cuentas de desarrollador, identificadores definitivos y credenciales APNs/FCM. TestFlight y Google Play requieren pruebas y revisión reales. Un export de Metro/Hermes comprueba el bundle, no genera un IPA/APK firmado ni sustituye la prueba física.

## Validar

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter @compa/server bundle
pnpm seed:generate
```

En Windows, Expo puede ejecutarse directamente con `node node_modules/expo/bin/cli` desde `apps/mobile`. Para exportar sin telemetría, usar `EXPO_NO_TELEMETRY=1`. Los tests PostgreSQL usan PGlite con pgvector real; representan los esquemas periféricos de Supabase y el transporte pgmq mediante fixtures. No certifican Auth, Storage HTTP ni entrega de colas en producción.

## Documentación

[Producto](docs/PRODUCT.md) · [Arquitectura](docs/ARCHITECTURE.md) · [Datos](docs/DATABASE.md) · [IA](docs/AI_ARCHITECTURE.md) · [Métodos](docs/STUDY_METHODS.md) · [Classroom](docs/CLASSROOM_INTEGRATION.md) · [Seguridad](docs/SECURITY.md) · [Privacidad](docs/PRIVACY-DRAFT.md) · [Decisiones](docs/PRODUCT_DECISIONS.md) · [Roadmap](docs/ROADMAP.md) · [Prompts](docs/PROMPTS.md) · [Validación](docs/VALIDATION.md).
