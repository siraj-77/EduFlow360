import {
  assertDeliverable,
  type IEmailDelivery,
  type OutboundEmail,
} from '../../domain/ports/email-delivery.js';

/**
 * The recording adapter — the default when no SMTP is configured, and the
 * double the use-cases are tested against (`ADR-014`).
 *
 * See `recording-email-adapter.spec.ts` for why a fresh checkout with no
 * `.env` still boots and still runs. The short version: a boot failure is not
 * an acceptable substitute for "this deployment has not bought a mail relay".
 *
 * The sent mail is held in memory for the life of the process. That is a
 * deliberate limit — this is not a mailbox and has no delivery guarantee —
 * and it is why the boot banner reports which adapter is active, so a
 * deployment running on it is visible rather than silently "working".
 */
export class RecordingEmailAdapter implements IEmailDelivery {
  /** Everything this process was asked to deliver, in order. */
  readonly sent: OutboundEmail[] = [];

  async send(email: OutboundEmail): Promise<void> {
    assertDeliverable(email);
    this.sent.push(email);
  }

  /** Drop the buffer, so a suite can assert exactly what its own test caused. */
  clear(): void {
    this.sent.length = 0;
  }
}
