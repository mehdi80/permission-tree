import { computed, Injectable, signal } from '@angular/core';
import { PermissionSelectionChange } from '../domain/permission.model';
import {
  getSelectedPermissionIds,
  normalizePermissionTree,
  updatePermissionSelection,
} from '../domain/permissions-tree.utils';

import { MOCK_PERMISSIONS } from '../data-access/permission.mock';

@Injectable()
export class PermissionsStore {
  private readonly _tree = signal(normalizePermissionTree(MOCK_PERMISSIONS));

  readonly tree = this._tree.asReadonly();

  readonly selectedIds = computed(() => getSelectedPermissionIds(this._tree()));

  updateSelection(change: PermissionSelectionChange): void {
    this._tree.update((tree) => updatePermissionSelection(tree, change.id, change.selected));
  }
}
