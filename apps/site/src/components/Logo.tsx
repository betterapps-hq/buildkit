const LAYERS = [
  {
    d: "M16.45 32.78Q12 30.5 16.45 28.22L45.55 13.28Q50 11 54.45 13.28L83.55 28.22Q88 30.5 83.55 32.78L54.45 47.72Q50 50 45.55 47.72Z",
    fill: "#3370FF"
  },
  {
    d: "M16.45 53.78Q12 51.5 16.45 49.22L25.63 44.5Q27.59 43.5 29.55 44.5L47.33 53.63Q50 55 52.67 53.63L70.45 44.5Q72.41 43.5 74.37 44.5L83.55 49.22Q88 51.5 83.55 53.78L54.45 68.72Q50 71 45.55 68.72Z",
    fill: "#8FB4FF"
  },
  {
    d: "M16.45 74.78Q12 72.5 16.45 70.22L25.63 65.5Q27.59 64.5 29.55 65.5L47.33 74.63Q50 76 52.67 74.63L70.45 65.5Q72.41 64.5 74.37 65.5L83.55 70.22Q88 72.5 83.55 74.78L54.45 89.72Q50 92 45.55 89.72Z",
    fill: "#DCE6FF"
  }
]

/** The Stack mark: vanilla core, framework and libraries as three floating layers. */
export function StackMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      {LAYERS.map((layer) => (
        <path key={layer.fill} d={layer.d} fill={layer.fill} />
      ))}
    </svg>
  )
}

/** The mark with the buildkit.gg wordmark. */
export function Logo() {
  return (
    <span className="logo">
      <StackMark className="logo-mark" />
      <span className="logo-word">
        buildkit<span className="logo-tld">.gg</span>
      </span>
    </span>
  )
}
