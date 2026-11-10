extends Node
## Persistent player data (JSON in user://). Single source of truth for
## progress, settings, stats, purchases and the resumable puzzle.

const PATH := "user://save.json"
const BACKUP := "user://save.bak.json"
const SIZES := [5, 10, 15]

var data: Dictionary = {}


func _ready() -> void:
	load_from_disk()


func _defaults() -> Dictionary:
	return {
		"version": 1,
		"settings": {
			"lang": "",
			"sound": true,
			"vibrate": true,
			"show_mistakes": true,
			"auto_cross": true,
			"dark": false,
		},
		"progress": {"5": 1, "10": 1, "15": 1},
		"levels": {},        # "size-level" -> {"stars": int, "time": float}
		"gallery": {},       # pic id -> {"stars": int, "time": float}
		"daily": {"last_date": "", "streak": 0, "best_streak": 0, "solved_dates": {}},
		"current": {},
		"stats": {"solved_total": 0, "time_total": 0.0, "best": {}, "stars_total": 0},
		"hints_bank": 0,
		"no_ads": false,
		"wins_since_ad": 0,
		"first_run": Time.get_date_string_from_system(),
	}


func load_from_disk() -> void:
	data = _defaults()
	var loaded := _read_json(PATH)
	if loaded.is_empty():
		loaded = _read_json(BACKUP)
	if not loaded.is_empty():
		_merge(data, loaded)


func _read_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return {}
	var txt := f.get_as_text()
	f.close()
	var parsed = JSON.parse_string(txt)
	if parsed is Dictionary:
		return parsed
	return {}


func _merge(base: Dictionary, over: Dictionary) -> void:
	for k in over.keys():
		if base.has(k) and base[k] is Dictionary and over[k] is Dictionary:
			_merge(base[k], over[k])
		else:
			base[k] = over[k]


func save_now() -> void:
	if FileAccess.file_exists(PATH):
		var old := FileAccess.open(PATH, FileAccess.READ)
		if old != null:
			var txt := old.get_as_text()
			old.close()
			var b := FileAccess.open(BACKUP, FileAccess.WRITE)
			if b != null:
				b.store_string(txt)
				b.close()
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f == null:
		push_error("Cannot write save file")
		return
	f.store_string(JSON.stringify(data))
	f.close()


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_WM_CLOSE_REQUEST:
		save_now()


# --- settings -------------------------------------------------------------

func get_setting(key: String, default = null):
	return data.settings.get(key, default)


func set_setting(key: String, value) -> void:
	data.settings[key] = value
	save_now()


# --- levels ---------------------------------------------------------------

func level_key(size: int, level: int) -> String:
	return "%d-%d" % [size, level]


## Next unsolved level for a size (1-based).
func current_level(size: int) -> int:
	return int(data.progress.get(str(size), 1))


func level_result(size: int, level: int) -> Dictionary:
	return data.levels.get(level_key(size, level), {})


func solved_levels(size: int) -> int:
	var c := 0
	for k in data.levels.keys():
		if (k as String).begins_with(str(size) + "-"):
			c += 1
	return c


## Returns true if this was a new best time.
func record_level(size: int, level: int, stars: int, time: float) -> bool:
	var key := level_key(size, level)
	var prev: Dictionary = data.levels.get(key, {})
	var best_time: float = float(prev.get("time", 0.0))
	var is_new: bool = prev.is_empty()
	var entry := {
		"stars": max(stars, int(prev.get("stars", 0))),
		"time": time if is_new else min(time, best_time),
	}
	data.levels[key] = entry
	if level >= current_level(size):
		data.progress[str(size)] = level + 1
	_add_stats(size, stars, time, is_new)
	save_now()
	return not is_new and time < best_time


# --- daily ----------------------------------------------------------------

func today() -> String:
	return Time.get_date_string_from_system()


func yesterday() -> String:
	var d := Time.get_datetime_dict_from_system()
	var unix := Time.get_unix_time_from_datetime_dict(d) - 86400
	return Time.get_date_string_from_unix_time(unix)


func is_daily_solved(date: String = "") -> bool:
	if date == "":
		date = today()
	return data.daily.solved_dates.has(date)


func daily_streak() -> int:
	var last := str(data.daily.last_date)
	if last == today() or last == yesterday():
		return int(data.daily.streak)
	return 0


func record_daily(date: String, stars: int, time: float) -> void:
	if data.daily.solved_dates.has(date):
		return
	data.daily.solved_dates[date] = {"stars": stars, "time": time}
	var last := str(data.daily.last_date)
	if last == yesterday():
		data.daily.streak = int(data.daily.streak) + 1
	elif last != date:
		data.daily.streak = 1
	data.daily.last_date = date
	data.daily.best_streak = max(int(data.daily.best_streak), int(data.daily.streak))
	_add_stats(10, stars, time, true)
	save_now()


# --- gallery --------------------------------------------------------------

func is_picture_solved(pic_id: String) -> bool:
	return data.gallery.has(pic_id)


func pictures_solved() -> int:
	return data.gallery.size()


func record_picture(pic_id: String, stars: int, time: float, size: int) -> void:
	var is_new: bool = not data.gallery.has(pic_id)
	var prev: Dictionary = data.gallery.get(pic_id, {})
	data.gallery[pic_id] = {
		"stars": max(stars, int(prev.get("stars", 0))),
		"time": time if is_new else min(time, float(prev.get("time", time))),
	}
	_add_stats(size, stars, time, is_new)
	save_now()


# --- resumable puzzle -----------------------------------------------------

func set_current(d: Dictionary) -> void:
	data.current = d
	save_now()


func clear_current() -> void:
	data.current = {}


# --- stats ----------------------------------------------------------------

func _add_stats(size: int, stars: int, time: float, is_new: bool) -> void:
	data.stats.time_total = float(data.stats.time_total) + time
	if is_new:
		data.stats.solved_total = int(data.stats.solved_total) + 1
		data.stats.stars_total = int(data.stats.stars_total) + stars
	var key := str(size)
	var best: Dictionary = data.stats.best
	if not best.has(key) or time < float(best[key]):
		best[key] = time


func best_time(size: int) -> float:
	return float(data.stats.best.get(str(size), 0.0))


# --- monetisation ---------------------------------------------------------

func hints_bank() -> int:
	return int(data.hints_bank)


func add_hints(n: int) -> void:
	data.hints_bank = int(data.hints_bank) + n
	save_now()


func take_hint() -> bool:
	if int(data.hints_bank) <= 0:
		return false
	data.hints_bank = int(data.hints_bank) - 1
	save_now()
	return true


func no_ads() -> bool:
	return bool(data.no_ads)


func set_no_ads(v: bool) -> void:
	data.no_ads = v
	save_now()
