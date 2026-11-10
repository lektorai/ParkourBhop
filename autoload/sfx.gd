extends Node
## Sound effects + haptics. Sounds are tiny generated WAV files (tools/gen_sfx.py).

const SOUNDS := {
	"tap": "res://assets/sfx/tap.wav",
	"cross": "res://assets/sfx/cross.wav",
	"error": "res://assets/sfx/error.wav",
	"line": "res://assets/sfx/line.wav",
	"win": "res://assets/sfx/win.wav",
	"click": "res://assets/sfx/click.wav",
}

var _streams: Dictionary = {}
var _players: Array[AudioStreamPlayer] = []
var _next := 0


func _ready() -> void:
	for key in SOUNDS.keys():
		var path: String = SOUNDS[key]
		if ResourceLoader.exists(path):
			_streams[key] = load(path)
	for i in 4:
		var p := AudioStreamPlayer.new()
		p.bus = "Master"
		add_child(p)
		_players.append(p)


func play(key: String, volume_db: float = 0.0) -> void:
	if not SaveData.get_setting("sound", true):
		return
	if not _streams.has(key):
		return
	var p := _players[_next]
	_next = (_next + 1) % _players.size()
	p.stream = _streams[key]
	p.volume_db = volume_db
	p.play()


func vibrate(ms: int = 20) -> void:
	if not SaveData.get_setting("vibrate", true):
		return
	if OS.has_feature("mobile"):
		Input.vibrate_handheld(ms)
