# Compa Virtual — colección de seis habitaciones

Seis escenas de Blender editables, a escala métrica y con Harper como referencia de altura. Se conserva el cuarto ampliado: 7,55 × 5,35 m de base, cama a la izquierda, ventana y escritorio al fondo, biblioteca junto al escritorio. Las escenas comparten un lenguaje de formas y todos los objetos detallados del Cozy. Cada variante añade un diseño propio y no elimina objetos para reducir su densidad.

| Habitación | Diseño y objetos propios | Archivo editable |
|---|---|---|
| Cozy moderno | Textiles rosa y salvia, 18 plantas, guirnalda de 35 luces, rincón de lectura, zorro de tela, mochila, guitarra, skate y estudio completo | `room_cozy_premium.blend` |
| Minimalista | Madera clara acanalada, estor plegado, azul gris, archivador de tres cajones, revisteros y lámpara de lectura | `packages/assets/3d/source/rooms/minimalista-master-v1.blend` |
| Tecnología | Tres pantallas, PC con placa y ventiladores, canales de luz azul y violeta, paneles acústicos y mesa de robótica | `packages/assets/3d/source/rooms/tecnologia-master-v1.blend` |
| Naturaleza | Celosía de madera, estor, dos plantas suspendidas en macramé, mesa de cultivo, semilleros, regadera y cuaderno botánico | `packages/assets/3d/source/rooms/naturaleza-master-v1.blend` |
| Urbano | Ladrillos individuales, grises y rojo, ilustración de ciudad, mueble de música con discos y tocadiscos modelado, parlante y pelota de básquet | `packages/assets/3d/source/rooms/urbano-master-v1.blend` |
| Biblioteca moderna | Maderas cálidas, textiles verdes, biblioteca de pared, torre junto al escritorio, banco de lectura con libros y asiento cosido, lámpara de latón y placas de catálogo | `packages/assets/3d/source/rooms/biblioteca-moderna-master-v1.blend` |

## Renders

El Cozy incluye un render principal de 2400 × 1800 y tres acercamientos de 1600 × 1400 en `renders/room-cozy-premium`. Las otras cinco habitaciones incluyen un render principal de 1920 × 1440 en `renders/room-collection/<habitación>/hero.png`.

Todos los renders se producen directamente con Blender Cycles. Los objetos, costuras, hojas, teclas, páginas, farolitos y accesorios son geometría. Las pantallas y los cuadros tienen gráficos originales construidos en capas. No se utiliza una imagen generada como sustituto del modelo 3D.

## Abrir y editar

Abrir el `.blend` correspondiente en Blender 5.2. La cámara principal está seleccionada al guardar. `COMPANION_HARPER` contiene al personaje y su rig; se puede ocultar para editar la habitación. `THEME_*` separa las adiciones particulares de cada variante. Los materiales son editables y las escenas no dependen de bibliotecas enlazadas.

`STUDIO_PREVIEW` contiene auxiliares de presentación: suelo exterior, cámaras y un bloqueador de sombra de techo invisible para la cámara. Ese bloqueador se oculta en el viewport. `WINDOW_EXTERIOR` contiene el pequeño paisaje dentro del vano. Estos elementos se deberán tratar por separado al integrar las escenas en la aplicación.

Harper conserva 17 huesos, una altura medida de aproximadamente 1,74 m y apoyo de pies a 0,18 m. Los estilos del cuarto son independientes del vestuario y de la identidad del personaje.

## Reproducir

Desde la raíz del proyecto:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python-exit-code 1 --python scripts/room_premium_pipeline.py -- --build --preview
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python-exit-code 1 --python scripts/room_collection_pipeline.py -- --theme naturaleza --build --preview
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python-exit-code 1 --python scripts/room_collection_pipeline.py -- --theme naturaleza --render
```

Temas válidos: `minimalista`, `tecnologia`, `naturaleza`, `urbano`, `biblioteca-moderna`. `tools/blender/room_collection_designs.py` contiene sus diseños; `scripts/room_collection_pipeline.py` los construye y renderiza. Los módulos `room_premium_*` generan la base detallada del Cozy.

## Verificación y alcance

Cada construcción comprueba coordenadas finitas, conservación de la fuente, presencia del personaje y una cantidad de objetos igual o superior a la base. Los informes junto a los archivos registran huellas SHA-256, dimensiones, inventario y configuración de render. La entrega incluye los modelos editables, renders y scripts reproducibles. La sustitución de los assets en la aplicación, la exportación final de ejecución y las mediciones en Android/iOS son trabajo de integración posterior; estos maestros conservan el detalle completo solicitado.
