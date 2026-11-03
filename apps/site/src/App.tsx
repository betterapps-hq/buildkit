import { useEffect } from "react"
import { startMotion } from "./motion"
import { Architecture } from "./sections/Architecture"
import { ClosingCta } from "./sections/ClosingCta"
import { Docs } from "./sections/Docs"
import { Examples } from "./sections/Examples"
import { Footer } from "./sections/Footer"
import { Header } from "./sections/Header"
import { Hero } from "./sections/Hero"
import { Tooling } from "./sections/Tooling"

export function App() {
  useEffect(() => startMotion(), [])

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Architecture />
        <Examples />
        <Tooling />
        <Docs />
        <ClosingCta />
      </main>
      <Footer />
    </>
  )
}
