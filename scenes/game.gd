extends ScreenBase
## The puzzle screen: owns the BoardModel, applies the rules (mistakes, lives,
## hints, auto-cross, win) and drives the overlays.

var model: BoardModel
var board: BoardView
var tool: int = BoardModel.FILLED

var free_hints_left: int = MonetizationConfig.FREE_HINTS_PER_PUZZLE
var _hint_cooldown_until: float = 0.0
var _running := true
var _timer_acc := 0.0
var _completed_lines := {}
var _ad_busy := false

var title_label: Label
var timer_label: Label
var mistakes_label: Label
var progress_label: Label
var hint_btn: Button
var undo_btn: Button
var fill_btn: Button
var cross_btn: Button
var win_panel: Control
var lives_panel: Control
var toast: Label


func build() -> void:
	if model == null:
		_create_model()
	free_hints_left = max(0, MonetizationConfig.FREE_HINTS_PER_PUZZLE - model.hints_used)

	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 10)
	margin.add_child(root)

	# Header
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 10)
	var back := Ui.button("‹", "SecondaryButton", 60)
	back.custom_minimum_size.x = 60
	back.add_theme_font_size_override("font_size", 34)
	back.pressed.connect(on_back)
	back.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	header.add_child(back)
	title_label = Ui.label(_title_text(), "HeaderLabel")
	title_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	title_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	title_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title_label.add_theme_font_size_override("font_size", 30)
	header.add_child(title_label)
	timer_label = Ui.label("0:00", "", HORIZONTAL_ALIGNMENT_RIGHT)
	timer_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	timer_label.custom_minimum_size.x = 110
	timer_label.add_theme_font_size_override("font_size", 30)
	timer_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	header.add_child(timer_label)
	root.add_child(header)

	# Info row
	var info := HBoxContainer.new()
	mistakes_label = Ui.label("", "MutedLabel")
	mistakes_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info.add_child(mistakes_label)
	progress_label = Ui.label("", "MutedLabel", HORIZONTAL_ALIGNMENT_RIGHT)
	progress_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	progress_label.custom_minimum_size.x = 80
	info.add_child(progress_label)
	root.add_child(info)

	# Board
	board = BoardView.new()
	board.model = model
	board.game = self
	board.size_flags_vertical = Control.SIZE_EXPAND_FILL
	board.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	root.add_child(board)

	# Tools
	var tools := HBoxContainer.new()
	tools.add_theme_constant_override("separation", 10)
	fill_btn = Ui.button("■ " + I18n.t("fill"), "ToolButton", 76)
	fill_btn.toggle_mode = true
	fill_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	fill_btn.pressed.connect(func(): _set_tool(BoardModel.FILLED))
	tools.add_child(fill_btn)
	cross_btn = Ui.button("✕ " + I18n.t("cross"), "ToolButton", 76)
	cross_btn.toggle_mode = true
	cross_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cross_btn.pressed.connect(func(): _set_tool(BoardModel.CROSS))
	tools.add_child(cross_btn)
	root.add_child(tools)

	var tools2 := HBoxContainer.new()
	tools2.add_theme_constant_override("separation", 10)
	undo_btn = Ui.button("↶ " + I18n.t("undo"), "SecondaryButton", 72)
	undo_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	undo_btn.pressed.connect(_on_undo)
	tools2.add_child(undo_btn)
	hint_btn = Ui.button("✦ " + I18n.t("hint"), "SecondaryButton", 72)
	hint_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hint_btn.pressed.connect(use_hint)
	tools2.add_child(hint_btn)
	root.add_child(tools2)

	# Overlays
	win_panel = _build_win_panel()
	add_child(win_panel)
	lives_panel = _build_lives_panel()
	add_child(lives_panel)
	toast = Ui.label("", "SmallLabel", HORIZONTAL_ALIGNMENT_CENTER)
	toast.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	toast.anchor_left = 0.1
	toast.anchor_right = 0.9
	toast.offset_top = -200
	toast.offset_bottom = -150
	toast.modulate.a = 0.0
	toast.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(toast)

	_set_tool(tool)
	_refresh_info()
	if model.solved:
		_show_win(false)


