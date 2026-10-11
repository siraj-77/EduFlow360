/**
 * The email-delivery port (`ADR-014`, `PLT-105`).
 *
 * ## Why this port, and not `INotificationChannelAdapter` yet
 *
 * `AGENTS.md` 2.2 lists `INotificationChannelAdapter` among the adapters the
 * architecture expects, and `ADR-014` says email goes through it *from the
 * first story that needs it*. The honest reading of that at P5: the ROUTER's
 * port is a preference-resolving dispatcher (`PLT-701`, P12), and a port with
 * one caller has no preference traffic to resolve. What every email path —
 * now and after the router — must share is THIS: a single outbound message
 * with a recipient, a subject and a body.
 *
 * So this is the narrow port, defined by its first caller. When `PLT-701`
 * lands, `INotificationChannelAdapter` is defined in the notification module
 * and **this same `SmtpEmailAdapter` satisfies both** — `ADR-014`'s promise
 * that the adapter is reused and not rewritten. Nothing here presumes the
 * router's shape, which is why this can exist without designing it.
 *
 * ## What a caller may put in a body
 *
 * `AGENTS.md` 2.13: logs redact credentials, and a reset token is one. The
 * port cannot enforce that — it carries a string — so the rule lives where the
 * body is BUILT: the use-case composes the mail with the link in it (the link
 * is what the user needs) and never hands a token to a logger. The redaction
 * boundary is the composer, documented there.
 */

/** DI token. A symbol because an `interface` has no runtime value to resolve against. */
export const I_EMAIL_DELIVERY = Symbol('IEmailDelivery');

/** One outbound message. Plain text is mandatory; HTML is optional. */
export interface OutboundEmail {
  /** A single recipient. Blank is refused by every implementation. */
  readonly to: string;
  readonly subject: string;
  readonly textBody: string;
  readonly htmlBody: string | null;
}

/**
 * Deliver one message.
 *
 * Rejects on failure — never resolves with "sent: false". A caller that
 * cannot tell whether mail went out is a caller that reports success for a
 * reset link nobody received, which is the support ticket that says "the
 * button did nothing". The caller decides what a failure MEANS (the reset
 * request still answers 200); the port's job is to tell the truth.
 */
export interface IEmailDelivery {
  send(email: OutboundEmail): Promise<void>;
}

/** The one validation every implementation shares: a recipient must exist. */
export function assertDeliverable(email: OutboundEmail): void {
  if (typeof email.to !== 'string' || email.to.trim().length === 0) {
    throw new Error('An outbound email needs a recipient; one was not supplied.');
  }
}
