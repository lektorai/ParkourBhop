extends Node
## Ad service with pluggable Android adapter.
##
## Out of the box the game ships WITHOUT an ad SDK (so it builds anywhere and
## passes moderation as a clean offline game). To monetise, install the
## community "godot-yandex-ads-android" addon (Yandex Mobile Ads, the standard
## network for RuStore apps) into res://addons/GodotAndroidYandexAds and fill
## the ids in res://monetization_config.gd. The adapter below picks it up
## automatically; nothing else in the game changes.
##
## When no SDK is present:
##   - interstitials are simply skipped,
##   - rewarded ads fall back to a short cooldown (the player still gets the
##     reward), so the game is never blocked.

signal rewarded_result(success: bool)
signal interstitial_closed

const YANDEX_SCRIPT := "res://addons/GodotAndroidYandexAds/yandex_ads.gd"

var available: bool = false
var _plugin: Node = null
var _rewarded_pending := false
var _interstitial_pending := false
var _rewarded_loaded := false
var _interstitial_loaded := false
var _got_reward := false


func _ready() -> void:
	if not OS.has_feature("android"):
		return
	if not ResourceLoader.exists(YANDEX_SCRIPT):
		return
	var script = load(YANDEX_SCRIPT)
	if script == null:
		return
	_plugin = Node.new()
	_plugin.set_script(script)
	_plugin.name = "YandexAds"
	var ids := {
		"api_key": MonetizationConfig.API_KEY,
		"interstitial_id": MonetizationConfig.INTERSTITIAL_ID,
		"rewarded_id": MonetizationConfig.REWARDED_ID,
		"banner_id": MonetizationConfig.BANNER_ID,
	}
	for prop in ids.keys():
		if _plugin.get(prop) != null:
			_plugin.set(prop, ids[prop])
	add_child(_plugin)
	_connect_if(_plugin, "interstitial_loaded", _on_interstitial_loaded)
	_connect_if(_plugin, "interstitial_failed_to_load", _on_interstitial_failed)
	_connect_if(_plugin, "interstitial_closed", _on_interstitial_closed)
	_connect_if(_plugin, "rewarded_video_loaded", _on_rewarded_loaded)
	_connect_if(_plugin, "rewarded_video_failed_to_load", _on_rewarded_failed)
	_connect_if(_plugin, "rewarded_video_closed", _on_rewarded_closed)
	_connect_if(_plugin, "rewarded", _on_rewarded)
	available = true
	_preload_all()


func _connect_if(obj: Object, sig: String, cb: Callable) -> void:
	if obj.has_signal(sig):
		obj.connect(sig, cb)


func _preload_all() -> void:
	if not available:
		return
	if _plugin.has_method("load_interstitial"):
		_plugin.call("load_interstitial")
	if _plugin.has_method("load_rewarded_video"):
		_plugin.call("load_rewarded_video")


# --- rewarded -------------------------------------------------------------

func rewarded_ready() -> bool:
	return available and _rewarded_loaded


## Shows a rewarded ad; emits rewarded_result(success).
## Without an SDK the reward is granted after a tiny delay (fallback).
func show_rewarded() -> void:
	if not available:
		await get_tree().create_timer(0.3).timeout
		rewarded_result.emit(true)
		return
	if not _rewarded_loaded:
		_plugin.call("load_rewarded_video")
		rewarded_result.emit(false)
		return
	_got_reward = false
	_rewarded_pending = true
	_plugin.call("show_rewarded_video")


func _on_rewarded_loaded() -> void:
	_rewarded_loaded = true


func _on_rewarded_failed(_code = 0) -> void:
	_rewarded_loaded = false
	get_tree().create_timer(30.0).timeout.connect(func(): if available: _plugin.call("load_rewarded_video"))


func _on_rewarded(_currency = "", _amount = 0) -> void:
	_got_reward = true


func _on_rewarded_closed() -> void:
	_rewarded_loaded = false
	if _rewarded_pending:
		_rewarded_pending = false
		rewarded_result.emit(_got_reward)
	_plugin.call("load_rewarded_video")


# --- interstitial ---------------------------------------------------------

func interstitial_ready() -> bool:
	return available and _interstitial_loaded and not SaveData.no_ads()


## Shows an interstitial if the frequency cap allows; returns true if shown.
## Caller should await interstitial_closed when true.
func maybe_show_interstitial() -> bool:
	if SaveData.no_ads():
		return false
	SaveData.data.wins_since_ad = int(SaveData.data.wins_since_ad) + 1
	if SaveData.data.wins_since_ad < MonetizationConfig.INTERSTITIAL_EVERY_N_WINS:
		return false
	if not interstitial_ready():
		return false
	SaveData.data.wins_since_ad = 0
	_interstitial_pending = true
	_plugin.call("show_interstitial")
	return true


func _on_interstitial_loaded() -> void:
	_interstitial_loaded = true


func _on_interstitial_failed(_code = 0) -> void:
	_interstitial_loaded = false
	get_tree().create_timer(30.0).timeout.connect(func(): if available: _plugin.call("load_interstitial"))


func _on_interstitial_closed() -> void:
	_interstitial_loaded = false
	if _interstitial_pending:
		_interstitial_pending = false
		interstitial_closed.emit()
	_plugin.call("load_interstitial")
