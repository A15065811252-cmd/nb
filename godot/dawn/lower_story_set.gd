extends Node3D
## Rooms, props, and repeatable actor poses for the end of Chapter I.

const SurfacePaint := preload("res://dawn/street_surfaces.gdshader")
const LOWER_FLOOR := 1.39
const HALL_FLOOR := 0.31
const MOTHER_HEAD := Vector3(-3.10, 2.48, -11.15)
const BED_CHILD := Vector3(-3.63, 2.12, -10.64)
const DOCTOR_ENTRY := Vector3(-6.86, LOWER_FLOOR, -9.56)
const DOCTOR_BEDSIDE := Vector3(-4.66, LOWER_FLOOR, -10.43)
const DOCTOR_TABLE := Vector3(-6.66, LOWER_FLOOR, -10.86)
const NURSE_BEDSIDE := Vector3(-4.58, LOWER_FLOOR, -11.50)
const MAID_ROOM_ENTRY := Vector3(-4.92, LOWER_FLOOR, -8.22)
const MAID_BEDSIDE := Vector3(-5.07, LOWER_FLOOR, -9.97)
const HALL_DOCTOR := Vector3(-9.92, HALL_FLOOR, -12.00)
const HALL_MAID := Vector3(-8.92, HALL_FLOOR, -11.59)

const TIMBER := 4
const CURTAIN := 5
const WALLPAPER := 6
const BEDDING := 7
const CERAMIC := 8
const WOOD := "#563a2b"
const TRIM := "#50382d"
const PAPER := "#626051"
const CEILING := "#999184"
const SKIN := "#bc967f"

var mother_door: Node3D
var mother_actor: Node3D
var doctor_actor: Node3D
var nurse_actor: Node3D

var _child: Node3D
var _mother_head: Node3D
var _doctor_head: Node3D
var _doctor_forearm: MeshInstance3D
var _childs_nurse: Node3D
var _cover_corner: Node3D
var _mother_arms: Array[Dictionary] = []
var _materials: Dictionary = {}


func build() -> void:
	_mother_room()
	_departure_hall()
	_build_actors()
	reset_actors()


func set_door(amount: float) -> void:
	mother_door.rotation.y = clampf(amount, 0.0, 1.0) * 1.72


func reset_actors() -> void:
	set_door(0.0)
	pose_mother(0.0, 0.0)
	doctor_actor.hide()
	nurse_actor.hide()
	_childs_nurse.hide()
	_child.hide()
	_cover_corner.rotation.z = 0.0


func pose_mother(reach_amount: float, embrace: float, adult_progress: float = 0.0) -> void:
	var reach_out := clampf(reach_amount, 0.0, 1.0)
	var pull_close := clampf(embrace, 0.0, 1.0)
	var near_rest := Vector3(-3.37, 2.20, -10.29)
	var near_open := Vector3(-3.95, 2.50, -10.49)
	var near_close := Vector3(-3.82, 2.29, -10.85)
	var far_rest := Vector3(-2.96, 2.21, -10.31)
	var far_open := Vector3(-3.33, 2.44, -10.13)
	var far_close := Vector3(-3.34, 2.30, -10.76)
	var near_hand := near_rest.lerp(near_open, reach_out).lerp(near_close, pull_close)
	var far_hand := far_rest.lerp(far_open, reach_out).lerp(far_close, pull_close)
	if adult_progress > 0.0:
		var feet := Vector3(-3.60, 2.24, -10.05)
		near_hand = near_close.lerp(feet, sin(adult_progress * PI * 0.5))
		var across_feet := smoothstep(0.42, 0.86, adult_progress)
		near_hand.x += across_feet * 0.15
	_set_arm(_mother_arms[0], Vector3(-3.39, 2.27, -10.94), near_hand)
	_set_arm(_mother_arms[1], Vector3(-2.93, 2.28, -10.94), far_hand)
	_mother_head.rotation.x = 0.25 + 0.16 * pull_close
	_mother_head.rotation.y = -0.45 - 0.23 * reach_out
	_mother_head.rotation.z = -0.08 * pull_close


