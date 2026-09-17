# Mascotas — checkpoint antes de integrar sesiones grupales

2026-09-12. Se conserva el trabajo durante el cambio de prioridad del usuario.

- `scripts/build_pet_anatomy.py`: hámster y ocho gatos reconstruidos. Salidas en `renders/pet-anatomy-v2`.
- `scripts/build_small_pet_anatomy.py`: siete especies adicionales reconstruidas; ejecución finalizada.
- Todos tienen GLB, fuentes Blender y dos renders. **Todavía no promovidos al catálogo publicado.**
- `scripts/refine_pet_anatomy_motion.py`: corrección de ejes y bake de contacto por frame, aplicado a hámster y gato naranja. Resto pendiente; el script todavía solo distingue hámster/gato y requiere perfiles de las otras especies.
- `scripts/validate-pet-anatomy.mjs`: analiza clips y vértices deformados de los GLB. Pendiente endurecer tolerancia de contacto y validar todos.
- Gato naranja: revisar última postura de descanso; los ensayos anteriores se corrigieron, no usar previews anteriores.
- Pendiente revisión visual de las siete especies, promoción, actualización de previews nativas y versión de assets, publicación.

No borrar ni reemplazar estas salidas al trabajar en las salas grupales.
