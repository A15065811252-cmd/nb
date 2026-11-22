extends SceneTree

const Opening := preload("res://dawn/dawn.tscn")
const DawnSet := preload("res://dawn/dawn_set.gd")
var failed := false


func _initialize() -> void:
	call_deferred("_check_opening")


func _check_opening() -> void:
	var intro := Opening.instantiate()
	root.add_child(intro)
	if "--realtime" in OS.get_cmdline_user_args():
		await _play_in_realtime(intro)
		return
	intro.set_process(false)
	var sampled_window := false
	for frame in range(1051):
		var position: Vector3 = intro.camera_at(float(frame) / 30.0)
		if absf(position.z) <= 0.30:
			sampled_window = true
			_check(absf(position.x) < 0.24, "camera crosses within the clear curtain gap")
			_check(position.y > DawnSet.WINDOW_BOTTOM + 0.1 and position.y < DawnSet.OPENING_TOP - 0.1,
				"camera stays away from the sill and raised window sash")
	_check(sampled_window, "camera crosses the window plane")
	_check(intro.camera_at(0).z > 10 and intro.camera_at(35).z < -1, "ends inside after starting outdoors")
	intro._apply_frame(1.5, false)
	_check(intro.caption.text.begins_with("The day broke"), "opening weather caption appears")
	if "--require-chinese" in OS.get_cmdline_user_args():
		_check(intro.chinese_lines.size() == intro.CUES.size(), "all local Chinese subtitles are loaded")
		_check(intro.caption_cn.visible and not intro.caption_cn.text.is_empty(),
			"Chinese weather caption accompanies the English")
		_check(intro.caption.horizontal_alignment == HORIZONTAL_ALIGNMENT_CENTER
			and intro.caption_cn.horizontal_alignment == HORIZONTAL_ALIGNMENT_CENTER,
			"both language tracks use centered subtitles")
	intro._apply_frame(15.0, false)
	_check(not intro.caption_panel.visible, "caption clears during the transition")
	intro._apply_frame(19.0, false)
	_check(intro.scenery.maid.visible and intro.caption.text.begins_with("A woman servant"),
		"maid and original English appear together")
	_check(intro.outside_air.volume_db < intro.room_tone.volume_db, "room ambience leads indoors")
	intro.show_text.button_pressed = false
	_check(not intro.caption_panel.visible, "subtitle toggle hides text")
	intro.show_text.button_pressed = true
	intro.skip_button.pressed.emit()
	_check(not intro.playing and not intro.narrator.playing and intro.time == intro.DURATION,
		"skip stops narration and reaches the bedroom")
	_check(intro.camera.position.is_equal_approx(intro.BED_VIEW) and not intro.noticed_maid,
		"skip puts the player in bed without triggering the response")
	intro._accept_lift()
	_check(intro.carry_time < 0.0, "lift cannot start before the maid responds")
	var maid_face: Vector3 = intro.scenery.maid.position + Vector3.UP * 1.42
	var aim: Vector3 = intro.camera.transform.looking_at(maid_face).basis.get_euler()
	var drag := InputEventScreenDrag.new()
	drag.relative = Vector2(wrapf(intro.camera.rotation.y - aim.y, -PI, PI), intro.camera.rotation.x - aim.x) / 0.004
	intro._unhandled_input(drag)
	intro._update_bed_view(0.55)
	_check(intro.noticed_maid and intro.reach == 1.0 and intro.look_hint.visible,
		"turning toward the maid triggers her reply")
	var accept := InputEventKey.new()
	accept.physical_keycode = KEY_E
	accept.pressed = true
	intro._unhandled_input(accept)
	intro._update_bed_view(6.8)
	var yaw_before: float = intro.camera.rotation.y
	drag.relative = Vector2(42, 0)
	intro._unhandled_input(drag)
	intro._update_bed_view(0.0)
	_check(intro.active_cue == intro.DOWNSTAIRS_LINE and absf(intro.camera.rotation.y - yaw_before) > 0.12,
		"player can look around during the downstairs dialogue")
	intro._update_bed_view(6.0)
	_check(intro.carry_time == intro.CARRY_TIME and intro.camera.position.is_equal_approx(intro.MOTHER_DOOR),
		"carried path ends in front of the mother's door")
	await _check_chapter_end(intro)
	intro.skip_button.pressed.emit()
	_check(intro.playing and intro.time == 0.0 and not intro.scenery.maid.visible, "replay resets the scene")
	intro.time = intro.DURATION - 0.01
	intro._process(0.02)
	_check(not intro.playing and intro.camera.position.is_equal_approx(intro.BED_VIEW) and not intro.noticed_maid,
		"normal playback hands over at the same bed view")
	var all_recorded := true
	for index in range(intro.CUES.size()):
		var clip: AudioStream = intro.voice_clips[index]
		if clip == null:
			all_recorded = false
			continue
		var next_time: float = [4.1, 13.1, intro.LOOKS_OUT, intro.WAKE, intro.DURATION,
			intro.DURATION + 6.5, intro.DURATION + 9.4][index]
		_check(clip.get_length() <= next_time - float(intro.CUES[index][0]),
			"narration %s fits its cue" % (index + 1))
	if "--require-audio" in OS.get_cmdline_user_args():
		_check(all_recorded, "all seven narration clips exist")
	if "--capture" in OS.get_cmdline_user_args():
		intro.replay()
		var output := ProjectSettings.globalize_path("res://../.godot-tools/preview")
		DirAccess.make_dir_recursive_absolute(output)
		for snapshot in [["street", 2.5], ["window", 13.1], ["crossing", 14.2], ["room", 16.7],
				["maid", 20.0], ["opposite", 28.8], ["wake", 35.0], ["player-bed", -1.0],
				["downstairs", -7.7], ["mother-door", -11.0]]:
			if snapshot[1] == -1.0:
				intro.skip()
				intro.blink_tween.kill()
				intro.blink.color.a = 0.0
			elif snapshot[1] < 0:
				intro.reach = 1.0
				intro._accept_lift()
				intro._apply_carry_frame(-float(snapshot[1]))
			else:
				intro._apply_frame(float(snapshot[1]), false)
			await RenderingServer.frame_post_draw
			await RenderingServer.frame_post_draw
			var image := root.get_texture().get_image()
			_check(image != null and image.save_png(output.path_join(snapshot[0] + ".png")) == OK,
				"save preview " + snapshot[0])
		await _capture_ending(intro, output)
	if not failed:
		print("Dawn passed: introduction, carry, embrace, all Chapter I cues, review and replay.")
	intro.narrator.stop()
	intro.review_voice.stop()
	intro.outside_air.stop()
	intro.room_tone.stop()
	intro.queue_free()
	await create_timer(0.15).timeout
	quit(1 if failed else 0)


