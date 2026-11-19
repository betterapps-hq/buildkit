import { connectPreferencesStorage } from "@buildkitgg/preferences-core/browser"
import {
  createThemeStore,
  type ColorScheme,
  type DefaultThemes,
  type ThemeDefinitions,
  type ThemeName,
  type ThemeOptions,
  type ThemeStore
} from "./index.js"
import { hasSavedTheme, themeInternals } from "./internal.js"

export type ThemeStorageOptions =
  | { storageKey?: undefined; storage?: never }
  | { storageKey: string; storage?: "localStorage" | "sessionStorage" }

/** The element that carries the theme. Put the init script inside `<body>` when you target it. */
export type ThemeElementTarget = "html" | "body"

/** The classes each theme puts on the element. One theme may have none, and it's the theme when no others match. */
export type ThemeClasses<T extends ThemeDefinitions = DefaultThemes> = {
  readonly [K in ThemeName<T>]: readonly string[]
}

/** True when `T` declares exactly the default `light` and `dark` themes. */
type HasOnlyDefaultThemes<T extends ThemeDefinitions> = [ThemeName<T>] extends ["light" | "dark"]
  ? ["light" | "dark"] extends [ThemeName<T>]
    ? true
    : false
  : false

/**
 * How the theme is marked on the element: classes, an attribute whose value is the theme name, or both. With only the
 * default themes, leaving both out means `.dark` for dark and no class for light.
 */
export type ThemeElementMarkers<T extends ThemeDefinitions = DefaultThemes> =
  HasOnlyDefaultThemes<T> extends true
    ? { classes?: ThemeClasses<T>; attribute?: string }
    : { classes: ThemeClasses<T>; attribute?: string } | { classes?: ThemeClasses<T>; attribute: string }

export type ThemeElementOptions<T extends ThemeDefinitions = DefaultThemes> = ThemeElementMarkers<T> & {
  /** Defaults to `"html"`. */
  target?: ThemeElementTarget
  /** Sets the element's `color-scheme` to the theme's scheme. Defaults to true. */
  colorScheme?: boolean
  /** Follows changes other code makes to the element. Defaults to true. */
  read?: boolean
  /** Marks the element with the current theme. Defaults to true. */
  write?: boolean
}

export type BrowserThemeOptions<T extends ThemeDefinitions = DefaultThemes> = {
  window?: Window
  /** Binds the theme to an element in both directions. Leave it out to leave the document alone. */
  element?: ThemeElementOptions<T>
} & ThemeStorageOptions

/** The script exists to mark the element, so declared themes need `element` to say how. */
export type ThemeInitScriptOptions<T extends ThemeDefinitions = DefaultThemes> = Omit<ThemeOptions<T>, "systemTheme"> &
  ThemeStorageOptions &
  (HasOnlyDefaultThemes<T> extends true ? { element?: ThemeElementOptions<T> } : { element: ThemeElementOptions<T> })

const noop = () => {
  /* Nothing to disconnect. */
}

function getBrowser(window_: Window | undefined) {
  return window_ ?? (typeof window === "undefined" ? undefined : window)
}

function getInternals(store: { getSnapshot: object }) {
  const internals = themeInternals.get(store.getSnapshot)

  if (!internals) {
    throw new TypeError("Expected a store created by createThemeStore or a Buildkit theme adapter")
  }

  return internals
}

function validateStorage(options: ThemeStorageOptions) {
  if (options.storageKey !== undefined && !options.storageKey.length) {
    throw new TypeError("Storage requires a nonempty key")
  }

  if (options.storage !== undefined && options.storageKey === undefined) {
    throw new TypeError("Storage requires a key")
  }

  if (options.storage !== undefined && options.storage !== "localStorage" && options.storage !== "sessionStorage") {
    throw new TypeError("Unknown storage mechanism")
  }
}

type Markers = { classes: Map<string, readonly string[]> | undefined; attribute: string | undefined }

/** Element options with the theme names erased, for checks that run on any store. */
type LooseElementOptions = {
  classes?: Readonly<Record<string, readonly string[]>>
  attribute?: string
  target?: string
  colorScheme?: boolean
}

