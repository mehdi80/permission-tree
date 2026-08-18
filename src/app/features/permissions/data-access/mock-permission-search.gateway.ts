import { delay, Observable, of } from 'rxjs';
import { PermissionSearchGateway } from './permission-search.gateway';
import { MOCK_PERMISSIONS } from './permission.mock';

import {
  findMatchingPermissionIds,
  normalizePermissionTree,
} from '../domain/permissions-tree.utils';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MockPermissionSearchGateway implements PermissionSearchGateway {
  private readonly tree = normalizePermissionTree(MOCK_PERMISSIONS);

  search(term: string): Observable<readonly number[]> {
    const matchingIds = findMatchingPermissionIds(this.tree, term);

    return of(matchingIds).pipe(delay(500));
  }
}