func _create_model() -> void:
	var req: Dictionary = Session.request
	var kind := str(req.get("kind", "level"))
	if kind == "resume":
		model = BoardModel.from_dict(SaveData.data.current)
		if model == null:
			kind = "level"
			req = {"kind": "level", "size": 10, "level": SaveData.current_level(10)}
		else:
			return
	match kind:
		"daily":
			var date := SaveData.today()
			var p := NonogramGenerator.generate(10, 10, NonogramGenerator.daily_seed(date), "daily-" + date)
			model = BoardModel.new(p)
			model.kind = "daily"
			model.size = 10
			model.extra = date
		"picture":
			var pic := str(req.get("pic", "heart"))
			var p := Pictures.build(pic)
			if p == null:
				p = Pictures.build("heart")
				pic = "heart"
			model = BoardModel.new(p)
			model.kind = "picture"
			model.size = p.width
			model.extra = pic
		_:
			var size := int(req.get("size", 10))
			var level := int(req.get("level", SaveData.current_level(size)))
			var p := NonogramGenerator.generate(size, size, NonogramGenerator.level_seed(size, level), "lvl-%d-%d" % [size, level])
			model = BoardModel.new(p)
			model.kind = "level"
			model.size = size
			model.level = level


func _title_text() -> String:
	match model.kind:
		"daily":
			return I18n.t("daily")
		"picture":
			return "%d×%d" % [model.puzzle.width, model.puzzle.height]
		_:
			return "%d×%d · " % [model.size, model.size] + I18n.t("level_short", {"n": model.level})


func _process(delta: float) -> void:
	if model == null or model.solved or not _running:
		return
	model.elapsed += delta
	_timer_acc += delta
	if _timer_acc >= 0.25:
		_timer_acc = 0.0
		timer_label.text = I18n.fmt_time(model.elapsed)
		if _hint_cooldown_until > 0.0:
			_refresh_hint_button()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		on_back()
	elif what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_WM_CLOSE_REQUEST:
		save_progress()
		SaveData.save_now()


func on_back() -> void:
	if lives_panel != null and lives_panel.visible:
		return
	save_progress()
	SaveData.save_now()
	if model.kind == "level":
		Session.level_select_size = model.size
	Session.to_menu()


func save_progress() -> void:
	if model == null or model.solved:
		return
	SaveData.set_current(model.to_dict())


# --- rules ----------------------------------------------------------------

func _set_tool(t: int) -> void:
	tool = t
	fill_btn.button_pressed = (t == BoardModel.FILLED)
	cross_btn.button_pressed = (t == BoardModel.CROSS)


## Called by BoardView for every cell touched. Returns false to stop a drag.
func cell_input(i: int, action: int) -> bool:
	if model.solved or model.is_locked(i):
		return true
	var show_mistakes: bool = SaveData.get_setting("show_mistakes", true)
	if action == BoardModel.FILLED and show_mistakes and model.puzzle.solution[i] == 0:
		model.set_cell(i, BoardModel.CROSS, BoardModel.FLAG_ERROR)
		model.mistakes += 1
		Sfx.play("error")
		Sfx.vibrate(80)
		_refresh_info()
		if model.mistakes >= MonetizationConfig.MAX_MISTAKES:
			model.commit_batch()
			_show_lives()
		return false
	model.set_cell(i, action, 0)
	match action:
		BoardModel.FILLED:
			Sfx.play("tap", -4.0)
			Sfx.vibrate(10)
		BoardModel.CROSS:
			Sfx.play("cross", -8.0)
		_:
			Sfx.play("cross", -12.0)
	return true


## Called by BoardView when a tap / drag finishes.
func end_batch() -> void:
	if model.solved:
		return
	_auto_cross()
	model.commit_batch()
	_refresh_info()
	if model.check_solved():
		_on_solved()
	else:
		_check_new_lines()


