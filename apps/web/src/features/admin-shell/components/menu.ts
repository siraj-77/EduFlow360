export type MenuPermissionSet = Set<string> | ReadonlySet<string>;

export interface MenuItem {
  readonly id: string;
  readonly labelKey: string;
  readonly permission: string | null;
  readonly children?: readonly MenuItem[];
}

export function filterMenu(items: readonly MenuItem[], granted: MenuPermissionSet): MenuItem[] {
  const allowed: MenuItem[] = [];

  for (const item of items) {
    if (item.permission !== null && !granted.has(item.permission)) {
      continue;
    }

    const children = item.children ? filterMenu(item.children, granted) : undefined;

    allowed.push({ ...item, ...(children ? { children } : {}) });
  }

  return allowed;
}
