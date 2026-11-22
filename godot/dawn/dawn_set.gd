extends Node3D

const FLOOR_Y := 3.60
const WINDOW_BOTTOM := 4.50
const OPENING_TOP := 5.49
const OPENING_HALF_WIDTH := 0.86
const BED_SIDE := Vector3(1.20, FLOOR_Y, -3.90)
const MOTHER_THRESHOLD := Vector3(-4.92, 3.02, -7.48)
const MOTHER_APPROACH := Vector3(-4.22, 3.02, -9.68)
const MOTHER_FACE := Vector3(-3.10, 2.48, -11.15)
const MOTHER_CUDDLE := Vector3(-3.58, 2.40, -10.72)
const MOTHER_ROOM_OVERVIEW := Vector3(-4.97, 3.17, -8.85)
const MOTHER_SCREEN_VIEW := Vector3(-6.12, 3.04, -9.0)
const MOTHER_SCREEN_FOCUS := Vector3(-6.63, 2.62, -10.55)
const HALL_VIEW := Vector3(-8.25, 2.0, -10.38)
const HALL_FOCUS := Vector3(-9.54, 1.91, -11.82)
const HALL_LISTENER := Vector3(-8.82, 1.89, -11.56)
const SurfaceFinish := preload("res://dawn/street_surfaces.gdshader")
const LowerStorySet := preload("res://dawn/lower_story_set.gd")
enum Finish { PLASTER, BRICK, SLATE, SETTS, TIMBER, LINEN, WALLPAPER, BEDDING, CERAMIC }

var curtain_left: Node3D
var curtain_right: Node3D
var maid: Node3D
var maid_arm: MeshInstance3D
var window_light: OmniLight3D
var bedroom_daylight: SpotLight3D
var entry_leaf: Node3D
var bed_child: MeshInstance3D
var mother_actor: Node3D
var doctor_actor: Node3D
var nurse_actor: Node3D
var mother_door: Node3D
var lower_story := LowerStorySet.new()
var empty_blanket: MeshInstance3D
var palette: Dictionary = {}
var finishes: Dictionary = {}


func build() -> void:
	_build_light()
	_build_street()
	_build_bedroom()
	_build_stairwell()
	_build_maid()
	add_child(lower_story)
	lower_story.build()
	mother_actor = lower_story.mother_actor
	doctor_actor = lower_story.doctor_actor
	nurse_actor = lower_story.nurse_actor
	mother_door = lower_story.mother_door


func reset_chapter_set() -> void:
	lower_story.reset_actors()


func set_mother_door(amount: float) -> void:
	lower_story.set_door(amount)


func pose_mother(reach_amount: float, embrace: float, adult_progress: float = 0.0) -> void:
	lower_story.pose_mother(reach_amount, embrace, adult_progress)
	if embrace > 0.0:
		maid.position = maid.position.lerp(Vector3(-4.58, 1.39, -9.83), embrace)


func stage_adults(beat: String, amount: float = 1.0) -> void:
	maid.hide()
	lower_story.stage_adults(beat, amount)


func set_performance(entry: float, curtain: float, walk_to_bed: float) -> void:
	bed_child.show()
	empty_blanket.hide()
	maid.visible = entry > 0.0
	var doorway := Vector3(-3.77, FLOOR_Y, -1.40)
	var window_side := Vector3(-1.10, FLOOR_Y, -0.54)
	maid.position = doorway.lerp(window_side, entry).lerp(BED_SIDE, walk_to_bed)
	var walking := (entry > 0.0 and entry < 1.0) or (walk_to_bed > 0.0 and walk_to_bed < 1.0)
	var stride := sin((entry + walk_to_bed) * 5.0 * TAU) if walking else 0.0
	maid.position.y += 0.024 * absf(stride)
	var from := doorway if walk_to_bed == 0.0 else window_side
	var to := window_side if walk_to_bed == 0.0 else BED_SIDE
	maid.rotation.y = atan2(to.x - from.x, to.z - from.z)
	if walk_to_bed > 0.84:
		var child := Vector3(2.02, FLOOR_Y, -4.12) - maid.position
		maid.rotation.y = lerp_angle(maid.rotation.y, atan2(child.x, child.z),
			smoothstep(0.84, 1.0, walk_to_bed))
	if entry >= 1.0 and walk_to_bed == 0.0:
		maid.rotation.y = lerpf(PI, PI * 0.82, curtain)
	var reach := sin(curtain * PI)
	maid_arm.position.y = 1.16 + 0.18 * reach
	maid_arm.rotation.x = reach * 1.08 + stride * 0.19
	maid_arm.rotation.z = 0.12
	maid_arm.position.z = 0.0
	entry_leaf.rotation.y = smoothstep(0.0, 0.24, entry) * (PI * 0.5)
	curtain_left.position.x = lerpf(-0.65, -0.91, curtain)
	curtain_right.position.x = -curtain_left.position.x
	curtain_left.scale.x = lerpf(1.0, 0.83, curtain)
	curtain_right.scale.x = curtain_left.scale.x
	window_light.light_energy = lerpf(0.38, 0.74, curtain)
	bedroom_daylight.light_energy = lerpf(0.24, 1.20, curtain)


func offer_hand(amount: float) -> void:
	maid_arm.rotation.x = amount * 1.04
	maid_arm.rotation.z = lerpf(0.12, -0.24, amount)
	maid_arm.position.z = amount * 0.24


