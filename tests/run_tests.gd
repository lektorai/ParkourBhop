extends SceneTree
## Headless test runner: godot --headless --path . --script tests/run_tests.gd

var _fails := 0
var _checks := 0


var _started := false


func _process(_delta: float) -> bool:
	if _started:
		return false
	_started = true
	_run_all()
	return true


func _run_all() -> void:
	var t0 := Time.get_ticks_msec()
	_test_clues()
	_test_line_solver()
	_test_solver_and_generator()
	_test_pictures()
	_test_board_model()
	_test_save_roundtrip()
	_test_i18n()
	_test_scenes_load()
	var dt := Time.get_ticks_msec() - t0
	print("\n%d checks, %d failures, %d ms" % [_checks, _fails, dt])
	quit(1 if _fails > 0 else 0)


func check(cond: bool, msg: String) -> void:
	_checks += 1
	if not cond:
		_fails += 1
		push_error("FAIL: " + msg)
		print("FAIL: " + msg)


func _line(s: String) -> PackedByteArray:
	var out := PackedByteArray()
	for ch in s:
		out.append({"?": 0, "#": 1, ".": 2}[ch])
	return out


func _str(a: PackedByteArray) -> String:
	var s := ""
	for v in a:
		s += "?#."[v]
	return s


func _test_clues() -> void:
	check(Nonogram.clues_for_line(_line("##.#.###")) == PackedInt32Array([2, 1, 3]), "clues basic")
	check(Nonogram.clues_for_line(_line("........")) == PackedInt32Array([0]), "clues empty")
	check(Nonogram.clues_for_line(_line("########")) == PackedInt32Array([8]), "clues full")


func _test_line_solver() -> void:
	# Full line
	check(_str(LineSolver.solve_line(_line("?????"), PackedInt32Array([5]))) == "#####", "full line")
	# Overlap logic: 4 in 5 → middle three filled
	check(_str(LineSolver.solve_line(_line("?????"), PackedInt32Array([4]))) == "?###?", "overlap 4/5")
	# Empty clue
	check(_str(LineSolver.solve_line(_line("???"), PackedInt32Array([0]))) == "...", "zero clue")
	# Known cells propagate
	check(_str(LineSolver.solve_line(_line("#????"), PackedInt32Array([2]))) == "##...", "anchored block")
	# 1 1 in 3 cells
	check(_str(LineSolver.solve_line(_line("???"), PackedInt32Array([1, 1]))) == "#.#", "1 1 in 3")
	# Contradiction
	check(LineSolver.solve_line(_line("#.#"), PackedInt32Array([3])).is_empty(), "contradiction detected")
	# Nothing deducible
	check(_str(LineSolver.solve_line(_line("??????????"), PackedInt32Array([1]))) == "??????????", "nothing deducible")
	# Cross forces placement
	check(_str(LineSolver.solve_line(_line("??.??"), PackedInt32Array([2]))) == "??.??", "ambiguous both sides")
	check(_str(LineSolver.solve_line(_line("?.???"), PackedInt32Array([2]))) == "..?#?", "cross forces placement")
	# Multiple blocks with partial info
	check(_str(LineSolver.solve_line(_line("??#??????#"), PackedInt32Array([3, 2]))) == "??#??...##", "partial multi")
	check(_str(LineSolver.solve_line(_line("?#?.?#??"), PackedInt32Array([2, 3]))) == "?#?.?##?", "multi anchored")


