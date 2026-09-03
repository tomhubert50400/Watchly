export function autoSelectCreatedWatchlist(
  selectedKeys: ReadonlySet<string>,
  createdKey: string,
) {
  return new Set([...selectedKeys, createdKey]);
}

export function rollbackSelection(initialSelectedKeys: ReadonlySet<string>) {
  return new Set(initialSelectedKeys);
}
