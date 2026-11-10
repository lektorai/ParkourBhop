class_name ScreenBase
extends Control
## Common behaviour for full-screen UI scenes: themed background, safe-area
## padding, Android back button.

var bg: ColorRect
var margin: MarginContainer


func _ready() -> void:
	theme = Ui.theme
	set_anchors_preset(Control.PRESET_FULL_RECT)
	bg = ColorRect.new()
	bg.color = Ui.C.bg
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)
	move_child(bg, 0)
	margin = MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_top", int(24 + Ui.safe_top(get_viewport())))
	margin.add_theme_constant_override("margin_bottom", int(20 + Ui.safe_bottom(get_viewport())))
	add_child(margin)
	Ui.theme_changed.connect(_on_theme_changed)
	build()


## Override in subclasses: build the UI inside `margin`.
func build() -> void:
	pass


func _on_theme_changed() -> void:
	theme = Ui.theme
	bg.color = Ui.C.bg
	for c in margin.get_children():
		c.queue_free()
	build()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		on_back()


## Android back button; default returns to the main menu.
func on_back() -> void:
	Session.to_menu()


## Header row with a back button and a title.
func make_header(title: String, back_cb: Callable) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	var b := Ui.button("‹", "SecondaryButton", 64)
	b.custom_minimum_size.x = 64
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	b.add_theme_font_size_override("font_size", 36)
	b.pressed.connect(back_cb)
	h.add_child(b)
	var l := Ui.label(title, "HeaderLabel")
	l.autowrap_mode = TextServer.AUTOWRAP_OFF
	l.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	h.add_child(l)
	return h
