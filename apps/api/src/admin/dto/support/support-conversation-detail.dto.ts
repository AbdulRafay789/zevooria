import type { SupportConversationListItemDto } from './support-conversation-list.dto';
import type { SupportMessageDto } from './support-message.dto';

export type SupportCustomerSummaryDto = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  emailVerifiedAt: string | null;
  isActive: boolean;
};

export type SupportAssigneeSummaryDto = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
};

export type SupportConversationDetailDto = {
  conversation: SupportConversationListItemDto;
  customer: SupportCustomerSummaryDto | null;
  assignee: SupportAssigneeSummaryDto | null;
  messages: SupportMessageDto[];
};