func stage_adults(beat: String, amount: float = 1.0) -> void:
	var progress := clampf(amount, 0.0, 1.0)
	var in_hall := beat in ["hall", "shake"]
	var child_in_bed := beat in ["bedside", "feet"]
	var doctor_place := DOCTOR_BEDSIDE
	var maid_place := MAID_BEDSIDE
	var doctor_focus := MOTHER_HEAD
	var maid_focus := MOTHER_HEAD
	var child_place := BED_CHILD
	var child_world_yaw := 0.0
	var nurse_place := NURSE_BEDSIDE
	var examine := 0.0
	var cover_lift := 0.0
	var needs_maid := beat in ["bedside", "feet", "transfer", "return", "pulse", "exit", "hall", "shake"]
	pose_mother(0.0, 1.0 if child_in_bed else 0.0, progress if beat == "feet" else 0.0)
	_doctor_head.rotation = Vector3.ZERO
	if beat == "bedside":
		doctor_place = DOCTOR_ENTRY.lerp(DOCTOR_BEDSIDE, progress)
	elif beat == "transfer":
		examine = sin(progress * PI)
		maid_place = MAID_BEDSIDE.lerp(MAID_ROOM_ENTRY, smoothstep(0.38, 1.0, progress))
		child_place = BED_CHILD.lerp(maid_place + Vector3(0.18, 1.19, -0.13), smoothstep(0.04, 0.56, progress))
		child_world_yaw = 0.4 * progress
	elif beat == "screen":
		doctor_place = DOCTOR_BEDSIDE.lerp(DOCTOR_TABLE, smoothstep(0.0, 0.58, progress))
		doctor_focus = Vector3(-6.68, 2.11, -11.59)
		cover_lift = smoothstep(0.46, 0.69, progress) * (1.0 - smoothstep(0.82, 1.0, progress))
		examine = cover_lift
		_doctor_head.rotation.x = cover_lift * 0.22
	elif beat == "return":
		doctor_place = DOCTOR_BEDSIDE
		maid_place = MAID_ROOM_ENTRY.lerp(MAID_BEDSIDE, progress)
	elif beat == "pulse":
		examine = sin(progress * PI)
		_doctor_head.rotation.x = examine * 0.25
	elif beat == "exit":
		doctor_place = DOCTOR_BEDSIDE.lerp(DOCTOR_ENTRY, progress)
		maid_place = MAID_BEDSIDE.lerp(DOCTOR_ENTRY + Vector3(0.0, 0.0, 0.48), progress)
		doctor_focus = DOCTOR_ENTRY + Vector3.LEFT
		maid_focus = doctor_focus
	elif in_hall:
		doctor_place = HALL_DOCTOR
		maid_place = HALL_MAID
		doctor_focus = HALL_MAID
		maid_focus = HALL_DOCTOR
		if beat == "shake":
			var envelope := smoothstep(0.0, 0.12, progress) * (1.0 - smoothstep(0.68, 1.0, progress))
			_doctor_head.rotation.y = sin(progress * TAU * 2.2) * 0.42 * envelope
			_doctor_head.rotation.x = -0.03 + 0.15 * smoothstep(0.62, 1.0, progress)
	if beat in ["transfer", "screen", "return"]:
		nurse_place.z += 0.12
		nurse_place.x += 0.15
	doctor_actor.position = doctor_place
	doctor_actor.rotation.y = _face(doctor_place, doctor_focus)
	_doctor_forearm.rotation.x = lerpf(0.10, -1.04, examine)
	_doctor_forearm.position.z = lerpf(0.016, 0.23, examine)
	nurse_actor.position = nurse_place
	nurse_actor.rotation.y = _face(nurse_place, MOTHER_HEAD)
	_childs_nurse.position = maid_place
	_childs_nurse.rotation.y = _face(maid_place, maid_focus)
	doctor_actor.show()
	nurse_actor.visible = not in_hall
	_childs_nurse.visible = needs_maid
	_child.visible = child_in_bed or (beat == "transfer" and progress < 0.91)
	_child.position = child_place
	_child.rotation.y = child_world_yaw
	_cover_corner.rotation.z = cover_lift * 0.51


