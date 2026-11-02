import { gsap } from "gsap"
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { architectureScene } from "./architecture"
import { examplesCarousel } from "./examples"

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin)

const MOTION = "(prefers-reduced-motion: no-preference)"
const WIDE_MOTION = "(prefers-reduced-motion: no-preference) and (min-width: 761px)"
const STAGE_MOTION = "(prefers-reduced-motion: no-preference) and (min-height: 500px)"
/**
 * Where the examples pin as a carousel: wide screens with room for the side-by-side layout in examples.css and for its
 * 660px slides. Narrower screens stack each example's preview and code, too tall to pin, so their tabs switch directly.
 */
const CAROUSEL_MOTION = "(prefers-reduced-motion: no-preference) and (min-width: 1101px) and (min-height: 800px)"

/** Headline lines rise out of their masks, the battery charges and the install command scrambles in. */
function heroIntro() {
  const timeline = gsap.timeline({ defaults: { ease: "expo.out", duration: 1.1 } })
  timeline
    .from(".announce", { y: 14, autoAlpha: 0, duration: 0.9 }, 0)
    .from(".hero-line-text", { yPercent: 112, stagger: 0.08 }, 0.05)
    .from(".hero-copy > *", { y: 22, autoAlpha: 0, stagger: 0.08, duration: 1 }, 0.25)
    .from(".battery .charge:not(.is-empty)", { scaleX: 0, stagger: 0.18, duration: 0.5, ease: "power2.out" }, 0.6)
    .from(".hero .workbench", { autoAlpha: 0, duration: 1.2, ease: "power2.out" }, 0.45)
  const command = document.querySelector<HTMLElement>(".hero .command-text")
  if (command?.textContent) {
    timeline.to(
      command,
      {
        duration: 0.9,
        ease: "none",
        scrambleText: { text: command.textContent, chars: "lowerCase", speed: 0.6 }
      },
      0.55
    )
  }
}

/** The editor window tilts up out of the page as it scrolls into place. */
function workbenchTilt() {
  gsap.fromTo(
    ".hero .workbench",
    { rotateX: 18, y: 120, scale: 0.92, transformPerspective: 1600, transformOrigin: "50% 0%" },
    {
      rotateX: 0,
      y: 0,
      scale: 1,
      ease: "none",
      scrollTrigger: { trigger: ".hero .workbench", start: "top 95%", end: "top 35%", scrub: 0.8 }
    }
  )
}

/** Plays a one-off timeline when `trigger` is well into view. The builder gets the timeline to fill. */
function onArrival(trigger: string, build: (timeline: gsap.core.Timeline) => void) {
  if (document.querySelector(trigger)) {
    build(gsap.timeline({ scrollTrigger: { trigger, start: "top 65%", once: true } }))
  }
}

/** Hostnames fill in across each worktree's row, one after another, as the table arrives. */
function domainRows() {
  onArrival(".tl-domains", (timeline) => {
    gsap.utils.toArray<HTMLElement>(".tl-domains .tl-host").forEach((host, index) => {
      const name = host.querySelector<HTMLElement>(".tl-host-name")
      timeline.from(host, { x: -10, autoAlpha: 0, duration: 0.6, ease: "expo.out" }, 0.3 + index * 0.07)
      if (name?.textContent) {
        timeline.to(
          name,
          { duration: 0.5, ease: "none", scrambleText: { text: name.textContent, chars: "lowerCase", speed: 0.6 } },
          "<"
        )
      }
    })
  })
}

/** Each tool slides in from the side as the page scrolls to it, following the scroll. */
function toolSlides() {
  for (const tool of gsap.utils.toArray<HTMLElement>(".tl-tool")) {
    gsap.from(tool, {
      x: () => Math.min(160, window.innerWidth * 0.12),
      autoAlpha: 0,
      ease: "none",
      scrollTrigger: {
        trigger: tool,
        start: "top 92%",
        end: "top 50%",
        scrub: 0.6,
        invalidateOnRefresh: true,
        // Measured after the pinned stories above, which add their scroll length before the tools
        refreshPriority: -2
      }
    })
  }
}

