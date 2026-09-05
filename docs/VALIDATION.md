# Validación y estado de entrega

## Comprobado en este entorno

- TypeScript para dominio, cliente, servidor, web, móvil y worker.
- Export estático de Next.js.
- Export de Metro/Hermes para Android e iOS. Son bundles, no binarios firmados.
- Tests de planificador, gamificación, documentos y PostgreSQL con pgvector/RLS.
- Prueba de navegador de la demo anterior: ingreso, propuesta de plan, aceptación, sesión declarada, recompensa, quiz con intento incorrecto y corrección. No certifica la nueva escena 3D.
- Geometría de adolescentes y habitación: seis peinados, volumen real, presupuesto de mallas/triángulos, conservación de datos y 18 archivos GLB válidos. La revisión actual no incluyó pruebas visuales automatizadas de navegador ni evaluación en teléfonos físicos.

Resultado local: **34 pruebas aprobadas en 6 archivos**, TypeScript y lint sin errores. Se comprueban además el export estático de Next.js y los bundles de Expo, que no equivalen a binarios firmados. Las funciones del backend se regeneran para validar y conservar las nuevas apariencias. `pnpm audit --prod --audit-level low`: sin vulnerabilidades conocidas al momento de la revisión. Las pruebas automáticas usan datos ficticios y, para el contrato de OpenAI, respuestas de prueba explícitas.

Las pruebas incluyen pérdida de respuesta y reinicio del cliente, versiones en conflicto, monedas idempotentes, reintentos de cola sin duplicación, recuperación espaciada de tarjetas, lectura real de PDF/DOCX de prueba, referencias y aislamiento de búsqueda vectorial. El transporte pgmq se representa mediante un fixture instrumentado: comprobar una única solicitud de envío no certifica la entrega real.

Se actualizaron esbuild y uuid. Expo Router consume query-string 9.5.1 con un parche reproducible que conserva los exports de su API anterior; una prueba comprueba parse/stringify y entradas con porcentajes malformados.

## Pendiente antes de beta

| Área              | Comprobación requerida                                                              |
| ----------------- | ----------------------------------------------------------------------------------- |
| Supabase real     | Aplicar migración y repetir aislamiento con dos cuentas                             |
| OpenAI            | Configurar clave, verificar modelo, evaluar respuestas y controles de datos         |
| Worker desplegado | Archivos reales de prueba, reinicios, reintentos y limpieza de trabajos             |
| Correo            | Confirmación, recuperación y entregabilidad con SMTP configurado                    |
| Android/iOS       | Compilación firmada, instalación y recorrido completo en ambos teléfonos            |
| Push              | Permisos concedidos/denegados, app cerrada, quiet time, tokens revocados y receipts |
| Offline           | Inicio sin red tras uso previo, consultas y rechazo claro de mutaciones             |
| Privacidad        | Exportación HTTP, cuenta con archivos en cola, fallos de limpieza y reintentos      |
| Pedagogía         | Aprobación del equipo sobre métodos, prompts y casos                                |
| Jurídico          | Consentimiento, titular, políticas y transferencias revisados                       |
| Tiendas           | Identificadores, EAS, TestFlight y Google Play testing                              |

No se declara la beta lista para alumnos mientras estas comprobaciones falten. El resultado publicado en Sites, si se publica sin backend, es una demostración privada de desarrollo.

La eliminación debe probarse también con una URL de subida firmada emitida antes de solicitar el borrado. Si Supabase permite completar esa subida después de borrar la cuenta, debe añadirse una limpieza de objetos huérfanos antes de habilitar alumnos. La comprobación no se puede resolver con el fixture local de Storage.
