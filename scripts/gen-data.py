"""Builds src/data/*.json from the design canvas files (data/catalog.json, data/illustrations.json, Illo.dc.html).
Usage: python3 scripts/gen-data.py <folder holding the canvas's project/ files>"""
import json, re, sys, os
P = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')

def attrs_from_style(svg):
    # style="stroke: #1B2B22; stroke-width: 2" -> stroke="#1B2B22" stroke-width="2" (react-native-svg friendly)
    def fix(m):
        decls = [d.split(':', 1) for d in m.group(1).split(';') if ':' in d]
        return ' '.join(f'{k.strip()}="{v.strip()}"' for k, v in decls)
    return re.sub(r'style="([^"]*)"', fix, svg)

cat = json.load(open(f'{P}/data/catalog.json'))
items = []
for a in cat['aisles']:
    for i in a['items']:
        items.append({k: i[k] for k in ('id', 'name', 'aisle', 'defaultQty', 'tile', 'shopOrder', 'aliases') } | ({'types': i['suggestedTypes']} if i.get('suggestedTypes') else {}))
json.dump({'aisles': [a['name'] for a in cat['aisles']], 'items': items}, open(f'{OUT}/catalog.json', 'w'), separators=(',', ':'), ensure_ascii=False)

ill = json.load(open(f'{P}/data/illustrations.json'))['illustrations']
json.dump({k: attrs_from_style(v) for k, v in ill.items()}, open(f'{OUT}/illos.json', 'w'), separators=(',', ':'))

# container pictures for custom items, and where their label (the letter) sits on the 64 grid
il = open(f'{P}/Illo.dc.html').read()
shapes = {}
for m in re.finditer(r'<sc-if value="\{\{s\.([a-z]+)\}\}"[^>]*>\s*(<svg.*?</svg>)\s*</sc-if>', il, re.S):
    svg = re.sub(r'width="\{\{size\}\}" height="\{\{size\}\}" ', '', m.group(2))
    shapes[m.group(1)] = attrs_from_style(svg)
LBL = dict((k, float(v)) for k, v in re.findall(r'(\w+): ([\d.]+)', re.search(r'const LBL = \{([^}]*)\}', il).group(1)))
LBX = dict((k, float(v)) for k, v in re.findall(r'(\w+): ([\d.]+)', re.search(r'const LBX = \{([^}]*)\}', il).group(1)))
json.dump({'svgs': shapes, 'labelY': LBL, 'labelX': LBX}, open(f'{OUT}/shapes.json', 'w'), separators=(',', ':'))
print(len(items), 'items;', len(ill), 'illustrations;', len(shapes), 'shapes:', sorted(shapes))
