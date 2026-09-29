import { next } from '@eduflow/config/eslint/next';

/**
 * UI kit: shadcn/ui wrappers over the design tokens.
 * Inherits the AGENTS.md 3.2 rules — no raw primitives, no hard-coded colours.
 */
export default [...next, { rules: {} }];
