"""Detailed, individually editable study props for the preserved Cozy layout.

No furniture translation is required except correcting the chair's facing direction
and relocating desk input devices onto the actual worktop. All detail is geometry.
"""
from __future__ import annotations

import math
import random

import bpy


def _ring(k, name, center, radius, thickness, key, plane="XY", parent=None, segments=24):
    points = []
    for i in range(segments):
        a = i * math.tau / segments
        offset = (math.cos(a) * radius, math.sin(a) * radius)
        if plane == "XY":
            points.append((center[0] + offset[0], center[1] + offset[1], center[2]))
        elif plane == "XZ":
            points.append((center[0] + offset[0], center[1], center[2] + offset[1]))
        else:
            points.append((center[0], center[1] + offset[0], center[2] + offset[1]))
    return k.tube(name, points, thickness, key, cyclic=True, parent=parent)


def _shelf_book(k, name, loc, width, height, depth, key, lean=0.0):
    """A closed hardcover whose bottom origin rests on the shelf; spine faces -Y."""
    group = k.group(name, loc, rotation=(0, lean, 0), collection="STORAGE")
    group["room_prop"] = "bound_book"
    cover = .006
    for side in (-1, 1):
        k.box(name + f"_Cover_{side}", (side * (width / 2 - cover / 2), 0, height / 2),
              (cover, depth, height), key, collection="STORAGE", bevel=.0015, parent=group)
    k.box(name + "_PageBlock", (0, .003, height / 2), (width - .014, depth - .019, height - .018),
          "paper", collection="STORAGE", bevel=.002, parent=group)
    k.box(name + "_Spine", (0, -depth / 2 + .004, height / 2), (width, .009, height),
          key, collection="STORAGE", bevel=.003, parent=group)
    for z in (height * .13, height * .82):
        k.box(name + f"_SpineBand_{z:.3f}", (0, -depth / 2 - .0015, z),
              (width * .83, .003, .006), "gold" if key in ("ink", "oak_dark", "sage") else "cream",
              collection="STORAGE", bevel=.0007, parent=group)
    for line in range(3):
        k.box(name + f"_TitleMark_{line}", (0, -depth / 2 - .002, height * .62 - line * .012),
              (width * (.67 - line * .11), .003, .0038), "paper", collection="STORAGE", bevel=.0005, parent=group)
    title = ("MAT", "HIST", "LIT", "BIO", "ARTE", "NOTAS")[sum(ord(char) for char in name) % 6]
    k.text(name + "_EmbossedTitle", title, (0, -depth / 2 - .004, height * .47), width * .19,
           "cream", collection="STORAGE", rotation=(math.pi / 2, 0, 0), parent=group)
    # Fore-edge page boundaries catch light in oblique and rear views.
    for page in range(4):
        k.box(name + f"_PageBoundary_{page}", (-width * .30 + page * width * .20, depth / 2 - .006, height / 2),
              (.0009, .002, height - .032), "linen_shadow", collection="STORAGE", bevel=.0002, parent=group)
    return group


def _flat_book(k, name, loc, width, length, thickness, key, angle=0.0):
    group = k.group(name, loc, rotation=(0, 0, angle), collection="STORAGE")
    group["room_prop"] = "bound_book"
    for z in (.003, thickness - .003):
        k.box(name + f"_Cover_{z:.3f}", (0, 0, z), (width, length, .006), key,
              collection="STORAGE", bevel=.002, parent=group)
    k.box(name + "_Pages", (0, .003, thickness / 2), (width - .016, length - .016, thickness - .014),
          "paper", collection="STORAGE", bevel=.0015, parent=group)
    k.box(name + "_Spine", (-width / 2 + .004, 0, thickness / 2), (.008, length, thickness),
          key, collection="STORAGE", bevel=.002, parent=group)
    k.box(name + "_CoverLabel", (0, 0, thickness + .001), (width * .48, length * .32, .002),
          "cream", collection="STORAGE", bevel=.001, parent=group)
    for i in range(3):
        k.box(name + f"_PageEdge_{i}", (0, -length / 2 + .006, .010 + i * max(.002, (thickness - .02) / 3)),
              (width - .022, .002, .001), "linen_shadow", collection="STORAGE", bevel=.0002, parent=group)
    return group


