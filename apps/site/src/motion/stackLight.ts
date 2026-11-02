import fragmentSource from "./stack-light.frag?raw"

const VERTEX_SOURCE = "attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }"

/** The most cards and plates the light can pass under, matching the array in the shader. */
const MAX_OCCLUDERS = 20
/** How far the pillars sway, as a share of the card's width. */
const SWAY = 0.13

export type Point = { x: number; y: number }

/** A pillar of light rising from one card to the next. `grow` is how far up it has reached and `land` the flash where it arrives. */
export type Pillar = { grow: number; land: number }

/**
 * A card or glass plate above the core, in the stack's pixels from its middle, at its height on the stack. `pass` is how
 * much light gets through it, from 0 for a card to 1 when it isn't there.
 */
export type Occluder = {
  left: number
  top: number
  right: number
  bottom: number
  z: number
  pass: number
  layer: number
  radius: number
}

/** One frame of light. Canvas positions are in CSS pixels from its top left, and stack positions in the stack's pixels. */
export type LightFrame = {
  width: number
  height: number
  time: number
  /** Where the stack's middle sits on the canvas, the scene's perspective and the stack's scale */
  camera: { x: number; y: number; depth: number; scale: number }
  /** The camera's tilt and turn in radians, and how far it lifts the stack */
  view: { tilt: number; turn: number; lift: number }
  /** The traced card's middle and half size, the same on every layer, and its corner radius */
  cell: { x: number; y: number; width: number; height: number; radius: number }
  /** Each layer's height, and the top of the last pillar, inside the app */
  levels: [number, number, number, number]
  /** The last pillar's half size where it reaches the app, and how far up it starts and stops spreading */
  flare: { width: number; height: number; from: number; to: number }
  /** From the core up */
  pillars: [Pillar, Pillar, Pillar]
  occluders: Occluder[]
  /** The app's box on the canvas, and how lit it is */
  app: { left: number; top: number; right: number; bottom: number }
  backlight: number
  /** Projects a point on the stack to the canvas */
  place: (x: number, y: number, z: number) => Point
}

export type StackLight = { draw: (frame: LightFrame) => void; destroy: () => void }

/** Sizes the canvas's backing store to the frame and returns its device pixels per CSS pixel. */
function fit(canvas: HTMLCanvasElement, frame: LightFrame, most: number) {
  const ratio = Math.min(window.devicePixelRatio || 1, most)
  const width = Math.max(1, Math.round(frame.width * ratio))
  const height = Math.max(1, Math.round(frame.height * ratio))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  return ratio
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) {
    return null
  }
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

function webglLight(canvas: HTMLCanvasElement): StackLight | null {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: true, powerPreference: "low-power" })
  if (!gl) {
    return null
  }
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  if (!vertex || !fragment || !program) {
    return null
  }
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return null
  }
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, "a")
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  const uniform = (name: string) => gl.getUniformLocation(program, name)
  const uResolution = uniform("u_resolution")
  const uScale = uniform("u_scale")
  const uTime = uniform("u_time")
  const uCamera = uniform("u_camera")
  const uView = uniform("u_view")
  const uCell = uniform("u_cell")
  const uCorner = uniform("u_corner")
  const uBend = uniform("u_bend")
  const uLevels = uniform("u_levels")
  const uFlare = uniform("u_flare")
  const uGrow = uniform("u_grow")
  const uLand = uniform("u_land")
  const uOccluders = uniform("u_occluders")
  const uOccluderInfo = uniform("u_occluderInfo")
  const uOccluderCount = uniform("u_occluderCount")
  const uApp = uniform("u_app")
  const uBacklight = uniform("u_backlight")
  const occluders = new Float32Array(MAX_OCCLUDERS * 4)
  const occluderInfo = new Float32Array(MAX_OCCLUDERS * 4)

  return {
    draw(frame) {
      const ratio = fit(canvas, frame, 1.25)
      gl.viewport(0, 0, canvas.width, canvas.height)
      const { camera, view, cell, levels, flare, pillars, app } = frame
      const count = Math.min(frame.occluders.length, MAX_OCCLUDERS)
      frame.occluders.slice(0, count).forEach((occluder, index) => {
        occluders.set([occluder.left, occluder.top, occluder.right, occluder.bottom], index * 4)
        occluderInfo.set([occluder.z, occluder.pass, occluder.layer, occluder.radius], index * 4)
      })
      gl.uniform2f(uResolution, canvas.width, canvas.height)
      gl.uniform1f(uScale, ratio)
      gl.uniform1f(uTime, frame.time)
      gl.uniform4f(uCamera, camera.x, camera.y, camera.depth, camera.scale)
      gl.uniform3f(uView, view.tilt, view.turn, view.lift)
      gl.uniform4f(uCell, cell.x, cell.y, cell.width / 2, cell.height / 2)
      gl.uniform1f(uCorner, cell.radius)
      gl.uniform1f(uBend, cell.width * SWAY)
      gl.uniform4f(uLevels, ...levels)
      gl.uniform4f(uFlare, flare.width / 2, flare.height / 2, flare.from, flare.to)
      gl.uniform4f(uGrow, pillars[0].grow, pillars[1].grow, pillars[2].grow, 0)
      gl.uniform4f(uLand, pillars[0].land, pillars[1].land, pillars[2].land, 0)
      gl.uniform4fv(uOccluders, occluders)
      gl.uniform4fv(uOccluderInfo, occluderInfo)
      gl.uniform1f(uOccluderCount, count)
      gl.uniform4f(uApp, app.left, app.top, app.right, app.bottom)
      gl.uniform1f(uBacklight, frame.backlight)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    destroy() {
      gl.getExtension("WEBGL_lose_context")?.loseContext()
    }
  }
}

