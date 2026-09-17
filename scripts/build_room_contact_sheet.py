from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parents[1];out=R/'renders/reference-rooms'
rooms=[('atico-creativo','ÁTICO CREATIVO'),('rincon-urbano','RINCÓN URBANO'),('sala-control-gamer','SALA DE CONTROL GAMER'),('habitacion-invernadero','HABITACIÓN INVERNADERO'),('estudio-musical','ESTUDIO MUSICAL'),('rincon-explorador','RINCÓN EXPLORADOR')]
board=Image.new('RGB',(1800,1120),'#f6f2ed');d=ImageDraw.Draw(board)
font=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',22);title=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',34)
d.text((28,16),'COMPA VIRTUAL · HABITACIONES',font=title,fill='#172335')
for i,(slug,label) in enumerate(rooms):
 im=Image.open(out/(slug+'-review.png')).convert('RGB');im.thumbnail((590,472),Image.Resampling.LANCZOS)
 x=(i%3)*600+5;y=76+(i//3)*520;board.paste(im,(x,y));d.text((x+15,y+480),label,font=font,fill='#172335')
board.save(out/'coleccion-habitaciones-review.jpg',quality=94)
print(out/'coleccion-habitaciones-review.jpg')
