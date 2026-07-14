export type OwnerScopedData<T> = { data: T; ownerId: string };

export function replaceOwnedData<T>(
  current: OwnerScopedData<T> | null,
  activeOwnerId: string | null,
  sourceOwnerId: string,
  data: T,
): OwnerScopedData<T> | null {
  if (!activeOwnerId || sourceOwnerId !== activeOwnerId) {
    return current?.ownerId === activeOwnerId ? current : null;
  }

  return { data, ownerId: sourceOwnerId };
}

export function updateOwnedData<T>(
  current: OwnerScopedData<T> | null,
  ownerId: string,
  update: (data: T) => T,
): OwnerScopedData<T> | null {
  if (!current || current.ownerId !== ownerId) return current;
  return { data: update(current.data), ownerId };
}

export function rollbackAlertValue<
  TItem extends { hasReleaseAlert: boolean; key: string },
  TData extends { items: TItem[] },
>(data: TData, key: string, optimisticValue: boolean, previousValue: boolean): TData {
  let changed = false;
  const items = data.items.map((item) => {
    if (item.key !== key || item.hasReleaseAlert !== optimisticValue) return item;
    changed = true;
    return { ...item, hasReleaseAlert: previousValue };
  });
  return changed ? { ...data, items } : data;
}

export function rollbackRemovedList<
  TList extends { key: string },
  TData extends { lists: TList[] },
>(data: TData, removed: TList, previousIndex: number): TData {
  if (data.lists.some((list) => list.key === removed.key)) return data;
  const lists = [...data.lists];
  lists.splice(Math.min(Math.max(previousIndex, 0), lists.length), 0, removed);
  return { ...data, lists };
}
