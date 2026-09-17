from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
R=Path(__file__).resolve().parents[1];pre=R/'renders/new-reference-characters';src=R/'packages/assets/3d/source/new-reference-characters'
names=['lux','finn','elise','kai','noa','rem','sage','orion'];entries=[]
for name in names:
 v=2 if (pre/(name+'-reference-v2.png')).exists() else 1
 entries.append((name,f'{name}-reference-v{v}'))
font=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',25);title=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',32)
board=Image.new('RGB',(1600,950),'#eee9e2');d=ImageDraw.Draw(board);d.text((24,15),'COMPA VIRTUAL · PERSONAJES EN REVISIÓN',font=title,fill='#172335')
for i,(name,stem) in enumerate(entries):
 im=Image.open(pre/(stem+'.png')).convert('RGB');im.thumbnail((395,395),Image.Resampling.LANCZOS);x=i%4*400;y=70+i//4*440;board.paste(im,(x,y));d.text((x+22,y+400),name.capitalize(),font=font,fill='#172335')
board.save(pre/'nuevos-personajes-review.jpg',quality=94)
items=''.join(f'<article><h2>{name.capitalize()}</h2><img src="{stem}.png" alt="Modelo Blender de {name}"><a href="../../packages/assets/3d/source/new-reference-characters/{stem}.blend">Abrir maestro Blender</a></article>' for name,stem in entries)
(pre/'revision-personajes.html').write_text('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Compa Virtual · Nuevos personajes</title><style>body{background:#f3efe9;color:#172335;font:17px/1.5 system-ui;margin:0}main{max-width:1100px;margin:auto;padding:30px}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:28px}img{width:100%;border-radius:14px}a{color:#244e63}h1{font-size:36px}</style><main><h1>Nuevos personajes · revisión</h1><p>Ocho primeras versiones modeladas en Blender, con ropa separada y rig compartido. Todavía requieren refinamiento artístico, prueba completa de vestuario y poses. No están integradas en la app.</p><section>'+items+'</section></main>',encoding='utf-8')
(src/'review-manifest.json').write_text(json.dumps({'status':'first artistic review; not final reference fidelity','characters':[{'id':n,'master':s+'.blend','app_integrated':False} for n,s in entries]},indent=2))
print('Galería y lámina de ocho personajes creadas')
