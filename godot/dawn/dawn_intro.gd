extends Node3D

const DawnSet := preload("res://dawn/dawn_set.gd")
const ChapterReader := preload("res://dawn/chapter_reader.gd")
const ENDING_TEXT := "res://dawn/chapter_end.json"
const ENDING_CHINESE := "res://dawn/chapter_end.zh-cn.local.json"
enum ChapterState { BEFORE_DOOR, STORY, EMBRACE, COMPLETE }
const DURATION := 37.4
const WINDOW_NEAR := 10.5
const IN_ROOM := 16.7
const MAID_ENTERS := 17.4
const CURTAINS_OPEN := 21.2
const LOOKS_OUT := 25.4
const GOES_TO_BED := 29.6
const WAKE := 34.5
const BED_VIEW := Vector3(2.02, 4.73, -4.12)
const CARRY_TIME := 11.0
const MOTHER_DOOR := Vector3(-4.92, 3.02, -6.26)
const LIFT_LINE := 5
const DOWNSTAIRS_LINE := 6
const CHINESE_SUBTITLES := "res://dawn/subtitles.zh-cn.local.json"
const CUES := [
	[0.8, "The day broke gray and dull."],
	[4.1, "The clouds hung heavily, and there was a rawness in the air that suggested snow."],
	[MAID_ENTERS, "A woman servant came into a room in which a child was sleeping and drew the curtains."],
	[LOOKS_OUT, "She glanced mechanically at the house opposite, a stucco house with a portico, and went to the child's bed."],
	[WAKE, "\"Wake up, Philip,\" she said."],
	[DURATION + 0.25, "She pulled down the bed-clothes, took him in her arms, and carried him downstairs. He was only half awake."],
	[DURATION + 6.5, "\"Your mother wants you,\" she said."],
]

@onready var camera: Camera3D = $Camera
@onready var narrator: AudioStreamPlayer = $Narrator
@onready var outside_air: AudioStreamPlayer = $OutsideAir
@onready var room_tone: AudioStreamPlayer = $RoomTone
var scenery := DawnSet.new()
var time := 0.0
var active_cue := -1
var playing := false
var noticed_maid := false
var reach := 0.0
var carry_time := -1.0
var carry_look := Vector2.ZERO
var lift_angles := Vector2.ZERO
var dragging := false
var blink: ColorRect
var blink_tween: Tween
var look_hint: Label
var caption_panel: VBoxContainer
var caption: Label
var caption_cn: Label
var chinese_lines: Array = []
var show_text: CheckButton
var skip_button: Button
var voice_clips: Array[AudioStream] = []
var ending_lines: Array[Dictionary] = []
var ending_voices: Array[AudioStream] = []
var chapter_state := ChapterState.BEFORE_DOOR
var door_pause := 0.0
var ending_index := -1
var ending_elapsed := 0.0
var embrace_time := 0.0
var embrace_started := false
var max_seen := -1
var action_button: Button
var reader_button: Button
var chapter_reader := ChapterReader.new()
var review_voice := AudioStreamPlayer.new()


func _ready() -> void:
	add_child(scenery)
	scenery.build()
	_load_chinese_subtitles()
	_load_ending()
	_make_interface()
	_prepare_audio()
	replay()


func _process(delta: float) -> void:
	if chapter_reader.visible:
		return
	if not playing:
		_update_bed_view(delta)
		return
	time = minf(time + delta, DURATION)
	_apply_frame(time)
	if time >= DURATION:
		_finish_intro()


func replay() -> void:
	if blink_tween:
		blink_tween.kill()
	blink.color.a = 0.0
	playing = true
	noticed_maid = false
	reach = 0.0
	carry_time = -1.0
	carry_look = Vector2.ZERO
	chapter_state = ChapterState.BEFORE_DOOR
	door_pause = 0.0
	ending_index = -1
	ending_elapsed = 0.0
	embrace_time = 0.0
	embrace_started = false
	max_seen = -1
	reader_button.disabled = true
	scenery.reset_chapter_set()
	dragging = false
	look_hint.hide()
	action_button.hide()
	time = 0.0
	active_cue = -1
	narrator.stop()
	skip_button.text = "跳过入场"
	_set_caption(-1)
	_apply_frame(time)


