export interface PermissionNodeDto {
  readonly id: number;
  readonly title: string;
  readonly selected: boolean;
  readonly children?: readonly PermissionNodeDto[];
}

export interface PermissionNode {
  readonly id: number;
  readonly title: string;

  readonly selected: boolean;
  readonly indeterminate: boolean;

  readonly children: readonly PermissionNode[];
}

export interface PermissionSelectionChange {
  readonly id: number;
  readonly selected: boolean;
}