func _test_solver_and_generator() -> void:
	var p := Nonogram.from_strings([
		"####",
		"#..#",
		"#..#",
		"####",
	])
	var res := NonogramSolver.solve(p)
	check(res.solved, "small puzzle solved")
	check(res.grid == PackedByteArray([1, 1, 1, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 1, 1, 1]), "small puzzle grid")

	for size in [5, 10, 15]:
		var t0 := Time.get_ticks_msec()
		var ok := 0
		var n := 12 if size < 15 else 8
		var total_passes := 0
		for lvl in range(1, n + 1):
			var seed := NonogramGenerator.level_seed(size, lvl)
			var g := NonogramGenerator.generate(size, size, seed, "lvl-%d-%d" % [size, lvl])
			check(g != null, "generator returns puzzle %dx%d #%d" % [size, size, lvl])
			if g == null:
				continue
			var r := NonogramSolver.solve(g)
			if r.solved:
				ok += 1
			total_passes += int(r.passes)
			# Determinism
			var g2 := NonogramGenerator.generate(size, size, seed)
			check(g2.solution == g.solution, "generator deterministic %d/%d" % [size, lvl])
		var dt := Time.get_ticks_msec() - t0
		check(ok == n, "all generated %dx%d puzzles solvable (%d/%d)" % [size, size, ok, n])
		print("gen %dx%d: %d puzzles in %d ms, avg passes %.1f" % [size, size, n, dt, float(total_passes) / n])

	# Daily seed stable and different per day
	check(NonogramGenerator.daily_seed("2026-11-10") == NonogramGenerator.daily_seed("2026-11-10"), "daily seed stable")
	check(NonogramGenerator.daily_seed("2026-11-10") != NonogramGenerator.daily_seed("2026-11-11"), "daily seed varies")


func _test_pictures() -> void:
	var ids := {}
	for d in Pictures.LIST:
		check(not ids.has(d.id), "picture id unique: " + d.id)
		ids[d.id] = true
		var p := Pictures.build(d.id)
		check(p != null, "picture builds: " + d.id)
		if p == null:
			continue
		var r := NonogramSolver.solve(p)
		check(r.solved, "picture line-solvable: %s (unknown cells left: %d)" % [d.id, _count_unknown(r.grid)])
		check(p.filled_count() > p.width * p.height / 5, "picture not too sparse: " + d.id)


func _count_unknown(g: PackedByteArray) -> int:
	var c := 0
	for v in g:
		if v == 0:
			c += 1
	return c


func _test_board_model() -> void:
	var p := Pictures.build("heart")
	var m := BoardModel.new(p)
	m.begin_batch()
	m.set_cell(0, BoardModel.FILLED)
	m.set_cell(1, BoardModel.CROSS)
	m.commit_batch()
	check(m.get_state(0, 0) == BoardModel.FILLED, "set cell filled")
	check(m.can_undo(), "can undo")
	m.undo()
	check(m.get_state(0, 0) == BoardModel.UNKNOWN and m.get_state(1, 0) == BoardModel.UNKNOWN, "undo restores batch")
	# Solve it
	m.begin_batch()
	for i in p.solution.size():
		if p.solution[i] == 1:
			m.set_cell(i, BoardModel.FILLED)
	m.commit_batch()
	check(m.check_solved(), "board solved when all filled cells placed")
	check(m.stars() == 3, "3 stars without penalties")
	m.mistakes = 1
	check(m.stars() == 2, "2 stars with 1 mistake")
	m.hints_used = 3
	check(m.stars() == 1, "1 star with many penalties")
	# Hints: deducible cells from empty state must exist
	var ded := NonogramSolver.deducible_cells(p, BoardModel.new(p).solver_state())
	check(ded.size() > 0, "deducible cells exist from blank state")
	# Round trip
	var d := m.to_dict()
	var m2 := BoardModel.from_dict(d)
	check(m2 != null and m2.states == m.states and m2.puzzle.solution == p.solution, "board model dict roundtrip")
	check(m2.mistakes == 1 and m2.hints_used == 3, "board model counters roundtrip")


func _test_save_roundtrip() -> void:
	var sd = root.get_node_or_null("SaveData")
	check(sd != null, "SaveData autoload present")
	if sd == null:
		return
	sd.data.stats.solved_total = 42
	sd.set_setting("sound", false)
	sd.save_now()
	sd.load_from_disk()
	check(int(sd.data.stats.solved_total) == 42, "save/load persists stats")
	check(sd.get_setting("sound") == false, "save/load persists settings")
	sd.data.stats.solved_total = 0
	sd.set_setting("sound", true)
	sd.save_now()


