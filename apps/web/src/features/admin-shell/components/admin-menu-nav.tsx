import { filterMenu, type MenuItem } from './menu';

export interface AdminMenuNavProps {
  readonly items: readonly MenuItem[];
  readonly granted: Iterable<string> | ReadonlySet<string> | null | undefined;
  readonly renderLabel?: (labelKey: string) => string;
}

export function AdminMenuNav({ items, granted, renderLabel }: AdminMenuNavProps) {
  const permissionSet = granted instanceof Set ? granted : new Set(granted ?? []);
  const visible = filterMenu(items, permissionSet);
  const labelFor = (key: string) => (renderLabel ? renderLabel(key) : key);

  return (
    <nav className="admin-menu-nav" aria-label={labelFor('nav.ariaLabel')} data-testid="admin-menu-nav">
      {visible.map((item) => (
        <div key={item.id} className="admin-menu-item" data-testid="admin-menu-id">
          {labelFor(item.labelKey)}
          {item.children?.length ? (
            <details className="admin-menu-submenu">
              <summary className="admin-menu-summary">{labelFor(`${item.id}.submenu`)}</summary>
              {item.children.map((child) => (
                <span key={child.id} className="admin-menu-child" data-testid="admin-menu-id">
                  {labelFor(child.labelKey)}
                </span>
              ))}
            </details>
          ) : null}
        </div>
      ))}
    </nav>
  );
}
