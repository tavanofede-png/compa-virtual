# Kusiy — auditoría de integración y plan de cierre

Fecha: 20 de septiembre de 2026. Proyecto técnico: Compa Virtual / `@compa/*`.

**Conclusión:** hay una base importante implementada y recursos visuales producidos, pero no están integrados ni publicados todos los sistemas acordados. El sitio público, el repositorio, el directorio de trabajo y Supabase están en versiones distintas. Compilar correctamente todavía no demuestra que un alumno pueda completar el recorrido real.

Este documento entrega la auditoría y el plan; **no declara ejecutadas las correcciones**. Durante la auditoría se hicieron lecturas, pruebas y compilaciones locales, navegación de la demo y consultas SQL de catálogo. No se modificaron registros de alumnos, esquema, permisos ni despliegues. El editor SQL puede conservar la consulta de inspección en el historial del proyecto.

## 1. Decisiones vigentes

- El nombre del producto será **Kusiy**. Se conservarán identificadores técnicos, rutas y datos existentes para evitar una migración cosmética que rompa compatibilidad.
- El alcance sigue siendo **el proyecto completo por etapas**, incluyendo el editor, los ocho espacios, las mascotas y las salas compartidas. La postergación de estos sistemas propuesta en `MASTER_PLAN.md` del 17 de septiembre no representa la decisión actual.
- La primera entrega para alumnos debe contemplar menores con acceso controlado y consentimiento verificable cuando corresponda. No se considerará verificación suficiente que el propio alumno escriba el nombre de un adulto y marque una casilla.
- Los compañeros de **un curso cerrado y validado** podrán invitarse y estudiar autónomamente. Un docente o responsable valida la pertenencia al curso una vez; no autoriza cada sesión. Se separan pertenencia al curso, consentimiento y autorización para usar cada servicio.
- Se prioriza el costo mínimo necesario. Se usarán planes gratuitos donde alcancen; cualquier contratación se presupuestará con consumo y límites antes de realizarla.
- Se conserva la dirección artística detallada. La optimización de distribución no autoriza eliminar objetos, reducir los ambientes a variantes de color ni reemplazar los modelos maestros por versiones simples.
- Las generaciones y correcciones visuales se ejecutarán de forma continua, sin pedir aprobación entre piezas.

### Universo que debe quedar conectado

| Conjunto | Alcance de cierre |
|---|---|
| Compañeros | 16 personajes, identidad propia, rig y vestuario compatibles. |
| Vestuario | 144 prendas/accesorios vestibles; 38 props adicionales deben tener destino e interacción explícitos. |
| Dormitorios | Los seis originales y los seis nuevos: 12 seleccionables, con mapas propios. |
| Salas compartidas | Seis ambientes preparados, seis plazas por sala, estudio grupal privado. |
| Espacios individuales | Biblioteca, terraza, pérgola, café, minimalista, tecnológico, pabellón y ático: ocho, independientes del dormitorio y sin mascotas. |
| Mascotas | 24 variantes catalogadas actualmente; completar sus diferencias por especie. El loro pequeño del plan original sigue como asset y comportamiento pendientes. |
| Editor | Dormitorios y espacios individuales; StudyZone permanente, apoyos, circulación, borradores y varias distribuciones. Las salas compartidas mantienen sus diseños preparados. |
| Ambiente | Seis perfiles sonoros, iluminación independiente y modos de estudio foco/habitación. |
| Plataformas | Web, Android e iOS, con pruebas físicas y un APK de prueba. |

## 2. Evidencia y límites de la auditoría

### Versiones observadas

- Repositorio: `outputs/compa-virtual`, rama `main`, base `f449db34ef576eb3d5f54889b572f72169e95b7e`. Hay 32 archivos rastreados modificados, además de documentación, scripts y revisiones sin registrar. Deben revisarse y conservarse antes de integrar.
- GitHub: repositorio privado `tavanofede-png/compa-virtual`, último push observado del 17 de septiembre. Esto no incluye automáticamente todos los cambios del directorio local.
- Sitio: `https://compa-virtual-estudio.vercel.app`. La respuesta pública inspeccionada llevaba `Last-Modified` del 12 de septiembre y conserva la marca Compa Virtual. No se usa esa cabecera como identificación exacta de commit: las diferencias de pantallas se comprobaron también navegando.
- Supabase: proyecto `oaravhmdvcwcvjnyweig`. Existen las funciones `api` y `reminders`; sus fechas de actualización difieren de las fuentes locales.
- La credencial del CLI de Vercel no fue válida para consultar el despliegue. El conector de Supabase negó acceso; el dashboard sí permitió la inspección y consultas SQL de solo lectura.

### Comprobaciones ejecutadas

| Comprobación | Resultado | Qué no demuestra |
|---|---|---|
| `pnpm typecheck` | Correcto en los paquetes revisados. | Funcionamiento de servicios remotos. |
| `pnpm lint` | Correcto. | Calidad visual o accesibilidad completa. |
| `pnpm test` | **91 pruebas aprobadas en 15 archivos.** | Recorrido con cuentas reales, IA real o dispositivos físicos. |
| `pnpm build` | Exportación web correcta. | Que esa versión esté publicada. |
| `pnpm --filter @compa/mobile export` | Exportaciones Android e iOS correctas. | APK/IPA instalado, render nativo o rendimiento. |
| Web pública a 390 × 844 | Navegación/demo y fallo de encuadre de Compa observados. | Cobertura visual de todas las pantallas y tamaños. |
| Preflight desde el origen público a la API | **403: «Origen no permitido».** | No se probó una operación autenticada posterior, porque esta conexión ya falla. |
| SQL remoto de catálogo | Tablas sociales, RPC, cron y RLS comprobados como se detalla debajo. | Efectividad de todas las políticas frente a dos usuarios reales. |

