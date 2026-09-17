import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import refine_reference_room_layouts as refine
import finish_reference_room_details as finish
refine.SKIP_RENDER=True
for theme in (sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['rincon-urbano','sala-control-gamer','habitacion-invernadero','estudio-musical','rincon-explorador','atico-creativo']):
 if theme in ['habitacion-invernadero','estudio-musical','rincon-explorador']:refine.refine(theme)
 finish.final(theme)
