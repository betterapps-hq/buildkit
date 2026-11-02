import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { createStackLight, type Occluder, type Pillar, type Point } from "./stackLight"

type Feature = "theme" | "modals" | "alerts" | "routing" | "preferences" | "configuration"
type Level = "core" | "framework" | "libraries"
type View = { tilt: number; turn: number; lift: number }
type Bounds = { left: number; right: number; top: number; bottom: number }
/** A card or glass plate the light passes under, and the plate that carries it onto its layer. */
type Cover = { plate: HTMLElement; bounds: Bounds; layer: number; pass: number; radius: number }

/** Left to right across a plate, so its packages light in a sweep. */
const SWEEP: Feature[] = ["theme", "routing", "alerts", "preferences", "modals", "configuration"]
/** The path the light traces up the stack and names along the way, into the app's dialog. */
const TRACED: Feature = "modals"
const LEVELS: Level[] = ["core", "framework", "libraries"]

/** How far the camera tilts back and turns once the story starts, in degrees, and how far it drifts while it plays. */
const TILT = 56
const TURN = -32
const DRIFT = { tilt: -4, turn: 7 }
/** How far above its layer a plate starts before it lands, in the stack's own pixels. */
const RISE = 320
/** How far into the app the last pillar of light reaches, hidden behind it, in screen pixels. */
const INTO_APP = 40
/** How much of the app's width the last pillar spreads to where it reaches the app, and how much deeper it grows. */
const FLARE = 0.78
const FLARE_DEPTH = 1.4
/** How much light gets through a glass plate. */
const GLASS = 0.45

/** Where each beat starts in story time. The pinned scroll plays all of it. */
const AT = { core: 1, framework: 2.3, libraries: 4.1, app: 5.8, swap: 6.8, settle: 9.6, end: 10.7 }

function radians(degrees: number) {
  return (degrees * Math.PI) / 180
}

/** Finds where a value starts failing `below` between two bounds, for a test that passes up to some point. */
function search(low: number, high: number, below: (value: number) => boolean) {
  for (let step = 0; step < 30; step++) {
    const middle = (low + high) / 2
    if (below(middle)) {
      low = middle
    } else {
      high = middle
    }
  }
  return (low + high) / 2
}

/** Finds every selector under `root`, or nothing when one is missing. */
function pick<Key extends string>(root: ParentNode, selectors: Record<Key, string>) {
  const found = {} as Record<Key, HTMLElement>
  for (const key of Object.keys(selectors) as Key[]) {
    const element = root.querySelector<HTMLElement>(selectors[key])
    if (!element) {
      return null
    }
    found[key] = element
  }
  return found
}

/** Where an element sits inside `ancestor`, from layout alone, so transforms mid-animation don't skew it. */
function offsetWithin(element: HTMLElement, ancestor: HTMLElement): Point {
  let x = 0
  let y = 0
  for (
    let node: HTMLElement | null = element;
    node && node !== ancestor;
    node = node.offsetParent as HTMLElement | null
  ) {
    x += node.offsetLeft
    y += node.offsetTop
  }
  return { x, y }
}

function chipsOf(plate: HTMLElement) {
  const chips: Partial<Record<Feature, HTMLElement>> = {}
  for (const chip of plate.querySelectorAll<HTMLElement>(".arch-story-chip")) {
    chips[chip.dataset.feature as Feature] = chip
  }
  return chips
}

function boundsOf(plate: HTMLElement, width: number, height: number): Bounds {
  return {
    left: plate.offsetLeft - width / 2,
    right: plate.offsetLeft + plate.offsetWidth - width / 2,
    top: plate.offsetTop - height / 2,
    bottom: plate.offsetTop + plate.offsetHeight - height / 2
  }
}

/** Presses a tower's switch so the plate at `index` is in front, unless it already is. */
function pressTower(tower: string, index: number) {
  const button = document.querySelectorAll<HTMLButtonElement>(`[data-tower="${tower}"] .arch-switch-option`)[index]
  if (button && button.getAttribute("aria-pressed") !== "true") {
    button.click()
  }
}

/**
 * Pinned for four viewports, the stack rebuilds from the bottom up. The flat diagram comes apart and its rails lift
 * into a legend. Each layer lands and lights in turn while pillars of light trace the modal path through them: from its
 * vanilla core package, through the React binding and the component library's modal manager, into the app, which the
 * light backlights. An agent then switches design systems. Only the light above React goes dark while the plate is
 * replaced, the layers below stay lit, and the dialog changes style. The flat diagram returns with the new library in
 * front.
 */
