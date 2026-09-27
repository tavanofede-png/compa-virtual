# IA y recuperación de materiales

## Proveedor

AIProvider expone generación estructurada, embeddings y OCR. `CloudflareAIProvider` es el proveedor de prueba compartido; usa Workers AI, JSON mode, embeddings multilingües y OCR visual. `OpenAIProvider` continúa disponible para producción mediante Responses con `store:false`. Ambos entregan vectores de 1536 dimensiones al índice actual y registran tokens por propósito/modelo.

Las tarifas de entrada, salida y embeddings se configuran por separado. El worker y la API calculan el costo estimado con esas tarifas; sin configuración, guardan null junto al consumo. La estimación no descuenta caché ni reemplaza la factura del proveedor. Actualizar las tarifas cuando se cambia de modelo.

La selección de modelo y el acceso real deben verificarse con las credenciales del proyecto. Las pruebas que sustituyen `fetch` certifican el contrato, no una llamada real al proveedor.

## Políticas

El tutor pide intentos y da pistas, explicaciones o ejemplos diferentes. No redacta una entrega escolar final. En prácticas nuevas de la app puede mostrar soluciones después de responder. Una pregunta por vez, sin etiquetas de estilos de aprendizaje ni afirmaciones de dominio automático.

Los archivos, recuerdos y mensajes se tratan como datos no confiables. El modelo propone acciones estructuradas de un catálogo cerrado; el servidor las valida mediante los mismos comandos que la UI y devuelve recibos después del guardado versionado. No dispone de SQL, consultas arbitrarias, permisos administrativos ni acceso a otras cuentas. Las referencias propuestas se comparan con los fragmentos efectivamente recuperados; una cita inexistente provoca un error recuperable. La continuación local de contexto y memoria se documenta en [AGENT_MEMORY.md](./AGENT_MEMORY.md).

El lenguaje general se identifica como explicación general. Una actividad basada en un material exige al menos una referencia por pregunta. Un formato incompleto o una respuesta rechazada no se reemplaza con contenido inventado.

## Menores y datos

La configuración inicial mantiene MINOR_BETA_APPROVED=false y no admite cuentas de menores de 13 años. Las capacidades de servicio, IA y social requieren aceptación separada por una familia verificada. La continuación local de materiales permite cargar y extraer texto nativo con autorización de servicio; OCR e indexación requieren además autorización de IA y habilitación efectiva del proveedor. La aprobación de proveedores para menores no se infiere de una bandera ni de la verificación del email. El estado publicado y las dependencias se registran en [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md) y [MATERIAL_RECOVERY.md](./MATERIAL_RECOVERY.md).

Cloudflare declara que Workers AI no usa Customer Content para entrenar modelos ni mejorar servicios sin consentimiento. Con OpenAI, `store:false` no equivale por sí solo a Zero Data Retention. La recuperación se mantiene en Supabase. Estas decisiones no sustituyen las revisiones legales y contractuales.

Fuentes: [guía oficial para menores](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance), [controles de datos](https://developers.openai.com/api/docs/guides/your-data), [modelo inicial](https://developers.openai.com/api/docs/guides/latest-model).

## Evaluación antes de alumnos

Casos mínimos: pedido de tarea completa; intento equivocado; consigna ambigua; material ilegible; instrucción maliciosa dentro del PDF; cita inexistente; contenido fuera del material; frustración académica; solicitud de secretos; mezcla de cuentas; respuesta incompleta; corrección de ecuaciones; preguntas de ciencias con unidades. El equipo pedagógico debe revisar contenido, tono y exactitud con el modelo real.
