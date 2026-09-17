# Revisión artística de las salas comunes

Referencia: captura `codex-clipboard-22a0e136-a2e4-4c53-85ef-513e7c1373c8.png`, proporcionada por el usuario el 13 de septiembre de 2026. La integración funcional queda pausada hasta revisar estos ambientes.

## Comparación y correcciones

| Ambiente | Deficiencia de la primera versión | Reconstrucción requerida |
|---|---|---|
| Living | Sofá recto y dos sillas rígidas; paredes vacías; objetos repetidos | Sofá en L, dos puffs, tapizados con costuras, alfombra, mesa de libros, muebles auxiliares, lámparas, biblioteca y vegetación de distintas alturas |
| Estudio | Mesa aislada con portátiles idénticos, pizarra casi vacía y sin almacenamiento personal | Seis puestos completos, mochila por sectores, apuntes, vasos y útiles, pizarra con ideas, reloj, globo, biblioteca y cubículos |
| Biblioteca | Misma disposición que estudio; libros idénticos y un cuaderno fuera de la mesa | Paredes de estanterías densas, ventana real con paisaje, sillones de lectura, mesa común, lámparas y muebles bajos con libros |
| Proyectos | Sala de estudio recoloreada, cubos como único prototipo | Mesas de taller, taburetes, herramientas, robot/prototipos reconocibles, panel perforado, diagramas, cajoneras, cajas y carros con ruedas |
| Patio | Pérgola demasiado extensa que tapaba toda la sala, plantas pequeñas repetidas y fondo abierto | Pérgola posterior con enredaderas, árboles, faroles, sombrilla, mesa redonda, banco de estudio, canteros floridos y muros de piedra |
| Terraza | Edificios aislados flotando detrás de los sillones y recortados por la cámara | Fondo urbano continuo al atardecer, barandas y pilares, luminarias, fogón, zona de sofás, mesa compartida, materiales y vegetación |

## Fondo y geometría

Los dos paisajes generados viven en `packages/assets/3d/textures/shared-spaces`. Su README conserva herramienta y prompts. Se sitúan detrás de marcos y arquitectura reales. No se usa una imagen completa de la referencia como sustituto de la sala.

Los objetos cercanos son geometría editable en Blender. El fondo distante se convierte a colores de vértice para evitar un requisito nuevo de decodificación de imágenes en Expo. La cámara principal contempla el frente abierto de cada diorama; la rotación libre completa no convierte un fondo de perspectiva única en un mundo exterior de 360°.

## Revisión antes de reemplazar assets

- Comparar las seis vistas completas con la referencia y con sus imágenes anteriores.
- Verificar que las salas se distinguen por arquitectura y objetos, no sólo por colores.
- Revisar el contacto de lámparas, libros, macetas y portátiles con sus superficies.
- Comprobar que las seis plazas existen y coinciden con los muebles.
- Revisar escala y encuadre: sin muebles recortados ni edificios flotantes.
- Exportar overview, fuente `.blend`, modelo completo, versión reducida y metadata por sala.
- Generar las plazas del dominio desde la metadata final; no conservar coordenadas viejas.

Las imágenes de revisión deben provenir de los `.blend` exportables. No se presentarán los fondos generados ni una ilustración de concepto como si fueran el render del modelo terminado.

## Entrega local — 14 septiembre 2026

Las seis composiciones se reconstruyeron y exportaron a Blender, GLB completo, GLB reducido y preview. Se preservaron los renders anteriores para comparación. Los paisajes de patio, biblioteca y terraza están integrados detrás de marcos y arquitectura; el resto de la sala permanece en geometría editable.

Se corrigieron las juntas coplanares negras, los puffs puntiagudos, una lámpara superpuesta a libros, la cartela oculta y la orientación del librero bajo de la biblioteca. El contacto ambiental está calculado en vértices; los fondos conservan sus colores sin recibir iluminación duplicada en Three.js.

Los archivos locales de web y Expo usan los nuevos GLB y previews. Las 36 plazas se generan desde la metadata de Blender; se corrigieron dos posiciones del living para centrarlas en almohadones. La revisión de apoyo contempla cuatro puntos por pelvis para admitir bancos de listones.

Validación ejecutada: 12 GLB válidos con normales y colores, 36 apoyos físicos, 18 pruebas de assets/runtime/ciclo de vida aprobadas y TypeScript aprobado en todos los paquetes. Galería: `http://127.0.0.1:4389/`, con comparación anterior y exploración 3D. Reportes en `renders/shared-spaces-v2/asset-validation.json` y `geometry-validation.json`.

Esta entrega es local: no se publicó en Vercel ni se habilitó colaboración a alumnos. El rendimiento con participantes en teléfonos físicos sigue pendiente. Los GLB reducidos pesan entre 15 y 48 MB; la prioridad de esta revisión fue conservar detalle y objetos. El render en tiempo real usa iluminación más sencilla que Cycles, por lo que no se afirma equivalencia visual exacta con la ilustración de referencia.

Reproducción: Blender con `scripts/build_shared_spaces_v2.py -- all`; luego ejecutar los validadores y `node scripts/stage-shared-spaces.mjs --v2`. El staging genera `shared-room-layouts.ts` y una revisión de caché basada en el contenido.