/** Validates how themes are marked, since JavaScript callers skip the types, and fills in the default `.dark` class. */
function readMarkers(schemes: ReadonlyMap<string, ColorScheme>, options: LooseElementOptions) {
  const { classes, attribute } = options

  if (options.target !== undefined && options.target !== "html" && options.target !== "body") {
    throw new TypeError("The theme element must be html or body")
  }

  if (attribute !== undefined && (!attribute.length || attribute === "class" || attribute === "style")) {
    throw new TypeError("Invalid theme attribute")
  }

  const hasOnlyDefaults = schemes.size === 2 && schemes.get("light") === "light" && schemes.get("dark") === "dark"

  if (classes === undefined && attribute === undefined) {
    if (!hasOnlyDefaults) {
      throw new TypeError("Declared themes need classes or an attribute to mark the element")
    }

    const classes_ = new Map<string, readonly string[]>([
      ["light", []],
      ["dark", ["dark"]]
    ])

    return { classes: classes_, attribute } satisfies Markers
  }

  if (classes === undefined) {
    return { classes: undefined, attribute } satisfies Markers
  }

  const sets = new Map<string, string>()

  for (const name of Object.keys(classes)) {
    if (!schemes.has(name)) {
      throw new TypeError(`Classes for an undeclared theme: ${name}`)
    }
  }

  for (const name of schemes.keys()) {
    const tokens = classes[name]

    if (!Array.isArray(tokens) || tokens.some((token) => !token.length || /\s/.test(token))) {
      throw new TypeError(`Theme ${name} needs a list of class names`)
    }

    const set = [...new Set(tokens)].sort().join(" ")
    const other = sets.get(set)

    if (other !== undefined) {
      throw new TypeError(`Themes ${other} and ${name} have the same classes`)
    }

    sets.set(set, name)
  }

  return { classes: new Map(Object.entries(classes)), attribute } satisfies Markers
}

/**
 * Binds a store to an element in both directions. Theme changes mark the element, and changes other code makes to the
 * element change the theme, so CSS-first code and components that read the store stay in step.
 */
export function connectThemeElement<T extends ThemeDefinitions>(
  store: ThemeStore<T>,
  options: ThemeElementOptions<T> & { window?: Window }
): () => void {
  const { preferences, schemes } = getInternals(store)
  // SAFETY: erasing the theme names only widens the types; readMarkers checks every name against the store's themes.
  const { classes, attribute } = readMarkers(schemes, options as LooseElementOptions)
  const browser = getBrowser(options.window)

  if (!browser) {
    return noop
  }

  const element = options.target === "body" ? browser.document.body : browser.document.documentElement

  if (!element) {
    throw new TypeError("The page has no body yet. Connect after it loads, or target html.")
  }

  const tokens = classes ? [...new Set([...classes.values()].flat())] : []
  const shouldRead = options.read ?? true
  const shouldWrite = options.write ?? true
  const shouldSetScheme = options.colorScheme ?? true

  const original = {
    tokens: tokens.filter((token) => element.classList.contains(token)),
    attribute: attribute === undefined ? null : element.getAttribute(attribute),
    colorScheme: element.style.colorScheme
  }

  /** The theme whose classes are all present, preferring the most matches. Returns its class count too. */
  function readClasses() {
    let found: { name: string; size: number } | undefined
    let isTied = false

    for (const [name, list] of classes ?? []) {
      if (!list.every((token) => element!.classList.contains(token))) {
        continue
      }

      if (!found || list.length > found.size) {
        found = { name, size: list.length }
        isTied = false
      } else if (list.length === found.size) {
        isTied = true
      }
    }

    return isTied ? undefined : found
  }

  function readAttribute() {
    const value = attribute === undefined ? null : element!.getAttribute(attribute)

    return value !== null && schemes.has(value) ? value : undefined
  }

  /** Moves the store to a theme found on the element, unless the store already shows it. */
  function adopt(theme: string | undefined) {
    const snapshot = store.getSnapshot()

    if (theme === undefined || theme === snapshot.resolvedTheme) {
      return
    }

    // Other code that follows the device may react to a change before this store does. Its theme is then what
    // "system" is about to resolve to, not a choice of its own.
    const device = browser!.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"

    if (snapshot.theme === "system" && theme === snapshot.systemThemes[device]) {
      return
    }

    // SAFETY: readClasses and readAttribute only return names from the store's declared themes.
    store.setTheme(theme as ThemeName<T>)
  }

  function apply() {
    const { resolvedTheme, colorScheme } = store.getSnapshot()

    if (classes) {
      const wanted = new Set(classes.get(resolvedTheme))
      element!.classList.remove(...tokens.filter((token) => !wanted.has(token)))
      element!.classList.add(...wanted)
    }

    if (attribute !== undefined) {
      element!.setAttribute(attribute, resolvedTheme)
    }

    if (shouldSetScheme) {
      element!.style.colorScheme = colorScheme
    }
  }

  if (shouldRead && !hasSavedTheme(preferences)) {
    // On the first visit, keep what the page already shows, such as a theme another system's script applied. A theme
    // with no classes isn't adopted here, since a bare element only means nothing has marked it yet.
    const found = readClasses()
    adopt(readAttribute() ?? (found && found.size > 0 ? found.name : undefined))
  }

  const unsubscribe = shouldWrite ? store.subscribe(apply) : noop
  let observer: MutationObserver | undefined

  if (shouldWrite) {
    apply()
  }

  if (shouldRead) {
    const watched = [...(classes ? ["class"] : []), ...(attribute === undefined ? [] : [attribute])]
    // SAFETY: a Window is its own global object, so it has the global constructors. The binding may run against
    // another window, so it uses that window's MutationObserver.
    const Observer = (browser as Window & typeof globalThis).MutationObserver

    const watcher = new Observer((records) => {
      const changed = new Set(records.map((record) => record.attributeName))
      const { resolvedTheme } = store.getSnapshot()

      // A batch can hold this binding's own writes next to another script's change, so follow whichever changed
      // marker disagrees with the store. The attribute names a theme outright, so it wins a disagreement.
      const found = [
        attribute !== undefined && changed.has(attribute) ? readAttribute() : undefined,
        classes && changed.has("class") ? readClasses()?.name : undefined
      ].find((theme) => theme !== undefined && theme !== resolvedTheme)

      adopt(found)
    })

    watcher.observe(element, { attributes: true, attributeFilter: watched })
    observer = watcher
  }

  return () => {
    observer?.disconnect()
    unsubscribe()

    if (!shouldWrite) {
      return
    }

    element.classList.remove(...tokens)
    element.classList.add(...original.tokens)

    if (attribute !== undefined) {
      if (original.attribute === null) {
        element.removeAttribute(attribute)
      } else {
        element.setAttribute(attribute, original.attribute)
      }
    }

    if (shouldSetScheme) {
      element.style.colorScheme = original.colorScheme
    }
  }
}

