import fragmentSource from "./stack-light.frag?raw"

const VERTEX_SOURCE = "attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }"

/** The most beams and sparks a frame can hold, matching the arrays in the shader. */
export const MAX_BEAMS = 16
export const MAX_SPARKS = 18

export type Point = { x: number; y: number }

/** Light rising from one package to the next. `grow` is how far up it has reached and `power` how bright it is. */
export type Beam = { from: Point; to: Point; grow: number; power: number; phase: number }

/** A ripple across a plate where light reaches a package, and the glow it leaves under the package. */
export type Spark = { at: Point; ring: number; glow: number }

/** One frame of light, in CSS pixels from the canvas's top left. */
export type LightFrame = {
  width: number
  height: number
  time: number
  beams: Beam[]
  sparks: Spark[]
  /** The plates' x and y axes on screen, so ripples lie flat on the tilted plates. */
  axes: [number, number, number, number]
  /** A package's radius on its plate, which ripples spread out from. */
  size: number
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
  const uBeamCount = uniform("u_beamCount")
  const uSparkCount = uniform("u_sparkCount")
  const uBeams = uniform("u_beams")
  const uBeamState = uniform("u_beamState")
  const uSparks = uniform("u_sparks")
  const uAxes = uniform("u_axes")
  const uSize = uniform("u_size")
  const beams = new Float32Array(MAX_BEAMS * 4)
  const beamState = new Float32Array(MAX_BEAMS * 4)
  const sparks = new Float32Array(MAX_SPARKS * 4)

  return {
    draw(frame) {
      const ratio = fit(canvas, frame, 1.25)
      gl.viewport(0, 0, canvas.width, canvas.height)
      const beamCount = Math.min(frame.beams.length, MAX_BEAMS)
      frame.beams.slice(0, beamCount).forEach((beam, index) => {
        beams.set([beam.from.x, beam.from.y, beam.to.x, beam.to.y], index * 4)
        beamState.set([beam.grow, beam.power, beam.phase, 0], index * 4)
      })
      const sparkCount = Math.min(frame.sparks.length, MAX_SPARKS)
      frame.sparks.slice(0, sparkCount).forEach((spark, index) => {
        sparks.set([spark.at.x, spark.at.y, spark.ring, spark.glow], index * 4)
      })
      gl.uniform2f(uResolution, canvas.width, canvas.height)
      gl.uniform1f(uScale, ratio)
      gl.uniform1f(uTime, frame.time)
      gl.uniform1f(uBeamCount, beamCount)
      gl.uniform1f(uSparkCount, sparkCount)
      gl.uniform4fv(uBeams, beams)
      gl.uniform4fv(uBeamState, beamState)
      gl.uniform4fv(uSparks, sparks)
      gl.uniform4f(uAxes, ...frame.axes)
      gl.uniform1f(uSize, frame.size)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    destroy() {
      gl.getExtension("WEBGL_lose_context")?.loseContext()
    }
  }
}

/** Soft round light at a point, for pulses and the tips of growing beams. */
function glint(context: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, `rgba(230, 240, 255, ${alpha})`)
  gradient.addColorStop(0.35, `rgba(110, 160, 255, ${alpha * 0.5})`)
  gradient.addColorStop(1, "rgba(51, 112, 255, 0)")
  context.fillStyle = gradient
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

/** The same light drawn with the 2D canvas, for browsers without WebGL. */
function canvasLight(canvas: HTMLCanvasElement): StackLight | null {
  const context = canvas.getContext("2d")
  if (!context) {
    return null
  }
  const strokes: [number, string][] = [
    [36, "51, 112, 255, 0.06"],
    [13, "64, 128, 255, 0.2"],
    [4.5, "122, 170, 255, 0.55"],
    [1.6, "230, 240, 255, 0.95"]
  ]

  return {
    draw(frame) {
      const ratio = fit(canvas, frame, 1.5)
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.globalCompositeOperation = "lighter"
      context.lineCap = "round"
      const [ax, ay, bx, by] = frame.axes

      for (const spark of frame.sparks) {
        context.setTransform(ratio * ax, ratio * ay, ratio * bx, ratio * by, ratio * spark.at.x, ratio * spark.at.y)
        if (spark.glow > 0) {
          const radius = frame.size * 2
          const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius)
          gradient.addColorStop(0, `rgba(51, 112, 255, ${0.42 * spark.glow})`)
          gradient.addColorStop(1, "rgba(51, 112, 255, 0)")
          context.fillStyle = gradient
          context.fillRect(-radius, -radius, radius * 2, radius * 2)
        }
        if (spark.ring > 0 && spark.ring < 1) {
          context.beginPath()
          context.arc(0, 0, frame.size * (0.6 + 2 * spark.ring), 0, Math.PI * 2)
          // The path keeps the plate's tilt while the stroke keeps an even width on screen
          context.setTransform(ratio, 0, 0, ratio, 0, 0)
          context.lineWidth = 1.5 + 4 * spark.ring
          context.strokeStyle = `rgba(143, 180, 255, ${0.9 * (1 - spark.ring) ** 2})`
          context.stroke()
        }
      }

      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      for (const beam of frame.beams) {
        if (beam.grow <= 0 || beam.power <= 0) {
          continue
        }
        const tip = {
          x: beam.from.x + (beam.to.x - beam.from.x) * beam.grow,
          y: beam.from.y + (beam.to.y - beam.from.y) * beam.grow
        }
        for (const [width, color] of strokes) {
          const [r, g, b, a] = color.split(", ").map(Number)
          context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a * beam.power})`
          context.lineWidth = width
          context.beginPath()
          context.moveTo(beam.from.x, beam.from.y)
          context.lineTo(tip.x, tip.y)
          context.stroke()
        }
        // Pulses travel up the beam, away from the package it starts at
        const length = Math.hypot(tip.x - beam.from.x, tip.y - beam.from.y)
        const spacing = 70
        for (let along = (frame.time * 110 + beam.phase * 11) % spacing; along < length; along += spacing) {
          const t = along / Math.max(length, 1)
          glint(
            context,
            beam.from.x + (tip.x - beam.from.x) * t,
            beam.from.y + (tip.y - beam.from.y) * t,
            8,
            0.55 * beam.power
          )
        }
        if (beam.grow < 0.999) {
          glint(context, tip.x, tip.y, 18, 0.9 * beam.power)
        }
      }
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
