import { Component, input, output } from '@angular/core';
import { PermissionNode, PermissionSelectionChange } from '../../domain/permission.model';
import { PermissionTreeNode } from '../permission-tree-node/permission-tree-node';

@Component({
  selector: 'app-permission-tree',
  imports: [PermissionTreeNode],
  templateUrl: './permission-tree.html',
  styleUrl: './permission-tree.css',
})
export class PermissionTree {
  readonly nodes = input.required<readonly PermissionNode[]>();

  readonly selectionChange = output<PermissionSelectionChange>();
}
