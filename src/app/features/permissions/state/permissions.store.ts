import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { debounceTime, distinctUntilChanged, map, of, pipe, switchMap, tap } from 'rxjs';
import { PERMISSION_SEARCH_GATEWAY } from '../data-access/permission-search.gateway';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';

import {
  filterPermissionTreeByIds,
  getSelectedPermissionIds,
  normalizePermissionTree,
  updatePermissionSelection,
} from '../domain/permissions-tree.utils';
import { PermissionState } from './permission-state.model';
import { MOCK_PERMISSIONS } from '../data-access/permission.mock';
import { PermissionSelectionChange } from '../domain/permission.model';

const InitialState: PermissionState = {
  tree: normalizePermissionTree(MOCK_PERMISSIONS),
  searchTerm: '',
  searchStatus: 'idle',
  matchedIds: null,
  error: null
};

export const permissionsStore = signalStore(
  withState(InitialState),
  withComputed(({ tree, searchTerm, searchStatus, matchedIds }) => ({
    selectedIds: computed(() => getSelectedPermissionIds(tree())),
    isSearching: computed(() => searchTerm().trim().length > 0 && searchStatus() === 'loading'),
    visibleTree: computed(() => {
      const term = searchTerm().trim();
      if (!term) return tree();
      if (searchStatus() !== 'success' || !matchedIds()) return [];
      return filterPermissionTreeByIds(tree(), matchedIds()!);
    }),
    selectedIdsText: computed(() => {
      const ids = getSelectedPermissionIds(tree());
      return ids.length > 0 ? ids.join(', ') : 'None';
    })
  })),
  withMethods((store, getway = inject(PERMISSION_SEARCH_GATEWAY)) => ({
    updateSelection(change: PermissionSelectionChange): void {
      patchState(store, {
        tree: updatePermissionSelection(store.tree(), change.id, change.selected)
      })
    },

    search: rxMethod<string>(
      pipe(
        map((term) => term.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        tap((term) =>
          patchState(store, { searchTerm: term, searchStatus: term ? 'loading' : 'idle' }),
        ),
        switchMap((term) => {
          if (!term) return of(null);

          return getway.search(term).pipe(
            tapResponse({
              next: (ids) => patchState(store, { searchStatus: 'success', matchedIds: new Set(ids), error: null }),
              error: () => patchState(store, { searchStatus: 'error', matchedIds: new Set(), error: 'search failed' }),
            })
          )
        })
      )
    )
  })
  )
);
