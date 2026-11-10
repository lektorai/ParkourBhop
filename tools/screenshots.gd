extends SceneTree
## Captures store screenshots of every screen into store/screenshots/.
## Needs a display (use xvfb-run on CI/sandbox):
##   xvfb-run -a godot --path . --rendering-driver opengl3 --script tools/screenshots.gd
## Pass locale via env SCREENSHOT_LOCALE=ru|en (default ru).

var _step := 0
var _frames := 0
var _plan: Array = []
var _out_dir := "res://store/screenshots"


var _setup_done := false


func _setup() -> void:
	var lang := OS.get_environment("SCREENSHOT_LOCALE")
	if lang == "":
		lang = "ru"
	root.get_node("I18n").set_locale(lang)
	_out_dir = "res://store/screenshots/" + lang
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_out_dir))
	var sd = root.get_node("SaveData")
	# Demo progress so the screens look lived-in.
	sd.data.progress = {"5": 7, "10": 4, "15": 2}
	for lvl in range(1, 7):
		sd.data.levels["5-%d" % lvl] = {"stars": 3 if lvl % 2 == 1 else 2, "time": 40 + lvl * 7}
	for lvl in range(1, 4):
		sd.data.levels["10-%d" % lvl] = {"stars": 3, "time": 180 + lvl * 30}
	sd.data.levels["15-1"] = {"stars": 2, "time": 600}
	for pic in ["heart", "star", "house", "cat", "tree", "cup"]:
		sd.data.gallery[pic] = {"stars": 3, "time": 120}
	sd.data.stats = {"solved_total": 16, "time_total": 5400.0, "best": {"5": 38.0, "10": 210.0, "15": 600.0}, "stars_total": 41}
	sd.data.daily = {"last_date": sd.yesterday(), "streak": 5, "best_streak": 9, "solved_dates": {}}
	sd.data.current = {}
	var session = root.get_node("Session")
	_plan = [
		{"file": "01_menu.png", "scene": "res://scenes/main_menu.tscn"},
		{"file": "02_game_10.png", "scene": "res://scenes/game.tscn", "request": {"kind": "picture", "pic": "cat"}, "progress": 0.55},
		{"file": "03_game_15.png", "scene": "res://scenes/game.tscn", "request": {"kind": "level", "size": 15, "level": 2}, "progress": 0.35},
		{"file": "04_win.png", "scene": "res://scenes/game.tscn", "request": {"kind": "picture", "pic": "heart"}, "progress": 1.0},
		{"file": "05_gallery.png", "scene": "res://scenes/gallery.tscn"},
		{"file": "06_levels.png", "scene": "res://scenes/level_select.tscn", "size": 10},
		{"file": "07_dark.png", "scene": "res://scenes/game.tscn", "request": {"kind": "picture", "pic": "owl15"}, "progress": 0.6, "dark": true},
		{"file": "08_settings.png", "scene": "res://scenes/settings.tscn"},
		{"file": "09_stats.png", "scene": "res://scenes/stats.tscn"},
	]
	session.level_select_size = 10


func _process(_delta: float) -> bool:
	_frames += 1
	if not _setup_done:
		_setup_done = true
		_setup()
	if _step >= _plan.size():
		return true
	var item: Dictionary = _plan[_step]
	if _frames == 1:
		_load(item)
		return false
	if _frames < 6:
		return false
	# Capture
	var img := root.get_viewport().get_texture().get_image()
	var path := ProjectSettings.globalize_path(_out_dir + "/" + item.file)
	img.save_png(path)
	print("saved ", path, " ", img.get_size())
	_step += 1
	_frames = 0
	if _step >= _plan.size():
		root.get_node("SaveData").data = root.get_node("SaveData")._defaults()
		return true
	return false


func _load(item: Dictionary) -> void:
	var ui = root.get_node("Ui")
	if ui.dark != bool(item.get("dark", false)):
		ui.dark = bool(item.get("dark", false))
		ui.rebuild()
	var session = root.get_node("Session")
	if item.has("request"):
		session.request = item.request
	if item.has("size"):
		session.level_select_size = item.size
	if current_scene != null:
		current_scene.queue_free()
	var scene = (load(item.scene) as PackedScene).instantiate()
	root.add_child(scene)
	current_scene = scene
	if item.has("progress") and scene.get("model") != null:
		_fill_progress(scene, float(item.progress))


func _fill_progress(game, fraction: float) -> void:
	var m = game.model
	var p = m.puzzle
	var total: int = p.solution.size()
	var count := int(total * fraction)
	# Fill cells in reading order, including correct crosses, to look natural.
	m.begin_batch()
	for i in count:
		if p.solution[i] == 1:
			m.set_cell(i, BoardModel.FILLED, 0)
		elif i % 3 != 0:
			m.set_cell(i, BoardModel.CROSS, 0)
	m.elapsed = 47.0 + fraction * 300.0
	if fraction >= 1.0:
		for i in total:
			if p.solution[i] == 1:
				m.set_cell(i, BoardModel.FILLED, 0)
		m.commit_batch()
		game.end_batch()
	else:
		m.commit_batch()
		game._refresh_info()
