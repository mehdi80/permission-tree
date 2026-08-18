import { InjectionToken } from '@angular/core';

import { Observable } from 'rxjs';

export interface PermissionSearchGateway {
  search(term: string): Observable<readonly number[]>;
}

export const PERMISSION_SEARCH_GATEWAY = new InjectionToken<PermissionSearchGateway>(
  'PERMISSION_SEARCH_GATEWAY',
);