func pose_carry(eye_position: Vector3, heading: float, amount: float) -> void:
	var behind := Vector3(sin(heading), 0, cos(heading)) * 0.54
	var carried_pose := eye_position + behind - Vector3.UP * 1.61
	maid.position = BED_SIDE.lerp(carried_pose, amount)
	maid.rotation.y = lerp_angle(maid.rotation.y, heading + PI, amount)
	maid_arm.rotation.x = lerpf(1.04, -0.92, amount)
	maid_arm.position.z = lerpf(0.24, 0.18, amount)
	bed_child.visible = amount < 0.40
	empty_blanket.visible = not bed_child.visible


func _build_light() -> void:
	var sky_shader := ShaderMaterial.new()
	sky_shader.shader = preload("res://dawn/overcast.gdshader")
	var sky := Sky.new()
	sky.sky_material = sky_shader
	var weather := Environment.new()
	weather.background_mode = Environment.BG_SKY
	weather.sky = sky
	weather.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	weather.ambient_light_color = Color("#a9b0bd")
	weather.ambient_light_energy = 0.77
	weather.fog_enabled = true
	weather.fog_density = 0.008
	weather.fog_light_color = Color("#6f7783")
	weather.fog_sky_affect = 0.0
	var world_environment := WorldEnvironment.new()
	world_environment.environment = weather
	add_child(world_environment)

	var daylight := DirectionalLight3D.new()
	daylight.rotation_degrees = Vector3(-36, -26, 0)
	daylight.light_color = Color("#becbe1")
	daylight.light_energy = 0.33
	daylight.shadow_enabled = true
	daylight.shadow_opacity = 0.44
	daylight.directional_shadow_max_distance = 38.0
	add_child(daylight)


func _build_street() -> void:
	_clad(Vector3(0, -0.22, 8), Vector3(145, 0.35, 68), "#4f5154", Finish.SETTS)
	_clad(Vector3(0, -0.03, 1.04), Vector3(58, 0.24, 2.16), "#777473", Finish.PLASTER)
	_clad(Vector3(0, -0.03, 10.72), Vector3(58, 0.24, 2.10), "#737477", Finish.PLASTER)
	for index in range(-6, 7):
		var x := float(index) * 6.1
		var height := 5.2 + float(posmod(index * 7, 9)) * 0.44
		var row_z := -20.0 + float(posmod(index, 3))
		_box(self, Vector3(x, height / 2.0, row_z),
			Vector3(5.84, height, 4.0), "#68696c")
		for side in [-1.0, 1.0]:
			var back_roof := _box(self, Vector3(x, height + 0.44, row_z + side),
				Vector3(5.97, 0.14, 2.35), "#5c6169")
			back_roof.rotation.x = side * 0.36
		_box(self, Vector3(x + 1.2, height + 1.03, row_z), Vector3(0.48, 0.77, 0.51), "#626267")
	for block in range(-3, 4):
		var x := float(block) * 7.20
		var plaster: String = ["#857970", "#735f57", "#746e66"][posmod(block, 3)]
		_opposite_house(x, 12.10, plaster)
		if block != 0:
			_side_house(x, plaster)
	_iron_rail(Vector3(0, 0.09, 10.55))
	for index in range(-21, 22):
		var x := float(index) * 0.97
		_box(self, Vector3(x, 0.07, 2.02), Vector3(0.925, 0.14, 0.13), "#969393")
		_box(self, Vector3(x, 0.07, 9.73), Vector3(0.925, 0.14, 0.13), "#969393")


func _opposite_house(x: float, z: float, plaster: String) -> void:
	_clad(Vector3(x, 3.50, z + 1.50), Vector3(7.10, 7.0, 3.0), plaster, Finish.PLASTER)
	_roof(x, z + 1.60, 7.14, 3.24)
	for level in [1.85, 4.90]:
		for offset in [-2.04, 0.0, 2.04]:
			if level < 2.0 and offset == 0.0:
				continue
			_front_window(Vector3(x + offset, level, z - 0.04), -1.0)
	_front_door(x, z, -1.0, "#504846")
	_box(self, Vector3(x, 2.33, z - 0.48), Vector3(2.30, 0.24, 1.17), "#a39a90")
	for side in [-1.0, 1.0]:
		var pediment := _box(self, Vector3(x + side * 0.52, 2.65, z - 1.04),
			Vector3(1.21, 0.11, 0.18), "#ada599")
		pediment.rotation.z = -side * 0.315
	for offset in [-0.82, 0.82]:
		var column := CylinderMesh.new()
		column.top_radius = 0.087
		column.bottom_radius = 0.105
		column.height = 2.03
		column.radial_segments = 14
		_mesh(self, column, Vector3(x + offset, 1.19, z - 0.83), "#a39a90")
		for level in [0.20, 2.18]:
			_box(self, Vector3(x + offset, level, z - 0.83), Vector3(0.29, 0.10, 0.29), "#a39a90")
	_box(self, Vector3(x, 3.51, z - 0.07), Vector3(7.11, 0.15, 0.26), "#a29890")


func _side_house(x: float, plaster: String) -> void:
	if is_equal_approx(x, -7.20):
		_clad(Vector3(x, 3.50, 0), Vector3(7.08, 7.0, 0.21), plaster, Finish.BRICK)
	else:
		_clad(Vector3(x, 3.50, -2.38), Vector3(7.08, 7.0, 4.82), plaster, Finish.BRICK)
	_roof(x, -2.55, 7.15, 5.14)
	for level in [1.75, 5.30]:
		_front_window(Vector3(x - 1.85, level, 0.05), 1.0)
		if level > 3.0:
			_front_window(Vector3(x + 1.62, level, 0.05), 1.0)
	_front_door(x + 1.63, 0, 1.0, "#444443")
	_box(self, Vector3(x, 3.54, 0.07), Vector3(7.12, 0.117, 0.22), "#908880")
	_box(self, Vector3(x, 0.30, 0.09), Vector3(7.14, 0.32, 0.19), "#655f5d")


