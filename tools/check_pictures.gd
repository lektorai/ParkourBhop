extends SceneTree
## Prints the cells that line logic cannot resolve for every picture.
## godot --headless --path . --script tools/check_pictures.gd

func _initialize() -> void:
	for d in Pictures.LIST:
		var p := Pictures.build(d.id)
		var r := NonogramSolver.solve(p)
		if r.solved:
			continue
		print("\n== %s (unsolved)" % d.id)
		var g: PackedByteArray = r.grid
		for y in p.height:
			var line := ""
			for x in p.width:
				var v := g[y * p.width + x]
				line += "?" if v == 0 else ("#" if v == 1 else ".")
			print(line + "   " + d.rows[y])
	quit()
