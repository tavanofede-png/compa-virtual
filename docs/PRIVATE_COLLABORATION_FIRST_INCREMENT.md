# Compa Virtual — primer incremento de sesiones privadas

Fecha: 12 de septiembre de 2026. Estado: implementado y validado localmente; pendiente de despliegue y habilitación.

El trabajo se hizo sobre el proyecto existente:

`C:\Users\tavan\Documents\Codex\2026-09-05\haz\outputs\compa-virtual`

Se conservaron los cambios que ya estaban en el árbol de trabajo. No se creó otro producto, no se hizo un commit que incluyera trabajo ajeno y no se modificó la base remota.

## Qué funciona

- **Estudiar → Estudiar juntos** en web y móvil, dentro de la navegación existente.
- Crear grupos privados, invitar integrantes, transferir la organización, quitar integrantes, salir y archivar.
- Invitaciones internas dirigidas a una cuenta mediante su código de compañero. El código permite dirigir una invitación; no concede acceso por sí mismo. No hay búsqueda pública de personas.
- Aceptar, rechazar y revocar invitaciones, con vencimiento a las 24 horas. Las invitaciones pendientes reservan cupo.
- Programar encuentros independientes o asociados a un grupo: título, objetivo, fecha, hora, zona horaria, duración de 15 a 180 minutos, modalidad y ambiente.
- Editar una sesión programada; iniciar, finalizar o cancelar; transferir su organización, quitar participantes o salir.
- Entre dos y seis participantes para iniciar. El organizador puede preparar una sesión antes de recibir aceptaciones.
- Pegar un enlace de Google Meet válido, normalizado y visible en el detalle únicamente para participantes aceptados. La llamada se abre fuera de la aplicación. Finalizar la sesión de Compa no finaliza Meet.
- Catálogo de los seis ambientes del plan: living, sala de estudio, biblioteca, proyectos, patio y terraza. En este incremento son opciones de organización; todavía no se renderizan como mundos 3D compartidos.

Pertenecer al grupo no inscribe automáticamente en sus sesiones. Cada encuentro requiere su propia aceptación. Los materiales, respuestas de prácticas y progreso individual siguen fuera del agregado compartido.

## Arquitectura y controles

La migración `supabase/migrations/20260912203428_private_collaboration.sql` fue generada con Supabase CLI. Crea grupos, membresías, sesiones grupales, participantes, plantillas, instancias, identidades sociales, invitaciones y comprobantes de operación.

Las tablas tienen RLS habilitado y no conceden acceso directo a clientes anónimos ni autenticados. Esta versión usa exclusivamente la API autenticada y funciones SQL con ejecución restringida a `service_role`. La API obtiene la identidad con `auth.getUser`; rechaza campos de actor enviados dentro del comando y comprueba la habilitación de la cuenta.

Las mutaciones usan transacciones, bloqueos por agregado, revisión optimista e idempotencia. Se reservan cupos en la base; un cliente no decide cuántos lugares quedan. Hay límites de invitaciones por emisor: 10 por hora y 30 por día. Se admite un máximo de 20 grupos propios activos, 30 sesiones propias abiertas y 30 integrantes por grupo.

El cliente persiste únicamente comandos pendientes de confirmación, por cuenta, para reintentar una respuesta perdida. No usa una copia offline de participantes o permisos. Los comandos pendientes pueden contener los datos del formulario y se eliminan al confirmar o cerrar sesión. Las pantallas indican que deben actualizarse para ver cambios de otros participantes; aún no usan Realtime.

La exportación de privacidad incluye la información social accesible a la cuenta. Al eliminar una cuenta se cierran sus encuentros abiertos y se archivan sus grupos, conservando el historial de sus compañeros; sus membresías, identificador social e invitaciones se eliminan por las relaciones de la base.

`COLLABORATION_ENABLED=false` es el valor documentado por defecto. La primera beta social admite únicamente mayores de 18 años con perfil completo, independientemente de la habilitación de IA o del flag anterior para menores. La demostración no inventa compañeros ni simula colaboración conectada.

