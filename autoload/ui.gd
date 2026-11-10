extends Node
## Runtime-built theme and palette (light / dark) plus small UI helpers.

signal theme_changed

const LIGHT := {
	"bg": Color("#F6F3EC"),
	"panel": Color("#FFFFFF"),
	"panel2": Color("#EEEAE0"),
	"text": Color("#1F2430"),
	"muted": Color("#7A8090"),
	"primary": Color("#3B6EF0"),
	"primary_dark": Color("#2C55C4"),
	"accent": Color("#F2A93B"),
	"danger": Color("#E04848"),
	"success": Color("#2FB36B"),
	"cell": Color("#2B2D42"),
	"cell_hint": Color("#5B8DEF"),
	"cross": Color("#A7ADBA"),
	"grid": Color("#CDD0D8"),
	"grid_bold": Color("#8F94A3"),
	"clue_bg": Color("#ECE8DE"),
	"clue_done": Color("#B5B9C4"),
	"highlight": Color(0.23, 0.43, 0.94, 0.10),
	"board_bg": Color("#FFFFFF"),
}

const DARK := {
	"bg": Color("#14161C"),
	"panel": Color("#1E2129"),
	"panel2": Color("#272B35"),
	"text": Color("#EDEFF5"),
	"muted": Color("#8B92A5"),
	"primary": Color("#5B8DEF"),
	"primary_dark": Color("#3F6FD1"),
	"accent": Color("#F2B35B"),
	"danger": Color("#F06060"),
	"success": Color("#48C97F"),
	"cell": Color("#E6E8F0"),
	"cell_hint": Color("#7FA8FF"),
	"cross": Color("#5A6072"),
	"grid": Color("#3A3F4D"),
	"grid_bold": Color("#6A7085"),
	"clue_bg": Color("#232733"),
	"clue_done": Color("#4E5466"),
	"highlight": Color(0.36, 0.55, 0.94, 0.16),
	"board_bg": Color("#1A1D25"),
}

var C: Dictionary = LIGHT
var theme: Theme
var dark: bool = false


func _ready() -> void:
	dark = bool(SaveData.get_setting("dark", false))
	rebuild()


func set_dark(v: bool) -> void:
	dark = v
	SaveData.set_setting("dark", v)
	rebuild()
	theme_changed.emit()


func rebuild() -> void:
	C = DARK if dark else LIGHT
	theme = _build_theme()


func _flat(bg: Color, radius: int = 18, margin: int = 16) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.set_corner_radius_all(radius)
	sb.content_margin_left = margin
	sb.content_margin_right = margin
	sb.content_margin_top = margin * 0.75
	sb.content_margin_bottom = margin * 0.75
	return sb