/** Connect once per store. Omit storageKey for memory-only preferences, and element to leave the document alone. */
export function connectBrowserTheme<T extends ThemeDefinitions>(
  store: ThemeStore<T>,
  options: BrowserThemeOptions<T> = {}
): () => void {
  validateStorage(options)
  const browser = getBrowser(options.window)

  if (!browser) {
    return noop
  }

  const { preferences } = getInternals(store)

  const disconnectStorage =
    options.storageKey === undefined
      ? noop
      : connectPreferencesStorage(preferences, {
          storage: options.storage ?? "localStorage",
          key: options.storageKey,
          window: browser
        })

  const media = browser.matchMedia("(prefers-color-scheme: dark)")

  function syncSystem() {
    store.setSystemTheme(media.matches ? "dark" : "light")
  }

  syncSystem()
  media.addEventListener("change", syncSystem)

  // Connected last, so the saved choice and the device setting are known before the element is read or marked
  const disconnectElement = options.element
    ? // SAFETY: adding window to the caller's element options keeps them ThemeElementOptions<T>.
      connectThemeElement(store, { ...options.element, window: browser } as ThemeElementOptions<T> & { window: Window })
    : noop

  return () => {
    disconnectElement()
    disconnectStorage()
    media.removeEventListener("change", syncSystem)
  }
}

/**
 * Returns a script that marks the element with the saved theme before first paint, matching what `element` does once
 * the app starts. Put it in `<head>` for html, or at the start of `<body>` for body, and pass your CSP nonce on the tag.
 */
export function getThemeInitScript<const T extends ThemeDefinitions = DefaultThemes>(
  options?: ThemeInitScriptOptions<T>
) {
  const { element: elementOption, storageKey, storage, ...themeOptions } = options ?? {}
  // SAFETY: erasing the theme names only widens the types; readMarkers checks every name against the themes.
  const element = (elementOption ?? {}) as LooseElementOptions
  // SAFETY: these are the caller's storage options, split out of the rest; validateStorage checks them.
  validateStorage({ storageKey, storage } as ThemeStorageOptions)
  // SAFETY: the rest of the options are the store's own, and creating the store validates the themes, the default
  // and the system pair the same way the app's store does.
  const store = createThemeStore(themeOptions as ThemeOptions<ThemeDefinitions>)
  const { schemes } = getInternals(store)
  const { classes, attribute } = readMarkers(schemes, element)
  const { theme: defaultTheme, systemThemes } = store.getServerSnapshot()

  const config = JSON.stringify({
    defaultTheme,
    light: systemThemes.light,
    dark: systemThemes.dark,
    schemes: Object.fromEntries(schemes),
    storageKey,
    storage: storage ?? "localStorage",
    target: element.target ?? "html",
    classes: classes ? Object.fromEntries(classes) : null,
    attribute: attribute ?? null,
    colorScheme: element.colorScheme ?? true
  }).replaceAll("<", "\\u003c")

  return `(()=>{const c=${config},h=(n,s)=>Object.prototype.hasOwnProperty.call(c.schemes,n)&&(!s||c.schemes[n]===s);let t=c.defaultTheme,l=c.light,d=c.dark;try{if(c.storageKey!==undefined){const p=JSON.parse(window[c.storage].getItem(c.storageKey)||'{}');if(p.theme==='system'||h(p.theme))t=p.theme;if(h(p.systemLight,'light'))l=p.systemLight;if(h(p.systemDark,'dark'))d=p.systemDark}}catch{}const r=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?d:l):t,e=c.target==='body'?document.body:document.documentElement;if(!e)return;if(c.classes){for(const n in c.classes)e.classList.remove(...c.classes[n]);e.classList.add(...c.classes[r])}if(c.attribute)e.setAttribute(c.attribute,r);if(c.colorScheme)e.style.colorScheme=c.schemes[r]})()`
}