## Verificación realizada

| Comprobación | Resultado |
|---|---|
| Batería completa de Vitest | 64 pruebas aprobadas en 11 archivos |
| Base de datos PostgreSQL/WASM mediante PGlite | Acceso, cupos, invitaciones, idempotencia, revisiones, estados, eliminación y coexistencia con la migración original aprobados |
| TypeScript | Dominio, cliente, servidor, web y móvil sin errores |
| Oxlint | Comprobaciones ejecutadas sin errores |
| Next.js | Compilación de producción y exportación estática correctas |
| Expo Android | Exportación JavaScript/Hermes correcta |
| Expo iOS | Exportación JavaScript/Hermes correcta |
| Navegador, componente real con transporte local de prueba y PostgreSQL | Crear grupo → invitar → aceptar → programar → invitar a la sesión → aceptar → iniciar → finalizar comprobado con dos identidades ficticias |
| Aplicación web compilada | Navegación al nuevo destino y estado de demostración comprobados |

También se prueban enlaces Meet maliciosos, actor falsificado, separación de elegibilidad social y de IA, fechas imposibles y horarios inexistentes o repetidos por cambios de hora.

Las pruebas locales no certifican concurrencia multiconexión en Supabase, autenticación extremo a extremo contra el proyecto remoto, ejecución nativa en teléfonos ni WebGL. El recorrido en navegador se verificó en escritorio. El intento de cambiar el tamaño del navegador integrado no aplicó el tamaño solicitado, por lo que no se da por validado visualmente el diseño responsive.

## Habilitación y siguiente incremento

1. Confirmar el proyecto Supabase y un entorno de prueba de **Compa Virtual**. El conector disponible durante este trabajo solo mostró otro proyecto; no se aplicó la migración allí.
2. Aplicar la migración aditiva en el entorno correcto, desplegar el paquete de la API generado desde `packages/server` y publicar los clientes correspondientes.
3. Con dos cuentas adultas de prueba, verificar autenticación, permisos, revocación, reintentos, aceptación simultánea del último cupo y eliminación de cuenta. Entonces habilitar `COLLABORATION_ENABLED=true` en ese entorno.
4. Continuar con presencia y canales privados Realtime, estados conectando/reconectando, temporizador compartido y cierre coherente entre dispositivos.
5. Incorporar los ambientes 3D de la referencia, avatares y plazas fijas sobre la misma instancia de sesión, con presupuestos de rendimiento y alternativa 2D.

Siguen pendientes del plan amplio: enlaces de invitación con resolución de deep links, notificaciones, Google Calendar/Meet mediante OAuth, tutor y roles pedagógicos, reacciones, presencia real, moderación y bloqueo, política de retención automatizada y habilitación específica para menores.

Para deshabilitar la función basta con apagar el flag del servidor. No se propone borrar las tablas compartidas como rollback: deben conservarse los datos y corregirse mediante una migración posterior.

## Archivos principales

| Área | Archivos |
|---|---|
| Contrato de dominio | `packages/domain/src/collaboration.ts` |
| Persistencia | `supabase/migrations/20260912203428_private_collaboration.sql` |
| API | `packages/server/src/collaboration.ts`, integración en `handler.ts`, bundle en `supabase/functions/api/index.ts` |
| Cliente | `packages/client/src/collaboration.ts`, integración en `index.ts` |
| Web | `apps/web/src/Together.tsx`, `collaboration.css`, `Pages.tsx`, `StudyApp.tsx` |
| Móvil | `apps/mobile/src/Together.tsx`, integración en `apps/mobile/app/index.tsx` |
| Pruebas | `tests/collaboration.test.ts`, `tests/collaboration-database.test.ts`, integración en `tests/database.test.ts` |

Los servidores y cuentas de revisión de `work/` son fixtures locales, no rutas ni cuentas incluidas en la aplicación de producción.