func _build_theme() -> Theme:
	var t := Theme.new()
	t.default_font_size = 26

	# Primary button
	t.set_stylebox("normal", "Button", _flat(C.primary))
	t.set_stylebox("hover", "Button", _flat(C.primary))
	t.set_stylebox("pressed", "Button", _flat(C.primary_dark))
	t.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	var dis := _flat(C.panel2)
	t.set_stylebox("disabled", "Button", dis)
	t.set_color("font_color", "Button", Color.WHITE)
	t.set_color("font_hover_color", "Button", Color.WHITE)
	t.set_color("font_pressed_color", "Button", Color.WHITE)
	t.set_color("font_focus_color", "Button", Color.WHITE)
	t.set_color("font_disabled_color", "Button", C.muted)
	t.set_font_size("font_size", "Button", 28)

	# Secondary button variation
	t.set_type_variation("SecondaryButton", "Button")
	t.set_stylebox("normal", "SecondaryButton", _flat(C.panel2))
	t.set_stylebox("hover", "SecondaryButton", _flat(C.panel2))
	t.set_stylebox("pressed", "SecondaryButton", _flat(C.grid))
	t.set_stylebox("disabled", "SecondaryButton", _flat(C.panel2))
	t.set_color("font_color", "SecondaryButton", C.text)
	t.set_color("font_hover_color", "SecondaryButton", C.text)
	t.set_color("font_pressed_color", "SecondaryButton", C.text)
	t.set_color("font_focus_color", "SecondaryButton", C.text)
	t.set_color("font_disabled_color", "SecondaryButton", C.muted)

	# Toggle (tool) button variation: uses "pressed" look when toggled
	t.set_type_variation("ToolButton", "Button")
	t.set_stylebox("normal", "ToolButton", _flat(C.panel2, 16, 12))
	t.set_stylebox("hover", "ToolButton", _flat(C.panel2, 16, 12))
	t.set_stylebox("pressed", "ToolButton", _flat(C.primary, 16, 12))
	t.set_stylebox("hover_pressed", "ToolButton", _flat(C.primary, 16, 12))
	t.set_stylebox("disabled", "ToolButton", _flat(C.panel2, 16, 12))
	t.set_color("font_color", "ToolButton", C.text)
	t.set_color("font_hover_color", "ToolButton", C.text)
	t.set_color("font_pressed_color", "ToolButton", Color.WHITE)
	t.set_color("font_hover_pressed_color", "ToolButton", Color.WHITE)
	t.set_color("font_focus_color", "ToolButton", C.text)
	t.set_color("font_disabled_color", "ToolButton", C.muted)
	t.set_font_size("font_size", "ToolButton", 24)

	# Danger button
	t.set_type_variation("DangerButton", "Button")
	t.set_stylebox("normal", "DangerButton", _flat(C.danger))
	t.set_stylebox("hover", "DangerButton", _flat(C.danger))
	t.set_stylebox("pressed", "DangerButton", _flat(C.danger.darkened(0.2)))

	# Card-like clickable panel (level/picture buttons)
	t.set_type_variation("CardButton", "Button")
	t.set_stylebox("normal", "CardButton", _flat(C.panel, 16, 8))
	t.set_stylebox("hover", "CardButton", _flat(C.panel, 16, 8))
	t.set_stylebox("pressed", "CardButton", _flat(C.panel2, 16, 8))
	t.set_stylebox("disabled", "CardButton", _flat(C.panel2, 16, 8))
	t.set_color("font_color", "CardButton", C.text)
	t.set_color("font_hover_color", "CardButton", C.text)
	t.set_color("font_pressed_color", "CardButton", C.text)
	t.set_color("font_focus_color", "CardButton", C.text)
	t.set_color("font_disabled_color", "CardButton", C.muted)
	t.set_font_size("font_size", "CardButton", 24)

	# Labels
	t.set_color("font_color", "Label", C.text)
	t.set_type_variation("TitleLabel", "Label")
	t.set_font_size("font_size", "TitleLabel", 44)
	t.set_type_variation("HeaderLabel", "Label")
	t.set_font_size("font_size", "HeaderLabel", 34)
	t.set_type_variation("MutedLabel", "Label")
	t.set_color("font_color", "MutedLabel", C.muted)
	t.set_font_size("font_size", "MutedLabel", 22)
	t.set_type_variation("SmallLabel", "Label")
	t.set_font_size("font_size", "SmallLabel", 20)
	t.set_type_variation("BigLabel", "Label")
	t.set_font_size("font_size", "BigLabel", 56)

	# Panels
	t.set_stylebox("panel", "PanelContainer", _flat(C.panel, 22, 20))
	t.set_type_variation("Card", "PanelContainer")
	t.set_stylebox("panel", "Card", _flat(C.panel, 22, 20))
	t.set_type_variation("OverlayCard", "PanelContainer")
	var oc := _flat(C.panel, 26, 28)
	oc.shadow_color = Color(0, 0, 0, 0.25)
	oc.shadow_size = 24
	t.set_stylebox("panel", "OverlayCard", oc)

	# Check button (rows on a card background)
	for state in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
		t.set_stylebox(state, "CheckButton", _flat(C.panel, 16, 14))
	t.set_icon("checked", "CheckButton", _toggle_icon(true))
	t.set_icon("unchecked", "CheckButton", _toggle_icon(false))
	t.set_icon("checked_disabled", "CheckButton", _toggle_icon(true))
	t.set_icon("unchecked_disabled", "CheckButton", _toggle_icon(false))
	t.set_color("font_color", "CheckButton", C.text)
	t.set_color("font_hover_color", "CheckButton", C.text)
	t.set_color("font_pressed_color", "CheckButton", C.text)
	t.set_color("font_focus_color", "CheckButton", C.text)
	t.set_color("font_hover_pressed_color", "CheckButton", C.text)
	t.set_stylebox("focus", "CheckButton", StyleBoxEmpty.new())
	t.set_font_size("font_size", "CheckButton", 26)

	# Option button
	t.set_stylebox("normal", "OptionButton", _flat(C.panel2, 14, 14))
	t.set_stylebox("hover", "OptionButton", _flat(C.panel2, 14, 14))
	t.set_stylebox("pressed", "OptionButton", _flat(C.grid, 14, 14))
	t.set_stylebox("focus", "OptionButton", StyleBoxEmpty.new())
	t.set_color("font_color", "OptionButton", C.text)
	t.set_color("font_hover_color", "OptionButton", C.text)
	t.set_color("font_pressed_color", "OptionButton", C.text)
	t.set_color("font_focus_color", "OptionButton", C.text)
	t.set_stylebox("panel", "PopupMenu", _flat(C.panel, 14, 10))
	t.set_color("font_color", "PopupMenu", C.text)
	t.set_color("font_hover_color", "PopupMenu", C.text)
	t.set_stylebox("hover", "PopupMenu", _flat(C.panel2, 10, 6))

	# Scroll
	t.set_stylebox("panel", "ScrollContainer", StyleBoxEmpty.new())

	# Progress bar
	t.set_stylebox("background", "ProgressBar", _flat(C.panel2, 8, 0))
	t.set_stylebox("fill", "ProgressBar", _flat(C.success, 8, 0))
	return t