func _roof(x: float, z: float, width: float, depth: float) -> void:
	var ridge_angle := deg_to_rad(23.0)
	for side in [-1.0, 1.0]:
		var section := _clad(Vector3(x, 7.13 + depth * 0.105, z + side * depth * 0.25),
			Vector3(width + 0.18, 0.17, depth * 0.56), "#4c4e54", Finish.SLATE)
		section.rotation.x = side * ridge_angle
	_box(self, Vector3(x, 7.03, z), Vector3(width + 0.20, 0.30, depth + 0.06), "#57575c")
	_box(self, Vector3(x, 7.21 + depth * 0.21, z), Vector3(width + 0.15, 0.12, 0.21), "#444449")
	for offset in [-2.34, 2.47]:
		_clad(Vector3(x + offset, 7.85, z - 0.37), Vector3(0.58, 1.33, 0.52), "#75605b", Finish.BRICK)
		_box(self, Vector3(x + offset, 8.51, z - 0.37), Vector3(0.69, 0.14, 0.66), "#62524e")


func _front_window(center: Vector3, outward: float) -> void:
	_box(self, center, Vector3(1.18, 1.91, 0.19), "#9b938b")
	var panel := center + Vector3(0, 0, outward * 0.105)
	_box(self, panel, Vector3(0.92, 1.57, 0.06), "#515a68")
	var face := panel + Vector3(0, 0, outward * 0.038)
	_box(self, face, Vector3(0.048, 1.58, 0.035), "#aca59a")
	_box(self, face, Vector3(0.93, 0.058, 0.035), "#aca59a")
	_box(self, face + Vector3(0, -0.83, 0), Vector3(1.26, 0.125, 0.14), "#a39c95")


func _front_door(x: float, z: float, outward: float, color: String) -> void:
	_box(self, Vector3(x, 1.15, z + outward * 0.085), Vector3(1.25, 2.30, 0.18), "#77706a")
	var face := z + outward * 0.194
	_clad(Vector3(x, 1.12, face), Vector3(0.99, 2.18, 0.09), color, Finish.TIMBER)
	for rail in [0.28, 0.99, 1.98]:
		_box(self, Vector3(x, rail, face + outward * 0.05), Vector3(0.82, 0.071, 0.048), "#615750")
	_box(self, Vector3(x + 0.30, 1.09, face + outward * 0.074), Vector3(0.061, 0.042, 0.049), "#9a8057")
	_box(self, Vector3(x, 0.13, face + outward * 0.16), Vector3(1.35, 0.24, 0.47), "#90877c")


func _iron_rail(origin: Vector3) -> void:
	for side in [-1.0, 1.0]:
		_box(self, origin + Vector3(side * 2.37, 0.74, 0), Vector3(2.44, 0.038, 0.042), "#403f40")
		for index in range(13):
			_box(self, origin + Vector3(side * (1.18 + float(index) * 0.20), 0.44, 0),
				Vector3(0.028, 0.87, 0.028), "#414044")


