export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML alternative; always include a text body for clients that prefer plain. */
  html?: string;
  /**
   * Optional blind carbon copy recipients (SES Destination.BccAddresses).
   * Not shown in To/CC headers. Used only when callers explicitly set it
   * (e.g. order confirmation ops copy).
   */
  bcc?: string[];
};

export interface EmailProvider {
  /**
   * Sends the message. When using SES, resolves to the SES MessageId if present.
   * Console / other providers resolve to undefined.
   */
  send(message: EmailMessage): Promise<string | undefined>;
}