func skip() -> void:
	time = DURATION
	_apply_frame(time, false)
	max_seen = maxi(max_seen, 4)
	reader_button.disabled = false
	_finish_intro()


func _finish_intro() -> void:
	playing = false
	narrator.stop()
	active_cue = -1
	_set_caption(-1)
	skip_button.text = "重播第一章"
	camera.position = BED_VIEW
	camera.look_at(Vector3(0.06, 5.14, -0.12))
	look_hint.text = "拖动鼠标或按方向键转头 · 看向女佣"
	look_hint.show()
	blink.color.a = 1.0
	blink_tween = create_tween()
	blink_tween.tween_property(blink, "color:a", 0.0, 0.42)


func _update_bed_view(delta: float) -> void:
	var horizontal := float(Input.is_physical_key_pressed(KEY_RIGHT)) - float(Input.is_physical_key_pressed(KEY_LEFT))
	var vertical := float(Input.is_physical_key_pressed(KEY_DOWN)) - float(Input.is_physical_key_pressed(KEY_UP))
	_turn_view(Vector2(horizontal, vertical) * delta * 330.0)
	if carry_time >= 0.0 and carry_time < CARRY_TIME:
		carry_time = minf(CARRY_TIME, carry_time + delta)
		_apply_carry_frame(carry_time)
		return
	if carry_time >= CARRY_TIME:
		_advance_ending(delta)
		return
	if noticed_maid and reach < 1.0:
		reach = minf(1.0, reach + delta * 1.9)
		scenery.offer_hand(smoothstep(0.0, 1.0, reach))
		if reach >= 1.0:
			look_hint.text = "按 E · 回应女佣"
			look_hint.show()
			action_button.text = "回应女佣 [E]"
			action_button.show()


func _unhandled_input(event: InputEvent) -> void:
	if playing or chapter_reader.visible:
		return
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_E:
		_accept_action()
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		dragging = event.pressed
	elif event is InputEventMouseMotion and dragging:
		if (event.button_mask & MOUSE_BUTTON_MASK_LEFT) == 0:
			dragging = false
		else:
			_turn_view(event.relative)
	elif event is InputEventScreenDrag:
		_turn_view(event.relative)


func _turn_view(motion: Vector2) -> void:
	if motion.is_zero_approx():
		return
	if carry_time >= 0.0 and carry_time < CARRY_TIME:
		carry_look.x = clampf(carry_look.x - motion.x * 0.004, -1.35, 1.35)
		carry_look.y = clampf(carry_look.y - motion.y * 0.004, -0.70, 0.65)
		return
	if chapter_state == ChapterState.STORY and ending_index == 0:
		carry_look.x = clampf(carry_look.x - motion.x * 0.004, -0.65, 0.65)
		carry_look.y = clampf(carry_look.y - motion.y * 0.004, -0.42, 0.38)
		return
	if chapter_state == ChapterState.STORY or chapter_state == ChapterState.COMPLETE:
		return
	camera.rotation.y -= motion.x * 0.004
	camera.rotation.x = clampf(camera.rotation.x - motion.y * 0.004, -0.95, 0.9)
	if not noticed_maid:
		var maid_direction := (scenery.maid.position + Vector3.UP * 1.42 - camera.position).normalized()
		if (-camera.basis.z).dot(maid_direction) > 0.975:
			noticed_maid = true
			look_hint.hide()


func _accept_lift() -> void:
	if playing or reach < 1.0 or carry_time >= 0.0:
		return
	carry_time = 0.0
	lift_angles = Vector2(camera.rotation.y, camera.rotation.x)
	look_hint.hide()
	action_button.hide()


