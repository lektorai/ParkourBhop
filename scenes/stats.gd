extends ScreenBase


func build() -> void:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 14)
	margin.add_child(v)
	v.add_child(make_header(I18n.t("stats_title"), on_back))

	var card := PanelContainer.new()
	card.theme_type_variation = "Card"
	v.add_child(card)
	var list := VBoxContainer.new()
	list.add_theme_constant_override("separation", 10)
	card.add_child(list)

	var st: Dictionary = SaveData.data.stats
	_row(list, I18n.t("solved_total"), str(int(st.solved_total)))
	_row(list, I18n.t("stars_total"), "★ " + str(int(st.stars_total)))
	_row(list, I18n.t("time_total"), I18n.fmt_duration(float(st.time_total)))
	_row(list, I18n.t("pictures_solved"), "%d / %d" % [SaveData.pictures_solved(), Pictures.count()])
	_row(list, I18n.t("daily_streak"), str(SaveData.daily_streak()))
	_row(list, I18n.t("best_streak"), str(int(SaveData.data.daily.best_streak)))
	for size in SaveData.SIZES:
		var best := SaveData.best_time(size)
		_row(list, I18n.t("best_time", {"s": size}), I18n.fmt_time(best) if best > 0.0 else "—")
	for size in SaveData.SIZES:
		_row(list, "%d×%d · " % [size, size] + I18n.t("solved_count", {"n": ""}).strip_edges(), str(SaveData.solved_levels(size)))


func _row(parent: Control, name_: String, value: String) -> void:
	var h := HBoxContainer.new()
	var l := Ui.label(name_, "MutedLabel")
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(l)
	var r := Ui.label(value, "", HORIZONTAL_ALIGNMENT_RIGHT)
	r.autowrap_mode = TextServer.AUTOWRAP_OFF
	h.add_child(r)
	parent.add_child(h)