export function architectureScene() {
  const stage = document.querySelector<HTMLElement>(".arch-stage")
  const story = stage?.querySelector<HTMLElement>(".arch-story")
  if (!stage || !story) {
    return undefined
  }
  const parts = pick(story, {
    scene: ".arch-story-scene",
    tilt: ".arch-story-tilt",
    zoom: ".arch-story-zoom",
    turn: ".arch-story-turn",
    light: ".arch-story-light",
    lines: ".arch-story-lines",
    legend: ".arch-story-legend",
    tags: ".arch-story-tags",
    app: ".arch-story-app",
    swap: ".arch-story-swap",
    agent: ".arch-story-agent",
    prompt: ".arch-story-prompt",
    diff: ".arch-story-diff",
    core: '[data-plate="core"]',
    react: '[data-plate="react"]',
    router: '[data-plate="router"]',
    shadcn: '[data-plate="shadcn"]',
    fluentui: '[data-plate="fluentui"]'
  })
  const flat = pick(stage, {
    libraries: '.arch-level[data-layer="libraries"] > .arch-level-body',
    framework: '.arch-level[data-layer="framework"] > .arch-level-body',
    core: '.arch-level[data-layer="core"] > .arch-level-body'
  })
  if (!parts || !flat) {
    return undefined
  }
  // Each layer's legend entry, its label beside the stack and the rail it lifts off from
  const levelParts = (level: Level) => {
    const own = pick(story, {
      item: `.arch-story-level[data-level="${level}"]`,
      title: `.arch-story-level[data-level="${level}"] .arch-story-title`,
      tag: `.arch-story-tag[data-level="${level}"]`,
      leader: `.arch-story-leader[data-level="${level}"]`,
      tie: `.arch-story-tie[data-level="${level}"]`
    })
    const rail = pick(stage, {
      rail: `.arch-level[data-layer="${level}"] .arch-rail`,
      railTitle: `.arch-level[data-layer="${level}"] .arch-rail-title`
    })
    return own && rail ? { ...own, ...rail } : null
  }
  const coreParts = levelParts("core")
  const frameworkParts = levelParts("framework")
  const libraryParts = levelParts("libraries")
  if (!coreParts || !frameworkParts || !libraryParts) {
    return undefined
  }
  const levels = { core: coreParts, framework: frameworkParts, libraries: libraryParts }
  const fill = (level: Level) =>
    story.querySelector<HTMLElement>(`.arch-story-level[data-level="${level}"] .arch-story-link-fill`) ?? []
  const chips = {
    core: chipsOf(parts.core),
    react: chipsOf(parts.react),
    router: chipsOf(parts.router),
    shadcn: chipsOf(parts.shadcn),
    fluentui: chipsOf(parts.fluentui)
  }
  const light = createStackLight(parts.light as HTMLCanvasElement)
  const prompt = parts.prompt.textContent ?? ""
  parts.prompt.textContent = ""

  // The stack's own measurements, from layout: the plates' box, the gap between layers, where each feature's chip sits
  // relative to the box's center, and the cards and plates the light passes under.
  const geometry = {
    width: 0,
    height: 0,
    step: 0,
    chip: { width: 0, height: 0, radius: 0 },
    cells: {} as Record<Feature, Point>,
    library: { left: 0, right: 0, top: 0, bottom: 0 } as Bounds,
    router: { left: 0, right: 0, top: 0, bottom: 0 } as Bounds,
    covers: [] as Cover[]
  }
  // Where the story sits in the viewport, recomputed whenever ScrollTrigger refreshes.
  const layout = {
    width: 0,
    height: 0,
    caption: false,
    rails: false,
    tags: true,
    scale: 1,
    depth: 2200,
    x: 0,
    y: 0,
    lifts: { core: 0, framework: 0 },
    flip: { core: { x: 0, y: 0 }, framework: { x: 0, y: 0 }, libraries: { x: 0, y: 0 } } as Record<Level, Point>,
    leaders: { core: { x: 0, y: 0 }, framework: { x: 0, y: 0 }, libraries: { x: 0, y: 0 } } as Record<Level, Point>,
    app: { left: 0, top: 0, width: 0, height: 0 },
    tag: 0
  }

  /** Projects a point on the stack, in its own pixels from the box's center, to the story's screen pixels. */
  const project = (view: View, x: number, y: number, z: number, scale = layout.scale, depth = layout.depth): Point => {
    const cosTurn = Math.cos(view.turn)
    const sinTurn = Math.sin(view.turn)
    const px = (x * cosTurn - y * sinTurn) * scale
    const py = (x * sinTurn + y * cosTurn) * scale
    const pz = z * scale
    const cosTilt = Math.cos(view.tilt)
    const sinTilt = Math.sin(view.tilt)
    const ty = py * cosTilt - pz * sinTilt + view.lift
    const tz = py * sinTilt + pz * cosTilt
    const k = Number.isFinite(depth) ? depth / (depth - tz) : 1
    return { x: layout.x + px * k, y: layout.y + ty * k }
  }

  const rest = (share: number): View => ({
    tilt: radians(TILT + DRIFT.tilt * share),
    turn: radians(TURN + DRIFT.turn * share),
    lift: 0
  })

  /** Where a layer's tag starts, just past the plate's edge beside the traced package. */
  const tagAt = (view: View, layer: number, scale = layout.scale) => {
    const { cells, chip, width, step } = geometry
    const cell = cells[TRACED]
    const edge = project(view, cell.x + chip.width / 2, cell.y, step * layer, scale)
    const side = project(view, width / 2, cell.y, step * layer, scale)
    return { edge, left: Math.max(edge.x, side.x) + 22 }
  }

  /**
   * The stack's screen bounds around its origin at a scale, through the camera's whole drift and with perspective. A
   * tag width adds the tags beside it.
   */
  const extent = (scale: number, tagWidth: number) => {
    const { width, height, step, library, router } = geometry
    const corners = (bounds: Bounds, z: number): [number, number, number][] => [
      [bounds.left, bounds.top, z],
      [bounds.right, bounds.top, z],
      [bounds.left, bounds.bottom, z],
      [bounds.right, bounds.bottom, z]
    ]
    const box = { left: -width / 2, right: width / 2, top: -height / 2, bottom: height / 2 }
    const points = [
      ...corners(box, 0),
      ...corners(box, step),
      ...corners(library, step * 2),
      ...corners(router, step * 2)
    ]
    const xs: number[] = []
    const ys: number[] = []
    for (const view of [rest(0), rest(1)]) {
      for (const [x, y, z] of points) {
        const point = project(view, x, y, z, scale)
        xs.push(point.x - layout.x)
        ys.push(point.y - layout.y)
      }
      if (tagWidth > 0) {
        for (const layer of [0, 1, 2]) {
          xs.push(tagAt(view, layer, scale).left - layout.x + tagWidth)
        }
      }
    }
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
  }

  const measure = () => {
    const width = parts.turn.offsetWidth
    const height = parts.turn.offsetHeight
    geometry.width = width
    geometry.height = height
    geometry.step = Math.round(height * 0.8)
    for (const [feature, chip] of Object.entries(chips.core) as [Feature, HTMLElement][]) {
      geometry.cells[feature] = {
        x: chip.offsetLeft + chip.offsetWidth / 2 - width / 2,
        y: chip.offsetTop + chip.offsetHeight / 2 - height / 2
      }
    }
    const traced = chips.core[TRACED]
    const radius = (element: HTMLElement | undefined) =>
      element ? Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0 : 0
    geometry.chip = { width: traced?.offsetWidth ?? 0, height: traced?.offsetHeight ?? 0, radius: radius(traced) }
    geometry.library = boundsOf(parts.shadcn, width, height)
    geometry.router = boundsOf(parts.router, width, height)
    // Every plate above the core is glass, and every card on it blocks the light
    const above: [HTMLElement, number][] = [
      [parts.react, 1],
      [parts.router, 2],
      [parts.shadcn, 2],
      [parts.fluentui, 2]
    ]
    geometry.covers = above.flatMap(([plate, layer]) => {
      const bounds = boundsOf(plate, width, height)
      const cards = [...plate.querySelectorAll<HTMLElement>(".arch-story-chip")].map((chip) => {
        const left = bounds.left + chip.offsetLeft
        const top = bounds.top + chip.offsetTop
        return {
          plate,
          bounds: { left, top, right: left + chip.offsetWidth, bottom: top + chip.offsetHeight },
          layer,
          pass: 0,
          radius: geometry.chip.radius
        }
      })
      return [{ plate, bounds, layer, pass: GLASS, radius: radius(plate) }, ...cards]
    })
  }

  const compose = () => {
    measure()
    const width = document.documentElement.clientWidth
    const height = window.innerHeight
    const caption = width < 900
    const margin = gsap.utils.clamp(16, 64, width * 0.04)
    const gapY = gsap.utils.clamp(20, 48, height * 0.045)
    const stageLeft = stage.getBoundingClientRect().left
    layout.width = width
    layout.height = height
    layout.caption = caption
    story.style.width = `${width}px`
    story.style.height = `${height}px`
    story.style.left = `${-stageLeft}px`
    story.style.top = `${(stage.offsetHeight - height) / 2}px`

    // The legend takes the rails' place when they're on screen, so the rails can lift straight into it
    const rail = levels.core.rail
    layout.rails = !caption && rail.offsetWidth > 0
    let legendWidth = 200
    if (caption) {
      legendWidth = width - margin * 2
    } else if (layout.rails) {
      legendWidth = rail.offsetWidth
    }
    const legendLeft = layout.rails ? offsetWithin(rail, stage).x + stageLeft : margin
    parts.legend.style.width = `${legendWidth}px`

    // Wide enough for each library's dialog at close to its own width, which is 448px for shadcn and 600px for Fluent
    const appWidth = caption ? Math.min(460, width - margin * 2) : gsap.utils.clamp(400, 520, width * 0.38)
    parts.app.style.setProperty("--app-w", `${appWidth}px`)
    const appHeight = parts.app.offsetHeight
    const swapWidth = Math.min(300, width - margin * 2)
    parts.swap.style.setProperty("--swap-w", `${swapWidth}px`)
    const swapHeight = parts.swap.offsetHeight
    // Hidden tags measure nothing, so they're shown while the fit measures them
    parts.tags.hidden = false
    const tagWidth = Math.max(...LEVELS.map((level) => levels[level].tag.offsetWidth))
    layout.tag = levels.core.tag.offsetHeight

    const captionHeight = caption ? parts.legend.offsetHeight : 0
    const region = caption
      ? {
          left: margin,
          right: width - margin,
          top: margin + captionHeight + gapY + appHeight + gapY,
          bottom: height - margin - swapHeight - gapY
        }
      : {
          left: legendLeft + legendWidth + gsap.utils.clamp(36, 96, width * 0.05),
          right: width - margin,
          top: margin + appHeight + gapY,
          bottom: height - margin
        }
    // Perspective grows the stack unevenly, so the fit narrows in on its scale over a few passes
    layout.depth = Number.parseFloat(getComputedStyle(parts.scene).perspective) || 2200
    const fit = (tags: number) => {
      let scale = 1
      for (let pass = 0; pass < 4; pass += 1) {
        const span = extent(scale, tags)
        scale *= Math.min(
          (region.right - region.left) / (span.right - span.left),
          (region.bottom - region.top) / (span.bottom - span.top)
        )
        scale = Math.min(scale, caption ? 1.3 : 1.1)
      }
      return scale
    }
    // Tags stay when they leave the stack most of its size
    const tagged = fit(tagWidth)
    layout.tags = (!caption || width >= 600) && tagged >= fit(0) * 0.86
    const scale = layout.tags ? tagged : fit(0)
    const box = extent(scale, layout.tags ? tagWidth : 0)
    layout.scale = scale
    layout.x = (region.left + region.right) / 2 - (box.left + box.right) / 2
    layout.y = (region.top + region.bottom) / 2 - (box.top + box.bottom) / 2
    parts.scene.style.left = `${layout.x}px`
    parts.scene.style.top = `${layout.y}px`
    parts.zoom.style.transform = `scale3d(${scale}, ${scale}, ${scale})`
    parts.tags.hidden = !layout.tags
    story.style.setProperty("--glow-x", `${(region.left + region.right) / 2}px`)
    story.style.setProperty("--glow-y", `${(region.top + region.bottom) / 2}px`)

    // The core starts in the middle of the screen, and the camera lowers it into the stack's room as layers land
    const middle = (region.top + region.bottom) / 2
    const open = caption ? (margin + captionHeight + gapY + region.bottom) / 2 : height / 2
    const view = rest(0.5)
    layout.lifts.core = open - project(view, 0, 0, 0).y
    layout.lifts.framework = (open + middle) / 2 - project(view, 0, 0, geometry.step / 2).y

    // The app sits over the traced column, so the light rises straight on into it
    const stackTop = layout.y + box.top
    const column = project(view, geometry.cells[TRACED].x, geometry.cells[TRACED].y, geometry.step * 2).x
    layout.app = {
      left: gsap.utils.clamp(margin, width - margin - appWidth, column - appWidth / 2),
      top: caption ? margin + captionHeight + gapY : Math.max(margin, stackTop - gapY - appHeight),
      width: appWidth,
      height: appHeight
    }
    parts.app.style.left = `${layout.app.left}px`
    parts.app.style.top = `${layout.app.top}px`
    parts.swap.style.left = `${caption ? margin : legendLeft}px`
    parts.swap.style.top = `${caption ? height - margin - swapHeight : margin}px`

    // The legend spreads to match the layers, with Framework level with its plate
    const anchors = {
      core: project(view, -geometry.width / 2, 0, 0),
      framework: project(view, -geometry.width / 2, 0, geometry.step),
      libraries: project(
        view,
        geometry.library.left,
        (geometry.library.top + geometry.library.bottom) / 2,
        geometry.step * 2
      )
    }
    parts.legend.style.left = `${legendLeft}px`
    if (caption) {
      parts.legend.style.top = `${margin}px`
    } else {
      const heights = LEVELS.map((level) => levels[level].item.offsetHeight)
      const spread = anchors.core.y - anchors.libraries.y
      const gap = gsap.utils.clamp(24, 120, (spread - heights[0] / 2 - heights[1] - heights[2] / 2) / 2)
      parts.legend.style.setProperty("--legend-gap", `${gap}px`)
      const item = levels.framework.item
      const top = anchors.framework.y - (item.offsetTop + item.offsetHeight / 2)
      parts.legend.style.top = `${gsap.utils.clamp(margin + swapHeight + 24, height - margin - parts.legend.offsetHeight, top)}px`
    }

    for (const level of LEVELS) {
      const { title, railTitle, tie } = levels[level]
      const from = offsetWithin(railTitle, stage)
      const to = offsetWithin(title, stage)
      layout.flip[level] = layout.rails ? { x: from.x - to.x, y: from.y - to.y } : { x: -24, y: 0 }
      const at = offsetWithin(title, story)
      layout.leaders[level] = { x: legendLeft + legendWidth + 14, y: at.y + title.offsetHeight / 2 }
      if (!layout.tags) {
        tie.removeAttribute("d")
      }
    }
  }

  compose()
  ScrollTrigger.addEventListener("refreshInit", compose)

  // Pillars of light trace the modal path from its core package up through each layer and into the app. The rest of
  // each layer only lights up as it lands, so the light never suggests the dialog uses every package.
  const pillar: Record<"lower" | "upper" | "out", Pillar> = {
    lower: { grow: 0, land: 0 },
    upper: { grow: 0, land: 0 },
    out: { grow: 0, land: 0 }
  }
  const drawn = { core: { value: 0 }, framework: { value: 0 }, libraries: { value: 0 } }
  const typed = { count: 0 }

  const timeline = gsap.timeline({
    defaults: { ease: "power2.inOut", duration: 0.4 },
    scrollTrigger: {
      trigger: stage,
      start: "center center",
      end: "+=420%",
      pin: true,
      // The stage sits in a flex column, where ScrollTrigger leaves out pin spacing unless asked.
      pinSpacing: true,
      scrub: 0.8,
      invalidateOnRefresh: true,
      onToggle: ({ isActive }) => {
        if (isActive) {
          gsap.ticker.add(render)
        }
      },
      // The flat diagram behind the story follows the agent's swap, so it returns with the new library in front
      onUpdate: ({ progress }) => pressTower("components", progress * AT.end >= AT.swap + 0.95 ? 1 : 0)
    }
  })
  const present = (elements: (HTMLElement | undefined)[]) =>
    elements.filter((element): element is HTMLElement => element !== undefined)

  /** Lights a plate's packages in a sweep as its layer settles into place. */
  const build = (at: number, plate: Partial<Record<Feature, HTMLElement>>) =>
    timeline.to(present(SWEEP.map((feature) => plate[feature])), { "--lit": 1, duration: 0.3, stagger: 0.06 }, at)
  /** A pillar of light arrives, flashing where it lands. */
  const arrive = (part: Pillar, at: number) =>
    timeline.fromTo(part, { land: 1 }, { land: 0, duration: 0.7, ease: "power2.out", immediateRender: false }, at)
  /**
   * The traced light reaches a package: it brightens, light pools under it and a soft shockwave crosses its plate. The
   * pillar it came up flashes where it lands.
   */
  const reach = (at: number, plate: HTMLElement, chip: HTMLElement | undefined, from?: Pillar) => {
    timeline
      .to(chip ?? [], { "--trace": 1, duration: 0.3 }, at)
      .fromTo(
        plate,
        { "--ripple": 0 },
        { "--ripple": 1, duration: 0.8, ease: "power1.out", immediateRender: false },
        at
      )
      .to(plate, { "--pool": 1, duration: 0.35 }, at)
    if (from) {
      arrive(from, at)
    }
  }
  const grow = (part: Pillar, value: number, at: number, duration = 0.45) =>
    timeline.to(part, { grow: value, duration, ease: value > 0.5 ? "power2.out" : "power2.inOut" }, at)
  /** Drops a plate onto its layer from above, with a flash where it lands. */
  const land = (plate: HTMLElement, layer: number, at: number) => {
    timeline
      .fromTo(
        plate,
        { z: () => geometry.step * layer + RISE, autoAlpha: 0 },
        { z: () => geometry.step * layer, autoAlpha: 1, duration: 0.6, ease: "power3.out" },
        at
      )
      .to(plate, { "--flash": 1, duration: 0.1, ease: "none" }, at + 0.42)
      .to(plate, { "--flash": 0, duration: 0.5, ease: "power2.out" }, at + 0.52)
  }
  /** Moves the camera, and in the legend's column the legend with it, so each entry stays level with its plate. */
  const frame = (lift: () => number, at: number) =>
    timeline
      .to(parts.tilt, { y: lift, duration: 0.8 }, at)
      .to(parts.legend, { y: () => (layout.caption ? 0 : lift()), duration: 0.8 }, at)
  const show = (targets: gsap.TweenTarget, at: number, duration = 0.3) =>
    timeline.to(targets, { autoAlpha: 1, duration }, at)
  const hide = (targets: gsap.TweenTarget, at: number, duration = 0.3) =>
    timeline.to(targets, { autoAlpha: 0, duration }, at)
  const items = LEVELS.map((level) => levels[level].item)
  const links = gsap.utils.toArray<HTMLElement>(".arch-story-link", story)
  const railBoxes = LEVELS.map((level) => levels[level].rail)
  const kit = (root: HTMLElement, id: string) => root.querySelectorAll<HTMLElement>(`[data-kit="${id}"]`)
  const coreLift = () => (layout.caption ? 0 : layout.lifts.core)

  // Enter: the flat diagram comes apart, its rails lift into the legend and the core tilts up into view
  timeline
    .fromTo(story, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, ease: "none" }, 0)
    .fromTo(story, { "--veil": 0 }, { "--veil": 1, duration: 0.5, ease: "none" }, 0.1)
    .to(railBoxes, { autoAlpha: 0, duration: 0.05, ease: "none" }, 0.02)
    .to(flat.libraries, { y: -56, autoAlpha: 0, duration: 0.45 }, 0)
    .to(flat.framework, { y: -36, autoAlpha: 0, duration: 0.45 }, 0.06)
    .to(flat.core, { y: 28, autoAlpha: 0, duration: 0.4 }, 0.14)
    .fromTo(
      parts.tilt,
      { rotationX: 0, y: () => layout.lifts.core + 160 },
      { rotationX: TILT, y: () => layout.lifts.core, duration: 0.85 },
      0.12
    )
    .fromTo(parts.turn, { rotation: 0 }, { rotation: TURN, duration: 0.85 }, 0.12)
    .fromTo(parts.legend, { y: coreLift }, { y: coreLift, duration: 0.85 }, 0.12)
    .fromTo(parts.core, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: "none" }, 0.18)
    .fromTo(links, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0.7)
  for (const level of LEVELS) {
    timeline.fromTo(
      levels[level].item,
      {
        x: () => layout.flip[level].x,
        y: () => layout.flip[level].y - coreLift(),
        "--flat": () => (layout.rails ? 1 : 0),
        "--shown": () => (layout.rails ? 1 : 0)
      },
      { x: 0, y: 0, "--flat": 0, "--shown": 1, duration: 0.8 },
      0.08
    )
  }
  // The camera drifts around the stack for as long as it stands
  timeline
    .to(parts.turn, { rotation: TURN + DRIFT.turn, duration: AT.settle - AT.core, ease: "none" }, AT.core)
    .to(parts.tilt, { rotationX: TILT + DRIFT.tilt, duration: AT.settle - AT.core, ease: "none" }, AT.core)

  // Core: the base lights, and the modal's light starts at its core package, waiting for the layer above
  timeline
    .to(levels.core.item, { "--active": 1, "--built": 1, duration: 0.3 }, AT.core)
    .to(parts.core, { "--lit": 1, duration: 0.4 }, AT.core)
    .to(drawn.core, { value: 1, duration: 0.45 }, AT.core + 0.1)
  build(AT.core + 0.15, chips.core)
  reach(AT.core + 0.55, parts.core, chips.core[TRACED])
  grow(pillar.lower, 0.22, AT.core + 0.75)
  show(levels.core.tag, AT.core + 0.7)
  timeline.to(levels.core.tie, { opacity: 1, duration: 0.3 }, AT.core + 0.7)

  // Framework: React lands on the core and the light rises into its modal binding
  timeline
    .to(levels.core.item, { "--active": 0, duration: 0.3 }, AT.framework)
    .to(levels.framework.item, { "--active": 1, "--built": 1, duration: 0.3 }, AT.framework)
    .to(fill("framework"), { scaleY: 1, duration: 0.5 }, AT.framework + 0.1)
    .to(drawn.framework, { value: 1, duration: 0.45 }, AT.framework + 0.3)
    .to(parts.react, { "--lit": 1, duration: 0.4 }, AT.framework + 0.55)
  frame(() => layout.lifts.framework, AT.framework)
  land(parts.react, 1, AT.framework)
  build(AT.framework + 0.55, chips.react)
  grow(pillar.lower, 1, AT.framework + 0.7)
  reach(AT.framework + 1.05, parts.react, chips.react[TRACED], pillar.lower)
  grow(pillar.upper, 0.22, AT.framework + 1.3)
  show(levels.framework.tag, AT.framework + 1.1)
  timeline.to(levels.framework.tie, { opacity: 1, duration: 0.3 }, AT.framework + 1.1)

  // Libraries: the component library and the router adapter land, and the light reaches the modal manager
  timeline
    .to(levels.framework.item, { "--active": 0, duration: 0.3 }, AT.libraries)
    .to(levels.libraries.item, { "--active": 1, "--built": 1, duration: 0.3 }, AT.libraries)
    .to(fill("libraries"), { scaleY: 1, duration: 0.5 }, AT.libraries + 0.1)
    .to(drawn.libraries, { value: 1, duration: 0.45 }, AT.libraries + 0.3)
    .to([parts.shadcn, parts.router], { "--lit": 1, duration: 0.4 }, AT.libraries + 0.6)
  frame(() => 0, AT.libraries)
  land(parts.shadcn, 2, AT.libraries)
  land(parts.router, 2, AT.libraries + 0.14)
  build(AT.libraries + 0.6, { ...chips.router, ...chips.shadcn })
  grow(pillar.upper, 1, AT.libraries + 0.7)
  reach(AT.libraries + 1.05, parts.shadcn, chips.shadcn[TRACED], pillar.upper)
  grow(pillar.out, 0.14, AT.libraries + 1.3)
  show(levels.libraries.tag, AT.libraries + 1.1)
  timeline.to(levels.libraries.tie, { opacity: 1, duration: 0.3 }, AT.libraries + 1.1)

  // App: the light runs on into the app, backlighting it, and its dialog opens
  timeline.fromTo(
    parts.app,
    { autoAlpha: 0, y: 24, scale: 0.96 },
    { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: "power3.out" },
    AT.app
  )
  grow(pillar.out, 1, AT.app + 0.3, 0.4)
  timeline
    .fromTo(
      kit(parts.app, "shadcn"),
      { autoAlpha: 0, scale: 0.94 },
      { autoAlpha: 1, scale: 1, duration: 0.35, ease: "back.out(1.6)" },
      AT.app + 0.6
    )
    .to(parts.app, { "--charge": 1, duration: 0.3 }, AT.app + 0.65)
  arrive(pillar.out, AT.app + 0.65)

  // Swap: an agent asks for Fluent UI. Only the light above React steps back while the plate is replaced, and the
  // layers below stay lit.
  timeline
    .fromTo(parts.agent, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.3 }, AT.swap)
    .to(
      typed,
      {
        count: prompt.length,
        duration: 0.45,
        ease: "none",
        onUpdate: () => {
          parts.prompt.textContent = prompt.slice(0, Math.round(typed.count))
        }
      },
      AT.swap + 0.1
    )
    .to(parts.app, { "--charge": 0.3, duration: 0.3 }, AT.swap + 0.5)
  grow(pillar.out, 0, AT.swap + 0.5, 0.3)
  grow(pillar.upper, 0.22, AT.swap + 0.6, 0.3)
  timeline
    .to(
      [parts.shadcn, ...present(SWEEP.map((feature) => chips.shadcn[feature]))],
      { "--lit": 0, duration: 0.3 },
      AT.swap + 0.6
    )
    .to(chips.shadcn[TRACED] ?? [], { "--trace": 0, duration: 0.3 }, AT.swap + 0.6)
    .to(parts.shadcn, { "--pool": 0, duration: 0.3 }, AT.swap + 0.6)
    .to(
      parts.shadcn,
      { z: () => geometry.step * 2 + RISE, autoAlpha: 0, duration: 0.5, ease: "power2.in" },
      AT.swap + 0.7
    )
    .to([levels.core.item, levels.framework.item], { "--flat": 1, duration: 0.3 }, AT.swap + 0.72)
  hide(kit(levels.libraries.tag, "shadcn"), AT.swap + 0.75, 0.2)
  land(parts.fluentui, 2, AT.swap + 0.95)
  show(parts.diff, AT.swap + 1)
  timeline.from(
    parts.diff.querySelectorAll(".arch-story-diff-line"),
    { x: -8, autoAlpha: 0, duration: 0.3, stagger: 0.18 },
    AT.swap + 1.1
  )
  timeline.to(parts.fluentui, { "--lit": 1, duration: 0.4 }, AT.swap + 1.45)
  build(AT.swap + 1.45, chips.fluentui)
  grow(pillar.upper, 1, AT.swap + 1.45, 0.35)
  reach(AT.swap + 1.75, parts.fluentui, chips.fluentui[TRACED], pillar.upper)
  show(kit(levels.libraries.tag, "fluentui"), AT.swap + 1.75, 0.2)
  grow(pillar.out, 1, AT.swap + 1.85, 0.35)
  hide(kit(parts.app, "shadcn"), AT.swap + 2.1, 0.25)
  show(kit(parts.app, "fluentui"), AT.swap + 2.15, 0.3)
  timeline.to(parts.app, { "--charge": 1, duration: 0.3 }, AT.swap + 2.15)
  arrive(pillar.out, AT.swap + 2.15)

  // Settle: the story fades back into the flat diagram, which now has the new library in front
  hide([parts.scene, parts.light, parts.lines, parts.tags, parts.app, parts.swap, ...links], AT.settle, 0.45)
  timeline
    .to(parts.tilt, { rotationX: 0, duration: 0.6 }, AT.settle)
    .to(parts.turn, { rotation: 0, duration: 0.6 }, AT.settle)
    .to(story, { "--veil": 0, duration: 0.5, ease: "none" }, AT.settle + 0.25)
    .to(items, { "--active": 0, "--built": 0, duration: 0.3 }, AT.settle)
    .to(flat.core, { y: 0, autoAlpha: 1, duration: 0.45 }, AT.settle + 0.25)
    .to(flat.framework, { y: 0, autoAlpha: 1, duration: 0.45 }, AT.settle + 0.37)
    .to(flat.libraries, { y: 0, autoAlpha: 1, duration: 0.45 }, AT.settle + 0.49)
    .to(railBoxes, { autoAlpha: 1, duration: 0.05, ease: "none" }, AT.end - 0.12)
    .to(story, { autoAlpha: 0, duration: 0.01, ease: "none" }, AT.end - 0.02)
    .set({}, {}, AT.end)
  for (const level of LEVELS) {
    timeline.to(
      levels[level].item,
      {
        x: () => layout.flip[level].x,
        y: () => layout.flip[level].y,
        "--flat": () => (layout.rails ? 1 : 0),
        "--shown": () => (layout.rails ? 1 : 0),
        duration: 0.8
      },
      AT.settle + 0.1
    )
  }

  /** The cards and plates the light passes under, where they are now and how much they let through. */
  const covers = (): Occluder[] =>
    geometry.covers
      .map(({ plate, bounds, layer, pass, radius }) => {
        const shown = plate.style.visibility === "hidden" ? 0 : Number(gsap.getProperty(plate, "opacity"))
        return { ...bounds, z: Number(gsap.getProperty(plate, "z")), pass: 1 - (1 - pass) * shown, layer, radius }
      })
      .filter((cover) => cover.pass < 1)

  /** Draws the light, leader lines and labels for the camera's current view. */
  const render = () => {
    const trigger = timeline.scrollTrigger
    if (!trigger?.isActive && (timeline.progress() <= 0 || timeline.progress() >= 1)) {
      gsap.ticker.remove(render)
    }
    if (story?.style.visibility === "hidden") {
      return
    }
    const view: View = {
      tilt: radians(Number(gsap.getProperty(parts.tilt, "rotationX"))),
      turn: radians(Number(gsap.getProperty(parts.turn, "rotation"))),
      lift: Number(gsap.getProperty(parts.tilt, "y"))
    }
    const { step, chip } = geometry
    const cell = geometry.cells[TRACED]
    const place = (x: number, y: number, z: number) => project(view, x, y, z)

    // The last pillar rises until it's well inside the app, hidden behind it. Where it reaches the app's bottom edge it
    // has spread to most of the app's width, keeping clear of its corners.
    const { app } = layout
    const bottom = app.top + app.height
    const above = (y: number) => (z: number) => place(cell.x, cell.y, z).y > y
    const top = search(step * 2, step * 2 + 2000, above(bottom - INTO_APP))
    const reaches = search(step * 2, top, above(bottom))
    const column = place(cell.x, cell.y, reaches).x
    const room = Math.min(column - app.left, app.left + app.width - column) - 16
    const across = Math.min(app.width * FLARE, room * 2)
    const spread = search(
      chip.width / 2,
      chip.width * 3,
      (x) => place(cell.x + x, cell.y, reaches).x - place(cell.x - x, cell.y, reaches).x < across
    )
    const full = (reaches - step * 2) / Math.max(top - step * 2, 1)

    light?.draw({
      width: layout.width,
      height: layout.height,
      time: gsap.ticker.time,
      camera: { x: layout.x, y: layout.y, depth: layout.depth, scale: layout.scale },
      view,
      cell: { x: cell.x, y: cell.y, width: chip.width, height: chip.height, radius: chip.radius },
      levels: [0, step, step * 2, top],
      flare: { width: spread * 2, height: chip.height * FLARE_DEPTH, from: full * 0.3, to: full },
      pillars: [pillar.lower, pillar.upper, pillar.out],
      occluders: covers(),
      app: { left: app.left, top: app.top, right: app.left + app.width, bottom },
      backlight: Number.parseFloat(parts.app.style.getPropertyValue("--charge")) || 0,
      place
    })

    const anchors: Record<Level, Point> = {
      core: project(view, -geometry.width / 2, 0, 0),
      framework: project(view, -geometry.width / 2, 0, step),
      libraries: project(view, geometry.library.left, (geometry.library.top + geometry.library.bottom) / 2, step * 2)
    }
    const legendLift = Number(gsap.getProperty(parts.legend, "y"))
    LEVELS.forEach((level, layer) => {
      const { leader, tie, tag } = levels[level]
      if (!layout.caption) {
        const start = { x: layout.leaders[level].x, y: layout.leaders[level].y + legendLift }
        const end = anchors[level]
        const bend = (start.x + end.x) / 2
        leader.setAttribute(
          "d",
          `M${start.x} ${start.y}C${bend} ${start.y} ${bend} ${end.y} ${end.x} ${end.y}` +
            `M${end.x - 2.5} ${end.y}a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0`
        )
        const length = Math.hypot(end.x - start.x, end.y - start.y) * 1.15 + 16
        leader.setAttribute("stroke-dasharray", `${length * drawn[level].value} ${length}`)
      }
      if (layout.tags) {
        const { edge, left } = tagAt(view, layer)
        tag.style.translate = `${left}px ${edge.y - layout.tag / 2}px`
        tie.setAttribute("d", `M${edge.x} ${edge.y}L${left} ${edge.y}`)
      }
    })
  }

  return () => {
    gsap.ticker.remove(render)
    ScrollTrigger.removeEventListener("refreshInit", compose)
    light?.destroy()
    parts.prompt.textContent = prompt
    for (const element of [story, parts.scene, parts.zoom, parts.legend, parts.app, parts.swap]) {
      element.removeAttribute("style")
    }
    for (const level of LEVELS) {
      levels[level].tag.style.removeProperty("translate")
      levels[level].leader.removeAttribute("d")
      levels[level].tie.removeAttribute("d")
    }
    parts.tags.hidden = false
  }
}
