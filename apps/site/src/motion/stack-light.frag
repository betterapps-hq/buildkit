#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

// Light for the architecture stack: three pillars of aurora, each as wide and deep as the traced card. One stands on the
// core card and meets the underside of the React card, one runs from there to the library card, and one rises from the
// library card into the app, spreading out as it nears it. Each pixel casts a ray through the same camera as the CSS 3D
// scene and gathers the light along it, so a pillar glows over whatever is behind it, and the cards and glass plates in
// front of it hide or dim it. The app sits in front of the light, which backlights it.
//
// Stack coordinates are the scene's own: x along the plates, y towards their front and z up through the layers, in
// pixels from the middle of the stack. Canvas positions arrive in CSS pixels from its top left.

#define MAX_OCCLUDERS 20

uniform vec2 u_resolution;
uniform float u_scale;
uniform float u_time;
// Where the stack's middle is on the canvas, the perspective distance and the stack's scale
uniform vec4 u_camera;
// The camera's tilt and turn, in radians, and how far it lifts the stack
uniform vec3 u_view;
// The traced card's middle and half size, the same on every layer, its corner radius, and how far the pillars sway
uniform vec4 u_cell;
uniform float u_corner;
uniform float u_bend;
// Each layer's height, and the top of the last pillar, inside the app
uniform vec4 u_levels;
// The last pillar's half size where it reaches the app, and how far up it starts and stops spreading
uniform vec4 u_flare;
// Per pillar, how far the light has risen, the flash where it lands, and how bright it is
uniform vec4 u_grow;
uniform vec4 u_land;
uniform vec4 u_power;
// Cards and glass plates above the core, each with its height, how much light it lets through, its layer and its
// corner radius
uniform vec4 u_occluders[MAX_OCCLUDERS];
uniform vec4 u_occluderInfo[MAX_OCCLUDERS];
uniform float u_occluderCount;
// The app's box on the canvas, and how lit it is
uniform vec4 u_app;
uniform float u_backlight;

const float PI = 3.14159265;
const vec3 WHITE = vec3(0.88, 0.94, 1.0);
const vec3 CYAN = vec3(0.32, 0.86, 1.0);
const vec3 TEAL = vec3(0.22, 0.95, 0.82);
const vec3 BLUE = vec3(0.2, 0.42, 1.0);
const vec3 VIOLET = vec3(0.56, 0.36, 1.0);

// How the pillars look: their shell's brightness and width, and how bright they are inside
const float SHELL = 1.0;
const float SOFT = 1.4;
const float FILL = 0.9;
const float APP_CORNER = 14.0;
const int STEPS = 30;
// How much of the light adds to what's behind it rather than covering it
const float ADDITIVE = 0.7;

float hash(float n) {
  return fract(sin(n) * 43758.5453);
}

