"""Stage model assets and lightweight previews, generate a shared wearable catalog."""
import json,shutil,sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];A=ROOT/'packages/assets/3d';PUBLIC=ROOT/'apps/web/public/selection'
PUBLIC.mkdir(parents=True,exist_ok=True)
for d in ['characters','rooms','wardrobe','models']:(PUBLIC/d).mkdir(exist_ok=True)
for id in ['nova','jay','milo','zoe','sky','harper','river','aria']:
    with Image.open(ROOT/f'renders/wardrobe/{id}.png') as im:
        im.resize((500,600),Image.Resampling.LANCZOS).save(PUBLIC/f'characters/{id}.webp',quality=87)
        im.crop((150,150,850,780)).resize((240,216),Image.Resampling.LANCZOS).save(PUBLIC/f'characters/{id}-portrait.webp',quality=86)
for id in ['cozy','minimalista','tecnologia','naturaleza','urbano','biblioteca-moderna']:
    path=ROOT/'renders/room-cozy-premium/hero.png' if id=='cozy' else ROOT/f'renders/room-collection/{id}/hero.png'
    with Image.open(path) as im:im.thumbnail((1200,900));im.save(PUBLIC/f'rooms/{id}.webp',quality=87)
catalog=json.loads((A/'wardrobe/catalog.json').read_text(encoding='utf-8'))
families={'tee':'Remera','longsleeve':'Manga larga','hoodie':'Buzo con capucha','sweatshirt':'Buzo','sweater':'Sweater','varsity':'Campera universitaria','puffer':'Campera inflada','denimjacket':'Campera de jean','shearling':'Campera de abrigo','utility':'Campera urbana','cargo':'Pantalón cargo','trackpants':'Pantalón deportivo','shorts':'Short','sportshorts':'Short deportivo','sneaker':'Zapatillas','boot':'Botas','cap':'Gorra','beanie':'Gorro tejido','bucket':'Piluso','glasses':'Anteojos','headphones':'Auriculares','backpack':'Mochila','crossbody':'Bandolera','watch':'Reloj','bracelet':'Pulsera','necklace':'Collar','belt':'Cinturón','wristband':'Muñequera','pin':'Pin','carabiner':'Mosquetón','charm':'Adorno','keyring':'Llavero','ring':'Anillo'}
colors={'white':'blanco','black':'negro','ivory':'crema','green':'verde','blue':'azul','navy':'azul marino','sky':'celeste','purple':'violeta','red':'rojo','pink':'rosa','gray':'gris','charcoal':'grafito','brown':'marrón','tan':'beige','denim':'denim','olive':'oliva','yellow':'amarillo','silver':'plateado','gold':'dorado'}
groups={
    'remeras':['tee','longsleeve'],'buzos':['hoodie','sweatshirt'],
    'tejidos-camperas':['sweater','varsity','puffer','denimjacket','shearling','utility'],
    'pantalones-calzado':['cargo','trackpants','shorts','sportshorts','sneaker','boot'],
    'bolsos':['backpack','crossbody'],
    'gorras-accesorios':['cap','beanie','bucket','glasses','headphones','watch','bracelet','necklace','belt','wristband','pin','carabiner','charm','keyring','ring']}
for group,group_families in groups.items():
    info={'items':[i['id'] for i in catalog['items'] if i['family'] in group_families]}
    with Image.open(ROOT/f'renders/wardrobe/{group}.png') as im:
        width,height=im.size;rows=(len(info['items'])+5)//6;cellh=height/rows
        # Camera horizontal span is 6.85, centers at +/- 2.75 with 1.1 spacing.
        for n,id in enumerate(info['items']):
            cx=width/2+((n%6-2.5)*1.1/6.85)*width;cy=(n//6+.45)*cellh
            box=(round(cx-cellh*.42),round(cy-cellh*.41),round(cx+cellh*.42),round(cy+cellh*.41))
            im.crop(box).resize((240,234),Image.Resampling.LANCZOS).save(PUBLIC/f'wardrobe/{id}.webp',quality=86)
items=[]
for item in catalog['items']:
    if item['slot']=='prop':continue
    label=f"{families[item['family']]} · {colors.get(item['color'],item['color'])}"
    items.append({k:item[k] for k in ['id','family','slot','color','design']}|{'label':label})
    shutil.copy2(A/'wardrobe'/item['glb'],PUBLIC/'models'/f"{item['id']}.glb")
content='// Generated from the verified Blender wardrobe catalog.\nexport interface WardrobeItem { id: string; family: string; slot: string; color: string; design: string; label: string }\nexport const wardrobeItems: WardrobeItem[] = '+json.dumps(items,ensure_ascii=False,indent=2)+';\n'
(ROOT/'packages/domain/src/wardrobe-catalog.ts').write_text(content,encoding='utf-8')
if (A/'app/all-export.json').exists():
    shutil.copy2(A/'app/all-export.json',PUBLIC/'models/manifest.json')
    for path in (A/'app').glob('*.glb'):shutil.copy2(path,PUBLIC/'models'/path.name)
print(f'Staged {len(items)} wearable items; all eight portraits and six room previews.')