def _photo(k, name, loc, width=.25, height=.28):
    group = k.group(name, loc, collection="STORAGE")
    k.box(name + "_Back", (0, 0, height / 2), (width, .025, height), "oak_dark", parent=group)
    k.box(name + "_Mat", (0, -.017, height / 2), (width - .016, .010, height - .016), "paper", parent=group, bevel=.002)
    k.box(name + "_Print", (0, -.024, height / 2 + .013), (width - .045, .004, height - .063), "screen_light", parent=group, bevel=.001)
    k.box(name + "_Landscape", (0, -.028, height * .34), (width - .048, .003, height * .27), "sage", parent=group, bevel=.001)
    k.sphere(name + "_Sun", (-width * .20, -.033, height * .70), (.024, .003, .024), "cream", parent=group)
    for i in (-1, 1):
        k.sphere(name + f"_PortraitHead_{i}", (i * .035, -.034, height * .49), (.019, .003, .023), "terracotta", parent=group)
        k.box(name + f"_PortraitShirt_{i}", (i * .035, -.035, height * .36), (.039, .003, .044), "pink" if i == 1 else "ink", parent=group, bevel=.005)
    k.box(name + "_Easel", (0, .062, height * .24), (.09, .012, height * .50), "oak_dark", parent=group, rotation=(-.43, 0, 0), bevel=.002)
    return group


def _trophy(k, loc):
    group = k.group("STUDY_Trophy", loc, collection="STORAGE")
    k.box("STUDY_Trophy_Platform", (0, 0, .026), (.26, .21, .052), "oak_dark", parent=group)
    k.box("STUDY_Trophy_Plaque", (0, -.109, .027), (.13, .004, .026), "gold", parent=group, bevel=.002)
    for i in range(2):
        k.box(f"STUDY_Trophy_Engraving_{i}", (0, -.112, .031 - i * .009), (.086 - i * .018, .002, .002), "oak_dark", parent=group, bevel=.0003)
    k.cylinder("STUDY_Trophy_Foot", (0, 0, .066), .075, .034, "gold", parent=group)
    k.cylinder("STUDY_Trophy_Stem", (0, 0, .111), .022, .070, "gold", parent=group)
    # Hollow lathed bowl: a handled vessel, not a solid trophy-shaped cylinder.
    profile = [(.025, .139), (.053, .151), (.083, .19), (.099, .24), (.102, .273),
               (.091, .273), (.088, .245), (.073, .201), (.046, .166), (.024, .160)]
    verts = [(radius * math.cos(i * math.tau / 24), radius * math.sin(i * math.tau / 24), z)
             for radius, z in profile for i in range(24)]
    faces = [(j * 24 + i, j * 24 + (i + 1) % 24, (j + 1) * 24 + (i + 1) % 24, (j + 1) * 24 + i)
             for j in range(len(profile) - 1) for i in range(24)]
    k.mesh("STUDY_Trophy_HollowBowl", verts, faces, "gold", parent=group, bevel=.001)
    _ring(k, "STUDY_Trophy_Rim", (0, 0, .273), .097, .005, "gold", parent=group)
    for side in (-1, 1):
        pts = [(side * x, 0, z) for x, z in ((.082, .25), (.132, .267), (.157, .24), (.148, .193), (.106, .179), (.070, .196))]
        k.tube(f"STUDY_Trophy_Handle_{side}", pts, .012, "gold", parent=group)
    return group


def _globe(k, loc):
    group = k.group("STUDY_Globe", loc, collection="STORAGE")
    k.cylinder("STUDY_Globe_Base", (0, 0, .014), .10, .028, "oak_dark", parent=group)
    k.cylinder("STUDY_Globe_Stand", (0, 0, .065), .013, .092, "gold", parent=group)
    k.sphere("STUDY_Globe_Ocean", (0, 0, .178), (.103, .103, .103), "screen_light", segments=24, rings=16, parent=group)
    _ring(k, "STUDY_Globe_Meridian", (0, 0, .178), .117, .006, "gold", plane="XZ", parent=group)
    for lat in (-.52, 0, .52):
        radius = .104 * math.cos(lat)
        _ring(k, f"STUDY_Globe_Latitude_{lat}", (0, 0, .178 + .104 * math.sin(lat)), radius, .0008, "cream", parent=group)
    for i, (x, y, z, sx, sz) in enumerate(((-.037, -.085, .215, .037, .025), (-.020, -.096, .167, .016, .030), (.045, -.081, .210, .035, .020), (.050, -.086, .169, .025, .027))):
        k.sphere(f"STUDY_Globe_Continent_{i}", (x, y, z), (sx, .012, sz), "sage", segments=8, rings=5, parent=group)
    return group