func _mother_room() -> void:
	var room := _group(self, Vector3.ZERO)
	_piece(room, Vector3(-4.77, 1.32, -10.06), Vector3(6.0, 0.14, 4.72), "#4c3428", TIMBER)
	_floorboards(room, -7.69, -1.84, -10.11, 4.58, LOWER_FLOOR + 0.006)
	_piece(room, Vector3(-4.77, 4.42, -10.06), Vector3(6.0, 0.15, 4.72), CEILING)
	_piece(room, Vector3(-6.62, 2.91, -7.68), Vector3(2.32, 3.02, 0.16), PAPER, WALLPAPER)
	_piece(room, Vector3(-3.02, 2.91, -7.68), Vector3(2.67, 3.02, 0.16), PAPER, WALLPAPER)
	_piece(room, Vector3(-4.92, 4.00, -7.68), Vector3(1.10, 0.84, 0.16), PAPER, WALLPAPER)
	_piece(room, Vector3(-1.78, 2.91, -10.06), Vector3(0.16, 3.02, 4.72), PAPER, WALLPAPER)
	_piece(room, Vector3(-4.77, 2.91, -12.40), Vector3(6.0, 3.02, 0.16), PAPER, WALLPAPER)
	_piece(room, Vector3(-7.76, 2.91, -8.28), Vector3(0.16, 3.02, 1.20), PAPER, WALLPAPER)
	_piece(room, Vector3(-7.76, 2.91, -11.26), Vector3(0.16, 3.02, 2.40), PAPER, WALLPAPER)
	_piece(room, Vector3(-7.76, 4.02, -9.45), Vector3(0.16, 0.79, 1.20), PAPER, WALLPAPER)
	_baseboard(room, Vector3(-1.88, 1.49, -10.04), Vector3(0.09, 0.19, 4.55))
	_baseboard(room, Vector3(-4.75, 1.49, -12.29), Vector3(5.72, 0.19, 0.09))
	_baseboard(room, Vector3(-7.64, 1.49, -11.29), Vector3(0.09, 0.19, 2.21))
	_piece(room, Vector3(-4.77, 4.24, -12.23), Vector3(5.90, 0.11, 0.18), "#797366")
	_piece(room, Vector3(-1.94, 4.24, -10.04), Vector3(0.17, 0.11, 4.57), "#797366")
	_frame_door(room, -4.92, LOWER_FLOOR, -7.48)
	mother_door = _group(room, Vector3(-5.43, LOWER_FLOOR, -7.48))
	_door_leaf(mother_door, Vector3(0.51, 1.13, 0.0), 1.02)
	_window(room, Vector3(-5.13, 2.84, -12.27))
	_picture(room, Vector3(-3.06, 3.48, -12.26))
	_bed(room)
	_screen_and_table(room)
	_room_light(room, Vector3(-5.13, 3.07, -11.87), Color("#b7c3d3"), 0.83, 6.5)
	_room_light(room, Vector3(-2.23, 2.84, -11.15), Color("#e9bc88"), 0.85, 4.3)
	_room_light(room, Vector3(-4.66, 2.80, -8.34), Color("#cbbdb2"), 0.37, 4.0)


func _floorboards(parent: Node3D, xmin: float, xmax: float, center_z: float, depth: float, height: float) -> void:
	const BOARD := 0.24
	for index in range(ceili((xmax - xmin) / BOARD)):
		var x := xmin + index * BOARD + BOARD * 0.5
		var color: String = ["#573c2e", "#5d4436", "#604738", "#554031"][index % 4]
		_piece(parent, Vector3(x, height, center_z), Vector3(BOARD - 0.005, 0.021, depth), color, TIMBER)


func _baseboard(parent: Node3D, center: Vector3, size: Vector3) -> void:
	_piece(parent, center, size, TRIM, TIMBER)
	var edge := size
	edge.y = 0.028
	edge.x += 0.026
	edge.z += 0.026
	_piece(parent, center + Vector3.UP * (size.y * 0.5), edge, "#6d5441", TIMBER)


func _frame_door(parent: Node3D, x: float, floor_height: float, z: float) -> void:
	for side in [-1.0, 1.0]:
		_piece(parent, Vector3(x + side * 0.56, floor_height + 1.14, z), Vector3(0.11, 2.28, 0.22), TRIM, TIMBER)
		_piece(parent, Vector3(x + side * 0.62, floor_height + 1.15, z + 0.082), Vector3(0.038, 2.29, 0.07), "#71553f", TIMBER)
	_piece(parent, Vector3(x, floor_height + 2.28, z), Vector3(1.23, 0.15, 0.23), TRIM, TIMBER)
	_piece(parent, Vector3(x, floor_height + 2.36, z), Vector3(1.35, 0.048, 0.27), "#725740", TIMBER)


func _door_leaf(parent: Node3D, center: Vector3, width: float) -> void:
	_piece(parent, center, Vector3(width, 2.23, 0.088), "#4f392d", TIMBER)
	for height in [-0.54, 0.48]:
		_piece(parent, center + Vector3(0.0, height, 0.053), Vector3(width - 0.19, 0.78, 0.028), "#694d38", TIMBER)
		_piece(parent, center + Vector3(0.0, height, 0.072), Vector3(width - 0.27, 0.70, 0.022), "#5a412f", TIMBER)
	_round(parent, center + Vector3(width * 0.29, -0.15, 0.098), Vector3(0.036, 0.036, 0.037), "#ad8b53")


func _window(parent: Node3D, at: Vector3) -> void:
	_piece(parent, at, Vector3(1.43, 1.90, 0.10), "#594f45", TIMBER)
	for column in [-1.0, 1.0]:
		for row in [-1.0, 1.0]:
			var sash := at + Vector3(column * 0.338, row * 0.433, 0.063)
			var pane := _piece(parent, sash, Vector3(0.62, 0.81, 0.02), "#72869c")
			pane.material_override = _overcast_glass("#798496" if row > 0.0 else "#6c7888")
	for side in [-1.0, 1.0]:
		_piece(parent, at + Vector3(side * 0.712, 0, 0.09), Vector3(0.088, 1.98, 0.14), "#958570", TIMBER)
		_piece(parent, at + Vector3(0, side * 0.966, 0.09), Vector3(1.54, 0.10, 0.14), "#8c7d69", TIMBER)
	_piece(parent, at + Vector3(0, 0.01, 0.087), Vector3(1.47, 0.07, 0.09), "#a08d72", TIMBER)
	_piece(parent, at + Vector3(0, 0.0, 0.087), Vector3(0.055, 1.86, 0.09), "#a08d72", TIMBER)
	_piece(parent, at + Vector3(0, -1.00, 0.15), Vector3(1.66, 0.10, 0.28), "#87745f", TIMBER)
	_piece(parent, at + Vector3(0, 1.02, 0.20), Vector3(1.99, 0.055, 0.059), "#544335", TIMBER)
	for side in [-1.0, 1.0]:
		_curtain(parent, at + Vector3(side * 0.71, 1.0, 0.22), 0.40, 2.26)