Las pruebas de base utilizan fixtures locales/PGlite; varias de proveedores usan dobles de prueba. No sustituyen la validación de producción. El script `verify-gate0.mjs` comprueba condiciones parciales de código/configuración: su salida no debe presentarse como certificación de preparación del producto.

### Estado remoto comprobado en Supabase

- Existen `private.shared_room_presence`, `private.shared_room_timers`, `private.collaboration_invitations` y `public.shared_room_command(uuid,uuid,jsonb,jsonb)`.
- **No existen `public.pets` ni `private.sync_pet_projection()`**, aunque la migración correspondiente está en el repositorio. La identidad de mascotas vive también en el agregado canónico; la ausencia de esta proyección no demuestra por sí sola pérdida de todos sus datos.
- No existe `supabase_migrations.schema_migrations`: falta una línea de base registrada de migraciones. Hay además una entidad remota `bookings` que requiere reconciliación con las fuentes actuales.
- Las tablas ordinarias inspeccionadas en los esquemas `public` y `private` tienen RLS habilitado. Falta comprobar las políticas y permisos efectivos con cuentas separadas.
- Hay dos trabajos cron activos: retención de conversaciones (`15 3 * * *`) y limpieza de presencia de salas (`*/5 * * * *`). **No apareció un cron de recordatorios** en ese inventario. Existencia y activación no prueban ejecuciones exitosas.
- En el listado de secretos de las funciones no figuran `OPENAI_API_KEY`, `CRON_SECRET` ni `COLLABORATION_ENABLED`. Sí aparecen configuraciones de origen, modelos y acceso de menores. Se revisaron nombres, no se publicaron valores.
- El worker de materiales, entrega SMTP, push real y disponibilidad del modelo de IA configurado no quedaron verificados operativamente.

## 3. Matriz de integración actual

| Área | Qué existe | Qué falta o está desconectado |
|---|---|---|
| Acceso y cuenta | Auth, recuperación, controles de cuenta, exportación y eliminación en código. | Recorrido real correo→app, enlaces nativos, sesión vencida, consentimiento independiente y pruebas de aislamiento. |
| Inicio y navegación | Cinco áreas, datos del plan aceptado, resumen y demo identificada. | Publicación consistente, encuadre de Compa, estados móviles y revisión completa de recorridos largos. |
| Agenda y planificación | Materias, obligaciones, horarios, propuesta/aceptación/replanificación y comandos con versión. | E2E con persistencia remota, conflictos entre dispositivos y recuperación de formularios. |
| Sesión individual | Métodos, timer de interfaz, práctica y cierre con recompensa. | Inicio/pausa/reanudación persistentes; recuperación tras recarga o segundo plano y una sola recompensa desde dos dispositivos. |
| Materiales e IA | Carga privada, cola, worker, OCR/extracción, embeddings, tutor y referencias. | Credenciales y operación reales, despliegue del worker, límites/costo, fallos recuperables y evaluación pedagógica. |
| Progreso y economía | Ledger, monedas, sesiones, check-in y tarjetas de logros. | Catálogo autoritativo de logros/desbloqueos; corregir textos que aún anuncian multas. |
| Personajes y ropa | 16 personajes y 144 vestibles en catálogos y selectores. | Matriz visual de prendas/poses; asegurar que publicación y móvil usan las revisiones correctas. |
| Dormitorios | 12 GLB producidos. | El catálogo activo solo enumera seis. Los seis nuevos no se pueden elegir; los mapas activos repiten obstáculos/waypoints. |
| Movimiento del compañero | Caminar, silla, cama, estudio, saludo, celebración, cola de órdenes y pausa. | Puff/objetos sin anchors registrados; contactos por cuarto, rutas reales y coordinación con mascota. |
| Mascotas | 24 definiciones, elección/adquisición, nombre, preferencias y animación básica. | 16 revisiones anatómicas no promovidas; conducta y navegación diferenciadas, objetos funcionales, equipamiento real y proyección remota. |
| Salas compartidas | Seis salas V2, 36 plazas, clientes locales, RPC, presencia, timer, metas y retención. | Entrada ausente en la web publicada; activación/configuración; cursos verificados y menores. |
| Ocho espacios individuales | Maestros Blender, GLB, referencias, renders, inventarios y prototipo espacial. | Dominio, selección, acceso desde Estudiar, persistencia, renderer y editor productivo. |
| Catálogo modular | 113 definiciones distribuidas en 15 grupos/láminas previstas. | Assets modulares verificables, miniaturas, apoyos, derechos de uso y conexión con el editor. |
| Sonido e iluminación | Dirección visual y especificaciones. | Biblioteca distribuible, reproductor, volúmenes, temporizador y estados por plataforma. |
| Android/iOS | Aplicación Expo y exportación de ambas plataformas. | EAS configurado/verificado, APK/IPA y pruebas físicas. |