## Pill-shaped toggle icon drawn in code (the default theme's one is invisible on white).
func _toggle_icon(on: bool) -> ImageTexture:
	var w := 64
	var h := 36
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	var track: Color = C.primary if on else C.grid
	var r := h / 2.0
	var knob_x := (w - r) if on else r
	for y in h:
		for x in w:
			var p := Vector2(x + 0.5, y + 0.5)
			var d_track := _pill_dist(p, r, w - r, r)
			var col := Color(0, 0, 0, 0)
			if d_track <= r:
				col = track
				col.a = clampf(r - d_track + 0.5, 0.0, 1.0)
			var d_knob := p.distance_to(Vector2(knob_x, r))
			var kr := r - 5.0
			if d_knob <= kr + 0.5:
				var a := clampf(kr - d_knob + 0.5, 0.0, 1.0)
				col = Color.WHITE.lerp(col, 1.0 - a) if col.a > 0 else Color(1, 1, 1, a)
			img.set_pixel(x, y, col)
	return ImageTexture.create_from_image(img)


func _pill_dist(p: Vector2, x0: float, x1: float, cy: float) -> float:
	var cx := clampf(p.x, x0, x1)
	return p.distance_to(Vector2(cx, cy))


## Safe-area top inset in canvas units (notches, status bar).
func safe_top(viewport: Viewport) -> float:
	if not OS.has_feature("mobile"):
		return 0.0
	var safe := DisplayServer.get_display_safe_area()
	var win := DisplayServer.window_get_size()
	if win.y <= 0:
		return 0.0
	var vis := viewport.get_visible_rect().size
	var scale := float(win.y) / vis.y
	return float(safe.position.y) / max(scale, 0.01)


func safe_bottom(viewport: Viewport) -> float:
	if not OS.has_feature("mobile"):
		return 0.0
	var safe := DisplayServer.get_display_safe_area()
	var win := DisplayServer.window_get_size()
	if win.y <= 0:
		return 0.0
	var vis := viewport.get_visible_rect().size
	var scale := float(win.y) / vis.y
	return float(win.y - (safe.position.y + safe.size.y)) / max(scale, 0.01)


# --- widget helpers -------------------------------------------------------

func button(text: String, variation: String = "", min_h: float = 72.0) -> Button:
	var b := Button.new()
	b.text = text
	if variation != "":
		b.theme_type_variation = variation
	b.custom_minimum_size.y = min_h
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(func(): Sfx.play("click", -6.0))
	return b


func label(text: String, variation: String = "", align: int = HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var l := Label.new()
	l.text = text
	if variation != "":
		l.theme_type_variation = variation
	l.horizontal_alignment = align
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


func spacer(h: float = 12.0) -> Control:
	var c := Control.new()
	c.custom_minimum_size.y = h
	return c


func stars_text(n: int) -> String:
	var s := ""
	for i in 3:
		s += "★" if i < n else "☆"
	return s
