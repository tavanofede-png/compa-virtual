"""Apply catalog choices to a preserved character copy using its actual rig.

Blender --background --python scripts/dress_companion.py -- harper
  sweater-ivory-cable cargo-black-plain sneaker-red-panel glasses-black-rect
Output: packages/assets/3d/wardrobe/custom/harper-custom.blend
"""
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from wardrobe_pipeline import fitted,CHARACTERS,OUT
args=sys.argv[sys.argv.index('--')+1:]
if len(args)<2:raise ValueError('Pass character ID followed by catalog item IDs')
character=next(c for c in CHARACTERS if c.id==args[0]);destination=OUT/f'custom/{character.id}-custom.blend';destination.parent.mkdir(parents=True,exist_ok=True)
fitted(character,args[1:],destination)
print('CUSTOM_OUTFIT',destination,flush=True)
