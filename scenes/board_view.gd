class_name BoardView
extends Control
## Draws the nonogram grid + clues and turns touches into cell actions.
## All game rules live in game.gd (cell_input / end_batch); this control only
## decides *which* cells are affected by a tap or a drag.

var model: BoardModel
var game: Node

var cs := 0.0
var ox := 0.0
var oy := 0.0
var left_w := 0.0
var top_h := 0.0
var font: Font

var _drag_active := false
var _drag_action := 0
var _drag_axis := -1
var _start := Vector2i(-1, -1)
var _last := Vector2i(-1, -1)
var _touch_index := -1
var highlight := Vector2i(-1, -1)


func _ready() -> void:
	font = get_theme_default_font()
	mouse_filter = Control.MOUSE_FILTER_STOP
	resized.connect(queue_redraw)


func _layout() -> void:
	if model == null:
		return
	var w := model.puzzle.width
	var h := model.puzzle.height
	var mr := model.puzzle.max_row_clue_len()
	var mc := model.puzzle.max_col_clue_len()
	var unit := 0.62
	var cs_w := size.x / (w + mr * unit + 0.4)
	var cs_h := size.y / (h + mc * unit + 0.4)
	cs = floor(min(cs_w, cs_h))
	left_w = ceil(mr * unit * cs + 8)
	top_h = ceil(mc * unit * cs + 8)
	var total_w := left_w + cs * w
	var total_h := top_h + cs * h
	ox = floor((size.x - total_w) / 2.0)
	oy = floor((size.y - total_h) / 2.0)


func cell_at(pos: Vector2, clamp_to_grid: bool = false) -> Vector2i:
	if model == null or cs <= 0:
		return Vector2i(-1, -1)
	var x := int(floor((pos.x - ox - left_w) / cs))
	var y := int(floor((pos.y - oy - top_h) / cs))
	if clamp_to_grid:
		x = clampi(x, 0, model.puzzle.width - 1)
		y = clampi(y, 0, model.puzzle.height - 1)
	if x < 0 or y < 0 or x >= model.puzzle.width or y >= model.puzzle.height:
		return Vector2i(-1, -1)
	return Vector2i(x, y)


func _draw() -> void:
	if model == null:
		return
	_layout()
	var C: Dictionary = Ui.C
	var w := model.puzzle.width
	var h := model.puzzle.height
	var total_w := left_w + cs * w
	var total_h := top_h + cs * h
	var gx := ox + left_w
	var gy := oy + top_h

	# Backgrounds
	var sb := StyleBoxFlat.new()
	sb.bg_color = C.board_bg
	sb.set_corner_radius_all(12)
	draw_style_box(sb, Rect2(ox, oy, total_w, total_h))
	draw_rect(Rect2(ox, gy, left_w, cs * h), C.clue_bg)
	draw_rect(Rect2(gx, oy, cs * w, top_h), C.clue_bg)

	# Highlight of the active row / column
	if highlight.x >= 0 and not model.solved:
		draw_rect(Rect2(ox, gy + highlight.y * cs, total_w, cs), C.highlight)
		draw_rect(Rect2(gx + highlight.x * cs, oy, cs, total_h), C.highlight)

	# Cells
	var pad := max(1.0, cs * 0.08)
	var cross_w := max(2.0, cs * 0.09)
	for y in h:
		for x in w:
			var i := y * w + x
			var st := model.states[i]
			var fl := model.flags[i]
			var r := Rect2(gx + x * cs + pad, gy + y * cs + pad, cs - pad * 2, cs - pad * 2)
			if st == BoardModel.FILLED:
				var col: Color = C.cell_hint if (fl & BoardModel.FLAG_HINT) else C.cell
				var csb := StyleBoxFlat.new()
				csb.bg_color = col
				csb.set_corner_radius_all(int(max(2.0, cs * 0.12)))
				draw_style_box(csb, r)
			elif st == BoardModel.CROSS:
				var col2: Color = C.danger if (fl & BoardModel.FLAG_ERROR) else (C.cell_hint if (fl & BoardModel.FLAG_HINT) else C.cross)
				var inset := cs * 0.28
				var a := Vector2(gx + x * cs + inset, gy + y * cs + inset)
				var b := Vector2(gx + (x + 1) * cs - inset, gy + (y + 1) * cs - inset)
				draw_line(a, b, col2, cross_w, true)
				draw_line(Vector2(a.x, b.y), Vector2(b.x, a.y), col2, cross_w, true)

	# Grid lines
	for x in w + 1:
		var bold := (x % 5 == 0)
		var lx := gx + x * cs
		draw_line(Vector2(lx, oy), Vector2(lx, gy + cs * h), C.grid_bold if bold else C.grid, 3.0 if bold else 1.0)
	for y in h + 1:
		var bold := (y % 5 == 0)
		var ly := gy + y * cs
		draw_line(Vector2(ox, ly), Vector2(gx + cs * w, ly), C.grid_bold if bold else C.grid, 3.0 if bold else 1.0)

	# Clues
	var fs := int(max(10.0, cs * 0.46))
	var unit := cs * 0.62
	for y in h:
		var clues: PackedInt32Array = model.puzzle.row_clues[y]
		var done := model.row_complete(y)
		var col: Color = C.clue_done if done else C.text
		var n := clues.size()
		for k in n:
			var txt := str(clues[k])
			var cx := gx - 4 - (n - 1 - k) * unit - unit
			var baseline := gy + y * cs + cs * 0.5 + fs * 0.36
			draw_string(font, Vector2(cx, baseline), txt, HORIZONTAL_ALIGNMENT_CENTER, unit, fs, col)
	for x in w:
		var clues: PackedInt32Array = model.puzzle.col_clues[x]
		var done := model.col_complete(x)
		var col: Color = C.clue_done if done else C.text
		var n := clues.size()
		for k in n:
			var txt := str(clues[k])
			var cy := gy - 4 - (n - 1 - k) * unit
			var baseline := cy - unit * 0.5 + fs * 0.36
			draw_string(font, Vector2(gx + x * cs, baseline), txt, HORIZONTAL_ALIGNMENT_CENTER, cs, fs, col)