func _auto_cross() -> void:
	if not SaveData.get_setting("auto_cross", true):
		return
	var w := model.puzzle.width
	var h := model.puzzle.height
	for y in h:
		if model.row_complete(y):
			for x in w:
				var i := y * w + x
				if model.states[i] == BoardModel.UNKNOWN:
					model.set_cell(i, BoardModel.CROSS, 0)
	for x in w:
		if model.col_complete(x):
			for y in h:
				var i := y * w + x
				if model.states[i] == BoardModel.UNKNOWN:
					model.set_cell(i, BoardModel.CROSS, 0)


func _check_new_lines() -> void:
	var played := false
	for y in model.puzzle.height:
		var key := "r%d" % y
		if model.row_complete(y):
			if not _completed_lines.has(key):
				_completed_lines[key] = true
				played = true
		else:
			_completed_lines.erase(key)
	for x in model.puzzle.width:
		var key := "c%d" % x
		if model.col_complete(x):
			if not _completed_lines.has(key):
				_completed_lines[key] = true
				played = true
		else:
			_completed_lines.erase(key)
	if played:
		Sfx.play("line", -6.0)


func _on_undo() -> void:
	if model.solved or not model.can_undo():
		return
	model.undo()
	Sfx.play("cross", -10.0)
	_refresh_info()
	board.queue_redraw()


func _refresh_info() -> void:
	if mistakes_label == null:
		return
	if SaveData.get_setting("show_mistakes", true):
		mistakes_label.text = I18n.t("mistakes", {"n": model.mistakes, "max": MonetizationConfig.MAX_MISTAKES})
	else:
		mistakes_label.text = ""
	progress_label.text = "%d%%" % int(round(model.filled_progress() * 100.0))
	undo_btn.disabled = not model.can_undo()
	_refresh_hint_button()
	board.queue_redraw()


func _refresh_hint_button() -> void:
	if hint_btn == null:
		return
	if free_hints_left > 0:
		hint_btn.text = "✦ " + I18n.t("hint_n", {"n": free_hints_left})
	elif SaveData.hints_bank() > 0:
		hint_btn.text = "✦ " + I18n.t("hint_n", {"n": SaveData.hints_bank()})
	elif Ads.available:
		hint_btn.text = "▶ " + I18n.t("hint_ad")
	else:
		var now := Time.get_ticks_msec() / 1000.0
		if now < _hint_cooldown_until:
			hint_btn.text = I18n.t("hint_cooldown", {"n": int(ceil(_hint_cooldown_until - now))})
		else:
			_hint_cooldown_until = 0.0
			hint_btn.text = "✦ " + I18n.t("hint")


# --- hints ----------------------------------------------------------------

func use_hint() -> void:
	if model.solved or _ad_busy:
		return
	if free_hints_left > 0:
		free_hints_left -= 1
		_apply_hint()
		return
	if SaveData.take_hint():
		_apply_hint()
		return
	if Ads.available:
		if not Ads.rewarded_ready():
			show_toast(I18n.t("ad_not_ready"))
			Ads.show_rewarded()  # triggers a reload
			return
		_ad_busy = true
		_running = false
		Ads.show_rewarded()
		var ok: bool = await Ads.rewarded_result
		_ad_busy = false
		_running = true
		if ok:
			_apply_hint()
		return
	# No ad SDK: free hint with a cooldown.
	var now := Time.get_ticks_msec() / 1000.0
	if now < _hint_cooldown_until:
		show_toast(I18n.t("hint_cooldown", {"n": int(ceil(_hint_cooldown_until - now))}))
		return
	_hint_cooldown_until = now + MonetizationConfig.HINT_COOLDOWN_NO_ADS
	_apply_hint()


