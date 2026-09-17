# Habitaciones — reconstrucción según referencia del 10/09

La lámina entregada por el usuario es la referencia principal. No se acepta generar habitaciones mediante sustitución de colores. Se conservan las versiones anteriores hasta verificar las nuevas. Personajes fuera de esta etapa.

## Inventario visual obligatorio

### Ático creativo
Techo a dos aguas, vigas y tejas visibles, claraboya inclinada, paredes bajas, guirnaldas cálidas, plantas colgantes, escalera abierta y baranda, cama de madera con almohadones y mantas superpuestas, dos mesitas, lámparas, collage de fotos e ilustraciones, caballete con cuadro, materiales de pintura y cajones, escritorio de cajoneras con computadora, silla clara, biblioteca baja bajo pendiente, libros y figuras, alfombra geométrica, mesa baja con libros y plantas, almohadones de piso y puf, cajas y objetos junto a la escalera.

### Rincón urbano
Dos frentes de vidrio en esquina de piso a techo; skyline al atardecer. Cama plataforma con nichos y cajones, almohadones blancos y grises, manta azul, escritorio negro independiente, silla blanca, cajonera negra, laptop, lámpara, portalápices y cuadernos, estantería metálica abierta, mochila, póster urbano, fotografías, cartel azul, numerosas plantas, mesa baja, alfombra rectangular azul y dos pufs diferentes.

### Sala de control gamer
Muros oscuros, iluminación LED azul/violeta integrada, escritorio en L con varios monitores y paisajes, PC con ventiladores luminosos, teclado, mouse, parlantes, silla gamer, auriculares colgados, colecciones de figuras y juegos en estanterías y repisas, póster neón, cuadros pixelados, cama baja oscura, textiles violetas, baúl multimedia, mandos, consola, puf oscuro, alfombra de rompecabezas, skate y plantas.

### Habitación invernadero
Estructura blanca de invernadero, cubierta y paredes de vidrio, travesaños y diagonales, vegetación exterior. Muchas plantas distintas en macetas, cestas, repisas, suelo y colgantes; enredaderas largas, flores. Cama de madera con ropa blanca y verde, mesitas y lámparas, alfombra circular de fibra, mesa baja, cestas tejidas, escritorio y laptop, silla clara, sillón verde y fuente azul escalonada. No sustituir la vegetación por unas pocas macetas repetidas.

### Estudio musical
Muros grises con paneles acústicos acanalados, guitarras acústicas y eléctricas diferentes colgadas, discos de vinilo, cuadros musicales, cartel rojo luminoso. Escritorio con teclado musical completo, monitor con pistas, monitores de audio, micrófono con pie, auriculares, amplificadores, tocadiscos, muebles de discos y cajas de vinilos; cama con textiles rojos y grises, alfombra oriental, puf negro y lámparas cálidas.

### Rincón explorador
Carpintería cálida, bibliotecas de altura completa en esquina, gran mapa del mundo, globo, fotografías de viajes, libros numerosos, baúles con herrajes y maletas apiladas, cámara y telescopio, cama con manta verde y plaid naranja, sillón de lectura y lámpara, escritorio junto a ventana soleada, alfombra cartográfica circular, desnivel con escalones, plantas y enredaderas.

## Criterio de revisión

Comparar arquitectura, distribución, siluetas de muebles, objetos por zona y microdetalle con la lámina. Cada cuarto necesita maestro Blender propio, render general y acercamientos. Mantener escala en metros y recalcular los mapas de movimiento para la nueva geometría. No conectar mapas de los cuartos anteriores a estos modelos. La fotografía no muestra las caras ocultas: resolverlas coherentemente, sin afirmar exactitud inexistente.

## Entrega de revisión (10/09/2026)

Las seis escenas se reconstruyeron en archivos independientes. Los maestros de revisión y los renders se generan con `scripts/complete_reference_collection.py`. El ático parte de su revisión v7; las otras habitaciones tienen construcción y refinamiento propios.

| Habitación | Construcción diferenciada |
|---|---|
| Ático creativo | Cubierta inclinada con tejas, claraboya, estructura de madera, escalera abierta, caballete y carro de pintura, collage con ilustraciones diferentes. |
| Rincón urbano | Dos fachadas acristaladas en esquina, vista urbana, plataforma de cama, estantería negra abierta, alfombra rectangular y dos pufs. |
| Sala de control gamer | Escritorio en L, monitores con soportes, PC iluminada, cajas de juegos ilustradas, figuras con accesorios distintos, baúl y mandos, alfombra modular. |
| Habitación invernadero | Estructura de cubierta acristalada, plantas colgantes y de suelo, flores, banco de cultivo con semilleros, fuente y sillón de lectura. |
| Estudio musical | Paneles acústicos con aletas, guitarras y guitarra acústica con cuerdas, vinilos, teclado, pistas musicales en pantalla, amplificador y micrófono. |
| Rincón explorador | Bibliotecas de altura completa, mapa, globo, telescopio, cámara, baúles con herrajes, sillón, alfombra de brújula y escalones. |

### Archivos

- Maestros: `packages/assets/3d/source/rooms/reference-rebuild/*-review.blend`.
- Renders generales: `renders/reference-rooms/*-review.png`.
- Acercamientos: `renders/reference-rooms/*-detail.png`.
- Galería local: `renders/reference-rooms/revision-habitaciones.html`.
- Auditoría acotada de ensamblajes: `renders/reference-rooms/assembly-review.json` (generada por `scripts/audit_reference_assemblies.py`).

### Alcance real de la revisión

Son escenas editables para revisión visual. Se conservaron componentes detallados del mobiliario base y se construyeron arquitecturas, equipamiento y elementos temáticos diferentes. No se declara una reproducción exacta de todos los detalles de la ilustración.

La auditoría automática comprueba pares seleccionados de cama y accesorios independientes; no demuestra ausencia de todas las intersecciones. No se ha probado el tránsito de personajes, las seis habitaciones en dispositivos, la optimización GLB ni el rendimiento nativo. Los mapas antiguos no son compatibles con estas distribuciones y no se han conectado a las escenas nuevas. La app continúa usando sus recursos publicados anteriores.

Las texturas de ilustraciones y fondos están empaquetadas dentro de los maestros Blender. Los scripts de construcción y las versiones intermedias se conservan para editar y reproducir el trabajo.