## 4. Hallazgos que deben corregirse primero

### P0 — Conexión y versiones

**P0-01. La API rechaza el origen de la web publicada.** Un `OPTIONS` desde `https://compa-virtual-estudio.vercel.app` devuelve 403 y una cabecera de origen localhost. La demo puede funcionar sin revelar este problema. Corregir la lista explícita de orígenes, probar preflight y luego una operación autenticada. Mantener restricciones de origen y autenticación.

**P0-02. No hay una versión coherente desplegada.** GitHub, cambios locales, Vercel y funciones no coinciden. Falta identificar una revisión liberable, reconciliar SQL y registrar versiones de frontend, backend y contenido. No ejecutar todas las migraciones a ciegas sobre el proyecto existente.

**P0-03. El consentimiento local propuesto no verifica a un adulto.** El código en preparación puede asignar `verified_at` a una declaración realizada por el alumno. Esto es una debilidad del flujo a corregir antes de habilitarlo, no una afirmación de que ya esté abierto en producción. Conservar el cierre de acceso hasta completar el mecanismo y su revisión correspondiente.

### P1 — Usabilidad y funciones inconexas

**P1-01. Compa se superpone a la pantalla móvil.** En `apps/web/app/redesign.css`, `.compa-showcase` no establece el contexto de posicionamiento que necesita `.world-renderer` absoluto, definido en `globals.css`. En la web publicada el canvas ocupa el alto de la pantalla y tapa controles. Corregir todos los contenedores equivalentes y revisar targets táctiles; se observaron controles menores de 48 px.

**P1-02. La interfaz promete multas que el dominio ya eliminó.** `apps/web/src/Forms.tsx` y `apps/mobile/app/index.tsx` todavía hablan de descontar monedas. El comando actual establece deducción cero. Verificar primero la función remota, después alinear clientes y conservar el historial anterior.

**P1-03. Los recursos no se promueven con una fuente única.** Hay GLB, renders y revisiones distintos entre carpetas. Los 16 GLB de `renders/pet-anatomy-v2` difieren de los activos. El golden tiene varias ramas visuales y backups; la fecha más reciente no garantiza que respete la dirección artística.

**P1-04. Los mapas espaciales no representan los ambientes.** Los seis mapas humanos repiten seis obstáculos y cinco waypoints; los mapas de mascota reutilizan Cozy sin diferencias útiles. La API de acciones incluye posibilidades que no se pueden ofrecer porque faltan sus puntos de interacción.

**P1-05. El comportamiento de mascotas es genérico.** El controlador usa valores fijos en vez del perfil de la definición; no implementa el selector de utilidad acordado. La posición del compañero no determina el seguimiento, el descanso no alinea a la mascota sobre su cama, el cambio de descanso a caminar carece de una transición completa, y Jugar no transporta realmente pelota/cuerda. La escena carga objetos Cozy fijos en lugar del equipamiento guardado.

**P1-06. Los renders de estudio no equivalen al resultado en la app.** La revisión del 16 de septiembre documenta simplificaciones pendientes. La veta procedural de Cycles no se reproduce íntegra en GLB. Los maestros de los ocho espacios pesan aproximadamente 20–140 MB: requieren una estrategia de entrega conservando su diseño.

**P1-07. La exportación móvil carga demasiado contenido de antemano.** Los directorios exportados medidos rondan 854 MB en Android y 852 MB en iOS, incluyendo escenas no seleccionables. Son tamaños de exportación, **no tamaños medidos de APK/IPA**. No se debe empaquetar todo el universo como descarga obligatoria inicial.

## 5. Plan de implementación ordenado

Cada etapa termina con una entrega navegable y evidencia de sus criterios de salida. Una casilla solo se cierra cuando el flujo real se comprobó; compilar, tener un render o escribir una interfaz no basta.

### Etapa 0 — Recuperar una base publicable y trazable

**Objetivo:** que código, base de datos, recursos y versión visible correspondan entre sí.

1. Revisar el árbol modificado y conservar los avances de otros chats. Separar código, documentos, maestros, assets activos y backups sin eliminar revisiones del artista.
2. Crear un inventario de cambios y una revisión de integración. Mantener la restauración por hash de los archivos grandes (`scripts/large-assets.json` y `assets:restore`); comprobar un checkout limpio. No reescribir la historia para resolverlo.
3. Recuperar autenticación de Vercel, comprobar el vínculo con GitHub y preparar preview de integración. Conservar el dominio actual. Añadir una identificación visible en diagnóstico: commit, versión de API, esquema y manifiesto de assets.
4. Obtener diff de esquema remoto/local, revisar `bookings`, establecer una línea de base y preparar migraciones aditivas con respaldo y recuperación. Instalar la proyección de mascotas sin reemplazar `student_states` ni sobrescribir compras/configuraciones.
5. Corregir CORS y revisar URLs de Auth para producción, localhost y enlaces nativos autorizados. No habilitar indiscriminadamente previews de terceros.
6. Reparar el contenedor 3D de Compa, sus controles y los textos de multas. Completar la marca Kusiy en acceso, onboarding, app, correos y metadatos conservando IDs.
7. Incorporar CI: types, lint, pruebas, build web, export nativa, validación de catálogo/assets y detección de secretos. Definir capacidades habilitadas por entorno para mostrar estados reales de IA/social.

