#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

// Light for the architecture stack: beams that carry each package up through the layers, and the rings that flash on a
// plate where a beam reaches a package. Positions arrive in CSS pixels from the canvas's top left.

#define MAX_BEAMS 16
#define MAX_SPARKS 18

uniform vec2 u_resolution;
uniform float u_scale;
uniform float u_time;
uniform float u_beamCount;
uniform float u_sparkCount;
// Each beam runs from xy to zw. Its state holds how much of it has grown, its strength and a phase for its pulses.
uniform vec4 u_beams[MAX_BEAMS];
uniform vec4 u_beamState[MAX_BEAMS];
// Each spark sits at xy with a ring's progress in z and the glow under its package in w.
uniform vec4 u_sparks[MAX_SPARKS];
// The plates' x and y axes on screen, so rings lie flat on the tilted plates, and a package's radius on its plate.
uniform vec4 u_axes;
uniform float u_size;

const vec3 WHITE = vec3(0.86, 0.93, 1.0);
const vec3 BLUE = vec3(0.2, 0.44, 1.0);
const vec3 SOFT = vec3(0.56, 0.71, 1.0);
const vec3 CYAN = vec3(0.36, 0.88, 0.95);

float hash(float n) {
  return fract(sin(n) * 43758.5453);
}

float noise(float x) {
  float i = floor(x);
  float f = fract(x);
  return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_scale;
  vec3 light = vec3(0.0);

  for (int i = 0; i < MAX_BEAMS; i++) {
    if (float(i) >= u_beamCount) {
      break;
    }
    vec4 state = u_beamState[i];
    if (state.x <= 0.0 || state.y <= 0.0) {
      continue;
    }
    vec2 a = u_beams[i].xy;
    vec2 b = mix(a, u_beams[i].zw, state.x);
    vec2 ab = b - a;
    float len = max(length(ab), 0.001);
    float h = clamp(dot(p - a, ab) / (len * len), 0.0, 1.0);
    float d = length(p - (a + ab * h));
    if (d > 90.0) {
      continue;
    }
    float along = h * len;
    // Pulses travel up the beam, away from the package it starts at
    float pulse = pow(0.5 + 0.5 * sin(along * 0.07 - u_time * 7.0 + state.z), 14.0);
    float flicker = 0.84 + 0.16 * noise(along * 0.05 - u_time * 3.0 + state.z * 3.7);
    float core = exp(-d * d * 0.35);
    float glow = exp(-d * d * 0.018);
    // A soft column around the beam, so it reads as a shaft of light through the glass
    float shaft = exp(-d * d * 0.0016);
    float haze = 1.0 / (1.0 + d * d * 0.004);
    vec2 toTip = p - b;
    float tip = state.x < 0.999 ? exp(-dot(toTip, toTip) * 0.01) : 0.0;
    vec3 beam = WHITE * core * 1.3 + mix(BLUE, CYAN, pulse) * glow * (0.55 + 1.2 * pulse) + BLUE * shaft * 0.22 +
      BLUE * haze * 0.08;
    light += (beam * flicker + WHITE * tip * 1.5) * state.y;
  }

  float det = u_axes.x * u_axes.w - u_axes.z * u_axes.y;
  for (int i = 0; i < MAX_SPARKS; i++) {
    if (float(i) >= u_sparkCount) {
      break;
    }
    vec4 spark = u_sparks[i];
    if (spark.z <= 0.0 && spark.w <= 0.0) {
      continue;
    }
    vec2 rel = p - spark.xy;
    // Back onto the plate, so a ring is round on the plate and an ellipse on screen
    vec2 local = vec2(u_axes.w * rel.x - u_axes.z * rel.y, u_axes.x * rel.y - u_axes.y * rel.x) / det;
    float r = length(local) / u_size;
    if (r > 3.5) {
      continue;
    }
    float ring = 0.0;
    if (spark.z > 0.0 && spark.z < 1.0) {
      float radius = 0.6 + 2.0 * spark.z;
      float width = 0.05 + 0.2 * spark.z;
      float fade = 1.0 - spark.z;
      float k = (r - radius) / width;
      ring = exp(-k * k) * fade * fade;
    }
    float halo = exp(-r * r * 1.2) * spark.w;
    light += SOFT * ring * 1.3 + BLUE * halo * 0.5;
  }

  vec3 color = 1.0 - exp(-light * 1.3);
  float alpha = clamp(max(color.r, max(color.g, color.b)), 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
}
