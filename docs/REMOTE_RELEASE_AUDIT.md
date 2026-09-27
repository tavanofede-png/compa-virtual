# Acceso remoto y condiciones de publicación — 27/09/2026

Inspección de solo lectura de las sesiones abiertas por el titular. No se aplicaron migraciones, cambios de plan, servicios, claves ni despliegues.

| Servicio | Estado comprobado | Consecuencia |
|---|---|---|
| Supabase `compa-virtual` | Última migración `20260926020551_family_capabilities`. Faltan las migraciones locales E4–E13. | La API y el worker v2 no pueden tratarse como activos. |
| Supabase Backups | Proyecto en Free; el panel indica que no hay backups programados. | No aplicar la migración de materiales sin una copia recuperable de base y objetos. |
| Supabase Storage | Existe el bucket `materials`, privado, con límite de 25 MB por archivo. | La copia de base por sí sola no protege los archivos originales. |
| Render `My Workspace` | No hay servicio `compa-materials`; solo aparecen servicios ajenos a Kusiy. El blueprint local solicita una instancia Standard. | Aún no existe un consumidor remoto v2 que pueda reemplazar al legado. |

Según la documentación oficial, el plan Free de Supabase permite hacer un dump lógico manual con la CLI; Pro comienza en USD 25/mes e incluye backups diarios de base por siete días. **Ninguna copia de base incluye los objetos de Storage**. Render no ofrece una instancia Free para background workers; Standard (`1c-2g`) figura a USD 25/mes. [Backups de Supabase](https://supabase.com/docs/guides/platform/backups), [backup/restauración con CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [precios de Supabase](https://supabase.com/pricing), [workers gratuitos de Render](https://render.com/docs/free), [precios de Render](https://render.com/pricing).

Decisión posterior del titular: [piloto gratuito con worker local y copia manual cifrada](./FREE_PILOT_OPERATIONS.md). No se contrató Render ni Supabase Pro. El lanzamiento productivo seguirá necesitando los gates de recuperación y disponibilidad.

Antes de publicar:

1. La copia manual cifrada de la base y los dos objetos de `materials` se completó el 27/09/2026; conservar una segunda copia externa para cumplir la retención del Master Plan.
2. El ensayo de los archivos cifrados en contenedor aislado se completó: cinco dumps restaurados, cuatro estados académicos y dos originales recuperados. Un ensayo complementario de un dump reciente en un stack Supabase local restauró Auth, Storage y colas; su API recuperó los dos originales con SHA-256 idéntico. El stack y sus volúmenes se eliminaron. Falta una copia externa y el restore integral de los archivos cifrados en un entorno gestionado para aprobar G8. La cuenta solo muestra dos proyectos, el productivo y otro de un producto distinto; no usar este último como destino de restauración.
3. Para pruebas controladas, arrancar un único worker local con `pnpm worker:local` después de la migración; para operación continua, establecer un alojamiento y un plan autorizados. Configurar secretos sin volcarlos en el código ni en el chat.
4. Seguir [COORDINATED_RELEASE.md](./COORDINATED_RELEASE.md). El preflight remoto debe mostrar el contrato de esquema, pipeline v2 y latido vigente antes de promover Vercel.

El presupuesto de USD 100–300/mes del Master Plan es una previsión, **no una autorización de compra**. La contratación se deja al titular. Ningún gate de producción cambia por esta inspección.