func _accept_action() -> void:
	if chapter_state == ChapterState.EMBRACE:
		chapter_state = ChapterState.STORY
		embrace_started = true
		embrace_time = 0.0
		action_button.hide()
		look_hint.hide()
		_next_ending_line()
	else:
		_accept_lift()


func carry_position(at: float) -> Vector3:
	var lifted := Vector3(1.53, 5.21, -3.78)
	var bedside_exit := Vector3(-0.65, 5.21, -1.55)
	var stair_top := Vector3(-4.92, 5.21, -2.29)
	var stair_foot := Vector3(-4.92, MOTHER_DOOR.y, -5.93)
	if at < 1.15:
		return BED_VIEW.lerp(lifted, _ease(0.0, 1.15, at))
	if at < 5.95:
		return _curve(lifted, bedside_exit, Vector3(-4.70, 5.21, -0.85), stair_top,
			_ease(1.15, 5.95, at))
	if at < 9.85:
		return stair_top.lerp(stair_foot, _ease(5.95, 9.85, at))
	return stair_foot.lerp(MOTHER_DOOR, _ease(9.85, CARRY_TIME, at))


func _apply_carry_frame(at: float) -> void:
	camera.position = carry_position(at)
	var toward_hall := PI * 0.5
	var stair_turn := _ease(4.5, 6.35, at)
	var heading := lerp_angle(toward_hall, 0.0, stair_turn)
	camera.rotation.y = lerp_angle(lift_angles.x, heading, _ease(0.15, 1.75, at)) + carry_look.x
	camera.rotation.x = lerpf(lift_angles.y, -0.43 * stair_turn + 0.40 * _ease(8.9, CARRY_TIME, at),
		_ease(0.15, 1.75, at)) + carry_look.y
	scenery.pose_carry(camera.position, heading, _ease(0.0, 1.15, at))
	if at >= CARRY_TIME:
		_show_line(-1, false)
		look_hint.text = "母亲的房门"
		look_hint.show()
	elif DURATION + at >= CUES[DOWNSTAIRS_LINE][0] and at < 9.4:
		_show_line(DOWNSTAIRS_LINE, true)
	elif DURATION + at >= CUES[LIFT_LINE][0] and DURATION + at < CUES[DOWNSTAIRS_LINE][0]:
		_show_line(LIFT_LINE, true)
	else:
		_show_line(-1, false)


func _advance_ending(delta: float) -> void:
	match chapter_state:
		ChapterState.BEFORE_DOOR:
			if ending_lines.is_empty():
				return
			door_pause += delta
			if door_pause >= 0.7:
				chapter_state = ChapterState.STORY
				look_hint.hide()
				_next_ending_line()
		ChapterState.STORY:
			ending_elapsed += delta
			if embrace_started:
				embrace_time += delta
			_render_ending()
			if ending_elapsed >= _ending_duration():
				if ending_lines[ending_index].get("marker") == "embrace":
					chapter_state = ChapterState.EMBRACE
					_show_line(-1, false)
					look_hint.text = "母亲伸出了手"
					look_hint.show()
					action_button.text = "依偎过去 [E]"
					action_button.show()
				else:
					_next_ending_line()


func _next_ending_line() -> void:
	ending_index += 1
	ending_elapsed = 0.0
	if ending_index >= ending_lines.size():
		chapter_state = ChapterState.COMPLETE
		ending_index = ending_lines.size() - 1
		_show_line(-1, false)
		look_hint.text = "第一章 · 破晓 · 完"
		look_hint.show()
		return
	_show_line(CUES.size() + ending_index, true)
	_render_ending()


func _ending_duration() -> float:
	var voice := ending_voices[ending_index]
	if voice != null:
		return maxf(1.8, voice.get_length() + 0.45)
	return maxf(2.7, String(ending_lines[ending_index].text).length() / 16.0)


