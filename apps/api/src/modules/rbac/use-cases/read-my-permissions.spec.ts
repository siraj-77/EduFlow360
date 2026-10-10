import { describe, expect, it } from 'vitest';
import type { IPermissionGrantReader } from '../domain/ports/permission-grant-reader.js';
import { ReadMyPermissions, UnidentifiedCallerError } from './read-my-permissions.js';

/**
 * Reading the caller's own permission set — `PLT-204`.
 *
 * ## Why a use-case rather than a controller line
 *
 * The controller has to establish WHO is asking (the principal
 * `SessionGuard` attached) and then hand that identity to something that
 * knows how to read a permission set. Putting the read in the controller
 * would put the port call in the HTTP layer, and the next caller — a
 * future CLI, a future event — would have to repeat it.
 *
 * ## What this use-case deliberately does NOT do
 *
 * It does not filter, sort or deduplicate. The port contract is "the
 * UNION of every role, deduplicated, sorted ascending"
 * (`permission-grant-reader.ts`), and a use-case that re-sorted would be a
 * second place that promise lives and could quietly disagree with the
 * first. It passes the reader's answer through, and the reader owns the
 * shape.
 */

const USER_ID = '6f1b0c1a-2f3b-4c5d-8e9f-0a1b2c3d4e5f';

/**
 * A recording double: returns a fixed key set and records the user ids it
 * was asked for, so a test can prove the use-case asked about the caller
 * and nobody else.
 */
class FakeGrantReader implements IPermissionGrantReader {
  grantedKeysCalls: string[] = [];

  constructor(private readonly keys: readonly string[]) {}

  isGranted(): Promise<boolean> {
    throw new Error('not reached: this suite is about the key set, not one key');
  }

  grantedKeys(params: { userId: string }): Promise<readonly string[]> {
    this.grantedKeysCalls.push(params.userId);
    return Promise.resolve(this.keys);
  }
}

describe('ReadMyPermissions', () => {
  it('returns exactly the keys the reader reports for the caller', async () => {
    const keys = ['AUTH_LINK_EXTERNAL_IDENTITY', 'PERMISSION_READ_OWN'];
    const reader = new FakeGrantReader(keys);

    const result = await new ReadMyPermissions(reader).read({ userId: USER_ID });

    expect(result.permissions).toEqual(keys);
  });

  it('asks the reader for the caller it was given, and no other account', async () => {
    const reader = new FakeGrantReader([]);

    await new ReadMyPermissions(reader).read({ userId: USER_ID });

    expect(reader.grantedKeysCalls).toEqual([USER_ID]);
  });

  it('refuses a blank caller, rather than reading a set for nobody', async () => {
    const reader = new FakeGrantReader([]);
    const useCase = new ReadMyPermissions(reader);

    await expect(useCase.read({ userId: '' })).rejects.toThrow(UnidentifiedCallerError);
    await expect(useCase.read({ userId: '   ' })).rejects.toThrow(UnidentifiedCallerError);

    // And the reader was never asked — a blank id must not reach the database.
    expect(reader.grantedKeysCalls).toEqual([]);
  });

  it('passes the reader answer through untouched, so the shape lives in one place', async () => {
    // The port promises union/dedup/sort. If this use-case re-sorted or
    // re-deduplicated, two implementations of that promise would exist and
    // could disagree; the reader is the single owner.
    const keys = ['USER_CREATE', 'AUDIT_READ', 'AUDIT_READ'];
    const reader = new FakeGrantReader(keys);

    const result = await new ReadMyPermissions(reader).read({ userId: USER_ID });

    expect(result.permissions).toEqual(keys);
  });
});
