import { describe, expect, it } from 'vitest';
import type { IEmailDelivery, OutboundEmail } from '../../domain/ports/email-delivery.js';
import { RecordingEmailAdapter } from './recording-email-adapter.js';

/**
 * `RecordingEmailAdapter` — the default when no SMTP is configured, and the
 * double the use-cases are tested against (`ADR-014`).
 *
 * ## Why a recording adapter rather than "no adapter"
 *
 * `ADR-014` settles delivery as SMTP in production with a mail catcher in
 * development. The third state — neither — is the one this class exists for:
 * a fresh `git clone` with no `.env` must still run its tests, and a
 * deployment that has not configured mail must still BOOT. The alternative is
 * a container that refuses to start because a school has not bought an SMTP
 * relay yet, which is a boot failure standing in for a feature nobody asked
 * for at P2.
 *
 * The name is the contract: it RECORDS. Nothing leaves the process, and a
 * test that reads `sent` is reading what would have been mailed.
 */

const email = (overrides: Partial<OutboundEmail> = {}): OutboundEmail => ({
  to: 'teacher@school.lk',
  subject: 'Reset your EduFlow360 password',
  textBody: 'Use the link below to reset your password.',
  htmlBody: null,
  ...overrides,
});

describe('RecordingEmailAdapter', () => {
  it('records what it was asked to deliver', async () => {
    const adapter = new RecordingEmailAdapter();

    await adapter.send(email());

    expect(adapter.sent).toEqual([email()]);
  });

  it('refuses a blank recipient rather than recording mail to nowhere', async () => {
    // A silent success here is the failure mode this prevents: a test passes,
    // a deployment "works", and nobody notices the reset mail went nowhere.
    const adapter = new RecordingEmailAdapter();

    await expect(adapter.send(email({ to: '   ' }))).rejects.toThrow(/recipient/i);
  });

  it('records in order, because a test asserting "the second mail" is a real question', async () => {
    const adapter = new RecordingEmailAdapter();

    await adapter.send(email({ subject: 'first' }));
    await adapter.send(email({ subject: 'second' }));

    expect(adapter.sent.map((mail) => mail.subject)).toEqual(['first', 'second']);
  });

  it('clears, so a suite can assert "exactly the mails this test caused"', async () => {
    const adapter = new RecordingEmailAdapter();
    await adapter.send(email());
    adapter.clear();

    expect(adapter.sent).toEqual([]);
  });

  /**
   * The port contract, restated where it can be checked.
   *
   * `AGENTS.md` 2.13: a reset token never appears in a log, and the recording
   * adapter's buffer IS a log-shaped thing — so the link URL is not the
   * adapter's to police, it is the use-case's to never hand over. What this
   * asserts is the one thing the adapter CAN guarantee: it keeps exactly what
   * it was given, and a caller inspecting `sent` sees the body the user would
   * have read.
   */
  it('keeps the body verbatim, so a test reads what the user would have read', async () => {
    const adapter = new RecordingEmailAdapter();

    await adapter.send(email({ textBody: 'token body' }));

    expect(adapter.sent[0]?.textBody).toBe('token body');
  });

  it('implements the port with nothing extra on the wire', async () => {
    // A structural check, not a nominal one: the adapter must be usable
    // through the port the use-cases hold, or the port is decoration.
    const throughPort: IEmailDelivery = new RecordingEmailAdapter();

    await throughPort.send(email());

    expect((throughPort as RecordingEmailAdapter).sent).toHaveLength(1);
  });
});