func _build_bedroom() -> void:
	_roof(0, -2.5, 7.19, 5.65)
	_clad(Vector3(0, 1.80, -0.06), Vector3(7.16, 3.60, 0.27), "#827169", Finish.BRICK)
	_front_window(Vector3(-1.88, 1.79, 0.115), 1.0)
	_front_window(Vector3(1.88, 1.79, 0.115), 1.0)
	_front_door(0, 0.02, 1.0, "#49423d")
	_box(self, Vector3(0, FLOOR_Y, -2.38), Vector3(7.20, 0.18, 4.76), "#4c3930")
	for index in range(28):
		var x := -3.49 + index * 0.26
		var joint := -1.18 - float(posmod(index * 19, 29)) * 0.084
		for segment in [[-4.76, joint], [joint, -0.035]]:
			var plank_color: String = ["#655443", "#5b493b", "#57483d", "#614f40"][posmod(index * 5 + int(segment[1] * 10.0), 4)]
			_clad(Vector3(x, FLOOR_Y + 0.095, (segment[0] + segment[1]) * 0.5),
				Vector3(0.251, 0.027, segment[1] - segment[0] - 0.007), plank_color, Finish.TIMBER)
	_box(self, Vector3(0, 6.81, -2.39), Vector3(7.21, 0.19, 4.84), "#979184")
	var paper := "#585747"
	_clad(Vector3(3.53, 5.21, -2.37), Vector3(0.18, 3.15, 4.88), paper, Finish.WALLPAPER)
	_clad(Vector3(-3.53, 5.21, -3.42), Vector3(0.18, 3.15, 2.87), paper, Finish.WALLPAPER)
	_clad(Vector3(-3.53, 5.21, -0.40), Vector3(0.18, 3.15, 0.88), paper, Finish.WALLPAPER)
	_clad(Vector3(-3.53, 6.43, -1.42), Vector3(0.18, 0.71, 1.11), paper, Finish.WALLPAPER)
	for side in [-1.0, 1.0]:
		_clad(Vector3(side * 2.26, 5.20, 0), Vector3(2.80, 3.17, 0.26), "#827169", Finish.BRICK)
		_clad(Vector3(side * 2.27, 5.20, -0.145), Vector3(2.81, 3.17, 0.035), paper, Finish.WALLPAPER)
		_clad(Vector3(side * 3.41, 6.66, -2.41), Vector3(0.081, 0.080, 4.61), "#736c5a", Finish.PLASTER)
		_clad(Vector3(0, 6.66, -2.4 + side * 2.21), Vector3(6.78, 0.08, 0.086), "#736c5a", Finish.PLASTER)
	_clad(Vector3(3.42, 3.81, -2.40), Vector3(0.065, 0.19, 4.66), "#594235", Finish.TIMBER)
	_clad(Vector3(-3.42, 3.81, -3.43), Vector3(0.065, 0.19, 2.85), "#594235", Finish.TIMBER)
	_clad(Vector3(-3.42, 3.81, -0.43), Vector3(0.065, 0.19, 0.81), "#594235", Finish.TIMBER)
	for z in [-0.177, -4.68]:
		_clad(Vector3(0, 3.814, z), Vector3(6.86, 0.192, 0.056), "#594235", Finish.TIMBER)
		_clad(Vector3(0, 3.917, z), Vector3(6.86, 0.026, 0.076), "#70523a", Finish.TIMBER)
	_clad(Vector3(0, 5.20, -4.79), Vector3(7.16, 3.17, 0.22), paper, Finish.WALLPAPER)
	_build_inner_door()
	_clad(Vector3(0, 4.05, 0), Vector3(1.75, 0.90, 0.26), "#827169", Finish.BRICK)
	_clad(Vector3(0, 6.62, 0), Vector3(1.75, 0.45, 0.26), "#827169", Finish.BRICK)
	_clad(Vector3(0, 4.05, -0.155), Vector3(1.75, 0.89, 0.038), paper, Finish.WALLPAPER)
	_clad(Vector3(0, 6.62, -0.155), Vector3(1.75, 0.45, 0.038), paper, Finish.WALLPAPER)
	_box(self, Vector3(0, 3.53, 0.03), Vector3(7.19, 0.13, 0.30), "#968c83")
	_box(self, Vector3(2.12, 0.22, 0.084), Vector3(2.86, 0.37, 0.29), "#69635f")
	_box(self, Vector3(-2.12, 0.22, 0.084), Vector3(2.86, 0.37, 0.29), "#69635f")
	_build_window()
	_build_furniture()
	window_light = _lamp(Vector3(0.08, 5.38, -0.70), "#afc3e8", 0.58, 6.0)
	bedroom_daylight = SpotLight3D.new()
	bedroom_daylight.position = Vector3(0.17, 5.29, -0.43)
	bedroom_daylight.light_color = Color("#aabfe0")
	bedroom_daylight.spot_range = 6.5
	bedroom_daylight.spot_angle = 42.0
	bedroom_daylight.spot_attenuation = 0.7
	bedroom_daylight.shadow_enabled = true
	bedroom_daylight.shadow_opacity = 0.47
	add_child(bedroom_daylight)
	bedroom_daylight.look_at(Vector3(0.85, 3.68, -3.55))
	_lamp(Vector3(2.93, 4.66, -3.60), "#eda36a", 0.64, 3.15)


func _build_inner_door() -> void:
	var trim := "#614936"
	for z in [-1.97, -0.86]:
		_clad(Vector3(-3.39, 4.83, z), Vector3(0.16, 2.39, 0.11), trim, Finish.TIMBER)
	_clad(Vector3(-3.39, 6.02, -1.415), Vector3(0.16, 0.12, 1.22), trim, Finish.TIMBER)
	entry_leaf = Node3D.new()
	entry_leaf.position = Vector3(-3.43, FLOOR_Y, -1.93)
	add_child(entry_leaf)
	_box(entry_leaf, Vector3(0, 1.21, 0.515), Vector3(0.090, 2.22, 1.03), "#4d392d")
	for level in [4.35, 5.37]:
		_box(entry_leaf, Vector3(0.052, level - FLOOR_Y, 0.515), Vector3(0.036, 0.79, 0.80), "#563e30")
	_ellipsoid(entry_leaf, Vector3(0.102, 1.12, 0.90), Vector3(0.034, 0.032, 0.032), "#9a7d4d")


