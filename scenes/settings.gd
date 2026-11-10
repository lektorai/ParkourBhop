extends ScreenBase

var _status: Label


func build() -> void:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 14)
	margin.add_child(v)
	v.add_child(make_header(I18n.t("settings"), on_back))

	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(scroll)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 12)
	scroll.add_child(list)

	# Language
	var lang_row := HBoxContainer.new()
	var ll := Ui.label(I18n.t("language"))
	ll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lang_row.add_child(ll)
	var opt := OptionButton.new()
	opt.add_item("Русский", 0)
	opt.add_item("English", 1)
	opt.select(0 if I18n.locale == "ru" else 1)
	opt.focus_mode = Control.FOCUS_NONE
	opt.item_selected.connect(func(i: int):
		var l := "ru" if i == 0 else "en"
		SaveData.set_setting("lang", l)
		I18n.set_locale(l)
		Ui.theme_changed.emit())
	lang_row.add_child(opt)
	list.add_child(lang_row)

	_toggle(list, I18n.t("sound"), "sound")
	_toggle(list, I18n.t("vibration"), "vibrate")
	_toggle(list, I18n.t("show_mistakes"), "show_mistakes")
	list.add_child(Ui.label(I18n.t("show_mistakes_hint"), "MutedLabel"))
	_toggle(list, I18n.t("auto_cross"), "auto_cross")
	var dark := CheckButton.new()
	dark.text = I18n.t("dark_theme")
	dark.button_pressed = Ui.dark
	dark.focus_mode = Control.FOCUS_NONE
	dark.toggled.connect(func(on: bool): Ui.set_dark(on))
	list.add_child(dark)

	list.add_child(Ui.spacer(8))

	# Purchases
	if Billing.available or SaveData.no_ads() or SaveData.hints_bank() > 0:
		var card := PanelContainer.new()
		card.theme_type_variation = "Card"
		list.add_child(card)
		var pv := VBoxContainer.new()
		pv.add_theme_constant_override("separation", 10)
		card.add_child(pv)
		if SaveData.no_ads():
			pv.add_child(Ui.label(I18n.t("remove_ads_done"), "", HORIZONTAL_ALIGNMENT_CENTER))
		elif Billing.available:
			var b := Ui.button(I18n.t("remove_ads"))
			b.pressed.connect(func(): _buy(MonetizationConfig.PRODUCT_NO_ADS))
			pv.add_child(b)
		pv.add_child(Ui.label(I18n.t("hints_bank", {"n": SaveData.hints_bank()}), "MutedLabel", HORIZONTAL_ALIGNMENT_CENTER))
		if Billing.available:
			var h := Ui.button(I18n.t("buy_hints"), "SecondaryButton")
			h.pressed.connect(func(): _buy(MonetizationConfig.PRODUCT_HINTS_20))
			pv.add_child(h)
			var r := Ui.button(I18n.t("restore_purchases"), "SecondaryButton")
			r.pressed.connect(func():
				Billing.restore()
				_set_status(I18n.t("restored")))
			pv.add_child(r)
		_status = Ui.label("", "MutedLabel", HORIZONTAL_ALIGNMENT_CENTER)
		pv.add_child(_status)

	var priv := Ui.button(I18n.t("privacy"), "SecondaryButton")
	priv.pressed.connect(func(): OS.shell_open(MonetizationConfig.PRIVACY_URL))
	list.add_child(priv)
	list.add_child(Ui.label(I18n.t("version", {"v": ProjectSettings.get_setting("application/config/version", "1.0")}), "MutedLabel", HORIZONTAL_ALIGNMENT_CENTER))


func _toggle(parent: Control, text: String, key: String) -> void:
	var cb := CheckButton.new()
	cb.text = text
	cb.button_pressed = bool(SaveData.get_setting(key, true))
	cb.focus_mode = Control.FOCUS_NONE
	cb.toggled.connect(func(on: bool): SaveData.set_setting(key, on))
	parent.add_child(cb)


func _buy(product_id: String) -> void:
	if not Billing.available:
		_set_status(I18n.t("billing_unavailable"))
		return
	Billing.purchase(product_id)
	var res: Array = await Billing.purchase_finished
	var ok: bool = res[1]
	_set_status(I18n.t("purchase_ok") if ok else I18n.t("purchase_fail"))
	if ok:
		Ui.theme_changed.emit()


func _set_status(text: String) -> void:
	if _status != null:
		_status.text = text