func _test_i18n() -> void:
	var i18n = root.get_node_or_null("I18n")
	check(i18n != null, "I18n autoload present")
	if i18n == null:
		return
	i18n.set_locale("ru")
	check(i18n.t("play") == "Играть", "ru translation")
	i18n.set_locale("en")
	check(i18n.t("play") == "Play", "en translation")
	# Every key present in both locales
	for key in i18n.STRINGS.ru.keys():
		check(i18n.STRINGS.en.has(key), "en has key " + key)
	for key in i18n.STRINGS.en.keys():
		check(i18n.STRINGS.ru.has(key), "ru has key " + key)
	for d in Pictures.LIST:
		check(i18n.STRINGS.ru.has("pic_" + d.id), "ru title for picture " + d.id)
	i18n.set_locale("ru")


func _test_scenes_load() -> void:
	for path in [
		"res://scenes/main_menu.tscn",
		"res://scenes/game.tscn",
		"res://scenes/level_select.tscn",
		"res://scenes/gallery.tscn",
		"res://scenes/settings.tscn",
		"res://scenes/stats.tscn",
	]:
		var ps = load(path)
		check(ps != null and ps is PackedScene, "scene loads: " + path)
	# Smoke test: play a level through the Game scene logic.
	var session = root.get_node_or_null("Session")
	session.request = {"kind": "picture", "pic": "star"}
	var game = (load("res://scenes/game.tscn") as PackedScene).instantiate()
	root.add_child(game)
	check(game.model != null, "game created model from session request")
	var p: Nonogram = game.model.puzzle
	# Mistake handling: filling an empty cell must register a mistake.
	var empty_idx := -1
	var filled_idx := -1
	for i in p.solution.size():
		if p.solution[i] == 0 and empty_idx < 0:
			empty_idx = i
		if p.solution[i] == 1 and filled_idx < 0:
			filled_idx = i
	game.board.simulate_tap(empty_idx % p.width, empty_idx / p.width, BoardModel.FILLED)
	check(game.model.mistakes == 1, "wrong fill counted as mistake")
	check(game.model.states[empty_idx] == BoardModel.CROSS, "wrong fill converted to cross")
	game.board.simulate_tap(filled_idx % p.width, filled_idx / p.width, BoardModel.FILLED)
	check(game.model.states[filled_idx] == BoardModel.FILLED, "correct fill accepted")
	game.use_hint()
	check(game.model.hints_used == 1, "hint consumed")
	# Fill the rest
	for i in p.solution.size():
		if p.solution[i] == 1 and game.model.states[i] != BoardModel.FILLED:
			game.board.simulate_tap(i % p.width, i / p.width, BoardModel.FILLED)
	check(game.model.solved, "game detects win")
	check(game.win_panel.visible, "win panel shown")
	var sd = root.get_node_or_null("SaveData")
	check(sd.is_picture_solved("star"), "picture marked solved in save")
	check(sd.data.current.is_empty(), "no resume state after win")
	game.queue_free()
	# Resume flow: start a level, mark a cell, leave, come back.
	session.request = {"kind": "level", "size": 5, "level": 1}
	var g2 = (load("res://scenes/game.tscn") as PackedScene).instantiate()
	root.add_child(g2)
	var p2: Nonogram = g2.model.puzzle
	var fi := -1
	for i in p2.solution.size():
		if p2.solution[i] == 1:
			fi = i
			break
	g2.board.simulate_tap(fi % p2.width, fi / p2.width, BoardModel.FILLED)
	g2.save_progress()
	check(not sd.data.current.is_empty(), "resume state saved")
	g2.queue_free()
	session.request = {"kind": "resume"}
	var g3 = (load("res://scenes/game.tscn") as PackedScene).instantiate()
	root.add_child(g3)
	check(g3.model.states[fi] == BoardModel.FILLED, "resume restores marks")
	check(g3.model.puzzle.solution == p2.solution, "resume restores puzzle")
	g3.queue_free()
	sd.clear_current()
	sd.save_now()
