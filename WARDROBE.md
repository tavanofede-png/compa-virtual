# Compa Virtual — guardarropa de las dos láminas

Biblioteca editable de 182 productos distintos, con correspondencia explícita a 206 apariciones en las referencias. Incluye todas las familias ilustradas: remeras, mangas largas, buzos, sweaters, camperas, pantalones, shorts, zapatillas, botas, sombreros, anteojos, auriculares, mochilas, bolsos, accesorios y objetos de estudio, escritorio, hobbies y premios.

Se reconstruyeron las formas en Blender con patrones propios para el rig existente. Los estampados, los cierres, las costuras y los cordones tienen geometría; no son imágenes pegadas sobre siluetas vacías. La interpretación conserva la familia, la paleta y el motivo de cada producto, sin afirmar una reproducción idéntica de cada píxel del dibujo.

## Abrir y revisar

- `packages/assets/3d/wardrobe/source/compa-wardrobe-library.blend`: biblioteca completa, con cada producto marcado como activo de Blender. Las colecciones `ITEM__...` contienen las piezas. Solo un conjunto se muestra inicialmente; el resto está oculto para evitar superposiciones.
- `packages/assets/3d/wardrobe/source/{personaje}-wardrobe-fitted.blend`: ocho copias vestidas, conservando rostro, pelo, proporciones y rig.
- `packages/assets/3d/wardrobe/glb/`: un archivo GLB por producto, con materiales PBR incluidos y sin texturas externas.
- `packages/assets/3d/wardrobe/body-fits/`: piel continua de brazos y piernas, en los ocho tonos, para reemplazar los segmentos anteriores al usar remeras y shorts.
- `WARDROBE_GALLERY.md`: vistas de todos los grupos y de los ocho conjuntos, renderizadas desde los modelos.
- `catalog.json`, `inventory.csv` y `wardrobe.audit.json`: inventario, referencias, componentes, tamaños de exportación y comprobaciones.

## Calce y movimiento

Los ocho cuerpos actuales comparten exactamente las coordenadas del esqueleto `compa-humanoid-v2` y las envolventes de brazos y piernas. Cada uno conserva su escala final medida. Las prendas usan ese espacio común de reposo; no se escalan según el bounding box de una captura.

Las mangas tienen una copa cerrada en el hombro y anillos continuos de geometría en el codo, con pesos normalizados entre brazo y antebrazo. Los pantalones distribuyen pesos alrededor de la rodilla. Las piezas rígidas se vinculan a sus huesos correspondientes: calzado a cada pie, anteojos y gorras a cabeza, mochilas y bolsos a columna, pulseras y reloj a la mano derecha.

Las remeras y los shorts exponen piel continua. En las copias vestidas se ocultan los antiguos bloques de brazos y piernas; no se superponen ambas versiones. La mano izquierda de Harper, originalmente modelada alrededor de libros, usa una copia reflejada de su mano derecha para el conjunto sin libros. Los originales v4 no se sobrescriben.

Las gorras y gorros requieren la variante de pelo comprimido dentro de la copa. El flequillo inferior conserva su forma. El pelo largo posterior se recoge en el volumen de hombros cuando hay mochila. Esto evita aumentar artificialmente el tamaño del gorro para envolver un rodete completo. Las adaptaciones están en las copias vestidas y en `wardrobe_pipeline.py`.

## Reglas de combinación

Un producto por ranura vestible. Se requiere prenda superior o campera, parte inferior y calzado. Una campera completa oculta la prenda superior interna para evitar superficies superpuestas; su cuello y su construcción son propios. No se muestran simultáneamente dos mangas distintas ocupando el mismo lugar.

Auriculares y collares comparten ranura de cuello. Los auriculares están diseñados para llevarse alrededor del cuello, como en la segunda lámina; no se anuncian como un modelo ajustado sobre todos los peinados. Los adornos pequeños llevan anclaje en la cintura. Los objetos de escritorio y hobbies son piezas independientes en metros, no prendas que deban adherirse al cuerpo.

## Crear otro conjunto en Blender

Desde la raíz del proyecto, usando Blender 5.2:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python scripts/dress_companion.py -- harper sweater-ivory-cable cargo-black-plain sneaker-red-panel glasses-black-rect
```

El resultado se guarda en `packages/assets/3d/wardrobe/custom/harper-custom.blend`. Los identificadores aceptados están en el inventario. El script carga una copia preservada del personaje, asigna las piezas a su rig, adapta el pelo y aplica las máscaras de cuerpo.

## Contrato para integrar en la aplicación

Los GLB están en espacio de reposo canónico, escala 1. Blender utiliza Z arriba y frente -Y; glTF utiliza Y arriba y frente +Z. El origen corresponde al rig del personaje, no al centro individual de una manga. El archivo `body-measurements.json` contiene las matrices y las escalas de cada personaje.

Al cargar una prenda, se deben vincular sus joints por nombre al esqueleto del avatar, preservar las matrices inversas de reposo, aplicar la transformación del rig del personaje y retirar el rig de transporte del archivo. No se debe animar un segundo esqueleto separado ni volver a multiplicar la escala. Cada malla exporta `compa_item`, `compa_slot`, `compa_component` y `compa_schema` como extras.

Antes de cambiar una ranura, se debe retirar su producto anterior y aplicar las máscaras de cuerpo/pelo indicadas en el catálogo. Las gorras y el pelo adaptado deben cambiar juntos. Los GLB de piel continua deben reemplazar los miembros anteriores para mostrar brazos y piernas sin huecos.

Esta entrega crea los activos y las herramientas de ajuste. El selector de prendas, el guardado de elecciones y su conexión al visor de la app todavía deben integrarse. No se ha medido su rendimiento en un teléfono Android. El conjunto completo de GLB ocupa aproximadamente 92 MB sin comprimir; la aplicación debe cargar solo el conjunto elegido. Las prendas tejidas con relieve son las más pesadas y pueden necesitar una versión de menor detalle para dispositivos modestos.

## Comprobaciones y límites

- Cobertura de las 206 apariciones, 182 IDs únicos y archivos verificables mediante SHA-256.
- Contenedores glTF 2.0, posiciones finitas, joints válidos, pesos normalizados y ausencia de extensiones obligatorias.
- Correspondencia de las envolventes y huesos de los ocho cuerpos con el patrón canónico.
- Pruebas numéricas en reposo, flexión de codos, marcha y alcance para cada conjunto de ejemplo.
- Revisión visual de los ocho conjuntos, de las láminas de catálogo y de poses de manga larga/corta.

Estas comprobaciones no equivalen a una simulación de tela ni a una prueba exhaustiva de colisiones para cualquier animación futura. Las poses nuevas y las combinaciones adicionales deben revisarse al incorporarlas. El informe distingue las verificaciones numéricas de la revisión visual.

## Reproducir

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python scripts/wardrobe_pipeline.py -- build
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python scripts/wardrobe_pipeline.py -- fit all
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python scripts/wardrobe_pipeline.py -- export
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python scripts/export_wardrobe_body_fits.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\5.2\python\bin\python.exe' tools/blender/audit_wardrobe.py
```

Los archivos fuente de los ocho personajes están incluidos en el paquete para que el ajuste no dependa de rutas externas. La generación es local; no necesita cuentas ni servicios de generación 3D.
