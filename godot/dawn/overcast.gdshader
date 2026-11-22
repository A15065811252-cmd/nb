shader_type sky;

float hash_point(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float smooth_noise(vec2 p) {
	vec2 i = floor(p);
	vec2 u = fract(p);
	u = u * u * (3.0 - 2.0 * u);
	return mix(mix(hash_point(i), hash_point(i + vec2(1, 0)), u.x),
		mix(hash_point(i + vec2(0, 1)), hash_point(i + vec2(1, 1)), u.x), u.y);
}

void sky() {
	vec2 clouds = EYEDIR.xz / (max(0.0, EYEDIR.y) + 0.32);
	clouds *= 1.65;
	clouds += vec2(-0.010, 0.004) * TIME;
	float cover = smooth_noise(clouds) * 0.62 + smooth_noise(clouds * 2.4 + 9.3) * 0.27;
	cover += smooth_noise(clouds * 5.0) * 0.11;
	float horizon = smoothstep(0.0, 0.60, EYEDIR.y);
	vec3 base = mix(vec3(0.41, 0.44, 0.47), vec3(0.28, 0.31, 0.35), horizon);
	float variation = mix(0.59, 1.16, smoothstep(0.16, 0.84, cover));
	// Fade the cloud projection out at the distant horizon.
	COLOR = base * mix(1.0, variation, smoothstep(0.012, 0.16, EYEDIR.y));
}