def _books_and_collectibles(k):
    k.remove_prefixes(("Storage_Books_", "Decor_FloatingBooks", "Decor_Trophy", "Decor_PhotoFrame", "Decor_Photo"))
    rng = random.Random(4901)
    colors = ("sage", "pink_dark", "ink", "cream", "screen", "terracotta", "oak_dark", "pink")
    count = 0
    # Each book stands on a measured shelf top; widths leave deliberate breathing spaces.
    for row, (z, number, start) in enumerate(((.835, 11, 3.105), (1.315, 8, 3.095), (2.275, 4, 3.13), (2.735, 6, 3.13))):
        x = start
        for i in range(number):
            width = rng.uniform(.039, .059)
            h = rng.uniform(.23, .34) if z < 2.6 else rng.uniform(.22, .30)
            x += width / 2
            _shelf_book(k, f"STUDY_ShelfBook_{row}_{i:02d}", (x, 1.88 + rng.uniform(-.013, .016), z + .002), width, h, rng.uniform(.205, .25), colors[(i + row * 2) % len(colors)])
            x += width / 2 + .005
            count += 1
        if row < 2:
            _shelf_book(k, f"STUDY_ShelfBook_{row}_Leaning", (x + .045, 1.885, z + .008), .043, .31, .225, "sage_light", lean=-.13)
            count += 1
            k.box(f"STUDY_Bookend_{row}_Sole", (x + .085, 1.89, z + .006), (.13, .245, .012), "gold", collection="STORAGE", bevel=.002)
            k.box(f"STUDY_Bookend_{row}_Upright", (x + .132, 1.89, z + .101), (.014, .245, .20), "gold", collection="STORAGE", bevel=.002)
    for i in range(4):
        _flat_book(k, f"STUDY_ShelfStack_{i}", (3.32 + (i % 2) * .014, 1.87, 1.795 + i * .052), .32 - i * .012, .265, .05, colors[i], angle=(i - 1) * .035)
        count += 1
    _photo(k, "STUDY_ShelfFriendPhoto", (3.78, 1.82, 1.795), .25, .31)
    _trophy(k, (3.70, 1.87, 2.275))
    _globe(k, (3.82, 1.88, 1.315))
    # Keep both floating shelf plant reservations free.
    for i in range(6):
        _shelf_book(k, f"STUDY_FloatingBook_{i}", (-.02 + i * .069, 2.43, 2.407), .053, .23 + .024 * (i % 4), .23, colors[(i + 1) % len(colors)], lean=.055 if i == 5 else 0)
        count += 1
    _photo(k, "STUDY_FloatingPhoto", (.75, 2.43, 2.405), .31, .32)
    # Refine the existing linen box instead of reducing its stored volume.
    k.box("STUDY_StorageBox_Lid", (3.50, 1.89, .678), (.746, .468, .026), "pink", collection="STORAGE", bevel=.008)
    for x in (3.167, 3.833):
        k.box(f"STUDY_StorageBox_Seam_{x}", (x, 1.659, .532), (.005, .003, .225), "pink_light", collection="STORAGE", bevel=.0005)
    k.box("STUDY_StorageBox_LabelCard", (3.5, 1.629, .54), (.130, .004, .035), "paper", collection="STORAGE", bevel=.001)
    for i in range(2):
        k.box(f"STUDY_StorageBox_LabelLine_{i}", (3.5, 1.625, .548 - i * .012), (.08 - i * .022, .002, .002), "ink", collection="STORAGE", bevel=.0003)
    return count


