precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @label Base
 * @color
 * @default #05070F
 */
uniform vec3 u_base;

/**
 * @label Glow
 * @color
 * @default #3370FF
 */
uniform vec3 u_glow;

/**
 * @label Highlight
 * @color
 * @default #8FB4FF
 */
uniform vec3 u_highlight;

/**
 * @label Intensity
 * @default 1.0
 * @range 0, 2
 */
uniform float u_intensity;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = vec2(uv.x * u_resolution.x / u_resolution.y, uv.y);
  float t = u_time * 0.04;

  float top = 1.0 - uv.y;
  vec2 c = vec2(0.62 * u_resolution.x / u_resolution.y, 1.08);
  float d = length((p - c) * vec2(0.55, 1.0));
  float halo = exp(-d * d * 2.4);

  float flow = fbm(vec2(p.x * 1.6 - t, p.y * 2.2 + t * 0.6));
  float bands = smoothstep(0.35, 0.95, flow) * halo;

  float lines = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float y = 0.78 - fi * 0.075 + 0.025 * sin(p.x * 2.2 + t * 6.0 + fi * 1.7);
    float w = 0.0016 + 0.0008 * fi;
    lines += (1.0 - smoothstep(0.0, w, abs(uv.y - y))) * (0.22 - fi * 0.035) * smoothstep(0.05, 0.6, uv.x) * smoothstep(1.0, 0.55, uv.x);
  }

  vec3 col = u_base;
  col = mix(col, u_glow * 0.55, halo * 0.55 * u_intensity);
  col += u_highlight * bands * 0.22 * u_intensity;
  col += u_highlight * lines * u_intensity * halo * 1.4;

  float vignette = smoothstep(1.25, 0.2, length(uv - vec2(0.5, 0.75)));
  col *= mix(0.65, 1.0, vignette);
  col += (hash(gl_FragCoord.xy + u_time) - 0.5) * 0.012;

  gl_FragColor = vec4(col, 1.0);
}
