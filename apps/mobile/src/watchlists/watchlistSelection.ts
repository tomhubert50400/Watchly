export type WatchlistSelectionDiff = {
  addedKeys: string[];
  removedKeys: string[];
};

export function buildSelectionLabel(
  initialSelectedKeys: ReadonlySet<string>,
  selectedKeys: ReadonlySet<string>,
) {
  if (initialSelectedKeys.size > 0 || selectedKeys.size === 0) {
    return 'Save changes';
  }

  return `Add to ${selectedKeys.size} ${selectedKeys.size === 1 ? 'list' : 'lists'}`;
}

export function buildSelectionDiff(
  initialSelectedKeys: ReadonlySet<string>,
  selectedKeys: ReadonlySet<string>,
): WatchlistSelectionDiff {
  return {
    addedKeys: [...selectedKeys].filter((key) => !initialSelectedKeys.has(key)),
    removedKeys: [...initialSelectedKeys].filter((key) => !selectedKeys.has(key)),
  };
}

export function autoSelectCreatedWatchlist(
  selectedKeys: ReadonlySet<string>,
  createdKey: string,
) {
  return new Set([...selectedKeys, createdKey]);
}

export function rollbackSelection(initialSelectedKeys: ReadonlySet<string>) {
  return new Set(initialSelectedKeys);
}