func _curtain(parent: Node3D, at: Vector3, width: float, length: float) -> void:
	var mesh_tool := SurfaceTool.new()
	mesh_tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	const COLUMNS := 34
	const ROWS := 10
	for row in range(ROWS + 1):
		var v := float(row) / ROWS
		for column in range(COLUMNS + 1):
			var u := float(column) / COLUMNS
			var pleat := sin(u * TAU * 4.0 + v * 0.42) * lerpf(0.027, 0.075, v)
			mesh_tool.set_uv(Vector2(u, v))
			mesh_tool.add_vertex(Vector3((u - 0.5) * width * lerpf(0.86, 1.12, v), -v * length, pleat))
	_grid_faces(mesh_tool, COLUMNS, ROWS)
	_mesh(parent, mesh_tool.commit(), at, _material("#775043", CURTAIN))


func _picture(parent: Node3D, at: Vector3) -> void:
	_piece(parent, at, Vector3(0.97, 0.67, 0.058), "#5a4837", TIMBER)
	_piece(parent, at + Vector3(0, 0, 0.034), Vector3(0.86, 0.55, 0.008), "#ac9983")
	_piece(parent, at + Vector3(0, 0, 0.04), Vector3(0.66, 0.37, 0.008), "#877565")
	_piece(parent, at + Vector3(0, -0.075, 0.047), Vector3(0.65, 0.21, 0.004), "#635e4b")
	_round(parent, at + Vector3(-0.18, -0.045, 0.05), Vector3(0.11, 0.14, 0.006), "#524b3d")
	_round(parent, at + Vector3(0.06, -0.08, 0.05), Vector3(0.15, 0.065, 0.006), "#726550")


func _bed(parent: Node3D) -> void:
	var bed := _group(parent, Vector3(-3.06, LOWER_FLOOR, -10.61))
	_piece(bed, Vector3(0, 0.30, 0), Vector3(1.63, 0.22, 2.17), WOOD, TIMBER)
	for x in [-0.79, 0.79]:
		for z in [-1.055, 1.055]:
			var height := 1.09 if z < 0.0 else 0.69
			_piece(bed, Vector3(x, height * 0.5, z), Vector3(0.12, height, 0.115), WOOD, TIMBER)
			_round(bed, Vector3(x, height + 0.023, z), Vector3(0.072, 0.069, 0.069), "#694934")
	_piece(bed, Vector3(0, 0.73, -1.07), Vector3(1.51, 0.61, 0.11), WOOD, TIMBER)
	_piece(bed, Vector3(0, 1.03, -1.06), Vector3(1.54, 0.08, 0.135), "#6f4e38", TIMBER)
	_piece(bed, Vector3(0, 0.43, 1.07), Vector3(1.53, 0.37, 0.12), WOOD, TIMBER)
	_piece(bed, Vector3(0, 0.63, 1.07), Vector3(1.57, 0.075, 0.15), "#6f4e38", TIMBER)
	_piece(bed, Vector3(0, 0.49, 0), Vector3(1.53, 0.17, 2.07), "#a89a85", BEDDING)
	_quilt(bed, Vector3(0, 0.59, 0.21), 1.70, 1.69, "#c4b6a0", 0.09)
	_quilt(bed, Vector3(0.00, 0.63, 0.71), 1.72, 0.62, "#976e56", 0.014)
	var pillow := _round(bed, Vector3(-0.04, 0.69, -0.65), Vector3(0.64, 0.17, 0.35), "#b4a48c", BEDDING)
	pillow.rotation.x = -0.23
	_side_table(parent, Vector3(-2.04, LOWER_FLOOR, -11.10))


