extends ScreenBase

const COLS := 5
const MIN_SHOWN := 30


func build() -> void:
	var size: int = Session.level_select_size
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 14)
	margin.add_child(v)
	v.add_child(make_header(I18n.t("size_%d" % size), on_back))

	var cur := SaveData.current_level(size)
	var play := Ui.button("▶ " + I18n.t("play") + " · " + I18n.t("level_n", {"n": cur}), "", 84)
	play.pressed.connect(func(): Session.start_level(size, cur))
	v.add_child(play)

	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(scroll)
	var grid := GridContainer.new()
	grid.columns = COLS
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	scroll.add_child(grid)

	var shown := max(MIN_SHOWN, cur + 9)
	shown = int(ceil(float(shown) / COLS) * COLS)
	for lvl in range(1, shown + 1):
		var b := Ui.button("", "CardButton", 100)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var res := SaveData.level_result(size, lvl)
		if not res.is_empty():
			b.text = "%d\n%s" % [lvl, Ui.stars_text(int(res.get("stars", 0)))]
		elif lvl == cur:
			b.text = "%d\n▶" % lvl
		else:
			b.text = "%d\n·" % lvl
			b.disabled = true
		b.pressed.connect(func(): Session.start_level(size, lvl))
		grid.add_child(b)
