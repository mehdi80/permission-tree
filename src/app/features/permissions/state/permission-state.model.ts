import { PermissionNode } from "../domain/permission.model";

export interface PermissionState {
  tree: readonly PermissionNode[],
  searchTerm: string,
  searchStatus: 'idle' | 'loading' | 'success' | 'error',
  matchedIds: ReadonlySet<number> | null,
  error: string | null
}