func _quilt(parent: Node3D, center: Vector3, width: float, depth: float, color: String, mound: float) -> void:
	const COLUMNS := 30
	const ROWS := 24
	var mesh_tool := SurfaceTool.new()
	mesh_tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	for row in range(ROWS + 1):
		var v := float(row) / ROWS
		var z := v * 2.0 - 1.0
		for column in range(COLUMNS + 1):
			var u := float(column) / COLUMNS
			var x := u * 2.0 - 1.0
			var roll := smoothstep(0.89, 1.0, absf(x)) * (0.23 + 0.016 * sin(v * 41.0))
			var tuck := smoothstep(0.86, 1.0, absf(z)) * 0.050
			var wrinkles := 0.014 * sin(u * 29.0 + v * 11.0) * sin(v * 16.0)
			var shoulder := mound * exp(-3.5 * pow(x - 0.18, 2.0) - 5.1 * pow(z + 0.48, 2.0))
			mesh_tool.set_uv(Vector2(u, v))
			mesh_tool.add_vertex(Vector3(x * width * 0.5, shoulder + wrinkles - roll - tuck, z * depth * 0.5))
	_grid_faces(mesh_tool, COLUMNS, ROWS)
	_mesh(parent, mesh_tool.commit(), center, _material(color, BEDDING))


func _side_table(parent: Node3D, at: Vector3) -> void:
	var table := _group(parent, at)
	for x in [-0.20, 0.20]:
		for z in [-0.19, 0.19]:
			_piece(table, Vector3(x, 0.35, z), Vector3(0.058, 0.69, 0.067), WOOD, TIMBER)
	_piece(table, Vector3(0, 0.72, 0), Vector3(0.53, 0.075, 0.49), "#664731", TIMBER)
	_piece(table, Vector3(0, 0.57, 0.20), Vector3(0.48, 0.18, 0.075), WOOD, TIMBER)
	_round(table, Vector3(0, 0.57, 0.255), Vector3(0.026, 0.024, 0.024), "#99774b")
	_piece(table, Vector3(0, 0.20, 0), Vector3(0.43, 0.045, 0.41), TRIM, TIMBER)
	_piece(table, Vector3(-0.10, 0.78, 0.09), Vector3(0.13, 0.042, 0.16), "#665047")
	_round(table, Vector3(-0.06, 0.80, -0.095), Vector3(0.104, 0.042, 0.101), "#826648")
	_round(table, Vector3(-0.06, 0.927, -0.095), Vector3(0.072, 0.108, 0.074), "#aa8050")
	var chimney := _round(table, Vector3(-0.06, 1.086, -0.095), Vector3(0.052, 0.13, 0.052), "#cca882")
	var glass := StandardMaterial3D.new()
	glass.albedo_color = Color(0.77, 0.60, 0.43, 0.33)
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass.roughness = 0.41
	chimney.material_override = glass
	var flame := _round(table, Vector3(-0.06, 1.041, -0.095), Vector3(0.018, 0.048, 0.018), "#e8b573")
	flame.material_override = _glow("#cd9359", 0.45)


func _screen_and_table(parent: Node3D) -> void:
	for index in range(3):
		var panel := _group(parent, Vector3(-5.73 + 0.12 * posmod(index, 2), LOWER_FLOOR, -10.64 - 0.53 * index))
		panel.rotation.y = PI * 0.5 + (0.17 if index % 2 == 0 else -0.20)
		_piece(panel, Vector3(0.0, 0.98, 0), Vector3(0.53, 1.82, 0.057), WOOD, TIMBER)
		_piece(panel, Vector3(0.0, 1.00, 0), Vector3(0.44, 1.69, 0.068), "#70604b", WALLPAPER)
		for x in [-0.249, 0.249]:
			_piece(panel, Vector3(x, 0.96, 0), Vector3(0.051, 1.92, 0.078), TRIM, TIMBER)
			_round(panel, Vector3(x, 1.93, 0), Vector3(0.030, 0.033, 0.027), "#755c43")
	var table := _group(parent, Vector3(-6.69, LOWER_FLOOR, -11.65))
	for x in [-0.44, 0.44]:
		for z in [-0.27, 0.27]:
			_piece(table, Vector3(x, 0.36, z), Vector3(0.075, 0.72, 0.075), WOOD, TIMBER)
	_piece(table, Vector3(0, 0.75, 0), Vector3(1.07, 0.090, 0.62), "#60432f", TIMBER)
	_quilt(table, Vector3(0.0, 0.81, 0.0), 0.82, 0.49, "#c3b49d", 0.023)
	_cover_corner = _group(table, Vector3(0.28, 0.82, 0.0))
	_piece(_cover_corner, Vector3(0.089, -0.008, 0.009), Vector3(0.18, 0.035, 0.42), "#b7a88f", BEDDING)
	_round(table, Vector3(-0.36, 0.84, -0.15), Vector3(0.10, 0.049, 0.10), "#bcab94", CERAMIC)