def _screen(k):
    k.remove_prefixes(("Detail_MonitorUI_",))
    y = 1.873
    k.box("STUDY_UI_Background", (1.18, y, 1.58), (.863, .006, .512), "paper", collection="DESK", bevel=.009)
    k.box("STUDY_UI_Sidebar", (.819, y - .004, 1.58), (.13, .005, .50), "sage", collection="DESK", bevel=.002)
    k.box("STUDY_UI_Header", (1.247, y - .006, 1.790), (.67, .004, .042), "screen_light", collection="DESK", bevel=.003)
    for i in range(3):
        k.sphere(f"STUDY_UI_WindowDot_{i}", (.920 + i * .021, y - .012, 1.789), (.005, .002, .005), ("pink_dark", "gold", "sage")[i], collection="DESK", segments=8, rings=5)
    for i in range(5):
        z = 1.72 - i * .063
        k.box(f"STUDY_UI_MenuIcon_{i}", (.783, y - .009, z), (.018, .003, .018), "cream", collection="DESK", bevel=.003)
        k.box(f"STUDY_UI_MenuText_{i}", (.830, y - .009, z), (.050, .003, .005), "linen", collection="DESK", bevel=.001)
    k.text("STUDY_UI_StudyTitle", "Mi plan de estudio", (1.12, y - .018, 1.727), .027, "ink", collection="DESK", rotation=(math.pi / 2, 0, 0))
    k.box("STUDY_UI_StudySubtitle", (1.11, y - .012, 1.688), (.35, .003, .005), "sage", collection="DESK", bevel=.0008)
    for i in range(3):
        z = 1.63 - i * .076
        k.box(f"STUDY_UI_TaskCard_{i}", (1.135, y - .013, z), (.38, .004, .058), "linen_shadow", collection="DESK", bevel=.005)
        k.box(f"STUDY_UI_Checkbox_{i}", (.975, y - .017, z), (.019, .003, .019), "sage" if i != 2 else "paper", collection="DESK", bevel=.002)
        k.box(f"STUDY_UI_TaskTitle_{i}", (1.117, y - .018, z + .008), (.20, .002, .006), "ink", collection="DESK", bevel=.001)
        k.box(f"STUDY_UI_TaskCaption_{i}", (1.093, y - .018, z - .008), (.153, .002, .004), "sage", collection="DESK", bevel=.0008)
    k.box("STUDY_UI_ProgressPanel", (1.473, y - .012, 1.575), (.195, .004, .274), "cream", collection="DESK", bevel=.005)
    for i, h in enumerate((.047, .078, .061, .115, .137)):
        k.box(f"STUDY_UI_ProgressBar_{i}", (1.404 + i * .034, y - .018, 1.475 + h / 2), (.019, .003, h), "sage" if i != 4 else "pink_dark", collection="DESK", bevel=.002)
    k.box("STUDY_UI_ProgressTitle", (1.472, y - .018, 1.68), (.14, .003, .006), "ink", collection="DESK", bevel=.001)
    k.box("STUDY_UI_ActionButton", (1.141, y - .014, 1.365), (.225, .004, .032), "sage", collection="DESK", bevel=.006)
    k.text("STUDY_UI_ActionLabel", "Empezar", (1.141, y - .021, 1.365), .018, "paper", collection="DESK", rotation=(math.pi / 2, 0, 0))
    k.sphere("STUDY_Monitor_StatusLED", (1.59, 1.894, 1.295), (.003, .002, .003), "sage_light", collection="DESK", segments=8, rings=4)
    # Monitor rear casing ventilation and a mount make side/back views intentional.
    for i in range(9):
        k.box(f"STUDY_Monitor_RearVent_{i}", (.905 + .067 * i, 2.024, 1.74), (.04, .004, .004), "metal", collection="DESK", bevel=.001)
    k.box("STUDY_Monitor_VESAMount", (1.18, 2.029, 1.47), (.14, .024, .12), "metal", collection="DESK", bevel=.009)


