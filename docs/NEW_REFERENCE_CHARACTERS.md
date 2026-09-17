# Nueva colección de personajes — referencia del 10/09

Lux, Finn, Elise, Kai, Noa, Rem, Sage y Orion son personajes nuevos; no reemplazan los ocho actuales. La lámina del usuario define identidad, colores y prendas.

| Personaje | Geometría y vestuario distintivos pendientes de validación |
|---|---|
| Lux | Rubio recogido con mechones sueltos, suéter marfil con estrella, cargo rosa, mochila rosa y zapatillas claras. |
| Finn | Gorra crema invertida, pelo rubio desordenado, hoodie azul 73 con bandas, pantalón oscuro, skate. |
| Elise | Pelo rubio largo ondulado con flores, cardigan verde floral, falda marfil escalonada, bolso marrón. |
| Kai | Rizos rubios cortos, camiseta clara con llama, auriculares, cargo oscuro, cadena y zapatillas rojas. |
| Noa | Recogido ceniza, anteojos redondos, suéter verde, pantalón de cuadros, libros. |
| Rem | Gorro oscuro, pelo cobrizo, hoodie negro con diseño rojo, jeans claros rotos, bolso cruzado, auriculares. |
| Sage | Trenzas rubias largas, piel oscura, aros, cardigan oliva, cargo oscuro, collares. |
| Orion | Pelo oscuro ondulado, anteojos negros, campera beige sobre hoodie claro, cargo oscuro y zapatillas azules. |

Los archivos se construyen aislados. Conservar huesos y contratos de slots no demuestra el ajuste en movimiento: se requiere revisión de hombros, codos, manos, sentarse y acostarse. La falda necesita pesos y máscaras corporales propios. No publicar como vestuario compatible hasta superar esas pruebas.

## Estado de trabajo
Lux tiene maestro v2 y render revisado; conserva 17 huesos. Su v1 superó la validación estructural; la compatibilidad completa de vestuario sigue pendiente. El resto se genera mediante `scripts/build_new_reference_characters.py` en archivos aislados, con estado de primera pasada.


## Resultado de esta pasada

Los ocho cuentan con archivos Blender y renders. Lux, Finn, Elise, Kai, Noa, Rem y Orion tienen revisión v2; Sage conserva v1. Galería: `renders/new-reference-characters/revision-personajes.html`. Maestros: `packages/assets/3d/source/new-reference-characters`.

Correcciones ejecutadas: retirar pelo que atravesaba gorras, ampliar cintura de falda, reemplazar estampado de cuadros flotante por material sobre tela, ajustar libros a pose neutra, separar capas de campera, añadir geometría en uniones de brazos expuestas y detallar skate/bolsos.

**Pendiente real:** semejanza artística de caras y proporciones, mayor riqueza de peinados y telas, poses expresivas, reconstrucción continua de piel expuesta en Kai (la solución actual usa piezas de contacto), deformación completa de la falda, contactos de manos y prueba con todo el armario. Estos archivos no deben tratarse como personajes finales ni incorporarse automáticamente a la app.