float noise(float x) {
  float i = floor(x);
  float f = fract(x);
  return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i.x + i.y * 57.0);
  float b = hash(i.x + 1.0 + i.y * 57.0);
  float c = hash(i.x + (i.y + 1.0) * 57.0);
  float d = hash(i.x + 1.0 + (i.y + 1.0) * 57.0);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float roundBox(vec2 p, vec2 half_, float radius) {
  vec2 q = abs(p) - half_ + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

// Where a ray enters and leaves a box, or a miss when the exit comes first
vec2 slab(vec3 origin, vec3 direction, vec3 low, vec3 high) {
  vec3 inverse = 1.0 / direction;
  vec3 a = (low - origin) * inverse;
  vec3 b = (high - origin) * inverse;
  vec3 near = min(a, b);
  vec3 far = max(a, b);
  return vec2(max(max(near.x, near.y), near.z), min(min(far.x, far.y), far.z));
}

// A pillar's cross-section at a height, as its center and half size. It's the card's own shape, pinned square to the card
// at each end and swaying in between, and its two long sides waver on their own, like the edges of a loose cable. The
// last pillar keeps the card's width at first, then spreads out as it nears the app.
vec4 sectionAt(float v, float seed, float spreads) {
  float t = u_time;
  float free = sin(clamp(v, 0.0, 1.0) * PI);
  vec2 sway = vec2(noise(v * 1.6 - t * 0.38 + seed) - 0.5, noise(v * 1.3 - t * 0.3 + seed * 2.0) - 0.5);
  sway *= vec2(u_bend, u_bend * 0.4) * 2.0 * free;
  float left = (noise(v * 3.4 - t * 0.75 + seed * 2.0) - 0.5) * u_bend * 0.6 * free;
  float right = (noise(v * 3.1 - t * 0.66 + seed * 3.0) - 0.5) * u_bend * 0.6 * free;
  vec2 half_ = mix(u_cell.zw, u_flare.xy, smoothstep(u_flare.z, u_flare.w, v) * spreads);
  return vec4(u_cell.xy + sway + vec2((left + right) * 0.5, 0.0), half_ + vec2((right - left) * 0.5, 0.0));
}

vec3 pillar(vec3 origin, vec3 direction, float bottom, float top, float grown, float landed, float seed, float spreads, float dither) {
  if (grown <= 0.0) {
    return vec3(0.0);
  }
  float t = u_time;
  vec2 reach = max(u_cell.zw, u_flare.xy * spreads) + vec2(u_bend * 1.6 + SOFT * 3.0 + 6.0);
  vec2 hit = slab(origin, direction, vec3(u_cell.xy - reach, bottom), vec3(u_cell.xy + reach, top));
  if (hit.x >= hit.y) {
    return vec3(0.0);
  }
  float span = top - bottom;
  float head = grown * span;
  float stride = (hit.y - hit.x) / float(STEPS);
  float travel = length(direction) * stride;
  vec3 light = vec3(0.0);
  for (int i = 0; i < STEPS; i++) {
    vec3 p = origin + direction * (hit.x + (float(i) + dither) * stride);
    float rise = p.z - bottom;
    float v = clamp(rise / span, 0.0, 1.0);
    if (rise > head + 2.0) {
      continue;
    }
    vec4 section = sectionAt(v, seed, spreads);
    vec2 q = p.xy - section.xy;
    float d = roundBox(q, section.zw, u_corner);
    float shell = exp(-d * d / (SOFT * SOFT * 4.0 + 6.0));
    float body = 1.0 - smoothstep(-10.0, 3.0, d);

    // Rays run up the pillar and lean as it rises, and brighter bands flow up through it
    float around = (q.x + q.y * 2.4) * 0.045 + v * 0.9;
    float rays = 0.4 + 0.6 * pow(noise(around * 3.0 + t * 0.15 + seed * 5.0), 1.5);
    float flow = 0.4 + 0.8 * noise2(vec2(q.x * 0.025 + seed, p.z * 0.02 - t * 1.1));

    // Light gathers where the pillar leaves a card and where it meets the next, and its rising front glows
    float ends = exp(-rise * rise / 120.0) * 0.6 + exp(-pow(span - rise, 2.0) / 120.0) * (0.5 + landed);
    float density = (shell * SHELL + body * FILL * 0.3) * rays * flow + body * ends * 0.6;
    density *= 1.0 - smoothstep(head - 16.0, head + 2.0, rise);
    float front = grown < 1.0 ? exp(-pow(rise - head, 2.0) / 60.0) * body * 0.8 : 0.0;

    vec3 tint = mix(TEAL, CYAN, smoothstep(0.0, 0.35, v));
    tint = mix(tint, BLUE, smoothstep(0.3, 0.85, v) * 0.5);
    tint = mix(tint, VIOLET, smoothstep(0.55, 1.0, v) * 0.35);
    light += (tint * density + (CYAN + WHITE * 0.8) * front * 1.4) * travel;
  }
  return light * 0.022;
}

// How much light gets past each layer above the core along a ray: none through a card, some through glass, all elsewhere
vec2 through(vec3 origin, vec3 direction) {
  vec2 pass = vec2(1.0);
  for (int i = 0; i < MAX_OCCLUDERS; i++) {
    if (float(i) >= u_occluderCount) {
      break;
    }
    vec4 info = u_occluderInfo[i];
    vec4 rect = u_occluders[i];
    vec2 p = origin.xy + direction.xy * ((info.x - origin.z) / direction.z);
    float d = roundBox(p - (rect.xy + rect.zw) * 0.5, (rect.zw - rect.xy) * 0.5, info.w);
    float blocked = mix(1.0, info.y, 1.0 - smoothstep(-0.75, 0.75, d));
    if (info.z < 1.5) {
      pass.x = min(pass.x, blocked);
    } else {
      pass.y = min(pass.y, blocked);
    }
  }
  return pass;
}

// The glow around the app from the light behind it, strongest along its bottom edge, where the light reaches it. The
// page draws the app over the light, so only the glow beyond its edges shows.
vec3 backlight(vec2 p) {
  if (u_backlight <= 0.0) {
    return vec3(0.0);
  }
  float outside = max(roundBox(p - (u_app.xy + u_app.zw) * 0.5, (u_app.zw - u_app.xy) * 0.5, APP_CORNER), 0.0);
  float below = smoothstep(u_app.y, u_app.w + 10.0, p.y);
  float aura = exp(-outside / 26.0) * (0.25 + 0.75 * below) + exp(-outside / 70.0) * 0.25 * below;
  return mix(BLUE, mix(CYAN, VIOLET, 0.3), 0.5) * aura * u_backlight * 0.6;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_scale;
  vec2 screen = p - u_camera.xy;
  float depth = u_camera.z;
  float tilt = u_view.x;
  float turn = u_view.y;

  // The ray from the camera through this pixel, in the tilted scene without its lift, then back through the tilt, the
  // turn and the stack's scale
  vec3 o = vec3(0.0, -u_view.z, depth);
  vec3 d = vec3(screen, -depth);
  o = vec3(o.x, o.y * cos(tilt) + o.z * sin(tilt), -o.y * sin(tilt) + o.z * cos(tilt));
  d = vec3(d.x, d.y * cos(tilt) + d.z * sin(tilt), -d.y * sin(tilt) + d.z * cos(tilt));
  o = vec3(o.x * cos(turn) + o.y * sin(turn), -o.x * sin(turn) + o.y * cos(turn), o.z) / u_camera.w;
  d = vec3(d.x * cos(turn) + d.y * sin(turn), -d.x * sin(turn) + d.y * cos(turn), d.z) / u_camera.w;

  float dither = hash(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)));
  vec3 lower = pillar(o, d, u_levels.x, u_levels.y, u_grow.x, u_land.x, 1.3, 0.0, dither) * u_power.x;
  vec3 upper = pillar(o, d, u_levels.y, u_levels.z, u_grow.y, u_land.y, 5.0, 0.0, dither) * u_power.y;
  vec3 light = pillar(o, d, u_levels.z, u_levels.w, u_grow.z, u_land.z, 8.7, 1.0, dither) * u_power.z;
  if (dot(lower + upper, vec3(1.0)) > 0.0) {
    vec2 pass = through(o, d);
    light += lower * pass.x * pass.y + upper * pass.y;
  }

  vec3 color = min(light + backlight(p), vec3(1.0));
  float alpha = clamp(max(max(color.r, color.g), color.b), 0.0, 1.0) * (1.0 - ADDITIVE);
  gl_FragColor = vec4(color, alpha);
}