func _build_stairwell() -> void:
	var timber := "#614b39"
	var wall := "#5b5847"
	const STAIR_X := -4.92
	_clad(Vector3(-4.70, 3.51, -1.46), Vector3(2.60, 0.18, 1.66), timber, Finish.TIMBER)
	_clad(Vector3(-4.70, 5.18, -0.59), Vector3(2.60, 3.16, 0.18), wall, Finish.WALLPAPER)
	_clad(Vector3(-4.70, 6.75, -4.13), Vector3(2.60, 0.16, 7.10), wall, Finish.PLASTER)
	_clad(Vector3(-5.89, 3.85, -4.11), Vector3(0.19, 5.75, 7.30), wall, Finish.WALLPAPER)
	_clad(Vector3(-4.00, 3.89, -5.02), Vector3(0.16, 5.66, 5.36), wall, Finish.WALLPAPER)
	var spindle := PackedVector2Array([Vector2(0.032, 0.0), Vector2(0.032, 0.08), Vector2(0.021, 0.15),
		Vector2(0.028, 0.26), Vector2(0.041, 0.39), Vector2(0.031, 0.49), Vector2(0.019, 0.59),
		Vector2(0.026, 0.73), Vector2(0.033, 0.81), Vector2(0.032, 0.86)])
	for index in range(13):
		var floor_height := FLOOR_Y - (index + 1) * 0.17
		var step_z := -2.43 - index * 0.28
		var tread: String = [timber, "#584434", "#685141"][index % 3]
		_clad(Vector3(STAIR_X, floor_height - 0.055, step_z), Vector3(1.70, 0.11, 0.29), tread, Finish.TIMBER)
		_clad(Vector3(STAIR_X, floor_height - 0.15, step_z - 0.126), Vector3(1.68, 0.20, 0.035), "#402d23", Finish.TIMBER)
		_clad(Vector3(STAIR_X, floor_height - 0.015, step_z - 0.149), Vector3(1.71, 0.025, 0.037), "#715241", Finish.TIMBER)
		_turned_piece(self, Vector3(-5.66, floor_height, step_z), spindle, "#553b2e", Finish.TIMBER)
		_clad(Vector3(-4.112, floor_height + 0.08, step_z), Vector3(0.065, 0.18, 0.295), "#543827", Finish.TIMBER)
	var handrail := _clad(Vector3(-5.66, 3.28, -4.10), Vector3(0.12, 0.090, 4.18), "#5c4030", Finish.TIMBER)
	handrail.rotation.x = -0.55
	var rail_cap := _clad(Vector3(-5.66, 3.336, -4.10), Vector3(0.139, 0.036, 4.20), "#76523a", Finish.TIMBER)
	rail_cap.rotation.x = -0.55
	var newel := PackedVector2Array([Vector2(0.081, 0), Vector2(0.077, 0.10), Vector2(0.070, 0.15),
		Vector2(0.064, 0.26), Vector2(0.049, 0.40), Vector2(0.053, 0.55), Vector2(0.069, 0.67),
		Vector2(0.061, 0.80), Vector2(0.079, 0.88), Vector2(0.076, 0.94)])
	for origin in [Vector3(-5.66, 3.54, -2.22), Vector3(-5.66, 1.39, -5.98)]:
		_turned_piece(self, origin, newel, "#523523", Finish.TIMBER)
		var knob := _ellipsoid(self, origin + Vector3(0, 1.006, 0), Vector3(0.074, 0.082, 0.074), "#5d3e2b")
		knob.material_override = _finish_material("#5d3e2b", Finish.TIMBER)
	_build_stair_sash()
	_clad(Vector3(STAIR_X, 1.30, -6.77), Vector3(1.75, 0.18, 1.87), timber, Finish.TIMBER)
	_clad(Vector3(STAIR_X, 5.21, -7.68), Vector3(1.98, 3.01, 0.16), wall, Finish.PLASTER)
	_lamp(Vector3(-4.53, 5.65, -2.04), "#b9c7dd", 0.72, 4.5)
	_lamp(Vector3(-4.54, 3.57, -6.20), "#efb57c", 0.62, 3.7)


func _build_stair_sash() -> void:
	var frame := "#8b8371"
	const SASH_Z := -3.12
	_clad(Vector3(-5.77, 5.25, SASH_Z), Vector3(0.13, 1.74, 1.04), frame, Finish.TIMBER)
	var glazing := _box(self, Vector3(-5.69, 5.23, SASH_Z), Vector3(0.047, 1.51, 0.82), "#697c96")
	var window_glass := StandardMaterial3D.new()
	window_glass.albedo_color = Color("#a8b7ce")
	window_glass.emission_enabled = true
	window_glass.emission = Color("#8091ac")
	window_glass.emission_energy_multiplier = 0.26
	window_glass.roughness = 0.49
	glazing.material_override = window_glass
	for offset in [-0.45, 0.0, 0.45]:
		_clad(Vector3(-5.649, 5.23, SASH_Z + offset), Vector3(0.072, 1.62, 0.052), frame, Finish.TIMBER)
	_clad(Vector3(-5.642, 5.25, SASH_Z), Vector3(0.084, 0.062, 0.92), frame, Finish.TIMBER)
	_clad(Vector3(-5.649, 4.42, SASH_Z), Vector3(0.305, 0.083, 1.10), "#9b9485", Finish.PLASTER)
	_lamp(Vector3(-5.56, 5.27, SASH_Z), "#a3bee5", 0.85, 2.50)


func _build_window() -> void:
	var wood := "#796c58"
	for side in [-1.0, 1.0]:
		_clad(Vector3(side * OPENING_HALF_WIDTH, 5.42, 0), Vector3(0.13, 1.95, 0.24), wood, Finish.TIMBER)
		_clad(Vector3(side * 0.95, 5.42, 0.13), Vector3(0.12, 2.06, 0.10), "#9e9482", Finish.PLASTER)
		_clad(Vector3(side * 0.81, 5.42, -0.115), Vector3(0.035, 1.86, 0.056), "#9a8a71", Finish.TIMBER)
	_clad(Vector3(0, 4.43, 0.108), Vector3(2.10, 0.14, 0.37), "#9b9286", Finish.PLASTER)
	_clad(Vector3(0, 4.45, -0.130), Vector3(1.89, 0.082, 0.35), wood, Finish.TIMBER)
	_clad(Vector3(0, 6.40, 0), Vector3(1.82, 0.13, 0.27), wood, Finish.TIMBER)
	_clad(Vector3(0, 6.52, 0.15), Vector3(2.13, 0.16, 0.23), "#a19889", Finish.PLASTER)
	# The lower sash is raised against the upper sash. The bottom half is empty.
	for depth in [-0.065, 0.073]:
		_clad(Vector3(0, OPENING_TOP + 0.045, depth), Vector3(1.65, 0.093, 0.067), wood, Finish.TIMBER)
		_clad(Vector3(0, 5.99, depth), Vector3(0.056, 0.89, 0.052), wood, Finish.TIMBER)
		_clad(Vector3(0, 5.97, depth), Vector3(1.65, 0.055, 0.057), wood, Finish.TIMBER)
	_glaze_upper_sash()
	for offset in [-0.47, 0.47]:
		_box(self, Vector3(offset, OPENING_TOP + 0.058, -0.118), Vector3(0.109, 0.021, 0.027), "#937a56")
	_clad(Vector3(0, 6.40, -0.44), Vector3(2.27, 0.066, 0.074), "#5b4434", Finish.TIMBER)
	for side in [-1.0, 1.0]:
		_clad(Vector3(side * 1.10, 6.4, -0.275), Vector3(0.078, 0.080, 0.25), "#654831", Finish.TIMBER)
		_ellipsoid(self, Vector3(side * 1.16, 6.40, -0.44), Vector3(0.045, 0.041, 0.041), "#694d37")
	curtain_left = _curtain()
	curtain_right = _curtain()


