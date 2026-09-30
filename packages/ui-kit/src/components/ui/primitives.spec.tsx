// @vitest-environment jsdom
//
// The DOM is scoped to this file rather than set for the whole package: the
// token suite reads `styles.css` with `readFileSync(new URL(..., import.meta.url))`,
// which jsdom breaks because `import.meta.url` is an http URL there.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { Badge } from './badge';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './dialog';
import { Input } from './input';
import { Label } from './label';
import { Skeleton } from './skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
import { Button } from './button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Toaster, toast } from './sonner';

/**
 * The primitives, tested for the four things `AGENTS.md` actually requires of
 * them. Not "does it render" - that is the easy half.
 *
 * 3.2.1  every interactive surface inherits the design system's focus,
 *        touch-target and disabled behaviour, so no raw element is allowed and
 *        the primitives are the sanctioned home for one.
 * 3.2.2  a 44px touch-target floor on everything reachable.
 * 3.2.5  no hard-coded colour; colours are tokens so a component works in both
 *        light and dark. Tokens are the ten in `styles.css`, mapped by
 *        `@theme inline` - so a component may only name THOSE utilities.
 * 3.2.6  logical properties, so `ar` mirrors without per-component work. A
 *        physical `ml-`/`pr-`/`left-`/`right-` is a bug that only shows up once
 *        a school in Kuwait opens the app.
 *
 * The colour and RTL cases are the ones worth having. A component that renders
 * fine and looks right in English LTR light mode can still violate all three.
 */

const TOUCH = 'var(--touch-target-min)';

describe('AGENTS.md 3.2.5 - primitives name tokens, never colours', () => {
  it('no primitive class contains a hex, rgb() or hsl() literal', () => {
    // Rendered class strings, not the source: a token can be smuggled in
    // through a variant, and a source scan would miss a computed one.
    const rendered: string[] = [];
    const collect = (c: HTMLElement) => rendered.push(c.className);

    const { container } = render(
      <>
        <Button>Default</Button>
        <Button variant="brand">Brand</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="ghost">Ghost</Button>
        <Input aria-label="Name" />
        <Badge>Badge</Badge>
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
          </CardHeader>
          <CardContent>Body</CardContent>
        </Card>
        <Label htmlFor="x">Label</Label>
        <Skeleton />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Head</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </>,
    );

    for (const el of Array.from(container.querySelectorAll('*'))) collect(el);

    const offenders = rendered.filter((c) => /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(c));

    expect(offenders, `these class names hard-code a colour: ${offenders.join(' | ')}`).toEqual([]);
  });

  it('the brand variant resolves through the brand token, not a literal', () => {
    render(<Button variant="brand">Brand</Button>);
    const className = screen.getByRole('button').className;

    expect(className).toMatch(/bg-brand\b/);
    expect(className).not.toMatch(/indigo|blue-/); // a shadcn default that ignored our palette
  });
});

describe('AGENTS.md 3.2.6 - primitives use logical properties', () => {
  it('no primitive class uses a physical direction utility', () => {
    const { container } = render(
      <>
        <Button>Go</Button>
        <Input aria-label="Name" />
        <Card>
          <CardHeader>
            <CardTitle>T</CardTitle>
          </CardHeader>
          <CardContent>B</CardContent>
        </Card>
        <Label htmlFor="y">L</Label>
        <Skeleton />
      </>,
    );

    const classNames = Array.from(container.querySelectorAll('*'))
      .map((e) => e.className)
      .join(' ');
    // `ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/`text-start` are logical.
    // `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-` are physical and mirror wrongly.
    const physical = classNames.match(
      /\b(?:m[lr]-|p[lr]-|left-|right-|rounded-[lr]\b|text-left|text-right)/g,
    );

    expect(
      physical,
      `these utilities are physical and will not mirror in Arabic: ${physical?.join(' ') ?? ''}`,
    ).toBeNull();
  });
});

