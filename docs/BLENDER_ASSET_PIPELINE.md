# Personajes Blender · revisión geométrica v4

Esta revisión reconstruye la colección existente sobre copias de los maestros v3. La geometría, las auditorías y los renders son producidos por Blender 5.2.1. Las imágenes son renders de los modelos entregados.

## Archivos de trabajo

- `character_master_premium.blend`: Harper editable, organizado por slots, en pose neutra, con cámaras y estudio Cycles.
- `packages/assets/3d/source/{id}-master-v4.blend`: los ocho maestros; Harper se conserva también aquí.
- `packages/assets/3d/compa-{id}-premium.glb`: exportaciones autocontenidas con rig y animación Idle.
- `renders/character_hero.png`: Harper a 2048 × 2048, Cycles 256 muestras, denoise, AgX Medium High Contrast, 65 mm y f/8. La pose de presentación sostiene los cuadernos; el maestro permanece neutro.
- `renders/character_{front,side_left,back,side_right,3quarter,3quarter_back}.png`: seis cámaras a la misma distancia, focal, altura y escala de salida de 1024 px.
- `renders/details/{face,hair,glasses,backpack,books,shoes}.png`: primeros planos de la geometría real, 1024 px y Cycles 64 muestras.
- `renders/poses/harper/`: siete pruebas de pose independientes del Idle del maestro.
- `renders/silhouettes/`: cinco ángulos para leer el contorno.
- `packages/assets/3d/previews/compa-{id}-premium.png`: vistas de toda la colección, 64 muestras a 1024 px, excepto el hero de Harper.

Los originales `*-master-v3.blend` se abren solamente como entrada. La primera escritura del proceso crea una copia; el hash SHA-256 del original se verifica al terminar. Los v2 y el respaldo original también se conservan. Repetir la construcción vuelve a partir de v3: no acumula accesorios ni biseles sobre una ejecución anterior.

## Construcción geométrica

El pelo tiene masas de raíz y numerosos mechones escalonados, con secciones, solapamientos y capas laterales y posteriores. Los estilos largos, rizados, recogidos y con gorro conservan variantes propias. El rostro utiliza una malla continua para mandíbula y mentón; los ojos tienen esclerótica, iris, pupila, párpados y reflejos separados. Las gafas incluyen aros abiertos, lentes, puente, patillas y bisagras.

Las prendas tienen siluetas trazadas por anillos, cuellos, aberturas, puños, costuras y dobladillos. Ambas mangas son mallas continuas con pesos sobre brazo y antebrazo. Esto reemplaza la unión de dos bloques rígidos que dejaba bordes visibles en el codo. Los pantalones tienen volumen de cadera, variación de ancho, pliegues, bolsillos y bajos. El calzado incorpora tres capas de suela, empeine, talón, lengüeta, ojales y cordones cruzados.

La mochila tiene carcasa, compartimentos, bolsillos, tirantes acolchados, asa abierta, ajuste y dientes de cierre. Los tres cuadernos de Harper incluyen tapas, lomo, bloque de hojas, cortes de página y etiquetas. Su mano izquierda envuelve el borde de los cuadernos y el conjunto sigue `hand.L`.

La malla editable de Harper pasa de 1.456 a 13.414 vértices antes de evaluar los modificadores. El aumento está en piezas y superficies nuevas; no proviene de una subdivisión global. La cara, los mechones y las prendas mantienen superficies planas con biseles pequeños.

## Rig, escala y ropa intercambiable

Se conserva `compa-humanoid-v2`: 17 nombres, jerarquías y matrices de reposo. La escala del objeto rig se normaliza antes de vincular las nuevas prendas, conservando las posiciones mundiales de las piezas existentes. Al terminar se aplica una escala uniforme al conjunto para que la estatura medida, incluyendo pelo y calzado, corresponda al personaje. El suelo queda en Z = 0 en Blender; glTF utiliza Y como vertical.

Slots: `body`, `hair`, `face_accessory`, `top`, `bottom`, `shoes`, `back`, `hand_prop`. Los slots vacíos son puntos de extensión, no objetos ficticios. Cada objeto mantiene `compa_slot` y `compa_item`. Los maestros mantienen piezas rígidas vinculadas a huesos y mangas con modificador Armature. Los GLB convierten las piezas rígidas a pesos de un solo hueso; las mangas conservan pesos mezclados. Esta conversión evita los desfases de exportación de piezas con parenting directo a huesos.