/**
 * The same light drawn with the 2D canvas, for browsers without WebGL: each pillar as a band of light from the card it
 * stands on up to where it has reached, spreading into the app at the top.
 */
function canvasLight(canvas: HTMLCanvasElement): StackLight | null {
  const context = canvas.getContext("2d")
  if (!context) {
    return null
  }

  return {
    draw(frame) {
      const ratio = fit(canvas, frame, 1.5)
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.globalCompositeOperation = "lighter"
      const { cell, levels, flare, place } = frame
      frame.pillars.forEach((pillar, index) => {
        if (pillar.grow <= 0) {
          return
        }
        const bottom = levels[index] ?? 0
        const head = bottom + ((levels[index + 1] ?? bottom) - bottom) * pillar.grow
        const spread = index === 2 ? Math.min(1, Math.max(0, (pillar.grow - flare.from) / (flare.to - flare.from))) : 0
        const top = cell.width / 2 + (flare.width / 2 - cell.width / 2) * spread
        const corners = [
          place(cell.x - cell.width / 2, cell.y, bottom),
          place(cell.x + cell.width / 2, cell.y, bottom),
          place(cell.x + top, cell.y, head),
          place(cell.x - top, cell.y, head)
        ]
        const [start, , end] = corners
        if (!start || !end) {
          return
        }
        const gradient = context.createLinearGradient(0, start.y, 0, end.y)
        gradient.addColorStop(0, "rgba(56, 242, 209, 0.3)")
        gradient.addColorStop(0.6, "rgba(51, 107, 255, 0.24)")
        gradient.addColorStop(1, "rgba(143, 92, 255, 0.14)")
        context.fillStyle = gradient
        context.beginPath()
        corners.forEach((corner, at) =>
          at === 0 ? context.moveTo(corner.x, corner.y) : context.lineTo(corner.x, corner.y)
        )
        context.closePath()
        context.fill()
      })
    },
    destroy() {
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
    }
  }
}

/**
 * Draws the stack's light with WebGL where it's available and falls back to the 2D canvas. A canvas keeps the first
 * kind of context it hands out, so when WebGL starts but its shader fails, the fallback draws on a sibling canvas.
 */
export function createStackLight(canvas: HTMLCanvasElement): StackLight | null {
  const webgl = webglLight(canvas)
  if (webgl) {
    return webgl
  }
  const fallback = canvasLight(canvas)
  if (fallback) {
    return fallback
  }
  const sibling = document.createElement("canvas")
  sibling.className = canvas.className
  canvas.after(sibling)
  canvas.hidden = true
  const light = canvasLight(sibling)
  return {
    draw: (frame) => light?.draw(frame),
    destroy() {
      sibling.remove()
      canvas.hidden = false
    }
  }
}
