# IA y recuperación de materiales

## Proveedor

AIProvider expone generación estructurada, embeddings y OCR. OpenAIProvider usa Responses con gpt-6-astra configurable y store:false. Embeddings: text-embedding-3-small, 1536 dimensiones. Se registran tokens por propósito/modelo; el precio debe configurarse con la tarifa vigente, sin asumir costos cero.

Las tarifas de entrada, salida y embeddings se configuran por separado. El worker y la API calculan el costo estimado con esas tarifas; sin configuración, guardan null junto al consumo. La estimación no descuenta caché ni reemplaza la factura del proveedor. Actualizar las tarifas cuando se cambia de modelo.

La selección de modelo y el acceso real deben verificarse con las credenciales del proyecto. Ninguna llamada real a OpenAI se certifica por tests que sustituyen fetch.

## Políticas

El tutor pide intentos y da pistas, explicaciones o ejemplos diferentes. No redacta una entrega escolar final. En prácticas nuevas de la app puede mostrar soluciones después de responder. Una pregunta por vez, sin etiquetas de estilos de aprendizaje ni afirmaciones de dominio automático.

Los archivos, recuerdos y mensajes se tratan como datos no confiables. El modelo no dispone de herramientas de escritura ni de consultas arbitrarias. Las referencias propuestas se comparan con los fragmentos efectivamente recuperados; una cita inexistente provoca un error recuperable.

El lenguaje general se identifica como explicación general. Una actividad basada en un material exige al menos una referencia por pregunta. Un formato incompleto o una respuesta rechazada no se reemplaza con contenido inventado.

## Menores y datos

La configuración inicial mantiene MINOR_BETA_APPROVED=false. La IA y los materiales de una cuenta menor requieren habilitación y consentimiento verificado. Para menores de 13 años o de la edad digital aplicable se exige además OPENAI_ZDR_VERIFIED=true, respaldado por aprobación y alcance reales del proveedor.

store:false no equivale a Zero Data Retention. No se usan Conversations, archivos persistidos en OpenAI ni vector stores administrados por OpenAI. La recuperación se mantiene en Supabase. Estas decisiones no sustituyen las revisiones legales y contractuales.

Fuentes: [guía oficial para menores](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance), [controles de datos](https://developers.openai.com/api/docs/guides/your-data), [modelo inicial](https://developers.openai.com/api/docs/guides/latest-model).

## Evaluación antes de alumnos

Casos mínimos: pedido de tarea completa; intento equivocado; consigna ambigua; material ilegible; instrucción maliciosa dentro del PDF; cita inexistente; contenido fuera del material; frustración académica; solicitud de secretos; mezcla de cuentas; respuesta incompleta; corrección de ecuaciones; preguntas de ciencias con unidades. El equipo pedagógico debe revisar contenido, tono y exactitud con el modelo real.