func _render_ending() -> void:
	var line := ending_lines[ending_index]
	var paragraph: int = line.paragraph
	var part: int = line.part
	var progress := clampf(ending_elapsed / _ending_duration(), 0.0, 1.0)
	var marker: String = line.get("marker", "")
	blink.color.a = 0.0
	if paragraph <= 6 and marker != "adult":
		_render_mother_player_view(paragraph, part, progress)
		if paragraph == 6 and String(line.text).ends_with("fast asleep."):
			blink.color.a = _ease(0.57, 0.98, progress)
		return
	if paragraph < 23:
		_render_adult_bedroom(paragraph, part, progress)
		if marker == "adult":
			blink.color.a = 1.0 - _ease(0.0, 0.28, progress)
		return
	_render_hall(paragraph, progress)
	if paragraph == 23:
		blink.color.a = 1.0 - _ease(0.0, 0.29, progress)


func _render_mother_player_view(paragraph: int, part: int, progress: float) -> void:
	var carry_heading := 0.0
	var reached := 1.0
	var close := _ease(0.0, 2.50, embrace_time)
	camera.position = DawnSet.MOTHER_APPROACH.lerp(DawnSet.MOTHER_CUDDLE, close)
	var target := DawnSet.MOTHER_FACE
	if paragraph == 4 and part == 1:
		var at_door := _ease(0.25, 1.85, ending_elapsed)
		var in_room := _ease(1.75, 5.3, ending_elapsed)
		camera.position = MOTHER_DOOR.lerp(DawnSet.MOTHER_THRESHOLD, at_door).lerp(
			DawnSet.MOTHER_APPROACH, in_room)
		target = (DawnSet.MOTHER_THRESHOLD + Vector3.FORWARD * 1.35).lerp(DawnSet.MOTHER_FACE, in_room)
		carry_heading = -0.35 * in_room
		reached = 0.0
		scenery.set_mother_door(_ease(0.0, 1.4, ending_elapsed))
	else:
		scenery.set_mother_door(1.0)
		if paragraph == 4 and part == 2:
			reached = _ease(0.0, 0.84, progress)
	camera.look_at(target)
	if paragraph == 4 and part == 1:
		var view_control := 1.0 - _ease(4.1, 6.9, ending_elapsed)
		camera.rotation.y += carry_look.x * view_control
		camera.rotation.x += carry_look.y * view_control
	scenery.pose_carry(camera.position, carry_heading, 1.0)
	scenery.pose_mother(reached, close)


func _render_adult_bedroom(paragraph: int, part: int, progress: float) -> void:
	var shot := DawnSet.MOTHER_ROOM_OVERVIEW + Vector3(0.80, 0.04, 0.05)
	var target := DawnSet.MOTHER_FACE
	var beat := "bedside"
	var gesture := 1.0
	match paragraph:
		6:
			gesture = progress
		8, 9, 10:
			beat = "feet"
			gesture = progress if paragraph == 8 and part == 1 else 1.0
		11, 12, 13, 14, 15:
			beat = "transfer"
			gesture = clampf((float(paragraph - 11) + progress) / 3.0, 0.0, 1.0)
		16, 17, 18:
			beat = "screen"
			gesture = progress if paragraph == 16 and part == 1 else 1.0
			if paragraph == 16 and part >= 2:
				shot = DawnSet.MOTHER_SCREEN_VIEW
				target = DawnSet.MOTHER_SCREEN_FOCUS
		19:
			beat = "return"
			gesture = progress
		20, 21:
			beat = "pulse"
			gesture = progress if paragraph == 20 else 1.0
		22:
			beat = "exit"
			gesture = progress
	camera.position = shot
	camera.look_at(target)
	scenery.stage_adults(beat, gesture)
	if paragraph == 22:
		blink.color.a = _ease(0.85, 1.0, progress)


