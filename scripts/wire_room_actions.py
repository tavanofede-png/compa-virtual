from pathlib import Path
p=Path('packages/world3d/src/premium.ts');s=p.read_text().replace('[map.bed.position[0], map.bed.height - 0.16, 0]','[map.bed.position[0], map.bed.height - 0.16, map.bed.position[2] - 0.7]')
s=s.replace('      ] as const) {','''        ...(map.pouf ? [["pouf", map.pouf.position, [0.9, 0.6, 0.9]]] : []),
        ...(map.objects ?? []).map(o => ["object:" + o.id, o.position, [0.5, 0.6, 0.5]]),
      ] as [string, number[], number[]][]) {''',1).replace('new T.BoxGeometry(...size)','new T.BoxGeometry(size[0], size[1], size[2])')
s=s.replace('    } else {\n      const floor = new T.Mesh(','''      const floorHit = new T.Mesh(new T.PlaneGeometry(map.bounds[2] - map.bounds[0], map.bounds[3] - map.bounds[1]), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
      floorHit.rotation.x = -Math.PI / 2;
      floorHit.position.set((map.bounds[0] + map.bounds[2]) / 2, map.floor + .025, (map.bounds[1] + map.bounds[3]) / 2);
      floorHit.userData.roomAction = "floor";
      scene.add(floorHit);
    } else {
      const floor = new T.Mesh(''',1)
p.write_text(s)
p=Path('apps/web/src/Room.tsx');s=p.read_text().replace('  type CompanionAction,','  type CompanionAction,\n  roomInteractions,')
s=s.replace('              setFurniture(hit.object.userData.roomAction);','''              const target = String(hit.object.userData.roomAction);
              if (target === "floor") world.controller?.walkTo(hit.point.toArray());
              else if (target.startsWith("object:")) world.controller?.inspect(target.slice(7));
              else if (target === "pouf") world.controller?.request("pouf");
              else setFurniture(target);''')
s=s.replace('["sit", "study", "rest", "stand", "walk"]','["sit", "study", "rest", "stand", "walk", "pouf"]')
s=s.replace('          if (type === "reset") {','          if (type.startsWith("object:")) { world.controller?.inspect(type.slice(7)); setFurniture(null); dirty = true; return; }\n          if (type === "reset") {')
s=s.replace('<button onClick={() => action.current("walk")}>Pasear</button>','''<button onClick={() => action.current("walk")}>Caminar por la habitación</button>
              {roomInteractions[companion.room_style ?? "cozy"]?.pouf && <button onClick={() => action.current("pouf")}>Sentarse en el puff</button>}
              {roomInteractions[companion.room_style ?? "cozy"]?.objects?.map(o => <button key={o.id} onClick={() => action.current("object:" + o.id)}>{o.label}</button>)}''')
s=s.replace('Arrastrá para mirar alrededor','Tocá el piso para caminar · Arrastrá para mirar')
p.write_text(s)
p=Path('apps/mobile/src/Creature.tsx');s=p.read_text().replace('  type CompanionAction,','  type CompanionAction,\n  roomInteractions,')
s=s.replace('      onFurniture();','''      event.stopPropagation();
      const target = String(event.object.userData.roomAction);
      if (target === "floor") world.controller?.walkTo(event.point.toArray());
      else if (target === "pouf") world.controller?.request("pouf");
      else if (target.startsWith("object:")) world.controller?.inspect(target.slice(7));
      else onFurniture();''',1)
s=s.replace('["walk", "Pasear"],','["walk", "Caminar por la habitación"],\n                  ...(roomInteractions[companion.room_style ?? "cozy"]?.pouf ? [["pouf", "Sentarse en el puff"]] : []),\n                  ...(roomInteractions[companion.room_style ?? "cozy"]?.objects ?? []).map(o => ["object:" + o.id, o.label]),')
s=s.replace('world.controller?.request(action as CompanionAction);','if (action.startsWith("object:")) world.controller?.inspect(action.slice(7));\n                    else world.controller?.request(action as CompanionAction);')
p.write_text(s)
