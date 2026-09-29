/**
 * Pre-paint theme resolution.
 *
 * Rendered inside <head> so `data-theme` is on <html> before the first
 * paint. A dark-mode user must never see a white flash
 * (AGENTS.md 3.2.5).
 *
 * Precedence, in order:
 *   1. a stored choice        (the user picked)
 *   2. prefers-color-scheme  (the OS preference)
 *   3. light                 (the :root default)
 *
 * `suppressHydrationWarning` on <html> is required because this script
 * mutates an attribute React also manages.
 */
export function ThemeScript() {
  const script = `
(function () {
  try {
    var stored = localStorage.getItem('eduflow-theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    // Private mode or storage disabled. Light is the :root default, so
    // doing nothing is correct rather than an error worth surfacing.
  }
})();
`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