func _render_hall(paragraph: int, progress: float) -> void:
	scenery.stage_adults("shake" if paragraph == 32 else "hall", progress if paragraph == 32 else 1.0)
	var closing := _ease(28.0, 32.0, float(paragraph) + progress)
	camera.position = DawnSet.HALL_VIEW.lerp(
		DawnSet.HALL_VIEW.lerp(DawnSet.HALL_FOCUS, 0.19), closing)
	camera.look_at(DawnSet.HALL_FOCUS)


func camera_at(at: float) -> Vector3:
	var near_window := Vector3(0, 5.28, 3.25)
	if at < WINDOW_NEAR:
		return _curve(Vector3(11.5, 13.6, 17.5), Vector3(8.1, 11.6, 10.0),
			Vector3(0.1, 6.1, 5.1), near_window, _ease(0.0, WINDOW_NEAR, at))
	if at < IN_ROOM:
		return _curve(near_window, Vector3(0, 5.18, 1.05), Vector3(0, 5.03, -0.49),
			Vector3(0.10, 5.03, -1.54), _ease(WINDOW_NEAR, IN_ROOM, at))
	var settling := _ease(IN_ROOM, 22.0, at)
	return Vector3(0.10, 5.03, -1.54).lerp(Vector3(0.10, 4.99, -1.84), settling)


func _apply_frame(at: float, speak: bool = true) -> void:
	blink.color.a = _ease(DURATION - 0.25, DURATION, at)
	camera.position = camera_at(at)
	var direction := (Vector3(0, 7.86, -0.10) - camera.position).normalized()
	direction = _aim(direction, Vector3(0, 5.05, -3.70), _ease(3.0, WINDOW_NEAR, at))
	direction = _aim(direction, Vector3(-3.17, 4.89, -1.40), _ease(13.8, MAID_ENTERS, at))
	direction = _aim(direction, Vector3(-0.87, 5.09, -0.38), _ease(18.0, 21.7, at))
	direction = _aim(direction, Vector3(-0.17, 5.38, 10.58), _ease(LOOKS_OUT, 28.4, at))
	direction = _aim(direction, Vector3(1.62, 4.71, -3.73), _ease(GOES_TO_BED, 34.3, at))
	camera.look_at(camera.position + direction)
	scenery.set_performance(_ease(MAID_ENTERS, 20.85, at),
		_ease(CURTAINS_OPEN, 24.5, at), _ease(GOES_TO_BED, 33.6, at))
	var indoors := _ease(13.35, IN_ROOM, at)
	outside_air.volume_db = lerpf(-25.0, -53.0, indoors)
	room_tone.volume_db = lerpf(-57.0, -34.0, indoors)
	_update_caption(at, speak)


func _update_caption(at: float, speak: bool) -> void:
	var cue := -1
	for index in range(CUES.size()):
		if at >= CUES[index][0]:
			cue = index
	# Leave the subtitle clear through the window crossing.
	if (at >= 13.1 and at < MAID_ENTERS) or at >= DURATION:
		cue = -1
	_show_line(cue, speak)


func _show_line(cue: int, speak: bool) -> void:
	if cue == active_cue:
		return
	active_cue = cue
	_set_caption(cue)
	if cue >= 0:
		max_seen = maxi(max_seen, cue)
		reader_button.disabled = false
	var stream := _voice_for(cue)
	if speak and stream != null:
		narrator.stream = stream
		narrator.play()