El exportador agrupa solamente dentro del mismo slot, item y hueso. Mezclar pelo con cejas o ropa con mochila rompería el cambio de prendas, aunque compartieran material. La prueba de exportación comprueba el hueso esperado de cada lote rígido y la presencia de pesos mezclados en las mangas.

Las prendas nuevas deben construirse sobre el rig canónico y probarse en cada cuerpo y pose que vayan a usar. El esquema compartido no garantiza que cualquier combinación de ropa, pelo largo y mochila quede libre de intersecciones. Esta entrega valida el conjunto inicial; no implementa un probador universal de ropa.

## Exportación y comprobación

El GLB de ejecución conserva todas las piezas diseñadas y usa un segmento de bisel. El maestro conserva dos segmentos para primeros planos. El límite comprobado por asset es 80.000 triángulos, 40 mallas y 5,8 MB, con un rig, Idle y sin archivos externos. Los ocho archivos miden entre 4,49 y 5,58 MB tras empaquetar índices, articulaciones y pesos; las posiciones se conservan. El presupuesto anterior de 4,6 MB no cubría los peinados más densos junto con los datos de skinning de todas las prendas. Se amplió para conservar el detalle autorizado. Son límites de contenido: todavía se necesita medir FPS, memoria y tiempo de carga en los teléfonos objetivo. Una malla puede contener varios materiales; mallas y llamadas de dibujo no son equivalentes.

Los materiales exportados usan factores PBR. Los pequeños relieves procedurales de Blender no se presentan como texturas horneadas: no hay un atlas de textura único terminado. Las mallas nuevas aún requieren desplegado UV específico si se van a pintar o a hornear texturas. Las lentes requieren soporte de transmisión en el visor de ejecución; distintos visores pueden mostrar diferencias respecto a Cycles.

Se producen inventarios antes y después (`*-v4-before.audit.json`, `*-v4-after.audit.json`) con mallas, modificadores, UV, materiales, grupos, shape keys, padres, escalas y estado del rig. La validación mueve brazos, codos, rodillas, cabeza, torso y manos, y restaura pose, acción, frame, NLA y modos de rotación. Las muestras de cobertura de mangas son una ayuda numérica, no una garantía de ausencia de colisiones.

`collection-v4-export.audit.json` se genera abriendo cada GLB en una escena vacía. Comprueba altura y suelo, huesos, pesos, slots y geometría finita en cinco momentos del Idle. Su hash se compara con el binario en los tests para evitar que un informe viejo certifique un archivo nuevo. Los renders de pose y detalles completan la revisión visual.

## Reproducción

Desde la raíz del proyecto en PowerShell:

```powershell
./tools/blender/build_companion_collection.ps1 -Character all -Mode full
./tools/blender/build_harper.ps1 -Mode build
./tools/blender/build_harper.ps1 -Mode render
./tools/blender/build_harper.ps1 -Mode presentation
./tools/blender/build_harper.ps1 -Mode poses
```

El script principal es `scripts/character_premium_pipeline.py`; los módulos de detalle y validación están en `tools/blender/premium_face_hair.py`, `premium_garments.py` y `premium_validation.py`. La exportación usa procesos independientes de Blender por personaje. `build_companion_collection.py` conserva la construcción histórica v3 y sirve como dependencia de paletas/tipos; no es el comando de entrega v4.

## Habitación Cozy

Se conserva `cozy-modern-master-v1.blend` y el cuarto ampliado con biblioteca junto al escritorio. Su GLB tiene 31 mallas y 46.468 triángulos. El ancla del avatar es `[0.85, -0.42, 0.20]` en Blender y `[0.85, 0.20, 0.42]` en glTF. Esos 20 cm corresponden a la base elevada del cuarto y no deben sumarse a la altura declarada del personaje.

Esta revisión entrega fuentes, modelos y evidencias de revisión. Publicar el sitio, compilar el APK y medir el render en un teléfono son pasos de integración distintos de la producción de estos assets.
