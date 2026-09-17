"""Authored maker room: separate architecture, six working places and real tools.

The room is deliberately not the study-room layout with a different palette.
All geometry is in Blender metres, Z-up; the caller owns lighting and export.
"""
import bpy
import math
import random
from mathutils import Vector


def build_projects(k, seats, kit):
    rng = random.Random(70913)
    box, beam, plant = kit.box, kit.beam, kit.plant
    bookstack, laptop, notebook = kit.bookstack, kit.laptop, kit.notebook
    for name, color, roughness, metal in [
        ('maker_plaster', '#C7C5B9', .9, 0),
        ('maker_stone', '#979A94', .88, 0),
        ('maker_mortar', '#B6B8AF', .95, 0),
        ('maker_cork', '#AF762F', .96, 0),
        ('maker_cork_dark', '#805B32', .96, 0),
        ('maker_steel', '#405563', .47, .45),
        ('maker_aluminium', '#A2ADB0', .36, .75),
        ('maker_wood', '#BA8444', .65, 0),
        ('maker_endgrain', '#977042', .88, 0),
        ('maker_mat', '#267867', .86, 0),
        ('maker_grid', '#A5CFB0', .85, 0),
        ('maker_orange', '#D37938', .68, 0),
        ('maker_red', '#A44530', .7, 0),
        ('maker_rubber', '#222E30', .96, 0),
        ('maker_marker', '#3B526C', .7, 0),
        ('maker_fabric', '#D0B37E', .95, 0),
        ('maker_leaf_deep', '#284A26', .85, 0),
        ('maker_leaf_olive', '#5E7836', .86, 0),
        ('maker_leaf_fresh', '#8B9A46', .88, 0),
        ('maker_leaf_vein', '#748847', .89, 0),
        ('maker_planter_clay', '#A97850', .87, 0),
        ('maker_lampglow', '#FFD79B', .45, 0),
    ]:
        k.material(name, color, roughness, metal)
    for i, color in enumerate(['#C6C4B9', '#BCBDB4', '#D2CFC2', '#C4C4BA']):
        k.material('maker_block_' + str(i), color, .9)
    for i, color in enumerate(['#C89755', '#BE8A4B', '#D0A26A', '#B58249']):
        k.material('maker_plank_' + str(i), color, .71)
    glow = k.mat('maker_lampglow').node_tree.nodes.get('Principled BSDF')
    glow.inputs['Emission Color'].default_value = (1.0, .57, .22, 1)
    glow.inputs['Emission Strength'].default_value = 3.4

    def B(n, p, d, m, bevel=.012, parent=None):
        return box(k, 'Maker ' + n, p, d, m, bevel, parent)

    def T(n, points, radius=.009, material='maker_marker', parent=None):
        return k.tube('Maker ' + n, points, radius, material, 'MAKER_DETAILS', parent=parent)

    def C(n, p, radius, height, material, vertices=12, parent=None):
        return k.cylinder('Maker ' + n, p, radius, height, material, 'MAKER_DETAILS', vertices, parent=parent)

    def warm_pool(n, p, target, watts=27, size=.25):
        """Fixture-authored soft light; emissive reflector survives GLB export."""
        data = bpy.data.lights.new('Maker ' + n, 'AREA')
        data.energy = watts
        data.color = (1.0, .71, .40)
        data.shape = 'RECTANGLE'
        data.size = size
        data.size_y = size * .66
        ob = bpy.data.objects.new('Maker ' + n, data)
        k.collection('LOCAL_PRACTICAL_LIGHTS').objects.link(ob)
        ob.location = p
        ob.rotation_euler = (Vector(target) - Vector(p)).to_track_quat('-Z', 'Y').to_euler()
        ob['fixture_light'] = True
        ob['compa_room_category'] = 'LOCAL_PRACTICAL_LIGHTS'

    def folded_leaf(n, base, tip, width, material, vein=True):
        """Thin folded blade, unlike the inherited thick succulent ellipsoids."""
        start, end = Vector(base), Vector(tip)
        axis = end - start
        sideways = axis.cross(Vector((0, 0, 1)))
        if sideways.length < .0001:
            sideways = Vector((1, 0, 0))
        sideways.normalize()
        normal = sideways.cross(axis).normalized()
        a = start + axis * .20
        mid = start + axis * .50
        b = start + axis * .78
        ridge = mid + normal * width * .12
        verts = [tuple(start), tuple(a + sideways * width * .35),
                 tuple(mid + sideways * width * .52), tuple(b + sideways * width * .31),
                 tuple(end), tuple(b - sideways * width * .31),
                 tuple(mid - sideways * width * .52), tuple(a - sideways * width * .35), tuple(ridge)]
        faces = [(i, (i + 1) % 8, 8) for i in range(8)]
        k.mesh('Maker ' + n, verts, faces, material, 'BOTANICALS', bevel=0)
        if vein:
            T(n + ' slender midrib', [tuple(start), tuple(ridge), tuple(end)], .0018, 'maker_leaf_vein')

    def fine_plant(n, p, size=1, kind='fern'):
        x, y, z = p
        radius = .14 * size
        k.cylinder('Maker ' + n + ' tapered pot', (x, y, z + .105 * size), radius * .75,
                   .21 * size, 'maker_planter_clay', 'BOTANICALS', 12, radius_top=radius)
        C(n + ' pot collar', (x, y, z + .208 * size), radius * 1.055, .026 * size, 'maker_planter_clay', 12)
        C(n + ' dark potting earth', (x, y, z + .222 * size), radius * .89, .008, 'oak', 12)
        origin = Vector((x, y, z + .22 * size))
        colors = ['maker_leaf_deep', 'maker_leaf_olive', 'maker_leaf_fresh']
        if kind == 'fern':
            for f in range(9):
                a = f * 2.399
                side = Vector((math.cos(a), math.sin(a), 0))
                tangent = Vector((-math.sin(a), math.cos(a), 0))
                reach = (.24 + .04 * (f % 3)) * size
                peak = (.32 + .035 * (f % 2)) * size
                points = [origin + side * (t * reach) + Vector((0, 0, peak * math.sin(t * 2.0)))
                          for t in [i / 8 for i in range(9)]]
                T(n + ' arching fern stem', [tuple(q) for q in points], .0035 * size, 'maker_leaf_deep')
                for j in range(1, 8):
                    t = j / 8
                    root = points[j]
                    reach_leaf = (.082 * math.sin(t * math.pi) + .018) * size
                    for sign in (-1, 1):
                        tip = root + tangent * sign * reach_leaf + side * .021 * size + Vector((0, 0, .014 * size))
                        folded_leaf(n + ' fern leaflet', root, tip, .029 * size, colors[(j + f) % 3], False)
        elif kind == 'pothos':
            for strand in range(5):
                a = strand * 1.20
                start = origin + Vector((math.cos(a) * .04 * size, math.sin(a) * .04 * size, .018 * size))
                points = []
                for j in range(11):
                    if j < 3:
                        q = start + Vector((math.cos(a) * j * .035 * size, -.055 * j * size, .035 * j * size))
                    else:
                        q = start + Vector((math.cos(a) * .12 * size + .018 * math.sin(j), -.23 * size + .02 * math.cos(j), (.105 - (j - 2) * .089) * size))
                    points.append(q)
                T(n + ' hanging pothos stem', [tuple(q) for q in points], .004 * size, 'maker_leaf_deep')
                for j, q in enumerate(points[1:]):
                    sign = -1 if (j + strand) % 2 else 1
                    tip = q + Vector((sign * .08 * size, -.035 * size, .055 * size))
                    folded_leaf(n + ' pointed pothos leaf', q, tip, .066 * size, colors[(strand + j) % 3])
        elif kind == 'upright':
            for branch in range(7):
                a = branch * 2.399
                h = (.47 + .08 * (branch % 3)) * size
                tip = origin + Vector((.07 * size * math.cos(a), .07 * size * math.sin(a), h))
                T(n + ' upright stem', [tuple(origin), tuple(tip)], .004 * size, 'maker_leaf_deep')
                for j in range(3):
                    q = origin.lerp(tip, .34 + j * .23)
                    aa = a + j * 1.4
                    end = q + Vector((math.cos(aa) * .17 * size, math.sin(aa) * .17 * size, .08 * size))
                    folded_leaf(n + ' narrow mature blade', q, end, .077 * size, colors[(branch + j) % 3])
        else:
            for i in range(13):
                a = i * 2.399
                tip = origin + Vector((math.cos(a) * .17 * size, math.sin(a) * .17 * size, (.23 + .06 * (i % 3)) * size))
                folded_leaf(n + ' slender leaf', origin, tip, .038 * size, colors[i % 3])

    def screw(n, p, side='front', radius=.013):
        o = C(n, p, radius, .008, 'maker_aluminium', 10)
        if side == 'front':
            o.rotation_euler.x = math.pi / 2
            B(n + ' slot', (p[0], p[1] - .007, p[2]), (radius, .003, .003), 'metal', .001)
        elif side == 'left':
            o.rotation_euler.y = math.pi / 2
        else:
            B(n + ' slot', (p[0], p[1], p[2] + .006), (radius, .003, .002), 'metal', .001)

    def label(n, text, p, size=.08, material='ink', rotation=(math.pi / 2, 0, 0), parent=None):
        return k.text('Maker ' + n, text, p, size, material, rotation=rotation, parent=parent)

    def pen_cup(n, p, material='maker_orange'):
        x, y, z = p
        C(n + ' pencil pot', (x, y, z + .064), .058, .128, material, 12)
        C(n + ' pot dark opening', (x, y, z + .129), .048, .003, 'ink', 12)
        for i in range(6):
            a = i * 2.4
            dx, dy = math.cos(a) * .031, math.sin(a) * .031
            tip = (x + dx * 1.5, y + dy * 1.5, z + .22 + .022 * (i % 3))
            T(n + ' pencil', [(x + dx, y + dy, z + .09), tip], .005,
              ['yellow', 'blue', 'coral', 'sage', 'paper', 'maker_aluminium'][i])
            C(n + ' pencil tip', tip, .004, .011, 'oak', 6)

    def storage_bin(n, p, size=(.43, .36, .23), color='blue'):
        x, y, z = p
        w, d, h = size
        B(n + ' storage bin', (x, y, z + h / 2), (w, d, h), color, .025)
        B(n + ' open tray shadow', (x, y, z + h + .001), (w - .042, d - .038, .01), 'ink', .014)
        for sign in (-1, 1):
            B(n + ' rolled rim', (x + sign * (w / 2 - .012), y, z + h), (.026, d + .016, .035), color, .009)
        for sign in (-1, 1):
            B(n + ' rim edge', (x, y + sign * d / 2, z + h), (w, .024, .035), color, .008)
        B(n + ' label holder', (x, y - d / 2 - .007, z + h * .58), (w * .49, .014, .072), 'maker_aluminium', .005)
        B(n + ' label paper', (x, y - d / 2 - .016, z + h * .58), (w * .43, .008, .048), 'paper', .002)
        for j in range(2):
            B(n + ' label line', (x, y - d / 2 - .022, z + h * .60 - j * .02), (w * .30, .003, .004), 'ink', .001)
        for sign in (-1, 1):
            B(n + ' corner reinforcement', (x + sign * (w / 2 - .03), y - d / 2 - .007, z + h * .46), (.018, .01, h * .68), color, .004)

    def drawer_cabinet(n, p, w=.85, d=.56, h=.77, count=4, color='maker_steel'):
        x, y, z = p
        B(n + ' metal shell', (x, y, z + h / 2), (w, d, h), color, .022)
        B(n + ' top wood cap', (x, y, z + h + .028), (w + .055, d + .045, .055), 'maker_wood', .013)
        for i in range(count):
            zz = z + .115 + i * (h - .11) / count
            dh = (h - .15) / count
            B(n + ' drawer dark gap', (x, y - d / 2 - .011, zz), (w - .07, .016, dh + .014), 'ink', .003)
            B(n + ' drawer fascia', (x, y - d / 2 - .022, zz), (w - .091, .025, dh), color, .007)
            B(n + ' handle', (x, y - d / 2 - .051, zz + dh * .20), (w * .45, .038, .025), 'maker_aluminium', .008)
            B(n + ' drawer number', (x - w * .30, y - d / 2 - .039, zz), (.057, .009, .043), 'paper', .003)
        for xx in (-w * .36, w * .36):
            for yy in (-d * .30, d * .30):
                B(n + ' adjustable foot', (x + xx, y + yy, z + .027), (.075, .075, .065), 'maker_rubber', .01)

    def articulated_lamp(n, p, aim=0):
        x, y, z = p
        C(n + ' base', (x, y, z + .022), .10, .044, 'ink', 16)
        a = (x, y, z + .07)
        b = (x + .06 * math.sin(aim), y + .06 * math.cos(aim), z + .34)
        c = (x + .24 * math.sin(aim), y + .24 * math.cos(aim), z + .53)
        for offset in (-.019, .019):
            T(n + ' spring arm lower', [(a[0] + offset, a[1], a[2]), (b[0] + offset, b[1], b[2])], .011, 'metal')
            T(n + ' spring arm upper', [(b[0] + offset, b[1], b[2]), (c[0] + offset, c[1], c[2])], .01, 'metal')
        for q in (a, b, c):
            o = C(n + ' hinge', q, .024, .07, 'maker_aluminium', 12)
            o.rotation_euler.y = math.pi / 2
        C(n + ' conical shade', (c[0], c[1], c[2] - .048), .088, .115, 'ink', 16)
        C(n + ' shade reflector', (c[0], c[1], c[2] - .111), .078, .008, 'maker_lampglow', 16)
        warm_pool(n + ' warm drafting pool', (c[0], c[1], c[2] - .12), (c[0], c[1], z + .03), 12, .14)

    # Complete walls with deliberately varied masonry courses and corner piers.
    # Butt joints: no overlapping coplanar top faces at the north-west corner.
    B('back plaster wall', (0, 3.025, 1.6), (8.22, .17, 3.2), 'maker_plaster', .01)
    B('left plaster wall', (-4.025, -.0575, 1.6), (.17, 5.985, 3.2), 'maker_plaster', .01)
    for row in range(9):
        z = .18 + row * .35
        for col in range(12):
            x = -3.71 + col * .69 + (.345 if row % 2 else 0)
            if x + .332 > 4.0:
                continue
            B('individual back masonry block', (x, 2.926, z), (.672, .035, .33), 'maker_block_' + str((col + row) % 4), .007)
        for col in range(9):
            y = -2.74 + col * .69 + (.345 if row % 2 else 0)
            if y + .332 > 3.0:
                continue
            B('individual left masonry block', (-3.928, y, z), (.035, .672, .33), 'maker_block_' + str((col + row * 2) % 4), .007)
    for x in (-3.78, 3.78):
        B('back structural pier', (x, 2.84, 1.6), (.22, .16, 3.18), 'maker_stone', .015)
        for z in (.55, 1.15, 1.75, 2.35, 2.96):
            B('pier mortar joint', (x, 2.752, z), (.21, .009, .014), 'maker_mortar', .003)
    B('left concrete plinth', (-3.895, 0, .11), (.09, 6.0, .20), 'maker_stone')
    B('rear concrete plinth', (0, 2.88, .11), (8, .09, .20), 'maker_stone')
    B('rear lintel beam', (0, 2.89, 3.10), (8.0, .16, .19), 'maker_stone')
    B('left lintel beam', (-3.89, -.105, 3.10), (.16, 5.79, .19), 'maker_stone')

    # Oversized actual pegboard on the left, with a typographic panel and tools.
    B('pegboard oak frame', (-3.84, -.53, 1.98), (.13, 3.93, 1.79), 'maker_wood', .018)
    B('pegboard cork surface', (-3.758, -.53, 1.98), (.043, 3.78, 1.65), 'maker_cork', .005)
    for row in range(13):
        for col in range(31):
            y, z = -2.28 + col * .116, 1.25 + row * .12
            o = C('pegboard perforation', (-3.732, y, z), .009, .004, 'maker_cork_dark', 6)
            o.rotation_euler.y = math.pi / 2
    for i, line in enumerate(['CREÁ', 'EXPERIMENTÁ', 'COLABORÁ', 'REPETÍ']):
        label('maker manifesto', line, (-3.709, -.85, 2.48 - i * .245), .213, 'paper', (math.pi / 2, 0, math.pi / 2))
    # Hooks and actual pliers/screwdrivers on the edge of the pegboard.
    for j in range(4):
        yy = .59 + j * .16
        T('steel peg hook', [(-3.73, yy, 2.36), (-3.67, yy, 2.36), (-3.67, yy, 2.31)], .008, 'maker_aluminium')
        T('hanging screwdriver shaft', [(-3.66, yy, 2.30), (-3.66, yy, 2.04)], .012, 'maker_aluminium')
        B('hanging screwdriver handle', (-3.66, yy, 2.28), (.065, .06, .15), ['blue', 'maker_red', 'yellow', 'sage'][j], .02)
    for yy in (.50, .92):
        T('hanging pliers left arm', [(-3.665, yy - .08, 1.43), (-3.665, yy, 1.68), (-3.665, yy - .045, 1.83)], .019, 'maker_aluminium')
        T('hanging pliers right arm', [(-3.665, yy + .08, 1.43), (-3.665, yy, 1.68), (-3.665, yy + .045, 1.83)], .019, 'maker_aluminium')
        T('pliers rubber handles', [(-3.66, yy - .08, 1.43), (-3.66, yy - .038, 1.56)], .032, 'maker_red')
    for yy in (-2.26, 1.16):
        for zz in (1.20, 2.75):
            screw('pegboard fixing', (-3.70, yy, zz), 'left')

    # Corner resource cabinet, mixed open bins, books, rolls and storage labels.
    sx, sy, sw = -2.98, 2.53, 1.30
    B('corner organizer backing', (sx, sy + .21, 1.48), (sw, .07, 2.89), 'maker_wood')
    for dx in (-sw / 2, sw / 2):
        B('corner organizer side', (sx + dx, sy, 1.48), (.075, .54, 2.89), 'maker_wood')
    for i, z in enumerate([.10, .60, 1.10, 1.60, 2.12, 2.64, 2.93]):
        B('corner organizer shelf', (sx, sy, z), (sw, .58, .065), 'maker_wood')
        for x in (sx - .44, sx + .44):
            B('shelf bracket', (x, sy + .12, z - .06), (.035, .31, .12), 'metal')
        if i in (0, 2, 3):
            for j in range(2):
                storage_bin('corner sorted parts', (sx - .31 + j * .62, sy - .01, z + .037), (.51, .43, .32), ['blue', 'maker_orange', 'sage', 'yellow'][(i + j) % 4])
        elif i in (1, 4):
            for j in range(7):
                k.book('Maker technical handbook', (sx - .47 + j * .13, sy - .08, z + .035), .105, .29 + .04 * (j % 3), .23, ['blue', 'coral', 'sage', 'cream'][j % 4])
        elif i == 5:
            bookstack(k, 'Maker corner reference stack', (sx - .25, sy - .01, z + .04), 3)
            fine_plant('shelf fine fern', (sx + .40, sy, z + .04), .52, 'fern')
    fine_plant('organizer trailing pothos', (sx - .36, sy - .13, 2.98), .78, 'pothos')

    # A proper rear work counter; the right end is a freestanding tool cabinet.
    counter_x, counter_y = .42, 2.43
    B('rear worktop', (counter_x, counter_y, .82), (4.72, .68, .095), 'maker_wood', .018)
    for xx in (-1.57, 1.92):
        drawer_cabinet('rear drawers', (xx, counter_y, .035), .67, .60, .69, 3, 'maker_steel')
    for xx in (-.78, .48):
        B('open counter shelf', (xx, counter_y, .22), (1.11, .60, .06), 'maker_wood')
        for j in range(2):
            storage_bin('counter component box', (xx - .26 + j * .51, counter_y - .02, .255), (.44, .45, .33), ['blue', 'maker_orange'][j])
    for xx in (-.15, 1.07):
        B('counter vertical division', (xx, counter_y, .46), (.055, .59, .67), 'maker_wood')
    drawer_cabinet('right rolling tool chest', (3.30, 2.37, .13), .95, .70, .90, 5)
    for xx in (2.96, 3.64):
        for yy in (2.13, 2.61):
            wh = C('tool chest caster wheel', (xx, yy, .095), .082, .04, 'maker_rubber', 12)
            wh.rotation_euler.x = math.pi / 2
            B('tool chest caster fork', (xx, yy, .165), (.035, .06, .10), 'maker_aluminium', .005)
    pen_cup('rear orange markers', (-.50, 2.36, .872))
    pen_cup('rear blue markers', (-.29, 2.37, .872), 'blue')
    laptop(k, 'Maker counter design computer', (.83, 2.42, .875), 0)
    bookstack(k, 'Maker prototyping books', (-1.64, 2.41, .875), 4)
    fine_plant('tool chest narrow-leaf plant', (3.41, 2.44, 1.094), .66, 'narrow')

    # Whiteboard with measured sketch panels, actual linework and revisions.
    bx, by, bz, bw, bh = .55, 2.884, 2.02, 4.84, 1.53
    B('whiteboard anodized frame', (bx, by, bz), (bw, .085, bh), 'maker_aluminium', .009)
    B('whiteboard enamel surface', (bx, by - .057, bz), (bw - .065, .025, bh - .065), 'paper', .006)
    B('whiteboard bottom marker ledge', (bx, by - .14, bz - bh / 2 + .024), (bw, .19, .036), 'maker_aluminium', .007)
    label('board heading', 'DEL BOCETO AL PROTOTIPO', (bx, by - .074, bz + .60), .125, 'maker_marker')
    for i, word in enumerate(['IDEAS', 'PROTOTIPOS', 'PERSONAS', 'CAMBIOS']):
        label('board process', word, (2.00, by - .077, bz + .29 - i * .25), .175, 'maker_marker')
        T('board checklist', [(1.23, by - .08, bz + .29 - i * .25), (1.28, by - .08, bz + .23 - i * .25), (1.36, by - .08, bz + .35 - i * .25)], .010, 'maker_red')

    def inkpath(n, points, color='maker_marker', thickness=.007):
        return T('board ' + n, [(x, by - .077, z) for x, z in points], thickness, color)

    def loop(n, x, z, radius, color='maker_marker'):
        return inkpath(n, [(x + math.cos(i * math.tau / 24) * radius, z + math.sin(i * math.tau / 24) * radius) for i in range(25)], color)

    # Six different engineering / thinking sketches, not identical sticky notes.
    for i, (xx, zz) in enumerate([(-1.36, 2.23), (-.44, 2.23), (.48, 2.23), (-1.36, 1.65), (-.44, 1.65), (.48, 1.65)]):
        if i == 0:  # articulated robot
            inkpath('robot head', [(xx - .11, zz + .08), (xx - .11, zz + .25), (xx + .11, zz + .25), (xx + .11, zz + .08), (xx - .11, zz + .08)])
            inkpath('robot shoulders', [(xx - .21, zz - .08), (xx - .14, zz + .04), (xx + .14, zz + .04), (xx + .21, zz - .08)])
            for sign in (-1, 1):
                loop('robot eye', xx + sign * .055, zz + .17, .018)
                inkpath('robot foot', [(xx + sign * .08, zz - .09), (xx + sign * .08, zz - .17), (xx + sign * .16, zz - .17)])
            inkpath('robot base', [(xx - .13, zz + .04), (xx - .13, zz - .1), (xx + .13, zz - .1), (xx + .13, zz + .04)])
        elif i == 1:  # bulb with rays
            loop('light bulb', xx, zz + .09, .125)
            inkpath('bulb base', [(xx - .067, zz), (xx - .067, zz - .12), (xx + .067, zz - .12), (xx + .067, zz)])
            for a in range(6):
                angle = a * math.pi / 5
                inkpath('bulb ray', [(xx + math.cos(angle) * .17, zz + .09 + math.sin(angle) * .17), (xx + math.cos(angle) * .22, zz + .09 + math.sin(angle) * .22)], 'maker_orange')
        elif i == 2:  # cube projection with dimension marks
            inkpath('cube profile', [(xx - .17, zz + .04), (xx, zz + .15), (xx + .18, zz + .04), (xx + .18, zz - .15), (xx, zz - .23), (xx - .17, zz - .15), (xx - .17, zz + .04), (xx, zz - .06), (xx + .18, zz + .04)])
            inkpath('cube axis', [(xx, zz - .06), (xx, zz - .23)])
            inkpath('cube measurement', [(xx - .21, zz + .24), (xx + .19, zz + .24)], 'maker_red')
        elif i == 3:  # wheeled prototype
            inkpath('car chassis', [(xx - .22, zz - .06), (xx - .22, zz + .10), (xx + .16, zz + .10), (xx + .22, zz - .06), (xx - .22, zz - .06)])
            for sign in (-1, 1):
                loop('car wheel', xx + sign * .135, zz - .09, .060)
            inkpath('sensor', [(xx, zz + .1), (xx, zz + .25), (xx + .1, zz + .25)])
        elif i == 4:  # flow chart
            for ox, oz in [(-.19, .12), (.15, .12), (.15, -.14)]:
                inkpath('flow box', [(xx + ox - .09, zz + oz - .06), (xx + ox - .09, zz + oz + .06), (xx + ox + .09, zz + oz + .06), (xx + ox + .09, zz + oz - .06), (xx + ox - .09, zz + oz - .06)])
            inkpath('flow link', [(xx - .10, zz + .12), (xx + .05, zz + .12)], 'maker_red')
            inkpath('flow link down', [(xx + .15, zz + .05), (xx + .15, zz - .07)], 'maker_red')
        else:  # bridge truss
            inkpath('bridge baseline', [(xx - .26, zz - .1), (xx + .26, zz - .1)])
            inkpath('bridge truss', [(xx - .23, zz - .1), (xx - .12, zz + .1), (xx, zz - .1), (xx + .12, zz + .1), (xx + .23, zz - .1)])
            inkpath('bridge upper chord', [(xx - .12, zz + .1), (xx + .12, zz + .1)])
        label('sketch caption', ['ROBOT', 'IDEA', 'ESCALA', 'MOTOR', 'PROCESO', 'ESTRUCTURA'][i], (xx, by - .079, zz - .31), .061, 'maker_marker')
    for i in range(4):
        C('board marker barrel', (-.84 + i * .16, by - .18, bz - bh / 2 + .077), .013, .145, ['blue', 'maker_red', 'green', 'ink'][i], 8).rotation_euler.y = math.pi / 2
    for x in (-1.72, 2.83):
        for z in (1.31, 2.71):
            screw('whiteboard screw', (x, by - .077, z))

    # Wall lamps are modeled as fixtures with aimed reflectors, not plain bulbs.
    for x in (-1.50, .55, 2.61):
        B('wall task light mount', (x, 2.76, 3.04), (.12, .09, .18), 'metal')
        T('wall task light articulated stem', [(x, 2.73, 3.01), (x, 2.52, 3.03), (x, 2.40, 2.92)], .019, 'metal')
        B('wall task light hood', (x, 2.36, 2.90), (.28, .20, .095), 'metal', .02)
        B('wall task light diffuser', (x, 2.35, 2.845), (.24, .17, .018), 'maker_lampglow', .005)
        warm_pool('whiteboard warm wall wash', (x, 2.345, 2.825), (x, 2.79, 2.05), 31, .26)
    for y in (-2.06, -.53, 1.0):
        B('pegboard light mount', (-3.77, y, 3.02), (.12, .14, .19), 'metal')
        T('pegboard light arm', [(-3.72, y, 3.0), (-3.48, y, 3.0), (-3.36, y, 2.9)], .018, 'metal')
        B('pegboard light hood', (-3.32, y, 2.88), (.23, .31, .105), 'metal', .02)
        B('pegboard light diffuser', (-3.32, y, 2.82), (.20, .27, .014), 'maker_lampglow', .005)
        warm_pool('pegboard warm wall wash', (-3.31, y, 2.80), (-3.71, y, 2.04), 27, .27)

    # Two joined six-person workbenches: plank top, joints, stretchers, bench dogs.
    table_y, top_z = -.38, .78
    for side, cx in enumerate((-1.18, 1.18)):
        for plank in range(5):
            B('workbench individual timber plank', (cx - .90 + plank * .45, table_y, top_z), (.444, 1.82, .12), 'maker_plank_' + str((plank + side) % 4), .009)
            for yy in (table_y - .80, table_y + .80):
                for xx in (cx - .9 + plank * .45 - .13, cx - .9 + plank * .45 + .13):
                    screw('worktop recessed fastening', (xx, yy, top_z + .062), 'top', .009)
        for dx in (-.96, .96):
            for dy in (-.67, .67):
                B('bench mortise leg', (cx + dx, table_y + dy, .36), (.115, .115, .72), 'maker_wood', .016)
                B('bench rubber floor cap', (cx + dx, table_y + dy, .037), (.122, .122, .075), 'maker_rubber', .009)
            B('bench end apron', (cx + dx, table_y, .65), (.09, 1.48, .15), 'maker_wood')
            B('bench low end stretcher', (cx + dx, table_y, .22), (.07, 1.44, .075), 'maker_wood')
        for dy in (-.72, .72):
            B('bench long apron', (cx, table_y + dy, .65), (2.04, .09, .15), 'maker_wood')
        B('bench low stretcher', (cx, table_y, .22), (2.00, .09, .07), 'maker_wood')
    # Vise is on the free end, away from chair and participant footprints.
    B('bench vise screw housing', (-2.39, -.37, .69), (.22, .22, .18), 'maker_steel')
    B('bench vise fixed jaw', (-2.365, -.37, .85), (.045, .29, .10), 'maker_steel')
    B('bench vise outer jaw', (-2.50, -.37, .85), (.06, .29, .11), 'maker_steel')
    T('bench vise threaded screw', [(-2.35, -.37, .71), (-2.67, -.37, .71)], .028, 'maker_aluminium')
    T('bench vise slide handle', [(-2.66, -.37, .60), (-2.66, -.37, .88)], .015, 'metal')
    for z in (.59, .89):
        k.sphere('Maker vise handle end', (-2.66, -.37, z), (.024, .024, .024), 'metal', 'MAKER_DETAILS', 8, 4)

    # Six actual stools, all at the current humanoid seating height.
    for row, yy, angle in [(0, -1.72, math.pi), (1, 1.00, 0)]:
        for col, xx in enumerate((-1.58, 0, 1.58)):
            g = k.group('Maker working stool', (xx, yy, 0), (0, 0, angle), 'SEATS')
            color = ['blue', 'maker_orange', 'sage'][(row + col) % 3]
            B('rounded stool seat', (0, 0, .445), (.57, .52, .08), color, .03, g)
            B('stool carved seat inset', (0, 0, .488), (.45, .41, .009), color, .025, g)
            for dx in (-.205, .205):
                for dy in (-.18, .18):
                    B('stool steel square leg', (dx, dy, .225), (.043, .043, .41), 'maker_steel', .006, g)
                    B('stool foot cap', (dx, dy, .026), (.050, .050, .054), 'maker_rubber', .007, g)
                B('stool side footrest', (dx, 0, .17), (.035, .40, .035), 'maker_aluminium', .006, g)
            for dy in (-.18, .18):
                B('stool front cross brace', (0, dy, .17), (.43, .035, .035), 'maker_aluminium', .006, g)
            kit.seat(seats, (xx, yy, 0), angle, 'workshop-stool')

    # Cutting mats have ruled measurement edges and visible grids.
    def cutting_mat(n, p, w=.93, d=.58):
        x, y, z = p
        B(n + ' cutting mat', (x, y, z), (w, d, .018), 'maker_mat', .007)
        for i in range(int(w / .07)):
            B(n + ' grid vertical', (x - w / 2 + .04 + i * .07, y, z + .010), (.002, d - .044, .001), 'maker_grid', 0)
        for i in range(int(d / .07)):
            B(n + ' grid horizontal', (x, y - d / 2 + .04 + i * .07, z + .010), (w - .044, .002, .001), 'maker_grid', 0)
        for i in range(16):
            B(n + ' edge graduation', (x - w / 2 + .06 + i * (w - .12) / 15, y - d / 2 + .013, z + .011), (.003, .018 if i % 5 else .026, .002), 'paper', 0)

    cutting_mat('left design station', (-1.14, -.57, .852), 1.03, .61)
    cutting_mat('right model station', (1.0, -.38, .852), 1.10, .71)
    # Individual plans are deliberately offset without hanging off the table.
    notebook(k, 'Maker front left design notes', (-1.85, -.76, .852))
    notebook(k, 'Maker rear centre process notes', (.02, .22, .852))
    notebook(k, 'Maker rear right test notes', (1.80, .23, .852))
    laptop(k, 'Maker shared front laptop', (-.05, -.90, .852), math.pi)
    laptop(k, 'Maker shared rear laptop', (-1.51, .23, .852), 0)
    laptop(k, 'Maker right CAD laptop', (1.78, -.92, .852), math.pi)
    bookstack(k, 'Maker table engineering stack', (-.55, .15, .852), 3)
    pen_cup('table pens', (.58, .26, .851), 'maker_orange')
    B('ruler aluminium body', (-1.0, -.79, .879), (.71, .032, .006), 'maker_aluminium', .002)
    for i in range(23):
        B('ruler millimetre divisions', (-1.32 + i * .029, -.786, .884), (.002, .020 if i % 5 == 0 else .009, .001), 'ink', 0)
    # Scissors: twin loops, blades and pivot on the cutting mat.
    for dx in (-.039, .039):
        pts = [(-1.08 + dx + math.cos(i * math.tau / 16) * .027, -.43 + math.sin(i * math.tau / 16) * .046, .888) for i in range(17)]
        T('scissors plastic handle', pts, .007, 'maker_orange')
    T('scissors blade left', [(-1.10, -.41, .888), (-1.07, -.32, .89), (-1.045, -.235, .891)], .007, 'maker_aluminium')
    T('scissors blade right', [(-1.04, -.41, .888), (-1.07, -.32, .89), (-1.092, -.235, .891)], .007, 'maker_aluminium')
    C('scissors rivet', (-1.07, -.32, .893), .012, .008, 'metal', 10)
    # Folded card maquette and desk lamps give variation in height and silhouette.
    B('cardboard architectural model base', (-.92, -.24, .889), (.37, .27, .032), 'cream', .003)
    for xx, yy, ww, dd, hh in [(-1.02, -.25, .12, .12, .13), (-.89, -.23, .10, .16, .22), (-.77, -.25, .08, .12, .11)]:
        B('cardboard architectural mass', (xx, yy, .91 + hh / 2), (ww, dd, hh), 'paper', .002)
        for zz in range(2):
            B('maquette window', (xx, yy - dd / 2 - .003, .94 + zz * .06), (ww * .60, .004, .022), 'blue', .001)
    articulated_lamp('table drafting lamp', (-2.04, .27, .852), -.50)

    # An articulated wheeled robot: chassis, tracks/wheels, arm, gripper, camera.
    rx, ry, rz = 1.10, -.22, .882
    B('robot circuit chassis', (rx, ry, rz + .048), (.36, .28, .075), 'blue', .009)
    B('robot metal top deck', (rx, ry, rz + .09), (.33, .25, .024), 'maker_aluminium', .003)
    for dx in (-.13, .13):
        for dy in (-.15, .15):
            o = C('robot rubber wheel', (rx + dx, ry + dy, rz + .03), .066, .033, 'maker_rubber', 14)
            o.rotation_euler.x = math.pi / 2
            hub = C('robot orange wheel hub', (rx + dx, ry + dy * 1.09, rz + .03), .026, .035, 'maker_orange', 10)
            hub.rotation_euler.x = math.pi / 2
    C('robot rotary arm base', (rx, ry, rz + .125), .07, .06, 'maker_orange', 12)
    joints = [(rx, ry, rz + .17), (rx - .035, ry, rz + .34), (rx + .11, ry, rz + .43)]
    for a, b in zip(joints, joints[1:]):
        T('robot articulated arm rail', [a, b], .030, 'maker_orange')
    for q in joints:
        o = C('robot pivot axle', q, .044, .074, 'metal', 12)
        o.rotation_euler.x = math.pi / 2
    for sign in (-1, 1):
        T('robot open gripper', [(rx + .11, ry, rz + .43), (rx + .17, ry + sign * .05, rz + .43), (rx + .21, ry + sign * .05, rz + .395)], .012, 'maker_aluminium')
    B('robot microcontroller', (rx -.09, ry -.06, rz + .117), (.08, .065, .018), 'maker_mat', .002)
    for i in range(5):
        B('robot controller pin', (rx - .12 + .015 * i, ry - .103, rz + .124), (.006, .013, .006), 'gold', 0)
    T('robot power cable', [(rx - .09, ry, rz + .12), (rx - .15, ry + .06, rz + .15), (rx, ry + .065, rz + .16)], .006, 'maker_red')
    T('robot signal cable', [(rx, ry + .035, rz + .16), (rx - .075, ry + .05, rz + .32), (rx + .09, ry + .06, rz + .42)], .005, 'ink')

    # Gear train prototype next to the robot, built with actual teeth.
    B('gear mechanism base', (.70, -.72, .884), (.40, .25, .035), 'maker_wood', .005)
    for gx, rad, teeth, color in [(.59, .065, 10, 'maker_orange'), (.74, .098, 14, 'maker_steel')]:
        C('prototype toothed wheel core', (gx, -.72, .928), rad, .035, color, teeth * 2)
        for i in range(teeth):
            a = i * math.tau / teeth
            cog = B('prototype individual gear tooth', (gx + math.cos(a) * rad, -.72 + math.sin(a) * rad, .931), (.03, .025, .038), color, .002)
            cog.rotation_euler.z = a
        C('prototype gear axle', (gx, -.72, .94), .014, .05, 'maker_aluminium', 10)

    # A hollow set square sits inside the free left side of the cutting mat.
    # It has a genuine open centre, rather than an opaque painted triangle.
    sqx, sqy, sqz = -1.48, -.43, .887
    outer = [(-.13, -.22), (-.13, .06), (.11, -.22)]
    inner = [(-.099, -.190), (-.099, -.014), (.052, -.190)]
    vertices = [(sqx + x, sqy + y, sqz + z) for z in (-.002, .003) for x, y in outer + inner]
    faces = []
    for i in range(3):
        j = (i + 1) % 3
        faces.extend([(i, j, j + 3, i + 3), (i + 6, i + 9, j + 9, j + 6),
                      (i, i + 6, j + 6, j), (i + 3, j + 3, j + 9, i + 9)])
    k.mesh('Maker hollow aluminium set square', vertices, faces, 'maker_aluminium', 'MAKER_DETAILS', bevel=.001)
    for j in range(10):
        B('set square etched division', (sqx - .123, sqy - .202 + j * .021, sqz + .004),
          (.012 if j % 5 else .019, .0015, .0008), 'ink', 0)

    # Compartment organizer between the laptop and notes. Contents are separate
    # recognizable circuit components, not a pile invading the work surface.
    tx, ty, tz = .11, -.28, .86
    B('electronics organizer shallow base', (tx, ty, tz), (.43, .25, .017), 'maker_fabric', .005)
    for xx in (tx - .21, tx + .21):
        B('electronics tray side rim', (xx, ty, tz + .026), (.013, .25, .053), 'maker_wood', .003)
    for yy in (ty - .119, ty + .119):
        B('electronics tray end rim', (tx, yy, tz + .026), (.43, .013, .053), 'maker_wood', .003)
    for xx in (tx - .070, tx + .070):
        B('electronics tray compartment wall', (xx, ty, tz + .02), (.009, .234, .042), 'maker_wood', .002)
    B('electronics tray central divider', (tx, ty, tz + .02), (.414, .009, .042), 'maker_wood', .002)
    for row in range(2):
        for col in range(3):
            xx, yy = tx - .14 + col * .14, ty - .059 + row * .119
            if col == 0:
                for j in range(3):
                    C('sorted capacitor can', (xx -.032 + j * .03, yy, tz + .025), .010, .035, 'maker_steel', 8)
                    B('capacitor silver cap', (xx -.032 + j * .03, yy, tz + .044), (.012, .012, .004), 'maker_aluminium', .001)
            elif col == 1:
                for j in range(2):
                    T('sorted resistor wire', [(xx -.045, yy -.020 + j * .034, tz + .019), (xx + .045, yy -.020 + j * .034, tz + .019)], .0025, 'maker_aluminium')
                    B('sorted resistor body', (xx, yy -.020 + j * .034, tz + .019), (.034, .013, .013), 'cream', .004)
                    for stripe in range(3):
                        B('resistor coded band', (xx -.010 + stripe * .010, yy -.020 + j * .034, tz + .026), (.003, .014, .002), ['maker_red', 'blue', 'gold'][stripe], 0)
            else:
                B('sorted controller integrated circuit', (xx, yy, tz + .020), (.055, .035, .018), 'ink', .002)
                for side in (-1, 1):
                    for pin in range(4):
                        B('integrated circuit silver leg', (xx -.018 + pin * .012, yy + side * .024, tz + .016), (.004, .014, .006), 'maker_aluminium', .001)

    # A balsa bridge maquette on the rear counter mirrors the structural sketch.
    mx, my, mz = .07, 2.42, .875
    B('bridge model drafting base', (mx, my, mz + .017), (.48, .30, .034), 'paper', .004)
    for i in range(12):
        B('bridge model deck plank', (mx -.207 + i * .0375, my, mz + .045), (.031, .21, .018), 'maker_wood', .002)
    for sign in (-1, 1):
        yy = my + sign * .105
        T('bridge scale lower chord', [(mx -.222, yy, mz + .062), (mx + .222, yy, mz + .062)], .007, 'maker_wood')
        T('bridge scale upper chord', [(mx -.145, yy, mz + .19), (mx + .145, yy, mz + .19)], .007, 'maker_wood')
        T('bridge balsa triangular truss', [(mx -.22, yy, mz + .062), (mx -.145, yy, mz + .19),
           (mx -.072, yy, mz + .062), (mx, yy, mz + .19), (mx + .072, yy, mz + .062),
           (mx + .145, yy, mz + .19), (mx + .22, yy, mz + .062)], .007, 'maker_wood')
    for xx in (mx -.145, mx, mx + .145):
        T('bridge cross bracing', [(xx, my -.105, mz + .19), (xx, my + .105, mz + .19)], .005, 'maker_aluminium')

    # Rolling open tool trolley, including its own reachable prop containers.
    cx, cy = -3.16, -1.65
    for z in (.20, .46, .74):
        B('rolling cart lipped shelf', (cx, cy, z), (.75, .58, .045), 'maker_steel', .012)
        for xx in (cx - .36, cx + .36):
            B('cart side lip', (xx, cy, z + .045), (.026, .58, .065), 'maker_steel', .008)
        B('cart rear lip', (cx, cy + .28, z + .045), (.73, .024, .065), 'maker_steel', .008)
    for dx in (-.32, .32):
        for dy in (-.24, .24):
            B('cart square upright', (cx + dx, cy + dy, .45), (.035, .035, .72), 'maker_aluminium', .005)
            wheel = C('cart black rubber caster', (cx + dx, cy + dy, .071), .065, .035, 'maker_rubber', 12)
            wheel.rotation_euler.x = math.pi / 2
            B('cart caster fork', (cx + dx, cy + dy, .123), (.028, .05, .07), 'maker_aluminium', .006)
    T('rolling cart rounded handle', [(cx - .34, cy + .28, .76), (cx - .34, cy + .28, .91), (cx + .34, cy + .28, .91), (cx + .34, cy + .28, .76)], .021, 'metal')
    for i in range(3):
        storage_bin('cart parts box', (cx - .225 + i * .225, cy, .229), (.19, .39, .16), ['blue', 'maker_red', 'sage'][i])
    bookstack(k, 'Maker trolley manuals', (cx -.11, cy, .490), 3)
    for i in range(3):
        C('cart paint bottle', (cx - .23 + i * .15, cy + .075, .83), .045, .15, ['yellow', 'maker_red', 'blue'][i], 12)
        C('cart bottle cap', (cx - .23 + i * .15, cy + .075, .912), .036, .027, 'ink', 12)
    pen_cup('cart drawing pencils', (cx + .23, cy - .08, .768), 'cream')

    # Cable reel / power station and backpack at wall edge, clear of six seats.
    B('supply battery case', (3.35, .91, .20), (.40, .31, .37), 'maker_steel', .035)
    B('battery case lid', (3.35, .91, .40), (.41, .32, .045), 'metal', .012)
    T('battery carrying handle', [(3.22, .91, .42), (3.22, .91, .50), (3.48, .91, .50), (3.48, .91, .42)], .018, 'maker_aluminium')
    for i in range(3):
        C('case socket', (3.24 + i * .11, .746, .29), .025, .013, 'ink', 10).rotation_euler.x = math.pi / 2
    B('student backpack main body', (3.16, -.13, .31), (.40, .22, .56), 'blue', .065)
    B('backpack front pocket', (3.16, -.265, .22), (.33, .10, .23), 'maker_steel', .035)
    B('backpack pocket zipper', (3.16, -.323, .325), (.28, .01, .015), 'maker_aluminium', .003)
    B('backpack label', (3.16, -.325, .215), (.095, .009, .075), 'maker_fabric', .004)
    T('backpack handle', [(3.055, -.13, .58), (3.065, -.13, .67), (3.245, -.13, .67), (3.265, -.13, .58)], .019, 'metal')
    for dx in (-.145, .145):
        T('backpack shoulder straps', [(3.16 + dx, -.035, .52), (3.16 + dx, .055, .42), (3.16 + dx, .02, .11)], .023, 'metal')

    # Practical smaller wall finishes: clock, outlets, switches, personal notes.
    clock_x, clock_y, clock_z = -2.13, 2.86, 2.74
    o = C('clock oak case', (clock_x, clock_y, clock_z), .205, .075, 'oak', 32)
    o.rotation_euler.x = math.pi / 2
    o = C('clock enamel dial', (clock_x, clock_y -.045, clock_z), .181, .01, 'paper', 32)
    o.rotation_euler.x = math.pi / 2
    for i in range(12):
        a = i * math.tau / 12
        T('clock hour mark', [(clock_x + math.sin(a) * .149, clock_y -.055, clock_z + math.cos(a) * .149), (clock_x + math.sin(a) * .166, clock_y -.055, clock_z + math.cos(a) * .166)], .005, 'ink')
    T('clock minute hand', [(clock_x, clock_y -.059, clock_z), (clock_x + .105, clock_y -.059, clock_z + .079)], .006, 'ink')
    T('clock hour hand', [(clock_x, clock_y -.059, clock_z), (clock_x -.024, clock_y -.059, clock_z + .074)], .008, 'ink')
    for x in (-1.45, 1.68):
        B('wall electrical outlet frame', (x, 2.846, 1.016), (.16, .018, .12), 'paper', .008)
        for xx in (-.035, .035):
            B('wall outlet slot', (x + xx, 2.834, 1.016), (.007, .005, .032), 'ink', .001)
    B('power trunking', (.6, 2.838, .933), (4.10, .045, .055), 'maker_aluminium', .005)
    for i in range(3):
        yy = -2.62 + i * .145
        B('maker left light switch', (-3.86, yy, .95), (.045, .115, .18), 'paper', .008)
        B('maker switch rocker', (-3.828, yy, .95), (.02, .063, .11), 'maker_stone', .005)
    fine_plant('entrance tall foliage', (3.52, -2.25, .01), 1.30, 'upright')
    fine_plant('left corner fern', (-3.41, .55, .01), .98, 'fern')
    fine_plant('rear counter fine fern', (1.65, 2.34, .87), .45, 'fern')

    # Small process notes on the opposite free wall strip, original text.
    B('side process note frame', (3.43, 2.869, 1.97), (.55, .058, 1.16), 'woodlight', .012)
    B('side process note sheet', (3.43, 2.832, 1.97), (.48, .016, 1.09), 'paper', .004)
    for i, line in enumerate(['HACÉ', 'PREGUNTAS.', '', 'PROBÁ', 'OTRA VEZ.']):
        label('process note lettering', line, (3.43, 2.819, 2.33 - i * .17), .079, 'ink')

    assert len(seats) == 6, 'Maker room requires exactly six authored seats'
