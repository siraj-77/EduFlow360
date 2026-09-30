/**
 * @eduflow/ui-kit
 *
 * Shared shadcn/ui wrappers. Two rules from AGENTS.md shape everything here:
 *
 *   3.2.1  All UI primitives are shadcn/ui. No raw <button>, <input>,
 *          <select>, <textarea>, <table>, <dialog>. Extend by composition
 *          and className; never edit generated files under components/ui.
 *   3.2.5  Light and dark are both required. Tokens are CSS variables;
 *          never a hard-coded hex in a component.
 *
 * The components/ui/ folder is where the shadcn CLI writes generated
 * code. Treat it as vendor: compose over it, do not edit it.
 *
 * The tokens themselves live in styles.css, harvested from
 * docs/template/EduFlow — Frontend Template.html. See
 * docs/design/FRONTEND_TEMPLATE.md for the measurement that justified
 * harvesting the tokens but not the dictionary.
 */

//
// B-1, 2026-09-30. The primitives exist, so they are exported from here rather
// than reached for by deep path. `AGENTS.md` 3.2.1 says "extend by composition
// and className", and a barrel is what makes that the easy path.
//
// The `UI_KIT_TOKENS` list below is deliberately NOT extended with the
// `--on-*` foreground tokens. It is the §3.2.5 list of ten, and `index.spec.ts`
// asserts against `styles.css` on that basis. The foreground half lives in
// styles.css with its own rationale and is verified by the primitive tests,
// which assert no component class carries a colour literal at all.
//

export { cn } from './lib/cn';
export { Button, buttonVariants, type ButtonProps } from './components/ui/button';
export { Input } from './components/ui/input';
export { Label } from './components/ui/label';
export { Badge, badgeVariants, type BadgeProps } from './components/ui/badge';
export { Skeleton } from './components/ui/skeleton';
export { CheckIcon, ChevronIcon, ChevronUpIcon } from './components/ui/icons';
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';
export { Toaster, toast, type ToasterProps } from './components/ui/sonner';
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './components/ui/card';
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './components/ui/table';
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  type SheetSide,
} from './components/ui/dialog';

export const UI_KIT_TOKENS = [
  '--bg',
  '--surface',
  '--text',
  '--muted',
  '--brand',
  '--brand-2',
  '--accent',
  '--danger',
  '--ok',
  '--border',
  /**
   * Elevation and radius are tokens for the same reason the colours are: a
   * component that hard-codes them cannot work in both themes, and the hex ban
   * in `eslint/next.js` does not see `rgba()`. `--shadow` is theme-paired.
   * (D47)
   */
  '--shadow',
  '--radius-card',
  '--radius-control',
] as const;

export type UiKitToken = (typeof UI_KIT_TOKENS)[number];