func _apply_hint() -> void:
	var w := model.puzzle.width
	var candidates := PackedInt32Array()
	for i in NonogramSolver.deducible_cells(model.puzzle, model.solver_state()):
		if not _cell_correct(i):
			candidates.append(i)
	if candidates.is_empty():
		for i in model.states.size():
			if not _cell_correct(i):
				candidates.append(i)
	if candidates.is_empty():
		return
	var i: int = candidates[randi() % candidates.size()]
	model.begin_batch()
	var want := BoardModel.FILLED if model.puzzle.solution[i] == 1 else BoardModel.CROSS
	model.set_cell(i, want, BoardModel.FLAG_HINT)
	model.hints_used += 1
	board.highlight = Vector2i(i % w, i / w)
	Sfx.play("line", -4.0)
	end_batch()
	get_tree().create_timer(0.6).timeout.connect(func():
		if is_instance_valid(board):
			board.highlight = Vector2i(-1, -1)
			board.queue_redraw())


func _cell_correct(i: int) -> bool:
	var want_filled := model.puzzle.solution[i] == 1
	if want_filled:
		return model.states[i] == BoardModel.FILLED
	return model.states[i] == BoardModel.CROSS


# --- lives ----------------------------------------------------------------

func _build_lives_panel() -> Control:
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	center.visible = false
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.45)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	center.add_child(dim)
	var card := PanelContainer.new()
	card.theme_type_variation = "OverlayCard"
	card.custom_minimum_size.x = 560
	center.add_child(card)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 14)
	card.add_child(v)
	v.add_child(Ui.label(I18n.t("out_of_lives"), "HeaderLabel", HORIZONTAL_ALIGNMENT_CENTER))
	v.add_child(Ui.label(I18n.t("out_of_lives_text"), "MutedLabel", HORIZONTAL_ALIGNMENT_CENTER))
	v.add_child(Ui.spacer(4))
	var cont := Ui.button(I18n.t("watch_ad_continue") if Ads.available else I18n.t("continue_free"))
	cont.pressed.connect(_on_lives_continue)
	v.add_child(cont)
	var restart := Ui.button(I18n.t("restart"), "SecondaryButton")
	restart.pressed.connect(_restart)
	v.add_child(restart)
	var menu := Ui.button(I18n.t("to_menu"), "SecondaryButton")
	menu.pressed.connect(func():
		lives_panel.visible = false
		on_back())
	v.add_child(menu)
	return center


func _show_lives() -> void:
	_running = false
	lives_panel.visible = true
	board.queue_redraw()


func _on_lives_continue() -> void:
	if _ad_busy:
		return
	if Ads.available:
		if not Ads.rewarded_ready():
			show_toast(I18n.t("ad_not_ready"))
			Ads.show_rewarded()
			return
		_ad_busy = true
		Ads.show_rewarded()
		var ok: bool = await Ads.rewarded_result
		_ad_busy = false
		if not ok:
			return
	model.mistakes = 0
	lives_panel.visible = false
	_running = true
	_refresh_info()


func _restart() -> void:
	var p := model.puzzle
	model.setup(p)
	_completed_lines.clear()
	free_hints_left = MonetizationConfig.FREE_HINTS_PER_PUZZLE
	lives_panel.visible = false
	win_panel.visible = false
	_running = true
	timer_label.text = "0:00"
	_refresh_info()


# --- win ------------------------------------------------------------------

var _win_title: Label
var _win_stars: Label
var _win_time: Label
var _win_record: Label
var _win_pic: TextureRect
var _win_next: Button


