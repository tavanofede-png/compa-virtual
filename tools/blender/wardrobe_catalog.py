"""Every illustrated product, with explicit source-cell provenance and deduplication."""
from collections import Counter

COLORS={'ivory':'#EEE5D6','white':'#F8F4ED','black':'#252329','charcoal':'#39363B','navy':'#303D62','blue':'#4276C8','sky':'#8CB5E2','denim':'#7396BD','pink':'#E980A2','red':'#AD3542','green':'#315E4F','olive':'#626951','purple':'#9D63B9','gray':'#A8A6AB','tan':'#C8AE88','brown':'#654937','yellow':'#ECAE37','gold':'#BF8B35','silver':'#A9B1B8','orange':'#DD7539'}
ITEMS={}
CELLS=[]

def row(board,category,entries):
    for index,spec in enumerate(entries.split(';'),1):
        family,color,design,*rest=spec.strip().split('/')
        variant=rest[0] if rest else ''
        ident='-'.join(filter(None,(family,color,design,variant)))
        cell=f'{board}/{category}/{index:02d}'
        if ident not in ITEMS:
            slot=('top' if family in ('tee','longsleeve','hoodie','sweatshirt','sweater') else
                  'outerwear' if family in ('varsity','puffer','denimjacket','shearling','utility') else
                  'bottom' if family in ('cargo','trackpants','shorts','sportshorts') else
                  'shoes' if family in ('sneaker','boot') else 'headwear' if family in ('cap','beanie','bucket') else
                  'face_accessory' if family=='glasses' else 'back' if family=='backpack' else
                  'crossbody' if family=='crossbody' else 'neck' if family in ('headphones','necklace') else
                  'wrist' if family in ('watch','bracelet','wristband') else 'waist' if family=='belt' else
                  'charm' if family in ('charm','pin','keyring','ring','carabiner') else 'prop')
            ITEMS[ident]={'id':ident,'family':family,'color':color,'design':design,'variant':variant,'slot':slot,'sources':[]}
        ITEMS[ident]['sources'].append(cell)
        CELLS.append({'cell':cell,'item':ident})

row('A','t-shirts','tee/white/smile;tee/black/robot;tee/ivory/good-days;tee/green/98;tee/blue/double-stripe;tee/black/flame')
row('A','hoodies','hoodie/gray/plain;hoodie/blue/wave;hoodie/purple/butterfly;hoodie/black/red-butterfly;hoodie/ivory/nyc;hoodie/green/focus')
row('A','pants','cargo/denim/plain;cargo/black/plain;cargo/tan/plain;cargo/olive/plain;cargo/gray/plain;cargo/ivory/chain;cargo/black/orange-stitch')
row('A','sneakers','sneaker/red/panel;sneaker/black/panel;sneaker/yellow/panel;sneaker/blue/panel;sneaker/pink/panel;sneaker/green/panel;sneaker/ivory/panel;sneaker/black/mono')
row('A','sweatshirts','sweatshirt/ivory/calm;sweatshirt/navy/better-days;sweatshirt/green/mountain;sweatshirt/pink/heart;sweatshirt/sky/double-stripe;sweatshirt/charcoal/study')
row('A','jackets','varsity/red/a; puffer/black/label;varsity/green/s;denimjacket/denim/hood;shearling/tan/plain;utility/black/purple')
row('A','hats','cap/yellow/smile;cap/black/cross;cap/ivory/good-days;beanie/blue/cat;beanie/red/label;bucket/green/flower')
row('A','glasses','glasses/black/rect;glasses/gold/round;glasses/black/sun;glasses/white/rect;glasses/gray/smoke;glasses/pink/rect')
row('A','headphones','headphones/black/plain;headphones/white/plain;headphones/pink/plain;headphones/blue/cat')
row('A','backpacks','backpack/black/heart;backpack/red/plain;backpack/green/smile;backpack/ivory/plain')
row('A','accessories','watch/black/digital;bracelet/black/bead-gold;necklace/silver/smile;belt/black/square;wristband/ivory/label;pin/gold/star;carabiner/silver/plain;charm/green/dino;charm/pink/flower')
row('A','small-objects','books/green/study; laptop/gray/cat;frame/ivory/good-days;mug/ivory/fuel-good;bottle/blue/cat;phone/black/plain;camera/black/gold;pouch/blue/cat;plant/tan/leaf;lamp/silver/plain;trophy/gold/cup')

