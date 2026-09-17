"""Generate a portable gallery, inventory and ZIP from validated Blender outputs."""
import csv,json,hashlib,zipfile,struct,zlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'packages/assets/3d/wardrobe';R=ROOT/'renders/wardrobe'
CHARACTERS=['nova','jay','milo','zoe','sky','harper','river','aria']
SHEETS=['remeras','buzos','tejidos-camperas','pantalones-calzado','bolsos','gorras-accesorios','objetos']

def verify_png(path):
    raw=path.read_bytes();assert raw[:8]==b'\x89PNG\r\n\x1a\n',path
    offset=8;ended=False;compressed=[]
    while offset<len(raw):
        length=struct.unpack_from('>I',raw,offset)[0];kind=raw[offset+4:offset+8]
        payload=raw[offset+8:offset+8+length];assert len(payload)==length,path
        crc=struct.unpack_from('>I',raw,offset+8+length)[0]
        assert zlib.crc32(kind+payload)&0xffffffff==crc,path
        if kind==b'IDAT':compressed.append(payload)
        offset+=length+12
        if kind==b'IEND':ended=True;break
    assert ended and offset==len(raw),path
    assert zlib.decompress(b''.join(compressed)),path

def main():
    catalog=json.loads((OUT/'catalog.json').read_text(encoding='utf-8'));audit=json.loads((OUT/'wardrobe.audit.json').read_text(encoding='utf-8'));assert audit['passed']
    for name in [*CHARACTERS,*SHEETS,'nova-pose','milo-pose']:
        path=R/(name+'.png');assert path.is_file(),f'Missing reviewed render: {path}'
        verify_png(path)
    font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',24)
    bold=ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf',45)
    board=Image.new('RGB',(2400,1670),'#EEE9E3');d=ImageDraw.Draw(board)
    d.text((70,36),'COMPA VIRTUAL / GUARDARROPA',font=bold,fill='#302D34')
    d.text((72,101),f"{catalog['uniqueItems']} piezas | 8 personajes | modelos reales de Blender",font=font,fill='#605763')
    for index,char in enumerate(CHARACTERS):
        with Image.open(R/(char+'.png')) as source:
            im=source.convert('RGB');im.thumbnail((560,670),Image.Resampling.LANCZOS)
        x=(index%4)*600+(600-im.width)//2;y=160+(index//4)*750
        board.paste(im,(x,y));d.text((x+im.width//2,y+im.height+13),char.upper(),anchor='mt',font=font,fill='#302D34')
    board.save(R/'guardarropa-coleccion.jpg',quality=94)
    gallery=['# Compa Virtual — guardarropa','', f"{catalog['uniqueItems']} productos distintos modelados a partir de las dos láminas. Las {catalog['illustratedCells']} apariciones de referencia están documentadas; las repetidas comparten un activo.",'', '![Ocho conjuntos](renders/wardrobe/guardarropa-coleccion.jpg)','', '## Biblioteca y archivos','', '- [Biblioteca completa de Blender](packages/assets/3d/wardrobe/source/compa-wardrobe-library.blend)','- [Catálogo con medidas, componentes y reglas](packages/assets/3d/wardrobe/catalog.json)','- [Informe de comprobación](packages/assets/3d/wardrobe/wardrobe.audit.json)','- [Guía técnica y uso](WARDROBE.md)','']
    for group in SHEETS:gallery+=['## '+group.replace('-',' ').title(),'','![Catálogo '+group+'](renders/wardrobe/'+group+'.png)','']
    gallery+=['## Personajes vestidos','', '| Personaje | Archivo editable | Render |','|---|---|---|']
    for char in CHARACTERS:gallery.append(f'| {char.title()} | [Blender](packages/assets/3d/wardrobe/source/{char}-wardrobe-fitted.blend) | [Vista](renders/wardrobe/{char}.png) |')
    gallery+=['','## Movimiento','', '![Manga corta, codo flexionado](renders/wardrobe/nova-pose.png)','', '![Buzo, codo flexionado](renders/wardrobe/milo-pose.png)','']
    (ROOT/'WARDROBE_GALLERY.md').write_text('\n'.join(gallery),encoding='utf-8')
    with (OUT/'inventory.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.writer(f);writer.writerow(['id','family','color','design','slot','source_cells','glb','bytes'])
        for item in catalog['items']:writer.writerow([item['id'],item['family'],item['color'],item['design'],item['slot'],';'.join(item['sources']),item['glb'],item['glbBytes']])
    sizes={'uniqueItems':catalog['uniqueItems'],'illustratedCells':catalog['illustratedCells'],'glbBytes':audit['glbBytes'],'characters':8,'libraryBytes':(OUT/'source/compa-wardrobe-library.blend').stat().st_size,'largestItemBytes':audit['maximumItemBytes'],'previewType':'Actual Blender renders, no generated concept images','appIntegrated':False}
    (OUT/'delivery.json').write_text(json.dumps(sizes,indent=2,ensure_ascii=False),encoding='utf-8')
    files=[ROOT/'WARDROBE.md',ROOT/'WARDROBE_GALLERY.md']
    files.extend(p for p in OUT.rglob('*') if p.is_file() and 'custom' not in p.parts)
    files.extend(p for p in R.glob('*') if p.suffix in ('.png','.jpg','.json') and not p.stem.endswith('-review'))
    for folder,names in [('scripts',['wardrobe_pipeline.py','dress_companion.py','export_wardrobe_body_fits.py','package_wardrobe.py','finish_wardrobe_review.py','extend_wardrobe_centerpieces.py']),('tools/blender',['wardrobe_catalog.py','wardrobe_geometry.py','wardrobe_body_fit.py','inspect_wardrobe_bodies.py','audit_wardrobe.py','build_harper.py','build_companion_collection.py','premium_glb.py'])]:
        files.extend(ROOT/folder/n for n in names)
    files.extend(ROOT/f'packages/assets/3d/source/{char}-master-v4.blend' for char in CHARACTERS)
    archive=ROOT/'deliverables/compa-virtual-guardarropa-completo.zip';archive.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in sorted(set(files)):z.write(p,p.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(archive) as z:assert z.testzip() is None;count=len(z.namelist())
    info={'zip':str(archive),'bytes':archive.stat().st_size,'files':count,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
    (ROOT/'deliverables/compa-virtual-guardarropa-completo.delivery.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
    print(json.dumps(info,indent=2))

if __name__=='__main__':main()
