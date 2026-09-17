"""New reference roster. Isolated drafts: never replace the eight released companions."""
from dataclasses import replace
import sys
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools/blender'))
from build_companion_collection import CHARACTERS
base={c.id:c for c in CHARACTERS}
def make(source,id,name,**kw):return replace(base[source],id=id,name=name,**kw)
CHARACTERS_NEW=(
 make('zoe','lux','Lux',personality='Optimista',skin='#E6AF88',skin_light='#F5C7A6',skin_shadow='#C0805E',hair='#DDC39B',hair_mid='#F0DBB8',hair_light='#FFF0D5',top_style='sweater',top='#EEE4D3',top_light='#FFF7E7',top_dark='#CCBFAA',bottom='#DE8FA8',bottom_dark='#B86582',shoes='#EBC7C7',accent='#DD789E',accessory='none'),
 make('milo','finn','Finn',personality='Deportivo',hair='#B68A58',hair_mid='#D5AA70',hair_light='#ECC48C',top='#3B619C',top_light='#6388BC',top_dark='#294571',accent='#EEE3CC',shoes='#E8E4DA'),
 make('nova','elise','Elise',personality='Soñadora',hair='#CDA566',hair_mid='#E8C589',hair_light='#F9DFAD',top='#819268',top_light='#A5B88B',top_dark='#5A6E4E',bottom_style='skirt',bottom='#EEE4CD',bottom_dark='#CDBFA4',shoes='#604630',accessory='none'),
 make('jay','kai','Kai',personality='Seguro',hair='#CFA56B',hair_mid='#E9C98D',hair_light='#FBE1B0',top_style='tshirt',top='#F2E8D6',top_light='#FFF8E9',top_dark='#CDBFA9',accent='#D74235',accessory='headphones'),
 make('zoe','noa','Noa',personality='Concentrado',skin='#D5A27D',skin_light='#EAC29C',skin_shadow='#AD7355',hair='#9F8E7A',hair_mid='#BDAB92',hair_light='#D9C9AE',top_style='sweater',top='#3C5342',top_light='#596F58',top_dark='#273C30',bottom_style='trousers',bottom='#655C52',bottom_dark='#3E3834',accent='#8B9171'),
 make('sky','rem','Rem',personality='Artística',hair='#B7684D',hair_mid='#D78A68',hair_light='#ECAE88',top='#282326',top_light='#463336',top_dark='#161517',bottom='#93AFC7',bottom_dark='#627F9C',accent='#BA493F',shoes='#E9E5DC'),
 make('aria','sage','Sage',personality='Reflexiva',hair_style='long',hair='#B99A65',hair_mid='#D7BC86',hair_light='#EFDAAA',top_style='cardigan',top='#787459',top_light='#979174',top_dark='#514F3E',bottom='#36312A',bottom_dark='#211F1B',accent='#C2A15F',shoes='#EEE8DB'),
 make('harper','orion','Orion',personality='Aventurero',hair='#37271F',hair_mid='#523A2B',hair_light='#72503A',top_style='varsity',top='#AF906C',top_light='#CEB593',top_dark='#7E654C',bottom_style='cargo',bottom='#302D2B',bottom_dark='#1C1B19',shoes='#D5DDE5',accent='#527BA4'),
)
