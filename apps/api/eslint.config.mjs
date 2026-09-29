import { node } from '@eduflow/config/eslint/node';

/**
 * EduFlow API lint configuration.
 *
 * The load-bearing rules are inherited from @eduflow/config/eslint/node:
 *
 *   domain/ and use-cases/ may not import @nestjs/*, @prisma/client,
 *   bullmq, ioredis, or any vendor SDK           (AGENTS.md 2.2)
 *   domain/ and use-cases/ may not call Date.now(),
 *   new Date() or Math.random()                  (AGENTS.md 2.4)
 *
 * Both are scoped by path so they cannot be bypassed by editing a file
 * outside those two layers.
 */
export default [...node, { rules: {} }];
