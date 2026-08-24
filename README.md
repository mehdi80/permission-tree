# Permission Tree Management

An Angular 21 implementation of a recursive, unlimited-depth permission tree with cascading checkbox selection, indeterminate state, structure-preserving search, and a mocked RxJS-driven search pipeline.

## Stack

- **Angular 21** — standalone components, Signals (`input()` / `output()` / `computed`), no `NgModules`
- **RxJS** — search debouncing, cancellation, and async state derivation
- **TypeScript** — strict, immutable (`readonly`) domain models

No third-party tree/search library is used — all selection and search logic is hand-written.

## Project Structure

The `permissions` feature is organized by responsibility rather than by component, so each layer can be tested and reasoned about in isolation:

```
features/permissions/
├── domain/           # Pure, framework-agnostic logic (no Angular imports)
│   ├── permission.model.ts
│   └── permission-tree.utils.ts
│
├── data-access/       # External I/O boundary
│   ├── permission-search.gateway.ts        # Port (interface + InjectionToken)
│   └── mock-permission-search.gateway.ts   # Adapter (mock implementation)
│   └── permission.mock.ts
│
├── state/            # Application state and its domain state contract
│   ├── permission-state.model.ts
│   └── permissions.store.ts
│
├── ui/               # Dumb/presentational components
│   ├── permission-tree.*
│   └── permission-tree-node.*
│
└── permission-page.* # Smart component: wires state + gateway + UI together
```

**Why this split:**
- `domain/` has zero Angular dependencies. It's plain TypeScript functions operating on plain data, so the selection/search/indeterminate logic can be unit-tested without TestBed and reused outside Angular if needed.
- `data-access/` follows a **port/adapter** pattern: `PermissionSearchGateway` is an interface + `InjectionToken`, and `MockPermissionSearchGateway` is one possible implementation, swapped in via `app.config.ts` (`useExisting`). Replacing the mock with a real HTTP client later means adding one adapter class — no consumer code changes.
- `ui/` components only receive data and emit events; they hold no business logic.

## Domain Logic (`permission-tree.utils.ts`)

All tree operations are **immutable** — every function returns new arrays/objects instead of mutating the input. This keeps the Signal Store's change detection correct (referential equality) and makes search filtering safe to run against the live tree without corrupting it.

| Function | Responsibility |
|---|---|
| `normalizePermissionTree` | Converts raw DTOs into `PermissionNode`s, computing initial `selected` / `indeterminate` state bottom-up (so a parent already start out correctly derived from its children, and a `selected: true` DTO cascades selection down to all descendants). |
| `updatePermissionSelection` | Toggles one node by id, cascades the new value to its entire subtree, then recalculates `selected`/`indeterminate` up the ancestor chain. Depth-agnostic — no hardcoded levels. |
| `recalculateNodeState` | Derives a parent's own state from its direct children: all selected → selected; some selected/indeterminate → indeterminate; none → unselected. |
| `getSelectedPermissionIds` | UI-independent extraction of every selected id. Implemented with an explicit stack (not recursion) so it stays safe on very deep or very wide trees. |
| `findMatchingPermissionIds` | Case-insensitive title search, also stack-based for the same reason. |
| `filterPermissionTreeByIds` | Rebuilds a tree containing only matched nodes **and their ancestor chain**, so parents of a match remain visible and the tree shape is preserved. Never mutates the source tree — it's used directly against the live signal tree during search. |

Naming follows a verb-first convention for anything that performs an action or computation (`normalize…`, `update…`, `get…`, `find…`, `filter…`, `recalculate…`), which keeps intent obvious at call sites without needing to read the implementation.

## State (`permission-state.model.ts`, `permissions.store.ts`)

The feature uses **`@ngrx/signals`** for its Signal Store. `PermissionState` defines the store state shape, while `permissionsStore` composes that state with computed values and methods:

```ts
export const permissionsStore = signalStore(
  withState(InitialState),
  withComputed(({ tree, searchTerm, searchStatus, matchedIds }) => ({
    selectedIds: computed(() => getSelectedPermissionIds(tree())),
    isSearching: computed(() => searchTerm().trim().length > 0 && searchStatus() === 'loading'),
    visibleTree: computed(() => ...),
    selectedIdsText: computed(() => ...)
  })),
  withMethods((store, gateway = inject(PERMISSION_SEARCH_GATEWAY)) => ({
    updateSelection(change) { ... },
    search: rxMethod<string>(...)
  }))
);
```

