import { Toaster as SonnerToaster, toast } from 'sonner';

import { cn } from '../../lib/cn';

/**
 * Toaster, on sonner.
 *
 * `richColors` is off and every tone is a token, because a success toast that
 * is green in one theme and unreadable in the other is worse than a plain one.
 * `closeButton` is on: a toast the user cannot dismiss is a dialog they cannot
 * escape, and an 8-second timeout is not consent.
 *
 * `dir` is a prop because the four locales include Arabic. sonner reads it to
 * place the close button and stack the toasts on the correct side, which is
 * exactly the RTL requirement AGENTS.md 3.2.6 puts on directional UI.
 */
export type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

export function Toaster({ className, ...props }: ToasterProps) {
  return (
    <SonnerToaster
      data-slot="toaster"
      toastOptions={{
        classNames: {
          toast: cn(
            'group flex items-center gap-3 rounded-card border border-border bg-surface p-4 text-text',
            'shadow-[var(--shadow)]',
            className,
          ),
          description: 'text-muted',
          actionButton: 'bg-brand text-on-brand rounded-control',
          cancelButton: 'bg-bg text-text rounded-control',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--surface)',
          '--normal-text': 'var(--text)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { toast };