**Salida:** login real y una escritura/lectura del perfil desde el dominio publicado; no 403 de origen; Compa usable en 360/390/430 px; contenido y backend identificables; ninguna pérdida de saldos, cuentas o inventario. El despliegue puede revertirse sin deshacer datos nuevos.

### Etapa 1 — Cerrar el recorrido académico y los servicios

**Depende de:** etapa 0. Establece también la base de identidad necesaria para menores y cursos.

1. Completar registro, confirmación de correo, ingreso, recuperación, cambio de contraseña y sesión vencida en web y nativo. Probar SMTP real y enlaces de retorno. Asegurar cierre local de sesión aunque falle la baja remota del token push.
2. Implementar solicitud de consentimiento con adulto verificado por un canal separado del alumno, estado pendiente/verificado/revocado, versión del texto y registro mínimo de la comprobación. Definir qué capacidades requieren cada estado. La verificación técnica no sustituye la revisión de la política aplicable.
3. Habilitar IA con una clave de servidor y un modelo cuya disponibilidad real se pruebe. No suponer que un nombre de modelo del entorno Codex es un identificador API válido. Validar límites, costo por alumno y presupuesto mensual.
4. Desplegar el worker de materiales con cola durable, reintento, tiempo límite y comprobación de salud. Verificar PDF, DOCX, TXT e imagen: carga privada, procesamiento, referencias, error legible y reintento sin duplicar registros.
5. Configurar recordatorios programados y credencial de ejecución, respetando zona horaria, descanso, permisos y bajas de dispositivos. Verificar además ejecuciones exitosas de los dos cron existentes.
6. Extender la sesión de estudio con estados preparados/en curso/pausada/completada/cancelada y tiempo calculado con marcas temporales. Persistir comandos de transición, no cada tick del reloj. Una recarga o segundo dispositivo debe recuperar una sesión coherente.
7. Conectar preparación→método→material/práctica→corrección→reflexión→cierre. El inicio deriva de datos reales; estudiar sin IA o sin un archivo sigue siendo posible.
8. Completar el catálogo de logros verificables y sus desbloqueos, reutilizando ledger e idempotencia. Repetir una operación o enviar cierres simultáneos nunca duplica monedas, XP o premios.
9. Revisar exportación/eliminación para materiales, jobs, conversaciones, mascotas y futuras distribuciones. Conservar lectura offline y mensajes explícitos de reconexión; nunca presentar como guardada una escritura pendiente.

**Salida:** cuenta de prueba completa una obligación, acepta plan, estudia, practica, cobra una vez y reanuda al día siguiente. Otra cuenta no puede leer sus datos/archivos. Casos de error del proveedor, desconexión y expiración son recuperables. Documentar la evaluación pedagógica del tutor y de los 17 métodos.

### Etapa 2 — Integrar todo el contenido 3D y la navegación del compañero

**Depende de:** etapa 0; usa eventos confirmados de la etapa 1.

1. Crear un manifiesto único para web y móvil: ID estable, revisión, hash, bytes, GLB, miniaturas, maestro, rig, clips, escala, bounds, mapas y estado de promoción. Los scripts generarán los catálogos de plataforma desde esa fuente.
2. Auditar y promover los 16 personajes, 144 vestibles y 38 props. Comparar las revisiones de mascotas con la dirección anatómica antes de elegir. Mantener backups fuera de las carpetas servidas y del bundle móvil.
3. Incorporar los seis dormitorios nuevos al selector sin cambiar los IDs de los seis anteriores. Crear previews coherentes con el GLB que realmente se carga.
4. Reautorizar en Blender los 12 dormitorios: spawn, suelo, obstáculos, pasos, cama, silla, puff, estantes y puntos de interacción. Derivar footprints de geometría útil; no copiar el mapa de Cozy.
5. Implementar paseo libre solicitado sobre puntos transitables, puff, acercamientos y acciones de objetos. Distinguir toque/arrastre y mantener controles accesibles equivalentes.
6. Calibrar caminar, sentarse, estudiar, acostarse y levantarse para cada escala de personaje. Conservar órdenes manuales durante transiciones atómicas; guardar accesorios voluminosos visualmente y devolverlos sin alterar el outfit persistente.
7. Validar vestuario en posturas clave para todos los personajes y combinaciones críticas de manga/campera, pantalón/zapato, pelo/sombrero y mochila/asiento. Corregir geometría/pesos, no ocultar fallos solo con encuadre.
8. Mantener maestros detallados y preparar entrega por demanda: descargar solo la selección activa, verificar hash, cachear, reintentar y liberar recursos al cambiar. Reducir draw calls, reutilizar materiales y hornear detalles compatibles con glTF antes de eliminar geometría significativa.

**Salida:** los 12 cuartos son elegibles, las rutas y contactos se prueban por cuarto, las 16 identidades se conservan y los recursos web/nativos coinciden. No hay camino que atraviese muebles ni pérdida de prendas al sentarse. Se registran capturas dentro del renderer final, además de renders Blender.

### Etapa 3 — Completar mascotas vivas por especie

**Depende de:** mapas/manifiesto de etapa 2, persistencia de etapa 0 y eventos de etapa 1.

