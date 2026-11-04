precision highp float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @label Box left
 * @default 0.0556
 * @range 0, 1
 */
uniform float u_bx0;

/**
 * @label Box bottom
 * @default 0.0861
 * @range 0, 1
 */
uniform float u_by0;

/**
 * @label Box right
 * @default 0.9444
 * @range 0, 1
 */
uniform float u_bx1;

/**
 * @label Box top
 * @default 0.4958
 * @range 0, 1
 */
uniform float u_by1;

/**
 * @label Intensity
 * @default 0.5
 * @range 0, 2
 */
uniform float u_intensity;

const vec3 BASE = vec3(0.0196, 0.0275, 0.0588);
const vec3 DEEP = vec3(0.0353, 0.0510, 0.1020);
const vec3 BLUE = vec3(0.2000, 0.4392, 1.0000);
const vec3 SOFT = vec3(0.5608, 0.7059, 1.0000);

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
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.02 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// The workbench, lit from behind as if it is switched on
vec3 backlight(vec2 fc, vec2 res, float t) {
  vec2 b0 = vec2(u_bx0, u_by0) * res;
  vec2 b1 = vec2(u_bx1, u_by1) * res;
  vec2 c = (b0 + b1) * 0.5;
  vec2 hs = (b1 - b0) * 0.5;
  float R = res.y;
  float d = max(sdBox(fc - c, hs), 0.0) / R;
  float breath = 0.86 + 0.14 * sin(t * 0.55);
  float drift = 0.75 + 0.5 * fbm(vec2(fc.x / R * 1.6 + t * 0.02, fc.y / R * 0.8 - t * 0.015));

  float glow = exp(-d * 4.2) * mix(0.25, 1.0, smoothstep(b0.y, b1.y, fc.y));
  float spill = exp(-abs(fc.y - b1.y) / (0.09 * R)) * exp(-pow((fc.x - c.x) / (hs.x * 1.05), 2.0) * 1.6);
  float wash = exp(-pow((fc.x - c.x) / (hs.x * 1.6), 2.0)) * smoothstep(b0.y, b1.y + 0.35 * R, fc.y) * smoothstep(res.y * 1.05, b1.y, fc.y);

  vec3 col = BLUE * glow * 0.30 * drift;
  col += mix(BLUE, SOFT, 0.35) * spill * 0.16;
  col += BLUE * wash * 0.05;
  return col * breath;
}

void main() {
  vec2 res = u_resolution;
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / res;

  vec3 col = mix(BASE, DEEP, smoothstep(0.1, 1.0, uv.y));
  col += backlight(fc, res, u_time) * u_intensity;

  float vig = smoothstep(1.3, 0.3, length((uv - vec2(0.5, 0.6)) * vec2(0.9, 1.1)));
  col *= mix(0.7, 1.0, vig);
  col += (hash(fc + fract(u_time) * 91.0) - 0.5) * 0.014;
  gl_FragColor = vec4(col, 1.0);
}
