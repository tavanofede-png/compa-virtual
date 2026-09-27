# Espacios individuales 3D: generación y validación

Los ocho ambientes se conservan como maestros editables en `packages/assets/3d/source/personal-spaces/v1`. Sus GLB de origen y vistas aprobadas están en `design/personal-spaces-v1`. El cliente carga una variante móvil por ambiente desde `apps/web/public/selection/study-spaces`; no incluye los maestros en el bundle Android.

## Reproducir una variante

Para cada ID (`library`, `terrace`, `pergola`, `cafe`, `minimal`, `tech`, `pavilion`, `loft`):

1. Con Blender 5.2, ejecutar `blender -b --python scripts/extract_personal_study_materials.py -- <id>`. Este paso registra el color de madera del maestro; el shader procedural de Blender no se exporta a glTF.
2. Ejecutar `blender -b --factory-startup --python scripts/optimize_personal_study.py -- <id> mobile`. El resultado queda en `work/study-runtime-candidates` y no modifica el maestro.
3. Renderizar con `blender -b --factory-startup --python scripts/render_study_candidate.py -- <id> mobile` y compararlo con `<id>-model-hero.png`. Revisar estructura, objetos, color, asiento y circulación antes de promoverlo.
4. Ejecutar `pnpm assets:study-stage`. Rechaza una StudyZone inválida o un GLB de 95 MB o más, compacta normales y UV dentro de 0–1 sin mover vértices ni retirar objetos, y escribe los ocho GLB junto al manifiesto SHA-256 y los puntos de asiento derivados de los layouts. Los UV fuera de rango se conservan en float para respetar texturas repetidas. El GLB usa `KHR_mesh_quantization`, admitido por el `GLTFLoader` actual.
5. Ejecutar `pnpm assets:study-verify`, `pnpm typecheck`, `pnpm lint` y `pnpm build`.

El manifiesto de runtime se valida también antes del build web. El nombre de caché nativa incorpora el hash de contenido. La app descarga cada escena solo al entrar, verifica su longitud y conserva hasta 250 MiB de escenas en caché. Una descarga fallida deja disponible el modo foco y ofrece reintento. La posición y la ropa del compañero se obtienen del estado guardado; la mascota no aparece en estos espacios. Tocar el escritorio o asiento abre una sesión, una pantalla abre materiales, los libros llevan a aprendizaje y tocar al compañero abre la conversación. Estas acciones tienen botones equivalentes fuera de la escena.

La compactación bajó el lote móvil de 301,4 a 205,3 MB (31,9 % menos). Pérgola pasó de 86,8 a 57,5 MB. Los renders Blender de Pérgola y Ático compactados difirieron de sus variantes móviles previas en promedio 0,014 y 0,009 niveles por canal sobre 255, respectivamente; posiciones, índices, nodos y materiales permanecieron iguales. Esto reduce transferencia y algunos atributos, pero **no reduce los 1,35 millones de triángulos de Pérgola ni demuestra FPS o RAM aceptables en Android**. En Android hay un control automático/liviano/detallado de resolución de render sin quitar objetos; las escenas individuales inmóviles no solicitan fotogramas continuos.

## Gate que todavía falta

La inspección web local confirmó carga sin error de los ocho GLB y encuadre visual de Biblioteca y Ático. Eso no certifica Android. Antes de aprobar E7/E8 hay que medir cada ambiente en teléfonos de gama baja, media y actual: descarga fría/caliente, RAM/PSS, FPS p95, temperatura, liberación tras 20 entradas/salidas, acciones al tocar objetos y contacto del personaje con cada StudyZone. La Pérgola sigue siendo el caso más pesado (54,8 MiB compactados; 1,35 millones de triángulos). Si falla, producir una variante `REDUCED` de geometría adicional manteniendo su arquitectura y sus objetos reconocibles. Falta la comprobación nativa firmada.
