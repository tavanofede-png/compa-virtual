# Rediseño y habitación animada — estado de integración

Actualizado: 10 de septiembre de 2026. Implementación en curso; no equivale a aceptación de beta.

## Implementado

- Tokens compartidos marfil, azul marino y amarillo; Outfit variable incluida localmente con licencia OFL.
- Navegación Inicio, Agenda, Estudiar, Logros y Compa en web y Expo. Rutas web anteriores conservadas; historial de navegación y retorno del navegador.
- Inicio y Compa extraídos en componentes por plataforma. Resumen calculado a partir de obligaciones y bloques del plan aceptado, sin datos de ejemplo en cuentas reales.
- Landing con once secciones, catálogo existente, selección de habitaciones y exploración 3D opcional.
- Preferencia local de movimiento, accesibilidad y pausa de escena web al quedar fuera de pantalla, ocultar pestaña o abrir otros recorridos. Pausa nativa por AppState.
- Biblioteca compartida de 13 clips y controlador por nombres del rig. Acciones accesibles, caminos con obstáculos, prioridad de órdenes en posturas estables, accesorios temporalmente apoyados sin modificar Snapshot.
- Seis nuevos renders de los maestros de habitaciones sin un personaje antiguo incrustado. Previews web y nativos sincronizados.
- Vista de revisión mobile-preview.html con anchos reales seleccionables de 360, 390 y 430 px.
- Regla local y bundle de servidor sin nuevos descuentos por check-in. Historial y saldos anteriores conservados.

## Evidencia y límites

| Comprobación | Resultado |
|---|---|
| TypeScript de los siete paquetes/aplicaciones | Pasa |
| Lint | Pasa |
| Vitest | 44 pruebas en 8 archivos, pasan |
| Exportación estática web | Pasa también tras los últimos ajustes visuales |
| Exportación Metro/Hermes Android | Pasa; no es un APK |
| Exportación Metro/Hermes iOS | Pasa; no es una compilación firmada ni prueba en iPhone |
| Inicio web a 360, 390 y 430 px | Revisado visualmente dentro del marco de celular |
| Compa y ajustes web | Navegación, preferencia y acceso a cerrar sesión comprobados |
| Animaciones en ocho GLB y rutas de seis cuartos | Pruebas programáticas; no certifican ausencia de clipping de todas las prendas |
| Poses finales Milo/Cozy | Renders de control de silla y cama revisados |
| Transiciones completas y las 144 prendas | Pendiente revisión visual exhaustiva |
| Android/iOS en dispositivos, FPS y consumo | Pendiente |
| Recorridos completos con dos cuentas | Pendiente |
| Check-in remoto sin descuentos | NO desplegado |
| Publicación Sites | Conexión recuperada; nueva versión no publicada |

El acceso a la función remota de Supabase fue bloqueado por la revisión automática al alcanzar el límite de uso de la herramienta. No se afirma que la regla remota haya cambiado. Los clientes conectados conservan la advertencia existente hasta desplegar el servidor.

## Archivos de producción

- packages/domain/src/presentation.ts: tokens, destinos y cálculo del inicio.
- apps/web/src/HomeScreen.tsx y apps/mobile/src/HomeScreen.tsx: inicio y Compa.
- apps/web/app/redesign.css: sistema visual web.
- packages/world3d/src/motion.ts y room-maps.json: comportamiento y navegación.
- scripts/build_companion_motion.py: generación reproducible desde maestros Blender.
- packages/assets/3d/motion/companion-motion-library.blend: acciones editables.
- packages/assets/3d/motion/*-interactions.blend: mapas editables aislados de los maestros.
- scripts/render_room_posters.py: renders de catálogo.

## Próximo cierre técnico

1. Refinar aproximación lateral a silla y transición por borde de cama, con revisión de ropa y accesorios. Las interpolaciones actuales aún necesitan ese acabado.
2. Validar todos los recorridos, texto ampliado, teclado, retorno Android en dispositivo, desconexión y conflictos. Revisar pausa nativa al desplazar la escena fuera del viewport.
3. Desplegar primero el servidor sin descuentos; después actualizar la explicación de check-in de ambos clientes.
4. Compilar APK con EAS y revisar rendimiento real en Android/iOS.
5. Publicar el sitio existente después de los controles finales, sin cambiar sus permisos.
