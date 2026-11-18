# Routing

Connect tabs and panels to the URL using your app’s router. The selected tab and open panel follow navigation, including
direct links and the browser’s Back and Forward buttons. Your application supplies the UI components.

## Choose your integration

Start with the integration for the router your app already uses. Both export `createRouterAdapter` along with the shared
`useRouteTabs` and `useRoutePanel` hooks, so you import everything from one package, and both give tabs and panels the
same behavior. Route definitions follow each router’s own conventions.

| Your app uses             | Package guide                                 | Route targets                                                           |
| ------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| React Router data routers | [React Router](/packages/react-router/)       | Concrete paths and React Router match patterns                          |
| TanStack Router           | [TanStack Router](/packages/tanstack-router/) | Typed destinations, parameters, and search options from your route tree |

Create one adapter for your router, define route targets, then bind the hooks to your tabs or panels.

React Router support needs a data router from `createBrowserRouter` or `createMemoryRouter`. A declarative
`BrowserRouter` doesn’t expose the subscription the adapter needs.

## Tabs and panels

Bind `activeTab` and `select` to your tab component. The first matching route selects the tab, and an optional default
changes what’s displayed without redirecting.

Bind `isOpen` and `setOpen` to your drawer or dialog. An explicit `closeTo` route gives direct links a predictable place
to go when the panel closes.

Use your router’s own link component for links. Your UI components keep responsibility for labels, keyboard interaction,
focus, and layout.

## Shared layers

Use these directly to connect another router or build an integration for another framework.

| Layer                                      | Responsibility                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| [Core](/packages/router-core/)             | Framework-independent tab selection, route matching policies, and panel navigation |
| [React bindings](/packages/react-routing/) | Subscribe to a router adapter and derive tab and panel state with React hooks      |

The React Router and TanStack Router packages connect these layers to their routers. Each package has its own guide and
generated API reference in this section.