# --- input ----------------------------------------------------------------

func _gui_input(event: InputEvent) -> void:
	if model == null or model.solved or game == null:
		return
	if event is InputEventScreenTouch:
		if event.pressed:
			if _drag_active:
				return
			var c := cell_at(event.position)
			if c.x < 0:
				return
			_touch_index = event.index
			_drag_active = true
			_start = c
			_last = c
			_drag_axis = -1
			var st := model.get_state(c.x, c.y)
			_drag_action = 0 if st == game.tool else game.tool
			highlight = c
			model.begin_batch()
			if not _apply(c):
				_end_drag()
			accept_event()
		elif _drag_active and event.index == _touch_index:
			_end_drag()
			accept_event()
	elif event is InputEventScreenDrag and _drag_active and event.index == _touch_index:
		var c := cell_at(event.position, true)
		if c.x < 0 or c == _last:
			return
		if _drag_axis == -1:
			var d := c - _start
			if d == Vector2i.ZERO:
				return
			_drag_axis = 0 if abs(d.x) >= abs(d.y) else 1
		var target := Vector2i(c.x, _start.y) if _drag_axis == 0 else Vector2i(_start.x, c.y)
		if target == _last:
			return
		var step := Vector2i(signi(target.x - _last.x), signi(target.y - _last.y))
		var cur := _last
		while cur != target:
			cur += step
			highlight = cur
			if not _apply(cur):
				_last = cur
				_end_drag()
				return
		_last = target
		accept_event()


func _apply(c: Vector2i) -> bool:
	var cont: bool = game.cell_input(model.idx(c.x, c.y), _drag_action)
	queue_redraw()
	return cont


func _end_drag() -> void:
	_drag_active = false
	_touch_index = -1
	highlight = Vector2i(-1, -1)
	game.end_batch()
	queue_redraw()


## Test / automation helper: behaves like a single tap with the given tool.
func simulate_tap(x: int, y: int, tool: int) -> void:
	var saved_tool: int = game.tool
	game.tool = tool
	var st := model.get_state(x, y)
	var action := 0 if st == tool else tool
	model.begin_batch()
	game.cell_input(model.idx(x, y), action)
	game.end_batch()
	game.tool = saved_tool
	queue_redraw()