row('B','t-shirts','tee/white/planet;tee/black/cat;tee/green/good-study;tee/ivory/mountain;tee/blue/all-stripe;tee/black/galaxy')
row('B','long-sleeves','longsleeve/black/all-stripe;longsleeve/ivory/stay-kind;longsleeve/brown/raglan-star;longsleeve/black/flame;longsleeve/green/all-stripe;longsleeve/ivory/label')
row('B','hoodies','hoodie/gray/focus;hoodie/blue/cloud;hoodie/purple/cloud;hoodie/black/orange-butterfly;hoodie/green/plain;hoodie/ivory/better-days')
row('B','sweaters','sweater/ivory/cable;sweater/navy/bear;sweater/green/stripe;sweater/red/cable;sweater/sky/fairisle;sweater/black/smile')
row('B','pants','cargo/denim/plain;cargo/black/plain;cargo/olive/plain;cargo/tan/plain;cargo/gray/plain;trackpants/black/piping')
row('B','shorts','sportshorts/black/piping;sportshorts/green/piping;shorts/tan/cargo;shorts/denim/cargo;shorts/olive/cargo')
row('B','sneakers','sneaker/red/panel;sneaker/black/panel;sneaker/blue/panel;sneaker/green/panel;sneaker/olive/panel;sneaker/purple/panel;sneaker/pink/panel;sneaker/ivory/panel')
row('B','boots','boot/yellow/hiker;boot/black/hiker;boot/brown/hiker;boot/olive/hiker;boot/ivory/hiker')
row('B','jackets','varsity/red/a;puffer/black/label;varsity/green/b;denimjacket/denim/shearling;puffer/ivory/label;utility/black/orange')
row('B','backpacks','backpack/black/smile;backpack/ivory/plain;backpack/olive/plain;backpack/purple/plain;backpack/pink/plain;backpack/navy/flower')
row('B','crossbody-bags','crossbody/black/cat;crossbody/ivory/label;crossbody/green/smile;crossbody/blue/cat;crossbody/pink/label;crossbody/black/checker')
row('B','hats','cap/black/ny;cap/ivory/mountain;cap/blue/label;cap/green/flower;beanie/red/label;beanie/gray/label;bucket/blue/smile;bucket/ivory/label')
row('B','glasses','glasses/black/rect;glasses/gold/round;glasses/black/sun;glasses/silver/rect;glasses/blue/sun;glasses/pink/round')
row('B','accessories','headphones/black/plain;watch/gold/analog;necklace/silver/chain;necklace/gold/chain;belt/black/square;keyring/silver/plain;ring/silver/plain;bracelet/black/bead-white;charm/yellow/smile;pin/gold/star;charm/green/clover;charm/pink/tag')
row('B','study-objects','laptop/gray/plain;tablet/black/plain;planner/tan/plan;pen/black/fine;pen/blue/fine;pen/pink/fine;pen/green/fine;pen/red/fine;postits/yellow/pastel')
row('B','desk-objects','lamp/black/plain;plant/tan/leaf;mug/ivory/good-ideas;penholder/gray/color;clock/black/digital;books/tan/stack')
row('B','hobby-objects','camera/black/plain;gamepad/black/plain;console/blue/red;soccer/white/panel;basketball/orange/panel;keyboard/black/music;sketchbook/ivory/sketch;skateboard/black/plain;guitar/tan/acoustic')
row('B','reward-objects','trophy/gold/cup;medal/gold/ribbon;trophy/gold/star;frame/brown/well-done;books/purple/plant;guitar/tan/acoustic')

# Distinct products worn by the two central figures, absent from the side rows.
row('A','central-figure','hoodie/ivory/smile')
row('B','central-figure','varsity/navy/c;beanie/black/gold-label;headphones/black/ivory-pads;crossbody/black/stickers')

CATALOG=list(ITEMS.values())
FAMILIES=dict(Counter(i['family'] for i in CATALOG))
if __name__=='__main__':
    import json
    print(json.dumps({'uniqueItems':len(CATALOG),'referenceCells':len(CELLS),'families':FAMILIES},indent=2))
