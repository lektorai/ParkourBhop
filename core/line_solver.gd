class_name LineSolver
extends RefCounted
## Complete single-line nonogram solver.
## Given the current cell states of one line and its clues, returns the states
## that are forced by logic (every arrangement agrees), or an empty array when
## the line is contradictory.
##
## States: 0 = unknown, 1 = filled, 2 = empty.


static func solve_line(states: PackedByteArray, clues: PackedInt32Array) -> PackedByteArray:
	var n := states.size()
	var k := clues.size()
	if k == 1 and clues[0] == 0:
		k = 0
	# Empty line: everything must be empty.
	if k == 0:
		var out0 := PackedByteArray()
		out0.resize(n)
		for i in n:
			if states[i] == 1:
				return PackedByteArray()
			out0[i] = 2
		return out0

	# Padded copy with a virtual always-empty cell at index n.
	var s := states.duplicate()
	s.append(2)
	var N := n + 1

	# fwd[j][i]: cells [0, i) can be assigned using exactly the first j blocks,
	# with cell i-1 empty (or i == 0), so position i is free for the next choice.
	# bwd[j][i]: cells [i, N) can be assigned using blocks j..k-1.
	var fwd: Array = []
	var bwd: Array = []
	for j in k + 1:
		var a := PackedByteArray()
		a.resize(N + 1)
		fwd.append(a)
		var b := PackedByteArray()
		b.resize(N + 1)
		bwd.append(b)

	fwd[0][0] = 1
	for j in k + 1:
		var fj: PackedByteArray = fwd[j]
		for i in N:
			if fj[i] == 0:
				continue
			if s[i] != 1:
				fj[i + 1] = 1
			if j < k:
				var e := i + clues[j] - 1
				if e < n and _free(s, i, e) and s[e + 1] != 1:
					var fn: PackedByteArray = fwd[j + 1]
					fn[e + 2] = 1
					fwd[j + 1] = fn
		fwd[j] = fj

	var bk: PackedByteArray = bwd[k]
	bk[N] = 1
	bwd[k] = bk
	for j in range(k, -1, -1):
		var bj: PackedByteArray = bwd[j]
		var bn: PackedByteArray = bwd[j + 1] if j < k else PackedByteArray()
		for i in range(N - 1, -1, -1):
			var ok := s[i] != 1 and bj[i + 1] == 1
			if not ok and j < k:
				var e := i + clues[j] - 1
				if e < n and _free(s, i, e) and s[e + 1] != 1 and bn[e + 2] == 1:
					ok = true
			if ok:
				bj[i] = 1
		bwd[j] = bj

	if (bwd[0] as PackedByteArray)[0] == 0:
		return PackedByteArray()

	var can_fill := PackedByteArray()
	can_fill.resize(n)
	var can_empty := PackedByteArray()
	can_empty.resize(n)
	for j in k + 1:
		var fj: PackedByteArray = fwd[j]
		var bj: PackedByteArray = bwd[j]
		var bn: PackedByteArray = bwd[j + 1] if j < k else PackedByteArray()
		for i in n:
			if fj[i] == 0:
				continue
			if s[i] != 1 and bj[i + 1] == 1:
				can_empty[i] = 1
			if j < k:
				var e := i + clues[j] - 1
				if e < n and _free(s, i, e) and s[e + 1] != 1 and bn[e + 2] == 1:
					for p in range(i, e + 1):
						can_fill[p] = 1
					# The mandatory gap after the block is empty in this arrangement.
					if e + 1 < n:
						can_empty[e + 1] = 1

	var out := PackedByteArray()
	out.resize(n)
	for i in n:
		var f := can_fill[i] == 1
		var m := can_empty[i] == 1
		if f and not m:
			out[i] = 1
		elif m and not f:
			out[i] = 2
		elif not f and not m:
			return PackedByteArray()
		else:
			out[i] = states[i]
	return out


static func _free(s: PackedByteArray, a: int, b: int) -> bool:
	for i in range(a, b + 1):
		if s[i] == 2:
			return false
	return true