func _make_interface() -> void:
	var interface := CanvasLayer.new()
	add_child(interface)
	var overlay := Control.new()
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	interface.add_child(overlay)
	blink = ColorRect.new()
	blink.color = Color(0, 0, 0, 0)
	blink.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.add_child(blink)
	blink.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	look_hint = Label.new()
	look_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	look_hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	look_hint.add_theme_color_override("font_shadow_color", Color.BLACK)
	look_hint.add_theme_constant_override("shadow_offset_y", 2)
	overlay.add_child(look_hint)
	look_hint.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	look_hint.offset_top = -110.0
	look_hint.offset_bottom = -78.0

	caption_panel = VBoxContainer.new()
	caption_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	caption_panel.alignment = BoxContainer.ALIGNMENT_END
	caption_panel.add_theme_constant_override("separation", 4)
	overlay.add_child(caption_panel)
	caption_panel.anchor_left = 0.12
	caption_panel.anchor_right = 0.88
	caption_panel.anchor_top = 1.0
	caption_panel.anchor_bottom = 1.0
	caption_panel.offset_top = -218.0
	caption_panel.offset_bottom = -71.0
	caption = _subtitle_label("en", ["Georgia", "Palatino Linotype", "Liberation Serif"],
		25, Color("#ece3d3"), true)
	caption_cn = _subtitle_label("zh-Hans", ["KaiTi", "Kaiti SC", "STKaiti", "FangSong", "Noto Serif CJK SC"],
		29, Color("#fff7e8"))

	var controls := HBoxContainer.new()
	controls.alignment = BoxContainer.ALIGNMENT_END
	controls.add_theme_constant_override("separation", 8)
	overlay.add_child(controls)
	controls.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	controls.offset_left = -320.0
	controls.offset_right = -25.0
	controls.offset_top = -52.0
	controls.offset_bottom = -22.0
	show_text = CheckButton.new()
	show_text.text = "字幕"
	show_text.button_pressed = true
	show_text.toggled.connect(func(_enabled: bool): _set_caption(active_cue))
	controls.add_child(show_text)
	reader_button = Button.new()
	reader_button.text = "回看原文"
	reader_button.pressed.connect(_open_reader)
	controls.add_child(reader_button)
	skip_button = Button.new()
	skip_button.pressed.connect(func():
		if playing:
			skip()
		else:
			replay()
	)
	controls.add_child(skip_button)
	action_button = Button.new()
	action_button.pressed.connect(_accept_action)
	overlay.add_child(action_button)
	action_button.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	action_button.offset_left = 29.0
	action_button.offset_top = -58.0
	action_button.offset_right = 198.0
	action_button.offset_bottom = -23.0
	action_button.hide()
	add_child(review_voice)
	add_child(chapter_reader)
	chapter_reader.listen_requested.connect(_relisten)
	chapter_reader.visibility_changed.connect(func():
		narrator.stream_paused = chapter_reader.visible
		if not chapter_reader.visible:
			review_voice.stop()
	)
	caption_panel.hide()


func _open_reader() -> void:
	var lines: Array[Dictionary] = []
	for cue in range(max_seen + 1):
		lines.append({"en": _english_for(cue), "zh": _chinese_for(cue)})
	if not lines.is_empty():
		chapter_reader.open_at(lines, maxi(0, max_seen if active_cue < 0 else active_cue))


func _relisten(cue: int) -> void:
	var stream := _voice_for(cue)
	if stream == null:
		return
	review_voice.stream = stream
	review_voice.play()


func _subtitle_label(language: String, font_names: PackedStringArray, size: int, color: Color,
		italic: bool = false) -> Label:
	var typeface := SystemFont.new()
	typeface.font_names = font_names
	typeface.font_italic = italic
	var line := Label.new()
	line.language = language
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	line.add_theme_font_override("font", typeface)
	line.add_theme_font_size_override("font_size", size)
	line.add_theme_color_override("font_color", color)
	line.add_theme_color_override("font_shadow_color", Color(0.035, 0.024, 0.018, 0.72))
	line.add_theme_constant_override("shadow_offset_x", 0)
	line.add_theme_constant_override("shadow_offset_y", 2)
	line.add_theme_constant_override("shadow_outline_size", 1)
	caption_panel.add_child(line)
	return line


