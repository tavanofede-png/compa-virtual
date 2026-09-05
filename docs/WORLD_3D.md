# Compañeros adolescentes y habitación 3D

Esta revisión sustituye la dirección anterior de criaturas en pixel art por adolescentes estilizados y una habitación tridimensional interactiva. La geometría se crea en Three.js; no es una imagen frontal con una transformación CSS.

## Personalización

- Seis personajes de partida: Leo, Alma, Nico, Zoe, Dani y Sol.
- Presentación de chico, chica o neutra. Cabello y ropa se combinan libremente.
- Ocho tonos de piel, seis peinados y seis colores de cabello.
- Cuatro conjuntos cotidianos: buzo con capucha, remera y jeans, campera universitaria y camisa abierta. Ocho colores de ropa.
- Ropa de colección conservada: remera estelar y jardinero. Accesorios modelados: bufanda, anteojos, auriculares, moño, gorra y mochila.
- Decoración de colección: planta, lámpara y globo. La habitación incorpora además sus muebles y objetos cotidianos.

No se modifican monedas, obligaciones, planes ni memoria al actualizar la apariencia. Los perfiles antiguos conservan nombre y objetos; se interpretan con un aspecto adolescente inicial hasta que el alumno lo personaliza. Los campos antiguos se conservan por compatibilidad y los nuevos se validan en los mismos comandos del servidor.

## Escena y controles

Habitación abierta por el frente, con dos paredes de espesor visible, piso de madera, ventana, cortinas, cama, almohadas, manta, mesa de luz, escritorio, monitor, teclado, cuaderno, taza, portalápices, silla, corcho, pósters, estantes, libros, plantas, guitarra, skate, mochila, pelota, puf y luces. La decoración obtenida se coloca sobre la biblioteca lateral.

La cámara empieza elevada y en diagonal. En web admite arrastre, giro, acercamiento y restablecimiento; en móvil, arrastre horizontal y botones de giro/restablecimiento. Tocar al personaje o usar el botón de conversación conserva la entrada al tutor. La vista del personaje en el editor también se puede girar.

## Implementación y archivos

La dirección aprobada es **3D estilizado y detallado, como un videojuego cuidado**. La revisión incorpora rostros de sección continua con mandíbula y mentón, iris, párpados, mechones curvos, rizos con hebras, costuras y cierres. La habitación incluye cortinas y edredón de geometría ondulada, cabecera listonada, altavoces y detalles de construcción. Son modelos procedurales; no se presentan como personajes esculpidos o animados por un estudio externo.

Los materiales físicos distinguen pintura, roble, tela, tejido, metal, cerámica, piel, pelo y goma. La web agrega iluminación de entorno, oclusión ambiental GTAO y sombras de 2048 px; Expo conserva la geometría y los materiales compartidos sin ese posprocesado de escritorio. La microtextura procedural se filtra con derivadas para reducir parpadeo a distancia. El acabado artístico final y el rendimiento físico requieren revisión; compilar no los certifica.

`packages/world3d` comparte modelos, materiales, iluminación y encuadres. Web usa WebGLRenderer y OrbitControls. Expo usa React Three Fiber nativo y expo-gl. No se usa un WebView para la escena móvil.

`pnpm assets:3d` exporta 18 archivos GLB: habitación, seis compañeros y once prendas/accesorios/objetos de colección. Se encuentran en `packages/assets/3d` y se pueden importar en herramientas compatibles con glTF, como Blender. Son modelos originales generados a partir de la misma geometría que usa la app. No hace falta conectar una herramienta externa para ejecutar la escena.

La ropa está modelada, pero no tiene simulación de tela. Los GLB no incluyen un esqueleto humano para caminar ni animación facial avanzada. La web tiene un movimiento de reposo leve y respeta la preferencia de reducir movimiento; la versión nativa dibuja bajo demanda para ahorrar batería.

Los GLB conservan geometría, colores y propiedades PBR compatibles. La microtextura de los shaders y el posprocesado son efectos de ejecución de la app y no se hornean en mapas de textura dentro de los GLB.

Los objetos estáticos se agrupan por material para reducir llamadas de dibujo. La web limita resolución de renderizado, pausa cuando la escena no se ve y reutiliza un único renderer para miniaturas. Un fallo de WebGL muestra un estado recuperable sin bloquear las pantallas de estudio.

## Validación

Pruebas de geometría finita, volumen de la habitación, encuadre diagonal, variedad de peinados, presupuesto de mallas/triángulos, catálogo, formato GLB y conservación de datos anteriores. La compilación de Expo debe repetirse después de agregar los módulos nativos. La instalación y el rendimiento en teléfonos físicos siguen pendientes como parte de la beta.

Referencias técnicas: [Three.js](https://threejs.org/docs/), [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), [React Three Fiber nativo](https://r3f.docs.pmnd.rs/getting-started/installation#react-native).