def _input_devices(k):
    k.remove_prefixes(("Desk_Keyboard", "Detail_Key_", "Desk_DeskMat", "Desk_MonitorBase", "Desk_MonitorStand"))
    k.box("STUDY_DeskMat", (1.27, 1.89, 1.057), (1.30, .43, .012), "sage", collection="DESK", bevel=.019)
    # Stitched edge follows the actual pad boundary, entirely over the worktop.
    pts = [(x, y, 1.065) for x, y in ((.645, 1.69), (1.895, 1.69), (1.895, 2.09), (.645, 2.09))]
    k.tube("STUDY_DeskMat_Edge", pts, .0014, "sage_light", collection="DESK", cyclic=True)
    k.box("STUDY_MonitorBase", (1.18, 2.24, 1.078), (.39, .255, .046), "metal", collection="DESK", bevel=.015)
    k.tube("STUDY_MonitorStand", [(1.18, 2.23, 1.10), (1.18, 2.23, 1.33), (1.18, 2.05, 1.45)], .038, "metal", collection="DESK")
    k.box("STUDY_KeyboardChassis", (1.115, 1.814, 1.094), (.716, .247, .041), "cream", collection="DESK", bevel=.017)
    k.box("STUDY_KeyboardKeybed", (1.115, 1.814, 1.115), (.678, .215, .007), "linen_shadow", collection="DESK", bevel=.009)
    key_count = 0
    for row in range(4):
        for col in range(13):
            if row == 0 and 3 <= col <= 8:
                continue
            x = .804 + col * .0518
            y = 1.735 + row * .051
            color = "pink" if (row == 3 and col == 0) else "sage_light" if col == 12 else "paper"
            k.box(f"STUDY_Keycap_{row}_{col}", (x, y, 1.126), (.043, .038, .019), color, collection="DESK", bevel=.004)
            if row > 0:
                k.box(f"STUDY_KeyLegend_{row}_{col}", (x - .009, y + .004, 1.136), (.006, .008, .001), "ink", collection="DESK", bevel=.0005)
            key_count += 1
    k.box("STUDY_Keycap_Spacebar", (1.089, 1.735, 1.126), (.296, .038, .019), "sage_light", collection="DESK", bevel=.004)
    k.sphere("STUDY_MouseShell", (1.67, 1.79, 1.099), (.055, .088, .032), "paper", collection="DESK", segments=20, rings=10)
    k.tube("STUDY_MouseButtonSeam", [(1.67, 1.813, 1.130), (1.67, 1.854, 1.122)], .0009, "linen_shadow", collection="DESK")
    k.box("STUDY_MouseWheel", (1.67, 1.815, 1.131), (.012, .027, .006), "sage", collection="DESK", bevel=.003)
    k.tube("STUDY_MouseCable", [(1.67, 1.870, 1.082), (1.70, 2.06, 1.066), (1.69, 2.30, 1.065), (1.78, 2.37, .90)], .004, "metal", collection="DESK")
    k.tube("STUDY_KeyboardCable", [(1.42, 1.94, 1.084), (1.45, 2.14, 1.066), (1.59, 2.36, 1.067), (1.65, 2.39, .93)], .004, "linen_shadow", collection="DESK")
    return key_count + 1


def _open_notebook(k):
    k.remove_prefixes(("Desk_Notebook",))
    group = k.group("STUDY_OpenNotebook", (2.05, 1.793, 1.052), collection="DESK")
    k.box("STUDY_NotebookCover", (0, 0, .007), (.407, .246, .012), "pink_dark", collection="DESK", bevel=.005, parent=group)
    for side in (-1, 1):
        k.box(f"STUDY_NotebookPageStack_{side}", (side * .101, 0, .020), (.189, .232, .022), "paper", collection="DESK", bevel=.003, parent=group)
        for line in range(7):
            k.box(f"STUDY_NotebookRule_{side}_{line}", (side * .10, -.085 + line * .025, .032), (.16, .0012, .0007), "screen_light", collection="DESK", bevel=.0002, parent=group)
        k.box(f"STUDY_NotebookMargin_{side}", (side * .024, 0, .0324), (.001, .213, .0008), "pink_light", collection="DESK", bevel=.0002, parent=group)
    for i in range(8):
        _ring(k, f"STUDY_NotebookSpiral_{i}", (0, -.100 + i * .029, .025), .009, .0018, "metal", plane="XZ", parent=group, segments=12)
    for line in range(5):
        for word in range(3):
            k.box(f"STUDY_NotebookWriting_{line}_{word}", (-.158 + word * .049, -.073 + line * .025, .033), (.026 + (word % 2) * .008, .0024, .0008), "ink", collection="DESK", bevel=.0003, parent=group)
    for i, h in enumerate((.021, .033, .049, .038, .066)):
        k.box(f"STUDY_NotebookStudyDiagram_{i}", (.053 + i * .028, -.044 + h / 2, .033), (.014, h, .001), "sage" if i < 4 else "pink_dark", collection="DESK", bevel=.001, parent=group)
    k.tube("STUDY_NotebookDiagramAxes", [(.038, .044, .034), (.038, -.044, .034), (.180, -.044, .034)], .001, "ink", collection="DESK", parent=group)
    k.box("STUDY_NotebookBookmark", (.09, -.135, .012), (.033, .055, .002), "sage", collection="DESK", bevel=.0005, parent=group)
    k.tube("STUDY_DeskPen", [(2.279, 1.734, 1.058), (2.323, 1.891, 1.062)], .006, "ink", collection="DESK")
    k.tube("STUDY_DeskPenMetalTip", [(2.279, 1.734, 1.058), (2.275, 1.720, 1.058)], .0028, "gold", collection="DESK")