func _load_chinese_subtitles() -> void:
	if not FileAccess.file_exists(CHINESE_SUBTITLES):
		return
	var lines = JSON.parse_string(FileAccess.get_file_as_string(CHINESE_SUBTITLES))
	if typeof(lines) != TYPE_ARRAY or lines.size() != CUES.size():
		push_warning("Chinese subtitles must contain one line for each of Dawn's opening cues.")
		return
	for line in lines:
		if typeof(line) != TYPE_STRING or line.strip_edges().is_empty():
			push_warning("Chinese subtitle entries must be nonempty strings.")
			return
	chinese_lines = lines


func _load_ending() -> void:
	var records = JSON.parse_string(FileAccess.get_file_as_string(ENDING_TEXT))
	if not records is Array:
		push_error("Dawn chapter ending is missing or invalid.")
		return
	var translations = JSON.parse_string(FileAccess.get_file_as_string(ENDING_CHINESE)) if FileAccess.file_exists(ENDING_CHINESE) else []
	var has_translation: bool = translations is Array and translations.size() == records.size()
	for index in records.size():
		var entry: Dictionary = records[index]
		entry["translation"] = translations[index] if has_translation else ""
		ending_lines.append(entry)
		var path: String = entry.audio
		ending_voices.append(load(path) as AudioStream if ResourceLoader.exists(path) else null)


func _english_for(cue: int) -> String:
	if cue < CUES.size():
		return CUES[cue][1]
	return ending_lines[cue - CUES.size()].text


func _chinese_for(cue: int) -> String:
	if cue < CUES.size():
		return chinese_lines[cue] if not chinese_lines.is_empty() else ""
	return ending_lines[cue - CUES.size()].translation


func _voice_for(cue: int) -> AudioStream:
	if cue < 0:
		return null
	if cue < CUES.size():
		return voice_clips[cue]
	return ending_voices[cue - CUES.size()]


func _set_caption(cue: int) -> void:
	caption.text = _english_for(cue) if cue >= 0 else ""
	caption_cn.text = _chinese_for(cue) if cue >= 0 else ""
	caption_cn.visible = not caption_cn.text.is_empty()
	caption_panel.visible = show_text.button_pressed and cue >= 0


func _prepare_audio() -> void:
	for index in range(CUES.size()):
		var path := "res://dawn/audio/line_%d.wav" % (index + 1)
		voice_clips.append(load(path) as AudioStream if ResourceLoader.exists(path) else null)
	outside_air.stream = _air_loop(true)
	room_tone.stream = _air_loop(false)
	outside_air.play()
	room_tone.play()


func _air_loop(outdoor: bool) -> AudioStreamWAV:
	const RATE := 16000
	const LENGTH := 4
	var data := PackedByteArray()
	data.resize(RATE * LENGTH * 2)
	var rng := RandomNumberGenerator.new()
	rng.seed = 42 if outdoor else 24
	var slow := 0.0
	var fast := 0.0
	for i in range(RATE * LENGTH):
		var noise := rng.randf_range(-1.0, 1.0)
		var phase := float(i) / float(RATE * LENGTH)
		slow = lerpf(slow, noise, 0.017 if outdoor else 0.006)
		fast = lerpf(fast, noise, 0.095)
		var window := pow(sin(PI * phase), 0.23)
		var sample := (slow * 1.45 + fast * 0.29) * window if outdoor else slow * window
		data.encode_s16(i * 2, int(clampf(sample, -1.0, 1.0) * 32767.0))
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = RATE
	stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
	stream.loop_end = RATE * LENGTH
	stream.data = data
	return stream


func _ease(start: float, end: float, at: float) -> float:
	return smoothstep(0.0, 1.0, inverse_lerp(start, end, at))


func _aim(from: Vector3, target: Vector3, weight: float) -> Vector3:
	return from.slerp((target - camera.position).normalized(), weight)


func _curve(a: Vector3, b: Vector3, c: Vector3, d: Vector3, fraction: float) -> Vector3:
	return a.lerp(b, fraction).lerp(b.lerp(c, fraction), fraction).lerp(
		b.lerp(c, fraction).lerp(c.lerp(d, fraction), fraction), fraction)
