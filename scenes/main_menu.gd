extends ScreenBase


func build() -> void:
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	margin.add_child(scroll)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 14)
	scroll.add_child(v)

	v.add_child(Ui.spacer(16))
	var logo := _logo()
	v.add_child(logo)
	v.add_child(Ui.label(I18n.t("app_title"), "TitleLabel", HORIZONTAL_ALIGNMENT_CENTER))
	v.add_child(Ui.label(I18n.t("app_subtitle"), "MutedLabel", HORIZONTAL_ALIGNMENT_CENTER))
	v.add_child(Ui.spacer(8))

	if not SaveData.data.current.is_empty():
		var cur: Dictionary = SaveData.data.current
		var txt := I18n.t("continue") + "  ·  " + _describe_current(cur)
		var b := Ui.button(txt, "", 80)
		b.pressed.connect(Session.resume)
		v.add_child(b)

	# Daily
	var daily := Ui.button("", "CardButton", 96)
	var solved := SaveData.is_daily_solved()
	var streak := SaveData.daily_streak()
	daily.text = "◷ " + I18n.t("daily") + "\n" + (I18n.t("daily_done") if solved else "10×10") + "   " + I18n.t("streak", {"n": streak})
	daily.pressed.connect(Session.start_daily)
	daily.disabled = solved
	v.add_child(daily)

	# Sizes
	for size in SaveData.SIZES:
		var b := Ui.button("", "CardButton", 96)
		var lvl := SaveData.current_level(size)
		b.text = I18n.t("size_%d" % size) + "\n" + I18n.t("level_n", {"n": lvl}) + "   ·   " + I18n.t("solved_count", {"n": SaveData.solved_levels(size)})
		b.pressed.connect(func():
			Session.level_select_size = size
			Session.go("res://scenes/level_select.tscn"))
		v.add_child(b)

	var g := Ui.button("▦ " + I18n.t("gallery") + "  (%d/%d)" % [SaveData.pictures_solved(), Pictures.count()], "CardButton", 84)
	g.pressed.connect(func(): Session.go("res://scenes/gallery.tscn"))
	v.add_child(g)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	var st := Ui.button("☰ " + I18n.t("stats"), "SecondaryButton", 72)
	st.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	st.pressed.connect(func(): Session.go("res://scenes/stats.tscn"))
	row.add_child(st)
	var se := Ui.button("⚙ " + I18n.t("settings"), "SecondaryButton", 72)
	se.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	se.pressed.connect(func(): Session.go("res://scenes/settings.tscn"))
	row.add_child(se)
	v.add_child(row)
	v.add_child(Ui.spacer(8))
	v.add_child(Ui.label(I18n.t("version", {"v": ProjectSettings.get_setting("application/config/version", "1.0")}), "MutedLabel", HORIZONTAL_ALIGNMENT_CENTER))


func _describe_current(cur: Dictionary) -> String:
	match str(cur.get("kind", "level")):
		"daily":
			return I18n.t("daily")
		"picture":
			return I18n.t("pic_" + str(cur.get("extra", "")))
		_:
			return "%d×%d " % [int(cur.get("size", 10)), int(cur.get("size", 10))] + I18n.t("level_short", {"n": int(cur.get("level", 1))})


func _logo() -> Control:
	var tr := TextureRect.new()
	tr.custom_minimum_size = Vector2(140, 140)
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	tr.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	var p := Pictures.build("heart")
	var img := Image.create(p.width, p.height, false, Image.FORMAT_RGBA8)
	for y in p.height:
		for x in p.width:
			img.set_pixel(x, y, Ui.C.primary if p.solution[y * p.width + x] == 1 else Color(0, 0, 0, 0))
	tr.texture = ImageTexture.create_from_image(img)
	return tr


func on_back() -> void:
	SaveData.save_now()
	get_tree().quit()