func _glaze_upper_sash() -> void:
	var pane := QuadMesh.new()
	pane.size = Vector2(1.63, 0.85)
	var glazing := MeshInstance3D.new()
	glazing.mesh = pane
	glazing.position = Vector3(0, 5.978, 0.019)
	glazing.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var glass := StandardMaterial3D.new()
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass.cull_mode = BaseMaterial3D.CULL_DISABLED
	glass.albedo_color = Color(0.56, 0.64, 0.72, 0.16)
	glass.roughness = 0.26
	glazing.material_override = glass
	add_child(glazing)


func _curtain() -> Node3D:
	var cloth := Node3D.new()
	cloth.position = Vector3(0, 0, -0.44)
	add_child(cloth)
	const COLUMNS := 56
	const ROWS := 12
	var fabric := SurfaceTool.new()
	fabric.begin(Mesh.PRIMITIVE_TRIANGLES)
	for row in range(ROWS + 1):
		var v := float(row) / ROWS
		for column in range(COLUMNS + 1):
			var u := float(column) / COLUMNS
			var pleat := sin(u * TAU * 5.3 + v * 0.43)
			var spread := lerpf(0.59, 0.65, v)
			var sag := sin(u * TAU * 2.7) * 0.024 * v * v
			fabric.set_uv(Vector2(u, v))
			fabric.add_vertex(Vector3((u - 0.5) * spread, 6.37 - v * 2.05 + sag,
				pleat * lerpf(0.022, 0.052, v)))
	for row in ROWS:
		for column in COLUMNS:
			var corner := row * (COLUMNS + 1) + column
			for index in [corner, corner + 1, corner + COLUMNS + 1,
					corner + 1, corner + COLUMNS + 2, corner + COLUMNS + 1]:
				fabric.add_index(index)
	fabric.generate_normals()
	var panel := _mesh(cloth, fabric.commit(), Vector3.ZERO, "#795147")
	panel.material_override = _finish_material("#795147", Finish.LINEN)
	return cloth


func _build_furniture() -> void:
	var bed := Node3D.new()
	bed.position = Vector3(2.02, FLOOR_Y + 0.1, -3.39)
	add_child(bed)
	var bed_wood := "#593a2b"
	_clad_parent(bed, Vector3(0, 0.38, 0), Vector3(1.29, 0.28, 2.02), bed_wood, Finish.TIMBER)
	var post := PackedVector2Array([Vector2(0.054, 0.00), Vector2(0.062, 0.085), Vector2(0.047, 0.16),
		Vector2(0.052, 0.32), Vector2(0.057, 0.57), Vector2(0.053, 0.69), Vector2(0.070, 0.75)])
	for x in [-0.61, 0.61]:
		for z in [-0.96, 0.96]:
			var post_mesh := _turned_piece(bed, Vector3(x, 0, z), post, bed_wood, Finish.TIMBER)
			post_mesh.scale.y = 1.20 if z < 0 else 1.0
			var finial_height := 0.95 if z < 0 else 0.795
			var finial := _ellipsoid(bed, Vector3(x, finial_height, z), Vector3(0.061, 0.052, 0.061), bed_wood)
			finial.material_override = _finish_material(bed_wood, Finish.TIMBER)
	_bed_board(bed, -0.97, 0.89, bed_wood)
	_bed_board(bed, 0.97, 0.74, bed_wood)
	_ellipsoid(bed, Vector3(0, 0.60, 0), Vector3(0.61, 0.143, 0.99), "#b8ab99")
	var pillow := _ellipsoid(bed, Vector3(0, 0.733, -0.70), Vector3(0.52, 0.091, 0.23), "#d5cab4")
	pillow.material_override = _finish_material("#d5cab4", Finish.BEDDING)
	empty_blanket = _blanket(bed, false)
	bed_child = _blanket(bed, true)

	var stand := Node3D.new()
	stand.position = Vector3(1.93, FLOOR_Y + 0.10, -0.65)
	add_child(stand)
	var stand_wood := "#634331"
	_clad_parent(stand, Vector3(0, 0.764, 0), Vector3(0.92, 0.056, 0.58), stand_wood, Finish.TIMBER)
	_clad_parent(stand, Vector3(0, 0.675, 0.01), Vector3(0.84, 0.145, 0.49), stand_wood, Finish.TIMBER)
	_clad_parent(stand, Vector3(0, 0.675, -0.25), Vector3(0.73, 0.106, 0.025), "#785439", Finish.TIMBER)
	_ellipsoid(stand, Vector3(0, 0.67, -0.276), Vector3(0.024, 0.022, 0.020), "#9a7950")
	_clad_parent(stand, Vector3(0, 0.26, 0), Vector3(0.76, 0.039, 0.47), stand_wood, Finish.TIMBER)
	_clad_parent(stand, Vector3(0, 0.92, 0.24), Vector3(0.86, 0.27, 0.044), stand_wood, Finish.TIMBER)
	for x in [-0.36, 0.36]:
		for z in [-0.21, 0.21]:
			var leg := _turned_piece(stand, Vector3(x, 0, z), post, stand_wood, Finish.TIMBER)
			leg.scale = Vector3(0.61, 0.87, 0.61)
	var bowl := PackedVector2Array([Vector2(0.068, 0.0), Vector2(0.10, 0.005), Vector2(0.13, 0.023),
		Vector2(0.175, 0.060), Vector2(0.197, 0.103), Vector2(0.195, 0.114), Vector2(0.175, 0.114),
		Vector2(0.159, 0.076), Vector2(0.117, 0.039), Vector2(0.060, 0.024), Vector2(0.001, 0.022)])
	_turned_piece(stand, Vector3(0.055, 0.793, 0.015), bowl, "#c4b6a0", Finish.CERAMIC)
	var pitcher := PackedVector2Array([Vector2(0.052, 0.0), Vector2(0.072, 0.017), Vector2(0.098, 0.074),
		Vector2(0.097, 0.115), Vector2(0.079, 0.160), Vector2(0.054, 0.200), Vector2(0.041, 0.243),
		Vector2(0.048, 0.275), Vector2(0.067, 0.288), Vector2(0.064, 0.300), Vector2(0.052, 0.300),
		Vector2(0.042, 0.276), Vector2(0.035, 0.237), Vector2(0.036, 0.199)])
	_turned_piece(stand, Vector3(0.04, 0.821, 0.022), pitcher, "#d1c6b4", Finish.CERAMIC)
	var handle_shape := TorusMesh.new()
	handle_shape.inner_radius = 0.040
	handle_shape.outer_radius = 0.062
	handle_shape.rings = 20
	handle_shape.ring_segments = 9
	var handle := _mesh(stand, handle_shape, Vector3(-0.039, 1.006, 0.022), "#d1c6b4")
	handle.rotation.x = PI * 0.5
	handle.scale = Vector3(0.86, 1.0, 1.20)
	handle.material_override = _finish_material("#d1c6b4", Finish.CERAMIC)
	_clad_parent(stand, Vector3(-0.236, 0.647, -0.294), Vector3(0.185, 0.214, 0.022), "#b4a495", Finish.BEDDING)


