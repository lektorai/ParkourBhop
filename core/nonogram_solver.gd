class_name NonogramSolver
extends RefCounted
## Whole-puzzle solver using line logic only (what a human can deduce without
## guessing). Used to guarantee that generated puzzles are fair.


## Returns {"solved": bool, "contradiction": bool, "passes": int, "grid": PackedByteArray}
## grid states: 0 unknown, 1 filled, 2 empty.
static func solve(p: Nonogram, initial: PackedByteArray = PackedByteArray(), max_passes: int = 200) -> Dictionary:
	var w := p.width
	var h := p.height
	var grid := PackedByteArray()
	if initial.size() == w * h:
		grid = initial.duplicate()
	else:
		grid.resize(w * h)
	var row_dirty := PackedByteArray()
	row_dirty.resize(h)
	row_dirty.fill(1)
	var col_dirty := PackedByteArray()
	col_dirty.resize(w)
	col_dirty.fill(1)

	var passes := 0
	var changed := true
	while changed and passes < max_passes:
		changed = false
		passes += 1
		for y in h:
			if row_dirty[y] == 0:
				continue
			row_dirty[y] = 0
			var line := grid.slice(y * w, (y + 1) * w)
			var res := LineSolver.solve_line(line, p.row_clues[y])
			if res.is_empty():
				return {"solved": false, "contradiction": true, "passes": passes, "grid": grid}
			for x in w:
				if res[x] != line[x]:
					grid[y * w + x] = res[x]
					col_dirty[x] = 1
					changed = true
		for x in w:
			if col_dirty[x] == 0:
				continue
			col_dirty[x] = 0
			var line := PackedByteArray()
			line.resize(h)
			for y in h:
				line[y] = grid[y * w + x]
			var res := LineSolver.solve_line(line, p.col_clues[x])
			if res.is_empty():
				return {"solved": false, "contradiction": true, "passes": passes, "grid": grid}
			for y in h:
				if res[y] != line[y]:
					grid[y * w + x] = res[y]
					row_dirty[y] = 1
					changed = true

	var solved := true
	for v in grid:
		if v == 0:
			solved = false
			break
	return {"solved": solved, "contradiction": false, "passes": passes, "grid": grid}


## One propagation pass from a given state. Returns the list of cell indices
## that become determined (used for "logical" hints).
static func deducible_cells(p: Nonogram, state: PackedByteArray) -> PackedInt32Array:
	var w := p.width
	var h := p.height
	var out := PackedInt32Array()
	var seen := {}
	for y in h:
		var line := state.slice(y * w, (y + 1) * w)
		var res := LineSolver.solve_line(line, p.row_clues[y])
		if res.is_empty():
			continue
		for x in w:
			if line[x] == 0 and res[x] != 0:
				var idx := y * w + x
				if not seen.has(idx):
					seen[idx] = true
					out.append(idx)
	for x in w:
		var line := PackedByteArray()
		line.resize(h)
		for y in h:
			line[y] = state[y * w + x]
		var res := LineSolver.solve_line(line, p.col_clues[x])
		if res.is_empty():
			continue
		for y in h:
			if line[y] == 0 and res[y] != 0:
				var idx := y * w + x
				if not seen.has(idx):
					seen[idx] = true
					out.append(idx)
	return out
