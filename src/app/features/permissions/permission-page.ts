import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';

import { PermissionSelectionChange } from './domain/permission.model';
import { filterPermissionTreeByIds } from './domain/permissions-tree.utils';
import { PERMISSION_SEARCH_GATEWAY } from './data-access/permission-search.gateway';
import { PermissionsStore } from './state/permissions.store';
import { PermissionTree } from './ui/permission-tree/permission-tree';

interface SearchState {
  readonly term: string;
  readonly status: 'idle' | 'loading' | 'success' | 'error';
  readonly matchedIds: ReadonlySet<number> | null;
  readonly error: string | null;
}

@Component({
  selector: 'app-permissions-page',
  imports: [PermissionTree],
  providers: [PermissionsStore],
  templateUrl: './permission-page.html',
  styleUrl: './permission-page.css',
})
export class PermissionsPage {
  protected readonly store = inject(PermissionsStore);
  private readonly searchGateway = inject(PERMISSION_SEARCH_GATEWAY);

  protected readonly searchTerm = signal('');
  private readonly searchTerm$ = toObservable(this.searchTerm);
  protected readonly searchState = toSignal(
    this.searchTerm$.pipe(
      map((term) => term.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term) => {
        if (!term) {
          return of<SearchState>({
            term: '',
            status: 'idle',
            matchedIds: null,
            error: null,
          });
        }

        return this.searchGateway.search(term).pipe(
          map((ids): SearchState => ({
            term,
            status: 'success',
            matchedIds: new Set(ids),
            error: null,
          })),

          startWith<SearchState>({
            term,
            status: 'loading',
            matchedIds: null,
            error: null,
          }),

          catchError(() =>
            of<SearchState>({
              term,
              status: 'error',
              matchedIds: new Set<number>(),
              error: 'Search failed.',
            }),
          ),
        );
      }),
    ),

    {
      initialValue: {
        term: '',
        status: 'idle',
        matchedIds: null,
        error: null,
      } satisfies SearchState,
    },
  );

  protected readonly isSearching = computed(() => {
    const currentTerm = this.searchTerm().trim();
    if (!currentTerm) {
      return false;
    }
    const searchState = this.searchState();
    return searchState.term !== currentTerm || searchState.status === 'loading';
  });

  protected readonly visibleTree = computed(() => {
    const currentTerm = this.searchTerm().trim();

    if (!currentTerm) {
      return this.store.tree();
    }

    const state = this.searchState();

    if (state.term !== currentTerm || state.status === 'loading') {
      return [];
    }
    if (!state.matchedIds) {
      return [];
    }

    return filterPermissionTreeByIds(this.store.tree(), state.matchedIds);
  });

  protected readonly selectedIdsText = computed(() => {
    const ids = this.store.selectedIds();
    return ids.length > 0 ? ids.join(', ') : 'None';
  });

  protected onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  protected onSelectionChange(change: PermissionSelectionChange): void {
    this.store.updateSelection(change);
  }
}
