import type { SupportAttachmentDto } from './support-attachment.dto';

export type SupportMessageDto = {
  id: string;
  direction: string;
  fromEmail: string;
  toEmail: string;
  subject: string | null;
  bodyText: string;
  bodyHtml: string | null;
  sesMessageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  adminUserId: string | null;
  createdAt: string;
  attachments: SupportAttachmentDto[];
};