func _check_chapter_end(intro: Node) -> void:
	_check(not intro.ending_lines.is_empty(), "remaining Chapter I lines are loaded")
	if intro.ending_lines.is_empty():
		return
	intro._update_bed_view(0.8)
	intro._update_bed_view(5.4)
	_check(intro.ending_index == 0 and intro.camera.position.distance_to(DawnSet.MOTHER_APPROACH) < 0.03,
		"continuous camera reaches the mother through the lower door")
	intro._accept_action()
	_check(not intro.embrace_started, "early E cannot skip the mother's gesture")
	intro._update_bed_view(intro._ending_duration())
	intro._update_bed_view(intro._ending_duration())
	_check(intro.chapter_state == intro.ChapterState.EMBRACE
		and intro.action_button.visible, "mother waits for a response")
	var held_index: int = intro.ending_index
	intro._update_bed_view(45.0)
	_check(intro.ending_index == held_index, "chapter holds at the embrace choice")
	intro.action_button.pressed.emit()
	_check(intro.embrace_started and intro.ending_index == held_index + 1, "embrace resumes in source order")
	intro._open_reader()
	_check(intro.chapter_reader.visible and intro.narrator.stream_paused, "review pauses present narration")
	var paused_elapsed: float = intro.ending_elapsed
	intro._process(1.0)
	_check(intro.ending_elapsed == paused_elapsed, "review pauses the story clock")
	intro.chapter_reader.reader_buttons[intro.CUES.size()].pressed.emit()
	_check(intro.review_voice.playing and intro.review_voice.stream == intro.ending_voices[0],
		"review plays the requested clip separately")
	intro.chapter_reader.hide()
	_check(not intro.narrator.stream_paused and not intro.review_voice.playing, "closing review resumes chapter")
	var expected_paragraph := 4
	var seen_markers: Array[String] = []
	for index in intro.ending_lines.size():
		var line: Dictionary = intro.ending_lines[index]
		_check(line.paragraph == expected_paragraph, "verbatim sections stay in paragraph order")
		if index + 1 < intro.ending_lines.size() and intro.ending_lines[index + 1].paragraph != line.paragraph:
			expected_paragraph += 1
		if line.has("marker"):
			seen_markers.append(line.marker)
		if "--require-audio" in OS.get_cmdline_user_args():
			_check(intro.ending_voices[index] != null, "chapter line %d has audio" % index)
		if "--require-chinese" in OS.get_cmdline_user_args():
			_check(not String(line.translation).is_empty(), "chapter line %d has Chinese" % index)
	_check(seen_markers == ["embrace", "adult", "hall", "end"] and expected_paragraph == 32,
		"chapter markers reach the doctor's head shake")
	for index in range(intro.ending_index, intro.ending_lines.size()):
		intro._update_bed_view(intro._ending_duration() + 0.02)
		await create_timer(0.035).timeout
	_check(intro.chapter_state == intro.ChapterState.COMPLETE and "完" in intro.look_hint.text,
		"the whole chapter reaches its ending")


