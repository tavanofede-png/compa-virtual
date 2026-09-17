# Habitación Cozy — versión 2

Escena editable de Blender construida sobre `cozy-modern-master-v1.blend`. Mantiene la cama a la izquierda, el escritorio al fondo, la biblioteca a su lado, la ventana y la escala métrica. La dirección artística toma la calidez y la densidad de la referencia del usuario y desarrolla una identidad propia: observaciones botánicas, pequeños mundos y proyectos en curso.

## Entrega

- `room_cozy_premium.blend`: escena completa con Harper, cámaras y luces.
- `packages/assets/3d/source/cozy-modern-master-v2.blend`: copia versionada del maestro.
- `renders/room-cozy-premium/hero.png`: render principal de 2400 × 1800.
- `renders/room-cozy-premium/desk.png`, `bed.png`, `lounge.png`: primeros planos de 1600 × 1400.
- `packages/assets/3d/source/cozy-modern-master-v2.report.json`: inventario, medidas, versión de Blender y huella de la fuente original.

La versión 1 permanece intacta. Los nuevos objetos son geometría editable; no hay fondos pegados sustituyendo el cuarto ni detalles de muebles pintados en una imagen.

## Cambios de diseño

La cama tiene cuatro capas textiles cerradas, costuras, doble almohada, almohadones, borlas y un pequeño zorro de tela. El centro reúne una alfombra trenzada, un puff con paneles cosidos, una mesa de lectura y libros. La composición conserva circulación alrededor del personaje.

Se modelaron 18 plantas con macetas huecas, tierra, hojas con espesor, nervaduras y cascadas colgantes. La biblioteca combina libros encuadernados de diferentes tamaños y posiciones, un globo, un trofeo hueco, fotografías y cajas. Se añadieron una caja baja de proyectos y lecturas junto a la cama.

El escritorio incorpora un teclado de 47 teclas, mouse, cables, cuaderno abierto con espiral y escritura geométrica, lápices afilados, taza hueca, lámpara articulada y auriculares. El respaldo de la silla se corrigió para orientarse hacia el escritorio. La mochila tiene cremalleras, tiradores, costuras y botella; la guitarra tiene caja con abertura, cuerdas, trastes y clavijas; el skate tiene ejes y ruedas.

Las paredes reúnen arte original en capas, un calendario semanal, notas, fotos, reloj y 35 farolitos unidos por un cable. Se reconstruyó la abertura real de la ventana, antes parcialmente obstruida. El exterior se mantiene dentro de ella como un pequeño paisaje de geometría; su sombreado de emisión evita que la iluminación interior lave sus colores.

## Escala y presentación

Blender usa metros. Harper conserva su altura medida y su rig; los pies apoyan a 0,18 m, sobre el piso, fuera de la alfombra. El informe registra la altura y posición exactas. El personaje y la habitación tienen colecciones separadas.

Los renders usan Cycles, AgX, iluminación de ventana, lámparas locales y relleno suave. `STUDIO_PREVIEW` contiene el suelo de presentación y un bloqueador de luz del techo invisible para la cámara; son auxiliares de render, no mobiliario. `WINDOW_EXTERIOR` reúne el paisaje del vano.

Se conserva toda la densidad del maestro. Esta entrega no sustituye automáticamente el GLB anterior de la aplicación: el rendimiento del cuarto nuevo deberá medirse en los dispositivos objetivo al integrarlo. Los efectos procedurales finos de los materiales pertenecen al maestro de Blender.

## Reproducción

Ejecutar desde la raíz del proyecto con Blender 5.2:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python-exit-code 1 --python scripts/room_premium_pipeline.py -- --build --preview
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python-exit-code 1 --python scripts/room_premium_pipeline.py -- --final --details
```

`scripts/room_premium_pipeline.py` integra los módulos `room_premium_common.py`, `room_premium_architecture.py`, `room_premium_textiles.py`, `room_premium_study.py`, `room_premium_botanicals.py` y `room_premium_personal_props.py` de `tools/blender`. El proceso valida coordenadas finitas, presencia de los muebles estructurales y conservación de la huella del original antes de guardar.
