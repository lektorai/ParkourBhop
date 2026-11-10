class_name BoardModel
extends RefCounted
## Mutable state of a puzzle being played: cell marks, flags, history, timer.

const UNKNOWN := 0
const FILLED := 1
const CROSS := 2

const FLAG_ERROR := 1
const FLAG_HINT := 2

var puzzle: Nonogram
## Player marks: 0 unknown, 1 filled, 2 cross.
var states: PackedByteArray
## Per-cell flags bitmask (error / hint lock).
var flags: PackedByteArray
var mistakes: int = 0
var hints_used: int = 0
var elapsed: float = 0.0
var solved: bool = false
## Undo history: array of batches; each batch is an array of [idx, old_state, old_flags].
var history: Array = []
var _batch: Array = []
## Context for persistence / navigation.
var kind: String = "level"  # level | daily | picture
var size: int = 10
var level: int = 1
var extra: String = ""     # picture id or daily date


func _init(p: Nonogram = null) -> void:
	if p != null:
		setup(p)


func setup(p: Nonogram) -> void:
	puzzle = p
	states = PackedByteArray()
	states.resize(p.width * p.height)
	flags = PackedByteArray()
	flags.resize(p.width * p.height)
	mistakes = 0
	hints_used = 0
	elapsed = 0.0
	solved = false
	history.clear()
	_batch.clear()


func idx(x: int, y: int) -> int:
	return y * puzzle.width + x


func get_state(x: int, y: int) -> int:
	return states[y * puzzle.width + x]


func is_locked(i: int) -> bool:
	return (flags[i] & (FLAG_ERROR | FLAG_HINT)) != 0


## Raw state change, records undo info into the current batch.
func set_cell(i: int, state: int, flag: int = 0) -> void:
	if states[i] == state and flags[i] == flag:
		return
	_batch.append([i, states[i], flags[i]])
	states[i] = state
	flags[i] = flag


func begin_batch() -> void:
	_batch = []


func commit_batch() -> void:
	if not _batch.is_empty():
		history.append(_batch)
		if history.size() > 200:
			history.pop_front()
	_batch = []


func can_undo() -> bool:
	return not history.is_empty()


func undo() -> void:
	if history.is_empty():
		return
	var batch: Array = history.pop_back()
	for j in range(batch.size() - 1, -1, -1):
		var e: Array = batch[j]
		states[e[0]] = e[1]
		flags[e[0]] = e[2]


func row_complete(y: int) -> bool:
	var w := puzzle.width
	for x in w:
		var want := puzzle.solution[y * w + x] == 1
		if want != (states[y * w + x] == FILLED):
			return false
	return true


func col_complete(x: int) -> bool:
	var w := puzzle.width
	for y in puzzle.height:
		var want := puzzle.solution[y * w + x] == 1
		if want != (states[y * w + x] == FILLED):
			return false
	return true


func check_solved() -> bool:
	for i in states.size():
		var want := puzzle.solution[i] == 1
		if want != (states[i] == FILLED):
			return false
	return true


func filled_progress() -> float:
	var total := puzzle.filled_count()
	if total == 0:
		return 1.0
	var ok := 0
	for i in states.size():
		if states[i] == FILLED and puzzle.solution[i] == 1:
			ok += 1
	return float(ok) / float(total)


func stars() -> int:
	var penalty := mistakes + hints_used
	if penalty == 0:
		return 3
	if penalty <= 2:
		return 2
	return 1


## Converts the player's marks into solver states (only correct info kept).
func solver_state() -> PackedByteArray:
	var s := PackedByteArray()
	s.resize(states.size())
	for i in states.size():
		if states[i] == FILLED and puzzle.solution[i] == 1:
			s[i] = 1
		elif states[i] == CROSS and puzzle.solution[i] == 0:
			s[i] = 2
	return s


func to_dict() -> Dictionary:
	return {
		"kind": kind,
		"size": size,
		"level": level,
		"extra": extra,
		"id": puzzle.id,
		"w": puzzle.width,
		"h": puzzle.height,
		"solution": puzzle.solution_string(),
		"states": Marshalls.raw_to_base64(states),
		"flags": Marshalls.raw_to_base64(flags),
		"mistakes": mistakes,
		"hints_used": hints_used,
		"elapsed": elapsed,
	}


static func from_dict(d: Dictionary) -> BoardModel:
	if not d.has("solution") or not d.has("w"):
		return null
	var w := int(d.w)
	var h := int(d.h)
	var p := Nonogram.from_solution_string(str(d.solution), w, h, str(d.get("id", "")))
	var m := BoardModel.new(p)
	m.kind = str(d.get("kind", "level"))
	m.size = int(d.get("size", w))
	m.level = int(d.get("level", 1))
	m.extra = str(d.get("extra", ""))
	var st := Marshalls.base64_to_raw(str(d.get("states", "")))
	var fl := Marshalls.base64_to_raw(str(d.get("flags", "")))
	if st.size() == w * h:
		m.states = st
	if fl.size() == w * h:
		m.flags = fl
	m.mistakes = int(d.get("mistakes", 0))
	m.hints_used = int(d.get("hints_used", 0))
	m.elapsed = float(d.get("elapsed", 0.0))
	return m
