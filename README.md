# Permission Tree Management

An Angular 22 implementation of a recursive, unlimited-depth permission tree with cascading checkbox selection, indeterminate state, structure-preserving search, and a mocked RxJS-driven search pipeline.

## Stack

- **Angular 22** — standalone components, Signals (`input()` / `output()` / `computed`), no `NgModules`
- **RxJS** — search debouncing, cancellation, and async state derivation
- **TypeScript** — strict, immutable (`readonly`) domain models

No third-party tree/search library is used — all selection and search logic is hand-written, per the task constraints.

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
├── state/            # Application state
│   └── permissions.store.ts
│
├── ui/               # Dumb/presentational components
│   ├── permission-tree.*
│   └── permission-tree-node.*
│
└── permissions-page.* # Smart component: wires state + gateway + UI together
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

## State (`permissions.store.ts`)

A minimal, hand-rolled **Signal Store**:

```ts
private readonly _tree = signal(normalizePermissionTree(MOCK_PERMISSIONS));
readonly tree = this._tree.asReadonly();
readonly selectedIds = computed(() => getSelectedPermissionIds(this._tree()));
```

- Single private writable signal as the source of truth; everything else (`tree`, `selectedIds`) is exposed read-only or derived.
- `updateSelection()` is the only mutation entry point, and it always goes through the pure `updatePermissionSelection` domain function — the store never contains selection/indeterminate logic itself.

> **Planned migration:** this store is intentionally simple for now and will be migrated to **`@ngrx/signals` (`signalStore`)** once the pattern is settled across the app. The domain functions were kept pure and store-agnostic specifically so that move is a drop-in change — only `permissions.store.ts` will need rewriting to `withState` / `withComputed` / `withMethods`; nothing in `domain/`, `ui/`, or `data-access/` should need to change.

## Search & RxJS (`permissions-page.ts`)

The search input is a signal, converted to an observable only to run through the async pipeline, then converted back to a signal for the template:

```
searchTerm (signal)
  → toObservable
  → debounceTime(300)       // no request per keystroke
  → distinctUntilChanged()  // no repeat request for the same term
  → switchMap(term => gateway.search(term))
      → startWith(loading state)
      → catchError(error state)
  → toSignal
```

- **`debounceTime(300)`** — waits for the user to pause typing before firing a request.
- **`distinctUntilChanged()`** — after trimming, an unchanged term (e.g. retyping the same value, or a debounce firing on a value seen before) never triggers a duplicate call.
- **`switchMap`** — the core cancellation mechanism: a new keystroke's request automatically unsubscribes any in-flight previous request, so only the latest search's response can ever update state; stale responses are discarded rather than racing.
- **`startWith` / `catchError`** inside the inner pipe (not the outer one) ensure a failed or loading search doesn't kill the outer subscription — the search box keeps working after an error.
- `isSearching` and `visibleTree` are `computed()` guards that check `searchState().term` against the *current* `searchTerm()`, so a slow response for an old term is never rendered even for the instant before the next debounce fires.

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
