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
] as const;

export type UiKitToken = (typeof UI_KIT_TOKENS)[number];
