import { PermissionNode, PermissionNodeDto } from './permission.model';

interface NodeUpdateResult {
  readonly node: PermissionNode;
  readonly changed: boolean;
}

export function normalizePermissionTree(
  tree: readonly PermissionNodeDto[],
): readonly PermissionNode[] {
  return tree.map((node) => normalizePermissionNode(node));
}

function normalizePermissionNode(
  dto: PermissionNodeDto,
  selectedByAncestor = false,
): PermissionNode {
  const forceSelected = selectedByAncestor || dto.selected;

  const children = (dto.children ?? []).map((child) =>
    normalizePermissionNode(child, forceSelected),
  );

  const node: PermissionNode = {
    id: dto.id,
    title: dto.title,
    selected: forceSelected,
    indeterminate: false,
    children,
  };

  if (forceSelected || children.length === 0) {
    return node;
  }

  return recalculateNodeState(node);
}

function recalculateNodeState(node: PermissionNode): PermissionNode {
  if (node.children.length === 0) {
    return node;
  }

  const allSelected = node.children.every((child) => child.selected && !child.indeterminate);

  const anySelected = node.children.some((child) => child.selected || child.indeterminate);

  return {
    ...node,
    selected: allSelected,
    indeterminate: !allSelected && anySelected,
  };
}

function setSubtreeSelection(node: PermissionNode, selected: boolean): PermissionNode {
  return {
    ...node,

    selected,
    indeterminate: false,

    children: node.children.map((child) => setSubtreeSelection(child, selected)),
  };
}

export function updatePermissionSelection(
  tree: readonly PermissionNode[],
  permissionId: number,
  selected: boolean,
): readonly PermissionNode[] {
  for (let index = 0; index < tree.length; index++) {
    const result = updateNode(tree[index], permissionId, selected);

    if (!result.changed) {
      continue;
    }

    return tree.map((node, currentIndex) => (currentIndex === index ? result.node : node));
  }

  return tree;
}

function updateNode(
  node: PermissionNode,
  permissionId: number,
  selected: boolean,
): NodeUpdateResult {
  if (node.id === permissionId) {
    return {
      node: setSubtreeSelection(node, selected),
      changed: true,
    };
  }

  for (let childIndex = 0; childIndex < node.children.length; childIndex++) {
    const child = node.children[childIndex];

    const childResult = updateNode(child, permissionId, selected);

    if (!childResult.changed) {
      continue;
    }

    const newChildren = node.children.map((currentChild, currentIndex) =>
      currentIndex === childIndex ? childResult.node : currentChild,
    );

    return {
      node: recalculateNodeState({
        ...node,
        children: newChildren,
      }),

      changed: true,
    };
  }

  return {
    node,
    changed: false,
  };
}

export function getSelectedPermissionIds(tree: readonly PermissionNode[]): number[] {
  const result: number[] = [];

  const stack: PermissionNode[] = [...tree].reverse();

  while (stack.length > 0) {
    const node = stack.pop();

    if (!node) {
      continue;
    }

    if (node.selected) {
      result.push(node.id);
    }

    for (let index = node.children.length - 1; index >= 0; index--) {
      stack.push(node.children[index]);
    }
  }

  return result;
}

export function findMatchingPermissionIds(
  tree: readonly PermissionNode[],
  rawTerm: string,
): readonly number[] {
  const term = normalizeSearchTerm(rawTerm);

  if (!term) {
    return [];
  }

  const result: number[] = [];

  const stack: PermissionNode[] = [...tree];

  while (stack.length > 0) {
    const node = stack.pop();

    if (!node) {
      continue;
    }

    if (normalizeSearchTerm(node.title).includes(term)) {
      result.push(node.id);
    }

    stack.push(...node.children);
  }

  return result;
}

export function filterPermissionTree(
  tree: readonly PermissionNode[],
  rawTerm: string,
): readonly PermissionNode[] {
  const term = normalizeSearchTerm(rawTerm);

  if (!term) {
    return tree;
  }

  return filterTreeByPredicate(tree, (node) => normalizeSearchTerm(node.title).includes(term));
}

export function filterPermissionTreeByIds(
  tree: readonly PermissionNode[],
  ids: ReadonlySet<number>,
): readonly PermissionNode[] {
  return filterTreeByPredicate(tree, (node) => ids.has(node.id));
}

function filterTreeByPredicate(
  tree: readonly PermissionNode[],
  predicate: (node: PermissionNode) => boolean,
): readonly PermissionNode[] {
  const result: PermissionNode[] = [];

  for (const node of tree) {
    const filteredChildren = filterTreeByPredicate(node.children, predicate);

    const matchesSelf = predicate(node);

    if (!matchesSelf && filteredChildren.length === 0) {
      continue;
    }

    result.push({
      ...node,
      children: filteredChildren,
    });
  }

  return result;
}

function normalizeSearchTerm(value: string): string {
  return value.trim().toLocaleLowerCase();
}