1. Terminar golden en Cozy como caso completo: acercarse, caminar, frenar, girar, sentarse, levantarse, acostarse dentro de la cama, dormir, oler, reaccionar, jugar y celebrar una confirmación real.
2. Separar actor, selector de utilidad y ejecución jerárquica. Consumir especie, tamaño, velocidad, personalidad, cooldowns y repertorio desde `PetDefinition`. Una acción activa termina en postura segura y luego hace una pausa.
3. Crear coordinación de habitación con reservas de anchors y espacio dinámico del adolescente. Ante bloqueo: esperar, recalcular una vez, intentar alternativa y quedar estable si no hay ruta.
4. Conectar el equipamiento guardado: cama/refugio, hasta dos juguetes y accesorio compatible. Validar especie, socket, footprint y propiedad en servidor. Animar pelota con trayectorias controladas y marcadores de tomar/llevar/soltar; hacer funcional la cuerda.
5. Promover las revisiones anatómicas de ocho gatos y ocho mascotas no caninas. Revisar silueta, cabeza, hocico, orejas, patas y postura: no añadir cejas humanas ni pelo como solución de anatomía.
6. Extender a las otras siete razas caninas; después felinos con superficies autorizadas; mamíferos pequeños con zonas/refugios; tortuga/gecko con hábitats propios; aves con perchas y corredores de vuelo. Producir el loro pequeño pendiente sobre el contrato aviar.
7. Completar bibliotecas editables por familia, clips, marcadores, sockets, colliders y perfiles de detalle. No retargetear a ciegas una locomoción cuadrúpeda a todas las especies.
8. Pausar al ocultarse/cambiar de pantalla, reducir movimiento y mantener una sola mascota cargada. Durante práctica no habrá actividad ambiental distractora. Nada de hambre, culpa, deterioro ni descuentos.

**Salida:** primero el golden supera toda la secuencia en Cozy; luego cada especie supera su matriz de acciones/hábitats y los dormitorios compatibles. Elegir, nombrar, cambiar y equipar persiste entre dispositivos. Tocar Jugar produce una interacción visible y termina; no solo cambia un clip. Posiciones y rutinas siguen siendo locales.

### Etapa 4 — Ocho espacios de estudio y editor real

**Depende de:** catálogo/manifiesto/mapas de etapa 2 y economía de etapa 1. El editor se integra con datos persistentes; el prototipo existente sirve como punto de partida, no como validación final.

1. Incorporar los ocho espacios al dominio con selección independiente del dormitorio. Entregar gratis un primer conjunto completo; desbloqueos posteriores con monedas/logros. Un diseño adquirido puede reutilizarse en distribuciones compatibles.
2. Completar fidelidad respecto de las vistas principales: arquitectura, carpintería más oscura, vegetación diferenciada, libros y pequeños objetos. Hornear/transportar la veta y materiales para que Three.js conserve el acabado, con pruebas web/nativas.
3. Convertir las 113 definiciones de referencia y los props reutilizables en catálogo modular real. Cada pieza necesita asset, dimensiones, apoyos, rotaciones permitidas, variantes, interacción y derechos de uso. Resolver correspondencias adicionales cuando una referencia agrupe varios objetos distintos.
4. Implementar un grafo de apoyos sin ciclos: suelo/pared/techo/superficie de mueble. Mover un padre lleva a todos sus descendientes; reemplazar ofrece recolocar o devolver al inventario los objetos que no entren. No permitir escalado libre que rompa proporciones.
5. Extraer un validador compartido: límites, colisiones a la rotación real, apoyos, área de uso del asiento, superficie útil, ruta desde acceso e interacciones. Revalidar del lado servidor antes de guardar/activar, usando la misma revisión del catálogo.
6. Proteger permanentemente la última StudyZone: editar sobre un borrador, previsualizar sustitución sin destruir la válida y confirmar el reemplazo como una sola operación. Mesa+banco o barra+asiento también pueden formar zona compatible.
7. Toda acción de colocar/mover/rotar/reemplazar muestra fantasma translúcido, huella y área de uso; snap a grilla de 5 cm y anchors compatibles; verde/rojo más icono y explicación. Una candidata inválida no se aplica.
8. Implementar el recorrido Mis espacios→Elegir→Decorar→Guardar con selección visible, categorías, mover/rotar/reemplazar/variantes/inventario, lista de objetos apoyados, cámara general/acercamiento y controles sin arrastrar. Añadir ocultación de paredes/cubiertas.
9. Agregar deshacer/rehacer, borradores recuperables, nombres, duplicación, varias distribuciones, activa única, restauración del original y confirmación al descartar. Manejar conflicto de versión sin pisar el diseño de otro dispositivo.
10. Recalcular navegación e interacciones después de una edición válida. El compañero espera en postura segura. El dormitorio valida descanso y hábitat de mascota; los espacios individuales rechazan mascotas y sus objetos.
11. Entregar tres distribuciones realmente distintas de biblioteca: lectura acogedora, concentración despejada y estudio intensivo; todas con una StudyZone funcional comprobada.

**Salida:** se puede reorganizar por completo, guardar, cerrar y reabrir en otro dispositivo sin perder objetos ni rutas. Quitar la última zona, bloquear la silla o dejar un objeto sin apoyo muestra un motivo y conserva el último estado válido. El servidor rechaza el mismo intento si se fuerza desde fuera de la interfaz.