func _departure_hall() -> void:
	var hall := _group(self, Vector3.ZERO)
	var hall_paper := "#565349"
	_piece(hall, Vector3(-9.49, HALL_FLOOR - 0.07, -10.99), Vector3(3.42, 0.14, 4.26), WOOD, TIMBER)
	_floorboards(hall, -11.13, -7.89, -11.80, 2.55, HALL_FLOOR + 0.006)
	_piece(hall, Vector3(-9.42, HALL_FLOOR + 0.02, -11.40), Vector3(1.22, 0.026, 2.37), "#705042", BEDDING)
	for x in [-10.01, -8.83]:
		_piece(hall, Vector3(x, HALL_FLOOR + 0.037, -11.40), Vector3(0.037, 0.013, 2.34), "#a48761", BEDDING)
	_piece(hall, Vector3(-11.20, 1.79, -10.99), Vector3(0.16, 2.97, 4.26), hall_paper, WALLPAPER)
	_piece(hall, Vector3(-9.49, 1.79, -13.10), Vector3(3.42, 2.97, 0.16), hall_paper, WALLPAPER)
	_piece(hall, Vector3(-9.49, 1.94, -8.95), Vector3(3.42, 3.27, 0.16), hall_paper, WALLPAPER)
	_piece(hall, Vector3(-7.81, 1.79, -11.54), Vector3(0.16, 2.97, 3.02), hall_paper, WALLPAPER)
	_piece(hall, Vector3(-9.49, 3.31, -10.99), Vector3(3.40, 0.12, 4.26), CEILING)
	_baseboard(hall, Vector3(-11.09, 0.41, -10.98), Vector3(0.07, 0.20, 4.07))
	_baseboard(hall, Vector3(-9.5, 0.41, -12.99), Vector3(3.25, 0.20, 0.07))
	for index in range(6):
		var step_x := -7.81 - 0.24 * index
		var step_top := LOWER_FLOOR - 0.18 * (index + 1)
		_piece(hall, Vector3(step_x, step_top - 0.12, -9.48), Vector3(0.25, 0.24, 1.06), WOOD, TIMBER)
	_frame_door(hall, -9.64, HALL_FLOOR, -12.92)
	_door_leaf(hall, Vector3(-9.64, HALL_FLOOR + 1.13, -12.91), 1.02)
	var fanlight := _piece(hall, Vector3(-9.64, 2.88, -12.94), Vector3(0.97, 0.35, 0.08), "#a5aeb2")
	fanlight.material_override = _overcast_glass("#7a8797")
	for section in [-0.24, 0.0, 0.24]:
		_piece(hall, Vector3(-9.64 + section, 2.88, -12.89), Vector3(0.026, 0.35, 0.032), "#766e60")
	_side_table(hall, Vector3(-10.83, HALL_FLOOR, -11.29))
	_picture(hall, Vector3(-8.34, 2.18, -12.97))
	_room_light(hall, Vector3(-9.66, 2.79, -12.56), Color("#a9bfd8"), 0.67, 4.2)
	_room_light(hall, Vector3(-10.67, 1.78, -11.31), Color("#e7a265"), 0.81, 3.2)


