class_name Nonogram
extends RefCounted
## Immutable description of a nonogram puzzle: size, solution bitmap and clues.

const UNKNOWN := 0
const FILLED := 1
const EMPTY := 2

var width: int = 0
var height: int = 0
## Row-major, 1 = filled, 0 = empty.
var solution: PackedByteArray = PackedByteArray()
## Array of PackedInt32Array, one per row / column.
var row_clues: Array = []
var col_clues: Array = []
## Stable identifier, e.g. "lvl-10-3", "daily-20261110", "pic-heart".
var id: String = ""
## Optional human title (picture puzzles).
var title_key: String = ""
## Difficulty metric filled by the generator (number of solver passes).
var passes: int = 0


static func from_grid(grid: PackedByteArray, w: int, h: int, puzzle_id: String = "") -> Nonogram:
	var p := Nonogram.new()
	p.width = w
	p.height = h
	p.solution = grid.duplicate()
	p.id = puzzle_id
	p._compute_clues()
	return p


## Build from strings like ["..##..", ".#..#."], '#' = filled.
static func from_strings(rows: Array, puzzle_id: String = "") -> Nonogram:
	var h: int = rows.size()
	var w: int = (rows[0] as String).length() if h > 0 else 0
	var grid := PackedByteArray()
	grid.resize(w * h)
	for y in h:
		var line: String = rows[y]
		assert(line.length() == w, "Picture row %d has wrong length" % y)
		for x in w:
			grid[y * w + x] = 1 if line[x] == "#" else 0
	return from_grid(grid, w, h, puzzle_id)


static func clues_for_line(line: PackedByteArray) -> PackedInt32Array:
	var out := PackedInt32Array()
	var run := 0
	for v in line:
		if v == 1:
			run += 1
		elif run > 0:
			out.append(run)
			run = 0
	if run > 0:
		out.append(run)
	if out.is_empty():
		out.append(0)
	return out


func cell(x: int, y: int) -> int:
	return solution[y * width + x]


func row_line(y: int) -> PackedByteArray:
	return solution.slice(y * width, (y + 1) * width)


func col_line(x: int) -> PackedByteArray:
	var out := PackedByteArray()
	out.resize(height)
	for y in height:
		out[y] = solution[y * width + x]
	return out


func filled_count() -> int:
	var c := 0
	for v in solution:
		if v == 1:
			c += 1
	return c


func max_row_clue_len() -> int:
	var m := 1
	for c in row_clues:
		m = max(m, (c as PackedInt32Array).size())
	return m


func max_col_clue_len() -> int:
	var m := 1
	for c in col_clues:
		m = max(m, (c as PackedInt32Array).size())
	return m


func solution_string() -> String:
	var s := ""
	for v in solution:
		s += "1" if v == 1 else "0"
	return s


static func from_solution_string(s: String, w: int, h: int, puzzle_id: String = "") -> Nonogram:
	var grid := PackedByteArray()
	grid.resize(w * h)
	for i in min(s.length(), w * h):
		grid[i] = 1 if s[i] == "1" else 0
	return from_grid(grid, w, h, puzzle_id)


func _compute_clues() -> void:
	row_clues.clear()
	col_clues.clear()
	for y in height:
		row_clues.append(clues_for_line(row_line(y)))
	for x in width:
		col_clues.append(clues_for_line(col_line(x)))
