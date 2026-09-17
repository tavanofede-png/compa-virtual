# Ocho espacios de estudio — revisión de modelos

Fecha: 16 de septiembre de 2026.

Abrir `revision-ocho-espacios.html` a través del servidor local para revisar cada referencia junto al modelo actual, desplegar la versión anterior y ampliar los acercamientos. Cada ambiente enlaza su fuente Blender, exportación GLB e inventario.

| ID | Ambiente |
|---|---|
| library | Rincón de biblioteca |
| terrace | Terraza al atardecer |
| pergola | Pérgola de jardín |
| cafe | Rincón de café |
| minimal | Estudio minimalista |
| tech | Estudio tecnológico |
| pavilion | Pabellón del parque |
| loft | Ático acogedor |

Para cada ID:

- Referencia: `images/ID-hero.png`.
- Vista del modelo: `images/ID-model-hero.png`.
- Acercamiento real: `images/ID-detail.png`.
- Versión anterior: `images/before-detail-revision/ID-model-hero.png`.
- Fuente editable: `../../packages/assets/3d/source/personal-spaces/v1/ID-master.blend`.
- Exportación: `models/ID.glb`, con métricas en `models/ID.json`.
- Distribución: `data/ID-model-layout.json`.
- Inventario: `data/ID-model-inventory.json`.

Las fuentes usan metros y conservan las agrupaciones de muebles y objetos. Los GLB conservan grupos por objeto colocable; la exportación reúne geometría interna para evitar un nodo por cada pieza diminuta. No son una compilación optimizada para teléfonos.

## Reproducción de la revisión

Desde la raíz del repositorio:

```powershell
node scripts/serve-personal-study.mjs
node scripts/review-personal-study.mjs
node scripts/validate-personal-study-review.mjs
```

La galería se encuentra en `http://127.0.0.1:4392/design/personal-spaces-v1/revision-ocho-espacios.html`.

Para regenerar vistas y exportaciones desde los maestros guardados:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --threads 8 --factory-startup --python scripts/render_personal_study_review.py -- library terrace pergola cafe minimal tech pavilion loft --export
```

Los scripts de acabado guardan revisiones en la escena para evitar duplicar geometría al repetir el proceso. No cambiar esos indicadores sin revisar el código y realizar una copia de la fuente.

## Alcance de la entrega

Esta entrega corresponde a la mejora de los ocho modelos existentes. No declara terminado el plan completo del editor, catálogo, audio ni sus recorridos de aplicación. La comparación visual y las diferencias aún presentes se documentan en `COMPARACION-OCHO-ESPACIOS.md`. Los resultados técnicos están en `data/review-validation.json` y tienen un alcance limitado a los archivos y muebles registrados; no sustituyen las pruebas visuales, animación ni rendimiento nativo.
