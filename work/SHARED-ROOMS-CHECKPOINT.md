# Salas comunes — pausa de integración por revisión artística

13 septiembre 2026. El usuario exige rehacer los seis ambientes siguiendo la nueva referencia antes de continuar con la tarea funcional. No habilitar el flag ni publicar Vercel hasta terminar esta revisión visual.

## Funcionalidad conservada

- Migraciones private_collaboration, shared_room_runtime y shared_room_privacy_and_retention aplicadas al proyecto oaravhmdvcwcvjnyweig. API con runtime publicada; actualización posterior de privacy.export todavía requiere bundle/deploy.
- COLLABORATION_ENABLED sigue apagado; no se abrieron pruebas a alumnos.
- Siete comprobaciones remotas con cuentas sintéticas aprobaron invitaciones, exclusión de asientos, RLS, avisos privados, timer, idempotencia y revocación. Fixtures borradas.
- Se comprobó la definición SQL de realtime.send: agrega un UUID aleatorio de entrega al payload vacío. No hay contenido de sala en el canal.
- Exportación Android/Hermes aprobada con EXPO_NO_TELEMETRY=1 antes de rehacer assets.
- Cambios de lifecycle, test y privacy.export pendientes de integrar en el siguiente cierre funcional. No perderlos.

## Prioridad actual

scripts/build_shared_spaces_v2.py orquesta tres módulos de autoría, renderiza a renders/shared-spaces-v2, guarda fuentes versionadas y exporta GLB a work/shared-spaces-v2. Comparar los seis con la referencia copiada allí; corregir composición, detalle y colisiones. No sustituir los ambientes públicos hasta ver el resultado.

Próximos pasos tras la revisión: generar plazas de dominio desde los anchors JSON, mantener previews/modelos nativos coordinados, actualizar encuadre, y entonces retomar pruebas/deploy/flag de adultos y documentación de pendientes. La referencia no exige copiar sus textos al producto.

## Cierre visual local 14 septiembre

Seis fuentes v2, seis renders finales, doce GLB y previews incorporados a web/mobile. shared-room-layouts.ts generado desde Blender, revisión rooms-d318ab6deff5. Runtime usa sus plazas y paisajes unlit; OrbitControls limitado al frente del diorama. Galería 4389 sirve comparaciones e inspección GLB. 36 apoyos válidos, 12 assets válidos, 18 tests y typecheck completo pasan. Docs de entrega: SHARED_ROOMS_VISUAL_REBUILD.md.

No publicar aún como beta validada en teléfonos: reduced GLB 15–48 MB, pendiente medir memoria y escena con participantes en hardware nativo. Backend/flag/Vercel siguen en su estado previo; los cambios de privacidad y cleanup guardados siguen pendientes de su cierre funcional.
