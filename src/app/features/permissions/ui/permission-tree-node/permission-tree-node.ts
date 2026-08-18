import { Component, forwardRef, input, output } from '@angular/core';

import { PermissionNode, PermissionSelectionChange } from '../../domain/permission.model';

@Component({
  selector: 'app-permission-tree-node',
  imports: [forwardRef(() => PermissionTreeNode)],
  templateUrl: './permission-tree-node.html',
  styleUrl: './permission-tree-node.css',
})
export class PermissionTreeNode {
  readonly node = input.required<PermissionNode>();

  readonly selectionChange = output<PermissionSelectionChange>();

  protected onCheckboxChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;

    this.selectionChange.emit({
      id: this.node().id,
      selected: checkbox.checked,
    });
  }
}
