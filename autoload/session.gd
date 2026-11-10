extends Node
## Navigation payload between scenes.
## request examples:
##   {"kind": "level", "size": 10, "level": 3}
##   {"kind": "daily"}
##   {"kind": "picture", "pic": "heart"}
##   {"kind": "resume"}

var request: Dictionary = {}
## Where the gallery / level select should return to.
var level_select_size: int = 10


func go(scene_path: String) -> void:
	get_tree().call_deferred("change_scene_to_file", scene_path)


func start_level(size: int, level: int) -> void:
	request = {"kind": "level", "size": size, "level": level}
	go("res://scenes/game.tscn")


func start_daily() -> void:
	request = {"kind": "daily"}
	go("res://scenes/game.tscn")


func start_picture(pic_id: String) -> void:
	request = {"kind": "picture", "pic": pic_id}
	go("res://scenes/game.tscn")


func resume() -> void:
	request = {"kind": "resume"}
	go("res://scenes/game.tscn")


func to_menu() -> void:
	go("res://scenes/main_menu.tscn")