func _build_actors() -> void:
	mother_actor = _group(self, Vector3.ZERO)
	_mother_head = _portrait(mother_actor, MOTHER_HEAD, "#49352d", 0.96)
	_round(mother_actor, MOTHER_HEAD + Vector3(0.01, -0.145, 0.115), Vector3(0.075, 0.09, 0.072), SKIN)
	var blouse := _round(mother_actor, Vector3(-3.13, 2.24, -10.87), Vector3(0.241, 0.122, 0.29), "#c8b8a0", BEDDING)
	blouse.rotation.x = 0.21
	_round(mother_actor, Vector3(-3.14, 2.31, -11.012), Vector3(0.126, 0.055, 0.081), "#d1c1aa", BEDDING)
	for index in 2:
		var sleeve := _limb(mother_actor, "#c8b7a0")
		var forearm := _limb(mother_actor, "#b8927c")
		var hand := _round(mother_actor, Vector3.ZERO, Vector3(0.034, 0.041, 0.049), SKIN)
		_mother_arms.append({"sleeve": sleeve, "forearm": forearm, "hand": hand})

	doctor_actor = _group(self, DOCTOR_ENTRY)
	_doctor_head = _portrait(doctor_actor, Vector3(0, 1.54, 0.025), "#524942", 1.03)
	_round(doctor_actor, Vector3(0, 1.43, 0.031), Vector3(0.072, 0.092, 0.065), "#b18b75")
	_round(doctor_actor, Vector3(0, 1.17, 0.002), Vector3(0.246, 0.34, 0.137), "#383737")
	_round(doctor_actor, Vector3(0, 1.215, 0.125), Vector3(0.128, 0.185, 0.037), "#514d48")
	_piece(doctor_actor, Vector3(0, 1.355, 0.150), Vector3(0.089, 0.134, 0.018), "#b0a18e")
	_round(doctor_actor, Vector3(0, 1.326, 0.159), Vector3(0.049, 0.04, 0.015), "#403630")
	for side in [-1.0, 1.0]:
		var lapel := _piece(doctor_actor, Vector3(side * 0.10, 1.315, 0.124),
			Vector3(0.066, 0.23, 0.02), "#504946")
		lapel.rotation.z = side * 0.38
		_round(doctor_actor, Vector3(side * 0.096, 0.55, 0), Vector3(0.081, 0.425, 0.091), "#3b3939")
		_round(doctor_actor, Vector3(side * 0.10, 0.092, 0.055), Vector3(0.080, 0.066, 0.132), "#372b27")
		_round(doctor_actor, Vector3(side * 0.244, 1.22, 0), Vector3(0.072, 0.175, 0.077), "#373535")
	_round(doctor_actor, Vector3(-0.258, 0.850, 0.020), Vector3(0.066, 0.215, 0.065), "#393635")
	_round(doctor_actor, Vector3(-0.260, 0.653, 0.041), Vector3(0.037, 0.069, 0.037), SKIN)
	_doctor_forearm = _round(doctor_actor, Vector3(0.258, 0.887, 0.016), Vector3(0.067, 0.214, 0.065), "#393635")
	_round(_doctor_forearm, Vector3(0.0, -0.45, 0.08), Vector3(0.46, 0.16, 0.42), SKIN)
	for index in 3:
		_round(doctor_actor, Vector3(0.04, 1.15 - index * 0.095, 0.16), Vector3(0.012, 0.013, 0.010), "#736352")

	nurse_actor = _nurse(NURSE_BEDSIDE, "#544d53", "#a49a88", "#615247")
	_childs_nurse = _nurse(MAID_BEDSIDE, "#3d4949", "#c1b5a1", "#4a3c35")
	_child = _group(self, BED_CHILD)
	var gown := _round(_child, Vector3(0, -0.055, 0.13), Vector3(0.145, 0.075, 0.31), "#d2c3ac", BEDDING)
	gown.rotation.x = 0.016
	_round(_child, Vector3(0.00, 0.012, -0.165), Vector3(0.086, 0.082, 0.089), "#c39e85")
	_round(_child, Vector3(0.02, 0.039, -0.210), Vector3(0.083, 0.059, 0.057), "#645140")
	for side in [-1.0, 1.0]:
		_round(_child, Vector3(side * 0.049, -0.041, 0.395), Vector3(0.034, 0.034, 0.065), "#bd9b83")


func _nurse(at: Vector3, dress_color: String, apron_color: String, hair: String) -> Node3D:
	var actor := _group(self, at)
	_portrait(actor, Vector3(0.0, 1.51, 0.035), hair, 0.97)
	_round(actor, Vector3(0.0, 1.605, -0.008), Vector3(0.140, 0.050, 0.112), apron_color, BEDDING)
	_round(actor, Vector3(0.0, 1.365, 0.025), Vector3(0.065, 0.082, 0.065), SKIN)
	var skirt := CylinderMesh.new()
	skirt.top_radius = 0.147
	skirt.bottom_radius = 0.294
	skirt.height = 0.87
	skirt.radial_segments = 23
	_mesh(actor, skirt, Vector3(0, 0.51, 0.0), _material(dress_color, BEDDING))
	_round(actor, Vector3(0, 1.115, 0), Vector3(0.205, 0.28, 0.129), dress_color, BEDDING)
	_round(actor, Vector3(0, 0.836, 0.133), Vector3(0.175, 0.385, 0.044), apron_color, BEDDING)
	_piece(actor, Vector3(0, 1.303, 0.112), Vector3(0.107, 0.045, 0.045), apron_color, BEDDING)
	for side in [-1.0, 1.0]:
		_round(actor, Vector3(side * 0.204, 1.154, 0.016), Vector3(0.077, 0.179, 0.078), dress_color, BEDDING)
		var arm := _round(actor, Vector3(side * 0.226, 0.947, 0.096), Vector3(0.055, 0.149, 0.065), dress_color, BEDDING)
		arm.rotation.x = -0.66
		_round(actor, Vector3(side * 0.17, 0.850, 0.195), Vector3(0.040, 0.055, 0.041), SKIN)
	return actor


