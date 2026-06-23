export interface ImportSelectionState {
  selectedCount: number;
  allSelected: boolean;
  indeterminate: boolean;
}

export const getImportSelectionState = (
  importableKeys: readonly string[],
  selectedKeys: ReadonlySet<string>,
): ImportSelectionState => {
  const selectedCount = importableKeys.filter((key) => selectedKeys.has(key)).length;
  const allSelected = importableKeys.length > 0 && selectedCount === importableKeys.length;
  return {
    selectedCount,
    allSelected,
    indeterminate: selectedCount > 0 && !allSelected,
  };
};

export const toggleAllImportableKeys = (
  previous: ReadonlySet<string>,
  importableKeys: readonly string[],
  checked: boolean,
): Set<string> => {
  const next = new Set(previous);
  importableKeys.forEach((key) => checked ? next.add(key) : next.delete(key));
  return next;
};

export const applyStatusToSelectedKeys = <Status extends string>(
  previous: ReadonlyMap<string, Status>,
  importableKeys: readonly string[],
  selectedKeys: ReadonlySet<string>,
  status: Status,
): Map<string, Status> => {
  const next = new Map(previous);
  importableKeys.forEach((key) => {
    if (selectedKeys.has(key)) next.set(key, status);
  });
  return next;
};
