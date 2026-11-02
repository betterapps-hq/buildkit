import { useEffect, useRef, type RefObject } from "react"
import fragmentSource from "./hero-light.frag?raw"

const VERTEX_SOURCE = "attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }"

type HeroFieldProps = {
  /** The element the light glows from behind, measured every frame. */
  target: RefObject<HTMLElement | null>
  intensity?: number
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

/**
 * The hero background shader. It pauses when off screen, holds one frame when reduced motion is requested and leaves
 * the CSS gradient behind it in place when WebGL is unavailable.
 */
export function HeroField({ target, intensity = 0.5 }: HeroFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" })
    if (!canvas || !gl) {
      return
    }
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource)
    const program = gl.createProgram()
    if (!vertex || !fragment || !program) {
      return
    }
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return
    }
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, "a")
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    const uResolution = gl.getUniformLocation(program, "u_resolution")
    const uTime = gl.getUniformLocation(program, "u_time")
    const uBox = gl.getUniformLocation(program, "u_box")
    const uIntensity = gl.getUniformLocation(program, "u_intensity")
    canvas.dataset.ready = "true"

    const still = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0
    let visible = true
    const start = performance.now()

    const draw = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const rect = canvas.getBoundingClientRect()
      const width = Math.max(1, Math.round(rect.width * dpr))
      const height = Math.max(1, Math.round(rect.height * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
      const box = target.current?.getBoundingClientRect()
      if (box && rect.width > 0 && rect.height > 0) {
        gl.uniform4f(
          uBox,
          (box.left - rect.left) / rect.width,
          (rect.bottom - box.bottom) / rect.height,
          (box.right - rect.left) / rect.width,
          (rect.bottom - box.top) / rect.height
        )
      }
      gl.uniform2f(uResolution, width, height)
      gl.uniform1f(uTime, still.matches ? 4 : (now - start) / 1000 + 4)
      gl.uniform1f(uIntensity, intensity)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const loop = (now: number) => {
      draw(now)
      frame = visible && !still.matches ? requestAnimationFrame(loop) : 0
    }
    const resume = () => {
      if (!frame) {
        frame = requestAnimationFrame(loop)
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      if (visible) {
        resume()
      }
    })
    observer.observe(canvas)
    const resize = new ResizeObserver(() => {
      if (!frame) {
        draw(performance.now())
      }
    })
    resize.observe(canvas)
    still.addEventListener("change", resume)
    resume()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      resize.disconnect()
      still.removeEventListener("change", resume)
      gl.getExtension("WEBGL_lose_context")?.loseContext()
    }
  }, [target, intensity])

  return <canvas ref={canvasRef} className="hero-field" aria-hidden="true" />
}