func _portrait(parent: Node3D, at: Vector3, hair: String, size: float) -> Node3D:
	var head := _group(parent, at)
	head.scale = Vector3.ONE * size
	_round(head, Vector3(0, -0.003, 0.0), Vector3(0.105, 0.142, 0.096), SKIN)
	_round(head, Vector3(0, -0.067, 0.028), Vector3(0.082, 0.071, 0.081), SKIN)
	_round(head, Vector3(0, 0.065, -0.040), Vector3(0.112, 0.093, 0.089), hair)
	_round(head, Vector3(0, 0.003, -0.068), Vector3(0.101, 0.108, 0.052), hair)
	for side in [-1.0, 1.0]:
		_round(head, Vector3(side * 0.038, 0.022, 0.088), Vector3(0.020, 0.007, 0.012), "#887060")
		_round(head, Vector3(side * 0.036, 0.022, 0.095), Vector3(0.009, 0.006, 0.007), "#554841")
		_round(head, Vector3(side * 0.041, 0.044, 0.087), Vector3(0.023, 0.005, 0.006), hair)
		_round(head, Vector3(side * 0.104, -0.004, -0.006), Vector3(0.015, 0.026, 0.022), SKIN)
	_round(head, Vector3(0, -0.007, 0.098), Vector3(0.015, 0.024, 0.027), "#b38b72")
	_round(head, Vector3(0, -0.05, 0.095), Vector3(0.027, 0.006, 0.013), "#a1756b")
	return head


func _limb(parent: Node3D, color: String) -> MeshInstance3D:
	var cylinder := CapsuleMesh.new()
	cylinder.radius = 0.048
	cylinder.height = 0.24
	cylinder.radial_segments = 12
	return _mesh(parent, cylinder, Vector3.ZERO, _material(color, -1))


func _set_arm(arm: Dictionary, shoulder: Vector3, hand: Vector3) -> void:
	var elbow := shoulder.lerp(hand, 0.55) + Vector3(0.0, -0.065, 0.024)
	_set_span(arm["sleeve"], shoulder, elbow)
	_set_span(arm["forearm"], elbow, hand)
	arm["hand"].position = hand


func _set_span(mesh: MeshInstance3D, from: Vector3, to: Vector3) -> void:
	var length := maxf(from.distance_to(to), 0.096)
	var axis := (to - from).normalized()
	var right := axis.cross(Vector3.FORWARD).normalized()
	if right.is_zero_approx():
		right = Vector3.RIGHT
	var forward := right.cross(axis).normalized()
	mesh.transform = Transform3D(Basis(right, axis * (length / 0.24), forward), (from + to) * 0.5)


func _face(from: Vector3, to: Vector3) -> float:
	return atan2(to.x - from.x, to.z - from.z)


func _group(parent: Node3D, center: Vector3) -> Node3D:
	var group := Node3D.new()
	group.position = center
	parent.add_child(group)
	return group


func _piece(parent: Node3D, center: Vector3, dimensions: Vector3, color: String, finish: int = -1) -> MeshInstance3D:
	var box := BoxMesh.new()
	box.size = dimensions
	return _mesh(parent, box, center, _material(color, finish))


func _round(parent: Node3D, center: Vector3, dimensions: Vector3, color: String, finish: int = -1) -> MeshInstance3D:
	var ball := SphereMesh.new()
	ball.radial_segments = 20
	ball.rings = 12
	var object := _mesh(parent, ball, center, _material(color, finish))
	object.scale = dimensions * 2.0
	return object


func _mesh(parent: Node3D, mesh: Mesh, center: Vector3, material: Material) -> MeshInstance3D:
	var object := MeshInstance3D.new()
	object.mesh = mesh
	object.position = center
	object.material_override = material
	parent.add_child(object)
	return object


func _material(color: String, finish: int) -> Material:
	var key := "%s/%s" % [color, finish]
	if _materials.has(key):
		return _materials[key]
	if finish < 0:
		var surface := StandardMaterial3D.new()
		surface.albedo_color = Color.html(color)
		surface.roughness = 0.82
		_materials[key] = surface
	else:
		var surface := ShaderMaterial.new()
		surface.shader = SurfacePaint
		surface.set_shader_parameter("tint", Color.html(color))
		surface.set_shader_parameter("finish", finish)
		if finish == WALLPAPER:
			surface.set_shader_parameter("paper_ink_strength", 0.13)
		_materials[key] = surface
	return _materials[key]


func _glow(color: String, strength: float) -> StandardMaterial3D:
	var surface := StandardMaterial3D.new()
	surface.albedo_color = Color.html(color)
	surface.emission_enabled = true
	surface.emission = surface.albedo_color
	surface.emission_energy_multiplier = strength
	return surface


func _overcast_glass(color: String) -> StandardMaterial3D:
	var surface := StandardMaterial3D.new()
	surface.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	surface.albedo_color = Color.html(color)
	return surface


func _room_light(parent: Node3D, at: Vector3, tint: Color, energy: float, reach: float) -> void:
	var light := OmniLight3D.new()
	light.position = at
	light.light_color = tint
	light.light_energy = energy
	light.omni_range = reach
	parent.add_child(light)


func _grid_faces(mesh_tool: SurfaceTool, columns: int, rows: int) -> void:
	for row in rows:
		for column in columns:
			var corner := row * (columns + 1) + column
			for index in [corner, corner + 1, corner + columns + 1,
					corner + 1, corner + columns + 2, corner + columns + 1]:
				mesh_tool.add_index(index)
	mesh_tool.generate_normals()
