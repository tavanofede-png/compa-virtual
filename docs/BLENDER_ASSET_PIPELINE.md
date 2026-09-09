# Producción 3D en Blender

## Dirección artística

Los compañeros usan un 3D estilizado con construcción voxel suave: silueta adolescente, facciones expresivas, materiales mate, bordes biselados y suficiente detalle para primeros planos. La fuente de producción es Blender y cada entrega conserva un `.blend` editable y un `.glb` optimizado.

La colección de producción incluye a Nova, Jay, Milo, Zoe, Sky, Harper, River y Aria. Los rostros tienen planos de mandíbula, párpados, nariz, labios y orejas; la ropa incorpora puños, costuras, ribetes, bolsillos, cierres y cordones. Cada `.blend` mantiene cuerpo, cabello, accesorio facial, prenda superior, prenda inferior, calzado, espalda y objeto de mano en colecciones separadas.

## Rig compartido

El esquema `compa-humanoid-v2` contiene 17 huesos con nombres estables para cabeza, torso, brazos, manos, piernas y pies. La animación `Idle` dura cuatro segundos a 24 FPS y puede reproducirse en bucle. Todos los compañeros usan esta jerarquía y alturas reales entre 1,64 y 1,78 m.

Las piezas rígidas se vinculan al hueso correspondiente. Este enfoque mantiene la forma voxel sin deformaciones blandas en codos, ropa o cabello. Las futuras prendas que necesiten deformación se incorporarán como mallas con pesos sobre el mismo rig.

## Presupuesto para web y teléfonos

El control de exportación exige:

- glTF 2.0 binario válido y autocontenido;
- un máximo de 15.000 triángulos por compañero;
- un máximo de 60 mallas exportadas;
- un máximo de 1,2 MB por GLB de personaje;
- un solo rig y al menos una animación;
- cero imágenes o archivos externos.

La fuente de Blender conserva las piezas editables. Antes de exportar, el script aplica biseles y agrupa piezas que comparten hueso y material para reducir llamadas de dibujo.

## Regeneración

En Windows:

```powershell
powershell -ExecutionPolicy Bypass -File tools/blender/build_companion_collection.ps1 all
```

El proceso crea un `.blend`, un `.glb`, una vista PNG y un informe JSON por compañero. `packages/assets/3d/companion-collection.json` registra estaturas, rutas, presupuesto y los ocho slots compatibles. `packages/assets/3d/previews/companion-collection-premium.png` permite revisar la colección completa. También se puede regenerar un solo personaje pasando su identificador, por ejemplo `harper`.

Las paletas, proporciones y variantes se definen en `tools/blender/build_companion_collection.py`. `tools/blender/build_harper.ps1` se conserva como acceso directo a la versión v2 de Harper.

## Contrato para prendas intercambiables

Las prendas nuevas deben usar el rig `compa-humanoid-v2`, escala métrica y uno de estos slots: `top`, `bottom`, `shoes`, `back`, `face_accessory` o `hand_prop`. La envolvente corporal deja 12 mm de holgura y los archivos maestros conservan todas las piezas sin agrupar. La agrupación por hueso y material ocurre únicamente en el GLB destinado a ejecución.

Los puntos de referencia son: cadera a 0,78 m, hombros a 1,23 m, cuello a 1,36 m, tobillos a 0,12 m y suelo a 0 m en la estatura canónica de 1,75 m. La escala final del rig ajusta las distintas estaturas sin cambiar esos anclajes.

## Primer cuarto: Cozy moderno

`cozy-modern-master-v1.blend` es la primera habitación creada con este flujo. Incluye arquitectura de corte isométrico, ventana con abertura real, cama y textiles ondulados, escritorio, silla, monitor, biblioteca, iluminación, plantas, guitarra, skate, mochila y objetos personales. El área central mantiene un ancla libre para el compañero y las interacciones de estudio.

La fuente separa `ARCHITECTURE`, `BED`, `DESK`, `STORAGE`, `DECOR` y `LIGHTING`. La exportación agrupa geometría por material y entrega un GLB estático de 31 mallas y 46.468 triángulos. La segunda revisión amplía el cuarto hacia la derecha para colocar la biblioteca junto al escritorio, usa tablas con juntas escalonadas y agrega paisaje exterior, parlantes, costuras y más detalle superficial. El cuarto tiene 3,08 m de altura y el ancla del personaje está documentada en el manifiesto; la vista `harper-in-cozy-room-scale-check.png` comprueba la relación con cama, escritorio y circulación.

Para regenerarlo en Windows:

```powershell
powershell -ExecutionPolicy Bypass -File tools/blender/build_cozy_room.ps1
```