func _bed_board(bed: Node3D, depth: float, upper: float, color: String) -> void:
	var outline := PackedVector2Array([Vector2(-0.59, 0.42), Vector2(0.59, 0.42),
		Vector2(0.59, upper - 0.08), Vector2(0.38, upper - 0.029), Vector2(0.15, upper),
		Vector2(-0.15, upper), Vector2(-0.38, upper - 0.029), Vector2(-0.59, upper - 0.08)])
	var board := CSGPolygon3D.new()
	board.polygon = outline
	board.depth = 0.095
	board.position.z = depth + 0.04
	board.material = _finish_material(color, Finish.TIMBER)
	bed.add_child(board)


func _blanket(bed: Node3D, occupied: bool) -> MeshInstance3D:
	const WIDTH := 28
	const LENGTH := 35
	var fabric := SurfaceTool.new()
	fabric.begin(Mesh.PRIMITIVE_TRIANGLES)
	for row in range(LENGTH + 1):
		var v := float(row) / LENGTH
		for column in range(WIDTH + 1):
			var u := float(column) / WIDTH
			var x := (u - 0.5) * 1.43
			var z := lerpf(-0.54, 1.04, v)
			var drape := maxf(smoothstep(0.57, 0.73, absf(x)), smoothstep(0.91, 1.05, z))
			var soft_folds := sin(u * TAU * 3.1 + v * 5.3) * 0.018 + sin(v * TAU * 2.8 + u * 2.2) * 0.012
			var child := exp(-pow((x + 0.06) / 0.32, 2.0) - pow((z - 0.08) / 0.50, 2.0)) * 0.172 if occupied else 0.0
			var hem := sin(u * TAU * 5.0) * drape * 0.013
			fabric.set_uv(Vector2(u, v))
			fabric.add_vertex(Vector3(x, 0.747 + (0.004 if occupied else 0.0) + child + soft_folds - drape * 0.22 + hem, z))
	for row in LENGTH:
		for column in WIDTH:
			var corner := row * (WIDTH + 1) + column
			for index in [corner, corner + 1, corner + WIDTH + 1,
					corner + 1, corner + WIDTH + 2, corner + WIDTH + 1]:
				fabric.add_index(index)
	fabric.generate_normals()
	var panel := _mesh(bed, fabric.commit(), Vector3.ZERO, "#b4a590")
	panel.material_override = _finish_material("#b4a590", Finish.BEDDING)
	return panel


