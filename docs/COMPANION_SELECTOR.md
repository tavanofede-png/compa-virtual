# Bienvenida y selector de Compa Virtual

Implementado el 9 de septiembre de 2026 para web y Expo Android/iOS.

## Recorrido

Después de autenticar la cuenta y cargar sus datos, los perfiles nuevos pasan por seis pasos: personaje, conjunto, habitación, datos personales, preferencias de estudio y revisión. Las cuentas con personajes anteriores también pasan por este recorrido, conservando materias, tareas, saldo y progreso. Los tokens renovados no reinician la bienvenida.

Cada botón Continuar guarda la elección y el próximo paso. La confirmación final guarda perfil y compañero juntos, marca la bienvenida como completa y aplica el horario de descanso a los avisos. Volver atrás conserva los cambios locales. Un error mantiene las elecciones para reintentar; los conflictos entre dispositivos se resuelven actualizando los datos de la cuenta antes de reintentar. No se otorgan monedas por completar la bienvenida.

Desde **Personalizar** se abre una edición de tres pasos (personaje, conjunto, habitación). Guardar aplica los cambios; Cancelar conserva la configuración anterior. La demostración de bienvenida es independiente de la demostración con tareas precargadas y persiste solo en el dispositivo.

## Catálogo y 3D

- Ocho personajes: Nova, Jay, Milo, Zoe, Sky, Harper, River y Aria.
- 144 prendas y accesorios equipables, con búsqueda, categorías, conjunto inicial y retirada de accesorios opcionales. Los 38 objetos de escritorio/hobby no se muestran como ropa.
- Seis habitaciones completas, con sus objetos conservados.
- La ropa se vincula al esqueleto del personaje por nombre de hueso y respeta su escala. Las partes del cuerpo ocultas por mangas y pantalones se enmascaran. Pelo, gorros y mochilas aplican los ajustes del sistema de vestuario.
- Los GLB para la app agrupan geometría por material y componente sin reducir la cantidad de objetos representados. Los maestros editables de Blender permanecen separados. Los atributos normales usan KHR_mesh_quantization; posiciones y detalles geométricos se conservan.
- La web descarga los modelos seleccionados; su caché de archivos se limita a 32 MiB. Cambiar de selección cancela el resto del trabajo anterior y libera geometría, materiales y esqueletos.
- La beta nativa incluye los 158 GLB mediante Metro y `expo-asset`, para que no dependa del sitio publicado. Son 255.7 MB de archivos originales, antes de la compresión del APK. Solo se carga la escena seleccionada. Antes de distribución general se debe medir tamaño final, memoria y rendimiento en teléfonos reales.
- Las miniaturas proceden de renders de Blender. Mientras carga el 3D se muestra una vista previa; un fallo ofrece Reintentar.

## Datos y backend

`Companion` incorpora `character_id`, `room_style` y `wardrobe`. El estado conserva `onboarding.step` y su fecha. Los comandos `onboarding.save` y `onboarding.complete` usan las mismas operaciones idempotentes y versiones que el resto de la app. La validación de prendas ocurre también en el servidor. Los campos se guardan en las estructuras JSON existentes, sin modificar tablas ni permisos RLS.

La función `api` de Supabase fue actualizada en el proyecto existente; el panel confirmó una nueva fecha de despliegue. Se conserva la restricción vigente de la beta: los perfiles de menores requieren la habilitación configurada en el backend. No se cambió esa habilitación.

Comprobación HTTP posterior: GET devuelve 405 con el mensaje del servidor; POST sin sesión devuelve 401 «Iniciá sesión.» y permite el origen `http://127.0.0.1:3000`. Esta comprobación verifica que la función arranca y aplica autenticación/CORS, no sustituye una prueba de registro con una cuenta real.

## Comprobaciones

- 42 pruebas del proyecto aprobadas, incluidas seis nuevas sobre reanudación, finalización, preservación del progreso, validación de ropa, presencia de archivos y carga real de GLB en los ocho esqueletos.
- Las pruebas geométricas verifican dimensiones finitas, escala, posición de los pies y el anclaje del personaje en el cuarto.
- TypeScript de los paquetes, web y móvil aprobado.
- Exportación estática Next.js y exportación Android con Hermes aprobadas. La exportación Android incluye los GLB y las 166 miniaturas.
- No se realizó una prueba en teléfono físico ni se generó un APK nuevo en esta tarea.
- La publicación web está pendiente: el conector Sites devuelve proyecto no encontrado y una lista vacía, incluso después de confirmar la cuenta con el usuario. El sitio publicado no se reemplazó por uno nuevo. La implementación está disponible en el proyecto local.

## Generación y mantenimiento

Para trabajar el diseño móvil en la computadora, abrir `/mobile-preview.html?view=today`. Esta vista contiene la app real en un iframe de 390 × 844 píxeles y ajusta únicamente la escala del marco al panel disponible. El ancho móvil permanece al navegar y recargar, sin depender del ajuste temporal del navegador. Usa el mismo origen y autenticación de la app; una sesión vencida requiere ingresar nuevamente. Es una vista de la web responsive, no un emulador de Android ni una prueba del APK.

`scripts/export_app_models.py` prepara cuerpos y cuartos; `scripts/pack_app_models.py` empaqueta sus atributos; `scripts/prepare-selector-assets.py` genera catálogo, miniaturas y los archivos públicos. `scripts/stage-mobile-selector.mjs` registra las mismas imágenes y modelos para móvil. Ejecutar estos pasos solo cuando se cambien los activos originales; no son necesarios en cada compilación.

La extensión GLB se incorpora a `resolver.assetExts` conservando la configuración estándar de Expo. Referencia: [configuración de Metro](https://docs.expo.dev/guides/customizing-metro/).