func _play_in_realtime(intro: Node) -> void:
	var deadline := Time.get_ticks_msec() + 290000
	var looked := false
	var seen := {}
	while intro.chapter_state != intro.ChapterState.COMPLETE and Time.get_ticks_msec() < deadline:
		await process_frame
		if not intro.playing and not looked:
			var target: Vector3 = intro.scenery.maid.position + Vector3.UP * 1.42
			var motion := InputEventScreenDrag.new()
			var aim: Vector3 = intro.camera.transform.looking_at(target).basis.get_euler()
			motion.relative = Vector2(wrapf(intro.camera.rotation.y - aim.y, -PI, PI),
				intro.camera.rotation.x - aim.x) / 0.004
			intro._unhandled_input(motion)
			looked = true
		if intro.action_button.visible:
			intro.action_button.pressed.emit()
		if intro.active_cue >= 0 and intro.narrator.playing:
			seen[intro.active_cue] = true
	_check(intro.chapter_state == intro.ChapterState.COMPLETE, "realtime playback reaches the chapter ending")
	_check(seen.size() == intro.CUES.size() + intro.ending_lines.size(),
		"every realtime voice starts (%d cues observed)" % seen.size())
	intro.review_voice.stop()
	intro.narrator.stop()
	intro.outside_air.stop()
	intro.room_tone.stop()
	intro.queue_free()
	await create_timer(0.15).timeout
	if not failed:
		print("Dawn: realtime chapter reached the ending with %d audio cues." % seen.size())
	quit(1 if failed else 0)


func _capture_ending(intro: Node, output: String) -> void:
	intro.skip()
	intro.blink_tween.kill()
	intro.blink.color.a = 0.0
	intro.carry_time = intro.CARRY_TIME
	intro._advance_ending(0.8)
	var snapshots := {
		0: ["chapter-doorway", 0.20],
		1: ["chapter-mother", 0.84],
		8: ["chapter-doctor", 0.94],
		29: ["chapter-hall", 0.95],
		38: ["chapter-end", 0.75],
	}
	for index in intro.ending_lines.size():
		if index in snapshots:
			intro._advance_ending(intro._ending_duration() * snapshots[index][1])
			await RenderingServer.frame_post_draw
			await RenderingServer.frame_post_draw
			var image := root.get_texture().get_image()
			var name: String = snapshots[index][0]
			_check(image != null and image.save_png(output.path_join(name + ".png")) == OK,
				"save preview " + name)
		intro._advance_ending(intro._ending_duration() + 0.02)
		if intro.chapter_state == intro.ChapterState.EMBRACE:
			intro._accept_action()
		await create_timer(0.035).timeout


func _check(condition: bool, label: String) -> void:
	if not condition:
		failed = true
		push_error(label)
