extends AcceptDialog

signal listen_requested(cue: int)

var list: VBoxContainer
var reader_buttons: Array[Button] = []


func _ready() -> void:
	title = "第一章 · 破晓 · 原文回看"
	ok_button_text = "返回剧情"
	min_size = Vector2i(720, 530)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.custom_minimum_size = Vector2(680, 455)
	add_child(scroll)
	list = VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 9)
	scroll.add_child(list)


func open_at(lines: Array[Dictionary], current: int) -> void:
	for child in list.get_children():
		list.remove_child(child)
		child.queue_free()
	reader_buttons.clear()
	for index in lines.size():
		var row := VBoxContainer.new()
		row.add_theme_constant_override("separation", 4)
		list.add_child(row)
		var english := _line(lines[index].en, "en", Color("#faecd7"))
		row.add_child(english)
		var chinese: String = lines[index].zh
		if not chinese.is_empty():
			row.add_child(_line(chinese, "zh-Hans", Color("#d6c7ad")))
		var listen := Button.new()
		listen.text = "▶ 重听"
		listen.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		listen.pressed.connect(func(): listen_requested.emit(index))
		row.add_child(listen)
		reader_buttons.append(listen)
		row.add_child(HSeparator.new())
	popup_centered()
	if current >= 0 and current < reader_buttons.size():
		reader_buttons[current].grab_focus.call_deferred()
		(list.get_parent() as ScrollContainer).ensure_control_visible.call_deferred(reader_buttons[current])


func _line(content: String, language: String, color: Color) -> Label:
	var label := Label.new()
	label.text = content
	label.language = language
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", 16)
	return label