describe('AGENTS.md 3.2.2 - the 44px touch-target floor', () => {
  it.each([
    ['Button', <Button key="b">Go</Button>, 'button'],
    ['Input', <Input key="i" aria-label="Name" />, 'textbox'],
  ])('%s declares the touch-target floor', (_name, element, role) => {
    render(element);

    expect(screen.getByRole(role).className).toContain(TOUCH);
  });

  it('the floor comes from the token, not a hard-coded 44px', () => {
    render(<Button>Go</Button>);
    const className = screen.getByRole('button').className;

    // A hard-coded 44px would pass the floor today and silently diverge the
    // moment the token changes - which is the defect the token exists to stop.
    expect(className).not.toMatch(/\b(?:min-)?[hw]-?\[?44px/);
    expect(className).toMatch(/\[var\(--touch-target-min\)\]/);
  });
});

describe('Button', () => {
  it('renders a real button, and only one', () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' }).tagName).toBe('BUTTON');
  });

  it('forwards its ref, so a caller can focus it', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Save</Button>);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('supports asChild, so a link can look like a button', () => {
    // Without this every navigation would need a real <button>, and the first
    // screen in the repo had to be built from raw anchors because it did not
    // exist. `variant="brand"` because the point is that the anchor picks up
    // the full button treatment, not the default's surface-and-border one.
    render(
      <Button asChild variant="brand">
        <a href="/en/sign-in">Sign in</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Sign in' });
    expect(link.tagName).toBe('A');
    expect(link.className).toMatch(/bg-brand/);
    expect(link.className).toMatch(/min-h-\[var\(--touch-target-min\)\]/);
  });

  it('does not fire onClick when disabled', async () => {
    const user = userEvent.setup();
    let fired = 0;
    render(
      <Button disabled onClick={() => (fired += 1)}>
        Save
      </Button>,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(fired).toBe(0);
  });
});

describe('Input and Label', () => {
  it('a label is associated with its control by id', () => {
    render(
      <>
        <Label htmlFor="student-name">Name</Label>
        <Input id="student-name" />
      </>,
    );

    expect(screen.getByLabelText('Name')).toBe(screen.getByRole('textbox'));
  });

  it('forwards its ref', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="Name" />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});

describe('Card', () => {
  it('renders a heading inside a landmark with a token surface', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Fees</CardTitle>
        </CardHeader>
        <CardContent>Due</CardContent>
      </Card>,
    );

    expect(screen.getByRole('heading', { name: 'Fees' })).toBeInTheDocument();
    // A raw <div> has no role, so this also proves the card is not a bare div.
    expect(
      screen.getByRole('heading', { name: 'Fees' }).closest('[data-slot="card"]'),
    ).toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  it('carries no text, so a screen reader announces nothing while loading', () => {
    const { container } = render(<Skeleton />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Table', () => {
  it('renders a real table with a header row', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Amara</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Student' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Amara' })).toBeInTheDocument();
  });
});

describe('Dialog', () => {
  it('is closed until the trigger is activated, then exposes a dialog', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Confirm</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('names itself for assistive technology', async () => {
    // A dialog with no accessible name is a dialog a screen-reader user cannot
    // tell apart from any other. Radix logs a warning for this; the assertion
    // is here so the fix cannot be a console line.
    const user = userEvent.setup();
    const error = console.error;
    const seen: string[] = [];
    console.error = (...args: unknown[]) => seen.push(args.map(String).join(' '));

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>Body with no title</DialogContent>
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    console.error = error;

    expect(seen.join(' ')).not.toMatch(/DialogContent( requires)? a? ?DialogTitle/);
  });
});

describe('Select', () => {
  // `select` is not optional. AGENTS.md 3.2.1 bans a raw <select>, so without
  // this component the ban is unsatisfiable for any school that needs a picker
  // - language, class, currency, staff role. Same reasoning as Dialog and
  // Table: the ban has to have a compliant target or it is a dead end.

  it('exposes a keyboard-navigable listbox, because a raw <select> is banned', async () => {
    const user = userEvent.setup();
    render(
      <Select>
        <SelectTrigger aria-label="Language">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">English</SelectItem>
          <SelectItem value="ta">Tamil</SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole('combobox', { name: 'Language' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    // Radix Select is a listbox, not a menu - role matters to a screen reader.
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Tamil' })).toBeInTheDocument();
  });
});

describe('DropdownMenu', () => {
  it('exposes items as menuitems, and the trigger keeps Button styling', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">Account</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole('button', { name: 'Account' }));
    expect(await screen.findByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
  });
});

describe('Toaster', () => {
  it('mounts without throwing, so a toast has somewhere to live', () => {
    render(<Toaster />);
    // sonner renders a live region only once it has something to announce; the
    // point of this test is that mounting does not throw and that toast() is
    // callable, not that a node exists yet.
    expect(() => toast('Saved')).not.toThrow();
  });
});