func _build_maid() -> void:
	maid = Node3D.new()
	add_child(maid)
	var skirt := CylinderMesh.new()
	skirt.top_radius = 0.17
	skirt.bottom_radius = 0.31
	skirt.height = 0.92
	_mesh(maid, skirt, Vector3(0, 0.53, 0), "#3d4444")
	_ellipsoid(maid, Vector3(0, 1.16, 0), Vector3(0.22, 0.33, 0.14), "#3e4745")
	var apron := _ellipsoid(maid, Vector3(0, 0.78, 0.155), Vector3(0.157, 0.31, 0.030), "#bdb3a0")
	apron.material_override = _finish_material("#bdb3a0", Finish.BEDDING)
	_box(maid, Vector3(0, 1.01, 0.154), Vector3(0.34, 0.027, 0.039), "#c8bda9")
	for side in [-1.0, 1.0]:
		var collar := _box(maid, Vector3(side * 0.037, 1.39, 0.12), Vector3(0.074, 0.031, 0.139), "#c4bba6")
		collar.rotation.z = side * 0.43
	for button_height in [1.26, 1.32]:
		_ellipsoid(maid, Vector3(0, button_height, 0.137), Vector3(0.012, 0.012, 0.010), "#766859")
	var complexion := "#ae8473"
	var face := _ellipsoid(maid, Vector3(0, 1.59, 0.01), Vector3(0.110, 0.151, 0.115), complexion)
	var face_mesh := face.mesh as SphereMesh
	face_mesh.radial_segments = 32
	face_mesh.rings = 16
	_ellipsoid(maid, Vector3(0, 1.577, 0.120), Vector3(0.019, 0.029, 0.020), complexion)
	_ellipsoid(maid, Vector3(0, 1.537, 0.108), Vector3(0.024, 0.005, 0.008), "#82594e")
	for side in [-1.0, 1.0]:
		_ellipsoid(maid, Vector3(side * 0.044, 1.611, 0.111), Vector3(0.018, 0.006, 0.008), "#b2a48e")
		_ellipsoid(maid, Vector3(side * 0.041, 1.610, 0.118), Vector3(0.007, 0.007, 0.004), "#4c473c")
		_ellipsoid(maid, Vector3(side * 0.043, 1.635, 0.108), Vector3(0.021, 0.004, 0.004), "#62483b")
	_ellipsoid(maid, Vector3(0, 1.674, -0.031), Vector3(0.132, 0.101, 0.128), "#483730")
	_ellipsoid(maid, Vector3(-0.056, 1.669, 0.084), Vector3(0.057, 0.028, 0.040), "#483730")
	_ellipsoid(maid, Vector3(0, 1.648, -0.135), Vector3(0.054, 0.062, 0.045), "#45352e")
	_ellipsoid(maid, Vector3(0, 1.762, -0.035), Vector3(0.141, 0.039, 0.105), "#c9bfae")
	var sleeve := CapsuleMesh.new()
	sleeve.radius = 0.055
	sleeve.height = 0.52
	var left_arm := _mesh(maid, sleeve, Vector3(-0.235, 1.13, 0), "#3e4745")
	left_arm.rotation.z = -0.12
	maid_arm = _mesh(maid, sleeve, Vector3(0.235, 1.16, 0), "#3e4745")
	maid_arm.rotation.z = 0.12
	for arm in [left_arm, maid_arm]:
		_box(arm, Vector3(0, -0.219, 0), Vector3(0.081, 0.042, 0.072), "#c4bba6")
		_ellipsoid(arm, Vector3(0, -0.271, 0.006), Vector3(0.036, 0.062, 0.024), complexion)


func _lamp(at: Vector3, color: String, power: float, reach: float) -> OmniLight3D:
	var light := OmniLight3D.new()
	light.position = at
	light.light_color = Color.html(color)
	light.light_energy = power
	light.omni_range = reach
	add_child(light)
	return light


func _box(parent: Node3D, center: Vector3, size: Vector3, color: String) -> MeshInstance3D:
	var cube := BoxMesh.new()
	cube.size = size
	return _mesh(parent, cube, center, color)


func _clad(center: Vector3, size: Vector3, color: String, finish: Finish) -> MeshInstance3D:
	return _clad_parent(self, center, size, color, finish)


func _clad_parent(parent: Node3D, center: Vector3, size: Vector3, color: String, finish: Finish) -> MeshInstance3D:
	var object := _box(parent, center, size, color)
	object.material_override = _finish_material(color, finish)
	return object


func _turned_piece(parent: Node3D, center: Vector3, profile: PackedVector2Array, color: String,
		finish: Finish) -> MeshInstance3D:
	const SIDES := 16
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for ring in range(profile.size()):
		for side in range(SIDES + 1):
			var u := float(side) / SIDES
			var angle := u * TAU
			var radius := profile[ring].x
			surface.set_uv(Vector2(u, float(ring) / (profile.size() - 1)))
			surface.add_vertex(Vector3(cos(angle) * radius, profile[ring].y, sin(angle) * radius))
	for ring in range(profile.size() - 1):
		for side in range(SIDES):
			var index := ring * (SIDES + 1) + side
			for vertex in [index, index + SIDES + 1, index + 1,
					index + 1, index + SIDES + 1, index + SIDES + 2]:
				surface.add_index(vertex)
	surface.generate_normals()
	var object := _mesh(parent, surface.commit(), center, color)
	object.material_override = _finish_material(color, finish)
	return object


func _finish_material(color: String, finish: Finish) -> ShaderMaterial:
	var key := "%s/%s" % [color, finish]
	if not finishes.has(key):
		var material := ShaderMaterial.new()
		material.shader = SurfaceFinish
		material.set_shader_parameter("tint", Color.html(color))
		material.set_shader_parameter("finish", int(finish))
		finishes[key] = material
	return finishes[key]


func _ellipsoid(parent: Node3D, center: Vector3, dimensions: Vector3, color: String) -> MeshInstance3D:
	var sphere := SphereMesh.new()
	sphere.radial_segments = 16
	sphere.rings = 8
	var object := _mesh(parent, sphere, center, color)
	object.scale = dimensions * 2.0
	return object


func _mesh(parent: Node3D, mesh: Mesh, center: Vector3, color: String) -> MeshInstance3D:
	var object := MeshInstance3D.new()
	object.mesh = mesh
	object.position = center
	if not palette.has(color):
		var surface := StandardMaterial3D.new()
		surface.albedo_color = Color.html(color)
		surface.roughness = 0.8
		palette[color] = surface
	object.material_override = palette[color]
	parent.add_child(object)
	return object
