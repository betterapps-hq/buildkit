import { gsap } from "gsap"

/**
 * Pins the examples while the page scrolls through them. Each one slides off past the edge of the screen as the next
 * slides in, the scroll settles on whole examples, and the section's tabs follow along. A tab asks for its example
 * with an `examples:go` event, which this answers by scrolling there.
 */
export function examplesCarousel() {
  const section = document.querySelector<HTMLElement>(".examples")
  const stage = section?.querySelector<HTMLElement>(".examples-stage")
  const slides = gsap.utils.toArray<HTMLElement>(".examples .ex-card")
  if (!section || !stage || slides.length < 2) {
    return undefined
  }
  const ids = slides.map((slide) => slide.dataset.example ?? "")
  let shown = 0

  // Far enough for a slide centered in the page to clear the edge of the screen
  const travel = () => (window.innerWidth + stage.offsetWidth) / 2 + 40

  function show(index: number) {
    if (index !== shown) {
      shown = index
      section?.dispatchEvent(new CustomEvent("examples:show", { detail: ids[index] }))
    }
  }

  section.classList.add("is-carousel")
  gsap.set(slides[0], { x: 0, autoAlpha: 1 })
  const timeline = gsap.timeline({
    defaults: { duration: 1, ease: "power2.inOut" },
    onUpdate: () => show(Math.round(timeline.time())),
    scrollTrigger: {
      trigger: stage,
      start: () => (stage.offsetHeight > window.innerHeight - 32 ? "top 16px" : "center center"),
      end: () => `+=${(slides.length - 1) * window.innerHeight * 0.75}`,
      pin: true,
      // The stage sits in a flex column, where ScrollTrigger leaves out the spacing by default
      pinSpacing: true,
      // Measured after the architecture story's pin above it, which moves where this one starts
      refreshPriority: -1,
      scrub: 0.6,
      snap: { snapTo: "labels", duration: { min: 0.2, max: 0.6 }, delay: 0.05, ease: "power2.inOut" },
      invalidateOnRefresh: true
    }
  })
  timeline.addLabel(ids[0], 0)
  slides.slice(1).forEach((slide, index) => {
    timeline
      .to(slides[index], { x: () => -travel(), scale: 0.94, autoAlpha: 0 }, index)
      .fromTo(slide, { x: () => travel(), scale: 0.94, autoAlpha: 0 }, { x: 0, scale: 1, autoAlpha: 1 }, index)
      .addLabel(ids[index + 1])
  })

  function go(event: Event) {
    const index = ids.indexOf((event as CustomEvent<string>).detail)
    const trigger = timeline.scrollTrigger
    if (index < 0 || !trigger) {
      return
    }
    event.preventDefault()
    const top = trigger.start + ((trigger.end - trigger.start) * index) / (ids.length - 1)
    window.scrollTo({ top, behavior: "smooth" })
  }
  section.addEventListener("examples:go", go)

  return () => {
    section.removeEventListener("examples:go", go)
    section.classList.remove("is-carousel")
  }
}