func _build_win_panel() -> Control:
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	center.visible = false
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.45)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	center.add_child(dim)
	var card := PanelContainer.new()
	card.theme_type_variation = "OverlayCard"
	card.custom_minimum_size.x = 560
	center.add_child(card)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	card.add_child(v)
	_win_title = Ui.label(I18n.t("solved_title"), "TitleLabel", HORIZONTAL_ALIGNMENT_CENTER)
	v.add_child(_win_title)
	_win_pic = TextureRect.new()
	_win_pic.custom_minimum_size = Vector2(200, 200)
	_win_pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_win_pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_win_pic.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	v.add_child(_win_pic)
	_win_stars = Ui.label("", "BigLabel", HORIZONTAL_ALIGNMENT_CENTER)
	_win_stars.add_theme_color_override("font_color", Ui.C.accent)
	v.add_child(_win_stars)
	_win_time = Ui.label("", "", HORIZONTAL_ALIGNMENT_CENTER)
	v.add_child(_win_time)
	_win_record = Ui.label(I18n.t("new_record"), "MutedLabel", HORIZONTAL_ALIGNMENT_CENTER)
	_win_record.add_theme_color_override("font_color", Ui.C.success)
	_win_record.visible = false
	v.add_child(_win_record)
	v.add_child(Ui.spacer(4))
	_win_next = Ui.button(I18n.t("next"))
	_win_next.pressed.connect(_on_next)
	v.add_child(_win_next)
	var replay := Ui.button(I18n.t("replay"), "SecondaryButton")
	replay.pressed.connect(_restart)
	v.add_child(replay)
	var menu := Ui.button(I18n.t("to_menu"), "SecondaryButton")
	menu.pressed.connect(func():
		SaveData.save_now()
		if model.kind == "level":
			Session.level_select_size = model.size
		Session.to_menu())
	v.add_child(menu)
	return center


func _on_solved() -> void:
	model.solved = true
	_running = false
	# Fill the remaining unknowns with crosses for a clean final picture.
	for i in model.states.size():
		if model.states[i] == BoardModel.UNKNOWN:
			model.states[i] = BoardModel.CROSS
	var stars := model.stars()
	var record := false
	match model.kind:
		"level":
			record = SaveData.record_level(model.size, model.level, stars, model.elapsed)
		"daily":
			SaveData.record_daily(model.extra, stars, model.elapsed)
		"picture":
			SaveData.record_picture(model.extra, stars, model.elapsed, model.size)
	SaveData.clear_current()
	SaveData.save_now()
	Sfx.play("win")
	Sfx.vibrate(40)
	_show_win(record)


func _show_win(record: bool) -> void:
	timer_label.text = I18n.fmt_time(model.elapsed)
	_win_stars.text = Ui.stars_text(model.stars())
	_win_time.text = I18n.t("time_label") + ": " + I18n.fmt_time(model.elapsed)
	_win_record.visible = record
	_win_pic.texture = _solution_texture()
	if model.kind == "picture":
		_win_title.text = I18n.t("pic_" + model.extra)
	_win_next.visible = model.kind != "daily"
	win_panel.visible = true
	board.queue_redraw()


func _solution_texture() -> ImageTexture:
	var w := model.puzzle.width
	var h := model.puzzle.height
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	for y in h:
		for x in w:
			img.set_pixel(x, y, Ui.C.cell if model.puzzle.solution[y * w + x] == 1 else Color(0, 0, 0, 0))
	return ImageTexture.create_from_image(img)


func _on_next() -> void:
	if _ad_busy:
		return
	if Ads.maybe_show_interstitial():
		_ad_busy = true
		await Ads.interstitial_closed
		_ad_busy = false
	match model.kind:
		"level":
			Session.start_level(model.size, model.level + 1)
		"picture":
			var next_id := _next_unsolved_picture()
			if next_id == "":
				Session.go("res://scenes/gallery.tscn")
			else:
				Session.start_picture(next_id)
		_:
			Session.to_menu()


func _next_unsolved_picture() -> String:
	var found_current := false
	for d in Pictures.LIST:
		if found_current and not SaveData.is_picture_solved(d.id):
			return d.id
		if d.id == model.extra:
			found_current = true
	for d in Pictures.LIST:
		if not SaveData.is_picture_solved(d.id):
			return d.id
	return ""


# --- misc -----------------------------------------------------------------

func show_toast(text: String) -> void:
	toast.text = text
	toast.modulate.a = 1.0
	var tw := create_tween()
	tw.tween_interval(1.6)
	tw.tween_property(toast, "modulate:a", 0.0, 0.4)
