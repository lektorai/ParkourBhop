extends ScreenBase

const COLS := 3


func build() -> void:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 14)
	margin.add_child(v)
	v.add_child(make_header(I18n.t("gallery_title") + "  %d/%d" % [SaveData.pictures_solved(), Pictures.count()], on_back))
	v.add_child(Ui.label(I18n.t("gallery_hint"), "MutedLabel", HORIZONTAL_ALIGNMENT_CENTER))

	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(scroll)
	var grid := GridContainer.new()
	grid.columns = COLS
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	scroll.add_child(grid)

	for d in Pictures.LIST:
		var pic_id: String = d.id
		var solved := SaveData.is_picture_solved(pic_id)
		var b := Ui.button("", "CardButton", 230)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.icon = _preview(pic_id, solved)
		b.expand_icon = true
		b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		b.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
		b.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		b.add_theme_font_size_override("font_size", 20)
		var p := Pictures.build(pic_id)
		if solved:
			var res: Dictionary = SaveData.data.gallery[pic_id]
			b.text = I18n.t("pic_" + pic_id) + "\n" + Ui.stars_text(int(res.get("stars", 0)))
		else:
			b.text = "%d×%d\n?" % [p.width, p.height]
		b.pressed.connect(func(): Session.start_picture(pic_id))
		grid.add_child(b)


func _preview(pic_id: String, solved: bool) -> ImageTexture:
	var p := Pictures.build(pic_id)
	var w := p.width
	var h := p.height
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	if solved:
		for y in h:
			for x in w:
				img.set_pixel(x, y, Ui.C.cell if p.solution[y * w + x] == 1 else Ui.C.panel2)
	else:
		for y in h:
			for x in w:
				img.set_pixel(x, y, Ui.C.panel2 if (x + y) % 2 == 0 else Ui.C.clue_bg)
	return ImageTexture.create_from_image(img)


func on_back() -> void:
	Session.to_menu()