### Etapa 5 — Ambiente, entregables visuales y coherencia móvil

**Depende de:** etapas 1, 2 y 4.

1. Producir/seleccionar biblioteca propia o distribuible con licencia documentada para seis ambientes: lo-fi acogedor, biblioteca lluviosa, piano minimalista, café, bosque y estudio nocturno.
2. Implementar música/ambiente con volúmenes separados, silencio, temporizador y reproducción por decisión del usuario. Definir comportamiento ante auriculares, llamadas, segundo plano y cambio de pantalla; no reiniciar pistas al navegar.
3. Separar iluminación de audio. Guardar preferencias sin escrituras por frame. Vincular lámparas a acciones reales y distinguir decoración de herramientas académicas.
4. Completar modos foco/habitación visible con última preferencia recordada, misma sesión académica y ambiente opcional. En foco, evitar cargar o animar una escena innecesaria.
5. Cerrar los entregables visuales pendientes: ocho vistas complementarias, acercamientos suficientes, catálogo general y por categorías con objetos legibles, pantallas de editor y errores, mapas de ocho espacios y dormitorio, tres bibliotecas, sonido/iluminación y ambos modos de estudio.
6. Unificar acceso, onboarding, organización, estudio, práctica, logros, Compa y cuenta. Flujos largos a pantalla completa; hojas para elecciones breves; diálogos para confirmación. Añadir carga/vacío/error/éxito/offline/conflicto sin demos disfrazadas de datos reales.
7. Revisar landing completa con el orden acordado, marca Kusiy y recursos actuales. Mantener demo identificada y exploración 3D opcional.

**Salida:** cada objeto tiene el mismo diseño en catálogo, escena, close-up y editor. No faltan links a vistas `*-alternate.png`; existe una galería navegable de entregables. Todas las pantallas se revisan a 360/390/430 px, tablet/escritorio, texto ampliado, teclado y controles de al menos 48 px.

### Etapa 6 — Cursos privados y estudio autónomo con amigos

**Depende de:** identidad/consentimiento de etapa 1 y publicación coherente de etapa 0. Se reutiliza el sistema grupal existente; no se introduce una integración con Google Classroom como requisito.

1. Añadir curso y pertenencia verificada, con rol de docente/responsable limitado a validar altas/bajas y atender incidencias. El alumno no puede autoasignarse una pertenencia válida ni un rol mediante metadatos editables.
2. Permitir invitaciones y vínculos entre miembros activos del mismo curso. Sin directorio público, sugerencias de desconocidos ni acceso cruzado entre cursos. No requerir un permiso adulto por sesión.
3. Sustituir el cierre genérico de «solo mayores de 18» por comprobaciones explícitas de edad/consentimiento/capacidad/pertenencia. Mantener deshabilitado lo que no cumpla estos requisitos.
4. Conectar la entrada «Estudiar juntos» publicada: crear grupo, invitar, aceptar, elegir una de seis salas, entrar, ocupar una de seis plazas, definir metas, usar timer compartido y cerrar.
5. Verificar presencia/reconexión, salida, caducidad, dos pestañas del mismo alumno y disputa de asiento/timer. Revocar pertenencia debe cortar acceso a comandos, datos e invitaciones y actualizar la suscripción realtime.
6. Añadir bloquear/reportar y un recorrido operativo de atención. Compartir solo la identidad/apariencia y la información académica autorizada para esa sesión; no exponer materiales privados por pertenecer al curso.
7. Mantener Meet como enlace externo opcional donde corresponda, sin presentarlo como videollamada propia ni como sustituto de la sala 3D. Revisar compatibilidad y política aplicable antes de habilitarlo para menores.
8. Comprobar modelos V2, fondos enmarcados, 36 contactos de asiento y outfits en las seis salas. No volver a generar salas simples como sustitución de las detalladas.

**Salida:** dos alumnos verificados del mismo curso entran autónomamente y trabajan juntos; un tercero ajeno no accede ni con URL/ID conocido. Una baja revoca acceso. Se prueba una sala con seis participantes y el rechazo del séptimo, reconexiones y ausencia de recompensas duplicadas.

### Etapa 7 — Validación integral y entregas instalables

**Depende de:** etapas anteriores completas para el alcance declarado de la entrega.

1. Configurar y verificar EAS, identidad del proyecto, firma y perfiles de preview/producción. Generar APK de prueba y build iOS de prueba con las credenciales necesarias.
2. Ejecutar en Android de gama media de referencia y en iPhone 12 o equivalente registrado: carga fría, rendimiento, memoria, temperatura, pausa/reanudación y cambios repetidos de cuarto/mascota. La exportación de Metro no reemplaza esta comprobación.
3. Mantener 30 FPS como objetivo; medir p95 de frame menor de 33 ms durante movimiento y carga inicial de escena menor de 8 s en una conexión estable documentada. Informar condiciones, bytes descargados, caché y dispositivo; no afirmar objetivos cumplidos por inspección del código.
4. Comprobar que cambios repetidos no acumulen geometrías, texturas, mixers o suscripciones. Carga por demanda, caché con cuota y recuperación de descargas; perfiles reducidos deben conservar identidad, composición y objetos funcionales.
5. Pasar matriz E2E de cuenta, onboarding, editor, mascota, estudio, grupos, compras, exportación/eliminación, offline y conflictos. Pruebas visuales de regresión y accesibilidad además de unitarias.
6. Publicar la revisión validada en el dominio Vercel actual y entregar APK, acceso iOS cuando esté disponible, fuentes Blender, manifiestos, mapas y documentación. Registrar exactamente qué quedó validado en cada plataforma.