/** The scaffolder's spine draws down through its steps with the scroll, lighting each node as it passes. */
function scaffolderSpine() {
  const steps = gsap.utils.toArray<HTMLElement>(".tl-steps .tl-step")
  if (steps.length === 0) {
    return
  }
  const timeline = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: ".tl-steps", start: "top 70%", end: "bottom 60%", scrub: 0.8 }
  })
  steps.forEach((step, index) => {
    const above = step.querySelector<HTMLElement>(".tl-spine-above")
    const node = step.querySelector<HTMLElement>(".tl-step-node")
    const below = step.querySelector<HTMLElement>(".tl-spine-below")
    if (above && index > 0) {
      timeline.from(above, { scaleY: 0, duration: above.offsetHeight / 100 })
    }
    if (node) {
      timeline.from(node, { scale: 0.4, borderColor: "#2a3860", duration: 0.15 })
    }
    if (below && index < steps.length - 1) {
      timeline.from(below, { scaleY: 0, duration: below.offsetHeight / 100 })
    }
  })
}

/**
 * The search palette types its query, then its results arrive group by group. Returns a cleanup that puts the query
 * text back, since the typing writes to the DOM directly.
 */
function paletteTyping() {
  const query = document.querySelector<HTMLElement>(".docs-query-text")
  const text = query?.textContent
  if (!query || !text) {
    return undefined
  }
  const typed = { count: 0 }
  query.textContent = ""
  onArrival(".docs-palette", (timeline) =>
    timeline
      .to(
        typed,
        {
          count: text.length,
          duration: text.length * 0.06,
          ease: "none",
          onUpdate: () => {
            query.textContent = text.slice(0, Math.round(typed.count))
          }
        },
        0.4
      )
      .from(
        ".docs-results .docs-group-label, .docs-results .docs-result",
        { y: 6, autoAlpha: 0, duration: 0.5, ease: "power3.out", stagger: 0.04 },
        ">0.1"
      )
  )
  return () => {
    query.textContent = text
  }
}

/** The closing battery charges cell by cell as the call to action arrives. */
function ctaCharge() {
  onArrival(".cta-battery", (timeline) =>
    timeline.from(".cta-charge", { scaleX: 0, duration: 0.5, ease: "power2.out", stagger: 0.18 }, 0.4)
  )
}

/** Elements marked `data-reveal` rise in once, and children of `data-reveal-stagger` rise in sequence. */
function reveals() {
  const from = { y: 28, autoAlpha: 0, duration: 1.1, ease: "expo.out" }
  for (const element of gsap.utils.toArray<HTMLElement>("[data-reveal]")) {
    gsap.from(element, {
      ...from,
      scrollTrigger: { trigger: element, start: "top 88%", once: true }
    })
  }
  for (const group of gsap.utils.toArray<HTMLElement>("[data-reveal-stagger]")) {
    gsap.from(group.children, {
      ...from,
      stagger: 0.08,
      scrollTrigger: { trigger: group, start: "top 85%", once: true }
    })
  }
}

/**
 * Builds every timeline inside `gsap.matchMedia`, so reduced motion keeps the final state with no scrubs or 3D.
 * Returns a cleanup that reverts all of it.
 */
export function startMotion() {
  // `?static` in development renders the final state, for screenshots in panes that don't draw frames.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("static")) {
    document.documentElement.classList.add("motion-ready")
    return () => document.documentElement.classList.remove("motion-ready")
  }
  const media = gsap.matchMedia()
  media.add(MOTION, () => {
    heroIntro()
    reveals()
    domainRows()
    toolSlides()
    ctaCharge()
    return paletteTyping()
  })
  media.add(CAROUSEL_MOTION, () => examplesCarousel())
  media.add(WIDE_MOTION, () => {
    workbenchTilt()
    scaffolderSpine()
  })
  media.add(STAGE_MOTION, () => architectureScene())
  document.documentElement.classList.add("motion-ready")
  return () => {
    media.revert()
    document.documentElement.classList.remove("motion-ready")
  }
}