def _vessels_lamp(k):
    k.remove_prefixes(("Desk_PencilCup", "Desk_Pencil_", "Desk_LampArm", "Desk_LampHead"))
    # Hollow ceramic mug: inner walls, rim and real handle are visible from above.
    for name, loc, radius, h, key in (("STUDY_PencilCup", (2.24, 2.18, 1.055), .079, .205, "cream"),
                                     ("STUDY_Mug", (.365, 2.255, 1.055), .069, .125, "pink_light")):
        group = k.group(name, loc, collection="DESK")
        profile = [(radius * .81, .003), (radius, .014), (radius, h), (radius - .006, h), (radius - .007, .014), (.008, .014)]
        verts = [(r * math.cos(i * math.tau / 24), r * math.sin(i * math.tau / 24), z) for r, z in profile for i in range(24)]
        faces = [(j * 24 + i, j * 24 + (i + 1) % 24, (j + 1) * 24 + (i + 1) % 24, (j + 1) * 24 + i) for j in range(len(profile) - 1) for i in range(24)]
        faces.append(tuple(range(24 - 1, -1, -1)))
        faces.append(tuple((len(profile) - 1) * 24 + i for i in range(24)))
        k.mesh(name + "_Ceramic", verts, faces, key, collection="DESK", bevel=.001, parent=group)
        _ring(k, name + "_Rim", (0, 0, h), radius - .002, .003, key, parent=group)
        if "Mug" in name:
            k.tube(name + "_Handle", [(radius - .002, 0, .103), (.104, 0, .116), (.125, 0, .087), (.122, 0, .047), (.099, 0, .036), (radius - .001, 0, .043)], .008, key, collection="DESK", parent=group)
            k.cylinder(name + "_Tea", (0, 0, .099), radius - .008, .001, "oak_dark", collection="DESK", parent=group)
    for i in range(6):
        x, y = 2.197 + (i % 3) * .033, 2.163 + (i // 3) * .03
        h = .275 + .014 * (i % 3)
        key = ("pink_dark", "sage", "gold", "screen", "oak_dark", "terracotta")[i]
        k.tube(f"STUDY_Pencil_{i}", [(x, y, 1.083), (x + (i - 2) * .005, y - .012, 1.055 + h)], .0055, key, collection="DESK")
        k.cylinder(f"STUDY_PencilTip_{i}", (x + (i - 2) * .005, y - .012, 1.068 + h), .0055, .026, "oak_light", collection="DESK", vertices=6, radius_top=.0007)
        k.sphere(f"STUDY_PencilGraphite_{i}", (x + (i - 2) * .005, y - .012, 1.082 + h), (.0014, .0014, .003), "ink", collection="DESK", segments=6, rings=4)
    for side in (-1, 1):
        x = 2.3 + side * .016
        k.tube(f"STUDY_LampLowerLink_{side}", [(x, 2.13, 1.105), (x + .08, 2.17, 1.44)], .009, "metal", collection="DESK")
        k.tube(f"STUDY_LampUpperLink_{side}", [(x + .08, 2.17, 1.44), (2.20 + side * .016, 2.05, 1.70)], .008, "metal", collection="DESK")
    for i, loc in enumerate(((2.30, 2.13, 1.11), (2.38, 2.17, 1.44), (2.20, 2.05, 1.70))):
        k.sphere(f"STUDY_LampHinge_{i}", loc, (.028, .020, .028), "gold", collection="DESK", segments=16, rings=8)
    k.cylinder("STUDY_LampShade", (2.20, 2.05, 1.665), .13, .14, "pink_dark", collection="DESK", vertices=24, radius_top=.065)
    k.cylinder("STUDY_LampInner", (2.20, 2.05, 1.592), .114, .006, "cream", collection="DESK", vertices=24)
    k.cylinder("STUDY_LampBulb", (2.20, 2.05, 1.585), .069, .009, "white", collection="DESK", vertices=20)
    # Sticky reminders attached to the monitor bezel, not unsupported in space.
    for i, x in enumerate((.83, 1.02)):
        k.box(f"STUDY_MonitorSticky_{i}", (x, 1.882, 1.264), (.097, .008, .075), "pink_light" if i else "cream", collection="DESK", bevel=.001)
        for line in range(3):
            k.box(f"STUDY_MonitorStickyWriting_{i}_{line}", (x, 1.876, 1.284 - line * .014), (.059 - line * .009, .002, .002), "ink", collection="DESK", bevel=.0003)
    # Headphones hung from a small under-desk hook, preserving usable desktop space.
    k.tube("STUDY_HeadsetHook", [(2.405, 1.83, .960), (2.507, 1.83, .960), (2.507, 1.83, .915)], .009, "metal", collection="DESK")
    points = [(2.507, 1.83 + .105 * math.cos(i * math.pi / 16), .734 + .185 * math.sin(i * math.pi / 16)) for i in range(17)]
    k.tube("STUDY_HeadsetBand", points, .017, "ink", collection="DESK")
    for side in (-1, 1):
        k.sphere(f"STUDY_HeadsetCup_{side}", (2.507, 1.83 + side * .10, .732), (.046, .026, .067), "pink_dark", collection="DESK", segments=16, rings=10)
        k.sphere(f"STUDY_HeadsetPad_{side}", (2.507, 1.83 + side * .077, .732), (.034, .012, .052), "black", collection="DESK", segments=12, rings=8)


def _chair(k):
    back = bpy.data.objects.get("Desk_ChairBack")
    if back:
        back.location.y = .895
        back.rotation_euler.x = .10
    for side, x in (("L", 1.035), ("R", 1.685)):
        k.tube(f"STUDY_ChairArmSupport_{side}", [(x, 1.02, .69), (x, 1.02, .89), (x, 1.35, .89)], .016, "metal", collection="DESK")
        k.box(f"STUDY_ChairArmPad_{side}", (x, 1.17, .916), (.087, .34, .05), "pink_dark", collection="DESK", bevel=.018)
    k.tube("STUDY_ChairSeatPiping", [(1.105, .905, .748), (1.615, .905, .748), (1.646, .943, .748), (1.646, 1.391, .748), (1.615, 1.437, .748), (1.105, 1.437, .748), (1.074, 1.391, .748), (1.074, .943, .748)], .003, "pink_dark", collection="DESK", cyclic=True)
    for i, x in enumerate((1.15, 1.36, 1.57)):
        k.tube(f"STUDY_ChairBackStitch_{i}", [(x, .991, .86), (x, .979, 1.10), (x, .955, 1.38)], .0018, "pink", collection="DESK")
    k.box("STUDY_ChairLumbarPad", (1.36, 1.02, .977), (.42, .082, .15), "pink", collection="DESK", bevel=.04)
    k.tube("STUDY_ChairAdjustmentLever", [(1.56, 1.25, .592), (1.78, 1.25, .61)], .009, "metal", collection="DESK")
    k.box("STUDY_ChairLeverGrip", (1.79, 1.25, .61), (.085, .037, .028), "black", collection="DESK", bevel=.009)
    return {"seatCenter": [1.36, 1.17, .68], "backY": .895, "faces": "+Y toward desk"}


def upgrade(k):
    """Enrich the room's desk and bookcase and report actual produced detail counts."""
    before = set(bpy.context.scene.objects)
    books = _books_and_collectibles(k)
    _screen(k)
    keys = _input_devices(k)
    _open_notebook(k)
    _vessels_lamp(k)
    chair = _chair(k)
    bpy.context.view_layer.update()
    made = [obj for obj in bpy.context.scene.objects if obj not in before]
    return {
        "subsystem": "study_and_bookcase", "newObjects": len(made),
        "newMeshes": sum(obj.type == "MESH" for obj in made),
        "individualBoundBooks": books, "keyboardKeycaps": keys,
        "desktopBoundsXY": {"min": [.125, 1.65], "max": [2.475, 2.45]},
        "deskMatBoundsXY": {"min": [.62, 1.675], "max": [1.92, 2.105]},
        "keyboardBoundsXY": {"min": [.757, 1.6905], "max": [1.473, 1.9375]},
        "chair": chair,
        "detailFeatures": ["bound books with covers, page blocks, page edges, spine titles and raised bands",
                           "bookends, horizontal stacks, photo frames, globe and hollow handled trophy",
                           "layered study application UI, keyboard keys and legends, sculpted mouse and routed cables",
                           "open spiral notebook with writing and chart geometry",
                           "hollow ceramic mug with tea and handle, six sharpened pencils",
                           "articulated task lamp, headset on hook, corrected chair with armrests and upholstery seams"],
        "remainingVisualReview": "Check shelf leaning clearances and desk close-up in the combined room render.",
    }
