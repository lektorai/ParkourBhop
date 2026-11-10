class_name NonogramGenerator
extends RefCounted
## Deterministic (seeded) generator of line-solvable nonograms.


## Stable seed for "level N of size S". Changing this breaks level continuity,
## so keep it fixed after release.
static func level_seed(size: int, level: int) -> int:
	return hash("lvl:%d:%d" % [size, level]) & 0x7FFFFFFF


## Stable seed for the daily puzzle. date_str is "YYYY-MM-DD".
static func daily_seed(date_str: String) -> int:
	return hash("daily:%s" % date_str) & 0x7FFFFFFF


static func generate(w: int, h: int, seed: int, puzzle_id: String = "") -> Nonogram:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var best: Nonogram = null
	var best_unknown := 1 << 30

	for attempt in 60:
		var density := 0.50 + rng.randf() * 0.15
		if w <= 5:
			density = 0.50 + rng.randf() * 0.2
		var grid := PackedByteArray()
		grid.resize(w * h)
		for i in w * h:
			grid[i] = 1 if rng.randf() < density else 0

		for repair in 12:
			var p := Nonogram.from_grid(grid, w, h, puzzle_id)
			var res := NonogramSolver.solve(p)
			if res.solved:
				p.passes = res.passes
				return p
			var unknown := 0
			var rg: PackedByteArray = res.grid
			for i in w * h:
				if rg[i] == 0:
					unknown += 1
					# Re-roll ambiguous cells, biased towards empty to break symmetry.
					grid[i] = 1 if rng.randf() < 0.35 else 0
			if unknown < best_unknown:
				best_unknown = unknown
				best = p
	# Should be unreachable in practice; return the closest candidate.
	return best