**Salida:** una entrega versionada, reproducible desde GitHub, instalada y probada en dispositivos, con evidencia de los recorridos y un registro separado de incidencias pendientes. No se declara «todo terminado» si alguna función anunciada depende de una demo o un servicio apagado.

## 6. Contratos técnicos a conservar y añadir

Se conservan `Repository`, `Snapshot`, `Companion`, autenticación, `operation_id`, versiones y libro de transacciones. Las nuevas capacidades se agregan con migraciones de snapshot compatibles; los clientes antiguos no deben borrar campos desconocidos al guardar.

| Contrato | Responsabilidad y ubicación propuesta |
|---|---|
| `AssetManifest` | Revisión/hash/rutas/escala/rig/mapas por asset. Fuente de las listas web y móviles. |
| `StudySessionRuntime` | Estado persistente, marcas temporales, revisión y referencia al cierre académico; dominio/repositorio/servidor. |
| `PersonalSpaceDefinition`, `PlaceableDefinition` | Tipos de espacio, módulos, piezas, superficies, footprints y compatibilidades en dominio. |
| `RoomLayout`, `StudyZone` | Instancias de objetos, relaciones de apoyo, revisión, zonas funcionales y distribución activa. |
| `PlacementPreview`, `LayoutValidationResult` | Candidata/snap/fantasma y errores accesibles; cálculo común sin depender de la UI. |
| `AmbiencePreset` | Audio, licencia, iluminación y preferencias; separación de configuración persistente y reproducción local. |
| `PetActor`, `PetBrain`, `RoomSceneController` | Presentación, decisión y coordinación local en `@compa/world3d`. |
| `RoomPetMap`, mapa humano | Navegación, anchors, contactos, superficies y reservas derivadas de geometría/layout. |
| `VerifiedClassMembership`, consentimiento | Alta/revocación y rol autorizados por servidor; independientes del perfil editable del alumno. |

Comandos nuevos propuestos: iniciar/pausar/reanudar sesión, elegir primer espacio, guardar/duplicar/activar/restaurar layout, desbloquear diseño, preferencias de ambiente y gestión de pertenencia a curso. Los nombres concretos se alinearán con el dispatcher existente. Cada mutación incluirá ID de operación y versión; guardar una distribución valida todas sus piezas como una transacción.

El servidor conserva identidad, derechos, preferencias y distribuciones. El dispositivo conserva posición, animación, rutas, temporizadores ambientales y ghost provisional. El audio o una mascota caminando no generan una corriente de escrituras a Supabase.

## 7. Matriz mínima de aceptación

| ID | Caso | Evidencia exigida |
|---|---|---|
| INT-01 | Web publicada y API compatible | Preflight correcto, login real, escritura y lectura, versiones registradas. |
| INT-02 | Actualización desde cuenta existente | Saldo, inventario, personaje, mascota y plan conservados. |
| ACA-01 | Sesión completa | Plan aceptado→sesión→práctica→corrección→cierre→recompensa única. |
| ACA-02 | Recarga/segundo plano/dos dispositivos | Recupera sesión y rechaza cierre duplicado/conflicto sin pérdida. |
| IA-01 | Material y tutor reales | PDF/DOCX/TXT/imagen, procesamiento/reintento, referencias verificables y aislamiento. |
| ECO-01 | Check-ins | Todos los resultados conservan saldo; no hay textos de multa ni reintegros automáticos. |
| ECO-02 | Compra/desbloqueo concurrente | Un débito y una adquisición; operación repetida devuelve el mismo resultado. |
| HUM-01 | 16 personajes × 12 dormitorios | Escala, rutas y contactos de cama/silla/puff; revisión de combinaciones críticas de vestuario. |
| PET-01 | Golden completo | Secuencia venir/jugar/cargar objeto/descansar/levantarse/celebrar con contactos correctos. |
| PET-02 | Cada especie | Silueta aprobada, clips propios, hábitat compatible y ausencia de movimiento no autorizado. |
| EDT-01 | Última StudyZone | Bloquea eliminación, obstrucción y reemplazo inválido tanto en UI como servidor. |
| EDT-02 | Apoyos y conjuntos | Mover padre arrastra descendientes; reemplazo detecta sobrantes; no objetos flotantes. |
| EDT-03 | Ghost y accesibilidad | Snap visible, verde/rojo+icono+texto y controles sin arrastre. |
| EDT-04 | Persistencia | Varias distribuciones, duplicación, undo/redo, recuperación y conflicto de versión. |
| EDT-05 | Tres bibliotecas | Reorganización real, no solo colores; tres zonas funcionales y navegación comprobadas. |
| SOC-01 | Curso privado | Miembros verificados autónomos; tercero ajeno y miembro revocado sin acceso. |
| SOC-02 | Seis alumnos | Asientos exclusivos, timer/metas coherentes, reconexión y rechazo del séptimo. |
| VIS-01 | Recursos coherentes | Referencia, GLB, catálogo, miniatura y editor apuntan a la misma revisión visual. |
| UI-01 | Tamaños y accesibilidad | 360/390/430 px, tablet/escritorio, teclado, texto ampliado, safe areas y targets ≥48 px. |
| NAT-01 | Android/iOS físicos | Instalación, frame p95, memoria, carga fría y pausa medidos; no solo exportación. |
| PRI-01 | Privacidad | RLS probada con dos cuentas, archivos privados, revocación, exportación y borrado completos. |

