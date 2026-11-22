shader_type spatial;
render_mode cull_disabled;

uniform vec4 tint : source_color = vec4(0.52, 0.48, 0.43, 1.0);
// 0 plaster, 1 brick, 2 slate, 3 stone setts, 4 timber, 5 curtain linen,
// 6 wallpaper, 7 bedding, 8 glazed earthenware.
uniform int finish = 0;
uniform float paper_ink_strength : hint_range(0.0, 1.0) = 0.24;

varying vec3 world_position;
varying vec3 world_normal;

float hash_cell(vec2 p) {
	vec3 v = fract(vec3(p.xyx) * 0.1031);
	v += dot(v, v.yzx + 33.33);
	return fract((v.x + v.y) * v.z);
}

float noise_at(vec2 p) {
	vec2 i = floor(p);
	vec2 t = fract(p);
	t = t * t * (3.0 - 2.0 * t);
	return mix(mix(hash_cell(i), hash_cell(i + vec2(1, 0)), t.x),
		mix(hash_cell(i + vec2(0, 1)), hash_cell(i + vec2(1, 1)), t.x), t.y);
}

float seams(vec2 grid, float width) {
	vec2 edge = min(fract(grid), 1.0 - fract(grid));
	float distance_to_edge = min(edge.x, edge.y);
	float pixel = min(0.24, length(fwidth(grid)));
	return 1.0 - smoothstep(width, width + pixel + 0.015, distance_to_edge);
}

float paper_ornament(vec2 position) {
	vec2 grid = position * vec2(4.1, 4.0);
	grid.x += mod(floor(grid.y), 2.0) * 0.5;
	vec2 p = fract(grid) - vec2(0.5);
	vec2 leaf = vec2(abs(p.x), p.y);
	float stem = 1.0 - smoothstep(0.014, 0.045, abs(p.x + sin(p.y * 7.8) * 0.031));
	stem *= 1.0 - smoothstep(0.21, 0.32, abs(p.y));
	float lower_leaf = length((leaf - vec2(0.12 + p.y * 0.37, -0.10)) / vec2(0.071, 0.123));
	float upper_leaf = length((leaf - vec2(0.12 - p.y * 0.42, 0.10)) / vec2(0.068, 0.113));
	float tip = length((p - vec2(-0.018, 0.235)) / vec2(0.061, 0.082));
	return max(stem * 0.68, 1.0 - smoothstep(0.53, 1.0, min(min(lower_leaf, upper_leaf), tip)));
}

void vertex() {
	if (finish == 5) {
		// Keep the hem moving faintly where air enters through the sash.
		VERTEX.z += sin(TIME * 1.4 + UV.x * 8.0) * 0.012 * UV.y * UV.y;
	}
	world_position = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_normal = MODEL_NORMAL_MATRIX * NORMAL;
}

void fragment() {
	vec3 axis = abs(normalize(world_normal));
	vec2 p = axis.y > 0.55 ? world_position.xz : (axis.z > axis.x ? world_position.xy : world_position.zy);
	float age = noise_at(p * 1.8);
	float grain = noise_at(p * 62.0);
	float multiplier = mix(0.86, 1.10, age) + (grain - 0.5) * 0.11;
	vec3 color = tint.rgb * multiplier;
	float rough = 0.87;
	if (finish == 1 || finish == 2 || finish == 3) {
		vec2 ratio = finish == 1 ? vec2(4.4, 13.0) : (finish == 2 ? vec2(3.7, 5.5) : vec2(5.2, 7.8));
		vec2 grid = p * ratio;
		grid.x += mod(floor(grid.y), 2.0) * 0.5;
		float variation = hash_cell(floor(grid));
		float joint = seams(grid, finish == 1 ? 0.035 : 0.022);
		color *= mix(0.76, 1.18, variation);
		vec3 joint_color = finish == 1 ? mix(tint.rgb * 0.90, vec3(0.15, 0.145, 0.136), 0.46) : tint.rgb * 0.57;
		color = mix(color, joint_color, joint * 0.70);
		rough = finish == 3 ? 0.71 : 0.80;
	} else if (finish == 4) {
		vec2 grain_direction = p * vec2(57.0, 4.8);
		float warped_grain = grain_direction.x + 3.0 * noise_at(p * vec2(8.0, 1.5));
		float fiber = noise_at(vec2(warped_grain, grain_direction.y));
		float fine_fiber = noise_at(grain_direction * 3.4);
		float scuff = smoothstep(0.59, 0.93, noise_at(p * vec2(14.0, 5.7)));
		color = tint.rgb * mix(0.67, 1.11, age * 0.44 + fiber * 0.39 + fine_fiber * 0.17);
		color = mix(color, tint.rgb * 0.60, fiber * scuff * 0.38);
		rough = mix(0.48, 0.77, age);
	} else if (finish == 5 || finish == 7) {
		float threads = noise_at(UV * vec2(154.0, 216.0));
		float textile = noise_at(UV * 13.0) * 0.75 + threads * 0.25;
		color = tint.rgb * mix(0.90, 1.06, textile);
		rough = 0.96;
	} else if (finish == 6) {
		float paper = paper_ornament(p);
		color = tint.rgb * (0.89 + age * 0.16 + grain * 0.025);
		color = mix(color, color * vec3(1.68, 1.43, 1.18), paper * paper_ink_strength);
		rough = 0.93;
	} else if (finish == 8) {
		color = tint.rgb * mix(0.91, 1.035, age);
		rough = 0.37 + grain * 0.060;
	}
	ALBEDO = color;
	ROUGHNESS = rough;
	SPECULAR = finish == 5 || finish == 7 ? 0.12 : 0.27;
}