- `withState(InitialState)` stores the normalized permission tree, search term, search status, matched ids, and possible error.
- `withComputed` exposes `selectedIds`, `isSearching`, `visibleTree`, and `selectedIdsText` as derived Signals. Search results are projected from the original tree, so filtering does not mutate selection state.
- `withMethods` exposes `updateSelection()` and the RxJS-backed `search()` method. Selection updates still delegate to the pure `updatePermissionSelection` domain function.
- `permissionsStore` is provided by `PermissionsPage`, which gives each page instance its own store scope and injects the configured `PERMISSION_SEARCH_GATEWAY`.

The store is already implemented with `@ngrx/signals`; there is no future migration remaining for this feature. The separate state model keeps the state contract explicit while the domain functions remain framework-agnostic.

## Search & RxJS (`permissions.store.ts`, `permission-page.ts`)

The page forwards each input value to the store's `search()` method. `rxMethod` owns the RxJS pipeline inside the Signal Store:

```
onSearchInput(event)
  → store.search(input.value)
  → rxMethod<string>
      → trim
      → debounceTime(300)
      → distinctUntilChanged()
      → update search state to loading
      → switchMap(term => gateway.search(term))
          → tapResponse(next/error)
      → update success/error state
```

- **`debounceTime(300)`** — waits for the user to pause typing before firing a request.
- **`distinctUntilChanged()`** — after trimming, an unchanged term (e.g. retyping the same value, or a debounce firing on a value seen before) never triggers a duplicate call.
- **`switchMap`** — the core cancellation mechanism: a new keystroke's request automatically unsubscribes any in-flight previous request, so only the latest search's response can ever update state; stale responses are discarded rather than racing.
- **`tapResponse`** handles successful and failed gateway responses and writes the result into the store without terminating the `rxMethod` pipeline, so the search box keeps working after an error.
- **`switchMap`** ensures that a newer search cancels the previous request; only the latest response updates `matchedIds`.
- `isSearching` and `visibleTree` are computed store properties driven by `searchTerm`, `searchStatus`, and `matchedIds`.

The mock gateway (`MockPermissionSearchGateway`) simulates network latency with `delay(500)` so the loading/cancellation behavior is actually observable during manual testing.

## UI Components

- `PermissionTree` / `PermissionTreeNode` are presentational only: `input.required()` in, `output()` events out, no injected services.
- `PermissionTreeNode` renders itself recursively for children (self-referencing standalone component), which is what allows the UI to support unlimited tree depth without any hardcoded nesting.
- Checkbox `[indeterminate]` is bound directly to the domain-computed `node().indeterminate` flag — the browser's native indeterminate visual state, not a custom-styled substitute.
- `@for (... track node.id)` is used everywhere lists are rendered, so re-renders after a selection/search update only touch the nodes that actually changed identity.

## Running the project

```bash
npm install
ng serve      # dev server, default http://localhost:4200
ng build      # production build
```

No real backend is required — the search gateway is fully mocked and provided via DI in `app.config.ts`.

## Notes on Edge Cases Handled

- Selecting/deselecting a node cascades correctly regardless of subtree depth or shape.
- A tree that arrives with some children pre-selected is normalized into the correct parent `selected`/`indeterminate` state on load, not just after user interaction.
- Searching never mutates the underlying tree signal — filtering is a pure projection, so clearing the search box always restores the exact original tree and selection state.
- An empty/whitespace-only search term short-circuits back to the full tree without calling the gateway.

## Performance — 50,000-Node Trees (Optional Section)

Not implemented in this submission, but worth calling out for a production-scale tree:

- **Problem:** rendering ~50k DOM nodes at once (even with `@for`/track) causes long initial render and layout/reflow cost, and every selection change currently rebuilds the path from the toggled node to the root — cheap per operation, but repeated re-renders of a fully expanded tree are the real cost.
- **Mitigations to consider:**
  - **Virtual scrolling** (`@angular/cdk/scrolling`) so only visible rows are mounted.
  - **Flattening the tree into a visible-rows array** (id, depth, collapsed/expanded, node ref) computed alongside the nested tree, so the CDK virtual scroll viewport can iterate a flat list instead of recursively rendered nested `<ul>`s.
  - **Collapsed-by-default nodes** beyond a shallow depth, so most of the tree never mounts until expanded.
  - **`OnPush`/Signal-driven change detection** (already implicit here via signals) so only components whose inputs actually changed reference re-render.
  - For search over 50k nodes, moving `findMatchingPermissionIds` off the main thread (e.g. a Web Worker) if it becomes a measurable jank source, though for title-only substring search this is unlikely to be the bottleneck compared to rendering.