La matriz de vestuario separará cobertura automática de huesos/compatibilidad, revisión de cada prenda y pruebas visuales de combinaciones críticas. No se afirmará haber revisado todas las combinaciones posibles.

## 8. Dependencias externas y costos

| Necesidad | Situación | Cómo se resuelve |
|---|---|---|
| Vercel | Token CLI no válido. | Reautenticación y comprobación del proyecto/domain; no crear otro sitio. |
| Supabase | Dashboard accesible; conector sin permisos y esquema sin historial. | Continuar por acceso autorizado, obtener diff y baseline antes de migrar. |
| IA | Clave no presente en secretos inspeccionados. | Cuenta/API disponible, modelo probado, cuotas y estimación antes de gasto. |
| Worker/correo | Operación remota no verificada. | Elegir despliegue mínimo que cumpla cola, entrega y latencia; comprobar servicios. |
| EAS/firmas | Exporta, pero no hay APK/IPA verificado ni proyecto EAS confirmado. | Vincular cuenta/proyecto y credenciales; producir preview instalable. |
| iOS y teléfonos | Prueba física pendiente. | Acceso a dispositivos y firma/distribución de prueba; registrar limitaciones reales. |
| Menores | Producto definido; verificación/revisión pendientes. | Flujo independiente, textos y política revisados antes de abrir acceso a alumnos. |
| Audio | Sin biblioteca distribuible conectada. | Producción propia o licencias documentadas; no asumir permiso de servicios de streaming. |

El presupuesto debe separar costos fijos de hosting/worker/correo y variables de IA, almacenamiento y transferencia de modelos. No se fija una cifra sin medir un recorrido representativo y el volumen esperado; tampoco se contrata un plan como parte de esta auditoría.

## 9. Entregables y orden de cierre

1. **Versión coherente y utilizable:** corregir P0, encuadre móvil y copy; código/SQL/assets trazables.
2. **Recorrido académico real:** servicios, consentimiento, sesión recuperable, prácticas y recompensas.
3. **Mundo conectado:** doce dormitorios, dieciséis compañeros, vestuario, mapas y acciones físicas.
4. **Mascotas completas:** golden de referencia y extensión real por especie, con equipamiento y convivencia.
5. **Espacios editables:** ocho ambientes, catálogo modular, StudyZone protegida y distribuciones persistentes.
6. **Diseño y ambiente completos:** audio, iluminación, modos, láminas faltantes y revisión móvil transversal.
7. **Estudio social privado:** curso verificado y autonomía entre amigos, reutilizando salas V2 y backend existente.
8. **Entrega comprobada:** web actualizada, APK, iOS probado cuando se disponga de firma/dispositivo, fuentes y matriz de resultados.

Las etapas 3, 4 y 6 tienen dependencias diferentes después de la base común; su ejecución puede alternarse sin eliminar ninguna del alcance. No se promete una fecha de finalización sin dimensionar las correcciones visuales y las pruebas físicas. Cada entrega parcial debe decir qué funciona ya y qué sigue pendiente, sin convertir esa división de trabajo en un recorte del producto acordado.

## 10. Fuentes del repositorio para ejecutar el plan

- App y UI: `apps/web/src/{StudyApp,Pages,Forms,HomeScreen,CompanionSetup,Room}.tsx`, `apps/web/app/{globals,redesign}.css`, `apps/mobile/app/index.tsx`, `apps/mobile/src/`.
- Dominio: `packages/domain/src/{companions,pets,pet-state,consent,collaboration,shared-rooms,shared-room-layouts,presentation}.ts` y comandos/tipos existentes.
- Render: `packages/world3d/src/{motion,room,pet,premium,shared-space,tailoring,equipment}.ts`, `room-maps.json`.
- Backend: `packages/server/src/{handler,ai,reminders,collaboration}.ts`, `packages/client/src/`, `apps/worker/`, `supabase/functions/` y `supabase/migrations/`.
- Espacios: `design/personal-spaces-v1/ENTREGA-REVISION-3D.md`, `COMPARACION-OCHO-ESPACIOS.md`, `spatial.mjs`, `data/`, `models/`, fuentes Blender en `packages/assets/3d/source/personal-spaces/v1/`.
- Promoción de recursos: `scripts/stage-mobile-selector.mjs`, `stage-shared-spaces.mjs`, `restore-large-assets.mjs`, `large-assets.json`, `renders/pet-anatomy-v2/`.
- Validación: `tests/`, `docs/VALIDATION.md`, `docs/ANDROID_APK.md`, `docs/SHARED_ROOMS_VISUAL_REBUILD.md`, `docs/ROOM_REFERENCE_REBUILD.md`.

Este documento complementa la evidencia de las entregas anteriores y sustituye sus supuestos de alcance cuando contradigan las decisiones confirmadas en la sección 1. No sobrescribe los archivos de otros chats ni presume que sus tareas pendientes ya estén hechas.
