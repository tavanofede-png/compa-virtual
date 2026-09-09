# Producción 3D en Blender

## Dirección artística

Los compañeros usan un 3D estilizado con construcción voxel suave: silueta adolescente, facciones expresivas, materiales mate, bordes biselados y suficiente detalle para primeros planos. La fuente de producción es Blender y cada entrega conserva un `.blend` editable y un `.glb` optimizado.

El primer modelo maestro es Harper. Se construyó a partir de las vistas frontal, lateral y trasera aprobadas. Su ropa, cabello, rostro, anteojos, mochila y libros están separados en las colecciones `BASE_BODY`, `HAIR`, `OUTFIT` y `ACCESSORIES`.

## Rig compartido

`RIG_Harper` contiene 17 huesos con nombres estables para cabeza, torso, brazos, manos, piernas y pies. La animación `Idle` dura cuatro segundos a 24 FPS y puede reproducirse en bucle. Las próximas variantes deben conservar esta jerarquía para compartir animaciones.

Las piezas rígidas se vinculan al hueso correspondiente. Este enfoque mantiene la forma voxel sin deformaciones blandas en codos, ropa o cabello. Las futuras prendas que necesiten deformación se incorporarán como mallas con pesos sobre el mismo rig.

## Presupuesto para web y teléfonos

El control de exportación exige:

- glTF 2.0 binario válido y autocontenido;
- un máximo de 20.000 triángulos por compañero;
- un máximo de 50 mallas exportadas;
- un máximo de 1,5 MB por GLB de personaje;
- un solo rig y al menos una animación;
- cero imágenes o archivos externos.

La fuente de Blender conserva las piezas editables. Antes de exportar, el script aplica biseles y agrupa piezas que comparten hueso y material para reducir llamadas de dibujo.

## Regeneración

En Windows:

```powershell
powershell -ExecutionPolicy Bypass -File tools/blender/build_harper.ps1
```

El proceso actualiza:

- `packages/assets/3d/source/harper-master-v1.blend`;
- `packages/assets/3d/compa-harper-premium.glb`;
- `packages/assets/3d/previews/compa-harper-premium.png`;
- `packages/assets/3d/source/harper-master-v1.report.json`.

La paleta, proporciones y geometría se definen en `tools/blender/build_harper.py`. El archivo `.blend` también puede abrirse y editarse manualmente; el script sigue siendo la fuente reproducible del primer maestro.

## Primer cuarto: Cozy moderno

`cozy-modern-master-v1.blend` es la primera habitación creada con este flujo. Incluye arquitectura de corte isométrico, ventana con abertura real, cama y textiles ondulados, escritorio, silla, monitor, biblioteca, iluminación, plantas, guitarra, skate, mochila y objetos personales. El área central mantiene un ancla libre para el compañero y las interacciones de estudio.

La fuente separa `ARCHITECTURE`, `BED`, `DESK`, `STORAGE`, `DECOR` y `LIGHTING`. La exportación agrupa geometría por material y entrega un GLB estático de 31 mallas y 40.816 triángulos.

Para regenerarlo en Windows:

```powershell
powershell -ExecutionPolicy Bypass -File tools/blender/build_cozy_room.ps1
```
