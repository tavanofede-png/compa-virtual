# Publicación coordinada de Kusiy

Estado al 27 de septiembre de 2026: las ocho migraciones E4–E13 y la corrección operativa `20260927030000` están aplicadas en Supabase. Las cinco funciones Edge están activas: `api` v28, `material-process` v6, `reminders` v10, `family-consent` v2 y `voice` v1. El worker v2 se ejecuta localmente con clave en memoria. La migración nueva distingue los materiales que requieren una acción del alumno, como dividir un PDF de más de 100 páginas, de los fallos del procesamiento tras tres intentos. El escaneo y el preflight remoto pasaron sin alertas; el fingerprint local es `03a85f89769c9b65fdbcb78e21c7698dd6bc00402ee67e1ed5cdb6e0d5b05717`. La preview `dpl_DnZmwTu3Uct7r9vaEvg2bvWtk7jB` se promovió al despliegue de producción `dpl_9Y2Zyztb8PgdP3Q4554CzDpApZbK`, y `https://kusiy.vercel.app` apunta al nuevo artefacto. Las rutas `/`, `/admin`, `/family`, `/help` y `/mobile-preview.html?view=spaces` respondieron 200. El respaldo cifrado pasó un restore local y un dump reciente restauró Auth/Storage/pgmq en un stack Supabase aislado; el titular pospuso la segunda copia externa. **No se declara producción certificada** sin validación Android, permisos de menores, operación continua y respaldo externo.

## Contrato de orden

La migración `20260926031249_material_recovery.sql` desactiva el consumidor antiguo de materiales. Por eso **no se publica Vercel ni se aplica esa migración de forma aislada**.

1. Registrar commit y artefactos inmutables de la versión pública actual: despliegue Vercel, funciones Edge, configuración y versión del worker. Confirmar acceso operativo a Supabase y Render.
2. Hacer backup verificado de base **y** Storage en un destino aislado y cifrado. Anotar hora, proyecto, tamaños y hashes. Sin un restore de ensayo previo, este paso sigue pendiente para producción.
3. Construir web y bundles Edge, ejecutar `pnpm release:preflight` y conservar el `fingerprint` que produce. El comando comprueba archivos, migraciones locales y rewrites. CI lo ejecuta después del build; no consulta servicios remotos.
   Las ocho migraciones E4–E13 se ensayaron en orden sobre un dump reciente restaurado en un Supabase local aislado: conservaron cuatro estados académicos, siete usuarios Auth y dos metadatos de Storage. El entorno y sus volúmenes se eliminaron. Después se aplicaron remotamente, junto con la corrección operativa probada en PGlite.
4. Pausar el worker anterior y comprobar que no quedan dos consumidores activos. Aplicar las migraciones pendientes en orden de nombre, empezando por E4. Registrar la última migración aplicada. No borrar ni revertir destructivamente tablas/checkpoints.
5. Publicar las funciones Edge generadas desde el mismo árbol de código, incluyendo `api`, `material-process`, `reminders`, `family-consent` y `voice`. Mantener apagados los flags de menores, social, chat y voz hasta sus aprobaciones específicas.
6. Para un piloto controlado sin contratación, iniciar `pnpm worker:local` según [FREE_PILOT_OPERATIONS.md](./FREE_PILOT_OPERATIONS.md). En operación continua, publicar el worker v2 en un alojamiento autorizado. Mantener una sola instancia, comprobar el latido y no imprimir datos académicos.
7. Ejecutar `node scripts/release-preflight.mjs --remote --linked` con la CLI autenticada, o `pnpm release:preflight:remote` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` **solo en un entorno operativo seguro**. Lee `operational_health_read` sin mutar datos y exige el contrato de esquema `20260927020000`, pipeline 2, latido reciente, worker activo y ausencia de señales abiertas. No registrar ni compartir la clave.
8. Validar en staging los recorridos remotos de materiales y autorización antes de promover el cliente. Publicar Vercel y, separadamente, el binario/actualización Android compatible. Anotar los IDs de despliegue y el mismo `fingerprint`.
9. Observar errores, jobs, reportes y latidos. Ampliar cohortes únicamente tras comprobar los gates correspondientes.

`pnpm release:preflight:remote` no puede confirmar la versión de cada función Edge, la revisión legal, una restauración ni el comportamiento Android. El operador debe registrar esas pruebas por separado.

## Si falla

- **Antes de la migración:** reanudar el worker anterior y conservar la web publicada.
- **Después de la migración:** pausar consumidores, mantener cerrado el rollout y aplicar una corrección compatible hacia adelante. No reactivar el worker anterior sobre el esquema v2.
- **Web:** volver al despliegue compatible previo solo si la API conserva su contrato para ese cliente. La base no se revierte eliminando datos.
- **Android:** detener el rollout y distribuir una versión corregida; un binario instalado no se desinstala automáticamente.
- **Datos/autorización:** contener la función afectada, preservar evidencia mínima y usar el procedimiento de incidente antes de reabrir.

Registro mínimo por publicación: responsable, hora, commit, fingerprint, backup de base, backup de objetos, prueba de restore, migración final, versión de funciones, versión/boot del worker, despliegue Vercel, versión Android, resultado de smoke tests y decisión de promoción o contención. Nunca guardar claves o contenido de alumnos en este registro.
