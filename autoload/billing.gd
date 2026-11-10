extends Node
## In-app purchases through RuStore Pay SDK (optional adapter).
##
## Install the official plugins from GitFlic (rustore/rustore-godot-pay):
##   addons/RuStoreGodotPay, addons/RuStoreGodotCore, plus the manifest /
##   rustore_values.xml steps from the SDK docs (see store/PUBLISH.md).
## When the plugins are absent every call reports "unavailable" and the UI
## hides the purchase buttons, so the game stays fully functional.
##
## Method/signal names follow RuStore Pay SDK for Godot 11.x docs
## (https://www.rustore.ru/help/sdk/pay/godot). Verify against the version
## you install; the adapter is intentionally dynamic (has_method/has_signal).

signal purchase_finished(product_id: String, success: bool)
signal restored

var available: bool = false
var _client: Object = null
var _pending_product: String = ""


func _ready() -> void:
	if not OS.has_feature("android"):
		return
	var path := _find_class_path("RuStoreGodotPayClient")
	if path == "":
		return
	var script = load(path)
	if script == null or not script.has_method("get_instance"):
		return
	_client = script.call("get_instance")
	if _client == null:
		return
	_connect_if("on_purchase_one_step_success", _on_purchase_success)
	_connect_if("on_purchase_one_step_failure", _on_purchase_failure)
	_connect_if("on_get_purchases_success", _on_get_purchases_success)
	_connect_if("on_get_purchases_failure", func(_e): pass)
	available = true
	restore()


func _find_class_path(class_name_: String) -> String:
	for entry in ProjectSettings.get_global_class_list():
		if str(entry.get("class", "")) == class_name_:
			return str(entry.get("path", ""))
	return ""


func _connect_if(sig: String, cb: Callable) -> void:
	if _client.has_signal(sig):
		_client.connect(sig, cb)


func purchase(product_id: String) -> void:
	if not available:
		purchase_finished.emit(product_id, false)
		return
	_pending_product = product_id
	var pid = _make_product_id(product_id)
	if _client.has_method("purchase_one_step"):
		_client.call("purchase_one_step", pid)
	elif _client.has_method("purchase"):
		_client.call("purchase", pid)
	else:
		purchase_finished.emit(product_id, false)


func restore() -> void:
	if not available:
		return
	if _client.has_method("get_purchases"):
		_client.call("get_purchases")


func _make_product_id(product_id: String):
	var path := _find_class_path("RuStorePayProductId")
	if path != "":
		var s = load(path)
		if s != null:
			var obj = s.new()
			if obj.get("value") != null:
				obj.set("value", product_id)
			return obj
	return product_id


func _apply_product(product_id: String) -> void:
	match product_id:
		MonetizationConfig.PRODUCT_NO_ADS:
			SaveData.set_no_ads(true)
		MonetizationConfig.PRODUCT_HINTS_20:
			SaveData.add_hints(20)


func _on_purchase_success(result = null) -> void:
	var pid := _pending_product
	if result != null and result.get("product_id") != null:
		var p = result.get("product_id")
		pid = str(p.get("value")) if p is Object else str(p)
	_apply_product(pid)
	_pending_product = ""
	purchase_finished.emit(pid, true)


func _on_purchase_failure(_error = null) -> void:
	var pid := _pending_product
	_pending_product = ""
	purchase_finished.emit(pid, false)


func _on_get_purchases_success(purchases = []) -> void:
	for pu in purchases:
		var pid_obj = pu.get("product_id") if pu is Object else null
		var pid := str(pid_obj.get("value")) if pid_obj is Object else str(pid_obj)
		if pid == MonetizationConfig.PRODUCT_NO_ADS:
			SaveData.set_no_ads(true)
	restored.emit()
