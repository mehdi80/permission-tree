import { Component, inject, signal } from '@angular/core';

import { PermissionSelectionChange } from './domain/permission.model';
import { PermissionTree } from './ui/permission-tree/permission-tree';
import { permissionsStore } from './state/permissions.store';


@Component({
  selector: 'app-permissions-page',
  imports: [PermissionTree],
  providers: [permissionsStore],
  templateUrl: './permission-page.html',
  styleUrl: './permission-page.css',
})
export class PermissionsPage {
  protected readonly store = inject(permissionsStore);
  protected readonly searchTerm = signal('');

  
 protected onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
    this.store.search(input.value);
  }

  protected onSelectionChange(change: PermissionSelectionChange): void {
    this.store.updateSelection(change);
  }
}
