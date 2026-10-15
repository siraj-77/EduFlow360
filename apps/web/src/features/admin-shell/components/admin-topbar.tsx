import { Input, Button } from '@eduflow/ui-kit';

export interface AdminTopBarProps {
  readonly searchPlaceholder?: string;
  readonly onMenuToggle?: () => void;
}

export function AdminTopBar({ searchPlaceholder, onMenuToggle }: AdminTopBarProps) {
  return (
    <header className="admin-topbar" data-testid="admin-topbar">
<Button type="button" variant="ghost" aria-label={searchPlaceholder} onClick={onMenuToggle}>
          ☰
        </Button>
      ) : (
        <Button type="button" variant="ghost" aria-label={searchPlaceholder} disabled>
          ☰
        </Button>
      <Input className="search" placeholder={searchPlaceholder} readOnly />
    </header>
  );
}
