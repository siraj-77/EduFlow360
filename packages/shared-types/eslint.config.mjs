import { base } from '@eduflow/config/eslint/base';

/** Shared types: strict TypeScript, no framework rules. Contract, not implementation. */
export default [...base, { rules: {} }];
