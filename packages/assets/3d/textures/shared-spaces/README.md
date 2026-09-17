# Fondos exteriores — salas comunes

Generados con la herramienta integrada image_gen el 13 de septiembre de 2026. Se conservan los originales completos en esta carpeta; no son renders de las salas ni sustituyen mobiliario. Los marcos, pilares, barandas, canteros y muebles se construyen en Blender.

- sunset.png: ciudad detallada voxel al atardecer para la terraza.
- garden.png: parque y barrio arbolado para los ventanales de la biblioteca.

El pipeline convierte las imágenes en paneles con colores de vértice (256 columnas) detrás de la geometría del primer plano. Esto permite usar los mismos GLB en web y Expo sin un decodificador de texturas adicional. El archivo original permite aumentar resolución o cambiar a textura más adelante.

## Prompts utilizados

### sunset.png

Create a production game environment texture, one single seamless-looking wide landscape image, aspect ratio 2:1, of a distant welcoming city skyline at peach-pink sunset for a premium cozy voxel 3D study-game rooftop. This is BACKGROUND SCENERY ONLY, full bleed, viewed straight toward the horizon at rooftop eye level, gently elevated view over many warm midrise apartment blocks and a few elegant tall buildings. Crisp miniature voxel / stylized 3D architectural details, thousands of tasteful lit square windows, rooftop terraces, subtle layered atmospheric depth; peach sky fading to lavender overhead, softly geometric pale orange clouds; warm amber window lights contrasting muted blue-purple buildings. Match warm finely crafted toy-diorama world, sophisticated cozy game art, detailed not flat cartoon, no photographic realism. Grounded continuous dense city extending below bottom edge, sky upper 45%, tallest towers central thirds, horizon consistent. No near foreground objects, NO railing, NO room, NO interior, NO people, NO furniture, NO border, NO words, NO logos, NO split panels, NO phone mockup. No isolated floating buildings. This image will sit behind real 3D windows and barandas and must visually read as distant world beyond them, not a picture hanging on a wall.

### garden.png

One single 2:1 wide landscape production BACKGROUND texture for the windows of a premium cozy voxel 3D educational game. Exterior scenery only: a lush peaceful leafy neighborhood park viewed straight toward the horizon from a first floor study-room window, distant warm stone lowrise academic buildings between many detailed stylized broadleaf trees and shrubs. Bright late-afternoon daylight, blue pale sky with softly block-shaped clouds upper 40%, rich layered green canopies, warm highlights, muted distant architecture, tidy park paths only far away. Sophisticated high-detail softly beveled voxel miniature 3D art, harmonious greens and warm beige, realistic soft lighting within stylized world, not flatvector, not photo. Foreground trees should extend below loweredge; scene fills image edge-to-edge with continuous environment. NO indoor objects, NO window frames (will be added as real3D geometry), NO curtains, NO near railings, NO humans, NO furniture, NO text, NO border, NO collage, NO mockup. Intended to make the far environment look real beyond windows, not like a framed picture. Keep camera horizontal and verticals straight.
